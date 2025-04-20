// Real PayPal client implementation using direct axios HTTP calls
const axios = require('axios');
const querystring = require('querystring');

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
      console.log(`Using API base URL: ${API_BASE_URL}`);
      
      // Properly encode credentials for Basic Auth
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      // Use proper data formatting with querystring
      const data = querystring.stringify({ grant_type: 'client_credentials' });
      
      const response = await axios({
        method: 'POST',
        url: `${API_BASE_URL}/v1/oauth2/token`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data
      });
      
      // Log response structure (without sensitive data)
      console.log('Token response received with status:', response.status);
      console.log('Token response data keys:', Object.keys(response.data || {}));
      
      accessToken = response.data.access_token;
      
      // Set token expiry (subtract 60 seconds as buffer)
      const expiresIn = response.data.expires_in || 32400; // Default 9 hours if not provided
      tokenExpiry = now + (expiresIn - 60) * 1000;
      
      console.log('New PayPal access token obtained successfully');
      return accessToken;
    } catch (error) {
      // Enhanced error logging
      console.error('Failed to obtain PayPal access token:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
        console.error('Response headers:', JSON.stringify(error.response.headers));
      }
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
      
      const subscriptionId = request.subscriptionId;
      console.log(`Fetching subscription ${subscriptionId} details from ${API_BASE_URL}`);
      
      const subscriptionResponse = await axios({
        method: 'GET',
        url: `${API_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log(`Got subscription details for ${subscriptionId} with status:`, subscriptionResponse.status);
      console.log('Subscription data keys:', Object.keys(subscriptionResponse.data || {}));
      
      // Return structured response that mimics the SDK format
      return {
        result: {
          status: subscriptionResponse.data.status,
          plan_id: subscriptionResponse.data.plan_id
        }
      };
    } catch (error) {
      // Enhanced error logging
      console.error('PayPal API Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
      }
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