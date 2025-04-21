// backend/middleware/paypalWebhookVerification.middleware.js
// IMPORTANT: This is a placeholder. You MUST implement actual PayPal webhook verification.
// Requires PayPal SDK or manual implementation based on:
// https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

/**
 * Creates a PayPal HTTP client instance based on environment variables.
 */
function environment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox'; // Default to sandbox

    if (!clientId || !clientSecret) {
        console.error('FATAL ERROR: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in environment variables.');
        // Depending on setup, you might want to throw or exit here
        // For now, we'll return null which will cause verification to fail downstream
        return null; 
    }

    if (mode === 'live') {
        return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
    } else {
        return new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
    }
}

function client() {
    const env = environment();
    if (!env) {
        return null; // Propagate the error if env setup failed
    }
    return new checkoutNodeJssdk.core.PayPalHttpClient(env);
}

/**
 * Verifies the signature of an incoming PayPal webhook using the SDK.
 */
const verifyPayPalWebhook = async (req, res, next) => {
    console.log("Attempting PayPal webhook verification...");
    
    // Check if PayPal client initialized correctly
    const paypalClient = client();
    if (!paypalClient) {
        console.error("PayPal client could not be initialized. Check environment variables.");
        return res.status(500).send('Webhook verification failed: Server configuration error.');
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.error('FATAL ERROR: PAYPAL_WEBHOOK_ID is missing. Cannot verify webhook.');
        return res.status(500).send('Webhook verification failed: Server configuration error.');
    }

    // Construct the request for the PayPal SDK
    // The SDK requires the headers and the raw body (buffer)
    const request = new checkoutNodeJssdk.webhooks.WebhooksVerifySignatureRequest();
    request.webhookId(webhookId);
    request.transmissionId(req.headers['paypal-transmission-id']);
    request.transmissionSig(req.headers['paypal-transmission-sig']);
    request.transmissionTime(req.headers['paypal-transmission-time']);
    request.authAlgo(req.headers['paypal-auth-algo']);
    request.certUrl(req.headers['paypal-cert-url']);
    request.requestBody(req.body); // Pass the raw Buffer body

    try {
        console.log("Executing PayPal SDK verifyWebhookSignature...");
        const response = await paypalClient.execute(request);
        const verificationStatus = response?.result?.verification_status;

        console.log("PayPal SDK Verification Response Status:", verificationStatus);

        if (verificationStatus === 'SUCCESS') {
            console.log("PayPal webhook verification successful.");
            // IMPORTANT: Parse the raw body to JSON for the next middleware/controller
            try {
                // req.body is still the raw Buffer here
                req.body = JSON.parse(req.body.toString('utf-8')); 
            } catch (parseError) {
                console.error("Failed to parse webhook body after successful verification:", parseError);
                return res.status(400).send('Invalid JSON body in webhook.');
            }
            next(); // Proceed to the controller
        } else {
            console.error(`Webhook verification failed: Status=${verificationStatus}`);
            return res.status(403).send('Webhook verification failed: Invalid signature.');
        }
    } catch (error) {
        console.error('Error executing PayPal webhook verification:', error?.message || error);
        // Log the detailed error if available (e.g., from SDK)
        if (error.isAxiosError && error.response) { // Example check for Axios errors if SDK uses it
             console.error("PayPal SDK Error Details:", error.response.data);
        }
        return res.status(500).send('Webhook verification failed due to server error.');
    }
};

module.exports = { verifyPayPalWebhook }; 