const express = require('express');
const { approveSubscription } = require('../controllers/paypal.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// @route   POST /api/paypal/approve-subscription
// @desc    Verify PayPal subscription and update user plan
// @access  Private
router.post('/approve-subscription', protect, approveSubscription);

// TODO: Add route for PayPal webhook handler POST /api/paypal/webhook

module.exports = router; 