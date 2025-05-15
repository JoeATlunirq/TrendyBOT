const { supabase, isSupabaseReady } = require('../services/supabase.service');
// const SubscriptionLogicService = require('../services/subscriptionLogic.service'); // Assess if still needed
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const { sendToUser } = require('../services/websocket.service');
const { sendDiscordDM } = require('../services/discord.service');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const { sendEmail } = require('../services/email.service');

const USERS_TABLE = 'Users';

// --- Supabase Column Name Constants ---
// YOU MUST HAVE VERIFIED THESE AND REPLACED WITH YOUR ACTUAL SUPABASE SCHEMA NAMES
const USER_COL_ID = 'id';
const USER_COL_ONBOARDING_COMPLETE = 'onboarding_complete';
const USER_COL_NICHE = 'niche';
const USER_COL_NOTIFICATION_CHANNELS = 'notification_channels'; // Expects JSON array or JSON string if column is text
const USER_COL_NOTIFICATION_EMAIL = 'notification_email'; 
const USER_COL_NOTIFICATION_TELEGRAM = 'notification_telegram'; 
const USER_COL_NOTIFICATION_DISCORD = 'DISCORD_USER_ID'; 
const USER_COL_NAMES = 'Names'; 
const USER_COL_COMPANY_NAME = 'company_name';
const USER_COL_PROFILE_PHOTO_URL = 'profile_photo_url'; // Stores S3 Key
const USER_COL_TELEGRAM_CHAT_ID = 'TELEGRAM_CHAT_ID';
const USER_COL_DELIVERY_PREFERENCE = 'delivery_preference';
const USER_COL_THRESHOLD_VIEWS = 'threshold_views';
const USER_COL_THRESHOLD_LIKES = 'threshold_likes';
const USER_COL_THRESHOLD_COMMENTS = 'threshold_comments';
const USER_COL_THRESHOLD_VELOCITY = 'threshold_velocity';
const USER_COL_FILTER_CHANNELS = 'filter_channels'; // Expects JSON array or JSON string
const USER_COL_ALERT_TEMPLATE_TELEGRAM = 'alert_template_telegram';
const USER_COL_ALERT_TEMPLATE_DISCORD = 'alert_template_discord';
const USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT = 'alert_template_email_subject';
const USER_COL_ALERT_TEMPLATE_EMAIL_PREVIEW = 'alert_template_email_preview';
const USER_COL_TELEGRAM_VERIFIED = 'telegram_verified';
const USER_COL_TELEGRAM_VERIFICATION_CODE = 'telegram_verification_code';
const USER_COL_TELEGRAM_CODE_EXPIRY = 'telegram_verification_code_expire';
const USER_COL_PASSWORD = 'Passwords'; 
const USER_COL_EMAIL = 'Emails'; 
const USER_COL_TWO_FACTOR_SECRET = 'two_factor_secret'; 
const USER_COL_IS_2FA_ENABLED = 'is_two_factor_enabled'; 
const USER_COL_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT = 'threshold_relative_view_performance_percent';
const USER_COL_THRESHOLD_RELATIVE_VIEW_METRIC = 'threshold_relative_view_metric';
const USER_COL_THRESHOLD_VIEWS_TIME_WINDOW_HOURS = 'threshold_views_time_window_hours';
const USER_COL_THRESHOLD_LIKES_TIME_WINDOW_HOURS = 'threshold_likes_time_window_hours';
const USER_COL_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS = 'threshold_comments_time_window_hours';
const USER_COL_EMAIL_VERIFIED = 'email_verified';
const USER_COL_DISCORD_USER_ID = 'DISCORD_USER_ID'; // Ensure exact Supabase name (case-sensitive?)
const USER_COL_DISCORD_VERIFIED = 'discord_verified';
const USER_COL_EMAIL_VERIFICATION_CODE = 'email_verification_code';
const USER_COL_EMAIL_CODE_EXPIRY = 'email_verification_code_expire'; // Corrected: was email_verification_code_expiry
const USER_COL_DISCORD_VERIFICATION_CODE = 'discord_verification_code';
const USER_COL_DISCORD_CODE_EXPIRY = 'discord_verification_code_expire'; // Corrected: was discord_verification_code_expiry

const defaultTemplates = {
    templateTelegram: "🔥 TRENDING: {video_title}\n\n📈 {views} views • {likes} likes • {comments} comments\n\n👤 {channel_name}\n\n🕒 Posted {time_ago}\n\n👉 {video_url}",
    templateDiscord: "**🔥 TRENDING VIDEO ALERT 🔥**\n\n**Title:** {video_title}\n**Channel:** {channel_name}\n\n**Stats:** 📈 {views} views | 👍 {likes} likes | 💬 {comments} comments\n**Posted:** {time_ago}\n\n{video_url}",
    templateEmailSubject: "🔥 New Trending Shorts Alert from Trendy",
    templateEmailPreview: "A new video is trending: {video_title}"
};

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

/**
 * @desc    Update user onboarding preferences and mark onboarding complete
 * @route   PUT /api/users/preferences
 * @access  Private (requires authentication)
 */
