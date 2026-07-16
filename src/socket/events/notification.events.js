/**
 * CaterSync AI — Notification Socket Events
 *
 * Events (server → client):
 *   notification.created  — new notification for a user
 *   notification.read     — user marked notification as read
 *   notification.deleted  — notification removed
 *
 * Notifications are always scoped to the specific user room.
 */

import { Rooms, emitToRooms } from '../rooms.js';
import { logger } from '../logger.js';

/**
 * Register notification socket listeners.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerNotificationEvents(socket, io) {
  // No inbound client events — notifications are server-pushed only
}

// ── Server-side Emitters ──────────────────────────────────────────────────────

/**
 * Send a new notification to a specific user.
 * @param {import('socket.io').Server} io
 * @param {{ userId, message, type, timestamp, notificationId? }} payload
 */
export function emitNotificationCreated(io, { userId, message, type, timestamp, notificationId }) {
  logger.info(`🔔 notification.created → user:${userId}`);
  emitToRooms(io, [Rooms.user(userId)], 'notification.created', {
    notificationId, message, type, timestamp
  });
}

/**
 * Notify user their notification was marked read.
 * @param {import('socket.io').Server} io
 * @param {{ userId, notificationId }} payload
 */
export function emitNotificationRead(io, { userId, notificationId }) {
  emitToRooms(io, [Rooms.user(userId)], 'notification.read', { notificationId });
}

/**
 * Notify user their notification was deleted.
 * @param {import('socket.io').Server} io
 * @param {{ userId, notificationId }} payload
 */
export function emitNotificationDeleted(io, { userId, notificationId }) {
  emitToRooms(io, [Rooms.user(userId)], 'notification.deleted', { notificationId });
}
