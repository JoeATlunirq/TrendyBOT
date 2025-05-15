const { supabase, isSupabaseReady } = require('./supabase.service'); // Supabase client
const YoutubeService = require('./youtube.service.js'); // Ensure .js extension if it matters for your env
const NotificationService = require('./NotificationService'); // We will create this later

// NocoDB Table ID environment variables are no longer needed
// const { 
//     NOCODB_USERS_TABLE_ID, 
//     NOCODB_TRIGGERED_ALERTS_TABLE_ID, 
//     NOCODB_VIDEO_STATS_HISTORY_TABLE_ID 
// } = process.env;

// Supabase table names (direct strings)
const SUPABASE_USERS_TABLE = 'Users';
const SUPABASE_TRIGGERED_ALERTS_TABLE = 'TriggeredAlerts';
const SUPABASE_VIDEO_STATS_HISTORY_TABLE = 'VideoStatsHistory';

// Column names from the Users table (ensure these match your Supabase schema)
const USER_COL_ID = 'id'; // Standard Supabase primary key for Users
const USER_COL_NAMES = 'Names'; // Or your equivalent if different
const USER_COL_FILTER_CHANNELS = 'filter_channels'; // JSON of ChannelGroup[] in Users table
const USER_COL_ALERTS_GLOBALLY_ENABLED = 'alerts_globally_enabled'; // Hypothetical: User's master alert switch in Users table
const USER_COL_VIDEOS_PUBLISHED_HOURS_FILTER = 'videos_published_within_hours_filter'; // Exact column name from Users table
// User notification preference columns (ensure these match your Supabase schema)
const USER_COL_ALERT_TEMPLATE_DISCORD = 'alert_template_discord';
const USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT = 'alert_template_email_subject';
const USER_COL_ALERT_TEMPLATE_EMAIL_PREVIEW = 'alert_template_email_preview';
const USER_COL_ALERT_TEMPLATE_TELEGRAM = 'alert_template_telegram';
const USER_COL_EMAIL_VERIFIED = 'email_verified';
const USER_COL_NOTIFICATION_EMAIL = 'notification_email';
const USER_COL_DISCORD_VERIFIED = 'discord_verified';
const USER_COL_DISCORD_USER_ID = 'DISCORD_USER_ID'; // Exact match from your .env mapping
const USER_COL_TELEGRAM_VERIFIED = 'telegram_verified';
const USER_COL_TELEGRAM_CHAT_ID = 'TELEGRAM_CHAT_ID'; // Exact match from your .env mapping

// TriggeredAlerts table columns (TA_...)
const TA_COL_USER_ID = 'user_id'; 
const TA_COL_VIDEO_ID = 'video_id';
const TA_COL_TRIGGERED_AT = 'triggered_at';
const TA_COL_STATUS = 'status';
const TA_COL_VIDEO_TITLE = 'video_title';
const TA_COL_CHANNEL_ID = 'channel_id';
const TA_COL_CHANNEL_NAME = 'channel_name';
const TA_COL_THUMBNAIL_URL = 'thumbnail_url';
const TA_COL_GROUP_ID = 'group_id';
const TA_COL_GROUP_NAME = 'group_name';
const TA_COL_PARAMETERS_MATCHED = 'parameters_matched';
const TA_COL_VIEWS_AT_TRIGGER = 'views_at_trigger';
const TA_COL_LIKES_AT_TRIGGER = 'likes_at_trigger';
const TA_COL_COMMENTS_AT_TRIGGER = 'comments_at_trigger';
const TA_COL_PUBLISHED_AT = 'published_at';

// VideoStatsHistory table columns (VSH_...)
const VSH_COL_VIDEO_ID = 'video_id';
const VSH_COL_CHECKED_AT = 'checked_at';
const VSH_COL_VIEW_COUNT = 'view_count';
const VSH_COL_LIKE_COUNT = 'like_count';
const VSH_COL_COMMENT_COUNT = 'comment_count';

