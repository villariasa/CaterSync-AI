/**
 * CaterSync AI — Socket.IO Connection Service
 *
 * Singleton Svelte 5 reactive service managing connection lifecycle,
 * token acquisition, backoff re-auth handshakes, and visibility changes.
 *
 * Lazily loads socket.io-client dynamically on client-side to prevent
 * Cloudflare Pages Functions from running server-side client library loads.
 */

import { setContext, getContext } from 'svelte';

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

  #socket = null; // raw socket instance loaded dynamically on browser
  #isDestroyed = false;
  #activeRooms = new Set();
  #handlers = new Map();

  constructor() {
    // Constructor is safe for SSR execution as it performs no imports or client calls
  }

  /**
   * Fetch one-time token and connect socket.
   */
  async connect() {
    if (typeof window === 'undefined' || this.#isDestroyed) return;

    if (this.#socket && this.#socket.connected) return;

    this.status = 'connecting';
    await this.#refreshTokenAndConnect();
  }

  /**
   * Disconnect the socket connection.
   */
  disconnect() {
    if (this.#socket) {
      this.#socket.disconnect();
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
    if (this.#socket) {
      this.#socket.off(); // remove all listeners
    }
  }

  /**
   * Emit an event to the Socket.IO server.
   * @param {string} event
   * @param {object} payload
   */
  emit(event, payload) {
    if (this.#socket && this.connected) {
      this.#socket.emit(event, payload);
    }
  }

  /**
   * Join a room.
   * @param {string} room
   */
  joinRoom(room) {
    if (!room) return;
    this.#activeRooms.add(room);
    if (this.#socket && this.connected) {
      this.#socket.emit('room.join', { room });
    }
  }

  /**
   * Leave a room.
   * @param {string} room
   */
  leaveRoom(room) {
    if (!room) return;
    this.#activeRooms.delete(room);
    if (this.#socket && this.connected) {
      this.#socket.emit('room.leave', { room });
    }
  }

  // ── Event Subscription API ───────────────────────────────────────────────────

  on(event, handler) {
    if (!this.#handlers.has(event)) {
      this.#handlers.set(event, new Set());
    }
    this.#handlers.get(event).add(handler);
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  #notify(event, payload) {
    const set = this.#handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try { h(payload); } catch (e) { console.error(e); }
    }
  }

  // ── Private Re-auth Token Refresh & Lazy Socket Init ──────────────────────

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

      // Lazy load socket.io-client dynamically on client side
      if (!this.#socket) {
        const { io } = await import('socket.io-client');
        this.#socket = io(socketUrl || 'http://localhost:4001', {
          autoConnect: false,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          randomizationFactor: 0.5,
          transports: ['websocket', 'polling'],
          timeout: 20000,
        });

        // Bind all event listeners to this socket instance
        this.#setupSocketListeners();
      } else {
        // Update destination settings
        this.#socket.io.uri = socketUrl || 'http://localhost:4001';
      }

      // Assign authentication token and launch connection
      this.#socket.auth = { token };
      this.#socket.connect();
    } catch (err) {
      console.warn('⚡ Failed to obtain Socket auth token:', err.message);
      this.status = 'error';
    }
  }

  #setupSocketListeners() {
    if (!this.#socket) return;

    this.#socket.on('connect', () => {
      this.status = 'authenticating';
    });

    this.#socket.on('disconnect', (reason) => {
      this.connected = false;
      this.status = 'disconnected';
      if (reason === 'io server disconnect') {
        console.warn('🔌 Disconnected by server: session terminated.');
      } else {
        console.info(`🔌 Disconnected: ${reason}`);
      }
    });

    this.#socket.on('connect_error', async (err) => {
      console.warn('❌ Connection error:', err.message);
      this.status = 'error';

      if (err.message === 'UNAUTHORIZED') {
        console.info('🔑 Auth token expired or invalid. Refreshing token...');
        await this.#refreshTokenAndConnect();
      }
    });

    // Handle token auth acceptance from gateway
    this.#socket.on('auth.ok', (msg) => {
      this.status = 'authenticated';
      this.connected = true;
      this.userId = msg.userId;
      this.organizationId = msg.organizationId;
      this.username = msg.username;
      this.role = msg.role;

      console.info(`🔓 Authenticated real-time session for "${msg.username}"`);

      // Re-join active rooms on reconnect
      for (const room of this.#activeRooms) {
        this.#socket.emit('room.join', { room });
      }

      this.#notify('socket.connected', msg);
    });

    this.#socket.on('room.joined', (payload) => {
      this.#notify('socket.room.joined', payload);
    });

    this.#socket.on('room.left', (payload) => {
      this.#notify('socket.room.left', payload);
    });

    this.#socket.on('system', (payload) => {
      if (payload.type === 'DUPLICATE_SESSION') {
        console.warn('⚠️ Session terminated: another session started.');
        this.#notify('socket.duplicate_session', payload);
      }
    });

    // Catch-all wildcard to pipe raw socket messages into our local handlers Map
    this.#socket.onAny((event, payload) => {
      const skipEvents = ['connect', 'disconnect', 'connect_error', 'auth.ok', 'room.joined', 'room.left', 'system'];
      if (skipEvents.includes(event)) return;

      this.#notify(event, payload);
    });
  }
}

// Global service singleton export
export const socketService = new ConnectionService();

// ── Svelte Context Helpers ───────────────────────────────────────────────────

export function createSocketService() {
  setContext(SOCKET_SERVICE_KEY, socketService);
  return socketService;
}

export function getSocketService() {
  return getContext(SOCKET_SERVICE_KEY);
}
