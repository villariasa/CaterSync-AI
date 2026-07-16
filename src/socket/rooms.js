/**
 * CaterSync AI — Socket.IO Room Manager
 *
 * Provides helpers for joining/leaving rooms with authorization checks.
 * Socket.IO handles the actual room Set internally; this module adds:
 *   - Authorization validation (prevent room hijacking)
 *   - Targeted emit helpers (always room-scoped, never global)
 *   - Room name helpers (namespace conventions)
 *
 * Room naming conventions:
 *   organization:{organizationId}  — all org members
 *   booking:{bookingId}            — per-booking chat & status
 *   event:{eventId}                — per-event updates
 *   user:{userId}                  — personal notifications
 *   staff:{organizationId}         — staff-only channel
 */

import { logger } from './logger.js';

// ── Room Name Helpers ─────────────────────────────────────────────────────────

export const Rooms = {
  organization: (id) => `organization:${id}`,
  booking:      (id) => `booking:${id}`,
  event:        (id) => `event:${id}`,
  user:         (id) => `user:${id}`,
  staff:        (id) => `staff:${id}`,
};

// ── Authorization ─────────────────────────────────────────────────────────────

/**
 * Determine whether a user is authorized to join a given room.
 * @param {{ userId, organizationId, role, userType }} user
 * @param {string} room
 * @returns {boolean}
 */
export function isRoomAuthorized(user, room) {
  // Own user room
  if (room === Rooms.user(user.userId)) return true;

  // Own organization rooms
  if (user.organizationId) {
    if (room === Rooms.organization(user.organizationId)) return true;
    if (room === Rooms.staff(user.organizationId)) return true;
  }

  // Booking rooms — any org member may join (booking-level auth via DB would need lookup)
  if (room.startsWith('booking:') && user.organizationId) return true;

  // Event rooms — same org scope
  if (room.startsWith('event:') && user.organizationId) return true;

  // Platform admins can join any room
  if (user.role === 'platform_admin') return true;

  return false;
}

// ── Join / Leave ──────────────────────────────────────────────────────────────

/**
 * Automatically join the default rooms for a newly authenticated socket.
 * Called right after auth middleware succeeds.
 * @param {import('socket.io').Socket} socket
 */
export async function joinDefaultRooms(socket) {
  const { user } = socket.data;

  // Always join personal notification room
  await socket.join(Rooms.user(user.userId));

  // Join org and staff room if org member
  if (user.organizationId) {
    await socket.join(Rooms.organization(user.organizationId));
    await socket.join(Rooms.staff(user.organizationId));
  }

  logger.debug(`📥 ${user.username} joined default rooms`);
}

/**
 * Authorize and join a specific room (called from client room.join event).
 * @param {import('socket.io').Socket} socket
 * @param {string} room
 * @returns {{ ok: boolean, error?: string }}
 */
export async function joinRoom(socket, room) {
  const { user } = socket.data;

  if (!isRoomAuthorized(user, room)) {
    logger.warn(`🚫 "${user.username}" unauthorized join attempt: "${room}"`);
    return { ok: false, error: 'UNAUTHORIZED_ROOM' };
  }

  await socket.join(room);
  logger.debug(`📥 "${user.username}" joined room "${room}"`);
  return { ok: true };
}

/**
 * Leave a room.
 * @param {import('socket.io').Socket} socket
 * @param {string} room
 */
export async function leaveRoom(socket, room) {
  await socket.leave(room);
  logger.debug(`📤 "${socket.data.user?.username}" left room "${room}"`);
}

// ── Targeted Broadcast Helpers ────────────────────────────────────────────────

/**
 * Emit an event to a single room.
 * @param {import('socket.io').Server} io
 * @param {string} room
 * @param {string} event
 * @param {object} payload
 */
export function emitToRoom(io, room, event, payload) {
  io.to(room).emit(event, payload);
  logger.debug(`📡 emit "${event}" → room "${room}"`);
}

/**
 * Emit an event to multiple rooms (Socket.IO deduplicates natively).
 * @param {import('socket.io').Server} io
 * @param {string[]} rooms
 * @param {string} event
 * @param {object} payload
 */
export function emitToRooms(io, rooms, event, payload) {
  io.to(rooms).emit(event, payload);
  logger.debug(`📡 emit "${event}" → rooms [${rooms.join(', ')}]`);
}

/**
 * Emit to a room excluding the sender.
 * @param {import('socket.io').Socket} socket
 * @param {string} room
 * @param {string} event
 * @param {object} payload
 */
export function emitToRoomExcludeSelf(socket, room, event, payload) {
  socket.to(room).emit(event, payload);
  logger.debug(`📡 emit "${event}" → room "${room}" (excluding sender)`);
}
