/**
 * CaterSync AI — Socket.IO Gateway
 *
 * Creates and configures the Socket.IO server instance.
 * Applies middleware chain: auth → rate limiting.
 * Registers all event handlers per authenticated connection.
 * Handles connection/disconnection lifecycle.
 *
 * Architecture:
 *   HTTP Server → Socket.IO Server (io)
 *                    ├── authMiddleware (validates one-time token)
 *                    ├── rateLimitMiddleware (60 events / 10s)
 *                    └── per-socket:
 *                         ├── joinDefaultRooms (org + user rooms)
 *                         ├── registerBookingEvents
 *                         ├── registerInventoryEvents
 *                         ├── registerNotificationEvents
 *                         ├── registerDashboardEvents
 *                         ├── registerPaymentEvents
 *                         ├── registerChatEvents
 *                         └── registerUserEvents
 */

import { Server } from 'socket.io';
import { authMiddleware, rateLimitMiddleware } from './middleware.js';
import { joinDefaultRooms, joinRoom, leaveRoom } from './rooms.js';
import { onUserConnect, onUserDisconnect } from './connectionManager.js';
import { emitUserOnline, emitUserOffline } from './events/user.events.js';
import { registerBookingEvents } from './events/booking.events.js';
import { registerInventoryEvents } from './events/inventory.events.js';
import { registerNotificationEvents } from './events/notification.events.js';
import { registerDashboardEvents } from './events/dashboard.events.js';
import { registerPaymentEvents } from './events/payment.events.js';
import { registerChatEvents } from './events/chat.events.js';
import { registerUserEvents } from './events/user.events.js';
import { logger } from './logger.js';

/**
 * Create and configure the Socket.IO server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
export function createSocketGateway(httpServer) {
  const allowedOrigins = process.env.SOCKET_ALLOWED_ORIGINS
    ? process.env.SOCKET_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'];

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        // In dev (no SOCKET_ALLOWED_ORIGINS set) allow all
        if (!process.env.SOCKET_ALLOWED_ORIGINS) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        logger.warn(`🚫 CORS rejected origin: ${origin}`);
        return callback(new Error('CORS_BLOCKED'));
      },
      credentials: true,
    },
    // Transport: WebSocket first, then long-polling fallback
    transports: ['websocket', 'polling'],
    // Ping/pong heartbeat
    pingTimeout: 20_000,
    pingInterval: 25_000,
    // Max payload size: 1MB
    maxHttpBufferSize: 1_000_000,
    // Connection state recovery: reconnect clients after server restart
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  // ── Middleware Chain ──────────────────────────────────────────────────────
  io.use(authMiddleware);
  io.use(rateLimitMiddleware);

  // ── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const user = socket.data.user;
    logger.info(`🔌 Connected: "${user.username}" id=${socket.id} transport=${socket.conn.transport.name}`);

    // Track in connection manager (handles duplicate sessions)
    onUserConnect(socket, io);

    // Auto-join org + user rooms
    await joinDefaultRooms(socket);

    // Register domain event handlers
    registerBookingEvents(socket, io);
    registerInventoryEvents(socket, io);
    registerNotificationEvents(socket, io);
    registerDashboardEvents(socket, io);
    registerPaymentEvents(socket, io);
    registerChatEvents(socket, io);
    registerUserEvents(socket, io);

    // ── Generic room management ───────────────────────────────────────────
    socket.on('room.join', async ({ room } = {}) => {
      if (!room || typeof room !== 'string') return;
      const result = await joinRoom(socket, room);
      if (result.ok) {
        socket.emit('room.joined', { room });
      } else {
        socket.emit('error', { code: result.error, room });
      }
    });

    socket.on('room.leave', async ({ room } = {}) => {
      if (!room || typeof room !== 'string') return;
      await leaveRoom(socket, room);
      socket.emit('room.left', { room });
    });

    // ── Transport upgrade logging ─────────────────────────────────────────
    socket.conn.on('upgrade', (transport) => {
      logger.debug(`⬆️ "${user.username}" upgraded to ${transport.name}`);
    });

    // ── Disconnection ─────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Disconnected: "${user.username}" reason=${reason}`);
      onUserDisconnect(socket);
      // Broadcast offline presence
      if (user.organizationId) {
        emitUserOffline(io, user);
      }
    });

    // ── Error handler ─────────────────────────────────────────────────────
    socket.on('error', (err) => {
      logger.error(`💥 Socket error for "${user.username}":`, err.message);
    });
  });

  logger.info('✅ Socket.IO gateway initialized');
  return io;
}