const updateUserPreferences = async (req, res, next) => {
  const userId = req.userId; 
  if (!userId) {
    return res.status(401).json({ message: 'Not authorized, user ID missing' });
  }
  if (!isSupabaseReady()) {
    console.error('[UserPreferences] Supabase client not ready.');
    return res.status(503).json({ message: 'Server is temporarily unavailable.' });
  }

  const { 
    niche, 
    selectedChannels, 
    channelInputs,    
  } = req.body;

  const dataToUpdate = {};

  if (niche !== undefined) {
      // dataToUpdate[USER_COL_NICHE] = niche; // Column USER_COL_NICHE ('niche') not in provided Users schema
  }
  if (selectedChannels !== undefined && Array.isArray(selectedChannels)) {
      // Assuming Supabase column is JSON/JSONB:
      // dataToUpdate[USER_COL_NOTIFICATION_CHANNELS] = selectedChannels; // Column USER_COL_NOTIFICATION_CHANNELS ('notification_channels') not in provided Users schema
  }
  if (channelInputs !== undefined && typeof channelInputs === 'object') {
      if (channelInputs.email !== undefined) {
          dataToUpdate[USER_COL_EMAIL] = channelInputs.email; // Changed from USER_COL_NOTIFICATION_EMAIL to USER_COL_EMAIL (actual schema column 'Emails')
      }
       if (channelInputs.telegram !== undefined) {
          // dataToUpdate[USER_COL_NOTIFICATION_TELEGRAM] = channelInputs.telegram; // Column USER_COL_NOTIFICATION_TELEGRAM ('notification_telegram') not in provided Users schema
      }
       if (channelInputs.discord !== undefined) {
          dataToUpdate[USER_COL_NOTIFICATION_DISCORD] = channelInputs.discord;
      }
  }
  // dataToUpdate[USER_COL_ONBOARDING_COMPLETE] = true; // Column USER_COL_ONBOARDING_COMPLETE ('onboarding_complete') not in provided Users schema

  try {
    // const hasActualPreferences = Object.keys(dataToUpdate).some(key => key !== USER_COL_ONBOARDING_COMPLETE && dataToUpdate[key] !== undefined);
    // if (!hasActualPreferences && !(Object.keys(dataToUpdate).length === 1 && dataToUpdate[USER_COL_ONBOARDING_COMPLETE] === true) ){
    // Updated logic: Check if any data is being sent for update. If onboarding_complete was the only field, this check might need adjustment.
    let updateAttempted = false;
    for (const key in dataToUpdate) {
        // if (key !== USER_COL_ONBOARDING_COMPLETE) { // If USER_COL_ONBOARDING_COMPLETE is removed, this condition simplifies
            updateAttempted = true;
            break;
        // }
    }
    // if (!updateAttempted && Object.keys(dataToUpdate).length === 1 && dataToUpdate[USER_COL_ONBOARDING_COMPLETE]) {
        // Only setting onboarding_complete, that's okay.
    // } else 
    if (!updateAttempted && Object.keys(dataToUpdate).length === 0) { // If dataToUpdate ends up empty after commenting out fields
        return res.status(400).json({ message: 'No preference data provided to update, or columns not available in schema.' });
    }

    const { data: updatedUser, error } = await supabase
      .from(USERS_TABLE)
      .update(dataToUpdate)
      .eq(USER_COL_ID, userId)
      .select() 
      .single();

    if (error) {
        console.error('[UserPreferences] Error updating user preferences in Supabase:', error.message);
        return next(error); 
    }
    if (!updatedUser) {
        console.error('[UserPreferences] Failed to update preferences: user not found after update or no data returned.');
        return res.status(404).json({ message: 'Failed to update preferences, user not found or update did not return data.'});
    }

    const { [USER_COL_PASSWORD]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Preferences updated successfully',
      user: userWithoutPassword,
    });

  } catch (error) {
    console.error('Update Preferences Error (Outer Catch):', error.message);
    next(error); 
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
  if (!isSupabaseReady()) {
    console.error('[UpdateProfile] Supabase client not ready.');
    return res.status(503).json({ message: 'Server is temporarily unavailable.' });
  }

  const nameValue = req.body[USER_COL_NAMES];
  const companyValue = req.body[USER_COL_COMPANY_NAME];

  const dataToUpdate = {};
  if (nameValue !== undefined) {
      dataToUpdate[USER_COL_NAMES] = nameValue;
  }
  if (companyValue !== undefined) {
      dataToUpdate[USER_COL_COMPANY_NAME] = companyValue;
  }

  try {
    if (Object.keys(dataToUpdate).length === 0) {
       return res.status(200).json({ message: 'No profile data provided to update.' }); 
    }

    const { data: updatedUser, error } = await supabase
        .from(USERS_TABLE)
        .update(dataToUpdate)
        .eq(USER_COL_ID, userId)
        .select()
        .single();
    
    if (error) {
        console.error(`[UpdateProfile] Supabase update failed for user ${userId}:`, error.message);
        return next(error);
    }
    if (!updatedUser) {
        console.error(`[UpdateProfile] Supabase update returned no data for user ${userId}. User might not exist or RLS issue.`);
        return res.status(404).json({ message: 'Profile update failed, user not found or no data returned.'});
    }
    // console.log(`[UpdateProfile] Supabase update successful for user ${userId}.`);

    const { [USER_COL_PASSWORD]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Profile updated successfully',
      user: userWithoutPassword, // Send back updated user info (reflecting DB state)
    });

  } catch (error) {
    // Catch any other unexpected errors
    console.error(`[UpdateProfile] Outer catch error for user ${userId}:`, error.message); 
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
  if (!isSupabaseReady()) {
    console.error('[UpdateNotificationSettings] Supabase client not ready.');
    return res.status(503).json({ message: 'Server is temporarily unavailable.' });
  }
  
  console.log(`[updateNotificationSettings] Received request body:`, req.body);

  const { 
      notificationEmail, // This is the new email value from request body
      discordUserId, 
      deliveryPreference, 
  } = req.body;

  const dataToUpdate = {};
  let emailChanged = false;
  let discordIdChanged = false;

  try {
    // Fetch current user record from Supabase to compare existing values
    const { data: currentUserRecord, error: fetchError } = await supabase
      .from(USERS_TABLE)
      .select(`${USER_COL_EMAIL}, ${USER_COL_DISCORD_USER_ID}`)
      .eq(USER_COL_ID, userId)
      .single();

    if (fetchError) {
      console.error(`[updateNotificationSettings] Error fetching user ${userId} from Supabase:`, fetchError.message);
      // Decide if we should proceed or return. For now, let's not update if we can't check current values.
      return res.status(500).json({ message: 'Could not retrieve current user settings.' });
    }
    if (!currentUserRecord) {
        return res.status(404).json({ message: 'User not found.'});
    }

    if (notificationEmail !== undefined) {
      dataToUpdate[USER_COL_EMAIL] = notificationEmail; 
      if (currentUserRecord[USER_COL_EMAIL] !== notificationEmail) {
          dataToUpdate[USER_COL_EMAIL_VERIFIED] = false; 
          emailChanged = true; 
          console.log(`Notification email changed for user ${userId}. Marked as unverified.`);
      }
    }

    if (discordUserId !== undefined) {
      dataToUpdate[USER_COL_DISCORD_USER_ID] = discordUserId; 
      if (currentUserRecord[USER_COL_DISCORD_USER_ID] !== discordUserId) {
          dataToUpdate[USER_COL_DISCORD_VERIFIED] = false; 
          discordIdChanged = true; 
          console.log(`Discord User ID changed for user ${userId}. Marked as unverified.`);
      }
    }

    if (deliveryPreference !== undefined) {
      // Assuming USER_COL_DELIVERY_PREFERENCE ('delivery_preference') column exists in Supabase
      dataToUpdate[USER_COL_DELIVERY_PREFERENCE] = deliveryPreference; 
    }
  
    if (Object.keys(dataToUpdate).length === 0) {
       return res.status(200).json({ message: 'No notification settings provided to update.' });
    }

    console.log(`[updateNotificationSettings] Calling Supabase to update user ${userId} with data:`, dataToUpdate);

    const { data: updatedUser, error: updateError } = await supabase
      .from(USERS_TABLE)
      .update(dataToUpdate)
      .eq(USER_COL_ID, userId)
      .select()
      .single();

    if (updateError) {
        console.error(`[UpdateNotificationSettings] Supabase update failed for user ${userId}:`, updateError.message);
        return next(updateError);
    }
    if (!updatedUser) {
        console.error(`[UpdateNotificationSettings] Supabase update returned no data for user ${userId}.`);
        return res.status(404).json({ message: 'Notification settings update failed, user not found or no data returned.'});
    }

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

    const { [USER_COL_PASSWORD]: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Notification settings updated successfully',
      user: userWithoutPassword, 
    });

  } catch (error) {
    console.error('[UpdateNotificationSettings] Outer catch error:', error.message);
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
    if (!isSupabaseReady()) {
        console.error('[GetNotificationSettings] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        const { data: userRecord, error } = await supabase
            .from(USERS_TABLE)
            .select(`${USER_COL_TELEGRAM_CHAT_ID}, ${USER_COL_DISCORD_USER_ID}, ${USER_COL_DELIVERY_PREFERENCE}, ${USER_COL_EMAIL_VERIFIED}, ${USER_COL_TELEGRAM_VERIFIED}, ${USER_COL_DISCORD_VERIFIED}`)
            .eq(USER_COL_ID, userId)
            .single();

        if (error) {
            console.error('[GetNotificationSettings] Error fetching user from Supabase:', error.message);
            // Check for PGRST116 specifically for not found, though .single() should handle it gracefully
            if (error.code === 'PGRST116') { 
                return res.status(404).json({ message: 'User not found' });
            }
            return next(error);
        }
        
        if (!userRecord) { // Should be redundant if .single() throws error for no rows, but good practice
            return res.status(404).json({ message: 'User not found' });
        }
        
        const notificationSettings = {
            telegramChatId: userRecord[USER_COL_TELEGRAM_CHAT_ID] ?? null,
            discordUserId: userRecord[USER_COL_DISCORD_USER_ID] ?? null, 
            deliveryPreference: userRecord[USER_COL_DELIVERY_PREFERENCE] ?? 'Instantly', // Assumes 'delivery_preference' column exists
            emailVerified: userRecord[USER_COL_EMAIL_VERIFIED] ?? false,
            telegramVerified: userRecord[USER_COL_TELEGRAM_VERIFIED] ?? false,
            discordVerified: userRecord[USER_COL_DISCORD_VERIFIED] ?? false,
        };
        res.status(200).json(notificationSettings);

    } catch (error) {
        // Catch any other unexpected errors not caught by Supabase client
        console.error('[GetNotificationSettings] Outer catch error:', error.message);
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
    if (!isSupabaseReady()) {
        console.error('[GetAlertPreferences] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        // Define all columns to be selected for alert preferences
        const selectColumns = [
            USER_COL_THRESHOLD_VIEWS,
            USER_COL_THRESHOLD_LIKES,
            USER_COL_THRESHOLD_COMMENTS,
            USER_COL_THRESHOLD_VELOCITY,
            USER_COL_FILTER_CHANNELS,
            USER_COL_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT,
            USER_COL_THRESHOLD_RELATIVE_VIEW_METRIC,
            USER_COL_THRESHOLD_VIEWS_TIME_WINDOW_HOURS,
            USER_COL_THRESHOLD_LIKES_TIME_WINDOW_HOURS,
            USER_COL_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS
        ].join(', ');

        const { data: userRecord, error } = await supabase
            .from(USERS_TABLE)
            .select(selectColumns)
            .eq(USER_COL_ID, userId)
            .single();

        if (error) {
            console.error('[GetAlertPreferences] Error fetching user from Supabase:', error.message);
            if (error.code === 'PGRST116') { 
                return res.status(404).json({ message: 'User not found' });
            }
            return next(error);
        }

        if (!userRecord) {
             return res.status(404).json({ message: 'User not found' });
        }

        const getNumberOrNullFromRecord = (record, key, defaultValue = null) => {
            const val = record[key];
            if (val === null || val === undefined) return defaultValue;
            if (typeof val === 'number' && !isNaN(val)) return val;
            if (typeof val === 'string') {
                 const parsed = parseInt(val, 10);
                 if (!isNaN(parsed)) return parsed;
            }
            console.warn(`[getAlertPreferences] Invalid number format for ${key} in userRecord ${userId}, using default ${defaultValue}`);
            return defaultValue; 
        };
        const getNumberOrDefaultFromRecord = (record, key, defaultValue = 0) => {
            const val = getNumberOrNullFromRecord(record, key, defaultValue);
            return val === null ? defaultValue : val;
        };

        const preferences = {
            thresholdViews: getNumberOrDefaultFromRecord(userRecord, USER_COL_THRESHOLD_VIEWS, 3000000),
            thresholdLikes: getNumberOrDefaultFromRecord(userRecord, USER_COL_THRESHOLD_LIKES, 50000),
            thresholdComments: getNumberOrDefaultFromRecord(userRecord, USER_COL_THRESHOLD_COMMENTS, 450),
            thresholdVelocity: getNumberOrDefaultFromRecord(userRecord, USER_COL_THRESHOLD_VELOCITY, 500),
            filterChannels: userRecord[USER_COL_FILTER_CHANNELS] ?? "",
            thresholdRelativeViewPerformancePercent: getNumberOrNullFromRecord(userRecord, USER_COL_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT, null),
            thresholdRelativeViewMetric: userRecord[USER_COL_THRESHOLD_RELATIVE_VIEW_METRIC] ?? '30d_avg_views',
            thresholdViewsTimeWindowHours: getNumberOrNullFromRecord(userRecord, USER_COL_THRESHOLD_VIEWS_TIME_WINDOW_HOURS, null),
            thresholdLikesTimeWindowHours: getNumberOrNullFromRecord(userRecord, USER_COL_THRESHOLD_LIKES_TIME_WINDOW_HOURS, null),
            thresholdCommentsTimeWindowHours: getNumberOrNullFromRecord(userRecord, USER_COL_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS, null),
        };

        res.status(200).json(preferences);

    } catch (error) {
        console.error('[GetAlertPreferences] Outer catch error:', error.message);
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
    if (!isSupabaseReady()) {
        console.error('[UpdateAlertPreferences] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

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

    const dataToUpdate = {};

    const parseIntOrNull = (value) => {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    };
    const parseIntOrDefault = (value, defaultValue = 0) => {
        if (value === null || value === undefined) return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    };

    if (thresholdViews !== undefined) dataToUpdate[USER_COL_THRESHOLD_VIEWS] = parseIntOrDefault(thresholdViews, 0);
    if (thresholdLikes !== undefined) dataToUpdate[USER_COL_THRESHOLD_LIKES] = parseIntOrDefault(thresholdLikes, 0);
    if (thresholdComments !== undefined) dataToUpdate[USER_COL_THRESHOLD_COMMENTS] = parseIntOrDefault(thresholdComments, 0);
    if (thresholdVelocity !== undefined) dataToUpdate[USER_COL_THRESHOLD_VELOCITY] = parseIntOrDefault(thresholdVelocity, 0);
    if (filterChannels !== undefined) dataToUpdate[USER_COL_FILTER_CHANNELS] = filterChannels; 

    if (thresholdRelativeViewPerformancePercent !== undefined) {
        dataToUpdate[USER_COL_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT] = parseIntOrNull(thresholdRelativeViewPerformancePercent);
    }
    if (thresholdRelativeViewMetric !== undefined) {
        dataToUpdate[USER_COL_THRESHOLD_RELATIVE_VIEW_METRIC] = thresholdRelativeViewMetric;
    }
    if (thresholdViewsTimeWindowHours !== undefined) {
        dataToUpdate[USER_COL_THRESHOLD_VIEWS_TIME_WINDOW_HOURS] = parseIntOrNull(thresholdViewsTimeWindowHours);
    }
    if (thresholdLikesTimeWindowHours !== undefined) {
        dataToUpdate[USER_COL_THRESHOLD_LIKES_TIME_WINDOW_HOURS] = parseIntOrNull(thresholdLikesTimeWindowHours);
    }
    if (thresholdCommentsTimeWindowHours !== undefined) {
        dataToUpdate[USER_COL_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS] = parseIntOrNull(thresholdCommentsTimeWindowHours);
    }
    
    try {
        if (Object.keys(dataToUpdate).length === 0) {
            return res.status(400).json({ message: 'No valid alert preferences provided to update.' });
        }
        console.log('[UpdateAlertPreferences] Updating Supabase with data:', dataToUpdate);

        const { data: updatedUser, error } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId)
            .select(Object.keys(dataToUpdate).join(', ')) // Select only updated columns
            .single();

        if (error) {
            console.error('[UpdateAlertPreferences] Supabase update error:', error.message);
            return next(error);
        }
        if (!updatedUser) {
             console.error('[UpdateAlertPreferences] Supabase update returned no data.');
             return res.status(404).json({ message: 'Failed to update alert preferences, user not found or no data returned.' });
        }

        res.status(200).json({
            message: 'Alert preferences updated successfully',
            preferences: updatedUser, 
        });

    } catch (error) {
        console.error('[UpdateAlertPreferences] Outer catch error:', error.message);
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
    if (!isSupabaseReady()) {
        console.error('[GetAlertTemplates] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        const selectColumns = [
            USER_COL_ALERT_TEMPLATE_TELEGRAM,
            USER_COL_ALERT_TEMPLATE_DISCORD,
            USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT,
            USER_COL_ALERT_TEMPLATE_EMAIL_PREVIEW
        ].join(', ');

        const { data: userRecord, error } = await supabase
            .from(USERS_TABLE)
            .select(selectColumns)
            .eq(USER_COL_ID, userId)
            .single();

        if (error) {
            console.error('[GetAlertTemplates] Error fetching user from Supabase:', error.message);
            if (error.code === 'PGRST116') { 
                return res.status(404).json({ message: 'User not found' });
            }
            return next(error);
        }

        if (!userRecord) {
             return res.status(404).json({ message: 'User not found' });
        }
        
        const templates = {
             [USER_COL_ALERT_TEMPLATE_TELEGRAM]: 
                userRecord[USER_COL_ALERT_TEMPLATE_TELEGRAM] || defaultTemplates.templateTelegram,
             [USER_COL_ALERT_TEMPLATE_DISCORD]: 
                userRecord[USER_COL_ALERT_TEMPLATE_DISCORD] || defaultTemplates.templateDiscord,
             [USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT]: 
                userRecord[USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT] || defaultTemplates.templateEmailSubject,
             [USER_COL_ALERT_TEMPLATE_EMAIL_PREVIEW]: 
                userRecord[USER_COL_ALERT_TEMPLATE_EMAIL_PREVIEW] || defaultTemplates.templateEmailPreview,
        };

        res.status(200).json(templates);

    } catch (error) {
        console.error('[GetAlertTemplates] Outer catch error:', error.message);
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
    if (!isSupabaseReady()) {
        console.error('[UpdateAlertTemplates] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    const allowedKeys = [
        USER_COL_ALERT_TEMPLATE_TELEGRAM,
        USER_COL_ALERT_TEMPLATE_DISCORD,
        USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT,
        USER_COL_ALERT_TEMPLATE_EMAIL_PREVIEW
    ];

    const dataToUpdate = {};
    let hasValidData = false;

    for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
            dataToUpdate[key] = req.body[key];
            hasValidData = true;
        }
    }

    if (!hasValidData) {
        return res.status(400).json({ message: 'No valid alert template data provided to update.' });
    }

    try {
        console.log('[UpdateAlertTemplates] Updating Supabase with data:', dataToUpdate);
        const { data: updatedUser, error } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId)
            .select(Object.keys(dataToUpdate).join(', ')) // Select only updated columns
            .single();
        
        if (error) {
            console.error('[UpdateAlertTemplates] Supabase update error:', error.message);
            return next(error);
        }
        if (!updatedUser) {
            console.error('[UpdateAlertTemplates] Supabase update returned no data.');
            return res.status(404).json({ message: 'Failed to update alert templates, user not found or no data returned.' });
        }
        
        res.status(200).json({
            message: 'Alert templates updated successfully',
            templates: updatedUser, // updatedUser will contain only the selected (updated) fields
        });
    } catch (error) {
        console.error('[UpdateAlertTemplates] Outer catch error:', error.message);
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
  if (!isSupabaseReady()) {
    console.error('[SendTestNotification] Supabase client not ready.');
    return res.status(503).json({ message: 'Server is temporarily unavailable.' });
  }

  const { channelType } = req.body; 

  if (!channelType || !['telegram', 'discord', 'email'].includes(channelType)) {
    return res.status(400).json({ message: 'Invalid or missing channelType. Must be telegram, discord, or email.' });
  }

  try {
    let حواليToSelect = [
        USER_COL_ALERT_TEMPLATE_TELEGRAM,
        USER_COL_ALERT_TEMPLATE_DISCORD,
        USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT,
        USER_COL_EMAIL // For primary email
    ];
    if (channelType === 'telegram') {
        حواليToSelect.push(USER_COL_TELEGRAM_CHAT_ID);
    } else if (channelType === 'discord') {
        حواليToSelect.push(USER_COL_DISCORD_USER_ID, USER_COL_DISCORD_VERIFIED);
    }
    // No extra fields needed for email beyond already included.

    const { data: userRecord, error: fetchError } = await supabase
        .from(USERS_TABLE)
        .select(حواليToSelect.join(', '))
        .eq(USER_COL_ID, userId)
        .single();

    if (fetchError) {
      console.error(`[SendTestNotification] Error fetching user ${userId} from Supabase:`, fetchError.message);
      return res.status(500).json({ message: 'Could not retrieve user settings for test notification.' });
    }
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sampleData = {
        video_title: "🚀 Viral Test Video Example",
        views: "12,345",
        likes: "1,234",
        comments: "98",
        channel_name: "Test Channel",
        time_ago: "5 minutes ago",
        video_url: "https://example.com/test-video"
    };

    const formatMessage = (template, data) => {
        let message = template;
        for (const key in data) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), data[key]);
        }
        return message;
    };

    let successMessage = "";

    if (channelType === 'telegram') {
        const chatId = userRecord[USER_COL_TELEGRAM_CHAT_ID];
        const template = userRecord[USER_COL_ALERT_TEMPLATE_TELEGRAM] || defaultTemplates.templateTelegram;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;

        if (!chatId) {
            return res.status(400).json({ message: 'Telegram Chat ID not configured.' });
        }
        if (!botToken) {
             console.error('[SendTestNotification] Telegram Bot Token not configured.');
             return res.status(500).json({ message: 'Telegram bot not configured on server.' });
        }
        const messageToSend = formatMessage(template, sampleData);
        const bot = new TelegramBot(botToken);
        try {
            await bot.sendMessage(String(chatId), messageToSend, { parse_mode: 'HTML' }); 
            successMessage = `Test message sent to Telegram Chat ID: ${chatId}`;
        } catch (sendError) {
            console.error('[SendTestNotification] Telegram send error:', sendError.response?.body || sendError.message);
            const errorDetails = sendError.response?.body?.description || sendError.message || 'Unknown error';
            return res.status(500).json({ message: `Failed to send test message to Telegram: ${errorDetails}` });
        }
    } else if (channelType === 'discord') {
        const discordUserIdToTest = userRecord[USER_COL_DISCORD_USER_ID];
        const discordVerified = userRecord[USER_COL_DISCORD_VERIFIED];
        const template = userRecord[USER_COL_ALERT_TEMPLATE_DISCORD] || defaultTemplates.templateDiscord;

        if (!discordUserIdToTest || !discordVerified) { 
            return res.status(400).json({ message: 'Discord User ID not configured or not verified.' });
        }
        const messageToSend = formatMessage(template, sampleData);
        const dmSent = await sendDiscordDM(discordUserIdToTest, messageToSend);
        if (dmSent) {
             successMessage = `Test message sent to your Discord DMs (User ID: ${discordUserIdToTest}).`;
        } else {
             return res.status(500).json({ message: 'Failed to send test message to Discord DM. Bot might be blocked or DMs disabled.' });
        }
    } else if (channelType === 'email') {
        const emailToSendTo = userRecord[USER_COL_EMAIL]; 
        const subjectTemplate = userRecord[USER_COL_ALERT_TEMPLATE_EMAIL_SUBJECT] || defaultTemplates.templateEmailSubject;

        if (!emailToSendTo) {
            return res.status(400).json({ message: 'Primary email not configured for this user.' });
        }
        const subject = formatMessage(subjectTemplate, sampleData);
        const body = `
            <h1>🔥 Test Trend Alert</h1>
            <p>This is a test notification from Trendy.</p>
            <p><strong>Video:</strong> ${sampleData.video_title}</p>
            <p><strong>Channel:</strong> ${sampleData.channel_name}</p>
            <p><strong>Stats:</strong> ${sampleData.views} views / ${sampleData.likes} likes / ${sampleData.comments} comments</p>
            <p><strong>Posted:</strong> ${sampleData.time_ago}</p>
            <p><a href="${sampleData.video_url}">Watch Video</a></p>
        `;
        try {
            await sendEmail({
                 to: emailToSendTo,
                 subject: subject,
                 html: body,
                 text: `Test Trend Alert: ${sampleData.video_title}`
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
  if (!isSupabaseReady()) {
    console.error('[SendTelegramVerificationCode] Supabase client not ready.');
    return res.status(503).json({ message: 'Server is temporarily unavailable.' });
  }

  const { chatId } = req.body;
  console.log(`[sendTelegramVerificationCode] Received chatId: >>>${chatId}<<< Type: ${typeof chatId}`);
  if (!chatId || typeof chatId !== 'string' || !/^-?\d+$/.test(chatId)) {
    console.error(`[sendTelegramVerificationCode] Invalid chatId format received: ${chatId}`);
    return res.status(400).json({ message: 'Valid Telegram Chat ID is required.' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[SendTelegramVerificationCode] Telegram Bot Token not configured.');
    return res.status(500).json({ message: 'Telegram integration is not configured on the server.' });
  }

  try {
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiryMinutes = 10;
    const expiryDate = new Date(Date.now() + expiryMinutes * 60000);

    const dataToUpdate = {
      [USER_COL_TELEGRAM_VERIFICATION_CODE]: verificationCode,
      [USER_COL_TELEGRAM_CODE_EXPIRY]: expiryDate.toISOString(),
      [USER_COL_TELEGRAM_CHAT_ID]: chatId,
      [USER_COL_TELEGRAM_VERIFIED]: false
    };

    const { error: updateError } = await supabase
      .from(USERS_TABLE)
      .update(dataToUpdate)
      .eq(USER_COL_ID, userId);

    if (updateError) {
      console.error(`[SendTelegramVerificationCode] Supabase error storing verification code for user ${userId}:`, updateError.message);
      return next(new Error('Failed to store Telegram verification details.'));
    }
    console.log(`Stored Telegram verification code for user ${userId}.`);

    const bot = new TelegramBot(botToken);
    const messageText = `Your Trendy Bot verification code is: *${verificationCode}*\n\nThis code will expire in ${expiryMinutes} minutes.`;
    
    await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
    console.log(`Sent verification code to Chat ID ${chatId} for user ${userId}.`);

    res.status(200).json({ message: `Verification code sent to Telegram Chat ID ${chatId}. Please check Telegram.` });

  } catch (error) {
    console.error(`[SendTelegramVerificationCode] Error for user ${userId}:`, error.response?.body || error.message || error);
     if (error.response && error.response.body && error.response.body.error_code === 400 && error.response.body.description.includes('chat not found')) {
        return res.status(400).json({ message: 'Could not send message. Please ensure the Chat ID is correct and you have started a conversation with the bot.' });
     } else if (error.response && error.response.body && error.response.body.error_code === 403) {
          return res.status(403).json({ message: 'Could not send message. Please ensure you have not blocked the bot.' });
     }
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
    if (!isSupabaseReady()) {
        console.error('[VerifyTelegramCode] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    const { verificationCode } = req.body; 
    if (!verificationCode || typeof verificationCode !== 'string' || !/\d{6}/.test(verificationCode)) {
        return res.status(400).json({ message: 'Invalid verification code format. Expected 6 digits.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(`${USER_COL_TELEGRAM_VERIFICATION_CODE}, ${USER_COL_TELEGRAM_CODE_EXPIRY}, ${USER_COL_TELEGRAM_CHAT_ID}`)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[VerifyTelegramCode] Supabase error fetching user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user verification data.' });
        }
        if (!userRecord) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storedCode = userRecord[USER_COL_TELEGRAM_VERIFICATION_CODE];
        const expiryString = userRecord[USER_COL_TELEGRAM_CODE_EXPIRY];
        const storedChatId = userRecord[USER_COL_TELEGRAM_CHAT_ID]; 

        if (!storedCode || !expiryString || !storedChatId) {
             console.error(`[VerifyTelegramCode] Missing verification data for user ${userId}.`);
             return res.status(400).json({ message: 'Verification process not initiated or chat ID missing. Please request a code first.' });
        }

        const expiryDate = new Date(expiryString);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            const { error: clearError } = await supabase
                .from(USERS_TABLE)
                .update({ 
                    [USER_COL_TELEGRAM_VERIFICATION_CODE]: null,
                    [USER_COL_TELEGRAM_CODE_EXPIRY]: null
                })
                .eq(USER_COL_ID, userId);
            if (clearError) console.error(`[VerifyTelegramCode] Supabase error clearing expired code for user ${userId}:`, clearError.message);
            else console.log(`Cleared expired telegram verification code for user ${userId}.`);
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (verificationCode !== storedCode) {
             return res.status(400).json({ message: 'Invalid verification code.' });
        }

        const dataToUpdate = {
            [USER_COL_TELEGRAM_VERIFIED]: true,
            [USER_COL_TELEGRAM_VERIFICATION_CODE]: null,
            [USER_COL_TELEGRAM_CODE_EXPIRY]: null,
        };
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[VerifyTelegramCode] Supabase error updating user ${userId} after verification:`, updateError.message);
            return next(new Error('Failed to finalize Telegram verification.'));
        }
        console.log(`Telegram verification successful for user ${userId} with Chat ID ${storedChatId}.`);

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken && storedChatId) {
             try {
                const bot = new TelegramBot(botToken);
                await bot.sendMessage(storedChatId, '✅ Your Telegram account has been successfully connected to Trendy Bot!');
             } catch (confirmError) {
                 console.error(`[VerifyTelegramCode] Failed to send Telegram confirmation to ${storedChatId} for user ${userId}:`, confirmError.message);
             }
        } else {
             console.warn('[VerifyTelegramCode] Telegram Bot Token not configured or Chat ID missing. Skipping confirmation message.')
        }

         if (sendToUser) {
            try {
                sendToUser(userId.toString(), { 
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
    if (!isSupabaseReady()) {
        console.error('[DisconnectTelegram] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        const dataToUpdate = {
            [USER_COL_TELEGRAM_CHAT_ID]: null,
            [USER_COL_TELEGRAM_VERIFIED]: false,
            [USER_COL_TELEGRAM_VERIFICATION_CODE]: null,
            [USER_COL_TELEGRAM_CODE_EXPIRY]: null, // Corrected from telegram_code_expiry to USER_COL_TELEGRAM_CODE_EXPIRY
        };

        const { error } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (error) {
            console.error(`[DisconnectTelegram] Supabase error disconnecting Telegram for user ${userId}:`, error.message);
            return next(new Error('Failed to disconnect Telegram account due to a server error.'));
        }

        console.log(`[DisconnectTelegram] Telegram disconnected successfully for user ${userId}.`);

        if (sendToUser) {
             try { 
                await sendToUser(userId.toString(), { 
                    type: 'NOTIFICATION',
                    payload: {
                        message: 'Telegram account disconnected successfully.',
                        status: 'success'
                    }
                });
             } catch (wsError) { 
                 console.error(`[DisconnectTelegram] Error sending WebSocket notification for user ${userId}:`, wsError);
             }
        } 

        res.status(200).json({ message: 'Telegram account disconnected successfully.' });

    } catch (error) {
        // This catch is for unexpected errors not from the direct Supabase call already handled
        console.error(`[DisconnectTelegram] Outer catch error for user ${userId}:`, error.message);
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
    if (!isSupabaseReady()) {
        console.error('[UpdateProfilePhoto] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    if (!s3Client || !s3BucketName) {
        console.error(`[UpdateProfilePhoto] S3 Client or Bucket Name not configured for user ${userId}.`);
        return next(new Error('Server configuration error: File Storage is not set up.'));
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded or file type rejected.' });
    }
    if (!req.file.buffer) {
         return res.status(400).json({ message: 'File buffer is missing.' });
    }
    if (!req.file.originalname) {
        console.error(`[UpdateProfilePhoto] req.file.originalname is missing for user ${userId}.`);
        return res.status(400).json({ message: 'File metadata (originalname) is missing.' });
    }

    try {
        const fileExtension = path.extname(req.file.originalname);
        const timestamp = Date.now();
        const s3Key = `avatars/user-${userId}-${timestamp}${fileExtension}`;

        console.log(`[UpdateProfilePhoto] Uploading ${s3Key} to bucket ${s3BucketName}...`);

        const command = new PutObjectCommand({
            Bucket: s3BucketName,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        });
        await s3Client.send(command);
        console.log(`[UpdateProfilePhoto] File uploaded to S3 for user ${userId}. Key: ${s3Key}`);

        const dataToUpdate = {
            [USER_COL_PROFILE_PHOTO_URL]: s3Key // Save the S3 object key
        };

        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[UpdateProfilePhoto] Supabase error updating profile photo URL for user ${userId}:`, updateError.message);
            // Potentially try to delete the S3 object if DB update fails?
            return next(new Error('Failed to update profile photo reference in database.'));
        }
        
        console.log(`[UpdateProfilePhoto] Updated Supabase profile photo key for user ${userId}`);

        res.status(200).json({
            message: 'Profile photo updated successfully',
            photoPath: s3Key, 
        });

    } catch (error) {
        console.error(`[UpdateProfilePhoto] Error for user ${userId}:`, error.message);
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ message: `File upload error: ${error.message}` });
        }
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
    if (!isSupabaseReady()) {
        console.error('[ChangePassword] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide both current and new passwords.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(USER_COL_PASSWORD)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[ChangePassword] Supabase error fetching user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user data.' });
        }
        if (!userRecord) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const storedHash = userRecord[USER_COL_PASSWORD];
        if (!storedHash) {
            console.error(`[ChangePassword] User ${userId} has no password hash stored.`);
            return res.status(500).json({ message: 'Cannot change password, account issue.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, storedHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(newPassword, salt);

        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update({ [USER_COL_PASSWORD]: newHashedPassword })
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[ChangePassword] Supabase error updating password for user ${userId}:`, updateError.message);
            return next(new Error('Failed to update password.'));
        }

        console.log(`[ChangePassword] Password updated successfully for user ${userId}.`);
        res.status(200).json({ message: 'Password changed successfully.' });

    } catch (error) {
        console.error(`[ChangePassword] Outer catch for user ${userId}:`, error.message);
        next(error);
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
    if (!isSupabaseReady()) {
        console.error('[Setup2FA] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(USER_COL_EMAIL)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[Setup2FA] Supabase error fetching user email for user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user data for 2FA setup.' });
        }
        if (!userRecord || !userRecord[USER_COL_EMAIL]) {
            return res.status(404).json({ message: 'User email not found, cannot setup 2FA.' });
        }
        const userEmail = userRecord[USER_COL_EMAIL];
        const appName = 'TrendyBot'; 

        const secret = authenticator.generateSecret();

        const dataToUpdate = {
            [USER_COL_TWO_FACTOR_SECRET]: secret,
            [USER_COL_IS_2FA_ENABLED]: false 
        };
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[Setup2FA] Supabase error storing 2FA secret for user ${userId}:`, updateError.message);
            return next(new Error('Failed to store 2FA setup details.'));
        }
        console.log(`[Setup2FA] Generated and stored temporary 2FA secret for user ${userId}.`);

        const otpauthUri = authenticator.keyuri(userEmail, appName, secret);

        res.status(200).json({
            secret: secret, 
            otpauthUri: otpauthUri
        });

    } catch (error) {
        console.error(`[Setup2FA] Outer catch for user ${userId}:`, error.message);
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
    if (!isSupabaseReady()) {
        console.error('[Verify2FA] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }
    if (!userToken || !/\d{6}/.test(userToken)) {
        return res.status(400).json({ message: 'Invalid or missing 6-digit token.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(USER_COL_TWO_FACTOR_SECRET)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[Verify2FA] Supabase error fetching 2FA secret for user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user data for 2FA verification.' });
        }
        if (!userRecord) {
             return res.status(404).json({ message: 'User not found or 2FA not initiated.' });
        }

        const secret = userRecord[USER_COL_TWO_FACTOR_SECRET];
        if (!secret) {
            return res.status(400).json({ message: '2FA setup not initiated for this user.' });
        }

        const isValid = authenticator.verify({ token: userToken, secret });

        if (isValid) {
            const { error: updateError } = await supabase
                .from(USERS_TABLE)
                .update({ [USER_COL_IS_2FA_ENABLED]: true })
                .eq(USER_COL_ID, userId);

            if (updateError) {
                console.error(`[Verify2FA] Supabase error enabling 2FA for user ${userId}:`, updateError.message);
                return next(new Error('Failed to finalize 2FA setup.'));
            }
            console.log(`[Verify2FA] 2FA enabled successfully for user ID: ${userId}`);
            res.status(200).json({ message: 'Two-factor authentication enabled successfully.' });
        } else {
            console.log(`[Verify2FA] Invalid 2FA token attempt for user ID: ${userId}`);
            res.status(400).json({ message: 'Invalid verification code.' });
        }

    } catch (error) {
        console.error(`[Verify2FA] Outer catch for user ID: ${userId}:`, error.message);
        next(error); 
    }
};

/**
 * @desc    Disable Two-Factor Authentication for the user
 * @route   POST /api/users/2fa/disable
 * @access  Private
 */
const disable2FA = async (req, res, next) => {
    const userId = req.userId; 

    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!isSupabaseReady()) {
        console.error('[Disable2FA] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        console.log(`[Disable2FA] Attempting to disable 2FA for user ID: ${userId}`);
        
        const dataToUpdate = {
            [USER_COL_IS_2FA_ENABLED]: false,
            [USER_COL_TWO_FACTOR_SECRET]: null, 
        };

        const { error } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (error) {
            console.error(`[Disable2FA] Supabase error disabling 2FA for user ${userId}:`, error.message);
            // Check if error indicates user not found (though .eq should handle this by not updating)
            // For instance, if RLS prevents update and returns 0 rows affected without error, 
            // or if a specific error code for not found is returned by Supabase on update.
            // However, a generic failure message is often sufficient here unless specific user feedback is needed.
            return next(new Error('Failed to disable 2FA.'));
        }
        
        // To confirm the update happened, you might theoretically check affectedRows if the client provides it.
        // However, if no error, we assume success for this operation.
        console.log(`[Disable2FA] Successfully disabled 2FA for user ID: ${userId}`);
        res.status(200).json({ message: 'Two-factor authentication disabled successfully.' });

    } catch (error) {
        console.error(`[Disable2FA] Outer catch for user ID: ${userId}:`, error.message);
        next(error);
    }
};

/**
 * @desc    Delete user account
 * @route   DELETE /api/users/account
 * @access  Private
 */
const deleteAccount = async (req, res, next) => {
    const userId = req.userId; 

    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!isSupabaseReady()) {
        console.error('[DeleteAccount] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        console.log(`[DeleteAccount] Attempting to delete account for user ID: ${userId}`);

        console.warn(`ACTION REQUIRED: Account deletion initiated for user ${userId}. Please manually verify and cancel any active subscriptions (e.g., PayPal) associated with this user.`);

        const { error } = await supabase
            .from(USERS_TABLE)
            .delete()
            .eq(USER_COL_ID, userId);

        if (error) {
            console.error(`[DeleteAccount] Supabase error deleting account for user ID: ${userId}:`, error.message);
            return next(new Error('Failed to delete account. Could not remove user data.'));
        }

        // If no error, Supabase delete was successful (or user didn't exist, which is fine for deletion)
        console.log(`[DeleteAccount] Successfully deleted account for user ID: ${userId} (or account did not exist).`);
        res.status(200).json({ message: 'Account deleted successfully.' });

    } catch (error) {
        console.error(`[DeleteAccount] Outer catch for user ID: ${userId}:`, error.message);
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
        return res.status(401).json({ message: "User not authorized for this action." });
    }
    if (!isSupabaseReady()) {
        console.error('[GetAvatarSignedUrl] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.', signedUrl: null });
    }
    if (!s3Client || !s3BucketName) {
        console.error(`[GetAvatarSignedUrl] S3 Client or Bucket Name not configured.`);
        return res.status(503).json({ message: 'Storage service unavailable.', signedUrl: null });
    }

    let objectPath = null; 

    try {
        const { data: user, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(USER_COL_PROFILE_PHOTO_URL)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[GetAvatarSignedUrl] Supabase error fetching user ${userId}:`, fetchError.message);
            if (fetchError.code === 'PGRST116') { // Not found
                 return res.status(200).json({ signedUrl: null }); // User exists but no avatar set is not an error here
            }
            return res.status(500).json({ message: 'Could not retrieve user data.', signedUrl: null });
        }

        if (!user || !user[USER_COL_PROFILE_PHOTO_URL]) {
            return res.status(200).json({ signedUrl: null }); 
        }

        objectPath = user[USER_COL_PROFILE_PHOTO_URL];

        const command = new GetObjectCommand({ 
             Bucket: s3BucketName,
             Key: objectPath,
        });
        const signedUrl = await getSignedUrl(s3Client, command, {
             expiresIn: 15 * 60, 
        });

        console.log(`[GetAvatarSignedUrl] Generated URL for user ${userId}: ${signedUrl.substring(0, 100)}...`);
        res.status(200).json({ signedUrl: signedUrl });

    } catch (error) {
        console.error(`[GetAvatarSignedUrl] Error generating signed URL for user ${userId}, path: ${objectPath || 'unknown'}:`, error.message);
        res.status(500).json({ message: 'Could not retrieve avatar URL.', signedUrl: null });
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
    if (!isSupabaseReady()) {
        console.error('[SendEmailVerificationCode] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(USER_COL_EMAIL)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[SendEmailVerificationCode] Supabase error fetching user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user data.' });
        }
        if (!userRecord || !userRecord[USER_COL_EMAIL]) {
            return res.status(404).json({ message: 'User email not found or not set.' });
        }
        
        const emailToSendTo = userRecord[USER_COL_EMAIL];
        if (!emailToSendTo) { 
             return res.status(400).json({ message: 'Email address not set for this user.' });
        }

        const verificationCode = generateVerificationCode();
        const expiryMinutes = 10;
        const expiryDate = new Date(Date.now() + expiryMinutes * 60000);

        const dataToUpdate = {
            [USER_COL_EMAIL_VERIFICATION_CODE]: verificationCode,
            [USER_COL_EMAIL_CODE_EXPIRY]: expiryDate.toISOString(),
        };
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[SendEmailVerificationCode] Supabase error storing verification code for user ${userId}:`, updateError.message);
            return next(new Error('Failed to store email verification details.'));
        }
        console.log(`[SendEmailVerificationCode] Stored email verification code for user ${userId}.`);

        const subject = `Your Trendy Bot Verification Code: ${verificationCode}`;
        const textBody = `Your Trendy Bot verification code is: ${verificationCode}\n\nThis code will expire in ${expiryMinutes} minutes.`;
        const htmlBody = `<p>Your Trendy Bot verification code is: <strong>${verificationCode}</strong></p><p>This code will expire in ${expiryMinutes} minutes.</p>`;
        
        await sendEmail({ to: emailToSendTo, subject, text: textBody, html: htmlBody });
        console.log(`[SendEmailVerificationCode] Sent verification code to email ${emailToSendTo} for user ${userId}.`);

        res.status(200).json({ message: `Verification code sent to ${emailToSendTo}. Please check your inbox (and spam folder).` });

    } catch (error) {
        console.error(`[SendEmailVerificationCode] Outer catch for user ${userId}:`, error.message);
        next(new Error('Failed to send email verification code.'));
    }
};

// --- Verify Email Code ---
const verifyEmailCode = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!isSupabaseReady()) {
        console.error('[VerifyEmailCode] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    const { verificationCode } = req.body;
    if (!verificationCode || typeof verificationCode !== 'string' || !/^\d{6}$/.test(verificationCode)) {
        return res.status(400).json({ message: 'Invalid verification code format. Expected 6 digits.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(`${USER_COL_EMAIL_VERIFICATION_CODE}, ${USER_COL_EMAIL_CODE_EXPIRY}, ${USER_COL_EMAIL}`)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[VerifyEmailCode] Supabase error fetching user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user verification data.' });
        }
        if (!userRecord) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storedCode = userRecord[USER_COL_EMAIL_VERIFICATION_CODE];
        const expiryString = userRecord[USER_COL_EMAIL_CODE_EXPIRY];
        const userEmail = userRecord[USER_COL_EMAIL];

        if (!storedCode || !expiryString) { // userEmail check is implicitly handled if code was sent
             console.error(`[VerifyEmailCode] Missing verification data for user ${userId}.`);
             return res.status(400).json({ message: 'Verification process not initiated or data missing. Please request a code first.' });
        }
        if (!userEmail) {
             console.error(`[VerifyEmailCode] User email not found for ${userId}, though verification data exists.`);
             return res.status(500).json({ message: 'User email not found, cannot verify.' });
        }

        const expiryDate = new Date(expiryString);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            const { error: clearError } = await supabase
                .from(USERS_TABLE)
                .update({
                    [USER_COL_EMAIL_VERIFICATION_CODE]: null,
                    [USER_COL_EMAIL_CODE_EXPIRY]: null
                })
                .eq(USER_COL_ID, userId);
            if (clearError) console.error(`[VerifyEmailCode] Supabase error clearing expired code for user ${userId}:`, clearError.message);
            else console.log(`Cleared expired email verification code for user ${userId}.`);
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (verificationCode !== storedCode) {
             return res.status(400).json({ message: 'Invalid verification code.' });
        }

        // Code is valid
        const dataToUpdate = {
            [USER_COL_EMAIL_VERIFIED]: true,
            [USER_COL_EMAIL_VERIFICATION_CODE]: null,
            [USER_COL_EMAIL_CODE_EXPIRY]: null,
        };
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[VerifyEmailCode] Supabase error updating user ${userId} after verification:`, updateError.message);
            return next(new Error('Failed to finalize email verification.'));
        }
        console.log(`Email verification successful for user ${userId} (Email: ${userEmail}).`);

        // Send confirmation email
        try {
            const subject = '✅ Your Email is Verified with Trendy Bot!';
            const textBody = 'Your email address has been successfully verified with Trendy Bot.';
            const htmlBody = '<p>Your email address has been successfully verified with Trendy Bot.</p>';
            await sendEmail({ to: userEmail, subject, text: textBody, html: htmlBody });
            console.log(`[VerifyEmailCode] Sent verification confirmation email to ${userEmail} for user ${userId}.`);
        } catch (emailError) {
            console.error(`[VerifyEmailCode] Failed to send confirmation email to ${userEmail} for user ${userId}:`, emailError.message);
            // Non-critical, so don't fail the request if confirmation email fails
        }

        // Notify Frontend via WebSocket
        if (sendToUser) {
            try {
                await sendToUser(userId.toString(), {
                    type: 'emailStatusUpdate',
                    payload: { verified: true, email: userEmail } 
                });
                 console.log(`[VerifyEmailCode] WebSocket emailStatusUpdate notification sent to user ${userId}.`);
            } catch (wsError) {
                 console.error(`[VerifyEmailCode] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
         } else {
             console.warn('[VerifyEmailCode] sendToUser function is not available from websocket.service.js. Cannot send WebSocket update.');
         }

        res.status(200).json({
            message: 'Email address verified successfully.',
            email: userEmail
        });

    } catch (error) {
        console.error(`[VerifyEmailCode] Outer catch for user ${userId}:`, error.message);
        next(new Error('Failed to verify email code due to a server error.'));
    }
};

// --- Send Discord Verification Code ---
const sendDiscordVerificationCode = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!isSupabaseReady()) {
        console.error('[SendDiscordVerificationCode] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(USER_COL_DISCORD_USER_ID)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[SendDiscordVerificationCode] Supabase error fetching user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user data.' });
        }
        if (!userRecord || !userRecord[USER_COL_DISCORD_USER_ID]) {
            return res.status(404).json({ message: 'Discord User ID not found or not set.' });
        }
        
        const discordUserId = userRecord[USER_COL_DISCORD_USER_ID];
        if (!discordUserId) { 
             return res.status(400).json({ message: 'Discord User ID not set for this user.' });
        }

        const verificationCode = generateVerificationCode();
        const expiryMinutes = 10;
        const expiryDate = new Date(Date.now() + expiryMinutes * 60000);

        const dataToUpdate = {
            [USER_COL_DISCORD_VERIFICATION_CODE]: verificationCode,
            [USER_COL_DISCORD_CODE_EXPIRY]: expiryDate.toISOString(),
        };
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[SendDiscordVerificationCode] Supabase error storing verification code for user ${userId}:`, updateError.message);
            return next(new Error('Failed to store Discord verification details.'));
        }
        console.log(`[SendDiscordVerificationCode] Stored Discord verification code for user ${userId}.`);

        const messageText = `Your Trendy Bot verification code is: **${verificationCode}**\nThis code will expire in ${expiryMinutes} minutes.`;
        const dmSent = await sendDiscordDM(discordUserId, messageText);

        if (dmSent) {
            console.log(`Sent Discord verification DM to user ${userId}.`);
            res.status(200).json({ message: `Verification code sent to your Discord DMs. Please check Discord.` });
        } else {
            console.error(`[SendDiscordVerificationCode] Failed to send Discord DM to user ${userId} (Discord User ID: ${discordUserId}). Bot might be blocked or DMs disabled.`);
            return res.status(500).json({ message: 'Failed to send Discord verification DM. The bot might be blocked or DMs disabled on your server/account.' });
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

// --- Verify Discord Code ---
const verifyDiscordCode = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!isSupabaseReady()) {
        console.error('[VerifyDiscordCode] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    const { verificationCode } = req.body;
    if (!verificationCode || typeof verificationCode !== 'string' || !/\d{6}/.test(verificationCode)) {
        return res.status(400).json({ message: 'Invalid verification code format. Expected 6 digits.' });
    }

    try {
        const { data: userRecord, error: fetchError } = await supabase
            .from(USERS_TABLE)
            .select(`${USER_COL_DISCORD_VERIFICATION_CODE}, ${USER_COL_DISCORD_CODE_EXPIRY}, ${USER_COL_DISCORD_USER_ID}`)
            .eq(USER_COL_ID, userId)
            .single();

        if (fetchError) {
            console.error(`[VerifyDiscordCode] Supabase error fetching user ${userId}:`, fetchError.message);
            return res.status(500).json({ message: 'Could not retrieve user verification data.' });
        }
        if (!userRecord) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storedCode = userRecord[USER_COL_DISCORD_VERIFICATION_CODE];
        const expiryString = userRecord[USER_COL_DISCORD_CODE_EXPIRY];
        const storedDiscordUserId = userRecord[USER_COL_DISCORD_USER_ID];

        if (!storedCode || !expiryString || !storedDiscordUserId) {
             console.error(`[VerifyDiscordCode] Missing verification data for user ${userId}. Discord User ID: ${storedDiscordUserId}`);
             return res.status(400).json({ message: 'Verification process not initiated or Discord User ID missing. Please request a code first.' });
        }

        const expiryDate = new Date(expiryString);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            const { error: clearError } = await supabase
                .from(USERS_TABLE)
                .update({
                    [USER_COL_DISCORD_VERIFICATION_CODE]: null,
                    [USER_COL_DISCORD_CODE_EXPIRY]: null
                })
                .eq(USER_COL_ID, userId);
            if (clearError) console.error(`[VerifyDiscordCode] Supabase error clearing expired code for user ${userId}:`, clearError.message);
            else console.log(`Cleared expired Discord verification code for user ${userId}.`);
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (verificationCode !== storedCode) {
             return res.status(400).json({ message: 'Invalid verification code.' });
        }

        // Code is valid
        const dataToUpdate = {
            [USER_COL_DISCORD_VERIFIED]: true,
            [USER_COL_DISCORD_VERIFICATION_CODE]: null,
            [USER_COL_DISCORD_CODE_EXPIRY]: null,
        };
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[VerifyDiscordCode] Supabase error updating user ${userId} after verification:`, updateError.message);
            return next(new Error('Failed to finalize Discord verification.'));
        }
        console.log(`Discord verification successful for user ${userId} with Discord User ID ${storedDiscordUserId}.`);

        // Send confirmation via DM
        if (storedDiscordUserId) {
            const confirmationMessage = '✅ Your Discord account has been successfully connected to Trendy Bot!';
            try {
                const confirmDmSent = await sendDiscordDM(storedDiscordUserId, confirmationMessage);
                if (confirmDmSent) {
                     console.log(`[VerifyDiscordCode] Sent Discord confirmation DM to ${storedDiscordUserId} for user ${userId}.`);
                } else {
                     console.warn(`[VerifyDiscordCode] Failed to send Discord confirmation DM for user ${userId}. Bot might be blocked or DMs disabled.`);
                }
            } catch (dmError) {
                console.error(`[VerifyDiscordCode] Error sending Discord confirmation DM for user ${userId}:`, dmError);
            }
        } else {
            console.warn('[VerifyDiscordCode] Discord User ID missing, cannot send confirmation DM.');
        }

        // Notify Frontend via WebSocket
        if (sendToUser) {
            try {
                await sendToUser(userId.toString(), {
                    type: 'discordStatusUpdate',
                    payload: { verified: true, discordUserId: storedDiscordUserId } 
                });
                 console.log(`[VerifyDiscordCode] WebSocket discordStatusUpdate notification sent to user ${userId}.`);
            } catch (wsError) {
                 console.error(`[VerifyDiscordCode] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
         } else {
             console.warn('[VerifyDiscordCode] sendToUser function is not available from websocket.service.js. Cannot send WebSocket update.');
         }

        res.status(200).json({
            message: 'Discord account connected successfully.',
            discordUserId: storedDiscordUserId
        });

    } catch (error) {
        console.error(`[VerifyDiscordCode] Outer catch for user ${userId}:`, error.message);
        next(new Error('Failed to verify Discord code due to a server error.'));
    }
};

// --- Disconnect Discord ---
const disconnectDiscord = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!isSupabaseReady()) {
        console.error('[DisconnectDiscord] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        const dataToUpdate = {
            [USER_COL_DISCORD_USER_ID]: null,
            [USER_COL_DISCORD_VERIFIED]: false,
            [USER_COL_DISCORD_VERIFICATION_CODE]: null,
            [USER_COL_DISCORD_CODE_EXPIRY]: null,
        };

        const { error } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (error) {
            console.error(`[DisconnectDiscord] Supabase error disconnecting Discord for user ${userId}:`, error.message);
            return next(new Error('Failed to disconnect Discord account due to a server error.'));
        }
        
        console.log(`[DisconnectDiscord] Discord disconnected successfully for user ${userId}.`);

        // Notify Frontend via WebSocket
        if (sendToUser) {
            try {
               await sendToUser(userId.toString(), { 
                   type: 'discordStatusUpdate', 
                   payload: { verified: false, discordUserId: null } // Ensure discordUserId is nulled out in payload
                });
               console.log(`[DisconnectDiscord] WebSocket discordStatusUpdate notification sent to user ${userId}.`);
            } catch (wsError) {
                console.error(`[DisconnectDiscord] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
        } else {
            console.warn('[DisconnectDiscord] sendToUser function is not available. Cannot send WebSocket update.');
        }

        res.status(200).json({ message: 'Discord account disconnected successfully.' });

    } catch (error) {
        console.error(`[DisconnectDiscord] Outer catch error for user ${userId}:`, error.message);
        next(new Error('Failed to disconnect Discord account due to a server error.'));
    }
};

// --- Disconnect Email ---
const disconnectEmail = async (req, res, next) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    if (!isSupabaseReady()) {
        console.error('[DisconnectEmail] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }

    try {
        // IMPORTANT: Review if USER_COL_EMAIL ('Emails') is the correct field to nullify.
        // If 'Emails' is the primary login email, nullifying it might lock the user out.
        // This logic assumes it's a contact/notification email that can be cleared.
        const dataToUpdate = {
            // [USER_COL_EMAIL]: null, // Consider implications before enabling this line
            [USER_COL_EMAIL_VERIFIED]: false,
            [USER_COL_EMAIL_VERIFICATION_CODE]: null,
            [USER_COL_EMAIL_CODE_EXPIRY]: null,
        };

        const { error } = await supabase
            .from(USERS_TABLE)
            .update(dataToUpdate)
            .eq(USER_COL_ID, userId);

        if (error) {
            console.error(`[DisconnectEmail] Supabase error disconnecting email for user ${userId}:`, error.message);
            return next(new Error('Failed to disconnect email due to a server error.'));
        }
        
        console.log(`[DisconnectEmail] Email connection/verification status reset for user ${userId}.`);

        // Notify Frontend via WebSocket
        // The payload should reflect what was actually changed.
        // If USER_COL_EMAIL is not nulled, then email field in payload might be misleading.
        if (sendToUser) {
            try {
               await sendToUser(userId.toString(), { 
                   type: 'emailStatusUpdate', 
                   payload: { verified: false /* email: null (if USER_COL_EMAIL was nulled) */ } 
                });
               console.log(`[DisconnectEmail] WebSocket emailStatusUpdate notification sent to user ${userId}.`);
            } catch (wsError) {
                console.error(`[DisconnectEmail] Error sending WebSocket notification for user ${userId}:`, wsError);
            }
        } else {
            console.warn('[DisconnectEmail] sendToUser function is not available. Cannot send WebSocket update.');
        }

        res.status(200).json({ message: 'Email connection/verification status reset successfully.' });

    } catch (error) {
        console.error(`[DisconnectEmail] Outer catch error for user ${userId}:`, error.message);
        next(new Error('Failed to disconnect email due to a server error.'));
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