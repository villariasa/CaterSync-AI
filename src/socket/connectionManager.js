/**
 * CaterSync AI — Socket.IO Connection Manager
 *
 * Tracks online users per organization, prevents duplicate connections,
 * and manages last-seen timestamps.
 *
 * Data model:
 *   onlineUsers: Map<userId, { socketId, username, organizationId, role, connectedAt, lastSeen }>
 */

import { logger } from './logger.js';

/** @type {Map<string, { socketId, username, organizationId, role, connectedAt, lastSeen }>} */
const onlineUsers = new Map();

/**
 * Called when a socket successfully authenticates and connects.
 * Handles duplicate connections: if same user connects twice, disconnect the older socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function onUserConnect(socket, io) {
  const { user } = socket.data;
  const { userId, username, organizationId, role } = user;

  // If user already has an active socket, disconnect the old one
  const existing = onlineUsers.get(userId);
  if (existing && existing.socketId !== socket.id) {
    const oldSocket = io.sockets.sockets.get(existing.socketId);
    if (oldSocket) {
      logger.info(`🔄 Duplicate connection — disconnecting old socket for "${username}"`);
      oldSocket.emit('system', { type: 'DUPLICATE_SESSION', message: 'Another session started elsewhere.' });
      oldSocket.disconnect(true);
    }
  }

  onlineUsers.set(userId, {
    socketId: socket.id,
    username,
    organizationId,
    role,
    connectedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  });

  logger.info(`🟢 Online: "${username}" (org=${organizationId}) — ${onlineUsers.size} total online`);
}

/**
 * Called when a socket disconnects.
 * @param {import('socket.io').Socket} socket
 */
export function onUserDisconnect(socket) {
  const { user } = socket.data || {};
  if (!user) return;

  const { userId, username } = user;
  const entry = onlineUsers.get(userId);

  // Only remove if this is the socket that was tracked (not a displaced old socket)
  if (entry && entry.socketId === socket.id) {
    entry.lastSeen = new Date().toISOString();
    onlineUsers.delete(userId);
    logger.info(`🔴 Offline: "${username}" — ${onlineUsers.size} total online`);
  }
}

/**
 * Update the lastSeen timestamp for a user (called on any event activity).
 * @param {string} userId
 */
export function updateLastSeen(userId) {
  const entry = onlineUsers.get(userId);
  if (entry) entry.lastSeen = new Date().toISOString();
}

/**
 * Get all online users belonging to an organization.
 * @param {string | number} organizationId
 * @returns {{ userId, username, role, connectedAt, lastSeen }[]}
 */
export function getOnlineUsers(organizationId) {
  const result = [];
  for (const [userId, entry] of onlineUsers.entries()) {
    if (String(entry.organizationId) === String(organizationId)) {
      result.push({ userId, username: entry.username, role: entry.role, connectedAt: entry.connectedAt, lastSeen: entry.lastSeen });
    }
  }
  return result;
}

/**
 * Check if a specific user is currently online.
 * @param {string} userId
 * @returns {boolean}
 */
export function isOnline(userId) {
  return onlineUsers.has(userId);
}

/**
 * Get total connected client count.
 * @returns {number}
 */
export function getTotalOnline() {
  return onlineUsers.size;
}

/**
 * Diagnostic snapshot.
 * @returns {{ total: number, users: object[] }}
 */
export function getDiagnostics() {
  return {
    total: onlineUsers.size,
    users: Array.from(onlineUsers.entries()).map(([userId, v]) => ({ userId, ...v })),
  };
}
