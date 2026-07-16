/**
 * CaterSync AI — Socket.IO Server Entry Point
 *
 * Standalone Node.js Socket.IO server running on SOCKET_PORT (default: 4001).
 * Handles real-time traffic upgrade and provides internal APIs for SvelteKit.
 *
 * Start with:
 *   node src/socket/server.js
 *   npm run socket
 *   npm run dev:full (runs SvelteKit + Socket.IO server concurrently)
 */

import 'dotenv/config';
import { createServer } from 'node:http';
import { createSocketGateway } from './gateway.js';
import { registerToken } from './auth.js';
import { logger } from './logger.js';
import { getDiagnostics } from './connectionManager.js';

// Import domain emitter functions to forward internal HTTP events
import { emitBookingCreated, emitBookingUpdated, emitBookingConfirmed, emitBookingRejected, emitBookingCompleted, emitBookingCancelled } from './events/booking.events.js';
import { emitInventoryUpdated, emitInventoryLowStock, emitInventoryOutOfStock } from './events/inventory.events.js';
import { emitNotificationCreated, emitNotificationRead, emitNotificationDeleted } from './events/notification.events.js';
import { emitDashboardStatsUpdated } from './events/dashboard.events.js';
import { emitPaymentReceived, emitPaymentUpdated, emitPaymentFailed } from './events/payment.events.js';
import { emitChatMessage, emitChatDeleted } from './events/chat.events.js';
import { emitOrganizationUpdated } from './events/user.events.js';

const PORT = parseInt(process.env.SOCKET_PORT || '4001', 10);
const HOST = process.env.SOCKET_HOST || '0.0.0.0';

logger.info('🚀 Starting CaterSync AI Socket.IO Server...');

// Helper to read HTTP body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Local requests security check (localhost only)
function isLocalRequest(req) {
  const addr = req.socket?.remoteAddress;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

// Create basic HTTP server
const httpServer = createServer(async (req, res) => {
  const { method, url } = req;

  // ── GET /health ──
  if (method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      diagnostics: getDiagnostics(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // ── POST /internal/register-token ──
  if (method === 'POST' && url === '/internal/register-token') {
    if (!isLocalRequest(req)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const { token, user } = await readBody(req);
      if (!token || !user) throw new Error('Missing token or user data');

      registerToken(token, user);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      logger.error('❌ Token registration error:', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // ── POST /internal/emit-event ──
  if (method === 'POST' && url === '/internal/emit-event') {
    if (!isLocalRequest(req)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const { type, payload } = await readBody(req);
      if (!type) throw new Error('Missing event type');

      // Forward event to appropriate domain emitters
      switch (type) {
        // Bookings
        case 'booking.created':
          emitBookingCreated(io, payload);
          break;
        case 'booking.updated':
          emitBookingUpdated(io, payload);
          break;
        case 'booking.confirmed':
          emitBookingConfirmed(io, payload);
          break;
        case 'booking.rejected':
          emitBookingRejected(io, payload);
          break;
        case 'booking.completed':
          emitBookingCompleted(io, payload);
          break;
        case 'booking.cancelled':
          emitBookingCancelled(io, payload);
          break;

        // Inventory
        case 'inventory.updated':
          emitInventoryUpdated(io, payload);
          break;
        case 'inventory.low_stock':
          emitInventoryLowStock(io, payload);
          break;
        case 'inventory.out_of_stock':
          emitInventoryOutOfStock(io, payload);
          break;

        // Notifications
        case 'notification.created':
          emitNotificationCreated(io, payload);
          break;
        case 'notification.read':
          emitNotificationRead(io, payload);
          break;
        case 'notification.deleted':
          emitNotificationDeleted(io, payload);
          break;

        // Dashboard
        case 'dashboard.stats.updated':
          emitDashboardStatsUpdated(io, payload);
          break;

        // Payments
        case 'payment.received':
          emitPaymentReceived(io, payload);
          break;
        case 'payment.updated':
          emitPaymentUpdated(io, payload);
          break;
        case 'payment.failed':
          emitPaymentFailed(io, payload);
          break;

        // Chat
        case 'chat.message':
          emitChatMessage(io, payload);
          break;
        case 'chat.deleted':
          emitChatDeleted(io, payload);
          break;

        // Organization
        case 'organization.updated':
          emitOrganizationUpdated(io, payload);
          break;

        default:
          logger.warn(`⚠️ Unhandled internal event type requested: "${type}"`);
          break;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      logger.error('❌ Internal emit error:', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Initialize Socket.IO Gateway and attach to HTTP server
const io = createSocketGateway(httpServer);

// Start HTTP + Socket.IO Server
httpServer.listen(PORT, HOST, () => {
  logger.info(`✅ Socket.IO Server listening on http://${HOST}:${PORT}`);
  logger.info(`   Health & Diagnostics: http://${HOST}:${PORT}/health`);
});

// Graceful Shutdown
function shutdown(signal) {
  logger.info(`⚡ ${signal} received — shutting down Socket.IO Server...`);

  // Disconnect all sockets gracefully
  io.close(() => {
    httpServer.close(() => {
      logger.info('✅ Socket.IO Server shut down cleanly.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.warn('⏰ Force exit timeout reached.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => logger.error('💥 Uncaught Exception:', err.message, err.stack));
process.on('unhandledRejection', (reason) => logger.error('💥 Unhandled Rejection:', reason));
