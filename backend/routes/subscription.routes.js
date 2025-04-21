// backend/routes/subscription.routes.js
const express = require('express');
const { handleSubscriptionSuccess } = require('../controllers/subscription.controller');
const { verifyPayPalWebhook } = require('../middleware/paypalWebhookVerification.middleware');

const router = express.Router();

// Define the endpoint for receiving subscription success events
// Example: POST /api/subscriptions/webhook
// Apply webhook verification middleware before the controller
router.post(
    '/webhook', 
    verifyPayPalWebhook,
    handleSubscriptionSuccess
);

// You might add other subscription-related routes here later (e.g., cancel, get status)

module.exports = router; 