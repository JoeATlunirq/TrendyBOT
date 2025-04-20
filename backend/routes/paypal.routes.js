const express = require('express');
const { approveSubscription, handleWebhook } = require('../controllers/paypal.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Middleware for parsing raw body specifically for the webhook route
const rawBodyWebhook = express.raw({ type: 'application/json' });

// @route   POST /api/paypal/approve-subscription
// @desc    Verify PayPal subscription and update user plan
// @access  Private
router.post('/approve-subscription', protect, approveSubscription);

// @route   POST /api/paypal/webhook
// @desc    Handle incoming PayPal webhook notifications
// @access  Public (Needs verification built-in)
router.post('/webhook', rawBodyWebhook, handleWebhook);

module.exports = router; 