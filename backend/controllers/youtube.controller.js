const axios = require('axios');
const asyncHandler = require('express-async-handler');
const YoutubeService = require('../services/youtube.service');
// const NocoDBService = require('../services/nocodb.service'); // Removed import
// const { NOCODB_CHANNELS_TABLE_ID, NOCODB_CHANNEL_ID_COLUMN, NOCODB_CHANNEL_THUMBNAIL_COLUMN, NOCODB_CHANNEL_NAME_COLUMN, NOCODB_CHANNEL_THUMBNAIL_LAST_UPDATED_COLUMN } = process.env; // Commented out NocoDB env vars

// const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const CHANNEL_PFP_STALE_DAYS = 7;

// Define callbacks for ApiKeyManager
const apiKeyManagerCallbacks = {
  onKeyUsed: (keyName, callsToday) => {
    console.log(`[ApiKeyManager][Controller][Event:KeyUsed] Name: ${keyName}, Calls Today: ${callsToday}`);
  },
  onKeyFailure: (keyName, keyValue) => {
    console.error(`[ApiKeyManager][Controller][Event:KeyFailure] Name: ${keyName}, Value: ${keyValue ? keyValue.substring(0,4) + '...' : 'N/A'}`);
    // Consider adding more sophisticated alerting for repeated failures or all keys failing.
  },
  onReset: (resetDate, clearedCount, remainingFailed) => {
    console.info(`[ApiKeyManager][Controller][Event:Reset] PT Date: ${resetDate}, Cleared: ${clearedCount}, Still Failed: ${remainingFailed}`);
  }
};

// apiKeyManager is now a promise that will resolve to the instance
const apiKeyManagerPromise = require('../services/apiKeyManager.service').getInstance(apiKeyManagerCallbacks);

/**
 * @desc    Lookup YouTube channel info by query (name, URL, ID)
 * @route   POST /api/youtube/lookup
 * @access  Private 
 */
