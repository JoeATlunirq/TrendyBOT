const { 
    // searchTrendingShorts, // We will replace this approach
    getVideoDetails, 
    getChannelDetails,
    getLatestVideosFromChannels // Import new function
} = require('./youtube.service');
const { 
    upsertChannel, 
    upsertVideo, // This function will need to handle VideoStatsHistory internally or we add a separate call
    getAllUserPreferences, // Assuming this fetches all necessary prefs including notification channels and templates
    saveTriggeredAlert,
    // We will need more NocoDB functions, e.g., for fetching video stats history
    // getLatestVideoStats, 
    // getVideoStatsHistoryForRelativePerformance 
} = require('./nocodb.service'); 

// TODO: Import notification service
// const { sendNotification } = require('./notification.service'); // Renamed for clarity

console.log('[polling.service] Loaded.');

/**
 * Parses ISO 8601 duration string (e.g., PT1M30S) into seconds.
 * Returns null if parsing fails.
 */
function parseISO8601Duration(durationString) {
    if (!durationString || typeof durationString !== 'string') {
        return null;
    }
    const regex = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/;
    const matches = durationString.match(regex);

    if (!matches) {
        return null;
    }

    const years = parseFloat(matches[1] || 0);
    const months = parseFloat(matches[2] || 0);
    const weeks = parseFloat(matches[3] || 0);
    const days = parseFloat(matches[4] || 0);
    const hours = parseFloat(matches[5] || 0);
    const minutes = parseFloat(matches[6] || 0);
    const seconds = parseFloat(matches[7] || 0);

    // Note: This is a simplification. It doesn't account for leap years or varying month lengths.
    // For Shorts duration check (typically < 61s), this is usually sufficient.
    let totalSeconds = seconds;
    totalSeconds += minutes * 60;
    totalSeconds += hours * 3600;
    totalSeconds += days * 86400;
    totalSeconds += weeks * 604800;
    totalSeconds += months * 2629800; // Approximation: Average month length
    totalSeconds += years * 31557600; // Approximation: Average year length

    return totalSeconds;
}

/**
 * Filters a list of YouTube video items (from API) to identify likely Shorts.
 */
function filterForShorts(videoItems = []) {
    return videoItems.filter(item => {
        const durationString = item.contentDetails?.duration;
        if (!durationString) return false; // Cannot determine duration
        
        const durationSeconds = parseISO8601Duration(durationString);
        // Consider videos <= 61 seconds as Shorts (allows for slight variations)
        return durationSeconds !== null && durationSeconds <= 61; 
    });
}

/**
 * Main function to poll YouTube, check against user preferences, and trigger alerts.
 * This function will be called by the scheduled job (e.g., Vercel Cron).
 */
