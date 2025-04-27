console.log('<<<<< SERVER.JS STARTED >>>>>'); // <<< STARTUP LOG 1

require('dotenv').config(); // Uncommented
const express = require('express');
// const cors = require('cors'); // Commented out for testing
// const http = require('http'); // Commented out for testing
// const authRoutes = require('./routes/auth.routes'); // Commented out for testing
// const userRoutes = require('./routes/user.routes'); // Commented out for testing
// const youtubeRoutes = require('./routes/youtube.routes'); // Commented out for testing
// const paypalRoutes = require('./routes/paypal.routes'); // Commented out for testing
// const subscriptionRoutes = require('./routes/subscription.routes'); // Commented out for testing
// const { errorHandler } = require('./middleware/error.middleware'); // Commented out for testing
// const { scheduleTrialCheck } = require('./scheduler/trialExpiryChecker'); // Commented out for testing
// const { initializeWebSocket } = require('./services/websocket.service'); // Commented out for testing
const { initializeDiscordClient } = require('./services/discord.service'); // Uncommented

const app = express();
// const server = http.createServer(app); // Commented out for testing

// --- Middleware ---
// app.use(cors()); // Commented out for testing
// app.use('/api/paypal/webhook', express.raw({ type: 'application/json', limit: '10mb' })); // Commented out for testing
// app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' })); // Commented out for testing
// app.use(express.json()); // Commented out for testing
// app.use('/uploads', express.static('public/uploads')); // Commented out for testing

// --- Routes ---
app.get('/', (req, res) => { // Uncommented basic route
  console.log('<<<<< / endpoint hit >>>>>'); 
  res.send('Trendy.bot Backend Minimal Express Test Running');
});
// app.use('/api/auth', authRoutes); // Commented out for testing
// app.use('/api/users', userRoutes); // Commented out for testing
// app.use('/api/youtube', youtubeRoutes); // Commented out for testing
// app.use('/api/paypal', paypalRoutes); // Commented out for testing
// app.use('/api/subscriptions', subscriptionRoutes); // Commented out for testing

// --- Error Handling ---
// app.use(errorHandler); // Commented out for testing

// --- Start Server & Initializations ---

// Vercel handles listening, do not call app.listen()

console.log('<<<<< CALLING initializeDiscordClient >>>>>'); // Add this log back
initializeDiscordClient(); // Uncommented

// scheduleTrialCheck(); // Keep commented

// console.log('<<<<< SERVER.JS Reached End (No Express) >>>>>'); // Remove this log

module.exports = app; // EXPORT the app for Vercel 