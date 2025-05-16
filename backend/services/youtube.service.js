const { google } = require('googleapis');
// const axios = require('axios'); // Removed as it is unused
const { supabase, isSupabaseReady } = require('./supabase.service');
const { webcrypto } = require('node:crypto'); // Added for Web Crypto API
const fs = require('node:fs').promises; // For file system operations
const path = require('node:path'); // For path manipulation

// Helper function to map frontend timeframes to ViewStats API 'range' query param values
function convertToViewStatsRange(timeFrame) {
    switch (timeFrame) {
        case "1d": return "1";       // ViewStats might use "1" for yesterday, or might have a specific "today" param if needed for true 24h
        case "7d": return "7";
        case "28d": return "28";
        case "90d": return "90";
        case "365d": return "365";
        case "max": return "alltime";
        default:
            console.warn(`[convertToViewStatsRange] Unknown timeFrame '${timeFrame}', defaulting to '28'.`);
            return "28"; 
    }
}

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
const CH_COL_CUSTOM_URL = 'custom_url'; // This might contain the handle
const CH_COL_HANDLE = 'channel_handle'; // <<< NEW: Specific column for the @handle
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

// --- ViewStats Decryption Logic ---
const VIEWSTATS_IV_B64 = "Wzk3LCAxMDksIC0xMDAsIC05MCwgMTIyLCAtMTI0LCAxMSwgLTY5LCAtNDIsIDExNSwgLTU4LCAtNjcsIDQzLCAtNzUsIDMxLCA3NF0=";
const VIEWSTATS_KEY_B64 = "Wy0zLCAtMTEyLCAxNSwgLTEyNCwgLTcxLCAzMywgLTg0LCAxMDksIDU3LCAtMTI3LCAxMDcsIC00NiwgMTIyLCA0OCwgODIsIC0xMjYsIDQ3LCA3NiwgLTEyNywgNjUsIDc1LCAxMTMsIC0xMjEsIDg5LCAtNzEsIDUwLCAtODMsIDg2LCA5MiwgLTQ2LCA0OSwgNTZd";
const VIEWSTATS_BEARER_TOKEN = "32ev9m0qggn227ng1rgpbv5j8qllas8uleujji3499g9had6oj7f0ltnvrgi00cq"; // Hardcoded for now

async function decryptViewStatsResponse(response) {
  const iv = new Uint8Array(JSON.parse(atob(VIEWSTATS_IV_B64)));
  const key = new Uint8Array(JSON.parse(atob(VIEWSTATS_KEY_B64)));

  const encryptedBuffer = await response.arrayBuffer();

  // Use webcrypto from node:crypto
  const cryptoKey = await webcrypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encryptedBuffer
  );

  const decodedText = new TextDecoder("utf-8").decode(decryptedBuffer);
  return JSON.parse(decodedText);
}

// Helper function to convert range string (e.g., "7d", "28d") to a Date object
function getDateFromRange(rangeString) {
    const now = new Date();
    // DETAILED LOGGING ADDED HERE
    console.log(`[getDateFromRange] Input rangeString: '${rangeString}', Current 'now': ${now.toISOString()}`);

    if (rangeString === "max" || !rangeString) {
        console.log("[getDateFromRange] rangeString is 'max' or empty, returning null.");
        return null; // No date filter for "all time" videos
    }

    // Ensure rangeString is treated as a string for match()
    const strRangeString = String(rangeString);
    const numMatch = strRangeString.match(/^(\d+)/);

    if (!numMatch) {
        console.warn(`[getDateFromRange] Invalid rangeString format: '${strRangeString}', defaulting to 28 days. 'now' before default: ${now.toISOString()}`);
        now.setDate(now.getDate() - 28);
        console.log(`[getDateFromRange] Defaulted. 'now' after default: ${now.toISOString()}`);
        return now;
    }
    const num = parseInt(numMatch[1]);
    const unit = strRangeString.slice(numMatch[1].length); // e.g., "d" from "28d"

    if (isNaN(num) || unit !== 'd') {
        console.warn(`[getDateFromRange] Invalid rangeString unit ('${unit}') or number ('${num}') for input '${strRangeString}', defaulting to 28 days. 'now' before default: ${now.toISOString()}`);
        now.setDate(now.getDate() - 28);
        console.log(`[getDateFromRange] Defaulted. 'now' after default: ${now.toISOString()}`);
        return now;
    }

    now.setDate(now.getDate() - num);
    console.log(`[getDateFromRange] Calculated past date: ${now.toISOString()} (subtracted ${num} days)`);
    return now;
}

