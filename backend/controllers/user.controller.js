const NocoDBService = require('../services/nocodb.service');
const SubscriptionLogicService = require('../services/subscriptionLogic.service');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const { sendToUser } = require('../server');
const COLS = require('../config/nocodb_columns');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');

// Destructure column names from environment variables
const { 
    NOCODB_ONBOARDING_COLUMN,
    NOCODB_NICHE_COLUMN,
    NOCODB_NOTIF_CHANNELS_COLUMN,
    NOCODB_NOTIF_EMAIL_COLUMN,
    NOCODB_NOTIF_TELEGRAM_COLUMN,
    NOCODB_NOTIF_DISCORD_COLUMN,
    NOCODB_NAME_COLUMN,
    NOCODB_COMPANY_NAME_COLUMN,
    NOCODB_PROFILE_PHOTO_URL_COLUMN,
    NOCODB_TELEGRAM_CHAT_ID_COLUMN,
    NOCODB_DISCORD_WEBHOOK_COLUMN,
    NOCODB_DELIVERY_PREF_COLUMN,
    NOCODB_THRESHOLD_VIEWS_COLUMN,
    NOCODB_THRESHOLD_LIKES_COLUMN,
    NOCODB_THRESHOLD_COMMENTS_COLUMN,
    NOCODB_THRESHOLD_VELOCITY_COLUMN,
    NOCODB_FILTER_CHANNELS_COLUMN,
    NOCODB_TEMPLATE_TELEGRAM_COLUMN,
    NOCODB_TEMPLATE_DISCORD_COLUMN,
    NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN,
    NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN,
    NOCODB_TELEGRAM_VERIFIED_COLUMN,
    NOCODB_TELEGRAM_CODE_COLUMN,
    NOCODB_TELEGRAM_EXPIRY_COLUMN,
    NOCODB_PASSWORD_COLUMN,
    NOCODB_EMAIL_COLUMN,
    NOCODB_2FA_SECRET_COLUMN,
    NOCODB_2FA_ENABLED_COLUMN,
    NOCODB_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT_COLUMN,
    NOCODB_THRESHOLD_RELATIVE_VIEW_METRIC_COLUMN,
    NOCODB_THRESHOLD_VIEWS_TIME_WINDOW_HOURS_COLUMN,
    NOCODB_THRESHOLD_LIKES_TIME_WINDOW_HOURS_COLUMN,
    NOCODB_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS_COLUMN,
    // NOCODB_TRACKED_CHANNELS_COLUMN // Uncomment if needed
} = process.env;

// Default Templates (as fallback)
const defaultTemplates = {
    templateTelegram: "🔥 TRENDING: {video_title}\n\n📈 {views} views • {likes} likes • {comments} comments\n\n👤 {channel_name}\n\n🕒 Posted {time_ago}\n\n👉 {video_url}",
    templateDiscord: "**🔥 TRENDING VIDEO ALERT 🔥**\n\n**Title:** {video_title}\n**Channel:** {channel_name}\n\n**Stats:** 📈 {views} views | 👍 {likes} likes | 💬 {comments} comments\n**Posted:** {time_ago}\n\n{video_url}",
    templateEmailSubject: "🔥 New Trending Shorts Alert from Trendy",
    templateEmailPreview: "A new video is trending: {video_title}"
};

/**
 * @desc    Update user onboarding preferences and mark onboarding complete
 * @route   PUT /api/users/preferences
 * @access  Private (requires authentication)
 */
const updateUserPreferences = async (req, res, next) => {
  // Get user ID attached by the 'protect' middleware
  const userId = req.userId; 
  if (!userId) {
    // This should ideally be caught by the protect middleware already
    return res.status(401).json({ message: 'Not authorized, user ID missing' });
  }

  const { 
    niche, 
    selectedChannels, // Expecting an array like ["email", "discord"]
    channelInputs,    // Expecting object like { email: "...". telegram: "..." }
    // trackedChannels // Uncomment if you implement this
  } = req.body;

  // Prepare data object with correct column names
  const dataToUpdate = {};

  // Add preferences if provided
  if (niche !== undefined) {
      dataToUpdate[NOCODB_NICHE_COLUMN || 'niche'] = niche;
  }
  if (selectedChannels !== undefined && Array.isArray(selectedChannels)) {
      // Store array as JSON string if NocoDB column isn't JSON type
      dataToUpdate[NOCODB_NOTIF_CHANNELS_COLUMN || 'notification_channels'] = JSON.stringify(selectedChannels);
  }
  if (channelInputs !== undefined && typeof channelInputs === 'object') {
      if (channelInputs.email !== undefined) {
          dataToUpdate[NOCODB_NOTIF_EMAIL_COLUMN || 'notification_email'] = channelInputs.email;
      }
       if (channelInputs.telegram !== undefined) {
          dataToUpdate[NOCODB_NOTIF_TELEGRAM_COLUMN || 'notification_telegram'] = channelInputs.telegram;
      }
       if (channelInputs.discord !== undefined) {
          dataToUpdate[NOCODB_NOTIF_DISCORD_COLUMN || 'notification_discord'] = channelInputs.discord;
      }
  }
  // Add tracked channels if implemented
  // if (trackedChannels !== undefined) {
  //    dataToUpdate[NOCODB_TRACKED_CHANNELS_COLUMN || 'tracked_youtube_channels'] = JSON.stringify(trackedChannels); // Example
  // }

  // Always mark onboarding as complete when this endpoint is hit successfully
  dataToUpdate[NOCODB_ONBOARDING_COLUMN || 'onboarding_complete'] = true;

  try {
    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ message: 'No preference data provided to update.' });
    }

    const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);

    // Exclude password from the response user object (if present)
    const passwordColumn = process.env.NOCODB_PASSWORD_COLUMN || 'password';
    const { [passwordColumn]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Preferences updated successfully',
      user: userWithoutPassword, // Send back updated user info
    });

  } catch (error) {
    console.error('Update Preferences Error:', error);
    next(error); // Pass to error handling middleware
  }
};

