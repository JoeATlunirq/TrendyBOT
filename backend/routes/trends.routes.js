const express = require('express');
const router = express.Router();
const { getMyAlerts, getAlertDetails } = require('../controllers/trends.controller');
const { protect } = require('../middleware/auth.middleware'); // Assuming you have this auth middleware

// @route   GET /api/trends/my-alerts
// @desc    Get all triggered alerts for the current user
// @access  Private
router.get('/my-alerts', protect, getMyAlerts);

// @route   GET /api/trends/alert/:alertId
// @desc    Get details for a specific triggered alert
// @access  Private
router.get('/alert/:alertId', protect, getAlertDetails);

module.exports = router; 