class TrendDetectionService {
    /**
     * Checks if a video meets the criteria defined in a channel group.
     * @param {object} video - YouTube video object.
     *   Expected to have video.id, video.snippet.publishedAt, video.statistics
     * @param {object} groupParams - Parameters from the user's channel group.
     *   Example: { min_views: 1000, min_likes: 100, keywords: ["urgent", "breaking"], like_view_ratio: 0.04 }
     * @param {Date} publishedAfterDate - Videos must be published after this date.
     * @returns {object|boolean} - Matched parameters object if criteria met, false otherwise.
     */
    static _doesVideoMeetCriteria(video, groupParams, publishedAfterDate) {
        if (!video || !video.snippet || !video.statistics || !video.id) {
            // console.warn('[TrendDetectionService] Video object is malformed or missing essential parts:', video);
            return false;
        }

        const videoPublishedDate = new Date(video.snippet.publishedAt);
        if (videoPublishedDate <= publishedAfterDate) {
            // console.log(`[TrendDetectionService] Video ${video.id} (${video.snippet.title}) skipped, published ${videoPublishedDate} (too old, needed after ${publishedAfterDate})`);
            return false;
        }

        const views = parseInt(video.statistics.viewCount, 10) || 0;
        const likes = parseInt(video.statistics.likeCount, 10) || 0;
        const comments = parseInt(video.statistics.commentCount, 10) || 0;
        // const title = video.snippet.title.toLowerCase();
        // const description = video.snippet.description.toLowerCase();

        const matchedParams = {};
        let criteriaMet = true; // Assume true, set to false if any check fails

        // Example checks - expand this based on actual groupParams structure
        if (groupParams.min_views !== undefined && views < groupParams.min_views) {
            criteriaMet = false;
        } else if (groupParams.min_views !== undefined) {
            matchedParams.min_views = `Met (${views} >= ${groupParams.min_views})`;
        }

        if (groupParams.min_likes !== undefined && likes < groupParams.min_likes) {
            criteriaMet = false;
        } else if (groupParams.min_likes !== undefined) {
            matchedParams.min_likes = `Met (${likes} >= ${groupParams.min_likes})`;
        }
        
        if (groupParams.min_comments !== undefined && comments < groupParams.min_comments) {
            criteriaMet = false;
        } else if (groupParams.min_comments !== undefined) {
            matchedParams.min_comments = `Met (${comments} >= ${groupParams.min_comments})`;
        }

        if (groupParams.like_view_ratio !== undefined && views > 0) { // Avoid division by zero
            const ratio = likes / views;
            if (ratio < groupParams.like_view_ratio) {
                criteriaMet = false;
            } else {
                matchedParams.like_view_ratio = `Met (${ratio.toFixed(3)} >= ${groupParams.like_view_ratio})`;
            }
        } else if (groupParams.like_view_ratio !== undefined && views === 0) { // If ratio required but no views, it can't be met.
             criteriaMet = false;
        }


        // TODO: Implement keyword matching for title/description if groupParams.keywords exists
        // if (groupParams.keywords && Array.isArray(groupParams.keywords)) {
        //     let keywordMatch = false;
        //     for (const keyword of groupParams.keywords) {
        //         if (title.includes(keyword.toLowerCase()) || description.includes(keyword.toLowerCase())) {
        //             keywordMatch = true;
        //             matchedParams.keyword = `Met (found '${keyword}')`;
        //             break;
        //         }
        //     }
        //     if (!keywordMatch) criteriaMet = false;
        // }
        
        // Add more parameter checks as defined in your ChannelGroup structure
        // e.g., duration, specific tags, etc.

        return criteriaMet ? matchedParams : false;
    }

