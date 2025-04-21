module.exports = {
    // Existing (Verify these against your actual NocoDB table names)
    USER_ID: 'Id', // Common default primary key name in NocoDB
    NAME: process.env.NOCODB_NAME_COLUMN || 'name',
    EMAIL: process.env.NOCODB_EMAIL_COLUMN || 'email',
    PASSWORD: process.env.NOCODB_PASSWORD_COLUMN || 'password',
    ONBOARDING_COMPLETE: process.env.NOCODB_ONBOARDING_COLUMN || 'onboarding_complete',
    NICHE: process.env.NOCODB_NICHE_COLUMN || 'niche',
    NOTIF_CHANNELS: process.env.NOCODB_NOTIF_CHANNELS_COLUMN || 'notification_channels',
    NOTIF_EMAIL: process.env.NOCODB_NOTIF_EMAIL_COLUMN || 'notification_email',
    NOTIF_TELEGRAM: process.env.NOCODB_NOTIF_TELEGRAM_COLUMN || 'notification_telegram',
    NOTIF_DISCORD: process.env.NOCODB_NOTIF_DISCORD_COLUMN || 'notification_discord',
    TRACKED_CHANNELS: process.env.NOCODB_TRACKED_CHANNELS_COLUMN || 'tracked_youtube_channels',
    COMPANY_NAME: process.env.NOCODB_COMPANY_NAME_COLUMN || 'company_name',
    PROFILE_PHOTO_URL: process.env.NOCODB_PROFILE_PHOTO_URL_COLUMN || 'profile_photo_url',
    THRESHOLD_VIEWS: process.env.NOCODB_THRESHOLD_VIEWS_COLUMN || 'threshold_views',
    THRESHOLD_LIKES: process.env.NOCODB_THRESHOLD_LIKES_COLUMN || 'threshold_likes',
    THRESHOLD_COMMENTS: process.env.NOCODB_THRESHOLD_COMMENTS_COLUMN || 'threshold_comments',
    THRESHOLD_VELOCITY: process.env.NOCODB_THRESHOLD_VELOCITY_COLUMN || 'threshold_velocity',
    FILTER_CHANNELS: process.env.NOCODB_FILTER_CHANNELS_COLUMN || 'filter_channels',
    FILTER_NICHES: process.env.NOCODB_FILTER_NICHES_COLUMN || 'filter_niches',
    FILTER_HASHTAGS: process.env.NOCODB_FILTER_HASHTAGS_COLUMN || 'filter_hashtags',
    TEMPLATE_TELEGRAM: process.env.NOCODB_TEMPLATE_TELEGRAM_COLUMN || 'alert_template_telegram',
    TEMPLATE_DISCORD: process.env.NOCODB_TEMPLATE_DISCORD_COLUMN || 'alert_template_discord',
    TEMPLATE_EMAIL_SUBJECT: process.env.NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN || 'alert_template_email_subject',
    TEMPLATE_EMAIL_PREVIEW: process.env.NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN || 'alert_template_email_preview',
    SUBSCRIPTION_STATUS: process.env.NOCODB_SUBSCRIPTION_STATUS_COLUMN || 'subscription_status',
    CURRENT_PLAN: process.env.NOCODB_CURRENT_PLAN_COLUMN || 'current_plan',
    TELEGRAM_CHAT_ID: process.env.NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'TELEGRAM_CHAT_ID', // Verify exact case/name
    DISCORD_USER_ID: process.env.NOCODB_DISCORD_USER_ID_COLUMN || 'DISCORD_USER_ID', // Verify exact case/name

    // New Fields (Verify these against your actual NocoDB table names)
    TELEGRAM_ACCESS_CODE: process.env.NOCODB_TELEGRAM_ACCESS_CODE_COLUMN || 'telegram_access_code',
    IS_TELEGRAM_CODE_VALID: process.env.NOCODB_IS_TELEGRAM_CODE_VALID_COLUMN || 'is_telegram_code_valid',
    TRIAL_STARTED_AT: process.env.NOCODB_TRIAL_STARTED_AT_COLUMN || 'trial_started_at',
    TRIAL_EXPIRES_AT: process.env.NOCODB_TRIAL_EXPIRES_AT_COLUMN || 'trial_expires_at',
    IS_TRIAL_USED: process.env.NOCODB_IS_TRIAL_USED_COLUMN || 'is_trial_used',
}; 