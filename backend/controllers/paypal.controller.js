const NocoDBService = require('../services/nocodb.service');
const paypalClient = require('../config/paypalClient'); // Import the configured client (now using axios)
const paypal = require('@paypal/paypal-server-sdk'); // Still need SDK for verification

// Destructure specific webhook verification methods if available (or use direct SDK object)
// Assuming the verification methods might be directly available
// const { verifyWebhookSignature } = paypal.webhooks; // Adjust path if needed based on SDK structure

// Get PayPal Webhook ID from environment
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// Destructure column names from environment variables
const { 
    NOCODB_CURRENT_PLAN_COLUMN,
    NOCODB_PAYPAL_SUB_ID_COLUMN,
    NOCODB_SUB_STATUS_COLUMN
} = process.env;

// --- IMPORTANT: PLAN ID MAPPING --- 
// This maps the PayPal Plan IDs (from your dashboard) to your internal plan names.
// You MUST update these with your ACTUAL PayPal Plan IDs.
const PAYPAL_PLAN_MAP = {
    'P-4Y4434518B3747137NACRKNY': 'Spark', // Replace if needed
    'P-6NC15818DS298615RNACRLEY': 'Surge', // Replace if needed
    'P-4XX40417EU7326443NACRM4Q': 'Viral'  // Replace if needed
};
// ------------------------------------

/**
 * @desc    Verify PayPal subscription and update user plan in DB
 * @route   POST /api/paypal/approve-subscription
 * @access  Private
 */
const approveSubscription = async (req, res, next) => {
    const userId = req.userId;
    const { subscriptionID } = req.body;

    if (!userId || !subscriptionID) {
        return res.status(401).json({ message: 'Not authorized, user ID or subscriptionID missing' });
    }

    console.log(`Received approval for Subscription ID: ${subscriptionID} for User ID: ${userId}`);

    try {
        // --- Step 1: Verify Subscription with PayPal SDK ---
        console.log(`Verifying PayPal Subscription ID: ${subscriptionID}...`);
        // Create a simple object that mimics the request for the mock client
        const request = { subscriptionId: subscriptionID };
        let subscriptionDetails;
        try {
             subscriptionDetails = await paypalClient.execute(request);
             console.log("Subscription verification result:", JSON.stringify(subscriptionDetails));
        } catch (paypalError) {
             console.error("PayPal API Error during subscription fetch:", paypalError.message);
             // Forward PayPal's specific error if possible
             const statusCode = paypalError.statusCode || 500;
             const message = paypalError.message || "Failed to retrieve subscription details from PayPal.";
             return res.status(statusCode).json({ message: message });
        }
       
        console.log("PayPal Subscription Details Status:", subscriptionDetails?.result?.status);

        // --- Step 2: Check Status and Get Plan ID ---
        const verifiedStatus = subscriptionDetails?.result?.status;
        const paypalPlanId = subscriptionDetails?.result?.plan_id;

        if (verifiedStatus !== 'ACTIVE') {
            console.error(`PayPal subscription ${subscriptionID} not active. Status: ${verifiedStatus}`);
            return res.status(400).json({ message: `PayPal subscription status is ${verifiedStatus}, expected ACTIVE.` });
        }
        if (!paypalPlanId) {
             console.error(`Could not extract PayPal Plan ID from subscription details for ${subscriptionID}`);
             return res.status(500).json({ message: 'Could not determine plan from PayPal subscription.' });
        }

        // --- Step 3: Map PayPal Plan ID to Internal Plan Name ---
        const planName = PAYPAL_PLAN_MAP[paypalPlanId];
        if (!planName) {
             console.error(`Could not map PayPal Plan ID ${paypalPlanId} to an internal plan name.`);
             return res.status(500).json({ message: 'Server configuration error: Unknown Plan ID mapping.' });
        }
        console.log(`Verification successful. Mapping PayPal Plan ID ${paypalPlanId} to Internal Plan: ${planName}`);

        // --- Step 4: Update NocoDB --- 
        const dataToUpdate = {
            [NOCODB_CURRENT_PLAN_COLUMN || 'current_plan']: planName,
            [NOCODB_PAYPAL_SUB_ID_COLUMN || 'paypal_subscription_id']: subscriptionID,
            [NOCODB_SUB_STATUS_COLUMN || 'subscription_status']: 'ACTIVE' 
        };
        console.log(`Updating NocoDB for user ${userId} with data:`, dataToUpdate);
        await NocoDBService.updateUser(userId, dataToUpdate);
        console.log(`NocoDB update successful for user ${userId}`);

        // --- Step 5: Respond to Frontend --- 
        res.status(200).json({
            message: `Subscription to ${planName} plan activated successfully!`,
        });

    } catch (error) {
        // Handle errors from NocoDB update or other unexpected issues
        console.error('Approve Subscription - General Error:', error);
        next(error); // Pass to generic error handler
    }
};

