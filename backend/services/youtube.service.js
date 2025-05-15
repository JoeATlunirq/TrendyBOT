const { google } = require('googleapis');
// const axios = require('axios'); // Removed as it is unused
const { supabase, isSupabaseReady } = require('./supabase.service');

const serviceApiKeyManagerCallbacks = {
  onKeyUsed: (keyName, callsToday) => {
    console.log(`[ApiKeyManager][Service:YouTube][Event:KeyUsed] Name: ${keyName}, Calls Today: ${callsToday}`);
  },
  onKeyFailure: (keyName, keyValue) => {
    console.error(`[ApiKeyManager][Service:YouTube][Event:KeyFailure] Name: ${keyName}, Value: ${keyValue ? keyValue.substring(0,4) + '...' : 'N/A'}`);
  },
  onReset: (resetDate, clearedCount, remainingFailed) => {
    console.info(`[ApiKeyManager][Service:YouTube][Event:Reset] PT Date: ${resetDate}, Cleared: ${clearedCount}, Still Failed: ${remainingFailed}`);
  }
};
const apiKeyManagerPromise = require('./apiKeyManager.service').getInstance(serviceApiKeyManagerCallbacks);

function parseISO8601Duration(durationString) {
    if (!durationString) return null;
    const regex = /PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?/;
    const matches = durationString.match(regex);
    if (!matches) return null;
    const hours = parseInt(matches[1]) || 0;
    const minutes = parseInt(matches[2]) || 0;
    const seconds = parseInt(matches[3]) || 0;
    return (hours * 3600) + (minutes * 60) + seconds;
}

// --- Supabase Table and Column Constants ---
const CHANNELS_TABLE = 'Channels';
const CH_COL_ID = 'id'; // PK
const CH_COL_CHANNEL_ID = 'channel_id'; // YouTube's Channel ID
const CH_COL_TITLE = 'title';
const CH_COL_DESCRIPTION = 'description';
const CH_COL_CUSTOM_URL = 'custom_url';
const CH_COL_THUMBNAIL_URL = 'thumbnail_url';
const CH_COL_THUMBNAIL_LAST_UPDATED = 'thumbnail_last_updated';
const CH_COL_PUBLISHED_AT = 'published_at'; // Channel's publish date
const CH_COL_SUBSCRIBER_COUNT = 'subscriber_count';
const CH_COL_VIDEO_COUNT = 'video_count';
const CH_COL_VIEW_COUNT = 'view_count';
const CH_COL_UPLOADS_PLAYLIST_ID = 'uploads_playlist_id';
const CH_COL_LAST_FETCHED_AT = 'last_fetched_at'; // Timestamp of last full API fetch for this channel by our system
// const CH_COL_CREATED_WHEN = 'created_when'; // Managed by DB (default now())
// const CH_COL_UPDATED_WHEN = 'updated_when'; // Managed by DB (trigger on update)

const VIDEOS_TABLE = 'Videos';
// Assuming 'video_id' is the effective primary key for conflict resolution,
// though 'id' might be an auto-incrementing PK if it exists in your actual table schema.
// The provided schema doesn't list an explicit 'id' PK for Videos table.
const VID_COL_VIDEO_ID = 'video_id'; // YouTube's Video ID
const VID_COL_CHANNEL_ID = 'channel_id'; // FK to Channels table
const VID_COL_TITLE = 'title';
const VID_COL_DESCRIPTION = 'description';
const VID_COL_PUBLISHED_AT = 'published_at'; // Video's publish date
const VID_COL_THUMBNAIL_URL = 'thumbnail_url';
const VID_COL_DURATION_SECONDS = 'duration_seconds';
const VID_COL_IS_SHORT = 'is_short';
const VID_COL_LATEST_VIEW_COUNT = 'latest_view_count';
const VID_COL_LATEST_LIKE_COUNT = 'latest_like_count';
const VID_COL_LATEST_COMMENT_COUNT = 'latest_comment_count';
const VID_COL_LAST_STATS_UPDATE_AT = 'last_stats_update_at'; // Timestamp of last stats update for this video by our system
// const VID_COL_CREATED_AT_DB = 'created_at'; // Default now() in DB
// const VID_COL_CREATED_WHEN = 'created_when'; // Managed by DB (default now()) - Note: 'created_at' is typical Supabase default
// const VID_COL_UPDATED_WHEN = 'updated_when'; // Managed by DB (trigger on update)

const CHANNEL_DATA_STALE_DAYS = 7; // This can still be used for deciding when to refresh from YT API

const youtube = google.youtube('v3'); // Initialize YouTube client

const channelDataCache = new Map();
const CACHE_DURATION_MS = 1 * 60 * 60 * 1000; // 1 hour for aggregated results

class YoutubeService {
    async _handleYoutubeApiError(error, apiKeyToReport, context) {
        const apiError = error.response?.data?.error;
        let message = apiError?.message || `YouTube API Error in ${context}: ${error.message}`;
        let status = error.response?.status || 500;
        let reportFailure = false;

        if (apiError?.errors?.length > 0) {
            const reason = apiError.errors[0]?.reason;
            if (reason === 'keyInvalid' || reason?.includes('disabled') || reason === 'accessNotConfigured') {
                reportFailure = true;
            } else if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
                reportFailure = true;
            }
        } else if (status === 403 || status === 429) { // Broader check
            reportFailure = true;
        }