    /**
     * Main function to be called by the scheduler.
     * Iterates through users, checks their preferences, fetches video data,
     * evaluates against thresholds, and triggers alerts/notifications.
     */
    static async checkForTrendsAndAlertUsers() {
        console.log('[TrendDetectionService] Starting trend check for all users...');
        
        if (!isSupabaseReady()) {
            console.error('[TrendDetectionService] Supabase client is not ready. Aborting trend check.');
            return;
        }

        try {
            // Construct the select string for all necessary user fields
            const userSelectFields = [
                USER_COL_ID,
                USER_COL_NAMES,
                USER_COL_FILTER_CHANNELS,
                USER_COL_ALERTS_GLOBALLY_ENABLED,
                USER_COL_VIDEOS_PUBLISHED_HOURS_FILTER,
                USER_COL_ALERT_TEMPLATE_DISCORD,
                USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT,
                USER_COL_ALERT_TEMPLATE_EMAIL_PREVIEW,
                USER_COL_ALERT_TEMPLATE_TELEGRAM,
                USER_COL_EMAIL_VERIFIED,
                USER_COL_NOTIFICATION_EMAIL,
                USER_COL_DISCORD_VERIFIED,
                USER_COL_DISCORD_USER_ID,
                USER_COL_TELEGRAM_VERIFIED,
                USER_COL_TELEGRAM_CHAT_ID
            ].join(',');

            const { data: users, error: fetchUsersError } = await supabase
                .from(SUPABASE_USERS_TABLE)
                .select(userSelectFields)
                .eq(USER_COL_ALERTS_GLOBALLY_ENABLED, true)
                .not(USER_COL_FILTER_CHANNELS, 'is', null); // Check for non-null filter_channels

            if (fetchUsersError) {
                console.error('[TrendDetectionService] Error fetching users from Supabase:', fetchUsersError);
                return;
            }

            if (!users || users.length === 0) {
                console.log('[TrendDetectionService] No users found with alerts enabled and channel filters configured.');
                return;
            }

            console.log(`[TrendDetectionService] Found ${users.length} user(s) to process for trends.`);

            for (const user of users) {
                // console.log(`[TrendDetectionService] Processing user: ${user.Names} (ID: ${user.id})`);
                if (!user[USER_COL_FILTER_CHANNELS]) continue;

                let channelGroups;
                try {
                    channelGroups = JSON.parse(user[USER_COL_FILTER_CHANNELS]);
                } catch (e) {
                    console.error(`[TrendDetectionService] Failed to parse filter_channels for user ${user.id}:`, e.message);
                    continue;
                }

                if (!Array.isArray(channelGroups) || channelGroups.length === 0) {
                    // console.log(`[TrendDetectionService] No channel groups for user ${user.id}`);
                    continue;
                }
                
                const hoursFilter = user[USER_COL_VIDEOS_PUBLISHED_HOURS_FILTER] || 24; // Default to 24 hours if not set
                const publishedAfterDate = new Date(Date.now() - hoursFilter * 60 * 60 * 1000);
                // console.log(`[TrendDetectionService] User ${user.id} - Videos published after: ${publishedAfterDate.toISOString()}`);


                for (const group of channelGroups) {
                    if (!group.channels || group.channels.length === 0 || !group.params) {
                        // console.log(`[TrendDetectionService] Skipping group ${group.name} for user ${user.id} due to missing channels or params.`);
                        continue;
                    }
                    // console.log(`[TrendDetectionService] Processing group: ${group.name} for user ${user.id}`);

                    for (const channelId of group.channels) {
                        try {
                            // console.log(`[TrendDetectionService] Fetching recent videos for channel ${channelId} (User: ${user.id}, Group: ${group.name})`);
                            const recentVideos = await YoutubeService.getRecentVideosForChannel(channelId, publishedAfterDate, 25); // Fetch up to 25 recent videos

                            if (!recentVideos || recentVideos.length === 0) {
                                // console.log(`[TrendDetectionService] No recent videos found for channel ${channelId} after ${publishedAfterDate.toISOString()}`);
                                continue;
                            }
                            // console.log(`[TrendDetectionService] Channel ${channelId} has ${recentVideos.length} recent videos.`);

                            for (const video of recentVideos) {
                                if (!video || !video.id) {
                                    // console.warn('[TrendDetectionService] Encountered an invalid video object:', video);
                                    continue;
                                }
                                const matchedCriteria = this._doesVideoMeetCriteria(video, group.params, publishedAfterDate);

                                if (matchedCriteria && Object.keys(matchedCriteria).length > 0) {
                                    console.log(`[TrendDetectionService] TREND DETECTED for User ${user.id}! Video: ${video.snippet.title} (ID: ${video.id}) from Group: ${group.name}`);

                                    // 1. Create TriggeredAlert record
                                    const alertData = {
                                        [TA_COL_USER_ID]: user.id,
                                        [TA_COL_VIDEO_ID]: video.id,
                                        [TA_COL_VIDEO_TITLE]: video.snippet.title,
                                        [TA_COL_CHANNEL_ID]: video.snippet.channelId,
                                        [TA_COL_CHANNEL_NAME]: video.snippet.channelTitle,
                                        [TA_COL_THUMBNAIL_URL]: video.snippet.thumbnails?.default?.url,
                                        [TA_COL_GROUP_ID]: group.id || null,
                                        [TA_COL_GROUP_NAME]: group.name,
                                        [TA_COL_PARAMETERS_MATCHED]: JSON.stringify(matchedCriteria),
                                        [TA_COL_VIEWS_AT_TRIGGER]: parseInt(video.statistics.viewCount, 10) || 0,
                                        [TA_COL_LIKES_AT_TRIGGER]: parseInt(video.statistics.likeCount, 10) || 0,
                                        [TA_COL_COMMENTS_AT_TRIGGER]: parseInt(video.statistics.commentCount, 10) || 0,
                                        [TA_COL_PUBLISHED_AT]: video.snippet.publishedAt,
                                        [TA_COL_STATUS]: 'PENDING_NOTIFICATION',
                                        [TA_COL_TRIGGERED_AT]: new Date().toISOString()
                                    };

                                    const { data: triggeredAlertRecord, error: insertAlertError } = await supabase
                                        .from(SUPABASE_TRIGGERED_ALERTS_TABLE)
                                        .insert(alertData)
                                        .select()
                                        .single();

                                    if (insertAlertError || !triggeredAlertRecord) {
                                        console.error(`[TrendDetectionService] Error inserting TriggeredAlert for video ${video.id}, user ${user.id}:`, insertAlertError?.message || 'No record returned');
                                        continue; // Skip to next video if alert creation fails
                                    }
                                    
                                    console.log(`[TrendDetectionService] Created TriggeredAlert record ID: ${triggeredAlertRecord.id}`);
                                    
                                    // 2. Create VideoStatsHistory record
                                    const historyData = {
                                        [VSH_COL_VIDEO_ID]: video.id,
                                        [VSH_COL_CHECKED_AT]: new Date().toISOString(),
                                        [VSH_COL_VIEW_COUNT]: parseInt(video.statistics.viewCount, 10) || 0,
                                        [VSH_COL_LIKE_COUNT]: parseInt(video.statistics.likeCount, 10) || 0,
                                        [VSH_COL_COMMENT_COUNT]: parseInt(video.statistics.commentCount, 10) || 0
                                    };
                                    
                                    const { data: videoStatsRecord, error: insertHistoryError } = await supabase
                                        .from(SUPABASE_VIDEO_STATS_HISTORY_TABLE)
                                        .insert(historyData)
                                        .select('id') // Only select 'id' or a minimal set if the full record isn't needed
                                        .single();

                                    if (insertHistoryError) {
                                        console.error(`[TrendDetectionService] Failed to create VideoStatsHistory record for video ${video.id}:`, insertHistoryError.message);
                                        // Not continuing here, as the alert was created and notification should still be attempted
                                    } else if (videoStatsRecord) {
                                        console.log(`[TrendDetectionService] Created VideoStatsHistory record for video ${video.id} (ID: ${videoStatsRecord.id}).`);
                                    } else {
                                        console.warn(`[TrendDetectionService] VideoStatsHistory record for video ${video.id} was inserted but no data returned (or insert failed silently).`);
                                    }


                                    // 3. Send Notification (pass the full user object for templates and contact info)
                                    await NotificationService.sendTrendAlert(user, triggeredAlertRecord, video, group);
                                }
                            }
                        } catch (channelError) {
                            console.error(`[TrendDetectionService] Error processing channel ${channelId} for user ${user.id}:`, channelError.message, channelError.stack);
                        }
                    }
                }
            }
            console.log('[TrendDetectionService] Finished trend check for all users.');
        } catch (error) {
            console.error('[TrendDetectionService] Critical error during trend check:', error.message, error.stack);
        }
    }
}

module.exports = TrendDetectionService; 