/**
 * @desc    Update basic user profile information (name, company)
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  const userId = req.userId; 
  if (!userId) {
    return res.status(401).json({ message: 'Not authorized, user ID missing' });
  }

  // Read values using the column name constants from the request body
  const nameValue = req.body[NOCODB_NAME_COLUMN];
  const companyValue = req.body[NOCODB_COMPANY_NAME_COLUMN];

  console.log(`[updateProfile] Received for user ${userId}:`, { [NOCODB_NAME_COLUMN]: nameValue, [NOCODB_COMPANY_NAME_COLUMN]: companyValue }); // Log received values

  // Prepare data object using environment variables for NocoDB column names
  const nameNocoDbColumn = NOCODB_NAME_COLUMN; 
  const companyNocoDbColumn = NOCODB_COMPANY_NAME_COLUMN;

  if (!nameNocoDbColumn || !companyNocoDbColumn) {
      console.error("[updateProfile] Error: NOCODB_NAME_COLUMN or NOCODB_COMPANY_NAME_COLUMN environment variables not set!");
      // It's crucial these are set correctly in .env
      return next(new Error("Server configuration error: Missing profile column names.")); 
  }

  const dataToUpdate = {};
  if (nameValue !== undefined) {
      dataToUpdate[nameNocoDbColumn] = nameValue;
  }
  if (companyValue !== undefined) {
      // Allow setting company name to empty string
      dataToUpdate[companyNocoDbColumn] = companyValue;
  }

  console.log(`[updateProfile] Data to update in NocoDB:`, dataToUpdate); // Log data being sent for update

  try {
    if (Object.keys(dataToUpdate).length === 0) {
       return res.status(200).json({ message: 'No profile data provided to update.' });
    }

    const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);
    console.log(`[updateProfile] NocoDB update successful for user ${userId}.`); // Log success

    const passwordColumn = process.env.NOCODB_PASSWORD_COLUMN || 'password';
    const { [passwordColumn]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Profile updated successfully',
      user: userWithoutPassword, // Send back updated user info (reflecting DB state)
    });

  } catch (error) {
    console.error(`[updateProfile] NocoDB update failed for user ${userId}:`, error); // Log specific update error
    next(error); 
  }
};

/**
 * @desc    Update user notification settings
 * @route   PUT /api/users/notifications
 * @access  Private
 */
const updateNotificationSettings = async (req, res, next) => {
  const userId = req.userId; 
  if (!userId) {
    return res.status(401).json({ message: 'Not authorized, user ID missing' });
  }

  // Extract expected fields from request body
  const { 
      // telegramChatId, // REMOVED - Should only be set via verification
      discordWebhookUrl, 
      deliveryPreference, 
      // alertTemplates // If handling templates here
  } = req.body;

  // Prepare data object with correct column names from .env
  const dataToUpdate = {};
  // if (telegramChatId !== undefined) { // REMOVED
  //     dataToUpdate[NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'] = telegramChatId;
  // }
  if (discordWebhookUrl !== undefined) {
      dataToUpdate[NOCODB_DISCORD_WEBHOOK_COLUMN || 'discord_webhook_url'] = discordWebhookUrl;
  }
   if (deliveryPreference !== undefined) {
      dataToUpdate[NOCODB_DELIVERY_PREF_COLUMN || 'delivery_preference'] = deliveryPreference;
  }
  // Add template fields if handling them here
  
  try {
    if (Object.keys(dataToUpdate).length === 0) {
       return res.status(200).json({ message: 'No notification settings provided to update.' });
    }

    const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);

    const passwordColumn = process.env.NOCODB_PASSWORD_COLUMN || 'password';
    const { [passwordColumn]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Notification settings updated successfully',
      user: userWithoutPassword, // Send back updated user info
    });

  } catch (error) {
    console.error('Update Notification Settings Error:', error);
    next(error); 
  }
};

/**
 * @desc    Get user notification settings
 * @route   GET /api/users/notifications
 * @access  Private
 */
const getNotificationSettings = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }
    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Extract only notification-related fields
        const notificationSettings = {
            [NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id']: userRecord[NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'] ?? '',
            [NOCODB_DISCORD_WEBHOOK_COLUMN || 'discord_webhook_url']: userRecord[NOCODB_DISCORD_WEBHOOK_COLUMN || 'discord_webhook_url'] ?? '',
            [NOCODB_DELIVERY_PREF_COLUMN || 'delivery_preference']: userRecord[NOCODB_DELIVERY_PREF_COLUMN || 'delivery_preference'] ?? 'Instantly',
            // Add connection status flags if you implemented them in NocoDB
            // [NOCODB_IS_TELEGRAM_CONNECTED_COLUMN || 'is_telegram_connected']: userRecord[NOCODB_IS_TELEGRAM_CONNECTED_COLUMN || 'is_telegram_connected'] ?? false,
            // [NOCODB_IS_DISCORD_CONNECTED_COLUMN || 'is_discord_connected']: userRecord[NOCODB_IS_DISCORD_CONNECTED_COLUMN || 'is_discord_connected'] ?? false,
            // Add new fields needed by frontend
            [COLS.TELEGRAM_ACCESS_CODE]: userRecord[COLS.TELEGRAM_ACCESS_CODE] ?? null, 
            [COLS.IS_TELEGRAM_CODE_VALID]: userRecord[COLS.IS_TELEGRAM_CODE_VALID] ?? false, 
        };
        res.status(200).json(notificationSettings);

    } catch (error) {
        console.error('Get Notification Settings Error:', error);
        next(error);
    }
};

