/**
 * POST /api/auth/login
 * 
 * Operator/Admin username+password login.
 * - Only allowed for 'admin' username (other operators use Google+TOTP)
 * - Issues access + refresh token pair (not raw username cookie)
 * - Rate limited, audit logged
 * - bcrypt-aware with SHA-256 legacy fallback during migration
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createSession } from '$lib/server/auth/session.js';
import { setAuthCookies } from '$lib/server/auth/tokens.js';
import { getOrCreateDevice } from '$lib/server/auth/device.js';
import { checkRateLimit, resetRateLimit, rateLimitExceededResponse } from '$lib/server/auth/rate-limit.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

export async function POST({ request, cookies }) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  const deviceId = cookies.get('cs_device_id') || null;

  let username = '';
  try {
    const { username: rawUsername, password } = await request.json();
    username = rawUsername?.trim() || '';

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, { status: 400 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────
    const limit = await checkRateLimit('login', `ip:${ipAddress}`);
    if (!limit.allowed) {
      return json({ error: rateLimitExceededResponse(limit.retryAfterMs).error }, { status: 429 });
    }

    // ── Only 'admin' may use password login ───────────────────────────
    if (username.toLowerCase() !== 'admin') {
      return json({ error: 'Password login is disabled for operator accounts. Please use Google authentication.' }, { status: 401 });
    }

    // ── Fetch user ────────────────────────────────────────────────────
    const res = await pool.query('SELECT * FROM users WHERE LOWER(username) = $1', [username.toLowerCase()]);
    if (res.rows.length === 0) {
      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_FAILED, identifier: username, method: 'password', ipAddress, failureReason: 'user_not_found' });
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const user = res.rows[0];

    if (!user.is_active) {
      return json({ error: 'User account is inactive' }, { status: 403 });
    }

    // ── Verify password (bcrypt or legacy SHA-256) ────────────────────
    const algo = user.password_algo || 'sha256';
    let passwordValid = false;

    if (algo === 'bcrypt') {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy SHA-256 check
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      passwordValid = user.password_hash === hash;

      // Migrate to bcrypt on successful login
      if (passwordValid) {
        const bcryptHash = await bcrypt.hash(password, 12);
        pool.query(
          'UPDATE users SET password_hash = $1, password_algo = $2 WHERE id = $3',
          [bcryptHash, 'bcrypt', user.id]
        ).catch(e => console.warn('[login] bcrypt migration failed:', e.message));
      }
    }

    if (!passwordValid) {
      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_FAILED, identifier: username, method: 'password', ipAddress, failureReason: 'invalid_password' });
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // ── Device management ─────────────────────────────────────────────
    const { deviceId: resolvedDeviceId, isTrusted } = await getOrCreateDevice({
      deviceId,
      userId: user.id,
      userRole: 'org_user',
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

    // ── Create session ────────────────────────────────────────────────
    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      userRole: 'org_user',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent,
      isTrusted
    });

    setAuthCookies(cookies, accessToken, refreshToken, isTrusted);
    await resetRateLimit('login', `ip:${ipAddress}`);

    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_SUCCESS,
      userId: user.id,
      userRole: 'org_user',
      identifier: username,
      method: 'password',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        organization_id: user.organization_id || 1
      }
    });
  } catch (err) {
    // Offline fallback
    if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connection')) {
      cookies.set('cs_org_session', username, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24
      });
      return json({ offlineFallback: true, error: 'Database offline. Falling back to local simulation.' }, { status: 503 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
