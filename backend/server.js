console.log('<<<<< SERVER.JS STARTED >>>>>'); // <<< STARTUP LOG 1

require('dotenv').config();
const express = require('express');
const http = require('http'); // Needed for HTTP server
// const cors = require('cors');
// const authRoutes = require('./routes/auth.routes');
// const userRoutes = require('./routes/user.routes');
// const youtubeRoutes = require('./routes/youtube.routes');
// const paypalRoutes = require('./routes/paypal.routes');
// const subscriptionRoutes = require('./routes/subscription.routes');
// const { errorHandler } = require('./middleware/error.middleware');
// const { scheduleTrialCheck } = require('./scheduler/trialExpiryChecker');
// const { initializeWebSocket } = require('./services/websocket.service'); 
// const { initializeDiscordClient } = require('./services/discord.service');

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// --- Middleware ---
// app.use(cors()); 
// app.use('/api/paypal/webhook', express.raw({ type: 'application/json', limit: '10mb' }));
// app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
app.use(express.json()); 
// app.use('/uploads', express.static('public/uploads')); 

// --- Routes ---
app.get('/', (req, res) => {
  console.log('<<<<< ROOT ROUTE HIT >>>>>');
  res.send('Trendy.bot Backend Running - Minimal Test');
});
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/youtube', youtubeRoutes);
// app.use('/api/paypal', paypalRoutes);
// app.use('/api/subscriptions', subscriptionRoutes);

// --- Error Handling ---
// app.use(errorHandler);

// --- Start Server & Scheduler ---
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`<<<<< SERVER LISTENING on port ${PORT} >>>>>`); // <<< STARTUP LOG 3
  
  // initializeWebSocket(server); 
  // console.log('<<<<< CALLING initializeDiscordClient >>>>>'); // <<< STARTUP LOG 2
  // initializeDiscordClient();
  
  // scheduleTrialCheck();
});

module.exports = app; 