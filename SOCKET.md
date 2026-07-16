# CaterSync AI — Socket.IO Production Architecture

This document describes the upgraded real-time communication system for CaterSync AI using **Socket.IO**.

---

## 1. Overview & Architecture

```
┌────────────────────────────────┐
│   Browser (SvelteKit Client)   │
└───────────────┬────────────────┘
                │ ws / http (polling fallback)
                ▼
┌────────────────────────────────┐
│    Socket.IO Server (Port 4001)│
│  ├── Gateway (gateway.js)      │
│  ├── Room Mgr (rooms.js)       │
│  └── Connection Mgr            │
└───────────────▲────────────────┘
                │ internal HTTP POST
                │ (localhost only)
┌───────────────┴────────────────┐
│      SvelteKit REST API        │
│  └── Handlers -> emitSocket()  │
└────────────────────────────────┘
```

The system preserves all REST API functions (login, registrations, CRUD operations, payments, reports, etc.) and layers Socket.IO strictly as a **non-blocking server-push real-time event system**.

---

## 2. Folder Structure

```
src/
├── lib/
│   ├── server/
│   │   └── wsEmit.js              ← REST helper (defines emitSocketEvent)
│   └── socket/                    ← Client-side Socket.IO
│       ├── socket.js              ← Configured socket singleton
│       ├── connection.js          ← Connection service & lifecycle manager
│       ├── events.js              ← Event catalog constants
│       ├── subscriptions.js       ← Composable on/off/once helpers
│       └── stores.js              ← Svelte 5 global reactive stores
│
├── routes/
│   └── api/
│       └── auth/
│           └── ws-token/
│               └── +server.js     ← One-time token issuer
│
└── socket/                        ← Standalone Socket.IO Server
    ├── server.js                  ← Main entry point & internal API routes
    ├── gateway.js                 ← Gateway setup, CORS, and connection handler
    ├── middleware.js              ← Auth validation & Rate limiter middlewares
    ├── rooms.js                   ← Room assignments & security checks
    ├── connectionManager.js       ← Tracks online users & displaced duplicates
    ├── logger.js                  ← Console log writer
    └── events/                    ← Event routers (no business logic)
        ├── booking.events.js
        ├── chat.events.js
        ├── dashboard.events.js
        ├── inventory.events.js
        ├── notification.events.js
        ├── payment.events.js
        └── user.events.js
```

---

## 3. Connection Lifecycle

1. **Initialization:** On layout mount (`+layout.svelte`), `socketService.connect()` is called if authenticated.
2. **Auth Handshake:**
   - Client makes HTTP GET to SvelteKit `/api/auth/ws-token`.
   - SvelteKit calls the Socket.IO server's `/internal/register-token` endpoint via localhost HTTP, registering a short-lived (90s) one-time token.
   - SvelteKit returns the token and `socketUrl` to the browser.
   - Browser client connects using `auth: { token }` parameters.
3. **Gateway Middleware:**
   - Checks `socket.handshake.auth.token`.
   - Resolves user session context and stores it in `socket.data.user`.
   - Rejects the upgrade if invalid or expired.
4. **Active Connection:**
   - Socket joins standard channels: `organization:{id}`, `user:{userId}`, `staff:{id}`.
   - User status is logged, online presence events are broadcast.
   - Heartbeats keep the session open.
5. **Heartbeat:** Handled natively by Socket.IO (`pingInterval: 25_000`, `pingTimeout: 20_000`). If client goes silent, gateway terminates the connection.

---

## 4. Reconnect Strategy

- **Token Refresh on Expiry:**
  - If a connection attempt drops due to token expiry, a `connect_error` event is fired with `UNAUTHORIZED` code.
  - The client ConnectionService interceptor detects this, fetches a fresh token from `/api/auth/ws-token`, updates `socket.auth.token` dynamically, and retries.
- **Backoff:** Reconnect options are set to `reconnection: true` with exponential backoff configurations (1s to 10s max, infinite attempts) to preserve server integrity under load.
- **Connection Recovery:** Configured `connectionStateRecovery` for 2 minutes to restore missed event history and re-sync without full reconnect shakes if the network is briefly interrupted.

---

## 5. Room Security and Authorization

We enforce strict authorization checks on room joins to avoid cross-tenant data leaks:

```js
// src/socket/rooms.js
export function isRoomAuthorized(user, room) {
  if (room === Rooms.user(user.userId)) return true;
  if (user.organizationId) {
    if (room === Rooms.organization(user.organizationId)) return true;
    if (room === Rooms.staff(user.organizationId)) return true;
  }
  if (room.startsWith('booking:') && user.organizationId) return true;
  if (room.startsWith('event:') && user.organizationId) return true;
  if (user.role === 'platform_admin') return true;
  return false;
}
```
**No Global Broadcasts:** All broadcasts target specific room channels using `io.to(room).emit()`.

---

## 6. How REST & Socket.IO Work Together

1. **State mutation** occurs through standard REST routes (`POST/PATCH/DELETE`).
2. Once the DB query succeeds, the REST handler invokes the server-side fire-and-forget emitter helper:
   ```js
   import { emitSocketEvent } from '$lib/server/wsEmit.js';
   
   // ... DB queries complete
   emitSocketEvent('booking.updated', { bookingId: 12, organizationId: 1, status: 'Confirmed' });
   ```
3. The helper sends a local `POST` request to `http://localhost:4001/internal/emit-event`.
4. The Socket.IO server catches this post, maps it, and broadcasts only the minimum required payload fields to the target room.

---

## 7. Configuration Environment Variables

Set these in your `.env` configuration:

```env
# SvelteKit client lookup
PUBLIC_SOCKET_URL=http://localhost:4001

# Standalone Socket.IO Server configuration
SOCKET_PORT=4001
SOCKET_HOST=0.0.0.0
SOCKET_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
SOCKET_SERVER_URL=http://127.0.0.1:4001
SOCKET_LOG_LEVEL=info
```
