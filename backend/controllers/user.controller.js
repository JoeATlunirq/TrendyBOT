const NocoDBService = require('../services/nocodb.service');

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
    NOCODB_FILTER_NICHES_COLUMN,
    NOCODB_FILTER_HASHTAGS_COLUMN,
    NOCODB_TEMPLATE_TELEGRAM_COLUMN,
    NOCODB_TEMPLATE_DISCORD_COLUMN,
    NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN,
    NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN,
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

  const { name, companyName } = req.body;

  // Prepare data object with correct column names
  const dataToUpdate = {};
  if (name !== undefined) {
      dataToUpdate[NOCODB_NAME_COLUMN || 'name'] = name;
  }
  if (companyName !== undefined) {
      dataToUpdate[NOCODB_COMPANY_NAME_COLUMN || 'company_name'] = companyName;
  }
  // Note: Photo URL update would typically happen via a separate file upload endpoint

  try {
    // Don't update if no relevant data was provided
    if (Object.keys(dataToUpdate).length === 0) {
      // Optionally fetch current user data if needed, otherwise return success
      // For now, just return a success message or 204 No Content
       return res.status(200).json({ message: 'No profile data provided to update.' });
    }

    const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);

    const passwordColumn = process.env.NOCODB_PASSWORD_COLUMN || 'password';
    const { [passwordColumn]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Profile updated successfully',
      user: userWithoutPassword, // Send back updated user info
    });

  } catch (error) {
    console.error('Update Profile Error:', error);
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
      telegramChatId, 
      discordWebhookUrl, 
      deliveryPreference, 
      // alertTemplates // If handling templates here
  } = req.body;

  // Prepare data object with correct column names from .env
  const dataToUpdate = {};
  if (telegramChatId !== undefined) {
      dataToUpdate[NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'] = telegramChatId;
  }
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
        // Fetch the user record using the new service function
        const userRecord = await NocoDBService.getUserRecordById(userId);

        if (!userRecord) {
             return res.status(404).json({ message: 'User not found' });
        }

        // Extract preferences using column names from .env, provide defaults
        const preferences = {
            [NOCODB_THRESHOLD_VIEWS_COLUMN || 'threshold_views']: userRecord[NOCODB_THRESHOLD_VIEWS_COLUMN || 'threshold_views'] ?? 10000, // Default 10k
            [NOCODB_THRESHOLD_LIKES_COLUMN || 'threshold_likes']: userRecord[NOCODB_THRESHOLD_LIKES_COLUMN || 'threshold_likes'] ?? 1000, // Default 1k
            [NOCODB_THRESHOLD_COMMENTS_COLUMN || 'threshold_comments']: userRecord[NOCODB_THRESHOLD_COMMENTS_COLUMN || 'threshold_comments'] ?? 100, // Default 100
            [NOCODB_THRESHOLD_VELOCITY_COLUMN || 'threshold_velocity']: userRecord[NOCODB_THRESHOLD_VELOCITY_COLUMN || 'threshold_velocity'] ?? 500, // Default 500
            [NOCODB_FILTER_CHANNELS_COLUMN || 'filter_channels']: userRecord[NOCODB_FILTER_CHANNELS_COLUMN || 'filter_channels'] ?? "",
            [NOCODB_FILTER_NICHES_COLUMN || 'filter_niches']: userRecord[NOCODB_FILTER_NICHES_COLUMN || 'filter_niches'] ?? "",
            [NOCODB_FILTER_HASHTAGS_COLUMN || 'filter_hashtags']: userRecord[NOCODB_FILTER_HASHTAGS_COLUMN || 'filter_hashtags'] ?? "",
        };

        res.status(200).json(preferences);

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

    // Extract expected fields from request body
    const {
        thresholdViews,
        thresholdLikes,
        thresholdComments,
        thresholdVelocity,
        filterChannels,
        filterNiches,
        filterHashtags
    } = req.body;

    // Prepare data object with correct column names
    const dataToUpdate = {};
    // Add validation/parsing (e.g., ensure numbers are numbers)
    if (thresholdViews !== undefined) dataToUpdate[NOCODB_THRESHOLD_VIEWS_COLUMN || 'threshold_views'] = parseInt(thresholdViews, 10) || 0;
    if (thresholdLikes !== undefined) dataToUpdate[NOCODB_THRESHOLD_LIKES_COLUMN || 'threshold_likes'] = parseInt(thresholdLikes, 10) || 0;
    if (thresholdComments !== undefined) dataToUpdate[NOCODB_THRESHOLD_COMMENTS_COLUMN || 'threshold_comments'] = parseInt(thresholdComments, 10) || 0;
    if (thresholdVelocity !== undefined) dataToUpdate[NOCODB_THRESHOLD_VELOCITY_COLUMN || 'threshold_velocity'] = parseInt(thresholdVelocity, 10) || 0;
    if (filterChannels !== undefined) dataToUpdate[NOCODB_FILTER_CHANNELS_COLUMN || 'filter_channels'] = filterChannels;
    if (filterNiches !== undefined) dataToUpdate[NOCODB_FILTER_NICHES_COLUMN || 'filter_niches'] = filterNiches;
    if (filterHashtags !== undefined) dataToUpdate[NOCODB_FILTER_HASHTAGS_COLUMN || 'filter_hashtags'] = filterHashtags;

    try {
        if (Object.keys(dataToUpdate).length === 0) {
            return res.status(200).json({ message: 'No alert preferences provided to update.' });
        }

        const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);

        // Return only the updated preferences, not the whole user object
        const updatedPreferences = Object.keys(dataToUpdate).reduce((acc, key) => {
            // Use the original key from dataToUpdate map, which corresponds to the NocoDB column name
            acc[key] = updatedUser[key];
            return acc;
        }, {});

        res.status(200).json({
            message: 'Alert preferences updated successfully',
            preferences: updatedPreferences, // Send back updated values
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

    const { 
        templateTelegram, 
        templateDiscord, 
        templateEmailSubject, 
        templateEmailPreview 
    } = req.body;

    const dataToUpdate = {};
    if (templateTelegram !== undefined) dataToUpdate[NOCODB_TEMPLATE_TELEGRAM_COLUMN || 'alert_template_telegram'] = templateTelegram;
    if (templateDiscord !== undefined) dataToUpdate[NOCODB_TEMPLATE_DISCORD_COLUMN || 'alert_template_discord'] = templateDiscord;
    if (templateEmailSubject !== undefined) dataToUpdate[NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN || 'alert_template_email_subject'] = templateEmailSubject;
    if (templateEmailPreview !== undefined) dataToUpdate[NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN || 'alert_template_email_preview'] = templateEmailPreview;

    try {
        if (Object.keys(dataToUpdate).length === 0) {
            return res.status(200).json({ message: 'No alert templates provided to update.' });
        }
        const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);
        // Return only updated templates
         const updatedTemplates = Object.keys(dataToUpdate).reduce((acc, key) => {
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

module.exports = {
  updateUserPreferences,
  updateProfile,
  updateNotificationSettings,
  getNotificationSettings,
  getAlertPreferences,
  updateAlertPreferences,
  getAlertTemplates,
  updateAlertTemplates,
}; 