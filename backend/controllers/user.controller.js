const NocoDBService = require('../services/nocodb.service');
const SubscriptionLogicService = require('../services/subscriptionLogic.service');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const { sendToUser } = require('../services/websocket.service');
const { sendDiscordDM } = require('../services/discord.service');
const COLS = require('../config/nocodb_columns');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'); // ADD S3 Client & GetObjectCommand
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner'); // ADD S3 Presigner
const path = require('path');
const axios = require('axios');
const { sendEmail } = require('../services/email.service');

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

// --- Instantiate S3 Client ---
let s3Client;
const awsRegion = process.env.AWS_REGION;
const s3BucketName = process.env.S3_BUCKET_NAME;
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (awsRegion && s3BucketName && awsAccessKeyId && awsSecretAccessKey) {
    try {
        s3Client = new S3Client({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
            },
        });
        console.log(`AWS S3 client initialized for bucket: ${s3BucketName} in region ${awsRegion}.`);
    } catch (error) {
        console.error("FATAL ERROR: Failed to initialize AWS S3 client.", error);
        s3Client = null;
    }
} else {
    const missing = [
        !awsRegion && 'AWS_REGION',
        !s3BucketName && 'S3_BUCKET_NAME',
        !awsAccessKeyId && 'AWS_ACCESS_KEY_ID',
        !awsSecretAccessKey && 'AWS_SECRET_ACCESS_KEY',
    ].filter(Boolean).join(', ');
    console.warn(`WARN: AWS S3 client not initialized due to missing environment variables: ${missing}.`);
    s3Client = null;
}

