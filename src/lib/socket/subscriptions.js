/**
 * CaterSync AI — Socket.IO Subscription & Emit Composable Utilities
 *
 * Provides type-safe and composable subscription APIs matching Socket.IO client specifications.
 */

import { socketService } from './connection.js';

/**
 * Subscribe to a Socket.IO event.
 * @param {string} event
 * @param {Function} handler
 */
export function subscribe(event, handler) {
  socketService.on(event, handler);
}

/**
 * Unsubscribe from a Socket.IO event.
 * @param {string} event
 * @param {Function} handler
 */
export function unsubscribe(event, handler) {
  socketService.off(event, handler);
}

/**
 * Subscribe to a Socket.IO event and trigger exactly once.
 * @param {string} event
 * @param {Function} handler
 */
export function subscribeOnce(event, handler) {
  socketService.on(event, function wrapper(payload) {
    handler(payload);
    socketService.off(event, wrapper);
  });
}

/**
 * Send an event message to the Socket.IO server.
 * @param {string} event
 * @param {object} payload
 */
export function emit(event, payload) {
  socketService.emit(event, payload);
}

/**
 * Join a specific room.
 * @param {string} room
 */
export function joinRoom(room) {
  socketService.joinRoom(room);
}

/**
 * Leave a specific room.
 * @param {string} room
 */
export function leaveRoom(room) {
  socketService.leaveRoom(room);
}

