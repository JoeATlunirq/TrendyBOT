const NocoDBService = require('../services/nocodb.service');
const paypalClient = require('../config/paypalClient'); // Import the configured client (axios implementation)
// SDK still potentially needed for other things, but not primary verification
const paypal = require('@paypal/paypal-server-sdk'); 
const crypto = require('crypto'); // Required for manual verification
const https = require('https'); // Required to fetch certificate
const crc32 = require('crc/crc32'); // Required for CRC32 checksum
const { sendToUser } = require('../server'); // Import the WebSocket helper

// Destructure specific webhook verification methods if available (or use direct SDK object)
// Assuming the verification methods might be directly available
// const { verifyWebhookSignature } = paypal.webhooks; // Adjust path if needed based on SDK structure

// Get PayPal Webhook ID from environment
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// Expected PayPal certificate CNs (adjust if necessary based on PayPal docs)
const PAYPAL_CERT_CNS = ['*.paypal.com', '*.paypalcorp.com'];

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

// Helper function to fetch the certificate from PayPal
const getPayPalCert = (certUrl) => {
    return new Promise((resolve, reject) => {
        https.get(certUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
};

/**
 * @desc    Handle incoming PayPal webhook events
 * @route   POST /api/paypal/webhook
 * @access  Public (Verification required)
 */
const handleWebhook = async (req, res, next) => {
    console.log('PayPal Webhook Received');
    
    const headers = req.headers;
    const rawBody = req.body; // Expecting raw Buffer
    let eventBody;

    // --- Check prerequisites ---
    if (!PAYPAL_WEBHOOK_ID) {
        console.error('FATAL: PAYPAL_WEBHOOK_ID environment variable not set!');
        return res.status(500).send('Webhook ID configuration error');
    }
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
         console.error('Webhook Error: Raw body not available or not a Buffer on request object.');
         return res.status(400).send('Bad Request: Missing or invalid raw body');
    }
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionTime = headers['paypal-transmission-time'];
    const transmissionSig = headers['paypal-transmission-sig'];
    const certUrl = headers['paypal-cert-url'];
    const authAlgo = headers['paypal-auth-algo'];

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
        console.error('Webhook Error: Missing required PayPal headers for verification.');
        return res.status(400).send('Bad Request: Missing verification headers');
    }

    try {
        console.log('Attempting MANUAL webhook signature verification...');
        
        // --- Step 1: Fetch PayPal Certificate --- 
        const certPem = await getPayPalCert(certUrl);
        const certificate = new crypto.X509Certificate(certPem);
        const publicKey = certificate.publicKey;

        // --- Step 2: Verify Certificate (Basic CN Check) --- 
        // More robust chain validation could be added if needed
        const subjectCN = certificate.subject.split('CN=')[1];
        const isCertValid = PAYPAL_CERT_CNS.some(cn => {
            if (cn.startsWith('*.')) {
                return subjectCN.endsWith(cn.substring(1));
            } 
            return subjectCN === cn;
        });

        if (!isCertValid) {
             console.error(`Webhook Error: Certificate CN (${subjectCN}) does not match expected PayPal domains.`);
             return res.status(400).send('Invalid certificate');
        }
        console.log(`Certificate CN (${subjectCN}) validated.`);

        // --- Step 3: Construct Signature String --- 
        const bodyString = rawBody.toString('utf8');
        const crc32Checksum = crc32(bodyString).toString(16); // Calculate CRC32 checksum
        const expectedSignature = `${transmissionId}|${transmissionTime}|${PAYPAL_WEBHOOK_ID}|${crc32Checksum}`;
        console.log('Constructed signature string for verification.');

        // --- Step 4: Verify Signature --- 
        const verifier = crypto.createVerify(authAlgo.replace("with", "-")); // e.g., SHA256-RSA
        verifier.update(expectedSignature);
        const isSignatureValid = verifier.verify(publicKey, transmissionSig, 'base64');

        if (!isSignatureValid) {
            console.error('Webhook Error: Signature verification failed.');
            return res.status(400).send('Invalid signature');
        }
        console.log('Webhook signature verified successfully (MANUAL).');

        // --- Step 5: Process Verified Event --- 
        eventBody = JSON.parse(bodyString); // Parse body now that it's verified
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

            // Find User in NocoDB 
            const user = await NocoDBService.findUserBySubscriptionId(cancelledSubscriptionId);

            if (!user) {
                console.warn(`Received cancellation webhook for subscription ${cancelledSubscriptionId}, but no matching user found in DB.`);
                return res.status(200).send('Webhook received, user not found');
            }
            console.log(`Found user ${user.Id} for cancelled subscription ${cancelledSubscriptionId}`);

            // Update User in NocoDB
            const dataToUpdate = {
                [NOCODB_CURRENT_PLAN_COLUMN || 'current_plan']: null, 
                [NOCODB_SUB_STATUS_COLUMN || 'subscription_status']: 'CANCELLED'
            };
            console.log(`Updating user ${user.Id} with data:`, dataToUpdate);
            await NocoDBService.updateUser(user.Id, dataToUpdate);
            console.log(`User ${user.Id} successfully updated for cancellation.`);

            // --- Notify Frontend via WebSocket ---
            sendToUser(user.Id, { 
                type: 'subscriptionUpdate', 
                payload: { 
                    plan: null, 
                    status: 'CANCELLED' 
                }
            });
            // -------------------------------------

        } 
        // --- Handle Activation/Update Events ---
        else if (['BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED', 'PAYMENT.SALE.COMPLETED'].includes(eventType)) {
            console.log(`Processing ${eventType} event...`);
            let subscriptionId = eventBody.resource?.id; // For SUBSCRIPTION events
            let relevantSubscriptionId = subscriptionId; // Default to the main resource ID
            let planId = eventBody.resource?.plan_id; 
            let status = eventBody.resource?.status; // Usually ACTIVE for these events

            // For PAYMENT.SALE.COMPLETED, the subscription ID is nested
            if (eventType === 'PAYMENT.SALE.COMPLETED') {
                 // Check if this is related to a subscription agreement
                 const billingAgreementId = eventBody.resource?.billing_agreement_id;
                 if (billingAgreementId) {
                      console.log(`Payment related to Billing Agreement (Subscription ID): ${billingAgreementId}`);
                      relevantSubscriptionId = billingAgreementId; // This is the ID we store
                 } else {
                      console.log('Payment sale completed, but not linked to a known subscription/agreement. Ignoring.');
                      return res.status(200).send('Webhook received, payment not linked to subscription'); 
                 }
                 // We might need to fetch the subscription details using billingAgreementId 
                 // if plan_id and status aren't directly in the PAYMENT event.
                 // This adds complexity and an API call. Let's assume ACTIVATED/UPDATED events
                 // are the primary source for plan changes for now.
                 // If only PAYMENT.SALE.COMPLETED is used for activation, fetch is needed.
                 // For now, let's log a warning if planId/status are missing here.
                 if (!planId || !status) {
                     console.warn(`PAYMENT.SALE.COMPLETED for ${relevantSubscriptionId} missing direct plan_id or status. Relying on subsequent ACTIVATED/UPDATED events.`);
                     // Optionally, you could trigger a fetch here if necessary
                     // const subDetails = await paypalClient.getSubscription(relevantSubscriptionId);
                     // planId = subDetails.plan_id;
                     // status = subDetails.status;
                 }
            }

            if (!relevantSubscriptionId) {
                console.error(`Could not extract subscription ID from ${eventType} event resource.`);
                return res.status(400).send('Malformed event data');
            }
            if (!planId) {
                console.warn(`Could not extract plan ID from ${eventType} event for subscription ${relevantSubscriptionId}. May need separate fetch or rely on other events.`);
                 // Cannot proceed without a plan ID to map
                 return res.status(200).send('Webhook received, plan ID missing'); 
            }
            if (!status || status !== 'ACTIVE') {
                 console.warn(`Subscription status from ${eventType} event for ${relevantSubscriptionId} is ${status}. Processing only ACTIVE status.`);
                 return res.status(200).send('Webhook received, status not ACTIVE');
            }

            console.log(`Subscription ID: ${relevantSubscriptionId}, Plan ID: ${planId}, Status: ${status}`);

            // Map Plan ID
            const planName = PAYPAL_PLAN_MAP[planId];
            if (!planName) {
                 console.error(`Could not map PayPal Plan ID ${planId} (from ${eventType}) to an internal plan name.`);
                 // Don't error out completely, but log issue
                 return res.status(200).send('Webhook received, unknown plan ID'); 
            }
            console.log(`Mapped Plan ID ${planId} to internal plan: ${planName}`);

            // Find User in NocoDB 
            const user = await NocoDBService.findUserBySubscriptionId(relevantSubscriptionId);
            if (!user) {
                console.warn(`Received ${eventType} webhook for subscription ${relevantSubscriptionId}, but no matching user found. Maybe initial activation via approveSubscription?`);
                // This might happen if the webhook arrives before approveSubscription finishes OR
                // if the user signed up directly via PayPal without going through the app flow first.
                // Decide how to handle this - maybe create a pending record or ignore.
                return res.status(200).send('Webhook received, user not found');
            }
            console.log(`Found user ${user.Id} for subscription ${relevantSubscriptionId}`);

            // Update User in NocoDB
            const dataToUpdate = {
                [NOCODB_CURRENT_PLAN_COLUMN || 'current_plan']: planName,
                [NOCODB_SUB_STATUS_COLUMN || 'subscription_status']: 'ACTIVE' // Assuming these events mean ACTIVE
                // We might already have the correct subscription ID from approveSubscription
            };
            console.log(`Updating user ${user.Id} based on ${eventType} event with data:`, dataToUpdate);
            await NocoDBService.updateUser(user.Id, dataToUpdate);
            console.log(`User ${user.Id} successfully updated.`);

            // --- Notify Frontend via WebSocket ---
            sendToUser(user.Id, { 
                type: 'subscriptionUpdate', 
                payload: { 
                    plan: planName, 
                    status: 'ACTIVE' 
                }
            });
            // -------------------------------------
        }
        // -------------------------------------
        else {
            console.log(`Ignoring unhandled event type: ${eventType}`);
        }

        // --- Step 6: Respond to PayPal --- 
        res.status(200).send('Webhook received successfully');

    } catch (error) {
        console.error('Webhook Handler Error (Manual Verification/Processing):', error);
        res.status(500).send('Webhook processing error');
    }
};

module.exports = {
    approveSubscription,
    handleWebhook, // Export the new function
}; 