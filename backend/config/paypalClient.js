// TEMPORARY: Mock PayPal implementation to unblock web app functionality
console.log('NOTICE: Using mock PayPal client implementation. PayPal verification is DISABLED.');

// Create a mock client that mimics the basic interface but doesn't actually call PayPal
const mockPayPalClient = {
  execute: async (request) => {
    console.log('Mock PayPal client executing request:', request);
    
    // Return mock data structure that mimics what the real client would return
    return {
      result: {
        status: 'ACTIVE',  // Always return ACTIVE status
        plan_id: 'P-4XX40417EU7326443NACRM4Q', // Default to the 'Viral' plan ID from your PAYPAL_PLAN_MAP
      }
    };
  }
};

console.log('Mock PayPal client created. This is ONLY for development/testing!');
module.exports = mockPayPalClient; 