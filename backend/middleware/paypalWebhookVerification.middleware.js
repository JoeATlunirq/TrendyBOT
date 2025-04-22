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
 * Returns null if configuration fails.
 * Note: This client instance is NOT used for the manual verification below,
 * but is set up for potential future use of the SDK's controllers.
 */
function initializePayPalClient() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox';

    console.log(`Initializing PayPal Client: Mode='${mode}', ClientID exists? ${!!clientId}, ClientSecret exists? ${!!clientSecret}`);

    if (!clientId || !clientSecret) {
        console.error('FATAL ERROR: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing or empty.');
        return null;
    }

    // Check required SDK components based on .NET example structure
    if (!paypal || !paypal.Client || !paypal.Environment || !paypal.Environment.Sandbox || !paypal.Environment.Live) {
        console.error("PayPal SDK Client or Environment classes not found! Check SDK installation/version and structure.");
        console.log("Available keys on paypal object:", Object.keys(paypal || {}));
        return null;
    }

    const environment = mode === 'live'
        ? paypal.Environment.Live // Assuming direct access based on .NET example
        : paypal.Environment.Sandbox;

    console.log("Attempting to instantiate paypal.Client with environment:", environment);

    try {
        // Use constructor matching .NET example's builder pattern intent
        const client = new paypal.Client({
            clientCredentialsAuthCredentials: {
                oAuthClientId: clientId,
                oAuthClientSecret: clientSecret
            },
            environment: environment,
        });
        console.log(`PayPal client initialized successfully for ${mode.toUpperCase()} mode.`);
        return client;
    } catch (error) {
        console.error("Error initializing PayPal Client:", error);
        return null;
    }
}

// Initialize client once, primarily as a configuration check
const paypalClientInstance = initializePayPalClient(); 

/**
 * Verifies the signature of an incoming PayPal webhook MANUALLY based on API docs.
 * Reference: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 */
const verifyPayPalWebhook = async (req, res, next) => {
    console.log("Attempting MANUAL PayPal webhook verification...");

    // Log if client init failed earlier, but proceed with manual check
    if (!paypalClientInstance) {
         console.warn("PayPal Client instance is null (config error during init), but proceeding with manual verification.");
    }
    
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionSig = req.headers['paypal-transmission-sig']; // Base64 encoded
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo']; // e.g., "SHA256withRSA"
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const rawBody = req.body; // Raw Buffer from express.raw()

    if (!transmissionId || !transmissionSig || !transmissionTime || !certUrl || !authAlgo || !webhookId || !rawBody || Buffer.byteLength(rawBody) === 0) {
        console.error('Webhook verification failed: Missing required headers, webhook ID, or body is empty.');
        return res.status(400).send('Webhook verification failed: Missing parameters or empty body.');
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
        // Ensure rawBody is definitely a Buffer
        if (!Buffer.isBuffer(rawBody)) {
            console.error("rawBody is not a Buffer before CRC calculation!");
            return res.status(500).send('Webhook verification failed: Invalid body type.');
        }
        
        // Calculate CRC32 checksum
        const crc32Value = crc32(rawBody); // Calculate as a number
        const crc32ChecksumString = crc32Value.toString(16); // Convert to hex string
        console.log(`Calculated CRC32 Value (Number): ${crc32Value}`);
        console.log(`Calculated CRC32 Checksum (Hex String): ${crc32ChecksumString}`);
        
        const expectedSignatureBase = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32ChecksumString}`;
        const expectedSignatureBaseBuffer = Buffer.from(expectedSignatureBase, 'utf-8'); // Use explicit encoding
        console.log("Constructed signature base string: " + expectedSignatureBase);
        console.log("Constructed signature base Buffer length: " + expectedSignatureBaseBuffer.length);

        // --- Step 5: Verify Signature --- 
        const signatureBuffer = Buffer.from(transmissionSig, 'base64');
        console.log(`Received Transmission Signature (Base64): ${transmissionSig}`);
        console.log(`Decoded Signature Buffer length: ${signatureBuffer.length}`);
        let isVerified = false;
        try {
            let nodeAlgorithm = authAlgo;
            if (authAlgo.toUpperCase() === 'SHA256WITHRSA') {
                nodeAlgorithm = 'RSA-SHA256';
            }
             // Add mapping for other algorithms if needed
            else { 
                 console.warn(`Unsupported PayPal auth algorithm received: ${authAlgo}. Verification will likely fail.`);
            }
            console.log(`Using Node.js crypto algorithm: ${nodeAlgorithm}`);
            if (!publicKey || typeof publicKey !== 'object') { 
                 console.error("Public key is invalid or missing before crypto.verify");
                 return res.status(500).send('Webhook verification failed: Invalid public key.');
            }

            isVerified = crypto.verify(
                nodeAlgorithm, 
                expectedSignatureBaseBuffer, // Use the explicitly encoded buffer
                publicKey, 
                signatureBuffer 
            );
        } catch (verifyError) {
             console.error('Error during crypto.verify:', verifyError); 
             console.error(`Crypto verify failed with algorithm: ${nodeAlgorithm}, Error Code: ${verifyError.code}`);
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
         if (error?.response?.status === 404 && error.config?.url === certUrl) {
            return res.status(500).send('Webhook verification failed: Could not fetch certificate.');
        }
        return res.status(500).send('Webhook verification failed due to server error.');
    }
};

module.exports = { verifyPayPalWebhook }; 