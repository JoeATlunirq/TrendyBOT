require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // Needed for HTTP server
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const youtubeRoutes = require('./routes/youtube.routes');
const paypalRoutes = require('./routes/paypal.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { scheduleTrialCheck } = require('./scheduler/trialExpiryChecker');
const { initializeWebSocket } = require('./services/websocket.service'); 
const { initializeDiscordClient } = require('./services/discord.service');

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// --- Middleware ---
app.use(cors()); 
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

// --- Start Server & Scheduler ---
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  initializeWebSocket(server); 
  initializeDiscordClient();
  
  if (!process.env.NOCODB_BASE_URL || !process.env.NOCODB_USERS_TABLE_ID || !process.env.NOCODB_API_TOKEN || !process.env.JWT_SECRET) {
    console.warn('\n⚠️ WARNING: Essential environment variables (NocoDB/JWT) seem missing.');
    console.warn('Please ensure NOCODB_BASE_URL, NOCODB_USERS_TABLE_ID, NOCODB_API_TOKEN, and JWT_SECRET are set in your .env file.\n');
  }
  if (!process.env.PAYPAL_WEBHOOK_ID) {
      console.warn('\n⚠️ WARNING: PAYPAL_WEBHOOK_ID environment variable is missing. Webhook verification will fail.\n');
  }

  scheduleTrialCheck();
});

module.exports = app; 