/**
 * @desc    Get user alert preferences
 * @route   GET /api/users/alert-preferences
 * @access  Private
 */
const getAlertPreferences = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);

        if (!userRecord) {
             return res.status(404).json({ message: 'User not found' });
        }

        // Helper to safely get number or null from record
        const getNumberOrNullFromRecord = (record, key, defaultValue = null) => {
            const val = record[key];
            if (val === null || val === undefined) return defaultValue; // Return default if explicitly null/undefined
            if (typeof val === 'number' && !isNaN(val)) return val;
            if (typeof val === 'string') { // Try parsing if stored as string maybe?
                 const parsed = parseInt(val, 10);
                 if (!isNaN(parsed)) return parsed;
            }
            // If it exists but isn't a valid number or null, return default
            console.warn(`[getAlertPreferences] Invalid number format for ${key} in userRecord ${userId}, using default ${defaultValue}`);
            return defaultValue; 
        };
         // Helper to safely get number or default (for non-nullable)
        const getNumberOrDefaultFromRecord = (record, key, defaultValue = 0) => {
            const val = getNumberOrNullFromRecord(record, key, defaultValue); // Reuse null check
            return val === null ? defaultValue : val; // Ensure non-null return
        };

        // Extract preferences using column names from .env, provide defaults
        // Constructing response with CAMEL_CASE keys for frontend compatibility
        const preferences = {
            // Existing fields (camelCase keys)
            thresholdViews: getNumberOrDefaultFromRecord(userRecord, NOCODB_THRESHOLD_VIEWS_COLUMN || 'threshold_views', 3000000), // Use same defaults as frontend store
            thresholdLikes: getNumberOrDefaultFromRecord(userRecord, NOCODB_THRESHOLD_LIKES_COLUMN || 'threshold_likes', 50000),
            thresholdComments: getNumberOrDefaultFromRecord(userRecord, NOCODB_THRESHOLD_COMMENTS_COLUMN || 'threshold_comments', 450),
            thresholdVelocity: getNumberOrDefaultFromRecord(userRecord, NOCODB_THRESHOLD_VELOCITY_COLUMN || 'threshold_velocity', 500),
            filterChannels: userRecord[NOCODB_FILTER_CHANNELS_COLUMN || 'filter_channels'] ?? "",
            // --- NEW Fields (camelCase keys) ---
            thresholdRelativeViewPerformancePercent: getNumberOrNullFromRecord(userRecord, NOCODB_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT_COLUMN || 'threshold_relative_view_performance_percent', null),
            thresholdRelativeViewMetric: userRecord[NOCODB_THRESHOLD_RELATIVE_VIEW_METRIC_COLUMN || 'threshold_relative_view_metric'] ?? '30d_avg_views',
            thresholdViewsTimeWindowHours: getNumberOrNullFromRecord(userRecord, NOCODB_THRESHOLD_VIEWS_TIME_WINDOW_HOURS_COLUMN || 'threshold_views_time_window_hours', null),
            thresholdLikesTimeWindowHours: getNumberOrNullFromRecord(userRecord, NOCODB_THRESHOLD_LIKES_TIME_WINDOW_HOURS_COLUMN || 'threshold_likes_time_window_hours', null),
            thresholdCommentsTimeWindowHours: getNumberOrNullFromRecord(userRecord, NOCODB_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS_COLUMN || 'threshold_comments_time_window_hours', null),
        };

        res.status(200).json(preferences); // Send camelCase keys

    } catch (error) {
        console.error('Get Alert Preferences Error:', error);
        next(error);
    }
};

/**
 * @desc    Update user alert preferences
 * @route   PUT /api/users/alert-preferences
 * @access  Private
 */
