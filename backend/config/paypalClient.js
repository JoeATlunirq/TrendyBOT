// Real PayPal client implementation using direct axios HTTP calls
const axios = require('axios');

// Get PayPal environment variables
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const mode = process.env.PAYPAL_MODE || 'sandbox';

// API base URLs
const SANDBOX_API_URL = 'https://api-m.sandbox.paypal.com';
const LIVE_API_URL = 'https://api-m.paypal.com';
const API_BASE_URL = mode === 'live' ? LIVE_API_URL : SANDBOX_API_URL;

console.log(`Configuring PayPal client for ${mode.toUpperCase()} mode`);

// Initialize access token cache
let accessToken = null;
let tokenExpiry = 0;

// Real client that makes direct HTTP calls to PayPal API
const paypalClient = {
  // Get OAuth access token for API calls
  async getAccessToken() {
    const now = Date.now();
    
    // Return cached token if it's still valid
    if (accessToken && tokenExpiry > now) {
      return accessToken;
    }
    
    try {
      console.log('Obtaining new PayPal access token...');
      
      // Use HTTP Basic Auth for PayPal OAuth
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      const response = await axios({
        method: 'POST',
        url: `${API_BASE_URL}/v1/oauth2/token`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: 'grant_type=client_credentials'
      });
      
      accessToken = response.data.access_token;
      
      // Set token expiry (subtract 60 seconds as buffer)
      const expiresIn = response.data.expires_in || 32400; // Default 9 hours if not provided
      tokenExpiry = now + (expiresIn - 60) * 1000;
      
      console.log('New PayPal access token obtained');
      return accessToken;
    } catch (error) {
      console.error('Failed to obtain PayPal access token:', error.message);
      throw error;
    }
  },
  
  // Execute API request with auto token refresh
  async execute(request) {
    try {
      if (!request || !request.subscriptionId) {
        throw new Error('Invalid request format - subscriptionId is required');
      }
      
      // Get subscription details from PayPal
      const token = await this.getAccessToken();
      
      const subscriptionResponse = await axios({
        method: 'GET',
        url: `${API_BASE_URL}/v1/billing/subscriptions/${request.subscriptionId}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log(`Got subscription details for ${request.subscriptionId}`);
      
      // Return structured response that mimics the SDK format
      return {
        result: {
          status: subscriptionResponse.data.status,
          plan_id: subscriptionResponse.data.plan_id
        }
      };
    } catch (error) {
      console.error('PayPal API Error:', error.message);
      // Rethrow with better formatting
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message
      };
    }
  }
};

console.log('PayPal client initialized for PRODUCTION API calls');
module.exports = paypalClient; 