        const manager = await apiKeyManagerPromise;
        if (reportFailure && apiKeyToReport) {
            await manager.reportKeyFailure(apiKeyToReport);
            console.warn(`[YoutubeService] Reported failure for API key due to ${context} error: ${message}`);
        }
        const serviceError = new Error(message);
        serviceError.statusCode = status;
        serviceError.originalError = error;
        throw serviceError;
    }

    async getChannelsFromSupabase(channelIds) {
        if (!channelIds || channelIds.length === 0) return [];
        if (!isSupabaseReady()) {
            console.error('[YoutubeService] Supabase client not ready for getChannelsFromSupabase.');
            throw new Error('Supabase client not ready');
        }
        try {
            const selectFields = [
                CH_COL_CHANNEL_ID,
                CH_COL_TITLE,
                CH_COL_SUBSCRIBER_COUNT,
                CH_COL_THUMBNAIL_URL,
                CH_COL_LAST_FETCHED_AT,
                CH_COL_UPLOADS_PLAYLIST_ID
            ].join(',');

            const { data, error } = await supabase
                .from(CHANNELS_TABLE)
                .select(selectFields)
                .in(CH_COL_CHANNEL_ID, channelIds);

            if (error) {
                console.error('[YoutubeService] Error fetching channels from Supabase:', error.message);
                throw error;
            }
            return data || [];
        } catch (error) {
            console.error('[YoutubeService] Catch block: Error fetching channels from Supabase:', error.message);
            throw new Error('Failed to fetch channel base data from Supabase');
        }
    }

    async getVideosForChannelsFromSupabase(channelIds, sinceDate) {
        if (!channelIds || channelIds.length === 0) return [];
        if (!isSupabaseReady()) {
            console.error('[YoutubeService] Supabase client not ready for getVideosForChannelsFromSupabase.');
            throw new Error('Supabase client not ready');
        }
        try {
            const selectFields = [
                VID_COL_VIDEO_ID,
                VID_COL_CHANNEL_ID,
                VID_COL_PUBLISHED_AT,
                VID_COL_LATEST_VIEW_COUNT
                // Add other VID_COL_... fields if needed by calling functions
            ].join(',');

            let query = supabase
                .from(VIDEOS_TABLE)
                .select(selectFields)
                .in(VID_COL_CHANNEL_ID, channelIds);

            if (sinceDate) {
                query = query.gte(VID_COL_PUBLISHED_AT, sinceDate.toISOString());
            }

            const { data, error } = await query.limit(1000); // Keep limit for now, consider pagination later if needed

            if (error) {
                console.error('[YoutubeService] Error fetching videos from Supabase:', error.message);
                throw error;
            }
            return data || [];
        } catch (error) {
            console.error('[YoutubeService] Catch block: Error fetching videos from Supabase:', error.message);
            throw new Error('Failed to fetch video data from Supabase');
        }
    }

    async upsertSupabaseChannelRecord(channelDataFromApi) {
        if (!isSupabaseReady()) {
            console.error('[YoutubeService] Supabase client not ready for upsertSupabaseChannelRecord.');
            throw new Error('Supabase client not ready');
        }
        
        // channelDataFromApi is expected to be an object with keys matching YT API response structure
        // We need to map it to our CH_COL_ constants.
        const recordToUpsert = {
            [CH_COL_CHANNEL_ID]: channelDataFromApi.id, // This is the YouTube Channel ID
            [CH_COL_TITLE]: channelDataFromApi.snippet?.title,
            [CH_COL_DESCRIPTION]: channelDataFromApi.snippet?.description,
            [CH_COL_CUSTOM_URL]: channelDataFromApi.snippet?.customUrl,
            [CH_COL_PUBLISHED_AT]: channelDataFromApi.snippet?.publishedAt,
            [CH_COL_THUMBNAIL_URL]: channelDataFromApi.snippet?.thumbnails?.default?.url,
            // Use CH_COL_THUMBNAIL_LAST_UPDATED if you want to track thumbnail changes specifically
            // For now, CH_COL_LAST_FETCHED_AT covers general data refresh.
            [CH_COL_VIEW_COUNT]: parseInt(channelDataFromApi.statistics?.viewCount, 10) || 0,
            [CH_COL_SUBSCRIBER_COUNT]: parseInt(channelDataFromApi.statistics?.subscriberCount, 10) || 0,
            [CH_COL_VIDEO_COUNT]: parseInt(channelDataFromApi.statistics?.videoCount, 10) || 0,
            [CH_COL_UPLOADS_PLAYLIST_ID]: channelDataFromApi.contentDetails?.relatedPlaylists?.uploads,
            [CH_COL_LAST_FETCHED_AT]: new Date().toISOString()
        };

        try {
            const { data, error } = await supabase
                .from(CHANNELS_TABLE)
                .upsert(recordToUpsert, { onConflict: CH_COL_CHANNEL_ID });

            if (error) {
                console.error(`[YoutubeService] Supabase error upserting channel ${recordToUpsert[CH_COL_CHANNEL_ID]}:`, error.message);
                // Optionally, throw the error if the caller needs to handle it, or just log and continue
            }
            // 'data' here would be an array of upserted records. For a single record, data[0].
    } catch (error) {
            console.error(`[YoutubeService] Catch block: Supabase error upserting channel ${recordToUpsert[CH_COL_CHANNEL_ID]}:`, error.message);
            // Optionally, re-throw
        }
    }

    async upsertSupabaseVideoRecordsBatch(videoRecordsFromApi) {
        if (!isSupabaseReady()) {
            console.error('[YoutubeService] Supabase client not ready for upsertSupabaseVideoRecordsBatch.');
            throw new Error('Supabase client not ready');
        }
        if (!videoRecordsFromApi || videoRecordsFromApi.length === 0) return;

        const recordsToUpsert = videoRecordsFromApi.map(video => ({
            [VID_COL_VIDEO_ID]: video.id, // YouTube Video ID
            // Ensure video.snippet.channelId is available from the YouTube API response when this function is called.
            // If getAggregatedChannelData calls this, it creates videoRecordsToUpsert without channelId initially.
            // It should be added there based on the 'id' (channelId) being processed in the loop.
            [VID_COL_CHANNEL_ID]: video.snippet?.channelId || video.channel_id, // Added fallback for video.channel_id if already mapped
            [VID_COL_TITLE]: video.snippet?.title,
            [VID_COL_DESCRIPTION]: video.snippet?.description,
            [VID_COL_PUBLISHED_AT]: video.snippet?.publishedAt,
            [VID_COL_THUMBNAIL_URL]: video.snippet?.thumbnails?.default?.url,
            [VID_COL_DURATION_SECONDS]: parseISO8601Duration(video.contentDetails?.duration),
            [VID_COL_LATEST_VIEW_COUNT]: parseInt(video.statistics?.viewCount, 10) || 0,
            [VID_COL_LATEST_LIKE_COUNT]: parseInt(video.statistics?.likeCount, 10) || 0,
            [VID_COL_LATEST_COMMENT_COUNT]: parseInt(video.statistics?.commentCount, 10) || 0,
            [VID_COL_IS_SHORT]: video.snippet?.liveBroadcastContent === 'none' && (parseISO8601Duration(video.contentDetails?.duration) || 61) <= 60, // Example logic for is_short
            [VID_COL_LAST_STATS_UPDATE_AT]: new Date().toISOString()
        }));        

        try {
            const { data, error } = await supabase
                .from(VIDEOS_TABLE)
                .upsert(recordsToUpsert, { onConflict: VID_COL_VIDEO_ID, ignoreDuplicates: false }); // ensure ignoreDuplicates is false if not default

            if (error) {
                let errorMessage = error.message;
                if (error.details) errorMessage += ` Details: ${error.details}`;
                console.error(`[YoutubeService] Supabase error batch upserting videos: ${errorMessage}`);
            }
    } catch (error) {
            let errorMessage = error.message;
            if (error.details) errorMessage += ` Details: ${error.details}`;
            console.error(`[YoutubeService] Catch block: Supabase error batch upserting videos: ${errorMessage}`);
        }
    }

    async getAggregatedChannelData(channelIds, forceRefresh = false, timeFrame = "last_30_days") {
        console.log(`[YoutubeService] getAggregatedChannelData for IDs: ${channelIds.join(', ')}, forceRefresh: ${forceRefresh}, timeFrame: ${timeFrame}`);
        
        const uniqueChannelIds = [...new Set(channelIds)];
        const results = [];
        const cacheKey = `${uniqueChannelIds.join(',')}_${timeFrame}`;

        if (!forceRefresh) {
            const cachedResult = channelDataCache.get(cacheKey);
            if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_DURATION_MS)) {
                console.log(`[YoutubeService] Returning in-memory cached data for key: ${cacheKey}`);
                return cachedResult.data;
            }
        }

        let publishedAfterDate;
        const now = new Date();
        switch (timeFrame) {
            case "last_24_hours":
                publishedAfterDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                break;
            case "last_7_days":
                publishedAfterDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                break;
            case "all_time":
                publishedAfterDate = null;
                break;
            case "last_30_days":
            default:
                publishedAfterDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                break;
        }
        console.log(`[YoutubeService] Video stats will be calculated for videos published after: ${publishedAfterDate?.toISOString() || 'N/A (All Time)'}`);

        const supabaseChannelsData = await this.getChannelsFromSupabase(uniqueChannelIds);
        const supabaseChannelsMap = new Map(supabaseChannelsData.map(c => [c[CH_COL_CHANNEL_ID], c]));

        for (const id of uniqueChannelIds) { // 'id' here is the YouTube Channel ID
            let channelResult = { id, name: 'N/A', thumbnailUrl: null, currentSubscriberCount: 0, source: 'Error', error: null };
            const supabaseChannel = supabaseChannelsMap.get(id);
            let pfpIsFresh = false;

            if (supabaseChannel && supabaseChannel[CH_COL_THUMBNAIL_URL] && supabaseChannel[CH_COL_LAST_FETCHED_AT]) {
                const lastUpdatedDate = new Date(supabaseChannel[CH_COL_LAST_FETCHED_AT]);
                const diffDays = (now.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays <= CHANNEL_DATA_STALE_DAYS) {
                    pfpIsFresh = true;
                }
            }

            let liveApiData = null; // This will hold the direct response from youtube.channels.list
            let currentApiKey = null;

            if (forceRefresh || !pfpIsFresh || !supabaseChannel) {
                const manager = await apiKeyManagerPromise;
                currentApiKey = await manager.getKey(); 
                if (!currentApiKey) {
                    channelResult.error = 'API keys exhausted';
                    channelResult.source = 'Supabase (Stale/Missing) + API Key Error';
                    if(supabaseChannel) {
                        channelResult.name = supabaseChannel[CH_COL_TITLE] || 'N/A';
                        channelResult.thumbnailUrl = supabaseChannel[CH_COL_THUMBNAIL_URL];
                        channelResult.currentSubscriberCount = parseInt(supabaseChannel[CH_COL_SUBSCRIBER_COUNT], 10) || 0;
                        channelResult.uploadsPlaylistId = supabaseChannel[CH_COL_UPLOADS_PLAYLIST_ID];
                    }
                    results.push(channelResult);
                    console.warn(`[YoutubeService] No API key available for channel ${id}.`);
                    continue;
                }
    try {
        const response = await youtube.channels.list({
                        part: 'snippet,statistics,contentDetails',
                        id: id, // YouTube Channel ID
                        key: currentApiKey
                    });
                    if (response.data.items && response.data.items.length > 0) {
                        liveApiData = response.data.items[0]; // Keep the raw API data
                        // Upsert using the raw liveApiData. The upsert function handles mapping.
                        await this.upsertSupabaseChannelRecord(liveApiData);
                        channelResult.source = 'YouTube API';
                    } else {
                        channelResult.error = 'Not found via API';
                        channelResult.source = supabaseChannel ? 'Supabase (API miss)' : 'Not Found';
                    }
                } catch (error) {
                    console.error(`[YoutubeService] Error fetching channel ${id} from YouTube API:`, error.message);
                    await this._handleYoutubeApiError(error, currentApiKey, `channels.list for ${id}`);
                    channelResult.error = 'API error';
                    channelResult.source = supabaseChannel ? 'Supabase (API error)' : 'API Error';
                }
            }

            // Determine the definitive source of channel data for current stats
            const dataSourceForStats = liveApiData || (pfpIsFresh && supabaseChannel ? supabaseChannel : null);

            if (!dataSourceForStats && supabaseChannel) { // Fallback to potentially stale Supabase data if API failed or wasn't called
                channelResult.name = supabaseChannel[CH_COL_TITLE] || 'N/A';
                channelResult.thumbnailUrl = supabaseChannel[CH_COL_THUMBNAIL_URL];
                channelResult.currentSubscriberCount = parseInt(supabaseChannel[CH_COL_SUBSCRIBER_COUNT], 10) || 0;
                channelResult.uploadsPlaylistId = supabaseChannel[CH_COL_UPLOADS_PLAYLIST_ID];
                if(!channelResult.source || channelResult.source === 'Error') channelResult.source = 'Supabase (Stale/API Failed)';
            } else if (dataSourceForStats) {
                channelResult.name = dataSourceForStats.snippet?.title || dataSourceForStats[CH_COL_TITLE] || 'N/A';
                channelResult.thumbnailUrl = dataSourceForStats.snippet?.thumbnails?.default?.url || dataSourceForStats[CH_COL_THUMBNAIL_URL];
                channelResult.currentSubscriberCount = parseInt(dataSourceForStats.statistics?.subscriberCount || supabaseChannel?.[CH_COL_SUBSCRIBER_COUNT], 10) || 0;
                channelResult.uploadsPlaylistId = dataSourceForStats.contentDetails?.relatedPlaylists?.uploads || dataSourceForStats[CH_COL_UPLOADS_PLAYLIST_ID];
                if (liveApiData) channelResult.source = 'YouTube API';
                else if (pfpIsFresh && supabaseChannel) channelResult.source = 'Supabase (Fresh PFP)';
            }
            
            // Ensure uploadsPlaylistId is picked up if missed
            if (!channelResult.uploadsPlaylistId && supabaseChannel?.[CH_COL_UPLOADS_PLAYLIST_ID]) {
                channelResult.uploadsPlaylistId = supabaseChannel[CH_COL_UPLOADS_PLAYLIST_ID];
            }

            let totalViewsForTimeFrame = 0, videosPublishedInTimeFrame = 0, avgViewsInTimeFrame = 0;
            let totalLikesInTimeFrame = 0, totalCommentsInTimeFrame = 0;

            if (timeFrame === "all_time" && dataSourceForStats) { // Condition reverted to include dataSourceForStats
                // For "all_time", use the channel's main statistics for views and video count
                totalViewsForTimeFrame = parseInt(dataSourceForStats.statistics?.viewCount || supabaseChannel?.[CH_COL_VIEW_COUNT], 10) || 0;
                videosPublishedInTimeFrame = parseInt(dataSourceForStats.statistics?.videoCount || supabaseChannel?.[CH_COL_VIDEO_COUNT], 10) || 0;
                avgViewsInTimeFrame = videosPublishedInTimeFrame > 0 ? totalViewsForTimeFrame / videosPublishedInTimeFrame : 0;
                channelResult.source += ' (Lifetime Stats)'; // Reverted source message
            } else if (channelResult.uploadsPlaylistId && publishedAfterDate) {
                const manager = await apiKeyManagerPromise;
                currentApiKey = await manager.getKey();
                if (!currentApiKey) {
                    console.warn(`[YoutubeService] No API key for video stats for channel ${id}. Using Supabase fallback if available.`);
                    channelResult.error = (channelResult.error ? channelResult.error + '; ' : '') + 'API keys exhausted for video stats';
                    const supabaseVideos = await this.getVideosForChannelsFromSupabase([id], publishedAfterDate);
                    totalViewsForTimeFrame = supabaseVideos.reduce((sum, v) => sum + (v[VID_COL_LATEST_VIEW_COUNT] || 0), 0);
                    videosPublishedInTimeFrame = supabaseVideos.length;
                    avgViewsInTimeFrame = videosPublishedInTimeFrame > 0 ? totalViewsForTimeFrame / videosPublishedInTimeFrame : 0;
                    channelResult.source += ' (Video Stats Supabase Fallback)';
                } else {
                    try {
                        console.log(`[YoutubeService] Attempting playlistItems.list for channel ${id} using uploadsPlaylistId: ${channelResult.uploadsPlaylistId}`);
                        const videoIdsFromPlaylist = [];
                        let nextPageToken = null, attempts = 0;
                        do {
                            attempts++;
                            const playlistItems = await youtube.playlistItems.list({
                                part: 'snippet,contentDetails',
                                playlistId: channelResult.uploadsPlaylistId,
                                maxResults: 50,
                                pageToken: nextPageToken,
                                key: currentApiKey
                            });
                            const items = playlistItems.data.items || [];
                            for (const item of items) {
                                if (new Date(item.snippet?.publishedAt) >= publishedAfterDate) {
                                    if (item.contentDetails?.videoId) videoIdsFromPlaylist.push(item.contentDetails.videoId);
                                } else {
                                    nextPageToken = null;
                                    break;
                                }
                            }
                            if (items.length === 50 && nextPageToken !== null) nextPageToken = playlistItems.data.nextPageToken;
                            else nextPageToken = null;
                            if (attempts >= 5 && nextPageToken) break; // Limit API calls
                        } while (nextPageToken);

                        if (videoIdsFromPlaylist.length > 0) {
                            const videoApiResponsesToUpsert = [];
                            for (let i = 0; i < videoIdsFromPlaylist.length; i += 50) {
                                const managerBatch = await apiKeyManagerPromise;
                                const batchApiKey = await managerBatch.getKey();
                                if(!batchApiKey) { console.warn("API key exhausted during video batch fetch."); break; }
                                const batchVideoIds = videoIdsFromPlaylist.slice(i, i + 50);
                                const videoDetailsResponse = await youtube.videos.list({
                                    part: 'snippet,statistics,contentDetails',
                                    id: batchVideoIds.join(','),
                                    maxResults: batchVideoIds.length,
                                    key: batchApiKey
                                });
                                for (const videoDataFromApi of videoDetailsResponse.data.items || []) {
                                    if (new Date(videoDataFromApi.snippet?.publishedAt) >= publishedAfterDate) {
                                        totalViewsForTimeFrame += parseInt(videoDataFromApi.statistics?.viewCount, 10) || 0;
                                        totalLikesInTimeFrame += parseInt(videoDataFromApi.statistics?.likeCount, 10) || 0;
                                        totalCommentsInTimeFrame += parseInt(videoDataFromApi.statistics?.commentCount, 10) || 0;
                                        videosPublishedInTimeFrame++;
                                        // Add channel_id for upsert mapping
                                        const videoWithChannelId = { ...videoDataFromApi, channel_id: id };
                                        videoApiResponsesToUpsert.push(videoWithChannelId);
                                    }
                                }
                            }
                            if (videoApiResponsesToUpsert.length > 0) await this.upsertSupabaseVideoRecordsBatch(videoApiResponsesToUpsert);
                        }
                        avgViewsInTimeFrame = videosPublishedInTimeFrame > 0 ? totalViewsForTimeFrame / videosPublishedInTimeFrame : 0;
                        channelResult.source += ` (Video Stats API - ${timeFrame})`;
                    } catch (videoError) {
                        let specificErrorMessage = 'Video stats API error';
                        const apiError = videoError.response?.data?.error;
                        let reportKeyForThisError = false;

                        if (apiError?.errors?.length > 0) {
                            const reason = apiError.errors[0]?.reason;
                            if (reason === 'playlistNotFound') {
                                specificErrorMessage = 'Uploads playlist not found or inaccessible.';
                                console.warn(`[YoutubeService] ${specificErrorMessage} for channel ${id} (uploadsPlaylistId: ${channelResult.uploadsPlaylistId}). Error: ${videoError.message}`);
                            } else if (reason === 'keyInvalid' || reason?.includes('disabled') || reason === 'accessNotConfigured' || reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
                                reportKeyForThisError = true;
                                specificErrorMessage = `Video stats API error (${reason})`;
                                console.warn(`[YoutubeService] Key-related error (${reason}) for channel ${id} during video stats fetch.`);
                            } else {
                                specificErrorMessage = `Video stats API error (${reason || 'unknown reason'})`;
                                console.warn(`[YoutubeService] API error for channel ${id} during video stats fetch: ${videoError.message}`);
                            }
                        } else if (videoError.response?.status === 403 || videoError.response?.status === 429) {
                             reportKeyForThisError = true;
                             specificErrorMessage = `Video stats API error (status ${videoError.response.status})`;
                             console.warn(`[YoutubeService] Key-related error (status ${videoError.response.status}) for channel ${id} during video stats fetch.`);
                        } else {
                            console.error(`[YoutubeService] Error fetching video stats for channel ${id} from API:`, videoError.message);
                        }

                        if (reportKeyForThisError && currentApiKey) { // Use the key that was active for this block
                            const manager = await apiKeyManagerPromise;
                            await manager.reportKeyFailure(currentApiKey);
                            specificErrorMessage += ', API key reported.';
                            console.info(`[YoutubeService] Reported failure for API key used for channel ${id} video stats.`);
                        }

                        channelResult.error = (channelResult.error ? channelResult.error + '; ' : '') + specificErrorMessage;
                        
                        const supabaseVideos = await this.getVideosForChannelsFromSupabase([id], publishedAfterDate);
                        totalViewsForTimeFrame = supabaseVideos.reduce((sum, v) => sum + (v[VID_COL_LATEST_VIEW_COUNT] || 0), 0);
                        videosPublishedInTimeFrame = supabaseVideos.length;
                        avgViewsInTimeFrame = videosPublishedInTimeFrame > 0 ? totalViewsForTimeFrame / videosPublishedInTimeFrame : 0;
                        channelResult.source += ' (Video Stats Supabase Fallback on API Error)';
                    }
                }
            } else if (!channelResult.uploadsPlaylistId && publishedAfterDate) { // No playlist ID, try direct Supabase lookup for recent videos
                const supabaseVideos = await this.getVideosForChannelsFromSupabase([id], publishedAfterDate);
                totalViewsForTimeFrame = supabaseVideos.reduce((sum, v) => sum + (v[VID_COL_LATEST_VIEW_COUNT] || 0), 0);
                videosPublishedInTimeFrame = supabaseVideos.length;
                avgViewsInTimeFrame = videosPublishedInTimeFrame > 0 ? totalViewsForTimeFrame / videosPublishedInTimeFrame : 0;
                channelResult.source += ' (Video Stats Supabase - No Playlist ID)';
            }

            channelResult.totalViewsInTimeFrame = totalViewsForTimeFrame;
            channelResult.avgViewsInTimeFrame = Math.round(avgViewsInTimeFrame);
            channelResult.videosPublishedInTimeFrame = videosPublishedInTimeFrame;
            channelResult.totalLikesInTimeFrame = totalLikesInTimeFrame;
            channelResult.totalCommentsInTimeFrame = totalCommentsInTimeFrame;
            channelResult.timeFrameUsed = timeFrame;
            results.push(channelResult);
        }
        
        channelDataCache.set(cacheKey, { timestamp: Date.now(), data: results });
        console.log(`[YoutubeService] End of getAggregatedChannelData. Processed ${results.length} channels.`);
        return results;
    }

    /**
     * Fetches recent videos for a specific channel published after a given date using YouTube API.
     * This function fetches from API and can optionally save to Supabase.
     * @param {string} channelId - The ID of the YouTube channel.
     * @param {Date} publishedAfterDate - The date after which videos should have been published.
     * @param {number} [maxResultsPerPage=25] - Max videos to fetch per API call (capped at 50 by YT).
     * @param {boolean} [saveToSupabase=true] - Whether to save/update fetched videos in Supabase.
     * @returns {Promise<Array<object>>} - A promise that resolves to an array of video objects from YouTube API.
     */
    async getRecentVideosForChannel(channelId, publishedAfterDate, maxResultsPerPage = 25, saveToSupabase = true) {
        console.log(`[YoutubeService] Fetching recent videos for channel ${channelId} published after ${publishedAfterDate.toISOString()}, saveToSupabase: ${saveToSupabase}`);
        const manager = await apiKeyManagerPromise;
        let currentApiKey = await manager.getKey();
        if (!currentApiKey) {
            console.warn(`[YoutubeService] No API key available to fetch recent videos for channel ${channelId}.`);
            return [];
        }

        const allVideosFromApi = [];
        let videoIdsFound = [];
        let nextPageToken = null;
        let searchAttempts = 0;
        const MAX_SEARCH_PAGES = 3; 

        try {
            do {
                searchAttempts++;
                if (searchAttempts > 1) { 
                    currentApiKey = await manager.getKey();
                    if (!currentApiKey) {
                        console.warn(`[YoutubeService] API key exhausted during paginated search for channel ${channelId}.`);
                        break;
                    }
                }
                const searchResponse = await youtube.search.list({
                    part: 'id',
                    channelId: channelId,
                    publishedAfter: publishedAfterDate.toISOString(),
                    type: 'video',
                    order: 'date',
                    maxResults: Math.min(maxResultsPerPage, 50),
                    pageToken: nextPageToken,
                    key: currentApiKey
                });

                (searchResponse.data.items || []).forEach(item => {
                    if (item.id && item.id.videoId) {
                        videoIdsFound.push(item.id.videoId);
                    }
                });
                nextPageToken = searchResponse.data.nextPageToken;
                if (searchAttempts >= MAX_SEARCH_PAGES) nextPageToken = null;

            } while (nextPageToken);

            if (videoIdsFound.length === 0) {
                console.log(`[YoutubeService] No recent videos found via search for channel ${channelId} after ${publishedAfterDate.toISOString()}.`);
                return [];
            }
            console.log(`[YoutubeService] Found ${videoIdsFound.length} recent video IDs for channel ${channelId}. Fetching details.`);

            const videoApiResponsesToUpsert = [];
            for (let i = 0; i < videoIdsFound.length; i += 50) {
                currentApiKey = await manager.getKey(); 
                if (!currentApiKey) {
                    console.warn(`[YoutubeService] API key exhausted before fetching batch of video details for channel ${channelId}.`);
                    break;
                }
                const batchVideoIds = videoIdsFound.slice(i, i + 50);
                try {
                    const videoDetailsResponse = await youtube.videos.list({
                        part: 'snippet,statistics,contentDetails',
                        id: batchVideoIds.join(','),
                        maxResults: batchVideoIds.length,
                        key: currentApiKey
                    });
                    const fetchedVideos = videoDetailsResponse.data.items || [];
                    allVideosFromApi.push(...fetchedVideos);
                    if (saveToSupabase) {
                        // Add channel_id to each video object for Supabase mapping
                        const videosWithChannelId = fetchedVideos.map(v => ({ ...v, channel_id: channelId }));
                        videoApiResponsesToUpsert.push(...videosWithChannelId);
                    }
                } catch (videoListError) {
                    console.error(`[YoutubeService] Error fetching batch video details for channel ${channelId}:`, videoListError.message);
                    await this._handleYoutubeApiError(videoListError, currentApiKey, `videos.list for recent videos channel ${channelId}`);
                    break; 
                }
            }

            if (saveToSupabase && videoApiResponsesToUpsert.length > 0) {
                console.log(`[YoutubeService] Saving/Updating ${videoApiResponsesToUpsert.length} videos to Supabase for channel ${channelId}.`);
                await this.upsertSupabaseVideoRecordsBatch(videoApiResponsesToUpsert);
            }
            
            console.log(`[YoutubeService] Successfully fetched details for ${allVideosFromApi.length} videos for channel ${channelId}.`);
            return allVideosFromApi; // Return the raw API response videos

        } catch (error) {
            console.error(`[YoutubeService] Error in getRecentVideosForChannel for ${channelId}:`, error.message);
            await this._handleYoutubeApiError(error, currentApiKey, `getRecentVideosForChannel ${channelId}`);
            return [];
        }
    }

    async getVideosForChannelIdsFromSupabase(
        channelIds, 
        // sinceDateString = null, // Deprecated by uploadDateFilter
        limit = 24, 
        page = 1,
        sortBy = 'date_new_old', // Default sort
        uploadDateFilter = 'any',
        customDateStart = null,
        customDateEnd = null,
        durationMin = null,
        durationMax = null,
        viewsMin = null,
        viewsMax = null,
        likesMin = null,
        commentsMin = null,
        engagementRateMinVideo = null
    ) {
        if (!isSupabaseReady()) {
            console.error('[YoutubeService] Supabase client not ready for getVideosForChannelIdsFromSupabase.');
            throw new Error('Supabase client not ready');
        }
        if (!channelIds || channelIds.length === 0) {
            return { list: [], pagination: { totalItems: 0, page, limit, totalPages: 0 } }; // Matched frontend: totalItems
        }

        const offset = (page - 1) * limit;

        try {
            let query = supabase
                .from(VIDEOS_TABLE)
                .select([
                    VID_COL_VIDEO_ID,
                    VID_COL_CHANNEL_ID,
                    VID_COL_TITLE,
                    VID_COL_DESCRIPTION,
                    VID_COL_PUBLISHED_AT,
                    VID_COL_THUMBNAIL_URL,
                    VID_COL_DURATION_SECONDS,
                    VID_COL_LATEST_VIEW_COUNT,
                    VID_COL_LATEST_LIKE_COUNT,
                    VID_COL_LATEST_COMMENT_COUNT,
                    VID_COL_LAST_STATS_UPDATE_AT
                ].join(','), { count: 'exact' }) // Request total count
                .in(VID_COL_CHANNEL_ID, channelIds);

            // 1. Date Filtering
            if (uploadDateFilter === "custom_range") {
                if (customDateStart) {
                    try {
                        const startDate = new Date(customDateStart);
                        query = query.gte(VID_COL_PUBLISHED_AT, startDate.toISOString());
                    } catch (e) { console.warn("[YoutubeService] Invalid customDateStart", e); }
                }
                if (customDateEnd) {
                    try {
                        const endDate = new Date(customDateEnd);
                        endDate.setDate(endDate.getDate() + 1); // Make it inclusive of the selected end day
                        query = query.lt(VID_COL_PUBLISHED_AT, endDate.toISOString());
                    } catch (e) { console.warn("[YoutubeService] Invalid customDateEnd", e); }
                }
            } else if (uploadDateFilter && uploadDateFilter !== "any") {
                const now = new Date();
                let cutoffDate = new Date();
                switch (uploadDateFilter) {
                    case "last_24_hours": cutoffDate.setDate(now.getDate() - 1); break;
                    case "last_7_days": cutoffDate.setDate(now.getDate() - 7); break;
                    case "last_30_days": cutoffDate.setDate(now.getDate() - 30); break;
                    case "last_90_days": cutoffDate.setDate(now.getDate() - 90); break;
                    default: break; 
                }
                if (uploadDateFilter !== "any") { // Ensure cutoffDate is only applied if not 'any'
                    query = query.gte(VID_COL_PUBLISHED_AT, cutoffDate.toISOString());
                }
            }
            
            // 2. Duration Filtering (only if valid numbers provided)
            const minSec = durationMin ? parseInt(durationMin, 10) : null;
            const maxSec = durationMax ? parseInt(durationMax, 10) : null;
            if (minSec !== null && !isNaN(minSec) && minSec > 0) {
                query = query.gte(VID_COL_DURATION_SECONDS, minSec);
            }
            if (maxSec !== null && !isNaN(maxSec) && maxSec > 0) {
                query = query.lte(VID_COL_DURATION_SECONDS, maxSec);
            }

            // 3. Views Filtering
            const minV = viewsMin ? parseInt(viewsMin, 10) : null;
            const maxV = viewsMax ? parseInt(viewsMax, 10) : null;
            if (minV !== null && !isNaN(minV) && minV >= 0) { // Allow 0 for min
                query = query.gte(VID_COL_LATEST_VIEW_COUNT, minV);
            }
            if (maxV !== null && !isNaN(maxV) && maxV > 0) {
                query = query.lte(VID_COL_LATEST_VIEW_COUNT, maxV);
            }

            // 4. Likes Filtering
            const minL = likesMin ? parseInt(likesMin, 10) : null;
            if (minL !== null && !isNaN(minL) && minL >= 0) { // Allow 0 for min
                query = query.gte(VID_COL_LATEST_LIKE_COUNT, minL);
            }
            
            // 5. Comments Filtering
            const minC = commentsMin ? parseInt(commentsMin, 10) : null;
            if (minC !== null && !isNaN(minC) && minC >= 0) { // Allow 0 for min
                query = query.gte(VID_COL_LATEST_COMMENT_COUNT, minC);
            }
            
            // Engagement Rate (minERVideo) will be applied post-fetch for now

            // 6. Sorting
            // Note: Supabase sorts nulls differently based on ascending/descending.
            // Default behavior might be acceptable. Or use .is / .not for explicit null handling if needed.
            let orderAscending = false;
            let orderColumn = VID_COL_PUBLISHED_AT;

            switch (sortBy) {
                case "views_high_low": orderColumn = VID_COL_LATEST_VIEW_COUNT; orderAscending = false; break;
                case "views_low_high": orderColumn = VID_COL_LATEST_VIEW_COUNT; orderAscending = true; break;
                case "date_new_old": orderColumn = VID_COL_PUBLISHED_AT; orderAscending = false; break;
                case "date_old_new": orderColumn = VID_COL_PUBLISHED_AT; orderAscending = true; break;
                case "likes_high_low": orderColumn = VID_COL_LATEST_LIKE_COUNT; orderAscending = false; break;
                case "comments_high_low": orderColumn = VID_COL_LATEST_COMMENT_COUNT; orderAscending = false; break;
                // engagement_rate_high_low will be handled post-fetch for now
                default: orderColumn = VID_COL_PUBLISHED_AT; orderAscending = false; break; // Default sort
            }
            
            if (sortBy !== 'engagement_rate_high_low') { // Only apply DB sort if not ER sort
                query = query.order(orderColumn, { ascending: orderAscending, nullsFirst: false }); // nullsLast is often default for desc
            }
            
            // Apply Pagination AFTER all filters and main sorting
            query = query.range(offset, offset + limit - 1);
            
            const { data: videoData, error, count } = await query;
            
            if (error) {
                console.error('[YoutubeService] Error fetching videos for channel IDs from Supabase:', error.message);
                throw error;
            }

            let videos = videoData || [];

            // --- NEW: Fetch and attach channel thumbnails ---
            if (videos.length > 0) {
                const uniqueChannelIdsInBatch = [...new Set(videos.map(v => v[VID_COL_CHANNEL_ID]))].filter(id => id);
                
                if (uniqueChannelIdsInBatch.length > 0) {
                    const { data: channelThumbnailsData, error: channelsError } = await supabase
                        .from(CHANNELS_TABLE)
                        .select(`${CH_COL_CHANNEL_ID}, ${CH_COL_THUMBNAIL_URL}`)
                        .in(CH_COL_CHANNEL_ID, uniqueChannelIdsInBatch);

                    if (channelsError) {
                        console.warn('[YoutubeService] Error fetching channel thumbnails for video batch:', channelsError.message);
                        // Proceed without thumbnails if this fails
                    } else if (channelThumbnailsData) {
                        const channelThumbnailMap = new Map(
                            channelThumbnailsData.map(ct => [ct[CH_COL_CHANNEL_ID], ct[CH_COL_THUMBNAIL_URL]])
                        );
                        videos = videos.map(video => ({
                            ...video,
                            channel_thumbnail_url: channelThumbnailMap.get(video[VID_COL_CHANNEL_ID]) || null
                        }));
                    }
                }
            }
            // --- END NEW ---

            let processedData = videos.map(video => {
                const views = video[VID_COL_LATEST_VIEW_COUNT] || 0;
                const likes = video[VID_COL_LATEST_LIKE_COUNT] || 0;
                const comments = video[VID_COL_LATEST_COMMENT_COUNT] || 0;
                let engagementRate = 0;
                if (views > 0 && (likes > 0 || comments > 0)) { // ensure likes or comments exist
                    engagementRate = ((likes + comments) / views) * 100;
                }
                return { ...video, engagement_rate: engagementRate }; // Add calculated ER
            });

            // Post-fetch filtering for Engagement Rate
            const minER = engagementRateMinVideo ? parseFloat(engagementRateMinVideo) : null;
            if (minER !== null && !isNaN(minER) && minER > 0) {
                processedData = processedData.filter(video => video.engagement_rate >= minER);
            }

            // Post-fetch sorting for Engagement Rate
            if (sortBy === 'engagement_rate_high_low') {
                processedData.sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
            }
            
            // Note: 'count' from Supabase is the total before post-fetch ER filtering.
            // This is a known limitation for this iteration.
            // If ER filter is applied, the actual number of items in 'processedData' might be less than 'limit',
            // and 'count' might not reflect the true total after ER filtering.
            const totalRows = count || 0; 
            const totalPages = Math.ceil(totalRows / limit); // This also uses pre-ER-filter total

            return {
                list: processedData.map(v => ({...v, engagement_rate: v.engagement_rate.toFixed(1) })), // Format ER for display
                pagination: { totalItems: totalRows, currentPage: page, limit, totalPages } // Matched frontend: totalItems, currentPage
            };
        } catch (error) {
            console.error('[YoutubeService] Catch block: Error fetching videos for channel IDs from Supabase:', error.message);
            throw new Error('Failed to fetch video data for channels from Supabase');
        }
    }

    // --- New helper methods for direct YouTube API calls without Supabase interaction ---
    async searchChannelIdByQuery(query, apiKey) {
        if (!query || typeof query !== 'string' || query.trim() === '') {
            throw new Error('Search query must be a non-empty string.');
        }
        if (!apiKey) throw new Error('API key required for searchChannelIdByQuery');
        try {
            const searchResponse = await youtube.search.list({
                part: 'id',
                q: query,
                type: 'channel',
                maxResults: 1,
                key: apiKey
            });
            if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                return searchResponse.data.items[0].id?.channelId;
            }
            return null;
        } catch (error) {
            // Let _handleYoutubeApiError do the reporting if needed, or handle specific search errors here
            console.error(`[YoutubeService] Error in searchChannelIdByQuery for "${query}":`, error.message);
            throw error; // Re-throw for the controller to handle via _handleYoutubeApiError if it calls it
        }
    }

    async getChannelDetailsById(channelId, apiKey) {
        if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
            throw new Error('Channel ID must be a non-empty string.');
        }
        if (!apiKey) throw new Error('API key required for getChannelDetailsById');
        try {
            const channelDetailsResponse = await youtube.channels.list({
                part: 'snippet,statistics,contentDetails', // contentDetails for uploadsPlaylistId
                id: channelId,
                key: apiKey
            });
            if (channelDetailsResponse.data.items && channelDetailsResponse.data.items.length > 0) {
                return channelDetailsResponse.data.items[0]; // Return the full channel item
            }
            return null;
        } catch (error) {
            console.error(`[YoutubeService] Error in getChannelDetailsById for ID "${channelId}":`, error.message);
            throw error; 
        }
    }
    // --- End of new helper methods ---
}

module.exports = new YoutubeService();