const updateAlertPreferences = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    // Extract expected fields from request body (add new fields, remove niches/hashtags)
    const {
        thresholdViews,
        thresholdLikes,
        thresholdComments,
        thresholdVelocity,
        filterChannels,
        thresholdRelativeViewPerformancePercent,
        thresholdRelativeViewMetric,
        thresholdViewsTimeWindowHours,
        thresholdLikesTimeWindowHours,
        thresholdCommentsTimeWindowHours
    } = req.body;

    // Prepare data object with correct column names (add new, remove old)
    const dataToUpdate = {};

    // Helper function to safely parse int or return null
    const parseIntOrNull = (value) => {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    };
    // Helper function to safely parse int or return default (for non-nullable fields)
    const parseIntOrDefault = (value, defaultValue = 0) => {
        if (value === null || value === undefined) return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    };

    // Map existing fields
    if (thresholdViews !== undefined) dataToUpdate[NOCODB_THRESHOLD_VIEWS_COLUMN || 'threshold_views'] = parseIntOrDefault(thresholdViews, 0);
    if (thresholdLikes !== undefined) dataToUpdate[NOCODB_THRESHOLD_LIKES_COLUMN || 'threshold_likes'] = parseIntOrDefault(thresholdLikes, 0);
    if (thresholdComments !== undefined) dataToUpdate[NOCODB_THRESHOLD_COMMENTS_COLUMN || 'threshold_comments'] = parseIntOrDefault(thresholdComments, 0);
    if (thresholdVelocity !== undefined) dataToUpdate[NOCODB_THRESHOLD_VELOCITY_COLUMN || 'threshold_velocity'] = parseIntOrDefault(thresholdVelocity, 0);
    if (filterChannels !== undefined) dataToUpdate[NOCODB_FILTER_CHANNELS_COLUMN || 'filter_channels'] = filterChannels; // Keep as string

    // --- Map NEW Fields ---
    if (thresholdRelativeViewPerformancePercent !== undefined) {
        dataToUpdate[NOCODB_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT_COLUMN || 'threshold_relative_view_performance_percent'] = parseIntOrNull(thresholdRelativeViewPerformancePercent);
    }
    if (thresholdRelativeViewMetric !== undefined) {
        // Add validation if needed (e.g., check against allowed values)
        dataToUpdate[NOCODB_THRESHOLD_RELATIVE_VIEW_METRIC_COLUMN || 'threshold_relative_view_metric'] = thresholdRelativeViewMetric;
    }
    if (thresholdViewsTimeWindowHours !== undefined) {
        dataToUpdate[NOCODB_THRESHOLD_VIEWS_TIME_WINDOW_HOURS_COLUMN || 'threshold_views_time_window_hours'] = parseIntOrNull(thresholdViewsTimeWindowHours);
    }
    if (thresholdLikesTimeWindowHours !== undefined) {
        dataToUpdate[NOCODB_THRESHOLD_LIKES_TIME_WINDOW_HOURS_COLUMN || 'threshold_likes_time_window_hours'] = parseIntOrNull(thresholdLikesTimeWindowHours);
    }
    if (thresholdCommentsTimeWindowHours !== undefined) {
        dataToUpdate[NOCODB_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS_COLUMN || 'threshold_comments_time_window_hours'] = parseIntOrNull(thresholdCommentsTimeWindowHours);
    }
    
    try {
        // Check if *any* valid data was sent
        if (Object.keys(dataToUpdate).length === 0) {
            return res.status(400).json({ message: 'No valid alert preferences provided to update.' });
        }
        console.log('[updateAlertPreferences] Updating NocoDB with data:', dataToUpdate); // Log data being sent

        const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);

        // Return only the updated preferences, reflecting the saved state
        const updatedPreferences = {};
        for (const key in dataToUpdate) {
             // Ensure the key exists in the NocoDB column env map to avoid errors if env vars change
             // This mapping assumes dataToUpdate keys are the NocoDB column names
             if (updatedUser.hasOwnProperty(key)) { 
                 updatedPreferences[key] = updatedUser[key];
             }
        }

        res.status(200).json({
            message: 'Alert preferences updated successfully',
            preferences: updatedPreferences, // Send back only what was intended to be updated
        });

    } catch (error) {
        console.error('Update Alert Preferences Error:', error);
        next(error);
    }
};

/**
 * @desc    Get user alert templates
 * @route   GET /api/users/alert-templates
 * @access  Private
 */
const getAlertTemplates = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }
    try {
        // Fetch the user record
        const userRecord = await NocoDBService.getUserRecordById(userId);

        if (!userRecord) {
             return res.status(404).json({ message: 'User not found' });
        }
        
        // Extract templates using column names, falling back to defaults
        const templates = {
             [NOCODB_TEMPLATE_TELEGRAM_COLUMN || 'alert_template_telegram']: 
                userRecord[NOCODB_TEMPLATE_TELEGRAM_COLUMN || 'alert_template_telegram'] || defaultTemplates.templateTelegram,
             [NOCODB_TEMPLATE_DISCORD_COLUMN || 'alert_template_discord']: 
                userRecord[NOCODB_TEMPLATE_DISCORD_COLUMN || 'alert_template_discord'] || defaultTemplates.templateDiscord,
             [NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN || 'alert_template_email_subject']: 
                userRecord[NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN || 'alert_template_email_subject'] || defaultTemplates.templateEmailSubject,
             [NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN || 'alert_template_email_preview']: 
                userRecord[NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN || 'alert_template_email_preview'] || defaultTemplates.templateEmailPreview,
        };

        res.status(200).json(templates);

    } catch (error) {
        console.error('Get Alert Templates Error:', error);
        next(error);
    }
};

/**
 * @desc    Update user alert templates
 * @route   PUT /api/users/alert-templates
 * @access  Private
 */
const updateAlertTemplates = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    // Define expected DB column keys (using env vars or defaults)
    const telegramCol = NOCODB_TEMPLATE_TELEGRAM_COLUMN || 'alert_template_telegram';
    const discordCol = NOCODB_TEMPLATE_DISCORD_COLUMN || 'alert_template_discord';
    const emailSubCol = NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN || 'alert_template_email_subject';
    const emailPreCol = NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN || 'alert_template_email_preview';

    const allowedKeys = [telegramCol, discordCol, emailSubCol, emailPreCol];

    // Check if *any* valid key exists in req.body before proceeding
    const receivedKeys = Object.keys(req.body);
    const hasValidData = receivedKeys.some(key => allowedKeys.includes(key) && req.body[key] !== undefined);

    if (!hasValidData) {
        // Use 400 Bad Request because the client sent a request with no usable data
        return res.status(400).json({ message: 'No valid alert template data provided to update.' });
    }

    // Build dataToUpdate ONLY with keys that are present in req.body and are allowed
    const dataToUpdate = {};
    allowedKeys.forEach(key => {
        if (req.body[key] !== undefined) { // Check if the key exists in the actual request body
            dataToUpdate[key] = req.body[key];
        }
    });

    // The previous check `Object.keys(dataToUpdate).length === 0` is now redundant because of the `hasValidData` check above.

    try {
        // No need for the length check here anymore
        const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);
        
        // Return only updated templates based on what was actually sent and updated
        const updatedTemplates = Object.keys(dataToUpdate).reduce((acc, key) => {
            // Use the value from updatedUser to ensure it reflects the actual DB state
            acc[key] = updatedUser[key];
            return acc;
        }, {});
        
        res.status(200).json({
            message: 'Alert templates updated successfully',
            templates: updatedTemplates,
        });
    } catch (error) {
        console.error('Update Alert Templates Error:', error);
        next(error);
    }
};