const lookupChannel = asyncHandler(async (req, res) => {
    const { query } = req.body;
    // const nocodbChannelIdColumn = NOCODB_CHANNEL_ID_COLUMN || 'channel_id'; // Commented out
    // const nocodbThumbnailColumn = NOCODB_CHANNEL_THUMBNAIL_COLUMN || 'thumbnail_url'; // Commented out
    // const nocodbNameColumn = NOCODB_CHANNEL_NAME_COLUMN || 'name'; // Commented out
    // const nocodbThumbnailLastUpdatedColumn = NOCODB_CHANNEL_THUMBNAIL_LAST_UPDATED_COLUMN || 'thumbnail_last_updated'; // Commented out

    if (!query || query.trim() === '') {
        return res.status(400).json({ message: 'Missing channel query' });
    }

    let potentialChannelIdFromQuery = null;
    // Basic check if the query might be a YouTube Channel ID
    if ((query.startsWith('UC') && query.length > 20) || query.length === 24) { // Common YT Channel ID patterns
        potentialChannelIdFromQuery = query;
    }

    // 1. Check Supabase cache first if we have a potential Channel ID
    if (potentialChannelIdFromQuery) {
        try {
            const existingChannels = await YoutubeService.getChannelsFromSupabase([potentialChannelIdFromQuery]);
            if (existingChannels && existingChannels.length > 0) {
                const cachedChannel = existingChannels[0];
                const lastFetchedStr = cachedChannel[YoutubeService.CH_COL_LAST_FETCHED_AT]; // Use exported const if available, or define locally
                let isStale = true;
                if (lastFetchedStr) {
                    const lastFetchedDate = new Date(lastFetchedStr);
                    const diffTime = Math.abs(new Date().getTime() - lastFetchedDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays <= CHANNEL_PFP_STALE_DAYS) {
                        isStale = false;
                    }
                }

                if (!isStale && cachedChannel[YoutubeService.CH_COL_THUMBNAIL_URL]) {
                    console.log(`[Cache Hit] Found fresh data for channel ${potentialChannelIdFromQuery} in Supabase.`);
                    return res.status(200).json({
                        id: cachedChannel[YoutubeService.CH_COL_CHANNEL_ID],
                        title: cachedChannel[YoutubeService.CH_COL_TITLE],
                        thumbnailUrl: cachedChannel[YoutubeService.CH_COL_THUMBNAIL_URL],
                        // subscriberCount: cachedChannel[YoutubeService.CH_COL_SUBSCRIBER_COUNT], // Optional: add if needed by frontend
                        source: 'cache'
                    });
                } else {
                    console.log(`[Cache Stale or Incomplete] Data for channel ${potentialChannelIdFromQuery} is stale or thumbnail missing.`);
                }
            }
        } catch (dbError) {
            console.error(`[Cache Check Error] Error checking Supabase for channel ${potentialChannelIdFromQuery}:`, dbError.message);
            // Do not stop execution; proceed to API lookup
        }
    }

    const manager = await apiKeyManagerPromise;
    const currentApiKey = await manager.getKey();
    if (!currentApiKey) {
        console.error('All YouTube API Keys are currently unavailable or exhausted.');
        return res.status(503).json({ message: 'Server is temporarily unable to process YouTube requests. Please try again later.' });
    }
    // console.log(`Using API Key: ${currentApiKey ? currentApiKey.substring(0, 4) + '...' : 'N/A'}`);

    try {
        let channelIdToQueryApi = potentialChannelIdFromQuery;

        if (!channelIdToQueryApi) {
            console.log(`Searching YouTube channels for query: "${query}" using an API key.`);
            channelIdToQueryApi = await YoutubeService.searchChannelIdByQuery(query, currentApiKey);
            if (channelIdToQueryApi) {
                console.log(`Found potential channel ID from search: ${channelIdToQueryApi}`);
            } else {
                console.log(`YouTube Search API did not find a channel for query: ${query}.`);
            }
        }
        
        if (!channelIdToQueryApi) {
             console.error('Could not determine channelId from query or search result:', query);
             return res.status(404).json({ message: 'Channel not found. Could not identify a YouTube channel from the provided query.' });
        }

        console.log(`Fetching details for YouTube channel ID: ${channelIdToQueryApi} using an API key.`);
        // getChannelDetailsById returns the full channel item from YouTube API
        const channelDataFromApi = await YoutubeService.getChannelDetailsById(channelIdToQueryApi, currentApiKey);
                 
         if (!channelDataFromApi) {
             console.error(`YouTube Channels API did not find details for channel ID: ${channelIdToQueryApi} (Original query was: ${query})`);
             // It's possible the key failed here, _handleYoutubeApiError might be called by the service if it throws an API-specific error
             return res.status(404).json({ message: 'Channel not found by ID. The channel may be invalid, private, or terminated.' });
         }
         
         // Save/Update in Supabase (this function handles mapping from API to DB schema)
         await YoutubeService.upsertSupabaseChannelRecord(channelDataFromApi);

         // Prepare response from API data
         const snippet = channelDataFromApi.snippet || {};
         const statistics = channelDataFromApi.statistics || {};
         const parsedChannelData = {
             id: channelDataFromApi.id,
             title: snippet.title || 'Unknown Title',
             thumbnailUrl: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || null,
             subscriberCount: statistics.hiddenSubscriberCount ? undefined : parseInt(statistics.subscriberCount, 10),
             source: 'api'
         };

        console.log('Successfully fetched channel details from API and updated cache:', parsedChannelData);
        res.status(200).json(parsedChannelData);

    } catch (error) {
        // Use the service's error handler for YouTube API specific errors
        // For other errors (e.g., API key exhaustion before this try block), they are handled above.
        // If the service methods (searchChannelIdByQuery, getChannelDetailsById) throw, they might already be API errors.
        // We want to ensure _handleYoutubeApiError is called if it's a YouTube key/quota issue.
        
        let message = error.message;
        let status = error.statusCode || 500; // error.statusCode might be set by _handleYoutubeApiError
        let reportKeyFailureForThisError = false;

        // Check if it's a known API error structure that _handleYoutubeApiError would recognize
        const apiError = error.response?.data?.error; 
        if (apiError?.errors?.length > 0) {
            const reason = apiError.errors[0]?.reason;
            if (reason === 'keyInvalid' || reason?.includes('disabled') || reason === 'accessNotConfigured' || reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
                reportKeyFailureForThisError = true;
            }
        } else if (error.message.includes('API key required')) { // Error from our new service methods
            status = 503;
            message = 'Server configuration issue with API keys.';
        } else if (status === 403 || status === 429) { // General status codes that imply key issues
             reportKeyFailureForThisError = true;
        }

        if (reportKeyFailureForThisError && currentApiKey) {
            try {
                 // Encapsulate the reporting logic as in the original _handleYoutubeApiError
                const tempManager = await apiKeyManagerPromise;
                await tempManager.reportKeyFailure(currentApiKey);
                console.warn(`[Controller Lookup] Reported failure for API key due to ${message}`);
                if (status !== 429 && status !== 403) status = 503; // If we reported, likely a service issue
                if (message.toLocaleLowerCase().includes('quota')) status = 429;
            } catch (reportError) {
                console.error('[Controller Lookup] Error reporting key failure:', reportError);
            }
        }
        
        console.error(`[Controller Lookup] Responding with status ${status}: ${message}. Original error:`, error.message);
        res.status(status).json({ message: message });
    }
});

