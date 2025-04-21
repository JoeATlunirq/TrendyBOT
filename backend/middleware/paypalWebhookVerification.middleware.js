// backend/middleware/paypalWebhookVerification.middleware.js
// IMPORTANT: This is a placeholder. You MUST implement actual PayPal webhook verification.
// Requires PayPal SDK or manual implementation based on:
// https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

const paypal = require('@paypal/paypal-server-sdk');

// Log the structure immediately after import
console.log("PayPal Server SDK Import Result (raw):", paypal);
console.log("Keys in PayPal Server SDK Import:", paypal ? Object.keys(paypal) : 'null or undefined');
if (paypal && paypal.core) {
    console.log("Keys in paypal.core:", Object.keys(paypal.core));
}
if (paypal && paypal.Webhooks) { // Or maybe paypal.webhooks?
    console.log("Keys in paypal.Webhooks:", Object.keys(paypal.Webhooks));
}

/**
 * Creates a PayPal HTTP client instance based on environment variables using paypal-server-sdk.
 */
function environment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox';

    if (!clientId || !clientSecret) {
        console.error('FATAL ERROR: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing.');
        return null;
    }

    // Access core components safely
    const core = paypal?.core;
    if (!core) {
        console.error('PayPal SDK core component not found!');
        return null;
    }
    const LiveEnvironment = core.LiveEnvironment;
    const SandboxEnvironment = core.SandboxEnvironment;

    if (!LiveEnvironment || !SandboxEnvironment) {
        console.error('PayPal SDK LiveEnvironment or SandboxEnvironment not found within core!');
        return null;
    }

    if (mode === 'live') {
        return new LiveEnvironment(clientId, clientSecret);
    } else {
        return new SandboxEnvironment(clientId, clientSecret);
    }
}

function client() {
    const env = environment();
    if (!env) {
        return null;
    }
    // Access core components safely
    const core = paypal?.core;
    if (!core) {
        console.error('PayPal SDK core component not found during client creation!');
        return null;
    }
    const PayPalHttpClient = core.PayPalHttpClient;
    if (!PayPalHttpClient) {
        console.error('PayPal SDK PayPalHttpClient component not found within core!');
        return null;
    }
    return new PayPalHttpClient(env);
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

    // Access webhooks components safely
    // Check both capital 'W' and lowercase 'w' as SDKs vary
    const WebhooksNamespace = paypal?.Webhooks || paypal?.webhooks;
    if (!WebhooksNamespace) {
        console.error('PayPal SDK Webhooks component (Webhooks/webhooks) not found!');
        return res.status(500).send('Webhook verification failed: Server configuration error (SDK issue).');
    }

    // Check for the specific verification class/function
    // Common names: WebhookVerifyRequest, VerifyWebhookSignatureRequest, verify
    const VerifyRequestClass = WebhooksNamespace.WebhookVerifyRequest || WebhooksNamespace.VerifyWebhookSignatureRequest;
    if (!VerifyRequestClass) {
        console.error('PayPal SDK Webhook verification class (WebhookVerifyRequest/VerifyWebhookSignatureRequest) not found within Webhooks component!');
        console.log('Available keys under Webhooks namespace:', Object.keys(WebhooksNamespace));
        return res.status(500).send('Webhook verification failed: Server configuration error (SDK issue).');
    }

    // Construct the verification request
    const request = new VerifyRequestClass(); // Use the found class
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
        if (error?.data) { // SDK might provide error details in 'data'
             console.error("PayPal SDK Error Details:", error.data);
        }
        return res.status(500).send('Webhook verification failed due to server error.');
    }
};

module.exports = { verifyPayPalWebhook }; 