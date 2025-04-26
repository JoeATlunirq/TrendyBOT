console.log('<<<<< SERVER.JS STARTED >>>>>'); // <<< STARTUP LOG 1

require('dotenv').config(); // <<< RESTORED DOTENV
const express = require('express'); // <<< RESTORED EXPRESS
const http = require('http'); // Keep http for server
const cors = require('cors'); // <<< RESTORED CORS

/* COMMENTED OUT FOR VERCEL DEBUGGING
// const http = require('http'); // Needed for HTTP server
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const youtubeRoutes = require('./routes/youtube.routes');
const paypalRoutes = require('./routes/paypal.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { scheduleTrialCheck } = require('./scheduler/trialExpiryChecker');
const { initializeWebSocket } = require('./services/websocket.service'); 
const { initializeDiscordClient } = require('./services/discord.service');
*/

const app = express(); // <<< RESTORED APP CREATION
const server = http.createServer(app); // <<< RESTORED HTTP SERVER WRAPPER

// --- Middleware ---
app.use(cors()); // <<< RESTORED CORS MIDDLEWARE
/* COMMENTED OUT FOR VERCEL DEBUGGING
app.use('/api/paypal/webhook', express.raw({ type: 'application/json', limit: '10mb' }));
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
app.use(express.json()); 
app.use('/uploads', express.static('public/uploads')); 

// --- Routes ---
app.get('/', (req, res) => {
  res.send('Trendy.bot Auth Backend Running');
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// --- Error Handling ---
app.use(errorHandler);
*/

// --- Start Server ---
const PORT = process.env.PORT || 5001;

/* COMMENTED OUT FOR VERCEL DEBUGGING
const minimalServer = http.createServer((req, res) => {
  console.log(`Minimal server received request: ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Minimal Server OK');
});

minimalServer.listen(PORT, () => {
  console.log(`<<<<< MINIMAL SERVER LISTENING ON PORT ${PORT} >>>>>`); // <<< STARTUP LOG 2
});
*/

server.listen(PORT, () => { // <<< RESTORED ORIGINAL SERVER LISTEN
  console.log(`<<<<< EXPRESS SERVER LISTENING ON PORT ${PORT} >>>>>`); // <<< MODIFIED STARTUP LOG 2

  initializeWebSocket(server); // <<< KEEP ONLY THIS FOR NOW

  /* COMMENTED OUT FOR VERCEL DEBUGGING
  console.log('<<<<< CALLING initializeDiscordClient >>>>>'); // <<< STARTUP LOG 3
  initializeDiscordClient();
  scheduleTrialCheck(); // <<< RESTORED SCHEDULER
  */
  /* COMMENTED OUT FOR VERCEL DEBUGGING << LEAVING COMMENT FOR NOW
  if (!process.env.NOCODB_BASE_URL || !process.env.NOCODB_USERS_TABLE_ID || !process.env.NOCODB_API_TOKEN || !process.env.JWT_SECRET) {
    console.warn('\n⚠️ WARNING: Essential environment variables (NocoDB/JWT) seem missing.');
    console.warn('Please ensure NOCODB_BASE_URL, NOCODB_USERS_TABLE_ID, NOCODB_API_TOKEN, and JWT_SECRET are set in your .env file.\n');
  }
  if (!process.env.PAYPAL_WEBHOOK_ID) {
      console.warn('\n⚠️ WARNING: PAYPAL_WEBHOOK_ID environment variable is missing. Webhook verification will fail.\n');
  }
  */
});

/* COMMENTED OUT FOR VERCEL DEBUGGING
module.exports = app; 
*/ 