const pollYouTubeAndCheckAlerts = async () => {
    console.log(`[pollYouTubeAndCheckAlerts] Starting polling cycle... ${new Date().toISOString()}`);

    try {
        // 1. Fetch all active users' alert preferences from NocoDB
        console.log('[pollYouTubeAndCheckAlerts] Fetching all user preferences...');
        const allUserPreferences = await getAllUserPreferences(); // Assumed to be comprehensive
        if (!allUserPreferences || allUserPreferences.length === 0) {
            console.log('[pollYouTubeAndCheckAlerts] No user preferences found. Skipping cycle.');
            return; 
        }
        console.log(`[pollYouTubeAndCheckAlerts] Processing preferences for ${allUserPreferences.length} users.`);

        // 2. Process each user's preferences
        for (const userPref of allUserPreferences) {
            console.log(`[pollYouTubeAndCheckAlerts] Processing user ${userPref.userId}`);
            if (!userPref.filterChannels || userPref.filterChannels.trim() === '') {
                console.log(`[pollYouTubeAndCheckAlerts] User ${userPref.userId} has no channels to track. Skipping.`);
                continue;
            }

            const trackedChannelIds = userPref.filterChannels.split(',').map(id => id.trim()).filter(id => id);
            if (trackedChannelIds.length === 0) {
                console.log(`[pollYouTubeAndCheckAlerts] User ${userPref.userId} has no valid channel IDs after parsing. Skipping.`);
                continue;
            }

            console.log(`[pollYouTubeAndCheckAlerts] User ${userPref.userId} tracking ${trackedChannelIds.length} channels.`);

            // 2a. Fetch latest videos for this user's tracked channels
            // Fetches basic video info (ID, snippet). Statistics need a separate call.
            // Defaulting to 5 latest videos per channel, adjust as needed.
            const videoStubs = await getLatestVideosFromChannels(trackedChannelIds, 5); 
            
            if (!videoStubs || videoStubs.length === 0) {
                console.log(`[pollYouTubeAndCheckAlerts] No videos found for channels tracked by user ${userPref.userId}.`);
                continue;
            }
            console.log(`[pollYouTubeAndCheckAlerts] User ${userPref.userId} - found ${videoStubs.length} video stubs from their channels.`);

            const videoIdsToFetchDetails = videoStubs.map(stub => stub.id);
            
            // 2b. Fetch full video details (including stats and contentDetails for duration)
            const videosWithDetails = await getVideoDetails(videoIdsToFetchDetails);

            // 2c. Filter these to identify actual Shorts
            const shortsFromUserChannels = filterForShorts(videosWithDetails);
            console.log(`[pollYouTubeAndCheckAlerts] User ${userPref.userId} - identified ${shortsFromUserChannels.length} Shorts from fetched videos.`);

            if (shortsFromUserChannels.length === 0) {
                console.log(`[pollYouTubeAndCheckAlerts] No relevant Shorts found for user ${userPref.userId} in this cycle.`);
                continue; 
            }
            
            // 2d. Upsert Channel and Video data in NocoDB
            // Upsert channel details for the tracked channels (idempotent)
            const uniqueChannelIdsFromShorts = [...new Set(shortsFromUserChannels.map(video => video.snippet?.channelId).filter(id => !!id))];
            if (uniqueChannelIdsFromShorts.length > 0) {
                try {
                    console.log(`[pollYouTubeAndCheckAlerts] Upserting ${uniqueChannelIdsFromShorts.length} channel details for user ${userPref.userId}.`);
                    const channelDetailsList = await getChannelDetails(uniqueChannelIdsFromShorts);
                    await Promise.all(channelDetailsList.map(channel => upsertChannel(channel))); // Assumes upsertChannel is ready
                    console.log(`[pollYouTubeAndCheckAlerts] Upserted ${channelDetailsList.length} channels for user ${userPref.userId}.`);
                } catch (channelError) {
                    console.error(`[pollYouTubeAndCheckAlerts] Error upserting channel details for user ${userPref.userId}:`, channelError);
                }
            }

            // Upsert video details (which also adds initial/current stats to VideoStatsHistory)
            console.log(`[pollYouTubeAndCheckAlerts] Upserting ${shortsFromUserChannels.length} video details for user ${userPref.userId}.`);
            // `upsertVideo` should now be designed to take raw YouTube API video object
            // and also update/create a VideoStatsHistory entry.
            await Promise.all(shortsFromUserChannels.map(video => upsertVideo(video, userPref.userId))); // Pass userId if needed by upsertVideo
            console.log(`[pollYouTubeAndCheckAlerts] Upserted ${shortsFromUserChannels.length} videos for user ${userPref.userId}.`);

            // 2e. Process each short for this user to check against their alert conditions
            for (const short of shortsFromUserChannels) {
                console.log(`[pollYouTubeAndCheckAlerts] Evaluating short ${short.id} (Title: ${short.snippet?.title}) for user ${userPref.userId}`);
                
                // --- ALERT CONDITION CHECKING LOGIC ---
                let conditionsMet = false;
                const currentStats = {
                    views: parseInt(short.statistics?.viewCount || '0', 10),
                    likes: parseInt(short.statistics?.likeCount || '0', 10),
                    comments: parseInt(short.statistics?.commentCount || '0', 10),
                    publishedAt: short.snippet?.publishedAt,
                };

                // TODO: Fetch necessary history for engagement velocity and relative performance
                // const videoStatsHistory = await nocodb.getVideoStatsHistory(short.id, userPref.someTimeWindow); 
                // const latestStatsFromHistory = await nocodb.getLatestVideoStats(short.id); // Might be part of upsertVideo's return or fetched separately

                // --- Basic Thresholds ---
                let viewsMet = (!userPref.thresholdViews || currentStats.views >= userPref.thresholdViews);
                let likesMet = (!userPref.thresholdLikes || currentStats.likes >= userPref.thresholdLikes);
                let commentsMet = (!userPref.thresholdComments || currentStats.comments >= userPref.thresholdComments);
                
                // Apply time window if specified (e.g. X views within Y hours of publishing)
                const publishedDate = new Date(currentStats.publishedAt);
                const now = new Date();
                const hoursSincePublished = (now - publishedDate) / (1000 * 60 * 60);

                if (userPref.thresholdViewsTimeWindowHours && hoursSincePublished > userPref.thresholdViewsTimeWindowHours) {
                    viewsMet = false; // Too old to qualify for this time-windowed threshold
                }
                if (userPref.thresholdLikesTimeWindowHours && hoursSincePublished > userPref.thresholdLikesTimeWindowHours) {
                    likesMet = false;
                }
                if (userPref.thresholdCommentsTimeWindowHours && hoursSincePublished > userPref.thresholdCommentsTimeWindowHours) {
                    commentsMet = false;
                }

                // --- Engagement Velocity (Views/Hour) ---
                // This needs historical data. For a simplified start, one might check if a video
                // gained X views in the last Y hours (if we poll frequently enough and store history).
                // Or, it's overall average VPH since publish if no specific window is given.
                let velocityMet = true; // Default to true if no threshold
                if (userPref.thresholdVelocity) {
                    // Placeholder: Complex calculation needed using VideoStatsHistory
                    // E.g., (currentViews - viewsAtStartOfWindow) / hoursInWindow
                    // For now, let's use a simplified overall VPH if video is recent enough
                    if (hoursSincePublished > 0 && hoursSincePublished < 72) { // Example: only for videos younger than 3 days
                         const currentVPH = currentStats.views / hoursSincePublished;
                         if (currentVPH < userPref.thresholdVelocity) {
                             velocityMet = false;
                         }
                    } else if (hoursSincePublished <= 0) { // just published, VPH is effectively infinite or undefined
                        velocityMet = true; // Or false, depending on interpretation for brand new videos
                    } else { // Older videos might not be checked for VPH or use a different logic
                        velocityMet = false; // Defaulting to false for older videos for this placeholder
                    }
                }

                // --- Relative Performance Threshold ---
                let relativePerformanceMet = true; // Default to true if no threshold
                if (userPref.thresholdRelativeViewPerformancePercent && userPref.thresholdRelativeViewMetric) {
                    // Placeholder: Requires fetching average stats for the channel or video type
                    // (e.g., userPref.thresholdRelativeViewMetric === '30d_avg_views')
                    // and then comparing currentStats.views against that baseline.
                    // const baselineViews = await nocodb.getChannelAverageViews(short.snippet.channelId, userPref.thresholdRelativeViewMetric);
                    // if (currentStats.views < (baselineViews * (userPref.thresholdRelativeViewPerformancePercent / 100))) {
                    // relativePerformanceMet = false;
                    // }
                    relativePerformanceMet = false; // Defaulting to false as an example until fully implemented
                }
                
                // Combine all conditions (assuming AND logic for all for now)
                conditionsMet = viewsMet && likesMet && commentsMet && velocityMet && relativePerformanceMet;

                if (conditionsMet) {
                    console.log(`[pollYouTubeAndCheckAlerts] ALERT TRIGGERED for user ${userPref.userId}, video ${short.id}!`);
                    
                    const notificationChannels = [];
                    if (userPref.emailVerified && userPref.notificationEmail) notificationChannels.push('email');
                    if (userPref.telegramVerified && userPref.notificationTelegramId) notificationChannels.push('telegram'); // Assuming field name from userPref
                    if (userPref.discordVerified && userPref.notificationDiscordWebhook) notificationChannels.push('discord'); // Assuming field name

                    if (notificationChannels.length > 0) {
                        // TODO: Construct detailed notification payload using user's templates
                        // const notificationPayload = {
                        //    videoTitle: short.snippet?.title,
                        //    views: currentStats.views,
                        //    likes: currentStats.likes,
                        //    comments: currentStats.comments,
                        //    channelName: short.snippet?.channelTitle,
                        //    timeAgo: /* Calculate time ago */,
                        //    videoUrl: `https://www.youtube.com/watch?v=${short.id}`
                        // };
                        // await sendNotification(userPref, notificationPayload, notificationChannels);
                        console.log(`[pollYouTubeAndCheckAlerts] Placeholder: Would send alert to user ${userPref.userId} via ${notificationChannels.join(', ')} for video ${short.id}`);
                    } else {
                        console.log(`[pollYouTubeAndCheckAlerts] Conditions met for user ${userPref.userId}, video ${short.id}, but no verified notification channels configured.`);
                    }
                    
                    // Log the triggered alert
                    await saveTriggeredAlert({ // saveTriggeredAlert needs to be implemented in nocodb.service
                        userId: userPref.userId,
                        videoId: short.id, // Ensure this is the NocoDB Video ID if different from YouTube ID
                        triggeredAt: new Date().toISOString(),
                        notificationChannel: notificationChannels.join(', ') || 'none',
                        status: notificationChannels.length > 0 ? 'sent_attempted' : 'no_channel',
                        // Store a snapshot of the stats that triggered the alert
                        triggeringStats: JSON.stringify({
                            views: currentStats.views,
                            likes: currentStats.likes,
                            comments: currentStats.comments,
                            // Include VPH or relative perf details if calculated
                        })
                    });
                } else {
                     console.log(`[pollYouTubeAndCheckAlerts] Conditions NOT met for user ${userPref.userId}, video ${short.id}`);
                }
            }
        }
        console.log(`[pollYouTubeAndCheckAlerts] Polling cycle completed. ${new Date().toISOString()}`);

    } catch (error) {
        console.error('[pollYouTubeAndCheckAlerts] CRITICAL Error during polling cycle:', error);
    }
};

module.exports = {
    pollYouTubeAndCheckAlerts,
}; 