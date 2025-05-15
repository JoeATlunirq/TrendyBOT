const { supabase, isSupabaseReady } = require('../services/supabase.service');
const EmailService = require('./email.service');
const DiscordService = require('./discord.service');
const axios = require('axios'); // For Telegram API call

// const { NOCODB_TRIGGERED_ALERTS_TABLE_ID, TELEGRAM_BOT_TOKEN } = process.env; // NOCODB var removed
const { TELEGRAM_BOT_TOKEN } = process.env; // Keep TELEGRAM_BOT_TOKEN

const TRIGGERED_ALERTS_TABLE = 'TriggeredAlerts';

// TriggeredAlerts table columns (ensure these match your Supabase schema)
const TA_COL_STATUS = 'status';
const TA_COL_NOTIFICATION_LOG = 'notification_log'; // Expects JSONB or JSON type in Supabase
const TA_COL_ID = 'id'; // Primary key column for TriggeredAlerts in Supabase

class NotificationService {

    /**
     * Formats a message template with video, group, and user data.
     * @param {string} template - The message template with placeholders.
     * @param {object} video - YouTube video object.
     * @param {object} group - Channel group object.
     * @param {object} user - User object.
     * @returns {string} - The formatted message.
     */
    static _formatMessage(template, video, group, user) {
        if (!template) return 'Trend Alert: Video data missing.'; // Fallback

        const videoTitle = video?.snippet?.title || 'N/A';
        const channelName = video?.snippet?.channelTitle || group?.name || 'N/A'; // Fallback to group name
        const views = video?.statistics?.viewCount || '0';
        const likes = video?.statistics?.likeCount || '0';
        const comments = video?.statistics?.commentCount || '0';
        const videoUrl = video?.id ? `https://www.youtube.com/watch?v=${video.id}` : '#';
        
        // Calculate time_ago (simple version)
        let timeAgo = 'recently';
        if (video?.snippet?.publishedAt) {
            const publishedDate = new Date(video.snippet.publishedAt);
            const now = new Date();
            const diffMs = now.getTime() - publishedDate.getTime();
            const diffMins = Math.round(diffMs / 60000);
            if (diffMins < 60) timeAgo = `${diffMins}m ago`;
            else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins/60)}h ago`;
            else timeAgo = `${Math.floor(diffMins/1440)}d ago`;
        }

        return template
            .replace(/{video_title}/g, videoTitle)
            .replace(/{channel_name}/g, channelName)
            .replace(/{views}/g, views)
            .replace(/{likes}/g, likes)
            .replace(/{comments}/g, comments)
            .replace(/{video_url}/g, videoUrl)
            .replace(/{time_ago}/g, timeAgo)
            .replace(/{group_name}/g, group?.name || 'N/A')
            .replace(/{user_name}/g, user?.Names || 'User'); // Confirmed 'Names' is the column for user's name
    }

    /**
     * Sends trend alert notifications to the user via their configured and verified channels.
     * @param {object} user - The full user object from NocoDB (contains contact details and templates).
     * @param {object} alertRecord - The created record from TriggeredAlerts table (contains Id).
     * @param {object} video - The YouTube video object that triggered the alert.
     * @param {object} group - The channel group configuration that was met.
     */
    static async sendTrendAlert(user, alertRecord, video, group) {
        if (!user || !alertRecord || !video || !group) {
            console.error('[NotificationService] Missing required parameters for sendTrendAlert.');
            return;
        }

        const notificationLog = [];
        let overallStatus = 'PENDING_NOTIFICATION'; // Initial status
        const sentTo = [];

        // --- Email Notification --- 
        if (user.email_verified && user.notification_email) {
            const subjectTemplate = user.alert_template_email_subject || '🔥 Trending Video Alert: {video_title}';
            const previewTemplate = user.alert_template_email_preview || 'Video \'{video_title}\' is trending!';
            // Basic HTML body - ideally, you'd have a more robust HTML template system
            const bodyHtmlTemplate = `
                <h1>🔥 Video Trend Alert!</h1>
                <p>Hi ${user.Names || 'there'},</p>
                <p>The video <strong>{video_title}</strong> by <em>{channel_name}</em> (from your group '${group.name}') is currently trending!</p>
                <ul>
                    <li><strong>Views:</strong> {views}</li>
                    <li><strong>Likes:</strong> {likes}</li>
                    <li><strong>Comments:</strong> {comments}</li>
                    <li><strong>Published:</strong> {time_ago}</li>
                </ul>
                <p><a href="{video_url}">Watch on YouTube</a></p>
                <p>Thanks,<br/>Trendy Bot</p>
            `;

            const subject = this._formatMessage(subjectTemplate, video, group, user);
            const htmlBody = this._formatMessage(bodyHtmlTemplate, video, group, user);
            const textBody = `Video '{video_title}' by {channel_name} is trending! Views: {views}, Likes: {likes}, URL: {video_url}`;
            const plainTextBody = this._formatMessage(textBody, video, group, user);

            try {
                await EmailService.sendEmail({
                    to: user.notification_email,
                    subject: subject,
                    text: plainTextBody, // Fallback text
                    html: htmlBody,
                });
                notificationLog.push({ channel: 'email', status: 'success', to: user.notification_email, at: new Date().toISOString() });
                sentTo.push('Email');
            } catch (emailError) {
                console.error(`[NotificationService] Failed to send Email to ${user.notification_email}:`, emailError.message);
                notificationLog.push({ channel: 'email', status: 'failed', error: emailError.message, at: new Date().toISOString() });
            }
        }

        // --- Discord Notification --- 
        if (user.discord_verified && user.DISCORD_USER_ID) {
            const discordTemplate = user.alert_template_discord || '**🔥 Video Trend Alert!**\nVideo: {video_title}\nChannel: {channel_name}\nViews: {views}, Likes: {likes}\n{video_url}';
            const discordMessage = this._formatMessage(discordTemplate, video, group, user);
            try {
                const success = await DiscordService.sendDiscordDM(user.DISCORD_USER_ID, discordMessage);
                if (success) {
                    notificationLog.push({ channel: 'discord', status: 'success', to: user.DISCORD_USER_ID, at: new Date().toISOString() });
                    sentTo.push('Discord');
                } else {
                    throw new Error('DiscordService.sendDiscordDM returned false.');
                }
            } catch (discordError) {
                console.error(`[NotificationService] Failed to send Discord DM to ${user.DISCORD_USER_ID}:`, discordError.message);
                notificationLog.push({ channel: 'discord', status: 'failed', error: discordError.message, at: new Date().toISOString() });
            }
        }

        // --- Telegram Notification --- 
        if (user.telegram_verified && user.TELEGRAM_CHAT_ID) {
            const telegramTemplate = user.alert_template_telegram || '🔥 Video Trend Alert!\nVideo: {video_title}\nChannel: {channel_name}\nViews: {views}, Likes: {likes}\n{video_url}';
            const telegramMessage = this._formatMessage(telegramTemplate, video, group, user);
            try {
                if (!TELEGRAM_BOT_TOKEN) {
                    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables.');
                }
                const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                await axios.post(telegramApiUrl, {
                    chat_id: user.TELEGRAM_CHAT_ID,
                    text: telegramMessage,
                    parse_mode: 'Markdown' // Or 'HTML' if your templates use HTML
                });
                notificationLog.push({ channel: 'telegram', status: 'success', to: user.TELEGRAM_CHAT_ID, at: new Date().toISOString() });
                sentTo.push('Telegram');
            } catch (telegramError) {
                let errMsg = telegramError.message;
                if (telegramError.response && telegramError.response.data) {
                    errMsg = `${errMsg} - Details: ${JSON.stringify(telegramError.response.data)}`;
                }
                console.error(`[NotificationService] Failed to send Telegram message to ${user.TELEGRAM_CHAT_ID}:`, errMsg);
                notificationLog.push({ channel: 'telegram', status: 'failed', error: errMsg, at: new Date().toISOString() });
            }
        }

        // --- Update Alert Record Status --- 
        if (sentTo.length > 0) {
            overallStatus = `NOTIFIED (${sentTo.join(', ')})`;
        } else if (notificationLog.some(log => log.status === 'failed')) {
            overallStatus = 'NOTIFICATION_FAILED_ALL_ATTEMPTED';
        } else {
            overallStatus = 'NO_VERIFIED_CHANNELS';
        }

        if (!isSupabaseReady()) {
            console.error('[NotificationService] Supabase client not ready. Cannot update alert status.');
            // Depending on requirements, you might want to queue this update or handle differently
            return; 
        }

        try {
            const { error: updateError } = await supabase
                .from(TRIGGERED_ALERTS_TABLE)
                .update({
                    [TA_COL_STATUS]: overallStatus,
                    [TA_COL_NOTIFICATION_LOG]: notificationLog // Store as JSON directly
                })
                .eq(TA_COL_ID, alertRecord.id); // Use alertRecord.id (lowercase) if that's the PK from TrendDetectionService

            if (updateError) {
                console.error(`[NotificationService] Supabase error updating TriggeredAlert ${alertRecord.id} status:`, updateError.message);
                // Handle error appropriately, maybe throw or log for retry
            } else {
                console.log(`[NotificationService] Updated TriggeredAlert ${alertRecord.id} with status: ${overallStatus}`);
            }
        } catch (dbError) { // Catch any unexpected error from the try block itself
            console.error(`[NotificationService] Unexpected error when trying to update TriggeredAlert ${alertRecord.id} status:`, dbError.message);
        }
    }
}

module.exports = NotificationService; 