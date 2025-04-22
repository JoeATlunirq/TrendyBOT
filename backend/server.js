require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // Added for WebSocket server
const WebSocket = require('ws'); // Added for WebSocket server
const jwt = require('jsonwebtoken'); // Added for WebSocket authentication
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const youtubeRoutes = require('./routes/youtube.routes');
const paypalRoutes = require('./routes/paypal.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { scheduleTrialCheck } = require('./scheduler/trialExpiryChecker');

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// Create WebSocket server WITHOUT attaching it directly to the HTTP server's upgrade handling initially
const wss = new WebSocket.Server({ noServer: true }); 

// --- WebSocket Server Logic ---
// Store connected clients (simple approach, enhance later for user mapping)
const clients = new Map(); // Map WebSocket connection to metadata (e.g., userId)

wss.on('connection', (ws, req) => { // Added req to potentially get initial headers if needed
  // Note: Basic 'ws' doesn't easily pass request context like Socket.IO.
  // Authentication will happen via a message after connection.
  console.log('WebSocket Client connected');
  const clientId = Date.now(); // Simple unique ID for now
  // Store the client temporarily until authenticated
  clients.set(ws, { id: clientId, userId: null }); 
  console.log(`Client assigned temporary ID: ${clientId}`);

  ws.on('message', (messageBuffer) => {
    let messageData;
    try {
      // Messages should be JSON strings
      messageData = JSON.parse(messageBuffer.toString());
      console.log(`Received message from client ${clients.get(ws)?.id}:`, messageData);
    } catch (error) {
      console.error('Invalid WebSocket message format (expected JSON):', messageBuffer.toString());
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format. Expected JSON.' }));
      return;
    }

    // Handle Authentication Message
    if (messageData.type === 'authenticate' && messageData.token) {
      try {
        const decoded = jwt.verify(messageData.token, process.env.JWT_SECRET);
        const userId = decoded.userId; // Assuming your JWT payload has userId
        if (userId) {
          // Authentication successful: associate userId with this connection
          clients.set(ws, { ...clients.get(ws), userId: userId });
          console.log(`WebSocket Client ${clients.get(ws)?.id} authenticated as User ${userId}`);
          ws.send(JSON.stringify({ type: 'auth_success', message: 'Authentication successful.' }));
        } else {
          throw new Error('User ID not found in token payload');
        }
      } catch (error) {
        console.error('WebSocket Authentication Error:', error.message);
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid or expired token.' }));
        // Optionally close the connection after failed auth attempt
        // ws.close(); 
      }
    } else if (!clients.get(ws)?.userId) {
      // Ignore other messages if client is not yet authenticated
      console.log(`Ignoring message from unauthenticated client ${clients.get(ws)?.id}`);
      ws.send(JSON.stringify({ type: 'auth_required', message: 'Please authenticate first.' }));
    } else {
       // Handle other authenticated messages if needed (e.g., ping/pong)
       console.log(`Received authenticated message from User ${clients.get(ws)?.userId}:`, messageData);
       // Example: Pong reply
       if (messageData.type === 'ping') {
           ws.send(JSON.stringify({ type: 'pong' }));
       }
    }
  });

  ws.on('close', () => {
    console.log(`Client ${clients.get(ws)?.id} (User: ${clients.get(ws)?.userId}) disconnected`);
    clients.delete(ws); // Remove client on disconnect
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clients.get(ws)?.id} (User: ${clients.get(ws)?.userId}):`, error);
    clients.delete(ws); // Clean up on error
  });

  // Request authentication from the client upon connection
  ws.send(JSON.stringify({ type: 'auth_request', message: 'Please send authentication token.' }));
});

// --- Explicit Upgrade Handling --- 
server.on('upgrade', (request, socket, head) => {
  // Log the requested path for debugging
  console.log(`[HTTP Upgrade] Request received for path: ${request.url}`);

  // You can add path checking here if you want dedicated paths, e.g.:
  // if (request.url === '/websocket') { ... }
  // For now, let's handle upgrades to the root path (or any path)

  wss.handleUpgrade(request, socket, head, (ws) => {
    // Pass the connection to the WebSocket server's connection handler
    wss.emit('connection', ws, request);
    console.log(`[HTTP Upgrade] WebSocket upgrade successful for path: ${request.url}`);
  });
  // If you uncommented path checking above, add an else block to destroy sockets for other paths:
  // } else {
  //   console.log(`[HTTP Upgrade] Destroying socket for unhandled path: ${request.url}`);
  //   socket.destroy();
  // }
});

// Function to send message to a specific user ID (Requires user mapping)
const sendToUser = (userId, message) => {
    console.log(`Attempting to send message to user ${userId}`);
    for (const [client, metadata] of clients.entries()) {
        if (metadata.userId === userId && client.readyState === WebSocket.OPEN) {
            console.log(`Sending message to client ${metadata.id} (User ${userId})`);
            client.send(JSON.stringify(message));
            return true; // Message sent
        }
    }
    console.log(`User ${userId} not found among connected WebSocket clients.`);
    return false; // User not found or not connected
};

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

// --- Serve uploaded files publicly ---
// Files in /backend/public/uploads will be accessible via /uploads URL path
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
// app.listen(PORT, () => { // Original listener
server.listen(PORT, () => { // Use the HTTP server to listen
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

// Export wss and potentially helper functions for other modules
// module.exports = { app, wss, sendToUser }; // Original named export

// Vercel expects the Express app instance as the default export
module.exports = app; 

// Keep named exports if needed elsewhere (though less common for Vercel entry)
module.exports.wss = wss;
module.exports.sendToUser = sendToUser;