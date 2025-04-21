// backend/routes/subscription.routes.js
const express = require('express');
const { handleSubscriptionSuccess } = require('../controllers/subscription.controller');
// TODO: Import and add webhook verification middleware if needed
// const { verifyWebhookSignature } = require('../middleware/webhookVerification.middleware');

const router = express.Router();

// Define the endpoint for receiving subscription success events
// Example: POST /api/subscriptions/webhook
// Apply webhook verification middleware before the controller
router.post(
    '/webhook', 
    // express.raw({ type: 'application/json' }), // Needed if verifying raw body signature
    // verifyWebhookSignature, // Add your verification middleware here
    handleSubscriptionSuccess
);

// You might add other subscription-related routes here later (e.g., cancel, get status)

module.exports = router; 