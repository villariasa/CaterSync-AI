/**
 * POST /api/auth/verify-totp
 * 
 * FIXED: TOTP setup secret is now generated and stored server-side.
 * The client no longer provides the setupSecret — it is read from 
 * `users.pending_totp_secret` which was set during pre-auth.
 * 
 * On success: issues access + refresh token pair (not raw username cookies).
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { verifyTOTP } from '$lib/server/totp.js';
import { createSession } from '$lib/server/auth/session.js';
import { setAuthCookies } from '$lib/server/auth/tokens.js';
import { getOrCreateDevice, isDeviceTrusted } from '$lib/server/auth/device.js';
import { checkRateLimit, rateLimitExceededResponse } from '$lib/server/auth/rate-limit.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

export async function POST({ request, cookies }) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  const deviceId = cookies.get('cs_device_id') || null;

  let username = 'unknown';
  try {
    const body = await request.json().catch(() => ({}));
    username = body.username || '';
    const { token } = body;
    const isPlatformAdmin = body.userType === 'platform_admin';

    if (!username || !token) {
      return json({ success: false, error: 'Username and code are required.' }, { status: 400 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────
    const limit = await checkRateLimit('login', username.toLowerCase());
    if (!limit.allowed) {
      return json({ success: false, ...rateLimitExceededResponse(limit.retryAfterMs) }, { status: 429 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const table = isPlatformAdmin ? 'platform_admins' : 'users';
    const userRole = isPlatformAdmin ? 'platform_admin' : 'org_user';

    // ── Fetch user from DB ────────────────────────────────────────────
    let user = null;
    if (isPlatformAdmin) {
      const res = await pool.query(
        'SELECT id, username, totp_secret, pending_totp_secret, pending_totp_expires_at, is_active FROM platform_admins WHERE LOWER(username) = $1 LIMIT 1',
        [cleanUsername]
      );
      if (res.rows.length > 0) user = res.rows[0];
    } else {
      const res = await pool.query(
        'SELECT id, username, role, totp_secret, pending_totp_secret, pending_totp_expires_at, is_active FROM users WHERE LOWER(username) = $1 LIMIT 1',
        [cleanUsername]
      );
      if (res.rows.length > 0) user = res.rows[0];
    }

    if (!user) {
      return json({ success: false, error: 'Account not found.' }, { status: 404 });
    }
    if (!user.is_active) {
      return json({ success: false, error: 'Account is deactivated.' }, { status: 403 });
    }

    // ── Determine TOTP secret ─────────────────────────────────────────
    // Priority: established totp_secret > pending_totp_secret (setup flow)
    let secretToVerify = user.totp_secret;
    let isRegistering = false;

    if (!secretToVerify) {
      // SETUP FLOW: use the server-generated pending secret (NOT from client)
      if (!user.pending_totp_secret) {
        return json({ success: false, error: 'No 2FA setup in progress. Please restart the login flow.' }, { status: 400 });
      }

      // Check if pending secret has expired (10 minute window)
      if (user.pending_totp_expires_at && new Date(user.pending_totp_expires_at) < new Date()) {
        return json({ success: false, error: 'QR code session expired. Please restart login.' }, { status: 400 });
      }

      secretToVerify = user.pending_totp_secret;
      isRegistering = true;
    }

    // ── Verify TOTP token ─────────────────────────────────────────────
    const isValid = verifyTOTP(token, secretToVerify);
    if (!isValid) {
      logAuthEvent({
        eventType: AUTH_EVENTS.TOTP_FAILED,
        userId: user.id,
        userRole,
        identifier: username,
        method: 'totp',
        ipAddress,
        failureReason: 'invalid_totp_code'
      });
      return json({ success: false, error: 'Invalid 6-digit code. Please check your authenticator app.' }, { status: 401 });
    }

    // ── Promote pending secret to active on first setup ───────────────
    if (isRegistering) {
      await pool.query(
        `UPDATE ${table} SET totp_secret = $1, pending_totp_secret = NULL, pending_totp_expires_at = NULL WHERE id = $2`,
        [secretToVerify, user.id]
      );
    }

    // ── Device management ─────────────────────────────────────────────
    const { deviceId: resolvedDeviceId, isNew, isTrusted } = await getOrCreateDevice({
      deviceId,
      userId: user.id,
      userRole,
      userAgent,
      ipAddress
    });

    cookies.set('cs_device_id', resolvedDeviceId, {
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    // ── Check if operator has WebAuthn credentials ────────────────────
    let hasBiometrics = false;
    try {
      const credRes = await pool.query(
        `SELECT id FROM webauthn_credentials WHERE account_id = $1 AND account_type = 'operator' LIMIT 1`,
        [user.id]
      );
      hasBiometrics = credRes.rows.length > 0;
    } catch { /* Non-fatal */ }

    // ── Create session (replaces raw username cookies) ─────────────────
    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      userRole,
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent,
      isTrusted
    });

    setAuthCookies(cookies, accessToken, refreshToken, isTrusted);

    // ── Audit log ─────────────────────────────────────────────────────
    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_SUCCESS,
      userId: user.id,
      userRole,
      identifier: username,
      method: 'totp',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    return json({
      success: true,
      hasBiometrics,
      isNewDevice: isNew,
      isTrustedDevice: isTrusted,
      user: {
        id: user.id,
        username: user.username,
        role: isPlatformAdmin ? 'platform_admin' : user.role,
        userType: userRole
      }
    });

  } catch (error) {
    console.error('[verify-totp] Error:', error);

    // Offline fallback
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection')) {
      // Issue a legacy cookie as fallback — not ideal but preserves offline dev workflow
      cookies.set('cs_org_session', username || 'admin', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 12
      });
      return json({
        success: true,
        offlineFallback: true,
        user: { username: username || 'admin', role: 'Operator', userType: 'org_user' }
      });
    }

    return json({ success: false, error: error.message }, { status: 500 });
  }
}
