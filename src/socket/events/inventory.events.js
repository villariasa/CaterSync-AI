/**
 * CaterSync AI — Inventory Socket Events
 *
 * Events (server → client):
 *   inventory.updated     — stock quantity changed
 *   inventory.low_stock   — stock at or below reorder point
 *   inventory.out_of_stock — stock reached zero
 */

import { Rooms, emitToRooms } from '../rooms.js';
import { logger } from '../logger.js';

/**
 * Register inventory-related socket listeners on a socket.
 * No client→server events for inventory (read-only on client).
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerInventoryEvents(socket, io) {
  // No inbound client events for inventory — updates come from REST API hooks only
}

// ── Server-side Emitters ──────────────────────────────────────────────────────

/**
 * @param {import('socket.io').Server} io
 * @param {{ ingredientId, organizationId, quantity, unit }} payload
 */
export function emitInventoryUpdated(io, { ingredientId, organizationId, quantity, unit }) {
  logger.info(`📦 inventory.updated ingredient=${ingredientId} qty=${quantity}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'inventory.updated', {
    ingredientId, quantity, unit
  });
}

/**
 * @param {import('socket.io').Server} io
 * @param {{ ingredientId, organizationId, name, quantity, threshold }} payload
 */
export function emitInventoryLowStock(io, { ingredientId, organizationId, name, quantity, threshold }) {
  logger.warn(`⚠️ inventory.low_stock "${name}" qty=${quantity} threshold=${threshold}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'inventory.low_stock', {
    ingredientId, name, quantity, threshold
  });
}

/**
 * @param {import('socket.io').Server} io
 * @param {{ ingredientId, organizationId, name }} payload
 */
export function emitInventoryOutOfStock(io, { ingredientId, organizationId, name }) {
  logger.warn(`🚨 inventory.out_of_stock "${name}"`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'inventory.out_of_stock', {
    ingredientId, name
  });
}