/**
 * @desc    Handle incoming PayPal webhook events
 * @route   POST /api/paypal/webhook
 * @access  Public (Verification required)
 */
const handleWebhook = async (req, res, next) => {
    console.log('PayPal Webhook Received');
    
    // --- Step 1: Verify Webhook Signature --- 
    const headers = req.headers;
    const rawBody = req.rawBody;
    let eventBody;

    if (!PAYPAL_WEBHOOK_ID) {
        console.error('FATAL: PAYPAL_WEBHOOK_ID environment variable not set!');
        return res.status(500).send('Webhook ID configuration error');
    }
    if (!rawBody) {
         console.error('Webhook Error: Raw body not available on request object.');
         return res.status(400).send('Bad Request: Missing raw body');
    }

    try {
        eventBody = JSON.parse(rawBody.toString()); // Parse body early for verification
        console.log('Attempting to verify webhook signature...');

        // Construct the verification request parameters
        const verificationParams = {
            authAlgo: headers['paypal-auth-algo'],
            certUrl: headers['paypal-cert-url'],
            transmissionId: headers['paypal-transmission-id'],
            transmissionSig: headers['paypal-transmission-sig'],
            transmissionTime: headers['paypal-transmission-time'],
            webhookId: PAYPAL_WEBHOOK_ID,
            webhookEvent: eventBody 
        };

        // --- Attempt Real Verification --- 
        console.log('Using SDK for verification with params:', Object.keys(verificationParams)); 
        
        // Check if the verification function exists before calling
        if (paypal.webhooks && typeof paypal.webhooks.verifyWebhookSignature === 'function') {
             const verificationResult = await paypal.webhooks.verifyWebhookSignature(verificationParams);
             const verificationStatus = verificationResult.verification_status; // Extract status
             console.log('Webhook Verification Status:', verificationStatus);
    
             if (verificationStatus !== 'SUCCESS') {
                 console.error('Webhook verification failed:', verificationStatus);
                 return res.status(400).send('Webhook verification failed');
             }
        } else {
             // Fallback or error if the function doesn't exist as expected
             console.error('ERROR: paypal.webhooks.verifyWebhookSignature function not found on SDK object!');
             // TODO: Implement manual verification or investigate SDK structure further
             // For now, fail verification if function is missing
             return res.status(500).send('Webhook verification method not available');
        }
       
        console.log('Webhook signature verified successfully.');

        // --- Step 2: Process Verified Event --- 
        const eventType = eventBody.event_type;
        console.log(`Received verified event type: ${eventType}`);

        if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
            console.log('Processing BILLING.SUBSCRIPTION.CANCELLED event...');
            const cancelledSubscriptionId = eventBody.resource?.id;
            
            if (!cancelledSubscriptionId) {
                console.error('Could not extract subscription ID from CANCELLED event resource.');
                return res.status(400).send('Malformed cancellation event');
            }
            console.log(`Subscription ID to cancel: ${cancelledSubscriptionId}`);

            // --- Step 3: Find User in NocoDB --- 
            const user = await NocoDBService.findUserBySubscriptionId(cancelledSubscriptionId);

            if (!user) {
                console.warn(`Received cancellation webhook for subscription ${cancelledSubscriptionId}, but no matching user found in DB.`);
                // Still return 200 OK to PayPal, as the event itself was valid
                return res.status(200).send('Webhook received, user not found');
            }
            console.log(`Found user ${user.Id} for cancelled subscription ${cancelledSubscriptionId}`);

            // --- Step 4: Update User in NocoDB --- 
            const dataToUpdate = {
                [NOCODB_CURRENT_PLAN_COLUMN || 'current_plan']: null, // Set plan to null or empty string
                [NOCODB_SUB_STATUS_COLUMN || 'subscription_status']: 'CANCELLED'
            };
            console.log(`Updating user ${user.Id} with data:`, dataToUpdate);
            await NocoDBService.updateUser(user.Id, dataToUpdate);
            console.log(`User ${user.Id} successfully updated for cancellation.`);
        } 
        // TODO: Add handlers for other relevant events (e.g., PAYMENT.SALE.COMPLETED, BILLING.SUBSCRIPTION.ACTIVATED, etc.)
        else {
            console.log(`Ignoring unhandled event type: ${eventType}`);
        }

        // --- Step 5: Respond to PayPal --- 
        res.status(200).send('Webhook received successfully');

    } catch (error) {
        console.error('Webhook Handler Error:', error);
        res.status(500).send('Webhook processing error');
    }
};

module.exports = {
    approveSubscription,
    handleWebhook, // Export the new function
}; 