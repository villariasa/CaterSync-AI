/**
 * CaterSync AI — Chat Socket Events
 *
 * Full bidirectional real-time chat scoped to booking rooms.
 *
 * Events (client → server):
 *   chat.message   — user sends a message
 *   chat.typing    — user is typing indicator
 *   chat.read      — user read a message
 *   chat.delivered — client confirms message delivered (optional ack)
 *
 * Events (server → client):
 *   chat.message   — broadcast to booking room
 *   chat.typing    — broadcast to booking room (excluding sender)
 *   chat.read      — read receipt broadcast
 *   chat.delivered — delivery confirmation
 *   chat.deleted   — message deleted
 *
 * Notes:
 *   - Messages are not persisted in the socket layer (REST handles persistence)
 *   - File attachment support: include fileUrl and fileName in payload
 *   - Typing is throttled client-side; no server-side throttle needed
 */

import { Rooms, emitToRooms, emitToRoomExcludeSelf } from '../rooms.js';
import { updateLastSeen } from '../connectionManager.js';
import { logger } from '../logger.js';

/**
 * Register chat event handlers for an authenticated socket.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerChatEvents(socket, io) {
  const user = socket.data.user;

  // ── chat.message (client → server → room) ─────────────────────────────────
  socket.on('chat.message', ({ bookingId, text, fileUrl, fileName } = {}) => {
    if (!bookingId || (!text?.trim() && !fileUrl)) return;
    updateLastSeen(user.userId);

    const message = {
      messageId: `${Date.now()}-${user.userId}`,
      bookingId,
      senderId:   user.userId,
      senderName: user.username,
      text: text?.trim() || null,
      fileUrl:  fileUrl  || null,
      fileName: fileName || null,
      timestamp: new Date().toISOString(),
    };

    logger.info(`💬 chat.message booking=#${bookingId} from="${user.username}"`);
    emitToRooms(io, [Rooms.booking(bookingId)], 'chat.message', message);
  });

  // ── chat.typing (client → server → room, excluding sender) ────────────────
  socket.on('chat.typing', ({ bookingId, isTyping } = {}) => {
    if (!bookingId) return;
    emitToRoomExcludeSelf(socket, Rooms.booking(bookingId), 'chat.typing', {
      bookingId,
      userId: user.userId,
      username: user.username,
      isTyping: Boolean(isTyping),
    });
  });

  // ── chat.read (client → server → room) ────────────────────────────────────
  socket.on('chat.read', ({ bookingId, messageId } = {}) => {
    if (!bookingId || !messageId) return;
    emitToRoomExcludeSelf(socket, Rooms.booking(bookingId), 'chat.read', {
      bookingId,
      messageId,
      userId: user.userId,
    });
  });

  // ── chat.delivered (acknowledgement from recipient) ────────────────────────
  socket.on('chat.delivered', ({ bookingId, messageId } = {}) => {
    if (!bookingId || !messageId) return;
    emitToRoomExcludeSelf(socket, Rooms.booking(bookingId), 'chat.delivered', {
      bookingId,
      messageId,
      userId: user.userId,
    });
  });
}

// ── Server-side Emitters (called from REST endpoints) ─────────────────────────

/**
 * Broadcast a chat message to a booking room (e.g., from a REST-saved message).
 */
export function emitChatMessage(io, payload) {
  const { bookingId } = payload;
  logger.info(`💬 chat.message (REST) booking=#${bookingId}`);
  emitToRooms(io, [Rooms.booking(bookingId)], 'chat.message', payload);
}

/**
 * Broadcast a chat.deleted event to a booking room.
 */
export function emitChatDeleted(io, { bookingId, messageId }) {
  emitToRooms(io, [Rooms.booking(bookingId)], 'chat.deleted', { bookingId, messageId });
}
