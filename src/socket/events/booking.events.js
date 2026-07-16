/**
 * CaterSync AI — Booking Socket Events
 *
 * Registers booking.* event listeners on an authenticated socket.
 * All inbound events are validated before dispatch.
 * Outbound broadcasts go only to affected rooms — never globally.
 *
 * Events handled (server → client):
 *   booking.created    — new booking made
 *   booking.updated    — any field changed
 *   booking.confirmed  — booking confirmed by org
 *   booking.rejected   — booking rejected by org
 *   booking.completed  — event completed
 *   booking.cancelled  — booking cancelled
 *
 * Events handled (client → server):
 *   room.booking.join  — user opens booking detail page
 *   room.booking.leave — user leaves booking detail page
 */

import { Rooms, joinRoom, leaveRoom, emitToRooms } from '../rooms.js';
import { updateLastSeen } from '../connectionManager.js';
import { logger } from '../logger.js';

/**
 * Register booking event handlers on a socket.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerBookingEvents(socket, io) {
  const user = socket.data.user;

  // ── Client requests to join a booking-specific room ───────────────────────
  socket.on('room.booking.join', async ({ bookingId } = {}) => {
    if (!bookingId) return;
    updateLastSeen(user.userId);
    const room = Rooms.booking(bookingId);
    const result = await joinRoom(socket, room);
    if (result.ok) {
      socket.emit('room.joined', { room });
    } else {
      socket.emit('error', { code: result.error, room });
    }
  });

  // ── Client leaves a booking room ─────────────────────────────────────────
  socket.on('room.booking.leave', async ({ bookingId } = {}) => {
    if (!bookingId) return;
    await leaveRoom(socket, Rooms.booking(bookingId));
    socket.emit('room.left', { room: Rooms.booking(bookingId) });
  });
}

// ── Server-side Emitters (called from REST handlers via emitSocketEvent) ──────

/**
 * Emit booking.created to the organization room.
 * @param {import('socket.io').Server} io
 * @param {{ bookingId, organizationId, clientName, status, eventDate }} payload
 */
export function emitBookingCreated(io, { bookingId, organizationId, clientName, status, eventDate }) {
  logger.info(`📅 booking.created #${bookingId} org=${organizationId}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'booking.created', {
    bookingId, clientName, status, eventDate
  });
}

/**
 * Emit booking.updated to org + booking rooms.
 * @param {import('socket.io').Server} io
 * @param {{ bookingId, organizationId, status, field? }} payload
 */
export function emitBookingUpdated(io, { bookingId, organizationId, status, field }) {
  logger.info(`📝 booking.updated #${bookingId} status=${status}`);
  emitToRooms(io, [
    Rooms.organization(organizationId),
    Rooms.booking(bookingId)
  ], 'booking.updated', { bookingId, status, field });
}

/**
 * Emit booking.confirmed to org + booking rooms.
 */
export function emitBookingConfirmed(io, { bookingId, organizationId }) {
  logger.info(`✅ booking.confirmed #${bookingId}`);
  emitToRooms(io, [Rooms.organization(organizationId), Rooms.booking(bookingId)], 'booking.confirmed', { bookingId });
}

/**
 * Emit booking.rejected to org + booking rooms.
 */
export function emitBookingRejected(io, { bookingId, organizationId, reason }) {
  logger.info(`❌ booking.rejected #${bookingId}`);
  emitToRooms(io, [Rooms.organization(organizationId), Rooms.booking(bookingId)], 'booking.rejected', { bookingId, reason });
}

/**
 * Emit booking.completed to org + booking rooms.
 */
export function emitBookingCompleted(io, { bookingId, organizationId }) {
  logger.info(`🏁 booking.completed #${bookingId}`);
  emitToRooms(io, [Rooms.organization(organizationId), Rooms.booking(bookingId)], 'booking.completed', { bookingId });
}

/**
 * Emit booking.cancelled to org + booking rooms.
 */
export function emitBookingCancelled(io, { bookingId, organizationId }) {
  logger.info(`🚫 booking.cancelled #${bookingId}`);
  emitToRooms(io, [Rooms.organization(organizationId), Rooms.booking(bookingId)], 'booking.cancelled', { bookingId });
}
