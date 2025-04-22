import { useWebSocket } from '@/hooks/useWebSocket';
import React from 'react';

// This component initializes the WebSocket connection using the custom hook
// It needs to be placed *inside* AuthProvider to access the token
export const WebSocketInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useWebSocket(); // Initialize the connection and message listeners

  // Render the rest of the app
  return <>{children}</>;
}; 