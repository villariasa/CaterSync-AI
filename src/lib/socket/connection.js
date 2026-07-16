/**
 * CaterSync AI — Socket.IO Connection Service
 *
 * Singleton Svelte 5 reactive service managing connection lifecycle,
 * token acquisition, backoff re-auth handshakes, and visibility changes.
 */

import { setContext, getContext } from 'svelte';
import { socket } from './socket.js';

const SOCKET_SERVICE_KEY = Symbol('SOCKET_SERVICE');

export class ConnectionService {
  /** @type {'disconnected' | 'connecting' | 'connected' | 'authenticating' | 'authenticated' | 'error'} */
  status = $state('disconnected');

  /** @type {boolean} */
  connected = $state(false);

  /** @type {boolean} */
  socketAvailable = $state(true); // false if server is totally offline or unavailable

  /** @type {string | null} */
  userId = $state(null);

  /** @type {string | number | null} */
  organizationId = $state(null);

  /** @type {string | null} */
  username = $state(null);

  /** @type {string | null} */
  role = $state(null);

  #isDestroyed = false;
  #activeRooms = new Set();
  #handlers = new Map();

  constructor() {
    if (typeof window === 'undefined') return;

    // Attach basic listeners to the raw socket singleton
    socket.on('connect', () => {
      this.status = 'authenticating';
    });

    socket.on('disconnect', (reason) => {
      this.connected = false;
      this.status = 'disconnected';
      if (reason === 'io server disconnect') {
        // Disconnected by server (e.g. duplicate session) -> do not auto-reconnect
        console.warn('🔌 Disconnected by server: session terminated.');
      } else {
        // Auto-reconnect happens via socket.io client settings
        console.info(`🔌 Disconnected: ${reason}`);
      }
    });

    socket.on('connect_error', async (err) => {
      console.warn('❌ Connection error:', err.message);
      this.status = 'error';

      if (err.message === 'UNAUTHORIZED') {
        // Handshake rejected or token expired -> get new token and retry connection
        console.info('🔑 Auth token expired or invalid. Attempting to refresh token...');
        await this.#refreshTokenAndConnect();
      }
    });

    // Handle token auth acceptance from gateway
    socket.on('auth.ok', (msg) => {
      this.status = 'authenticated';
      this.connected = true;
      this.userId = msg.userId;
      this.organizationId = msg.organizationId;
      this.username = msg.username;
      this.role = msg.role;

      console.info(`🔓 Authenticated real-time session for "${msg.username}"`);

      // Re-join active rooms on reconnect
      for (const room of this.#activeRooms) {
        socket.emit('room.join', { room });
      }

      this.#notify('socket.connected', msg);
    });

    socket.on('room.joined', (payload) => {
      this.#notify('socket.room.joined', payload);
    });

    socket.on('room.left', (payload) => {
      this.#notify('socket.room.left', payload);
    });

    socket.on('system', (payload) => {
      if (payload.type === 'DUPLICATE_SESSION') {
        console.warn('⚠️ Session terminated: another session started.');
        this.#notify('socket.duplicate_session', payload);
      }
    });
  }

  /**
   * Fetch one-time token and connect socket.
   */
  async connect() {
    if (typeof window === 'undefined' || this.#isDestroyed) return;

    if (socket.connected) return;

    this.status = 'connecting';
    await this.#refreshTokenAndConnect();
  }

  /**
   * Disconnect the socket connection.
   */
  disconnect() {
    if (socket) {
      socket.disconnect();
    }
    this.status = 'disconnected';
    this.connected = false;
  }

  /**
   * Gracefully destroy the service connection.
   */
  destroy() {
    this.#isDestroyed = true;
    this.disconnect();
    socket.off(); // remove all listeners
  }

  /**
   * Join a room.
   * @param {string} room
   */
  joinRoom(room) {
    if (!room) return;
    this.#activeRooms.add(room);
    if (socket.connected) {
      socket.emit('room.join', { room });
    }
  }

  /**
   * Leave a room.
   * @param {string} room
   */
  leaveRoom(room) {
    if (!room) return;
    this.#activeRooms.delete(room);
    if (socket.connected) {
      socket.emit('room.leave', { room });
    }
  }

  // ── Event Subscription API (internal handlers bridge) ───────────────────────

  on(event, handler) {
    if (!this.#handlers.has(event)) {
      this.#handlers.set(event, new Set());
    }
    this.#handlers.get(event).add(handler);
    socket.on(event, handler);
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
    socket.off(event, handler);
  }

  #notify(event, payload) {
    const set = this.#handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try { h(payload); } catch (e) { console.error(e); }
    }
  }

  // ── Private Re-auth Token Refresh ──────────────────────────────────────────

  async #refreshTokenAndConnect() {
    try {
      const res = await fetch('/api/auth/ws-token');
      if (!res.ok) {
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}));
          if (body.socketDisabled) {
            console.warn('⚡ Real-time Socket server is offline. Features disabled.');
            this.socketAvailable = false;
            this.status = 'disconnected';
            return;
          }
        }
        this.status = 'disconnected';
        return;
      }

      const { token, socketUrl } = await res.json();

      // Configure singleton connection parameters
      socket.io.uri = socketUrl || 'http://localhost:4001';
      socket.auth = { token };

      // Initiate connection
      socket.connect();
    } catch (err) {
      console.warn('⚡ Failed to obtain Socket auth token:', err.message);
      this.status = 'error';
    }
  }
}

// ── Svelte Context Helpers ───────────────────────────────────────────────────

export function createSocketService() {
  const service = new ConnectionService();
  setContext(SOCKET_SERVICE_KEY, service);
  return service;
}

export function getSocketService() {
  return getContext(SOCKET_SERVICE_KEY);
}
