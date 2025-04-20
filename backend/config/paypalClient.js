const paypalSdk = require('@paypal/paypal-server-sdk');
console.log('paypalSdk imported:', typeof paypalSdk, Object.keys(paypalSdk || {})); // Log the imported object type and keys
// const core = paypalSdk.core; // Remove this line as core is undefined
// console.log('paypalSdk.core:', typeof core, Object.keys(core || {})); 

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
console.log(`Attempting to create environment with mode: ${mode}`); // Log before creating environment
if (mode === 'live') {
    console.log('Creating LiveEnvironment...'); // Log before new LiveEnvironment
    // Try accessing via paypalSdk.Environment
    environment = new paypalSdk.Environment.LiveEnvironment(clientId, clientSecret); 
    console.log('PayPal Client: Using LIVE environment.');
} else {
    console.log('Creating SandboxEnvironment...'); // Log before new SandboxEnvironment
    // Try accessing via paypalSdk.Environment
    environment = new paypalSdk.Environment.SandboxEnvironment(clientId, clientSecret); 
    console.log('PayPal Client: Using SANDBOX environment.');
}

// Create PayPal HTTP client instance
console.log('Creating PayPalHttpClient...'); // Log before creating client
// Try accessing via paypalSdk.Client
const paypalClient = new paypalSdk.Client.PayPalHttpClient(environment); 
console.log('PayPalHttpClient created successfully.'); // Log after creating client

module.exports = paypalClient; 