/**
 * @desc    Send a test notification for a specified channel
 * @route   POST /api/users/notifications/test
 * @access  Private
 */
const sendTestNotification = async (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Not authorized, user ID missing' });
  }

  const { channelType } = req.body; // Expect 'telegram', 'discord', or 'email'

  if (!channelType || !['telegram', 'discord', 'email'].includes(channelType)) {
    return res.status(400).json({ message: 'Invalid or missing channelType. Must be telegram, discord, or email.' });
  }

  try {
    // Fetch user record to get configuration and templates
    const userRecord = await NocoDBService.getUserRecordById(userId);
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }

    // --- Prepare Sample Data ---
    const sampleData = {
        video_title: "🚀 Viral Test Video Example",
        views: "12,345",
        likes: "1,234",
        comments: "98",
        channel_name: "Test Channel",
        time_ago: "5 minutes ago",
        video_url: "https://example.com/test-video"
    };

    // --- Function to replace placeholders ---
    const formatMessage = (template, data) => {
        let message = template;
        for (const key in data) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), data[key]);
        }
        return message;
    };

    let successMessage = "";

    // --- Channel Specific Logic ---
    if (channelType === 'telegram') {
        const chatId = userRecord[NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'];
        const template = userRecord[NOCODB_TEMPLATE_TELEGRAM_COLUMN || 'alert_template_telegram'] || defaultTemplates.templateTelegram;
        const botToken = process.env.TELEGRAM_BOT_TOKEN; // Needs to be set in .env

        if (!chatId) {
            return res.status(400).json({ message: 'Telegram Chat ID not configured.' });
        }
        if (!botToken) {
             console.error('Telegram Bot Token not configured in environment variables.');
             return res.status(500).json({ message: 'Telegram bot not configured on server.' });
        }

        const messageToSend = formatMessage(template, sampleData);

        // --- ACTUAL TELEGRAM SENDING LOGIC --- 
        // Requires installing a library like 'node-telegram-bot-api'
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(botToken);
        try {
            // Ensure chatId is treated as a string or number as required by the library
            await bot.sendMessage(String(chatId), messageToSend, { parse_mode: 'HTML' }); // Using HTML parse mode for potential formatting
            successMessage = `Test message sent to Telegram Chat ID: ${chatId}`;
        } catch (sendError) {
            console.error('Telegram send error:', sendError.response?.body || sendError.message);
            // Provide more specific error feedback if possible
            const errorDetails = sendError.response?.body?.description || sendError.message || 'Unknown error';
            return res.status(500).json({ message: `Failed to send test message to Telegram: ${errorDetails}` });
        }
        // --- END OF TELEGRAM SENDING --- 

        // Placeholder success for now - REMOVED
        // console.log(`--- SIMULATING Telegram Send --- 
        // To: ${chatId}
        // Message: ${messageToSend}
        // ---`);
        // successMessage = `Test message simulated for Telegram Chat ID: ${chatId}. Check server console.`;

    } else if (channelType === 'discord') {
        const webhookUrl = userRecord[NOCODB_DISCORD_WEBHOOK_COLUMN || 'discord_webhook_url'];
        const template = userRecord[NOCODB_TEMPLATE_DISCORD_COLUMN || 'alert_template_discord'] || defaultTemplates.templateDiscord;

        if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
            return res.status(400).json({ message: 'Valid Discord Webhook URL not configured.' });
        }

        const messageToSend = formatMessage(template, sampleData);

        // --- ACTUAL DISCORD SENDING LOGIC --- 
        // Requires an HTTP client like 'axios' (already likely installed)
        // try {
        //     await axios.post(webhookUrl, { content: messageToSend });
        //     successMessage = `Test message sent to Discord Webhook.`; 
        // } catch (sendError) {
        //     console.error('Discord send error:', sendError.response?.data || sendError.message);
        //     return res.status(500).json({ message: `Failed to send test message to Discord: ${sendError.response?.data?.message || sendError.message}` });
        // }
        // --- END OF DISCORD SENDING --- 

        // Placeholder success for now
        console.log(`--- SIMULATING Discord Send --- 
To Webhook: ${webhookUrl}
Message: ${messageToSend}
---`);
        successMessage = `Test message simulated for Discord Webhook. Check server console.`;

    } else if (channelType === 'email') {
        const userEmail = userRecord[process.env.NOCODB_EMAIL_COLUMN || 'email'];
        const subjectTemplate = userRecord[NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN || 'alert_template_email_subject'] || defaultTemplates.templateEmailSubject;
        // Note: Email preview text is less relevant for test, body needs formatting
        // const previewTemplate = userRecord[NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN || 'alert_template_email_preview'] || defaultTemplates.templateEmailPreview;

        if (!userEmail) {
            return res.status(400).json({ message: 'User email address not found.' });
        }
        
        const subject = formatMessage(subjectTemplate, sampleData);
        // Construct a simple HTML body for the test
        const body = `
            <h1>🔥 Test Trend Alert</h1>
            <p>This is a test notification from Trendy.</p>
            <p><strong>Video:</strong> ${sampleData.video_title}</p>
            <p><strong>Channel:</strong> ${sampleData.channel_name}</p>
            <p><strong>Stats:</strong> ${sampleData.views} views / ${sampleData.likes} likes / ${sampleData.comments} comments</p>
            <p><strong>Posted:</strong> ${sampleData.time_ago}</p>
            <p><a href="${sampleData.video_url}">Watch Video</a></p>
        `;

        // --- ACTUAL EMAIL SENDING LOGIC --- 
        // Requires installing 'nodemailer' and configuring transport (SMTP, SendGrid, etc.)
        // Needs environment variables for service credentials (e.g., SENDGRID_API_KEY)
        // const nodemailer = require('nodemailer');
        // const transporter = nodemailer.createTransport({ /* ... configuration based on service ... */ });
        // try {
        //     await transporter.sendMail({
        //         from: process.env.EMAIL_FROM_ADDRESS, // Configure in .env
        //         to: userEmail,
        //         subject: subject,
        //         html: body,
        //         // text: optional plain text version
        //     });
        //     successMessage = `Test email sent to ${userEmail}.`;
        // } catch (sendError) {
        //     console.error('Email send error:', sendError);
        //     return res.status(500).json({ message: `Failed to send test email: ${sendError.message}` });
        // }
        // --- END OF EMAIL SENDING --- 

        // Placeholder success for now
        console.log(`--- SIMULATING Email Send --- 
To: ${userEmail}
Subject: ${subject}
Body: ${body}
---`);
        successMessage = `Test message simulated for Email (${userEmail}). Check server console.`;
    }

    res.status(200).json({ message: successMessage });

  } catch (error) {
    console.error(`Test Notification Error (${channelType}):`, error);
    next(error);
  }
};

