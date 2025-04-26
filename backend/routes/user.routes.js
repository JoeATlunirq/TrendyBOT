const express = require('express');
const multer = require('multer'); // Import multer
const path = require('path'); // Import path for filename generation
const { updateUserPreferences, updateProfile, updateNotificationSettings, getAlertPreferences, updateAlertPreferences, getAlertTemplates, updateAlertTemplates, getNotificationSettings, sendTestNotification, sendTelegramVerificationCode, verifyTelegramCode, disconnectTelegram, updateProfilePhoto, changePassword, setup2FA, verify2FA, disable2FA, deleteAccount, getAvatarSignedUrl, sendEmailVerificationCode, verifyEmailCode, disconnectEmail, sendDiscordVerificationCode, verifyDiscordCode, disconnectDiscord } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware'); // Import the protect middleware

const router = express.Router();

// --- Multer Configuration for Avatar Uploads ---
const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        // Reject file
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

// USE memoryStorage() instead of diskStorage
const upload = multer({ 
    storage: multer.memoryStorage(), // <-- CHANGED
    limits: { fileSize: 1024 * 1024 * 2 }, // Limit file size to 2MB
    fileFilter: fileFilter 
});
// -----------------------------------------------

// @route   PUT /api/users/preferences
// @desc    Update user preferences (and mark onboarding complete)
// @access  Private
router.put('/preferences', protect, updateUserPreferences);
// Note: We use protect middleware here to ensure only logged-in users can access

// Profile route
// @route   PUT /api/users/profile
// @desc    Update user profile (name, company)
// @access  Private
router.put('/profile', protect, updateProfile);

// --- Profile Photo Upload Route ---
// @route   PUT /api/users/profile/photo
// @desc    Update user profile photo
// @access  Private
router.put(
    '/profile/photo', 
    protect, // Ensure user is logged in
    upload.single('avatar'), // Handle single file upload named 'avatar'
    updateProfilePhoto // Controller function
);
// ----------------------------------

// --- Change Password Route ---
// @route   POST /api/users/change-password
// @desc    Change user's password
// @access  Private
router.post('/change-password', protect, changePassword);
// ----------------------------

// --- Two-Factor Authentication Routes ---
// @route   GET /api/users/2fa/setup
// @desc    Generate a new 2FA secret and QR code URI for the user
// @access  Private
router.get('/2fa/setup', protect, setup2FA);

// @route   POST /api/users/2fa/verify
// @desc    Verify the TOTP token and enable 2FA for the user
// @access  Private
router.post('/2fa/verify', protect, verify2FA);

// @route   POST /api/users/2fa/disable
// @desc    Disable 2FA for the user
// @access  Private
router.post('/2fa/disable', protect, disable2FA);
// ------------------------------------

// Notification Settings routes
// @route   GET /api/users/notifications
// @desc    Get user notification settings
// @access  Private
router.get('/notifications', protect, getNotificationSettings);

// @route   PUT /api/users/notifications
// @desc    Update user notification settings
// @access  Private
router.put('/notifications', protect, updateNotificationSettings);

// @route   POST /api/users/notifications/test
// @desc    Send a test notification to a configured channel
// @access  Private
router.post('/notifications/test', protect, sendTestNotification);

// Telegram Verification routes
// @route   POST /api/users/telegram/send-code
// @desc    Send a verification code to the provided Telegram Chat ID
// @access  Private
router.post('/telegram/send-code', protect, sendTelegramVerificationCode);

// @route   POST /api/users/telegram/verify-code
// @desc    Verify the submitted Telegram code and link the account
// @access  Private
router.post('/telegram/verify-code', protect, verifyTelegramCode);

// @route   POST /api/users/telegram/disconnect
// @desc    Disconnect the linked Telegram account
// @access  Private
router.post('/telegram/disconnect', protect, disconnectTelegram);

// Email Verification routes
// @route   POST /api/users/email/send-code
// @desc    Send a verification code to the provided email
// @access  Private
router.post('/email/send-code', protect, sendEmailVerificationCode);

// @route   POST /api/users/email/verify-code
// @desc    Verify the submitted email code
// @access  Private
router.post('/email/verify-code', protect, verifyEmailCode);

// @route   POST /api/users/email/disconnect
// @desc    Disconnect the linked email account
// @access  Private
router.post('/email/disconnect', protect, disconnectEmail);

// Discord Verification routes
// @route   POST /api/users/discord/send-code
// @desc    Send a verification code to the provided Discord server
// @access  Private
router.post('/discord/send-code', protect, sendDiscordVerificationCode);

// @route   POST /api/users/discord/verify-code
// @desc    Verify the submitted Discord code and link the account
// @access  Private
router.post('/discord/verify-code', protect, verifyDiscordCode);

// @route   POST /api/users/discord/disconnect
// @desc    Disconnect the linked Discord account
// @access  Private
router.post('/discord/disconnect', protect, disconnectDiscord);

// Alert Preferences routes
// @route   GET /api/users/alert-preferences
// @desc    Get user alert preferences
// @access  Private
router.get('/alert-preferences', protect, getAlertPreferences);

// @route   PUT /api/users/alert-preferences
// @desc    Update user alert preferences
// @access  Private
router.put('/alert-preferences', protect, updateAlertPreferences);

// Alert Templates routes
// @route   GET /api/users/alert-templates
// @desc    Get user alert templates
// @access  Private
router.get('/alert-templates', protect, getAlertTemplates);

// @route   PUT /api/users/alert-templates
// @desc    Update user alert templates
// @access  Private
router.put('/alert-templates', protect, updateAlertTemplates);

// --- Delete Account Route ---
// @route   DELETE /api/users/account
// @desc    Delete the authenticated user's account
// @access  Private
router.delete('/account', protect, deleteAccount);
// ---------------------------

// --- Get Signed URL for Avatar ---
// @route   GET /api/users/avatar-url
// @desc    Get a short-lived signed URL for the user's avatar
// @access  Private
router.get('/avatar-url', protect, getAvatarSignedUrl);
// ----------------------------------

module.exports = router; 