const cron = require('node-cron');
const TrendDetectionService = require('../services/TrendDetectionService');
const { getInstance: getApiKeyManagerInstance } = require('../services/apiKeyManager.service');

// Schedule to run every 6 hours
// For testing, you might want a more frequent schedule like '*/1 * * * *' (every minute)
// or '*/5 * * * *' (every 5 minutes)
// cron.schedule('0 */6 * * *', async () => {
cron.schedule('*/5 * * * *', async () => { // Running every 5 minutes for easier testing initially
  console.log('[TrendScheduler] Running job: Checking for trends and alerting users...');
  try {
    // Ensure ApiKeyManager is initialized before TrendDetectionService uses it
    // The TrendDetectionService will internally await the apiKeyManagerPromise if needed
    // but good practice to ensure services it depends on are generally ready or self-initializing.
    // await getApiKeyManagerInstance({}); // Not strictly needed here if TrendDetectionService handles it

    await TrendDetectionService.checkForTrendsAndAlertUsers();
    console.log('[TrendScheduler] Job finished: Checking for trends and alerting users.');
  } catch (error) {
    console.error('[TrendScheduler] Error during scheduled job:', error);
  }
});

console.log('[TrendScheduler] Cron job for trend detection scheduled to run every 5 minutes (for testing).');

// Optional: To be called from server.js to ensure scheduler starts
// function initializeTrendScheduler() {
//   console.log('[TrendScheduler] Initialized.');
// }
// module.exports = { initializeTrendScheduler }; 