/**
 * @desc    Generate and send a Telegram verification code to the user's provided Chat ID.
 * @route   POST /api/users/telegram/send-code
 * @access  Private
 */
const sendTelegramVerificationCode = async (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const { chatId } = req.body;
  if (!chatId || typeof chatId !== 'string' || !/^-?\d+$/.test(chatId)) {
    return res.status(400).json({ message: 'Valid Telegram Chat ID is required.' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('Telegram Bot Token not configured in environment variables.');
    return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
  }

  try {
    // 1. Generate Verification Code (6 digits)
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiryMinutes = 10;
    const expiryDate = new Date(Date.now() + expiryMinutes * 60000);

    // 2. Store Code and Expiry in NocoDB
    const dataToUpdate = {
      [NOCODB_TELEGRAM_CODE_COLUMN || 'telegram_verification_code']: verificationCode,
      [NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_code_expiry']: expiryDate.toISOString(),
      // Store the attempted chat ID temporarily or permanently?
      // Let's store it permanently here, assuming user intends to use this ID.
      // If verification fails, they can try again with a different ID.
      [NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id']: chatId,
      [NOCODB_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified']: false // Ensure verified is false
    };
    await NocoDBService.updateUser(userId, dataToUpdate);
    console.log(`Stored Telegram verification code for user ${userId}.`);

    // 3. Send Code via Telegram Bot
    const bot = new TelegramBot(botToken);
    const messageText = `Your Trendy Bot verification code is: *${verificationCode}*\n\nThis code will expire in ${expiryMinutes} minutes.`;
    
    await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
    console.log(`Sent verification code to Chat ID ${chatId} for user ${userId}.`);

    res.status(200).json({ message: `Verification code sent to Telegram Chat ID ${chatId}. Please check Telegram.` });

  } catch (error) {
    console.error(`Error sending Telegram verification code for user ${userId}:`, error.response?.body || error.message || error);
    // Check for specific Telegram errors (e.g., chat not found, bot blocked)
     if (error.response && error.response.body && error.response.body.error_code === 400 && error.response.body.description.includes('chat not found')) {
        return res.status(400).json({ message: 'Could not send message. Please ensure the Chat ID is correct and you have started a conversation with the bot.' });
     } else if (error.response && error.response.body && error.response.body.error_code === 403) { // Forbidden, likely bot blocked
          return res.status(403).json({ message: 'Could not send message. Please ensure you have not blocked the bot.' });
     }
    // Pass other errors to generic handler
    next(new Error('Failed to send Telegram verification code.')); 
  }
};

/**
 * @desc    Verify a Telegram verification code submitted by the user.
 * @route   POST /api/users/telegram/verify-code
 * @access  Private
 */
const verifyTelegramCode = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    const { verificationCode } = req.body; 
    if (!verificationCode || typeof verificationCode !== 'string' || !/\d{6}/.test(verificationCode)) {
        return res.status(400).json({ message: 'Invalid verification code format. Expected 6 digits.' });
    }

    try {
        // 1. Get user record with stored code and expiry
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storedCode = userRecord[NOCODB_TELEGRAM_CODE_COLUMN || 'telegram_verification_code'];
        const expiryString = userRecord[NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_code_expiry'];
        const storedChatId = userRecord[NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id']; // Get stored chat ID

        if (!storedCode || !expiryString || !storedChatId) {
             return res.status(400).json({ message: 'Verification process not initiated or chat ID missing. Please request a code first.' });
        }

        // 2. Check Expiry
        const expiryDate = new Date(expiryString);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            // Optionally clear the expired code here
            // await NocoDBService.updateUser(userId, { 
            //     [NOCODB_TELEGRAM_CODE_COLUMN || 'telegram_verification_code']: null,
            //     [NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_code_expiry']: null
            // });
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        // 3. Compare Codes
        if (verificationCode !== storedCode) {
             return res.status(400).json({ message: 'Invalid verification code.' });
        }

        // 4. Verification Successful: Update NocoDB
        const dataToUpdate = {
            [NOCODB_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified']: true,
            [NOCODB_TELEGRAM_CODE_COLUMN || 'telegram_verification_code']: null, // Clear code
            [NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_code_expiry']: null,   // Clear expiry
             // Keep storedChatId as it's now verified
        };
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`Telegram verification successful for user ${userId} with Chat ID ${storedChatId}.`);

        // 5. Send confirmation message back via Telegram
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
             try {
                const bot = new TelegramBot(botToken);
                await bot.sendMessage(storedChatId, '✅ Your Telegram account has been successfully connected to Trendy Bot!');
             } catch (confirmError) {
                 console.error(`Failed to send Telegram confirmation message to ${storedChatId} for user ${userId}:`, confirmError.message);
                 // Don't fail the whole request for this, just log it.
             }
        } else {
             console.warn('Telegram Bot Token not configured. Skipping confirmation message.')
        }

         // 6. Notify Frontend via WebSocket
         sendToUser(userId, { 
             type: 'telegramStatusUpdate', 
             payload: { 
                 verified: true, 
                 chatId: storedChatId 
             }
         });

        res.status(200).json({ 
            message: 'Telegram account connected successfully.', 
            chatId: storedChatId 
        });

    } catch (error) {
        console.error(`Error verifying Telegram code for user ${userId}:`, error);
        next(new Error('Failed to verify Telegram code due to a server error.')); 
    }
};

/**
 * @desc    Disconnect the user's Telegram account.
 * @route   POST /api/users/telegram/disconnect
 * @access  Private
 */
const disconnectTelegram = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        // Define column names using env variables or defaults
        const chatIdCol = NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id';
        const verifiedCol = NOCODB_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified';
        const codeCol = NOCODB_TELEGRAM_CODE_COLUMN || 'telegram_verification_code';
        const expiryCol = NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_code_expiry';

        // Prepare data to clear Telegram connection info
        const dataToUpdate = {
            [chatIdCol]: null,
            [verifiedCol]: false,
            [codeCol]: null,
            [expiryCol]: null
        };

        // Update the user record in NocoDB
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`Cleared Telegram connection info for user ${userId}.`);

        // Notify Frontend via WebSocket
        sendToUser(userId, { 
            type: 'telegramStatusUpdate', 
            payload: { 
                verified: false, 
                chatId: null 
            }
        });

        res.status(200).json({ 
            message: 'Telegram account disconnected successfully.', 
        });

    } catch (error) {
        console.error(`Error disconnecting Telegram for user ${userId}:`, error);
        next(new Error('Failed to disconnect Telegram account due to a server error.')); 
    }
};

/**
 * @desc    Update user profile photo
 * @route   PUT /api/users/profile/photo
 * @access  Private
 */
const updateProfilePhoto = async (req, res, next) => {
    // Correctly read userId attached directly by the protect middleware
    const userId = req.userId; 
    if (!userId) {
        // Keep this check, although protect middleware should prevent this
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    if (!req.file) {
        // This might happen if the file filter rejected the file
        return res.status(400).json({ message: 'File upload failed. Please ensure you are uploading a valid image (JPG, PNG, GIF) under 2MB.' });
    }

    try {
        // Construct the public URL path based on static serving setup
        const publicUrlPath = `/uploads/avatars/${req.file.filename}`;

        // Prepare data for NocoDB update
        const photoUrlColumn = NOCODB_PROFILE_PHOTO_URL_COLUMN || 'profile_photo_url';
        const dataToUpdate = {
            [photoUrlColumn]: publicUrlPath
        };

        // Update the user record in NocoDB
        const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`Updated profile photo URL for user ${userId} to: ${publicUrlPath}`);

        // Respond with the new photo URL
        res.status(200).json({
            message: 'Profile photo updated successfully',
            photoUrl: publicUrlPath, // Send back the URL for the frontend to use
            // Optionally send back the relevant part of the updated user object if needed
            // user: { [photoUrlColumn]: updatedUser[photoUrlColumn] } 
        });

    } catch (error) {
        console.error(`Error updating profile photo for user ${userId}:`, error);
        // Check if it's a multer error (e.g., file too large)
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ message: `File upload error: ${error.message}` });
        }
        // Pass other errors to the generic error handler
        next(new Error('Failed to update profile photo due to a server error.'));
    }
};

