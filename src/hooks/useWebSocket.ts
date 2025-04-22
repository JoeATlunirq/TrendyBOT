import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Assuming you have an AuthContext
// Import User type from AuthContext
import type { User } from '../contexts/AuthContext';

// Define the types for messages sent/received
interface WebSocketMessage {
  type: string;
  payload?: any;
  message?: string;
  token?: string; // For sending auth token
}

// Determine WebSocket URL based on environment
const getWebSocketUrl = () => {
  if (import.meta.env.PROD) {
    // Use wss:// and the window's host for production
    // Assumes frontend and backend are served on the same domain
    const host = window.location.host;
    return `wss://${host}`;
  } else {
    // Use local ws:// address or environment variable for development
    return import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:5001';
  }
};

const WEBSOCKET_URL = getWebSocketUrl();

// Define keys based on AuthContext/backend structure
const TELEGRAM_VERIFIED_KEY = import.meta.env.VITE_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified';
const TELEGRAM_CHAT_ID_KEY = import.meta.env.VITE_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id';
const CURRENT_PLAN_KEY = import.meta.env.VITE_CURRENT_PLAN_COLUMN || 'current_plan';
const SUB_STATUS_KEY = import.meta.env.VITE_SUB_STATUS_COLUMN || 'subscription_status';

export function useWebSocket() {
  const { token, user, updateUserContext } = useAuth(); // Get token and user state setter
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    if (!token || ws.current) {
      // Don't connect if no token or already connected/connecting
      // console.log('WebSocket: Skipping connection (no token or already connected)');
      return;
    }

    console.log('WebSocket: Attempting to connect...');
    ws.current = new WebSocket(WEBSOCKET_URL);
    ws.current.binaryType = 'arraybuffer'; // Or 'blob' if preferred

    ws.current.onopen = () => {
      console.log('WebSocket: Connection opened');
      setIsConnected(true);
      // Server should send 'auth_request' now
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket: Connection closed', event.reason);
      setIsConnected(false);
      ws.current = null; // Clear ref on close
      // Optional: Implement reconnect logic here
      // setTimeout(connectWebSocket, 5000); // Example: Reconnect after 5s
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket: Error', error);
      // ws.current will likely close after this, triggering onclose
    };

    ws.current.onmessage = (event) => {
      let message: WebSocketMessage;
      try {
        if (event.data instanceof ArrayBuffer) {
             // Handle binary data if needed, otherwise assume text
             const decoder = new TextDecoder('utf-8');
             message = JSON.parse(decoder.decode(event.data));
        } else if (typeof event.data === 'string') {
            message = JSON.parse(event.data);
        } else {
             console.warn('WebSocket: Received non-string/non-buffer message', event.data);
             return;
        }

        console.log('WebSocket: Message received', message);
        setLastMessage(message); // Store the last received message

        // --- Handle Server Messages ---
        switch (message.type) {
          case 'auth_request':
            // Server is asking for the token
            if (token && ws.current?.readyState === WebSocket.OPEN) {
              console.log('WebSocket: Sending authentication token...');
              const authMessage: WebSocketMessage = { type: 'authenticate', token: token };
              ws.current.send(JSON.stringify(authMessage));
            }
            break;
          case 'auth_success':
            console.log('WebSocket: Authentication successful');
            // Authentication confirmed by server
            break;
           case 'auth_error':
              console.error('WebSocket: Authentication failed', message.message);
              // Handle auth failure (e.g., logout user, close connection)
              ws.current?.close();
              break;
          case 'subscriptionUpdate':
            console.log('WebSocket: Received subscription update', message.payload);
            if (message.payload && user) {
              // Prepare only the fields that need updating
              const fieldsToUpdate: Partial<User> = {};
              const newPlan = message.payload.plan;
              const newStatus = message.payload.status;
              const currentPlan = user[CURRENT_PLAN_KEY];
              const currentStatus = user[SUB_STATUS_KEY];

              if (newPlan !== undefined && newPlan !== currentPlan) {
                  fieldsToUpdate[CURRENT_PLAN_KEY] = newPlan;
              }
              if (newStatus !== undefined && newStatus !== currentStatus) {
                  fieldsToUpdate[SUB_STATUS_KEY] = newStatus;
              }

              // Call updateUserContext only if there are changes
              if (Object.keys(fieldsToUpdate).length > 0) {
                  console.log('WebSocket: Updating user context with new subscription info.')
                  updateUserContext(fieldsToUpdate);
              }
            }
            break;
          case 'telegramStatusUpdate':
            console.log('WebSocket: Received Telegram status update', message.payload);
            // Ensure updateUserContext exists (it should if user exists)
            if (message.payload && user && updateUserContext) { 
                const { verified, chatId } = message.payload;
                 // Prepare only the fields that need updating
                const fieldsToUpdate: Partial<User> = {};
                const currentVerified = user[TELEGRAM_VERIFIED_KEY] === true;
                const currentChatId = user[TELEGRAM_CHAT_ID_KEY] || null;

                if (verified !== undefined && verified !== currentVerified) {
                    fieldsToUpdate[TELEGRAM_VERIFIED_KEY] = verified;
                }
                 // Only update chatId if verified is true, or if clearing it
                if (verified === true && chatId !== currentChatId) {
                     fieldsToUpdate[TELEGRAM_CHAT_ID_KEY] = chatId;
                } else if (verified === false && currentChatId !== null) {
                    fieldsToUpdate[TELEGRAM_CHAT_ID_KEY] = null; // Clear chat ID if no longer verified
                }
                
                // Call updateUserContext only if there are changes
                if (Object.keys(fieldsToUpdate).length > 0) {
                    console.log('WebSocket: Updating user context with new Telegram status.')
                    updateUserContext(fieldsToUpdate);
                }
            }
            break;
          // Add handlers for other message types if needed
          default:
            console.log('WebSocket: Received unhandled message type:', message.type);
        }
      } catch (error) {
        console.error('WebSocket: Error processing message', error);
      }
    };
  }, [token]); // <-- REMOVED user, updateUserContext

  // Effect to connect and disconnect WebSocket based on token presence
  useEffect(() => {
    if (token) {
      connectWebSocket();
    }

    // Cleanup function: Close WebSocket connection when component unmounts or token changes
    return () => {
      if (ws.current) {
        console.log('WebSocket: Closing connection due to unmount or token change');
        ws.current.close();
        ws.current = null;
      }
    };
  }, [token, connectWebSocket]); // Re-run effect if token or connectWebSocket changes

  // Function to send messages (optional, if needed by components)
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket: Cannot send message, connection not open.');
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
} 