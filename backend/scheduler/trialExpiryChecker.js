const cron = require('node-cron');
const { expireInactiveTrials } = require('../services/subscriptionLogic.service'); // Adjust path

/**
 * Schedules the trial expiry check to run daily (e.g., at 2 AM server time).
 */
const scheduleTrialCheck = () => {
    // Runs every day at 2:00 AM server time
    // Syntax: second minute hour day-of-month month day-of-week
    // Note: Make sure your server's timezone is configured correctly or use UTC.
    cron.schedule('0 0 2 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Cron job triggered: Running expireInactiveTrials...`);
        await expireInactiveTrials();
        console.log(`[${new Date().toISOString()}] Cron job finished: expireInactiveTrials completed.`);
    }, {
        scheduled: true,
        timezone: "Etc/UTC" // Example: Use UTC timezone
    });
    console.log('Scheduled daily trial expiry check for 2:00 AM UTC.');
};

module.exports = { scheduleTrialCheck }; 