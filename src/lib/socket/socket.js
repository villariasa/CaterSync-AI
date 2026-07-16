/**
 * CaterSync AI — Socket.IO Client Configuration (Singleton)
 *
 * Configures the Socket.IO client instance.
 * Sets transport priority, reconnection parameters, and CORS configurations.
 * Connection is opened manually by ConnectionService inside connection.js.
 */

import { io } from 'socket.io-client';

const isBrowser = typeof window !== 'undefined';

// Empty mock socket for SSR server compiles
const dummySocket = {
  on: () => {},
  off: () => {},
  once: () => {},
  emit: () => {},
  connect: () => {},
  disconnect: () => {},
  connected: false,
  io: { opts: {} },
};

/**
 * Socket.IO client instance singleton.
 * Configured with autoConnect: false to prevent connects before token is fetched.
 */
export const socket = isBrowser
  ? io('http://localhost:4001', {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      // Attempt WebSocket upgrade first, fall back to long-polling
      transports: ['websocket', 'polling'],
      timeout: 20000,
    })
  : dummySocket;
