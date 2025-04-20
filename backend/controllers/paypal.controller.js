const NocoDBService = require('../services/nocodb.service');
const paypalClient = require('../config/paypalClient'); // Import the configured client
const paypalCore = require('@paypal/checkout-server-sdk'); // Import core SDK

// Assume PayPal SDK would be configured elsewhere using .env credentials
// const paypal = require('@paypal/checkout-server-sdk'); 
// const paypalClient = require('../config/paypalClient'); // Needs to be created

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
        const request = new paypalCore.subscriptions.SubscriptionsGetRequest(subscriptionID);
        let subscriptionDetails;
        try {
             subscriptionDetails = await paypalClient.execute(request);
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

// TODO: Add webhook handler function

module.exports = {
    approveSubscription,
}; 