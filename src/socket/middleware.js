/**
 * CaterSync AI — Socket.IO Authentication Middleware
 *
 * Applied to every incoming Socket.IO connection before it is accepted.
 * Reads the one-time token from socket.handshake.auth.token,
 * validates it, and attaches the resolved user to socket.data.user.
 *
 * Rejection codes:
 *   UNAUTHORIZED  — missing or invalid token
 *   TOKEN_EXPIRED — token existed but TTL elapsed
 */

import { consumeToken } from './auth.js';
import { logger } from './logger.js';

/**
 * Socket.IO middleware for authentication.
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
export function authMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    logger.warn(`🔒 Connection rejected (no token) from ${socket.handshake.address}`);
    return next(new Error('UNAUTHORIZED'));
  }

  const user = consumeToken(token);

  if (!user) {
    logger.warn(`🔒 Connection rejected (invalid/expired token) from ${socket.handshake.address}`);
    return next(new Error('UNAUTHORIZED'));
  }

  // Attach resolved identity to socket for downstream use
  socket.data.user = user;
  logger.info(`🔓 Socket authenticated: "${user.username}" org=${user.organizationId} id=${socket.id}`);
  next();
}

/**
 * Rate-limit middleware — limits how many events per socket per second.
 * Prevents event flooding / abuse.
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
export function rateLimitMiddleware(socket, next) {
  let eventCount = 0;
  const RATE_LIMIT = 60;   // max events per window
  const WINDOW_MS  = 10_000; // 10 second window

  const resetInterval = setInterval(() => {
    eventCount = 0;
  }, WINDOW_MS);

  socket.use(([event, ...args], nextFn) => {
    eventCount++;
    if (eventCount > RATE_LIMIT) {
      logger.warn(`⚠️ Rate limit exceeded for "${socket.data.user?.username}" event="${event}"`);
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many events. Please slow down.' });
      return; // Drop event
    }
    nextFn();
  });

  socket.on('disconnect', () => clearInterval(resetInterval));
  next();
}
