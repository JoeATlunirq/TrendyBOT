require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const youtubeRoutes = require('./routes/youtube.routes');
const paypalRoutes = require('./routes/paypal.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { scheduleTrialCheck } = require('./scheduler/trialExpiryChecker');

const app = express();

// --- Middleware ---
// Enable CORS for all origins (adjust for production)
app.use(cors()); 

// IMPORTANT: Raw body parsers MUST come before express.json()
// Raw parser for PayPal IPN/Webhook (if using /api/paypal route for IPN)
app.use('/api/paypal/webhook', express.raw({ type: 'application/json', limit: '10mb' }));

// Raw parser for the NEW Subscription Webhook endpoint
// Needed for signature verification
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

// Then use JSON parser for all other routes.
app.use(express.json()); 

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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Basic check for essential NocoDB environment variables
  if (!process.env.NOCODB_BASE_URL || !process.env.NOCODB_USERS_TABLE_ID || !process.env.NOCODB_API_TOKEN || !process.env.JWT_SECRET) {
    console.warn('\n⚠️ WARNING: Essential environment variables (NocoDB/JWT) seem missing.');
    console.warn('Please ensure NOCODB_BASE_URL, NOCODB_USERS_TABLE_ID, NOCODB_API_TOKEN, and JWT_SECRET are set in your .env file.\n');
  }

  // Also check for PayPal Webhook ID (needed for verification)
  if (!process.env.PAYPAL_WEBHOOK_ID) {
      console.warn('\n⚠️ WARNING: PAYPAL_WEBHOOK_ID environment variable is missing. Webhook verification will fail.\n');
  }

  // Start the scheduled jobs
  scheduleTrialCheck();
}); 