const SubscriptionLogicService = require('../services/subscriptionLogic.service');
const COLS = require('../config/nocodb_columns'); // Assuming this is set up

/**
 * Handles successful subscription events from PayPal webhooks.
 */
const handleSubscriptionSuccess = async (req, res, next) => {
    console.log("--- Received Subscription Webhook ---"); 
    // Log headers if needed for debugging, but remove sensitive ones before full logging
    // console.log("Webhook Headers:", JSON.stringify(req.headers, null, 2)); 
    
    // req.body should now be a parsed JSON object because verifyPayPalWebhook middleware parsed it
    const webhookEvent = req.body;
    console.log("Webhook Parsed Body:", JSON.stringify(webhookEvent, null, 2));

    // --- 1. Check Event Type --- 
    const eventType = webhookEvent?.event_type;
    console.log("Webhook Event Type:", eventType);

    // Define the event types we care about for activating/updating plans
    const relevantEvents = [
        'BILLING.SUBSCRIPTION.ACTIVATED', 
        // 'PAYMENT.SALE.COMPLETED' // Only if a sale completion implies subscription activation/payment in your flow
        // Add other relevant successful payment/activation events if needed
    ];

    if (!eventType || !relevantEvents.includes(eventType)) {
        console.log(`Ignoring irrelevant event type: ${eventType}. Sending 200 OK.`);
        return res.status(200).send('Event type ignored.'); // Acknowledge receipt to PayPal
    }

    // --- 2. Extract Data (adapt based on actual payload structure for relevant events) --- 
    let userId = null;
    let paypalPlanId = null;
    const resource = webhookEvent?.resource; // Data is often nested in 'resource'

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
        // For subscription activation, custom_id is often where you store your internal userId
        // plan_id contains PayPal's plan ID
        userId = resource?.custom_id; 
        paypalPlanId = resource?.plan_id;
        console.log(`Parsed from ${eventType}: userId=${userId}, paypalPlanId=${paypalPlanId}`);
    } 
    // Add else if blocks here for other relevantEvents if they structure data differently
    // else if (eventType === 'PAYMENT.SALE.COMPLETED') { ... }

    if (!userId) {
        console.error(`Could not extract userId from webhook resource for event ${eventType}. Resource:`, resource);
        return res.status(400).json({ error: 'Bad Request', message: 'User ID could not be determined from webhook resource.' });
    }
    if (!paypalPlanId) {
        console.error(`Could not extract plan_id from webhook resource for event ${eventType}. Resource:`, resource);
        return res.status(400).json({ error: 'Bad Request', message: 'Plan ID could not be determined from webhook resource.' });
    }

    // --- 3. Map PayPal Plan ID to Internal Plan Name --- 
    let internalPlanName = null;
    if (paypalPlanId === process.env.PAYPAL_VIRAL_PLAN_ID) { 
         internalPlanName = 'Viral';
    } else if (paypalPlanId === process.env.PAYPAL_SURGE_PLAN_ID) {
         internalPlanName = 'Surge';
    } else if (paypalPlanId === process.env.PAYPAL_SPARK_PLAN_ID) {
         internalPlanName = 'Spark';
    }

    if (!internalPlanName) {
        console.warn(`Webhook for user ${userId} contained unrecognized PayPal plan ID: ${paypalPlanId}.`);
        // Decide if this is an error or should be ignored. Ignoring for now.
        return res.status(200).send('Plan ID not relevant to this application.'); 
    }

    console.log(`Processing subscription activation/payment for user: ${userId}, Mapped Plan: ${internalPlanName}`);

    // --- 4. Call Business Logic --- 
    try {
        let result;
        if (internalPlanName === 'Viral') {
            console.log(`Calling handleViralSubscription for user ${userId}`);
            result = await SubscriptionLogicService.handleViralSubscription(userId);
        } else if (internalPlanName === 'Surge' || internalPlanName === 'Spark') {
            console.log(`Calling handleOtherSubscription for user ${userId}, plan ${internalPlanName}`);
            result = await SubscriptionLogicService.handleOtherSubscription(userId, internalPlanName);
        }
        // No else needed because we checked internalPlanName above

        if (result.success) {
            console.log(`Successfully updated DB for user ${userId}, plan ${internalPlanName}. Result:`, result);
            res.status(200).json({ message: result.message }); // Send 200 OK back to PayPal
        } else {
            console.error(`Subscription logic failed for user ${userId}, plan ${internalPlanName}: ${result.message}`);
            res.status(500).json({ error: 'Internal Server Error', message: result.message });
        }

    } catch (error) {
        console.error(`Unexpected error during subscription logic execution for user ${userId}, plan ${internalPlanName}:`, error);
        next(error);
    }
};

module.exports = { handleSubscriptionSuccess }; 