// Log status immediately after initialization block
// console.log(`[user.controller module load] gcsBucket initialized: ${!!gcsBucket}`);

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
  
  // ADD LOG HERE
  console.log(`[updateNotificationSettings] Received request body:`, req.body);

  const { 
      notificationEmail,
      discordUserId, // ADD: Expect discordUserId now
      deliveryPreference, 
  } = req.body;

  const dataToUpdate = {};
  let emailChanged = false;
  let discordIdChanged = false; // ADD flag for discord change

  // Check if the notification email is being updated
  if (notificationEmail !== undefined) {
      dataToUpdate[COLS.NOTIF_EMAIL] = notificationEmail; // Use COLS constant
      // If email is changed, mark as unverified
      // Fetch current record to compare ONLY if email is in request
      try {
          const currentUserRecord = await NocoDBService.getUserRecordById(userId);
          if (currentUserRecord[COLS.NOTIF_EMAIL] !== notificationEmail) {
              dataToUpdate[COLS.EMAIL_VERIFIED] = false; // Reset verification status
              emailChanged = true; // Flag that email changed
              console.log(`Notification email changed for user ${userId}. Marked as unverified.`);
          }
      } catch (fetchError) {
          console.error(`[updateNotificationSettings] Error fetching user ${userId} to check email change:`, fetchError);
          // Proceed without resetting verification, or handle error differently?
          // Let's proceed cautiously and not reset if fetch fails
      }
  }

  // MODIFIED: Handle discordUserId instead of discordWebhookUrl
  if (discordUserId !== undefined) {
      dataToUpdate[COLS.DISCORD_USER_ID] = discordUserId; // Use COLS constant
      // If discordUserId changes, mark as unverified
      try {
          const currentUserRecord = await NocoDBService.getUserRecordById(userId);
          if (currentUserRecord[COLS.DISCORD_USER_ID] !== discordUserId) {
              dataToUpdate[COLS.DISCORD_VERIFIED] = false; // Reset verification status
              discordIdChanged = true; // Flag that ID changed
              console.log(`Discord User ID changed for user ${userId}. Marked as unverified.`);
          }
      } catch (fetchError) {
          console.error(`[updateNotificationSettings] Error fetching user ${userId} to check Discord ID change:`, fetchError);
      }
  }

  if (deliveryPreference !== undefined) {
      dataToUpdate[COLS.DELIVERY_PREF] = deliveryPreference; 
  }
  
  try {
    if (Object.keys(dataToUpdate).length === 0) {
       return res.status(200).json({ message: 'No notification settings provided to update.' });
    }

    // ADD LOG: Log the exact data being sent to NocoDB update
    console.log(`[updateNotificationSettings] Calling NocoDBService.updateUser with data:`, dataToUpdate);

    const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);

    // Send WebSocket notification if email or discord changed
    if ((emailChanged || discordIdChanged) && sendToUser) {
        if (emailChanged) {
             try {
                 await sendToUser(userId.toString(), { type: 'emailStatusUpdate', payload: { verified: false } });
             } catch(wsError) {
                  console.error(`[updateNotificationSettings] Error sending emailStatusUpdate WS notification for user ${userId}:`, wsError);
             }
        }
         if (discordIdChanged) {
             try {
                 await sendToUser(userId.toString(), { type: 'discordStatusUpdate', payload: { verified: false } });
             } catch(wsError) {
                  console.error(`[updateNotificationSettings] Error sending discordStatusUpdate WS notification for user ${userId}:`, wsError);
             }
         }
    }

    const passwordColumn = process.env.NOCODB_PASSWORD_COLUMN || 'password';
    const { [passwordColumn]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Notification settings updated successfully',
      user: userWithoutPassword, 
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
        
        const notificationSettings = {
            telegramChatId: userRecord[NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'] ?? null,
            discordUserId: userRecord[COLS.DISCORD_USER_ID] ?? null, 
            deliveryPreference: userRecord[COLS.DELIVERY_PREF] ?? 'Instantly',
            emailVerified: userRecord[COLS.EMAIL_VERIFIED] ?? false,
            telegramVerified: userRecord[NOCODB_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified'] ?? false,
            discordVerified: userRecord[COLS.DISCORD_VERIFIED] ?? false,
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
        // MODIFIED: Use discordUserId and sendDiscordDM
        const discordUserId = userRecord[COLS.DISCORD_USER_ID];
        const discordVerified = userRecord[COLS.DISCORD_VERIFIED];
        const template = userRecord[NOCODB_TEMPLATE_DISCORD_COLUMN || 'alert_template_discord'] || defaultTemplates.templateDiscord;

        if (!discordUserId || !discordVerified) { // Check for ID and verified status
            return res.status(400).json({ message: 'Discord User ID not configured or not verified.' });
        }

        const messageToSend = formatMessage(template, sampleData);
        const dmSent = await sendDiscordDM(discordUserId, messageToSend);

        if (dmSent) {
             successMessage = `Test message sent to your Discord DMs (User ID: ${discordUserId}).`;
        } else {
             return res.status(500).json({ message: 'Failed to send test message to Discord DM. Bot might be blocked or DMs disabled.' });
        }

    } else if (channelType === 'email') {
        // MODIFIED: Prioritize notification email, fallback to primary
        const notificationEmail = userRecord[COLS.NOTIF_EMAIL];
        const primaryEmail = userRecord[COLS.EMAIL]; 
        const emailToSendTo = notificationEmail || primaryEmail;

        const subjectTemplate = userRecord[NOCODB_TEMPLATE_EMAIL_SUBJECT_COLUMN || 'alert_template_email_subject'] || defaultTemplates.templateEmailSubject;
        // Note: Email preview text is less relevant for test, body needs formatting
        // const previewTemplate = userRecord[NOCODB_TEMPLATE_EMAIL_PREVIEW_COLUMN || 'alert_template_email_preview'] || defaultTemplates.templateEmailPreview;

        // Check if an email exists to send to
        if (!emailToSendTo) {
            return res.status(400).json({ message: 'Notification email not configured and primary email missing.' });
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
        // Requires configuration in email.service.js
        try {
            await sendEmail({
                 to: emailToSendTo, // Use the determined email address
                 subject: subject,
                 html: body,
                 text: `Test Trend Alert: ${sampleData.video_title}` // Simple text fallback
            });
            successMessage = `Test email sent to ${emailToSendTo}.`;
        } catch (sendError) {
            console.error('Email send error:', sendError);
            return res.status(500).json({ message: `Failed to send test email: ${sendError.message}` });
        }
        // --- END OF EMAIL SENDING --- 

        // Placeholder success for now - REMOVED as we now attempt actual sending
        /*
        console.log(`--- SIMULATING Email Send --- 
To: ${emailToSendTo} // Updated to show correct target
Subject: ${subject}
Body: ${body}
---`);
        successMessage = `Test message simulated for Email (${emailToSendTo}). Check server console.`;
        */
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
  console.log(`[sendTelegramVerificationCode] Received chatId: >>>${chatId}<<< Type: ${typeof chatId}`); // <-- ADD THIS LOG
  if (!chatId || typeof chatId !== 'string' || !/^-?\d+$/.test(chatId)) {
    console.error(`[sendTelegramVerificationCode] Invalid chatId format received: ${chatId}`); // <-- ADD ERROR LOG
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
      [NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_verification_code_expire']: expiryDate.toISOString(),
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
        const expiryString = userRecord[NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_verification_code_expire'];
        // --- FIX: Use consistent column name logic --- 
        const storedChatId = userRecord[process.env.NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id']; 

        // Check if code, expiry, AND chatId were successfully stored before proceeding
        if (!storedCode || !expiryString || !storedChatId) {
             console.error(`[verifyTelegramCode] Missing verification data for user ${userId}. Code: ${!!storedCode}, Expiry: ${!!expiryString}, ChatID: ${!!storedChatId}`);
             return res.status(400).json({ message: 'Verification process not initiated or chat ID missing. Please request a code first.' });
        }

        // 2. Check Expiry
        const expiryDate = new Date(expiryString);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            // --- IMPROVEMENT: Always clear expired code --- 
            await NocoDBService.updateUser(userId, { 
                [NOCODB_TELEGRAM_CODE_COLUMN]: null,
                [NOCODB_TELEGRAM_EXPIRY_COLUMN]: null
            });
             console.log(`Cleared expired telegram verification code for user ${userId}.`);
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
            [NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_verification_code_expire']: null,   // Clear expiry
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
         if (sendToUser) { // Check if sendToUser was imported correctly
            try {
                const notified = sendToUser(userId.toString(), { // Use sendToUser directly
                    type: 'telegramStatusUpdate', 
                    payload: { 
                        verified: true, 
                        chatId: storedChatId 
                    }
                });
                if (notified) {
                    console.log(`[verifyTelegramCode] WebSocket notification sent to user ${userId}.`);
                } else {
                    console.warn(`[verifyTelegramCode] User ${userId} not found for WebSocket notification.`);
                }
            } catch (wsError) {
                 console.error(`[verifyTelegramCode] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
         } else {
             console.error('[verifyTelegramCode] sendToUser function is not available from websocket.service.js');
         }

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
        // Fetch current user data to potentially notify them
        // FIX: Use getUserRecordById instead of getUserById
        const user = await NocoDBService.getUserRecordById(userId);
        const chatId = user[NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'];

        // Prepare data for update
        const dataToUpdate = {
            [NOCODB_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id']: null,
            [NOCODB_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified']: false,
            [NOCODB_TELEGRAM_CODE_COLUMN || 'telegram_verification_code']: null,
            [NOCODB_TELEGRAM_EXPIRY_COLUMN || 'telegram_code_expiry']: null,
        };

        // Update user record in NocoDB
        const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);

        // Notify the user via WebSocket AFTER successful update
        if (sendToUser) {
             try { 
                await sendToUser(userId.toString(), { // Use sendToUser directly
                    type: 'NOTIFICATION',
                    payload: {
                        message: 'Telegram account disconnected successfully.',
                        status: 'success'
                    }
                });
             } catch (wsError) { 
                 console.error(`[disconnectTelegram] Error sending WebSocket notification for user ${userId}:`, wsError);
             }
        } 

        res.status(200).json({ message: 'Telegram account disconnected successfully.' });

    } catch (error) {
        console.error(`Error disconnecting Telegram for user ${userId}:`, error);
        next(new Error('Failed to disconnect Telegram account due to a server error.')); 
    }
};

/**
 * @desc    Update user profile photo using Google Cloud Storage
 * @route   PUT /api/users/profile/photo
 * @access  Private
 */
const updateProfilePhoto = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    // Check if S3 is configured
    // if (!gcsBucket) { // Check S3 Client instead
    if (!s3Client || !s3BucketName) {
        // console.error(`[updateProfilePhoto] GCS Bucket not configured for user ${userId}. Check GCS_BUCKET_NAME and credentials.`);
        console.error(`[updateProfilePhoto] S3 Client or Bucket Name not configured for user ${userId}. Check AWS env vars.`);
        // return next(new Error('Server configuration error: Cloud Storage is not set up.'));
        return next(new Error('Server configuration error: File Storage is not set up.'));
    }

    // Check if file was uploaded (req.file comes from multer memoryStorage)
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded or file type rejected.' });
    }
    if (!req.file.buffer) {
         return res.status(400).json({ message: 'File buffer is missing.' });
    }
    // Add detailed check for originalname early
    if (!req.file.originalname) {
        console.error(`[updateProfilePhoto] req.file.originalname is missing for user ${userId}. File details:`, req.file);
        return res.status(400).json({ message: 'File metadata (originalname) is missing.' });
    }


    try {
        // --- DETAILED LOGGING ---
        // console.log(`[updateProfilePhoto Debug] Start processing for user: ${userId}`);
        // console.log(`[updateProfilePhoto Debug] req.file.originalname: ${req.file.originalname}`);
        const fileExtension = path.extname(req.file.originalname);
        // console.log(`[updateProfilePhoto Debug] fileExtension: ${fileExtension}`);
        const timestamp = Date.now();
        // console.log(`[updateProfilePhoto Debug] timestamp: ${timestamp}`);
        // console.log(`[updateProfilePhoto Debug] Constructing gcsFileName with: user-${userId}-${timestamp}${fileExtension}`);
        // --- END DETAILED LOGGING ---

        // Create a unique filename for GCS
        // const gcsFileName = `avatars/user-${userId}-${timestamp}${fileExtension}`;
        // const file = gcsBucket.file(gcsFileName);
        // Create a unique key (path) for S3
        const s3Key = `avatars/user-${userId}-${timestamp}${fileExtension}`;


        // console.log(`[updateProfilePhoto] Uploading ${gcsFileName} to bucket ${process.env.GCS_BUCKET_NAME}...`);
        console.log(`[updateProfilePhoto] Uploading ${s3Key} to bucket ${s3BucketName}...`);

        // Upload the file buffer to GCS
        /* REMOVE GCS UPLOAD
        await file.save(req.file.buffer, {
            metadata: {
                contentType: req.file.mimetype,
                // Optional: Add cache control for browsers
                // cacheControl: 'public, max-age=31536000',
            },
            // Make the file publicly readable - REMOVED because bucket has Uniform access
            // public: true,
            // Explicitly set predefined ACL to publicRead - REMOVED due to Org Policy
            // predefinedAcl: 'publicRead',
        });
        */

        // --- UPLOAD TO S3 ---
        const command = new PutObjectCommand({
            Bucket: s3BucketName,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            // Add ACL if your bucket is NOT blocking public ACLs and you WANT public reads
            // ACL: 'public-read', // Or use bucket policy / CloudFront instead
            // Optional: Add cache control for browsers
            // CacheControl: 'public, max-age=31536000',
        });
        await s3Client.send(command);
        // --- END UPLOAD TO S3 ---

        // --- SAVE OBJECT PATH, NOT PUBLIC URL ---\n        // Construct the object path\n        // const objectPath = gcsFileName; // e.g., avatars/user-1-1745353625918.jpg
        // Construct the S3 object key (which is the path)
        const objectPath = s3Key;
        // Get the public URL (still useful for logging maybe, but don't save)\n        // const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${gcsFileName}`;\n
        // console.log(`[updateProfilePhoto] File uploaded to GCS for user ${userId}. Path: ${objectPath}`);
        console.log(`[updateProfilePhoto] File uploaded to S3 for user ${userId}. Key: ${objectPath}`);

        // Prepare data for NocoDB update - SAVE THE PATH
        const photoUrlColumn = NOCODB_PROFILE_PHOTO_URL_COLUMN || 'profile_photo_url';
        const dataToUpdate = {
            [photoUrlColumn]: objectPath // Save the S3 object key
        };
        // console.log(`[updateProfilePhoto Debug] Data to update NocoDB:`, dataToUpdate);

        // Update the user record in NocoDB
        const updatedUser = await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`[updateProfilePhoto] Updated NocoDB profile photo PATH for user ${userId}`);

        // Respond with success and the *path* (frontend will need to fetch signed URL)
        res.status(200).json({
            message: 'Profile photo updated successfully',
            photoPath: objectPath, // Send back the object path
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

/**
 * @desc    Get a temporary signed URL for the user's profile photo
 * @route   GET /api/users/avatar-url
 * @access  Private
 */
const getAvatarSignedUrl = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    // Check if GCS client is ready
    // if (!gcsBucket) {
    // Check if S3 client is ready
    if (!s3Client || !s3BucketName) {
        // console.error(`[getAvatarSignedUrl] GCS Bucket not configured for user ${userId}.`);
        console.error(`[getAvatarSignedUrl] S3 Client or Bucket Name not configured for user ${userId}.`);
        // Return a generic error or potentially a fallback URL
        return res.status(503).json({ message: 'Storage service unavailable.', signedUrl: null });
    }

    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) {
             return res.status(404).json({ message: 'User not found', signedUrl: null });
        }

        const objectPath = userRecord[NOCODB_PROFILE_PHOTO_URL_COLUMN || 'profile_photo_url'];

        if (!objectPath || typeof objectPath !== 'string' || objectPath.trim() === '') {
            // No avatar path stored for the user
            console.log(`[getAvatarSignedUrl] No avatar path found for user ${userId}.`);
            return res.status(200).json({ signedUrl: null }); // Indicate no specific avatar
        }

        // console.log(`[getAvatarSignedUrl] Generating signed URL for user ${userId}, path: ${objectPath}`);
        console.log(`[getAvatarSignedUrl] Generating S3 signed URL for user ${userId}, key: ${objectPath}`);

        // --- REMOVE GCS SIGNED URL GENERATION ---
        /*
        // Generate the signed URL
        const options = {
            version: 'v4', // Recommended version
            action: 'read', // We only need to read the image
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes expiry
        };

        const [signedUrl] = await gcsBucket.file(objectPath).getSignedUrl(options);
        */
        // --- END REMOVE GCS SIGNED URL GENERATION ---

        // --- GENERATE S3 PRESIGNED URL ---
        const command = new GetObjectCommand({ // Use GetObjectCommand for reading
             Bucket: s3BucketName,
             Key: objectPath,
        });
        const signedUrl = await getSignedUrl(s3Client, command, {
             expiresIn: 15 * 60, // Expires in 15 minutes (900 seconds)
        });
        // --- END GENERATE S3 PRESIGNED URL ---

        console.log(`[getAvatarSignedUrl] Generated URL for user ${userId}: ${signedUrl.substring(0, 100)}...`); // Log start of URL

        res.status(200).json({ signedUrl: signedUrl });

    } catch (error) {
        console.error(`[getAvatarSignedUrl] Error generating signed URL for user ${userId}, path: ${objectPath}:`, error);
        // Don't expose detailed errors, return a generic failure or null
        res.status(500).json({ message: 'Could not retrieve avatar URL.', signedUrl: null });
        // Note: `next(error)` could also be used if you want the central handler
    }
};

// --- Verification Code Generation Helper ---
const generateVerificationCode = (length = 6) => {
    return crypto.randomInt(10**(length-1), (10**length)-1).toString();
};

// --- Send Email Verification Code ---
const sendEmailVerificationCode = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // MODIFIED: Prioritize notification email, fallback to primary
        const notificationEmail = userRecord[COLS.NOTIF_EMAIL];
        const primaryEmail = userRecord[COLS.EMAIL];
        const emailToSendTo = notificationEmail || primaryEmail; // Use notification email if set, else primary
        
        if (!emailToSendTo) {
             return res.status(400).json({ message: 'Notification email address not set and primary email missing.' });
        }

        const verificationCode = generateVerificationCode();
        const expiryMinutes = 10;
        const expiryDate = new Date(Date.now() + expiryMinutes * 60000);

        const dataToUpdate = {
            [COLS.EMAIL_VERIFICATION_CODE]: verificationCode,
            [COLS.EMAIL_CODE_EXPIRY]: expiryDate.toISOString(),
            // DO NOT set verified to false here, only when email is changed or disconnected
            // [COLS.EMAIL_VERIFIED]: false 
        };
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`Stored email verification code for user ${userId}.`);

        // Send the email to the chosen address
        const subject = `Your Trendy Bot Verification Code: ${verificationCode}`;
        const textBody = `Your Trendy Bot verification code is: ${verificationCode}\n\nThis code will expire in ${expiryMinutes} minutes.`;
        const htmlBody = `<p>Your Trendy Bot verification code is: <strong>${verificationCode}</strong></p><p>This code will expire in ${expiryMinutes} minutes.</p>`;
        
        await sendEmail({ to: emailToSendTo, subject, text: textBody, html: htmlBody });
        console.log(`Sent verification code to email ${emailToSendTo} for user ${userId}.`);

        res.status(200).json({ message: `Verification code sent to ${emailToSendTo}. Please check your inbox (and spam folder).` });

    } catch (error) {
        console.error(`Error sending email verification code for user ${userId}:`, error);
        next(new Error('Failed to send email verification code.'));
    }
};

// --- Verify Email Code ---
const verifyEmailCode = async (req, res, next) => {
    const userId = req.userId;
    const { verificationCode } = req.body;

    if (!userId) return res.status(401).json({ message: 'Not authorized' });
    if (!verificationCode || typeof verificationCode !== 'string' || !/\d{6}/.test(verificationCode)) {
        return res.status(400).json({ message: 'Invalid verification code format. Expected 6 digits.' });
    }

    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) return res.status(404).json({ message: 'User not found' });

        const storedCode = userRecord[COLS.EMAIL_VERIFICATION_CODE];
        const expiryString = userRecord[COLS.EMAIL_CODE_EXPIRY];
        const userEmail = userRecord[COLS.EMAIL]; // Get email for confirmation

        if (!storedCode || !expiryString) {
            return res.status(400).json({ message: 'Verification process not initiated. Please request a code first.' });
        }

        const expiryDate = new Date(expiryString);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            // --- IMPROVEMENT: Always clear expired code --- 
            await NocoDBService.updateUser(userId, {
                [COLS.EMAIL_VERIFICATION_CODE]: null,
                [COLS.EMAIL_CODE_EXPIRY]: null
            });
            console.log(`Cleared expired email verification code for user ${userId}.`);
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (verificationCode !== storedCode) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        // Verification successful
        const dataToUpdate = {
            [COLS.EMAIL_VERIFIED]: true,
            // --- IMPROVEMENT: Always clear used code on success --- 
            [COLS.EMAIL_VERIFICATION_CODE]: null,
            [COLS.EMAIL_CODE_EXPIRY]: null,
        };
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`Email verification successful for user ${userId}.`);

        // --- IMPROVEMENT: Send confirmation email --- 
        if (userEmail) {
            try {
                 await sendEmail({
                    to: userEmail,
                    subject: '✅ Email Verified Successfully with Trendy Bot',
                    text: 'Your email address has been successfully verified and connected for Trendy Bot notifications.',
                    html: '<p>✅ Your email address has been successfully verified and connected for Trendy Bot notifications.</p>'
                 });
                 console.log(`Sent email verification confirmation to ${userEmail} for user ${userId}.`);
            } catch (emailError) {
                 console.error(`Failed to send email confirmation for user ${userId}:`, emailError);
                 // Don't fail the main request if confirmation email fails
            }
        }

        res.status(200).json({ message: 'Email address verified successfully.' });

    } catch (error) {
        console.error(`Error verifying email code for user ${userId}:`, error);
        next(new Error('Failed to verify email code due to a server error.'));
    }
};

// --- Send Discord Verification Code ---
const sendDiscordVerificationCode = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) return res.status(404).json({ message: 'User not found' });

        // MODIFIED: Get Discord User ID instead of webhook
        const discordUserId = userRecord[COLS.DISCORD_USER_ID]; 
        if (!discordUserId) {
            return res.status(400).json({ message: 'Discord User ID is not configured for this account.' });
        }

        const verificationCode = generateVerificationCode();
        const expiryMinutes = 10;
        const expiryDate = new Date(Date.now() + expiryMinutes * 60000);

        const dataToUpdate = {
            [COLS.DISCORD_VERIFICATION_CODE]: verificationCode,
            [COLS.DISCORD_CODE_EXPIRY]: expiryDate.toISOString(),
            // [COLS.DISCORD_VERIFIED]: false // Don't reset verified here, only on ID change
        };
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`Stored Discord verification code for user ${userId}.`);

        // MODIFIED: Send code via DM using the service
        const messageText = `Your Trendy Bot verification code is: **${verificationCode}**\nThis code will expire in ${expiryMinutes} minutes.`;
        const dmSent = await sendDiscordDM(discordUserId, messageText);

        if (dmSent) {
            console.log(`Sent verification code DM to Discord User ID ${discordUserId} for user ${userId}.`);
            res.status(200).json({ message: `Verification code sent to your Discord DMs. Please check Discord.` });
        } else {
            console.error(`Failed to send Discord verification DM to user ${userId} (Discord ID: ${discordUserId}).`);
             // Let the user know it might have failed
             // Potentially revert the code storage or let verify handle it?
             // For now, inform the user. The verify step won't work if the code wasn't received.
             // Consider if NocoDB update should be reverted if DM fails.
            return res.status(500).json({ message: 'Failed to send verification code via Discord DM. Please ensure you haven\'t blocked the bot and have DMs enabled.' });
        }

    } catch (error) {
        console.error(`Error sending Discord verification code for user ${userId}:`, error);
        next(new Error('Failed to send Discord verification code.'));
    }
};

// --- Verify Discord Code ---
const verifyDiscordCode = async (req, res, next) => {
    const userId = req.userId;
    const { verificationCode } = req.body;

    if (!userId) return res.status(401).json({ message: 'Not authorized' });
    if (!verificationCode || typeof verificationCode !== 'string' || !/\d{6}/.test(verificationCode)) {
        return res.status(400).json({ message: 'Invalid verification code format. Expected 6 digits.' });
    }

    try {
        const userRecord = await NocoDBService.getUserRecordById(userId);
        if (!userRecord) return res.status(404).json({ message: 'User not found' });

        const storedCode = userRecord[COLS.DISCORD_VERIFICATION_CODE];
        const expiryString = userRecord[COLS.DISCORD_CODE_EXPIRY];
        const discordUserId = userRecord[COLS.DISCORD_USER_ID]; // Get User ID

        // MODIFIED: Check for User ID existence
        if (!storedCode || !expiryString || !discordUserId) { 
            return res.status(400).json({ message: 'Verification process not initiated or Discord User ID missing. Please request a code first.' });
        }

        const expiryDate = new Date(expiryString);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            await NocoDBService.updateUser(userId, {
                [COLS.DISCORD_VERIFICATION_CODE]: null,
                [COLS.DISCORD_CODE_EXPIRY]: null
            });
            console.log(`Cleared expired discord verification code for user ${userId}.`);
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (verificationCode !== storedCode) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        // Verification successful - Update NocoDB
        const dataToUpdate = {
            [COLS.DISCORD_VERIFIED]: true,
            [COLS.DISCORD_VERIFICATION_CODE]: null,
            [COLS.DISCORD_CODE_EXPIRY]: null,
        };
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`Discord verification successful for user ${userId}.`);

        // MODIFIED: Send confirmation via DM
        const confirmationMessage = '✅ Your Discord account has been successfully connected to Trendy Bot!';
        const confirmDmSent = await sendDiscordDM(discordUserId, confirmationMessage);
        if (confirmDmSent) {
             console.log(`Sent Discord confirmation DM for user ${userId}.`);
        } else {
             console.warn(`Failed to send Discord confirmation DM for user ${userId}.`);
             // Don't fail the request if confirmation sending fails
        }
        
        // Notify Frontend via WebSocket
        if (sendToUser) {
            try {
                await sendToUser(userId.toString(), { // Use sendToUser directly
                    type: 'discordStatusUpdate', 
                    payload: { verified: true }
                });
            } catch (wsError) {
                console.error(`[verifyDiscordCode] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
        }

        res.status(200).json({ message: 'Discord account verified successfully.' }); // Changed message slightly

    } catch (error) {
        console.error(`Error verifying Discord code for user ${userId}:`, error);
        next(new Error('Failed to verify Discord code due to a server error.'));
    }
};

// --- Disconnect Discord ---
const disconnectDiscord = async (req, res, next) => {
     const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    try {
        // MODIFIED: Clear discordUserId instead of webhook
        await NocoDBService.updateUser(userId, {
            [COLS.DISCORD_USER_ID]: null, // Clear User ID
            [COLS.DISCORD_VERIFIED]: false,
            [COLS.DISCORD_VERIFICATION_CODE]: null,
            [COLS.DISCORD_CODE_EXPIRY]: null,
            // Optionally clear webhook too if it exists?
            // [COLS.DISCORD_WEBHOOK]: null 
        });
        console.log(`Cleared Discord connection info for user ${userId}.`);
        
        // Notify Frontend via WebSocket
        if (sendToUser) {
            try {
               await sendToUser(userId.toString(), { type: 'discordStatusUpdate', payload: { verified: false } }); // Use sendToUser directly
            } catch (wsError) {
                console.error(`[disconnectDiscord] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
        }

        res.status(200).json({ message: 'Discord account disconnected successfully.' }); // Changed message slightly
    } catch (error) {
        console.error(`Error disconnecting Discord for user ${userId}:`, error);
        next(new Error('Failed to disconnect Discord webhook.'));
    }
};

// --- Disconnect Email ---
const disconnectEmail = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    try {
        // MODIFIED: Clear email address instead of webhook
        await NocoDBService.updateUser(userId, {
            [COLS.NOTIF_EMAIL]: null, // Clear email address
            [COLS.EMAIL_VERIFIED]: false, // Clear verification status
            [COLS.EMAIL_VERIFICATION_CODE]: null, // Clear verification code
            [COLS.EMAIL_CODE_EXPIRY]: null, // Clear expiry
        });
        console.log(`Cleared email connection info for user ${userId}.`);
        
        // Notify Frontend via WebSocket
        if (sendToUser) {
            try {
               await sendToUser(userId.toString(), { type: 'emailStatusUpdate', payload: { verified: false } }); // Use sendToUser directly
            } catch (wsError) {
                console.error(`[disconnectEmail] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
        }

        res.status(200).json({ message: 'Email connection disconnected successfully.' }); // Changed message slightly
    } catch (error) {
        console.error(`Error disconnecting email for user ${userId}:`, error);
        next(new Error('Failed to disconnect email.'));
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
  deleteAccount,
  getAvatarSignedUrl,
  sendEmailVerificationCode,
  verifyEmailCode,
  sendDiscordVerificationCode,
  verifyDiscordCode,
  disconnectDiscord,
  disconnectEmail
}; 