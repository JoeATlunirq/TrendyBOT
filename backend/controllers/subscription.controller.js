const SubscriptionLogicService = require('../services/subscriptionLogic.service'); // Adjust path

/**
 * Handles successful subscription events (e.g., from webhooks).
 * Determines the plan and calls the appropriate logic function.
 */
const handleSubscriptionSuccess = async (req, res, next) => {
    // IMPORTANT: Add security checks here!
    // 1. Verify webhook signature if applicable.
    // 2. Ensure the request comes from a trusted source.

    // Extract necessary data from the request body (adapt based on your webhook/trigger)
    const userId = req.body.userId; // Example: Get user ID from webhook payload
    const planName = req.body.planName; // Example: Get plan name

    if (!userId) {
        console.warn('Subscription webhook received without userId.');
        return res.status(400).json({ error: 'Bad Request', message: 'User ID is missing.' });
    }
    if (!planName) {
        console.warn(`Subscription webhook for user ${userId} received without planName.`);
        return res.status(400).json({ error: 'Bad Request', message: 'Plan name is missing.' });
    }

    console.log(`Processing subscription success event for user: ${userId}, plan: ${planName}`);

    try {
        let result;
        if (planName === 'Viral') {
            result = await SubscriptionLogicService.handleViralSubscription(userId);
        } else if (planName === 'Surge' || planName === 'Spark') {
            result = await SubscriptionLogicService.handleOtherSubscription(userId, planName);
        } else {
            console.warn(`Received subscription success event for unknown plan: ${planName} for user ${userId}`);
            return res.status(400).json({ error: 'Bad Request', message: `Unsupported plan name: ${planName}` });
        }

        if (result.success) {
            console.log(`Successfully handled subscription for user ${userId}, plan ${planName}.`);
            // Respond 200 OK to acknowledge webhook receipt
            res.status(200).json({ message: result.message, accessCode: result.accessCode });
        } else {
            // The service function handled the error internally and logged it
            console.error(`Failed to handle subscription for user ${userId}, plan ${planName}: ${result.message}`);
            // Respond with an error status so webhook provider might retry
            res.status(500).json({ error: 'Internal Server Error', message: result.message });
        }

    } catch (error) {
        // Catch unexpected errors during the controller execution itself
        console.error(`Unexpected error in handleSubscriptionSuccess for user ${userId}, plan ${planName}:`, error);
        // Pass to generic error handler
        next(error);
    }
};

module.exports = { handleSubscriptionSuccess }; 