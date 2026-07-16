/**
 * CaterSync AI — User / Presence Socket Events
 *
 * Handles online/offline presence and organization-level user events.
 *
 * Events (server → client):
 *   user.online         — a user in the org came online
 *   user.offline        — a user in the org went offline
 *   organization.updated — org settings or profile changed
 *
 * Also handles:
 *   The initial online users list sent to a newly connected socket.
 */

import { Rooms, emitToRooms } from '../rooms.js';
import { getOnlineUsers } from '../connectionManager.js';
import { logger } from '../logger.js';

/**
 * Register user presence event handlers.
 * Called right after a socket connects and joins default rooms.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerUserEvents(socket, io) {
  const user = socket.data.user;

  // Send the currently online org members to this newly connected socket
  if (user.organizationId) {
    const onlineList = getOnlineUsers(user.organizationId);
    socket.emit('user.online_list', { users: onlineList });
  }

  // Broadcast this user's presence to their org
  if (user.organizationId) {
    emitUserOnline(io, user);
  }

  // On disconnect, broadcast offline presence (registered in gateway.js)
}

// ── Server-side Emitters ──────────────────────────────────────────────────────

/**
 * Broadcast that a user came online.
 * @param {import('socket.io').Server} io
 * @param {{ userId, username, organizationId }} user
 */
export function emitUserOnline(io, { userId, username, organizationId }) {
  if (!organizationId) return;
  logger.info(`🟢 user.online "${username}" org=${organizationId}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'user.online', { userId, username });
}

/**
 * Broadcast that a user went offline.
 * @param {import('socket.io').Server} io
 * @param {{ userId, username, organizationId }} user
 */
export function emitUserOffline(io, { userId, username, organizationId }) {
  if (!organizationId) return;
  logger.info(`🔴 user.offline "${username}" org=${organizationId}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'user.offline', { userId, username });
}

/**
 * Notify org members that organization settings changed.
 * @param {import('socket.io').Server} io
 * @param {{ organizationId, field }} payload
 */
export function emitOrganizationUpdated(io, { organizationId, field }) {
  logger.info(`🏢 organization.updated org=${organizationId} field=${field}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'organization.updated', { organizationId, field });
}
