// backend/middleware/paypalWebhookVerification.middleware.js
// IMPORTANT: This is a placeholder. You MUST implement actual PayPal webhook verification.
// Requires PayPal SDK or manual implementation based on:
// https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

const axios = require('axios');
const crypto = require('crypto');
const { crc32 } = require('crc'); // Use crc package for CRC32 checksum
const paypal = require('@paypal/paypal-server-sdk'); // Use the correct SDK

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
 * Creates and configures a PayPal API client instance using @paypal/paypal-server-sdk.
 * Returns null if configuration fails (e.g., missing env vars or SDK components).
 */
function initializePayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox';

    // Log the values being read from environment
    console.log(`Initializing PayPal Client: Mode='${mode}', ClientID exists? ${!!clientId}, ClientSecret exists? ${!!clientSecret}`);

    if (!clientId || !clientSecret) {
        console.error('FATAL ERROR: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing or empty in environment variables.');
        return null;
    }

    if (!paypal || !paypal.Client || !paypal.Environment || !paypal.Environment.Sandbox || !paypal.Environment.Live) {
        console.error("PayPal SDK Client or Environment classes not found! Check SDK installation/version.");
        return null;
    }

    const environment = mode === 'live' 
        ? paypal.Environment.Live 
        : paypal.Environment.Sandbox;
    
    // Log before attempting instantiation
    console.log("Attempting to instantiate paypal.Client with environment:", environment);
    console.log("Credentials Used: ClientID=", clientId ? 'PROVIDED' : 'MISSING', " Secret=", clientSecret ? 'PROVIDED' : 'MISSING');

    try {
        const clientConfig = {
            clientCredentialsAuthCredentials: {
                oAuthClientId: clientId,
                oAuthClientSecret: clientSecret
            },
            environment: environment,
        };
        console.log("Using Client Config:", JSON.stringify(clientConfig, null, 2)); // Log the config object
        const client = new paypal.Client(clientConfig);
        console.log(`PayPal client initialized successfully for ${mode.toUpperCase()} mode.`);
        return client;
    } catch (error) {
        console.error("Error initializing PayPal Client:", error); // Ensure the actual error is logged
        return null;
    }
}

// Initialize client once when the middleware module loads
const paypalClientInstance = initializePayPalClient();

/**
 * Verifies the signature of an incoming PayPal webhook MANUALLY based on API docs.
 * Reference: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 */
const verifyPayPalWebhook = async (req, res, next) => {
    console.log("Attempting MANUAL PayPal webhook verification...");

    // Note: The paypalClientInstance isn't directly used for MANUAL verification,
    // but it's good practice to ensure the SDK is generally configured correctly.
    if (!paypalClientInstance) {
         console.error("PayPal Client instance is null. Cannot proceed with verification (config error).");
         return res.status(500).send('Webhook processing failed: Server configuration error.');
    }
    
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionSig = req.headers['paypal-transmission-sig']; // Base64 encoded
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo']; // e.g., "SHA256withRSA"
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const rawBody = req.body; // Raw Buffer from express.raw()

    if (!transmissionId || !transmissionSig || !transmissionTime || !certUrl || !authAlgo || !webhookId || !rawBody) {
        console.error('Webhook verification failed: Missing required headers, webhook ID, or body.');
        return res.status(400).send('Webhook verification failed: Missing parameters.');
    }

    try {
        // --- Step 1: Fetch the certificate --- 
        console.log(`Fetching certificate from: ${certUrl}`);
        let certResponse;
        try {
             certResponse = await axios.get(certUrl, { responseType: 'text' });
        } catch (fetchError) {
             console.error(`Failed to fetch certificate from ${certUrl}:`, fetchError.message);
             return res.status(500).send('Webhook verification failed: Could not fetch certificate.');
        }
        const serverCertPem = certResponse.data;
        
        // --- Step 2: Verify Certificate Chain (Placeholder) ---
        console.warn('Certificate chain verification is currently SKIPPED. Implement for production!');
        
        // --- Step 3: Extract Public Key --- 
        let publicKey;
        try {
            const certificate = crypto.createPublicKey(serverCertPem);
            publicKey = certificate;
        } catch (keyError) {
            console.error('Failed to extract public key from certificate:', keyError);
            return res.status(500).send('Webhook verification failed: Invalid certificate format.');
        }

        // --- Step 4: Construct Signature String --- 
        const crc32Checksum = crc32(rawBody).toString(16);
        const expectedSignatureBase = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32Checksum}`;
        console.log("Constructed signature base string (length " + expectedSignatureBase.length + ")");

        // --- Step 5: Verify Signature --- 
        const signatureBuffer = Buffer.from(transmissionSig, 'base64');
        let isVerified = false;
        try {
            let nodeAlgorithm = authAlgo;
            if (authAlgo.toUpperCase() === 'SHA256WITHRSA') {
                nodeAlgorithm = 'RSA-SHA256';
            }
            
            isVerified = crypto.verify(
                nodeAlgorithm, 
                Buffer.from(expectedSignatureBase),
                publicKey, 
                signatureBuffer 
            );
        } catch (verifyError) {
             console.error('Error during crypto.verify:', verifyError);
             return res.status(500).send('Webhook verification failed: Crypto error.');
        }
        
        console.log("Crypto verification result:", isVerified);

        if (isVerified) {
            console.log("Manual PayPal webhook verification successful.");
            try {
                req.body = JSON.parse(rawBody.toString('utf-8'));
                console.log("Webhook body parsed successfully.");
                next();
            } catch (parseError) {
                console.error("Failed to parse webhook body after successful verification:", parseError);
                return res.status(400).send('Invalid JSON body in webhook.');
            }
        } else {
            console.error('Webhook verification failed: Signature mismatch.');
            return res.status(403).send('Webhook verification failed: Invalid signature.');
        }
    } catch (error) {
        console.error('Error during manual webhook verification process:', error);
        return res.status(500).send('Webhook verification failed due to server error.');
    }
};

module.exports = { verifyPayPalWebhook }; 