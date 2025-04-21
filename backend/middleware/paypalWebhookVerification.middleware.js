// backend/middleware/paypalWebhookVerification.middleware.js
// IMPORTANT: This is a placeholder. You MUST implement actual PayPal webhook verification.
// Requires PayPal SDK or manual implementation based on:
// https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

const paypal = require('@paypal/paypal-server-sdk'); // Using the correct, non-deprecated SDK

console.log("PayPal Server SDK Import Result:", paypal);
console.log("Keys in PayPal Server SDK Import:", paypal ? Object.keys(paypal) : 'null or undefined');

/**
 * Creates a PayPal HTTP client instance based on environment variables using paypal-server-sdk.
 */
function environment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox'; // Default to sandbox

    if (!clientId || !clientSecret) {
        console.error('FATAL ERROR: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing.');
        return null;
    }

    // Check if core and environments exist
    if (!paypal || !paypal.core || !paypal.core.LiveEnvironment || !paypal.core.SandboxEnvironment) {
        console.error('PayPal SDK core or environment components not found!');
        return null;
    }

    if (mode === 'live') {
        return new paypal.core.LiveEnvironment(clientId, clientSecret);
    } else {
        return new paypal.core.SandboxEnvironment(clientId, clientSecret);
    }
}

function client() {
    const env = environment();
    if (!env) {
        return null;
    }
    // Check if PayPalHttpClient exists
    if (!paypal || !paypal.core || !paypal.core.PayPalHttpClient) {
        console.error('PayPal SDK PayPalHttpClient component not found!');
        return null;
    }
    return new paypal.core.PayPalHttpClient(env);
}

/**
 * Verifies the signature of an incoming PayPal webhook using the paypal-server-sdk.
 */
const verifyPayPalWebhook = async (req, res, next) => {
    console.log("Attempting PayPal webhook verification with @paypal/paypal-server-sdk...");

    const paypalClient = client();
    if (!paypalClient) {
        console.error("PayPal client could not be initialized.");
        return res.status(500).send('Webhook verification failed: Server configuration error.');
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.error('FATAL ERROR: PAYPAL_WEBHOOK_ID is missing.');
        return res.status(500).send('Webhook verification failed: Server configuration error.');
    }

    // Check if the webhooks verification component exists in the new SDK
    // The structure might differ; common patterns include accessing via paypal.webhooks
    if (!paypal || !paypal.Webhooks || !paypal.Webhooks.WebhookVerifyRequest) { // Adjust if class name is different
        console.error('PayPal SDK Webhooks component or VerifyRequest class not found! Check SDK structure.');
        console.log('Available paypal SDK keys:', paypal ? Object.keys(paypal) : 'null or undefined');
        return res.status(500).send('Webhook verification failed: Server configuration error (SDK issue).');
    }

    // Construct the verification request using the new SDK's structure
    // This might require slightly different methods or structure - adjust based on SDK docs if needed
    const request = new paypal.Webhooks.WebhookVerifyRequest(); // Example: Assuming class name
    request.webhookId(webhookId);
    request.transmissionId(req.headers['paypal-transmission-id']);
    request.transmissionSig(req.headers['paypal-transmission-sig']);
    request.transmissionTime(req.headers['paypal-transmission-time']);
    request.authAlgo(req.headers['paypal-auth-algo']);
    request.certUrl(req.headers['paypal-cert-url']);
    request.requestBody(req.body); // Pass the raw Buffer body

    try {
        console.log("Executing PayPal SDK verifyWebhookSignature...");
        // The method to execute might differ slightly in the new SDK
        const response = await paypalClient.execute(request);
        // Check the response structure for verification status - this might change
        const verificationStatus = response?.result?.verification_status; // Assuming similar structure

        console.log("PayPal SDK Verification Response Status:", verificationStatus);

        if (verificationStatus === 'SUCCESS') {
            console.log("PayPal webhook verification successful.");
            try {
                req.body = JSON.parse(req.body.toString('utf-8'));
            } catch (parseError) {
                console.error("Failed to parse webhook body after successful verification:", parseError);
                return res.status(400).send('Invalid JSON body in webhook.');
            }
            next();
        } else {
            console.error(`Webhook verification failed: Status=${verificationStatus}`);
            return res.status(403).send('Webhook verification failed: Invalid signature.');
        }
    } catch (error) {
        console.error('Error executing PayPal webhook verification:', error?.message || error);
        if (error.isAxiosError && error.response) {
             console.error("PayPal SDK Error Details:", error.response.data);
        }
        return res.status(500).send('Webhook verification failed due to server error.');
    }
};

module.exports = { verifyPayPalWebhook }; 