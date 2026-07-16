/**
 * CaterSync AI — Dashboard Socket Events
 *
 * Pushes live KPI and stats updates to org members.
 * Triggered by REST API hooks after revenue/booking/payment changes.
 *
 * Events (server → client):
 *   dashboard.stats.updated  — KPI counters changed
 */

import { Rooms, emitToRooms } from '../rooms.js';
import { logger } from '../logger.js';

/**
 * Register dashboard socket listeners (no inbound client events).
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerDashboardEvents(socket, io) {
  // Dashboard is server-push only
}

// ── Server-side Emitters ──────────────────────────────────────────────────────

/**
 * Broadcast updated dashboard KPIs to all org members.
 * @param {import('socket.io').Server} io
 * @param {{ organizationId, totalRevenue?, todaySales?, pendingBookings?, activeEvents? }} payload
 */
export function emitDashboardStatsUpdated(io, { organizationId, totalRevenue, todaySales, pendingBookings, activeEvents }) {
  logger.debug(`📊 dashboard.stats.updated org=${organizationId}`);
  emitToRooms(io, [Rooms.organization(organizationId)], 'dashboard.stats.updated', {
    totalRevenue, todaySales, pendingBookings, activeEvents
  });
}