/**
 * @desc    Change user password
 * @route   POST /api/users/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide both current and new passwords.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const passwordNocoDbColumn = NOCODB_PASSWORD_COLUMN;
    if (!passwordNocoDbColumn) {
        console.error("[changePassword] Error: NOCODB_PASSWORD_COLUMN environment variable not set!");
        return next(new Error("Server configuration error: Missing password column name.")); 
    }

    try {
        // 1. Fetch current user to get the stored hash
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) {
            // Should not happen if protect middleware worked, but good check
            return res.status(404).json({ message: 'User not found.' });
        }

        const storedHash = userRecord[passwordNocoDbColumn];
        if (!storedHash) {
            console.error(`[changePassword] User ${userId} has no password hash stored.`);
            return res.status(500).json({ message: 'Cannot change password, account issue.' });
        }

        // 2. Compare current password with stored hash
        const isMatch = await bcrypt.compare(currentPassword, storedHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        // 3. Hash the new password
        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update NocoDB with the new hash
        const dataToUpdate = {
            [passwordNocoDbColumn]: newHashedPassword
        };
        await NocoDBService.updateUser(userId, dataToUpdate);

        console.log(`[changePassword] Password updated successfully for user ${userId}.`);
        res.status(200).json({ message: 'Password changed successfully.' });

    } catch (error) {
        console.error(`[changePassword] Failed for user ${userId}:`, error);
        next(error); // Pass to generic error handler
    }
};

/**
 * @desc    Setup 2FA: Generate secret and OTPAuth URI
 * @route   GET /api/users/2fa/setup
 * @access  Private
 */
