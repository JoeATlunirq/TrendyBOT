const express = require('express');
const { approveSubscription, handleWebhook } = require('../controllers/paypal.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// @route   POST /api/paypal/approve-subscription
// @desc    Verify PayPal subscription and update user plan
// @access  Private
router.post('/approve-subscription', protect, approveSubscription);

// @route   POST /api/paypal/webhook
// @desc    Handle incoming PayPal webhook notifications
// @access  Public (Needs verification built-in)
router.post('/webhook', (req, res, next) => {
  console.log('>>> POST /api/paypal/webhook ROUTE HIT <<<');
  next();
}, handleWebhook);

module.exports = router; 