class YoutubeService {
    async _getHandleFromDb(channelId) {
        if (!isSupabaseReady() || !channelId) {
            console.warn('[YoutubeService._getHandleFromDb] Supabase not ready or no channelId provided.');
            return null;
        }
        try {
            const { data, error } = await supabase
                .from(CHANNELS_TABLE)
                .select(`${CH_COL_HANDLE}`)
                .eq(CH_COL_CHANNEL_ID, channelId)
                .single(); // We expect at most one channel per ID

            if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is not an error here
                console.error(`[YoutubeService._getHandleFromDb] Error fetching handle for ${channelId}:`, error.message);
                return null;
            }
            if (data && data[CH_COL_HANDLE] && typeof data[CH_COL_HANDLE] === 'string' && data[CH_COL_HANDLE].startsWith('@')) {
                return data[CH_COL_HANDLE];
            }
            return null;
        } catch (catchError) {
            console.error(`[YoutubeService._getHandleFromDb] Catch block error for ${channelId}:`, catchError.message);
            return null;
        }
    }

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
                CH_COL_UPLOADS_PLAYLIST_ID,
                CH_COL_HANDLE // <<< ADDED: Retrieve the handle
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
        
        const snippet = channelDataFromApi.snippet || {};
        const customUrl = snippet.customUrl;
        const handle = customUrl && customUrl.startsWith('@') ? customUrl : null;

        const recordToUpsert = {
            [CH_COL_CHANNEL_ID]: channelDataFromApi.id, // This is the YouTube Channel ID
            [CH_COL_TITLE]: snippet.title,
            [CH_COL_DESCRIPTION]: snippet.description,
            [CH_COL_CUSTOM_URL]: customUrl, // Store the original customUrl
            [CH_COL_HANDLE]: handle, // <<< ADDED: Store the extracted @handle
            [CH_COL_PUBLISHED_AT]: snippet.publishedAt,
            [CH_COL_THUMBNAIL_URL]: snippet.thumbnails?.default?.url,
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

    // Modified to accept ONLY a valid, confirmed @handle for the ViewStats attempt.
    async fetchViewStatsChannelData(actualValidHandle, actualChannelId, range) {
        // actualValidHandle is now expected to be a confirmed @handle.
        const vsRange = convertToViewStatsRange(range);
        const viewStatsUrl = `https://api.viewstats.com/channels/${encodeURIComponent(actualValidHandle)}/stats?range=${vsRange}&groupBy=daily&sortOrder=ASC&withRevenue=true&withEvents=true&withBreakdown=false&withToday=false`;
        
        console.log(`[VS_SVC] Attempting ViewStats for handle: ${actualValidHandle} (Original ID: ${actualChannelId}), Range: ${range}. URL: ${viewStatsUrl.replace(VIEWSTATS_BEARER_TOKEN, "[TOKEN_REDACTED]")}`);

        try {
            const response = await fetch(viewStatsUrl, {
                headers: {
                    'Authorization': `Bearer ${VIEWSTATS_BEARER_TOKEN}`,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' // Example User-Agent
                }
            });

            if (!response.ok) {
                let errorBody = 'Unknown error';
                try {
                    errorBody = await response.text(); // Try to get error body for logging
                } catch (e) { /* ignore */ }
                // Obfuscated log
                console.warn(`[VS_SVC] API request failed for ${viewStatsUrl.replace(VIEWSTATS_BEARER_TOKEN, "[TOKEN_REDACTED]")} with status ${response.status}: ${errorBody.substring(0, 100)}`);
                // Throw an error that getAggregatedChannelData can catch to trigger fallback
                const error = new Error(`ViewStats API request failed: ${response.status} - ${errorBody.substring(0,100)}`);
                error.statusCode = response.status; 
                error.viewStatsError = true;
                error.channelIdForFallback = actualChannelId; // Important for the caller to know which ID to fallback on
                throw error; 
            }

            const decryptedData = await decryptViewStatsResponse(response);

            // const tempDir = path.join(__dirname, '..' ,'tmp');
            // await fs.mkdir(tempDir, { recursive: true });
            // const filePath = path.join(tempDir, `viewstats_decrypted_${correctedIdentifier.replace('@','')}_${range}.json`);
            // await fs.writeFile(filePath, JSON.stringify(decryptedData, null, 2));
            // console.log(`[VS_SVC] Decrypted data for ${correctedIdentifier} saved to ${filePath}`);

            if (!decryptedData || !decryptedData.data || !Array.isArray(decryptedData.data)) {
                console.warn('[VS_SVC] Decrypted ViewStats data is not in expected format or data array is missing for:', actualValidHandle);
                const error = new Error('ViewStats decrypted data malformed');
                error.statusCode = 500; // Internal processing error
                error.viewStatsError = true;
                error.channelIdForFallback = actualChannelId;
                throw error;
            }

            const dailyRecords = decryptedData.data;
            // --- ADDED LOGGING --- 
            if (dailyRecords && dailyRecords.length > 0) {
              console.log('[VS_SVC_RAW_DAILY] First 2 daily records from ViewStats:', JSON.stringify(dailyRecords.slice(0, 2)));
            }
            // --- END ADDED LOGGING ---
            let totalViewsInPeriod = 0;
            let totalSubsInPeriod = 0;
            // Attempt to get videosPublishedCount directly from ViewStats response
            const vsVideosPublishedInPeriod = decryptedData.videosPublishedCount;

            dailyRecords.forEach(record => {
                totalViewsInPeriod += record.viewCountDelta || 0;
                totalSubsInPeriod += record.subscriberCountDelta || 0;
            });

            const result = {
                id: actualChannelId, // Use the actualChannelId for consistency in the merged result
                channelHandle: actualValidHandle, // The valid handle used for ViewStats
                source: 'viewstats_success_generic', // Generic source indicator
                viewsGainedInPeriod: totalViewsInPeriod,
                subsGainedInPeriod: totalSubsInPeriod,
                currentTotalViews: decryptedData.totalViews, 
                currentSubscriberCount: decryptedData.totalSubscribers, 
                dailyChartData: dailyRecords.map(r => ({
                    date: r.date,
                    viewCountDelta: r.viewCountDelta,
                    subscriberCountDelta: r.subscriberCountDelta,
                    totalViews: r.totalViewCount, 
                    totalSubscribers: r.totalSubscriberCount 
                })),
                timeFrameUsed: range, 
                error: null,
                errorType: null
            };
            return result;

    } catch (error) {
            // --- Enhanced Logging ---
            let errorDetails = error.message;
            if (error.cause) { // Node.js >= 16.9.0 for error.cause
                errorDetails += ` | Cause: ${typeof error.cause === 'object' ? JSON.stringify(error.cause) : String(error.cause)}`;
            }
            // Add stack trace to errorDetails for concise logging, but also log the full object.
            // Limiting stack trace length in the primary error message for readability.
            const stackTrace = error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : 'N/A';
            errorDetails += ` | Stack (first 5 lines): ${stackTrace}`;
            
            console.error(`[VS_SVC_ERR_FULL_OBJECT] Full error object for ${actualValidHandle} (ID: ${actualChannelId}), range ${range}:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
            console.error(`[VS_SVC_ERR] Detailed error for ${actualValidHandle}, (ID: ${actualChannelId}), range ${range}:`, errorDetails);
            // --- End Enhanced Logging ---

            const newError = new Error(`Primary analytics provider request failed.`); // Generic User Message
            newError.statusCode = error.statusCode || 500; // error.statusCode might not exist if it's not an HTTP error object we constructed
            newError.viewStatsError = true; // Internal flag
            newError.channelIdForFallback = actualChannelId; 
            throw newError;
        }
    }

    async getAggregatedChannelData(channelIds, frontendProvidedHandles, forceRefresh = false, viewStatsRange = "28d") {
        if (!channelIds || channelIds.length === 0) {
            return [];
        }

        let handlesToProcess = frontendProvidedHandles;
        if (!Array.isArray(handlesToProcess) || handlesToProcess.length !== channelIds.length) {
            console.warn('[YoutubeService.getAggregatedChannelData] frontendProvidedHandles is missing, not an array, or length mismatch. Will primarily rely on DB lookup for handles.');
            handlesToProcess = new Array(channelIds.length).fill(null);
        }

        const results = await Promise.all(channelIds.map(async (currentId, index) => {
            const frontendHandleInput = handlesToProcess[index]; // This could be @handle, ID, or null
            let actualHandleToUseWithViewStats = null;

            if (typeof frontendHandleInput === 'string' && frontendHandleInput.startsWith('@')) {
                actualHandleToUseWithViewStats = frontendHandleInput;
            } else {
                const dbHandle = await this._getHandleFromDb(currentId);
                if (dbHandle) {
                    actualHandleToUseWithViewStats = dbHandle;
                }
            }

            if (actualHandleToUseWithViewStats) {
                try {
                    let viewStatsData = await this.fetchViewStatsChannelData(actualHandleToUseWithViewStats, currentId, viewStatsRange);
                    return viewStatsData;
                } catch (viewStatsError) { // Error from fetchViewStatsChannelData
                    console.warn(`[AggData] Primary source failed for handle ${actualHandleToUseWithViewStats} (ID ${currentId}). Error: ${viewStatsError.message}. Fallback to alternative source.`);
                    try {
                        const ytData = await this.fetchChannelDataFromYouTubeAPI(currentId, viewStatsRange, forceRefresh);
                        return {
                            ...ytData, // ytData also won't have videosPublishedInPeriod or avgViewsPerVideoInPeriod
                            id: currentId,
                            channelHandle: actualHandleToUseWithViewStats, // Keep the handle that was attempted
                            error: `${viewStatsError.message} Fallback to alternative source initiated.`, // More generic now
                            errorType: viewStatsError.statusCode === 404 ? 'primary_source_not_found' : 'primary_source_api_error', // Generic error type
                            source: 'alternative_source_fallback', // Generic source
                        };
                    } catch (youtubeApiError) {
                        console.error(`[AggData] Alternative source fallback ALSO FAILED for ${currentId} (attempted handle ${actualHandleToUseWithViewStats}):`, youtubeApiError.message);
                        return {
                            id: currentId,
                            name: 'Error Fetching Name',
                            channelHandle: actualHandleToUseWithViewStats,
                            errorType: 'alternative_source_api_error', // Generic
                            source: 'alternative_source_fallback', // Generic
                            timeFrameUsed: viewStatsRange,
                        };
                    }
                }
            } else {
                // No valid @handle, go directly to YouTube API (alternative source)
                console.log(`[AggData] No valid handle for ${currentId}. Going directly to alternative source.`);
                try {
                    const ytData = await this.fetchChannelDataFromYouTubeAPI(currentId, viewStatsRange, forceRefresh);
                    return {
                        ...ytData,
                        id: currentId,
                        error: null, 
                        errorType: null, 
                        source: 'alternative_source_initial', // Generic
                    };
                } catch (youtubeApiError) {
                    console.error(`[AggData] Direct call to alternative source FAILED for ${currentId}:`, youtubeApiError.message);
                    return {
                        id: currentId,
                        error: `Data retrieval failed: ${youtubeApiError.message}`, // Generic
                        errorType: 'alternative_source_api_error', // Generic
                        source: 'alternative_source_initial', // Generic
                        timeFrameUsed: viewStatsRange,
                    };
                }
            }
        }));

        // Enrich with latest name and thumbnail from Supabase (or fresh API if needed)
        // This step ensures that even if ViewStats provides some data, we get canonical names/thumbnails.
        const enrichedResults = await this.enrichApiChannelDataWithFullDetails(results, forceRefresh);
        return enrichedResults;
    }

    // Helper function to get foundational data from YouTube API, used as fallback or for initial population.
    async fetchChannelDataFromYouTubeAPI(channelId, timeFrame, forceRefresh = false) {
        const manager = await apiKeyManagerPromise;
        let apiKey = await manager.getKey();
        if (!apiKey) {
            const errMsg = `No API key available for YouTube API fallback for channel ${channelId}`;
            console.error(`[YoutubeService.fetchChannelDataFromYouTubeAPI] ${errMsg}`);
            throw new Error(errMsg);
        }

        let channelDetails;
        try {
            channelDetails = await this.getChannelDetailsById(channelId, apiKey);
            if (!channelDetails) {
                // Specific error for channel not found by API
                const notFoundError = new Error(`Channel ${channelId} not found via YouTube API.`);
                notFoundError.isChannelNotFound = true; // Custom property
                throw notFoundError;
            }
            await this.upsertSupabaseChannelRecord(channelDetails);
        } catch (error) {
            console.error(`[YoutubeService.fetchChannelDataFromYouTubeAPI] Error getting channel details for ${channelId}: ${error.message}`);
            // If it's our custom "not found" error, re-throw it directly so getAggregated can see `isChannelNotFound`
            if (error.isChannelNotFound) {
                throw error;
            }
            // For other errors, handle API key and re-throw
            await this._handleYoutubeApiError(error, apiKey, `fetchChannelDataFromYouTubeAPI (getChannelDetailsById for ${channelId})`);
            throw error; 
        }

        let viewsGainedInPeriod = 0;
        // let videosPublishedInPeriod = 0; // REMOVED
        // let avgViewsPerVideoInPeriod = 0; // REMOVED

        if (timeFrame === "max") {
            viewsGainedInPeriod = parseInt(channelDetails.statistics?.viewCount, 10) || 0;
            // videosPublishedInPeriod = parseInt(channelDetails.statistics?.videoCount, 10) || 0; // REMOVED
            // if (videosPublishedInPeriod > 0) { // REMOVED
            //     avgViewsPerVideoInPeriod = viewsGainedInPeriod / videosPublishedInPeriod; // REMOVED
            // } // REMOVED
        } else {
            const publishedAfterDate = getDateFromRange(timeFrame);
            let videosInPeriod = [];
            if (publishedAfterDate) {
                try {
                    // This call to getRecentVideosForChannel is to SUM view counts of videos PUBLISHED in period
                    // It does not directly provide subs gained in period.
                    videosInPeriod = await this.getRecentVideosForChannel(channelId, publishedAfterDate, 50, true); 
                } catch (error) {
                    console.warn(`[YT_API_Fallback] Error fetching videos for ${channelId} in range ${timeFrame}: ${error.message}`);
                    // Continue, viewsGainedInPeriod will be 0 if this fails
                }
            }
            videosInPeriod.forEach(video => {
                viewsGainedInPeriod += parseInt(video.statistics?.viewCount, 10) || 0;
            });
            // videosPublishedInPeriod = videosInPeriod.length; // REMOVED
            // if (videosPublishedInPeriod > 0) { // REMOVED
            //     avgViewsPerVideoInPeriod = viewsGainedInPeriod / videosPublishedInPeriod; // REMOVED
            // } // REMOVED
        }

        return {
            id: channelId,
            name: channelDetails.snippet?.title,
            thumbnailUrl: channelDetails.snippet?.thumbnails?.default?.url,
            channelHandle: channelDetails.snippet?.customUrl?.startsWith('@') ? channelDetails.snippet.customUrl : (await this._getHandleFromDb(channelId) || null), // Ensure handle is attempted from DB too
            currentSubscriberCount: parseInt(channelDetails.statistics?.subscriberCount, 10) || 0,
            currentTotalViews: parseInt(channelDetails.statistics?.viewCount, 10) || 0,
            uploadsPlaylistId: channelDetails.contentDetails?.relatedPlaylists?.uploads,
            
            viewsGainedInPeriod: viewsGainedInPeriod,
            subsGainedInPeriod: 0, 
            // videosPublishedInPeriod: videosPublishedInPeriod, // REMOVED
            // avgViewsPerVideoInPeriod: avgViewsPerVideoInPeriod, // REMOVED

            dailyChartData: [], 
            source: 'alternative_source_data_generic', // Generic source indicator
            timeFrameUsed: timeFrame,
            error: null,
            errorType: null,
        };
    }

    // Helper function to enrich API channel data with full details from DB or fresh API call
    async enrichApiChannelDataWithFullDetails(channelDataItems, forceRefresh = false) {
        if (!channelDataItems || channelDataItems.length === 0) return [];

        const manager = await apiKeyManagerPromise;

        const enrichedItems = await Promise.all(channelDataItems.map(async (item) => {
            const channelId = item.id; // This is the YouTube Channel ID
            let dbChannelData = null;
            let needsApiRefresh = forceRefresh;

            if (!isSupabaseReady()) {
                console.warn(`[Enrich] Supabase not ready for channel ${channelId}, forcing API refresh.`);
                needsApiRefresh = true;
            } else {
                try {
                    const { data, error } = await supabase
                        .from(CHANNELS_TABLE)
                        .select(`${CH_COL_TITLE}, ${CH_COL_THUMBNAIL_URL}, ${CH_COL_HANDLE}, ${CH_COL_SUBSCRIBER_COUNT}, ${CH_COL_VIEW_COUNT}, ${CH_COL_VIDEO_COUNT}, ${CH_COL_UPLOADS_PLAYLIST_ID}, ${CH_COL_LAST_FETCHED_AT}`)
                        .eq(CH_COL_CHANNEL_ID, channelId)
                        .single();
                    
                    if (error && error.code !== 'PGRST116') { // PGRST116 means 0 rows found
                        console.warn(`[Enrich] Supabase error fetching channel ${channelId}: ${error.message}. Triggering API refresh.`);
                        needsApiRefresh = true;
                    } else if (data) {
                        dbChannelData = data;
                        const lastFetchedDate = data[CH_COL_LAST_FETCHED_AT] ? new Date(data[CH_COL_LAST_FETCHED_AT]) : null;
                        if (!lastFetchedDate || (new Date() - lastFetchedDate) / (1000 * 60 * 60 * 24) > CHANNEL_DATA_STALE_DAYS) {
                            console.log(`[Enrich] DB data for ${channelId} is stale. Triggering API refresh.`);
                            needsApiRefresh = true;
                        }
                    } else { // No data in DB
                        console.log(`[Enrich] No DB data for ${channelId}. Triggering API refresh.`);
                        needsApiRefresh = true;
                    }
                } catch (dbError) {
                    console.warn(`[Enrich] Supabase catch error for channel ${channelId}: ${dbError.message}. Triggering API refresh.`);
                    needsApiRefresh = true;
                }
            }

            // Initialize with item's values (from ViewStats or initial YT API call), then potentially override with DB or fresh API
            let finalDetails = {
                name: item.name,
                thumbnailUrl: item.thumbnailUrl,
                channelHandle: item.channelHandle, // ViewStats provides this, YT_API fallback also tries.
                currentSubscriberCount: item.currentSubscriberCount, // ViewStats provides this
                currentTotalViews: item.currentTotalViews,       // ViewStats provides this
                currentTotalVideos: item.currentTotalVideos,     // YT_API fallback calculates this
                uploadsPlaylistId: item.uploadsPlaylistId        // YT_API fallback provides this
            };
            
            // If DB data exists and not forcing API refresh yet, use DB as a base for potentially missing fields
            if (dbChannelData && !needsApiRefresh) {
                finalDetails.name = finalDetails.name ?? dbChannelData[CH_COL_TITLE];
                finalDetails.thumbnailUrl = finalDetails.thumbnailUrl ?? dbChannelData[CH_COL_THUMBNAIL_URL];
                finalDetails.channelHandle = finalDetails.channelHandle ?? dbChannelData[CH_COL_HANDLE];
                finalDetails.currentSubscriberCount = finalDetails.currentSubscriberCount ?? dbChannelData[CH_COL_SUBSCRIBER_COUNT];
                finalDetails.currentTotalViews = finalDetails.currentTotalViews ?? dbChannelData[CH_COL_VIEW_COUNT];
                finalDetails.currentTotalVideos = finalDetails.currentTotalVideos ?? dbChannelData[CH_COL_VIDEO_COUNT];
                finalDetails.uploadsPlaylistId = finalDetails.uploadsPlaylistId ?? dbChannelData[CH_COL_UPLOADS_PLAYLIST_ID];
            }


            if (needsApiRefresh) {
                let apiKey = await manager.getKey();
                if (apiKey) {
                    try {
                        console.log(`[Enrich] Performing API refresh for channel ${channelId}.`);
                        const apiChannelDetails = await this.getChannelDetailsById(channelId, apiKey);
                        if (apiChannelDetails) {
                            await this.upsertSupabaseChannelRecord(apiChannelDetails); // Save to DB
                            
                            // API data is authoritative when refreshing
                            finalDetails.name = apiChannelDetails.snippet?.title;
                            finalDetails.thumbnailUrl = apiChannelDetails.snippet?.thumbnails?.default?.url;
                            finalDetails.channelHandle = (apiChannelDetails.snippet?.customUrl?.startsWith('@') ? apiChannelDetails.snippet.customUrl : finalDetails.channelHandle) || null; // Prefer API handle if valid, else keep existing
                            finalDetails.currentSubscriberCount = parseInt(apiChannelDetails.statistics?.subscriberCount, 10) || 0;
                            finalDetails.currentTotalViews = parseInt(apiChannelDetails.statistics?.viewCount, 10) || 0;
                            finalDetails.currentTotalVideos = parseInt(apiChannelDetails.statistics?.videoCount, 10) || 0;
                            finalDetails.uploadsPlaylistId = apiChannelDetails.contentDetails?.relatedPlaylists?.uploads;
                        }
                    } catch (apiError) {
                        console.warn(`[Enrich] API error refreshing channel ${channelId}: ${apiError.message}`);
                        await this._handleYoutubeApiError(apiError, apiKey, `enrich (getChannelDetailsById for ${channelId})`);
                        // If API refresh fails, we stick with what we had (item data or DB data if loaded before api attempt)
                        // Ensure essential fields have some value if possible, from DB if not from item.
                        if (dbChannelData) {
                             finalDetails.name = finalDetails.name ?? dbChannelData[CH_COL_TITLE];
                             finalDetails.thumbnailUrl = finalDetails.thumbnailUrl ?? dbChannelData[CH_COL_THUMBNAIL_URL];
                             finalDetails.channelHandle = finalDetails.channelHandle ?? dbChannelData[CH_COL_HANDLE];
                        }
                    }
                } else {
                    console.warn(`[Enrich] No API key available for refreshing channel ${channelId}. Using potentially stale or item data.`);
                     if (dbChannelData) { // Fallback to DB if API key fails
                         finalDetails.name = finalDetails.name ?? dbChannelData[CH_COL_TITLE];
                         finalDetails.thumbnailUrl = finalDetails.thumbnailUrl ?? dbChannelData[CH_COL_THUMBNAIL_URL];
                         finalDetails.channelHandle = finalDetails.channelHandle ?? dbChannelData[CH_COL_HANDLE];
                         finalDetails.currentSubscriberCount = finalDetails.currentSubscriberCount ?? dbChannelData[CH_COL_SUBSCRIBER_COUNT];
                         finalDetails.currentTotalViews = finalDetails.currentTotalViews ?? dbChannelData[CH_COL_VIEW_COUNT];
                         finalDetails.currentTotalVideos = finalDetails.currentTotalVideos ?? dbChannelData[CH_COL_VIDEO_COUNT];
                         finalDetails.uploadsPlaylistId = finalDetails.uploadsPlaylistId ?? dbChannelData[CH_COL_UPLOADS_PLAYLIST_ID];
                    }
                }
            }
            
            return {
                ...item, // Original item data (importantly, period-specific data from ViewStats/YT fallback)
                ...finalDetails, // Overwrites/fills general channel info
                id: channelId, // Ensure id is always present and correct
            };
        }));
        return enrichedItems;
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

    async getChannelDetailsById(channelId, apiKeyProvided = null) {
        if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
            throw new Error('Channel ID must be a non-empty string.');
        }
        if (!apiKeyProvided) throw new Error('API key required for getChannelDetailsById');
        try {
            const channelDetailsResponse = await youtube.channels.list({
                part: 'snippet,statistics,contentDetails', // contentDetails for uploadsPlaylistId
                id: channelId,
                key: apiKeyProvided
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
