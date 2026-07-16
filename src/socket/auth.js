/**
 * CaterSync AI — Socket.IO One-Time Token Store
 *
 * Validates short-lived (90s) tokens issued by GET /api/auth/socket-token.
 * Tokens are single-use and stored in memory with TTL auto-cleanup.
 *
 * Socket.IO middleware reads: socket.handshake.auth.token
 * and calls consumeToken(token) to authenticate.
 */

import { logger } from './logger.js';

/** @type {Map<string, { userId, username, organizationId, role, userType, expiresAt }>} */
const tokenStore = new Map();

const TOKEN_TTL_MS = 90_000; // 90 seconds

/**
 * Register a one-time token (called from POST /internal/register-token).
 * @param {string} token
 * @param {{ userId, username, organizationId, role, userType }} user
 */
export function registerToken(token, user) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  tokenStore.set(token, { ...user, expiresAt });
  logger.debug(`🔑 Token registered for "${user.username}" org=${user.organizationId}`);

  setTimeout(() => {
    if (tokenStore.has(token)) {
      tokenStore.delete(token);
      logger.debug(`⏰ Token expired for "${user.username}"`);
    }
  }, TOKEN_TTL_MS + 1000);
}

/**
 * Validate and consume a one-time token.
 * @param {string} token
 * @returns {{ userId, username, organizationId, role, userType } | null}
 */
export function consumeToken(token) {
  if (!token || typeof token !== 'string') return null;

  const entry = tokenStore.get(token);
  if (!entry) {
    logger.warn('❌ Auth failed: unknown token');
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    logger.warn('❌ Auth failed: token expired');
    return null;
  }

  tokenStore.delete(token); // one-time use
  logger.info(`✅ Auth ok: "${entry.username}" org=${entry.organizationId}`);
  const { expiresAt: _, ...user } = entry;
  return user;
}

// Periodic stale-token cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [token, entry] of tokenStore.entries()) {
    if (now > entry.expiresAt) { tokenStore.delete(token); cleaned++; }
  }
  if (cleaned > 0) logger.debug(`🧹 Cleaned ${cleaned} expired tokens`);
}, 5 * 60_000);
