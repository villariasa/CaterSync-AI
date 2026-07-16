/**
 * CaterSync AI — Payment Socket Events
 *
 * Events (server → client):
 *   payment.received  — payment successfully processed
 *   payment.updated   — payment record modified
 *   payment.failed    — payment attempt failed
 *
 * All payment events are scoped to the organization room.
 * Dashboard is updated separately via dashboard.events.js.
 */

import { Rooms, emitToRooms } from '../rooms.js';
import { logger } from '../logger.js';

/**
 * Register payment socket listeners (no inbound client events).
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerPaymentEvents(socket, io) {
  // Payment events are server-push only
}

// ── Server-side Emitters ──────────────────────────────────────────────────────

/**
 * @param {import('socket.io').Server} io
 * @param {{ bookingId, organizationId, amount }} payload
 */
export function emitPaymentReceived(io, { bookingId, organizationId, amount }) {
  logger.info(`💰 payment.received booking=#${bookingId} amount=${amount}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'payment.received', { bookingId, amount });
}

/**
 * @param {import('socket.io').Server} io
 * @param {{ bookingId, organizationId, amount, status }} payload
 */
export function emitPaymentUpdated(io, { bookingId, organizationId, amount, status }) {
  emitToRooms(io, [Rooms.organization(organizationId)], 'payment.updated', { bookingId, amount, status });
}

/**
 * @param {import('socket.io').Server} io
 * @param {{ bookingId, organizationId, reason }} payload
 */
export function emitPaymentFailed(io, { bookingId, organizationId, reason }) {
  logger.warn(`❗ payment.failed booking=#${bookingId} reason=${reason}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'payment.failed', { bookingId, reason });
}
