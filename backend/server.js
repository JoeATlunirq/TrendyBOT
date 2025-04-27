console.log('<<<<< SERVER.JS STARTED >>>>>'); // <<< STARTUP LOG 1

require('dotenv').config(); // Uncommented
const express = require('express');
const cors = require('cors'); // Uncommented
const http = require('http'); // Uncommented (though might not be needed if Vercel handles HTTP)
const authRoutes = require('./routes/auth.routes'); // Uncommented
const userRoutes = require('./routes/user.routes'); // Uncommented
const youtubeRoutes = require('./routes/youtube.routes'); // Uncommented
const paypalRoutes = require('./routes/paypal.routes'); // Uncommented
const subscriptionRoutes = require('./routes/subscription.routes'); // Uncommented
const { errorHandler } = require('./middleware/error.middleware'); // Uncommented
const { scheduleTrialCheck } = require('./scheduler/trialExpiryChecker'); // Uncommented
const { initializeWebSocket } = require('./services/websocket.service'); // Uncommented
const { initializeDiscordClient } = require('./services/discord.service'); // Already Uncommented

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
app.use('/api/paypal', paypalRoutes); // Uncommented
app.use('/api/subscriptions', subscriptionRoutes); // Uncommented

// --- Error Handling ---
app.use(errorHandler); // Uncommented

// --- Start Server & Initializations ---

// Vercel handles listening, do not call app.listen() or server.listen()
// const PORT = process.env.PORT || 5001; 
// server.listen(PORT, () => { ... }); // KEEP LISTEN COMMENTED OUT

initializeWebSocket(server); // Initialize WebSocket with the HTTP server
// console.log('<<<<< CALLING initializeDiscordClient >>>>>'); // No longer call here
// initializeDiscordClient(); // No longer call here
scheduleTrialCheck(); // Uncommented

module.exports = server; // Export the HTTP server for Vercel (needed for WebSocket) 