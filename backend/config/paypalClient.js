// Import specific components using destructuring
const { LiveEnvironment, SandboxEnvironment, PayPalHttpClient } = require('@paypal/paypal-server-sdk');

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
    // Use the directly imported constructor
    environment = new LiveEnvironment(clientId, clientSecret);
    console.log('PayPal Client: Using LIVE environment.');
} else {
    console.log('Creating SandboxEnvironment...'); // Log before new SandboxEnvironment
    // Use the directly imported constructor
    environment = new SandboxEnvironment(clientId, clientSecret);
    console.log('PayPal Client: Using SANDBOX environment.');
}

// Create PayPal HTTP client instance
console.log('Creating PayPalHttpClient...'); // Log before creating client
// Use the directly imported constructor
const paypalClient = new PayPalHttpClient(environment);
console.log('PayPalHttpClient created successfully.'); // Log after creating client

module.exports = paypalClient; 