const setup2FA = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    const secretColumn = NOCODB_2FA_SECRET_COLUMN;
    const emailColumn = NOCODB_EMAIL_COLUMN;
    if (!secretColumn || !emailColumn) {
        console.error("[setup2FA] Error: Required 2FA/Email column environment variables not set!");
        return next(new Error("Server configuration error: Missing 2FA column names."));
    }

    try {
        // 1. Fetch user's email for the OTPAuth label
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord || !userRecord[emailColumn]) {
            return res.status(404).json({ message: 'User email not found, cannot setup 2FA.' });
        }
        const userEmail = userRecord[emailColumn];
        const appName = 'TrendyBot'; // Or your app name

        // 2. Generate a new secret
        const secret = authenticator.generateSecret();

        // 3. Store the *unverified* secret in the database
        // We set enabled=false until they verify with the token
        const dataToUpdate = {
            [secretColumn]: secret,
            // Optionally clear enabled flag if they are re-running setup
            [NOCODB_2FA_ENABLED_COLUMN]: false 
        };
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`[setup2FA] Generated and stored temporary 2FA secret for user ${userId}.`);

        // 4. Generate the otpauth:// URI for the QR code
        const otpauthUri = authenticator.keyuri(userEmail, appName, secret);

        // 5. Return the secret and URI to the frontend
        res.status(200).json({
            secret: secret, // For manual entry
            otpauthUri: otpauthUri // For QR code generation
        });

    } catch (error) {
        console.error(`[setup2FA] Failed for user ${userId}:`, error);
        next(error);
    }
};

/**
 * @desc    Verify 2FA TOTP token and enable 2FA
 * @route   POST /api/users/2fa/verify
 * @access  Private
 */
const verify2FA = async (req, res, next) => {
    const userId = req.userId;
    const { token: userToken } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!userToken || !/\d{6}/.test(userToken)) {
        return res.status(400).json({ message: 'Invalid or missing 6-digit token.' });
    }

    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);
        const secret = userRecord[NOCODB_2FA_SECRET_COLUMN];

        if (!secret) {
            return res.status(400).json({ message: '2FA setup not initiated for this user.' });
        }

        // Verify the token
        const isValid = authenticator.verify({ token: userToken, secret });

        if (isValid) {
            // Token is valid, enable 2FA for the user
            await NocoDBService.updateUser(userId, {
                [NOCODB_2FA_ENABLED_COLUMN]: true,
                // Optionally clear the secret here if it's only stored temporarily during setup,
                // or keep it if needed for recovery (depends on your security model)
            });
            console.log(`2FA enabled successfully for user ID: ${userId}`);
            res.status(200).json({ message: 'Two-factor authentication enabled successfully.' });
        } else {
            // Token is invalid
            console.log(`Invalid 2FA token attempt for user ID: ${userId}`);
            res.status(400).json({ message: 'Invalid verification code.' });
        }

    } catch (error) {
        console.error(`Error verifying 2FA for user ID: ${userId}:`, error);
        next(error); 
    }
};

/**
 * @desc    Disable Two-Factor Authentication for the user
 * @route   POST /api/users/2fa/disable
 * @access  Private
 */
const disable2FA = async (req, res, next) => {
    const userId = req.userId; // Get user ID from authenticated request (assuming 'protect' middleware)

    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        console.log(`Attempting to disable 2FA for user ID: ${userId}`);
        // Update the user record in NocoDB
        const updateResult = await NocoDBService.updateUser(userId, {
            [NOCODB_2FA_ENABLED_COLUMN]: false,
            [NOCODB_2FA_SECRET_COLUMN]: null, // Clear the secret when disabling
        });

        // NocoDBService.updateUser should ideally throw an error on failure
        // or return the updated record.
        // We assume success if no error is thrown.
        console.log(`Successfully disabled 2FA for user ID: ${userId}`);
        res.status(200).json({ message: 'Two-factor authentication disabled successfully.' });

    } catch (error) {
        console.error(`Error disabling 2FA for user ID: ${userId}`, error);
        // Handle specific errors like user not found if NocoDBService provides them
        if (error.message && error.message.includes('Not Found')) { // Example error check
             return res.status(404).json({ message: 'User not found.' });
        }
        next(error); // Pass other errors to the central handler
    }
};

/**
 * @desc    Delete user account
 * @route   DELETE /api/users/account
 * @access  Private
 */
const deleteAccount = async (req, res, next) => {
    const userId = req.userId; // Get user ID from authenticated request (protect middleware)

    if (!userId) {
        // This should ideally be caught by protect middleware
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        console.log(`Attempting to delete account for user ID: ${userId}`);

        // --- Subscription Cancellation (Placeholder/Warning) ---
        // TODO: Implement actual subscription cancellation logic if possible (e.g., PayPal API call)
        // This is crucial to avoid charging users after account deletion.
        console.warn(`ACTION REQUIRED: Account deletion initiated for user ${userId}. Please manually verify and cancel any active subscriptions (e.g., PayPal) associated with this user.`);
        // ------------------------------------------------------

        // Delete user record from NocoDB
        const deleted = await NocoDBService.deleteUser(userId);

        if (deleted) {
            console.log(`Successfully deleted account for user ID: ${userId}`);
            // Respond with success - frontend should handle logout/redirect
            res.status(200).json({ message: 'Account deleted successfully.' });
        } else {
             // deleteUser service should handle 404 as success, so reaching here implies another issue
            console.error(`NocoDBService.deleteUser reported failure for user ID: ${userId} but did not throw an error.`);
            res.status(500).json({ message: 'Account deletion failed. Could not remove user data.' });
        }

    } catch (error) {
        console.error(`Error deleting account for user ID: ${userId}`, error);
        // Pass error to the central handler
        next(new Error('Failed to delete account due to a server error.')); 
    }
};

module.exports = {
  updateUserPreferences,
  updateProfile,
  updateProfilePhoto,
  updateNotificationSettings,
  getNotificationSettings,
  getAlertPreferences,
  updateAlertPreferences,
  getAlertTemplates,
  updateAlertTemplates,
  sendTestNotification,
  sendTelegramVerificationCode,
  verifyTelegramCode,
  disconnectTelegram,
  changePassword,
  setup2FA,
  verify2FA,
  disable2FA,
  deleteAccount
}; 