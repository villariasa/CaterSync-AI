/**
 * CaterSync AI — Socket.IO Event Emitter Helper (Server-side REST use)
 *
 * Provides a fire-and-forget helper for REST API handlers to emit Socket.IO
 * events to the standalone Socket.IO server via its internal HTTP endpoint.
 *
 * This approach works whether SvelteKit and the Socket.IO server are in the same
 * process or separate processes (npm run dev:full).
 *
 * Usage in any +server.js:
 *   import { emitSocketEvent } from '$lib/server/wsEmit.js';
 *   await emitSocketEvent('booking.created', { bookingId, organizationId, clientName, status });
 *
 * If the Socket.IO server is not running, the error is swallowed silently (non-critical).
 */

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://127.0.0.1:4001';

/**
 * Emit a Socket.IO event to the Socket.IO server's internal event bus.
 * Fire-and-forget — errors are logged but never thrown.
 *
 * @param {string} eventType - e.g. 'booking.created'
 * @param {object} payload
 */
export async function emitSocketEvent(eventType, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${SOCKET_SERVER_URL}/internal/emit-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: eventType, payload }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text();
      console.warn(`⚡ Socket.IO emit "${eventType}" failed (${res.status}):`, body);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    // Socket.IO server may not be running — this is non-critical, REST still works
    if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('TimeoutError') && err.name !== 'AbortError') {
      console.warn(`⚡ Socket.IO emit "${eventType}" error:`, err.message);
    }
  }
}

// Keep backward compatibility with previous native ws setup
export const emitWsEvent = emitSocketEvent;
