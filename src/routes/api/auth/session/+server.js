/**
 * GET  /api/auth/session  → Current session info
 * GET  /api/auth/devices  → All active sessions/devices for current user
 * POST /api/auth/devices/trust   → Trust current device
 * POST /api/auth/devices/logout  → Logout a specific device by session ID
 * POST /api/auth/devices/logout-all → Logout all devices
 */

import { json } from '@sveltejs/kit';

// GET /api/auth/session
export async function GET({ locals }) {
  if (!locals.user) {
    return json({ authenticated: false }, { status: 401 });
  }

  return json({
    authenticated: true,
    user: {
      id: locals.user.id,
      username: locals.user.username,
      type: locals.user.type,
      role: locals.user.role,
      organization_id: locals.user.organization_id,
      customer_id: locals.user.customer_id,
      deviceId: locals.user.deviceId
    },
    sessionId: locals.sessionId
  });
}
