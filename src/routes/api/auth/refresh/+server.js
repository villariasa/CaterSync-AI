/**
 * POST /api/auth/refresh
 * 
 * Silent access token refresh using refresh token.
 * Called automatically by PWA on startup and by hooks.server.js.
 * Rotates the refresh token (old invalidated, new issued).
 */

import { json } from '@sveltejs/kit';
import { refreshSession } from '$lib/server/auth/session.js';
import { setAuthCookies } from '$lib/server/auth/tokens.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

export async function POST({ cookies, request }) {
  const refreshToken = cookies.get('cs_refresh_token');
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || null;

  if (!refreshToken) {
    return json({ success: false, error: 'No refresh token.' }, { status: 401 });
  }

  const result = await refreshSession(refreshToken, ipAddress);

  if (!result) {
    // Refresh token invalid or revoked — clear cookies
    cookies.delete('cs_access_token', { path: '/' });
    cookies.delete('cs_refresh_token', { path: '/' });
    return json({ success: false, error: 'Session expired. Please login again.' }, { status: 401 });
  }

  const { accessToken, refreshToken: newRefreshToken, session } = result;

  // Determine if device is trusted (for cookie lifetime)
  const isTrusted = !!session.device_id;
  setAuthCookies(cookies, accessToken, newRefreshToken, isTrusted);

  logAuthEvent({
    eventType: AUTH_EVENTS.TOKEN_REFRESH,
    userId: session.user_id,
    userRole: session.user_role,
    deviceId: session.device_id,
    ipAddress
  });

  return json({ success: true });
}
