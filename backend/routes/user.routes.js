const express = require('express');
const { updateUserPreferences, updateProfile, updateNotificationSettings, getAlertPreferences, updateAlertPreferences, getAlertTemplates, updateAlertTemplates, getNotificationSettings, sendTestNotification, verifyTelegramCode } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware'); // Import the protect middleware

const router = express.Router();

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
// router.post('/notifications/telegram/request-code', protect, requestTelegramCode); // REMOVED - No longer needed
router.post('/notifications/telegram/verify-code', protect, verifyTelegramCode);

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

module.exports = router; 