// @desc    Get aggregated channel data for a list of channel IDs
// @route   POST /api/youtube/channel-data
// @access  Private
const getChannelData = asyncHandler(async (req, res) => {
    const { channelIds, forceRefresh, timeFrame } = req.body;

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
        res.status(400);
        throw new Error('Please provide a valid array of channelIds');
    }

    // Validate timeFrame if provided
    const validTimeFrames = ["last_24_hours", "last_7_days", "last_30_days", "all_time"];
    if (timeFrame && !validTimeFrames.includes(timeFrame)) {
        res.status(400);
        throw new Error(`Invalid timeFrame. Must be one of: ${validTimeFrames.join(', ')}`);
    }

    try {
        // Pass forceRefresh and timeFrame to the service method
        const data = await YoutubeService.getAggregatedChannelData(channelIds, forceRefresh, timeFrame);
        
        if (!data || data.length === 0 && channelIds.length > 0) {
            // This case means service ran but found nothing, perhaps IDs were invalid or no data in NocoDB
            // The service itself logs warnings for individual channel misses.
            // Consider if a 404 is appropriate if ALL channels yield no data.
            // For now, returning 200 with empty array or array of errors from service.
        }
        
        res.status(200).json(data); // Send the actual data back

    } catch (error) {
        // Catch errors thrown by the service (e.g., NocoDB connection issues, config errors)
        console.error('[youtube.controller] Error calling YoutubeService.getAggregatedChannelData:', error.message);
        res.status(500).json({ message: error.message || 'Failed to process channel data' });
    }
});

const getVideosForChannels = async (req, res, next) => {
    try {
        const { 
            channelIds, 
            // sinceDate, // Deprecated by uploadDateFilter
            limit, 
            // offset, // Deprecated by page
            page: pageQuery, // Renamed to avoid conflict with calculated page
            sortBy, 
            uploadDateFilter, 
            customDateStart, 
            customDateEnd, 
            durationMin, 
            durationMax, 
            viewsMin, 
            viewsMax, 
            likesMin, 
            commentsMin, 
            engagementRateMinVideo 
        } = req.query;

        if (!channelIds) {
            return res.status(400).json({ message: 'channelIds query parameter is required.' });
        }
        const parsedChannelIds = channelIds.split(',').map(id => id.trim()).filter(id => id);
        if (parsedChannelIds.length === 0) {
            return res.status(400).json({ message: 'At least one valid channelId must be provided.' });
        }

        const parsedLimit = limit ? parseInt(limit, 10) : 24; // Default to 24 as in frontend
        const currentPage = pageQuery ? parseInt(pageQuery, 10) : 1; // Default to page 1
        
        // Pass all filters to the service method
        const videoData = await YoutubeService.getVideosForChannelIdsFromSupabase(
            parsedChannelIds, 
            parsedLimit, 
            currentPage,
            sortBy,
            uploadDateFilter,
            customDateStart,
            customDateEnd,
            durationMin,
            durationMax,
            viewsMin,
            viewsMax,
            likesMin,
            commentsMin,
            engagementRateMinVideo
            // sinceDate // Deprecated, so not passed
        );
        
        res.status(200).json(videoData);

    } catch (error) {
        console.error('[youtube.controller] Error in getVideosForChannels:', error.message);
        next(error); 
    }
};

module.exports = {
    getChannelData,
    getVideosForChannels,
    lookupChannel,
}; 