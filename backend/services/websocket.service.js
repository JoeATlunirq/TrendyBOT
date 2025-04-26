const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Create WebSocket server WITHOUT attaching it directly to the HTTP server's upgrade handling initially
const wss = new WebSocket.Server({ noServer: true });

// Store connected clients (simple approach, enhance later for user mapping)
const clients = new Map(); // Map WebSocket connection to metadata (e.g., userId)

wss.on('connection', (ws, req) => {
  console.log('WebSocket Client connected');
  const clientId = Date.now(); // Simple unique ID for now
  clients.set(ws, { id: clientId, userId: null }); 
  console.log(`Client assigned temporary ID: ${clientId}`);

  ws.on('message', (messageBuffer) => {
    let messageData;
    try {
      messageData = JSON.parse(messageBuffer.toString());
      console.log(`Received message from client ${clients.get(ws)?.id}:`, messageData);
    } catch (error) {
      console.error('Invalid WebSocket message format (expected JSON):', messageBuffer.toString());
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format. Expected JSON.' }));
      return;
    }

    if (messageData.type === 'authenticate' && messageData.token) {
      try {
        const decoded = jwt.verify(messageData.token, process.env.JWT_SECRET);
        const userId = decoded.userId; 
        if (userId) {
          clients.set(ws, { ...clients.get(ws), userId: userId });
          console.log(`WebSocket Client ${clients.get(ws)?.id} authenticated as User ${userId}`);
          ws.send(JSON.stringify({ type: 'auth_success', message: 'Authentication successful.' }));
        } else {
          throw new Error('User ID not found in token payload');
        }
      } catch (error) {
        console.error('WebSocket Authentication Error:', error.message);
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid or expired token.' }));
      }
    } else if (!clients.get(ws)?.userId) {
      console.log(`Ignoring message from unauthenticated client ${clients.get(ws)?.id}`);
      ws.send(JSON.stringify({ type: 'auth_required', message: 'Please authenticate first.' }));
    } else {
       console.log(`Received authenticated message from User ${clients.get(ws)?.userId}:`, messageData);
       if (messageData.type === 'ping') {
           ws.send(JSON.stringify({ type: 'pong' }));
       }
    }
  });

  ws.on('close', () => {
    console.log(`Client ${clients.get(ws)?.id} (User: ${clients.get(ws)?.userId}) disconnected`);
    clients.delete(ws); 
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clients.get(ws)?.id} (User: ${clients.get(ws)?.userId}):`, error);
    clients.delete(ws); 
  });

  ws.send(JSON.stringify({ type: 'auth_request', message: 'Please send authentication token.' }));
});

// Function to send message to a specific user ID
const sendToUser = (userId, message) => {
    // Ensure userId is treated consistently (e.g., as a number or string)
    const targetUserId = Number(userId); // Or keep as string if preferred, just be consistent
    if (isNaN(targetUserId)) {
        console.error(`[sendToUser] Invalid userId provided: ${userId}`);
        return false;
    }

    console.log(`Attempting to send message to user ${targetUserId}`);
    let userFound = false;
    for (const [client, metadata] of clients.entries()) {
        // Ensure metadata.userId is also treated as a number for comparison
        if (metadata.userId === targetUserId && client.readyState === WebSocket.OPEN) {
            console.log(`Sending message to client ${metadata.id} (User ${targetUserId})`);
            try {
                 client.send(JSON.stringify(message));
                 userFound = true; // Mark as found, continue checking in case of multiple connections
            } catch (sendError) {
                 console.error(`[sendToUser] Error sending message to client ${metadata.id} (User ${targetUserId}):`, sendError);
            }
        }
    }
    if (!userFound) {
         console.log(`User ${targetUserId} not found among connected WebSocket clients or client not ready.`);
    }
    return userFound; // Return true if message was sent to at least one client
};

// Export the WebSocket server instance and the sendToUser function
module.exports = {
    wss,
    sendToUser,
    initializeWebSocket: (server) => { // Function to handle the upgrade
        server.on('upgrade', (request, socket, head) => {
            console.log(`[HTTP Upgrade] Request received for path: ${request.url}`);
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
                console.log(`[HTTP Upgrade] WebSocket upgrade successful for path: ${request.url}`);
            });
        });
         console.log('WebSocket upgrade handling initialized.');
    }
}; 