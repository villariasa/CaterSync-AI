/**
 * GET /api/auth/ws-token
 *
 * Issues a short-lived (90s) one-time token for WebSocket authentication.
 * The token is registered with the WebSocket server's in-memory store via
 * an internal HTTP call to the WS server.
 *
 * The client receives this token and sends it as the first message after
 * the WebSocket connection opens:
 *   { type: "auth", token: "<token>" }
 *
 * This approach avoids needing to read HTTP-only session cookies over WS.
 */

import { json } from '@sveltejs/kit';
import crypto from 'node:crypto';

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://127.0.0.1:4001';

export async function GET({ locals }) {
  // Must be authenticated via the existing session cookie
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user, tenantId } = locals;

  // Determine user identity fields
  let userId, username, organizationId, role, userType;

  if (user.type === 'org_user') {
    userId = user.username; // username is the stable ID for org users
    username = user.username;
    organizationId = tenantId || user.organization_id || 1;
    role = user.role;
    userType = 'org_user';
  } else if (user.type === 'platform_admin') {
    userId = user.username;
    username = user.username;
    organizationId = null;
    role = 'platform_admin';
    userType = 'platform_admin';
  } else if (user.type === 'subscriber') {
    userId = `sub_${user.subscriber_id}`;
    username = user.username;
    organizationId = null;
    role = 'subscriber';
    userType = 'subscriber';
  } else if (user.type === 'supplier') {
    userId = `sup_${user.supplier_account_id}`;
    username = user.username;
    organizationId = null;
    role = 'supplier';
    userType = 'supplier';
  } else {
    return json({ error: 'Unknown user type' }, { status: 401 });
  }

  // Generate a cryptographically random one-time token
  const token = crypto.randomBytes(32).toString('hex');

  const userPayload = { userId, username, organizationId, role, userType };

  try {
    // Register token with the Socket server's in-memory store
    const regRes = await fetch(`${SOCKET_SERVER_URL}/internal/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, user: userPayload }),
      signal: AbortSignal.timeout(3000)
    });

    if (!regRes.ok) {
      const errBody = await regRes.text();
      console.error('❌ Socket token registration failed:', errBody);
      return json({ error: 'Socket server unavailable' }, { status: 503 });
    }
  } catch (err) {
    // Socket server is not running
    console.warn('⚠️ Socket.IO server unreachable — real-time features disabled:', err.message);
    return json({
      error: 'Socket server not available',
      socketDisabled: true
    }, { status: 503 });
  }

  return json({
    success: true,
    token,
    expiresIn: 90, // seconds
    socketUrl: process.env.PUBLIC_SOCKET_URL || `http://localhost:4001`
  });
}

