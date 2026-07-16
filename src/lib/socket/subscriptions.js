/**
 * CaterSync AI — Socket.IO Subscription & Emit Composable Utilities
 *
 * Provides type-safe and composable subscription APIs matching Socket.IO client specifications.
 */

import { socket } from './socket.js';

/**
 * Subscribe to a Socket.IO event.
 * @param {string} event
 * @param {Function} handler
 */
export function subscribe(event, handler) {
  socket.on(event, handler);
}

/**
 * Unsubscribe from a Socket.IO event.
 * @param {string} event
 * @param {Function} handler
 */
export function unsubscribe(event, handler) {
  socket.off(event, handler);
}

/**
 * Subscribe to a Socket.IO event and trigger exactly once.
 * @param {string} event
 * @param {Function} handler
 */
export function subscribeOnce(event, handler) {
  socket.once(event, handler);
}

/**
 * Send an event message to the Socket.IO server.
 * @param {string} event
 * @param {object} payload
 */
export function emit(event, payload) {
  socket.emit(event, payload);
}

/**
 * Join a specific room.
 * @param {string} room
 */
export function joinRoom(room) {
  socket.emit('room.join', { room });
}

/**
 * Leave a specific room.
 * @param {string} room
 */
export function leaveRoom(room) {
  socket.emit('room.leave', { room });
}
