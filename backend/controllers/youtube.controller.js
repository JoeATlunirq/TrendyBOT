const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * @desc    Lookup YouTube channel info by query (name, URL, ID)
 * @route   POST /api/youtube/lookup
 * @access  Private 
 */
const lookupChannel = async (req, res, next) => {
    const { query } = req.body;

    if (!query || query.trim() === '') {
        return res.status(400).json({ message: 'Missing channel query' });
    }

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'PLACEHOLDER_DO_NOT_COMMIT_REAL_KEY' || YOUTUBE_API_KEY.length < 10) {
        console.error('YouTube API Key is missing, placeholder, or too short in .env');
        return res.status(500).json({ message: 'Server configuration error: YouTube API Key not set.' });
    }

    try {
        let channelId = null;

        // --- Step 1: Search for the channel to potentially get its ID ---
        // This handles cases where the user enters a channel name or URL
        console.log(`Searching YouTube channels for query: "${query}"`);
        const searchResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: query,
                type: 'channel',
                maxResults: 1, // Get the most likely match
                key: YOUTUBE_API_KEY
            }
        });

        if (searchResponse.data.items && searchResponse.data.items.length > 0) {
            channelId = searchResponse.data.items[0].id?.channelId;
            console.log(`Found potential channel ID from search: ${channelId}`);
        } else {
            console.log(`YouTube Search API did not find a channel for query: ${query}. Assuming query might be a direct Channel ID.`);
            // If search doesn't find it, maybe the query *was* the channel ID
            channelId = query; 
        }
        
        if (!channelId) {
             // Should be unlikely to reach here now, but added as safeguard
             console.error('Could not determine channelId from query or search result:', query);
             return res.status(404).json({ message: 'Could not identify a channel from the provided query.' });
        }

        // --- Step 2: Get channel details using the determined ID ---
        console.log(`Fetching details for YouTube channel ID: ${channelId}`);
        const channelDetailsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/channels`, {
             params: {
                 part: 'snippet,statistics', // Get title, description, thumbnails, and subscriber count
                 id: channelId, 
                 key: YOUTUBE_API_KEY
             }
         });
         
         // Check if the channels.list call found the specific ID
         if (!channelDetailsResponse.data.items || channelDetailsResponse.data.items.length === 0) {
             console.error(`YouTube Channels API did not find details for channel ID: ${channelId} (Query was: ${query})`);
             // Provide a more specific error if search found an ID but details failed
             if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                  return res.status(404).json({ message: 'Channel found via search, but failed to get details. Check if the ID is correct or channel is accessible.' });
             } else {
                  return res.status(404).json({ message: 'Channel not found. Please check the name, URL, or ID.' });
             }
         }
         
         // --- Step 3: Parse the response --- 
         const channelData = channelDetailsResponse.data.items[0];
         const snippet = channelData.snippet || {};
         const statistics = channelData.statistics || {};

         const parsedChannelData = {
             id: channelData.id, // Use the actual channel ID from the details response
             title: snippet.title || 'Unknown Title',
             thumbnailUrl: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || 'https://via.placeholder.com/48?text=?', // Prefer default, fallback to medium
             // Subscriber count might be hidden by the channel owner
             subscriberCount: statistics.hiddenSubscriberCount ? undefined : parseInt(statistics.subscriberCount, 10),
         };

        // --- Step 4: Send the actual parsed data back --- 
        console.log('Successfully fetched channel details:', parsedChannelData);
        res.status(200).json(parsedChannelData);

    } catch (error) {
        console.error('YouTube API lookup process error:', error.response?.data?.error || error.message);
        const apiError = error.response?.data?.error;
        let message = apiError?.message || 'Failed to fetch channel info from YouTube.';
        // Use status from API error if available, map common Google API errors
        let status = error.response?.status || 500;
        
        // Check for common API key / quota issues
        if (apiError?.errors?.length > 0) {
             const reason = apiError.errors[0]?.reason;
             if (reason === 'keyInvalid') {
                 message = 'Invalid YouTube API Key configured on server.';
                 status = 500; // Internal server config error
             } else if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
                 message = 'YouTube API quota exceeded. Please try again later.';
                 status = 429; // Too Many Requests
             } else if (reason?.includes('disabled')) { // e.g., youtubeSignupRequired, dataApiDisabled
                 message = 'YouTube Data API access might be disabled for this key.';
                 status = 403; // Forbidden
             }
        }
        
        console.error(`Responding with status ${status}: ${message}`);
        res.status(status).json({ message: message }); // Avoid sending detailed error structure unless needed
    }
};

module.exports = {
    lookupChannel,
}; 