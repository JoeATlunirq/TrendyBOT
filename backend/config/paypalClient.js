const paypal = require('@paypal/checkout-server-sdk');

// Get PayPal environment variables
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const mode = process.env.PAYPAL_MODE || 'sandbox'; // Default to sandbox

if (!clientId || clientId.startsWith('PLACEHOLDER')) {
    console.error('FATAL ERROR: PayPal Client ID missing or not set in .env');
    // Optionally throw an error or exit process in a real app
}
if (!clientSecret || clientSecret.startsWith('PLACEHOLDER')) {
    console.error('FATAL ERROR: PayPal Client Secret missing or not set in .env');
    // Optionally throw an error or exit process in a real app
}

// Set up PayPal environment
let environment;
if (mode === 'live') {
    environment = new paypal.core.LiveEnvironment(clientId, clientSecret);
    console.log('PayPal Client: Using LIVE environment.');
} else {
    environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
    console.log('PayPal Client: Using SANDBOX environment.');
}

// Create PayPal HTTP client instance
const paypalClient = new paypal.core.PayPalHttpClient(environment);

module.exports = paypalClient; 