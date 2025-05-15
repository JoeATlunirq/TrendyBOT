console.log('<<<<< SERVER.JS STARTED >>>>>'); // <<< STARTUP LOG 1

require('dotenv').config(); // Uncommented
const express = require('express');
const cors = require('cors'); // Uncommented
const http = require('http'); // Uncommented (though might not be needed if Vercel handles HTTP)
const authRoutes = require('./routes/auth.routes'); // Uncommented
const userRoutes = require('./routes/user.routes'); // Uncommented
const youtubeRoutes = require('./routes/youtube.routes'); // Uncommented
const subscriptionRoutes = require('./routes/subscription.routes'); // Uncommented
const trendRoutes = require('./routes/trends.routes'); // <<<--- ADD THIS LINE
const { errorHandler } = require('./middleware/error.middleware'); // Uncommented
const { initializeWebSocket } = require('./services/websocket.service'); // Uncommented
const { initializeDiscordClient } = require('./services/discord.service'); // Already Uncommented
const { getInstance: getApiKeyManagerInstance } = require('./services/apiKeyManager.service'); // Added
require('./scheduler/trendScheduler.js'); // Added to initialize the trend detection cron job

const app = express();
const server = http.createServer(app); // Uncommented (Needed for WebSocket)

// --- Middleware ---
app.use(cors()); // Uncommented
app.use('/api/paypal/webhook', express.raw({ type: 'application/json', limit: '10mb' })); // Uncommented
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' })); // Uncommented
app.use(express.json()); // Uncommented
app.use('/uploads', express.static('public/uploads')); // Uncommented

// --- Routes ---
app.get('/', (req, res) => { // Keep basic route for testing if needed
  console.log('<<<<< / endpoint hit >>>>>'); 
  res.send('Trendy.bot Backend Running - Full');
});
app.use('/api/auth', authRoutes); // Uncommented
app.use('/api/users', userRoutes); // Uncommented
app.use('/api/youtube', youtubeRoutes); // Uncommented
app.use('/api/subscriptions', subscriptionRoutes); // Uncommented
app.use('/api/trends', trendRoutes); // <<<--- ADD THIS LINE

// --- Error Handling ---
app.use(errorHandler); // Uncommented

// --- Start Server & Initializations ---

const PORT = process.env.PORT || 5001; 

// Only listen if NOT in Vercel (or if explicitly running locally)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) { // Or simply !process.env.VERCEL
  server.listen(PORT, async () => { 
    console.log(`<<<<< Local server listening on PORT ${PORT} >>>>>`); // Add log for confirmation

    // Display API Key Status Table
    try {
      const apiKeyManager = await getApiKeyManagerInstance({}); // Added await
      const stats = await apiKeyManager.getStats(); // Added await
      const QUOTA_PER_KEY = 10000; // Assumed quota for meter display
      const METER_LENGTH = 15; // Reduced meter length slightly for overall width

      console.log('\n\n🔑 API Key Status Dashboard (Persisted) 🔑');
      console.log('==============================================================================================');
      console.log('| Key Name                         | Status    | Failed | Calls    | Usage Meter (Est. /10k)   |');
      console.log('|----------------------------------|-----------|--------|----------|---------------------------|');

      if (stats.detailedKeyStats && stats.detailedKeyStats.length > 0) {
        stats.detailedKeyStats.forEach(key => {
          const fullName = (key.name || 'Unknown Key').padEnd(32, ' ');
          const status = key.isFailedToday ? '🔴 Fail' : '✅ Ok  ';
          const isFailedStr = key.isFailedToday ? 'Yes  ' : 'No   ';
          const calls = String(key.callsMadeToday || 0).padEnd(8, ' ');
          
          const usageRatio = key.dailyUsePercent || 0;
          const filledLength = Math.round(usageRatio * METER_LENGTH);
          const emptyLength = METER_LENGTH - filledLength;
          const meter = '[' + '#'.repeat(filledLength) + '.'.repeat(emptyLength) + ']';
          const meterDisplay = `${meter} ${(usageRatio * 100).toFixed(0)}%`.padEnd(METER_LENGTH + 5, ' ');

          console.log(`| ${fullName} | ${status.padEnd(9, ' ')} | ${isFailedStr.padEnd(6, ' ')} | ${calls} | ${meterDisplay.padEnd(25, ' ')} |`);
        });
      } else {
        console.log('| No API keys configured or loaded. Check ApiKeyManager setup and .env file.                                                   |');
      }
      console.log('==============================================================================================');
      const summaryText = `Total: ${stats.totalKeys} | Available: ${stats.availableKeys} | Failed: ${stats.failedKeysToday} | Last PT Reset: ${stats.lastResetDatePT || 'N/A'}`;
      console.log(`| ${summaryText.padEnd(92, ' ')} |`);
      console.log('==============================================================================================');

      let countdownStr = 'Calculating...';
      try {
        // Use the user's suggested approach for a cleaner countdown logic
        const nowServerTime = new Date();
        // Create a Date object whose date/time components match current Pacific Time wall clock
        const nowInPT = new Date(nowServerTime.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));

        // Create the target: midnight of the next day, in PT context
        const targetResetDate = new Date(nowInPT);
        targetResetDate.setHours(24, 0, 0, 0); 

        const diffMs = Math.max(0, targetResetDate.getTime() - nowInPT.getTime());

        if (diffMs > 0) {
          const totalSeconds = Math.floor(diffMs / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          countdownStr = `Next PT Reset In: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
          // This case should ideally not be hit frequently if ApiKeyManager resets promptly.
          // It implies current PT time is at or past the calculated next PT midnight.
          countdownStr = 'Next PT Reset: Imminent or Recalculating...';
        }
      } catch (e) {
        console.error("[CountdownCalcError] Error calculating reset countdown:", e);
        countdownStr = 'Error calculating countdown.';
      }
      
      // Ensure padding matches the user-adjusted table width (95 chars total line width)
      console.log(`| ${countdownStr.padEnd(92, ' ')} |`); // 116 (total) - 2 (pipes) = 114
      console.log('==============================================================================================');
      console.log(`(Note: 'Failed' means key is in cooldown until Midnight PT. Usage meter is an estimate of calls vs ~10k.)\n`);

    } catch (error) {
      console.error('Error displaying API Key Status Dashboard:', error);
    }

  });

  // Add graceful shutdown for local development
  const signals = { 'SIGINT': 2, 'SIGTERM': 15 };
  Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
      console.log(`\nReceived ${signal}, closing server...`);
      server.close(() => {
        console.log('Server closed.');
        process.exit(128 + signals[signal]);
      });
    });
  });
}

initializeWebSocket(server); // Initialize WebSocket with the HTTP server
// console.log('<<<<< CALLING initializeDiscordClient >>>>>'); // No longer call here
// initializeDiscordClient(); // No longer call here
// scheduleTrialCheck(); // Commented out trial check

module.exports = server; // Export the HTTP server for Vercel (needed for WebSocket) 