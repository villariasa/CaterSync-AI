/**
 * POST /api/auth/logout
 * 
 * Properly revokes the current session in the DB and clears all cookies.
 */

import { json } from '@sveltejs/kit';
import { revokeByRefreshToken } from '$lib/server/auth/session.js';
import { clearAuthCookies } from '$lib/server/auth/tokens.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

export async function POST({ cookies, locals }) {
  const refreshToken = cookies.get('cs_refresh_token');

  // Revoke session in DB
  if (refreshToken) {
    await revokeByRefreshToken(refreshToken);
  }

  // Audit log
  if (locals.user) {
    logAuthEvent({
      eventType: AUTH_EVENTS.LOGOUT,
      userId: locals.user.id,
      userRole: locals.user.type,
      identifier: locals.user.username
    });
  }

  // Clear all cookies (new + legacy)
  clearAuthCookies(cookies);

  return json({ success: true });
}
