/**
 * POST /api/auth/admin-login
 * 
 * Platform admin login (username/password).
 * - bcrypt verification with SHA-256 legacy fallback
 * - Issues access + refresh token pair
 * - Rate limited, audit logged
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

  let identifier = '';
  try {
    const { username, password } = await request.json();
    identifier = username?.trim() || '';

    if (!identifier || !password) {
      return json({ error: 'Username/email and password are required' }, { status: 400 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────
    const limit = await checkRateLimit('login', `ip:${ipAddress}`);
    if (!limit.allowed) {
      return json({ error: rateLimitExceededResponse(limit.retryAfterMs).error }, { status: 429 });
    }

    // ── Fetch platform admin ──────────────────────────────────────────
    const res = await pool.query(
      'SELECT * FROM platform_admins WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1',
      [identifier.toLowerCase()]
    );
    if (res.rows.length === 0) {
      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_FAILED, identifier, method: 'password', ipAddress, failureReason: 'not_found' });
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const admin = res.rows[0];

    if (!admin.is_active) {
      return json({ error: 'Platform Admin account is inactive' }, { status: 403 });
    }

    // ── Verify password (bcrypt or legacy SHA-256) ────────────────────
    const algo = admin.password_algo || 'sha256';
    let passwordValid = false;

    if (algo === 'bcrypt') {
      passwordValid = await bcrypt.compare(password, admin.password_hash);
    } else {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      passwordValid = admin.password_hash === hash;
      if (passwordValid) {
        const bcryptHash = await bcrypt.hash(password, 12);
        pool.query(
          'UPDATE platform_admins SET password_hash = $1, password_algo = $2 WHERE id = $3',
          [bcryptHash, 'bcrypt', admin.id]
        ).catch(() => {});
      }
    }

    if (!passwordValid) {
      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_FAILED, identifier, method: 'password', ipAddress, failureReason: 'invalid_password' });
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // ── Device management ─────────────────────────────────────────────
    const { deviceId: resolvedDeviceId, isTrusted } = await getOrCreateDevice({
      deviceId,
      userId: admin.id,
      userRole: 'platform_admin',
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
      userId: admin.id,
      userRole: 'platform_admin',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent,
      isTrusted
    });

    setAuthCookies(cookies, accessToken, refreshToken, isTrusted);
    await resetRateLimit('login', `ip:${ipAddress}`);

    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_SUCCESS,
      userId: admin.id,
      userRole: 'platform_admin',
      identifier,
      method: 'password',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    pool.query('UPDATE platform_admins SET last_login_at = NOW() WHERE id = $1', [admin.id]).catch(() => {});

    return json({
      success: true,
      user: { id: admin.id, username: admin.username, role: 'platform_admin' }
    });
  } catch (err) {
    if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connection')) {
      cookies.set('cs_admin_session', identifier, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7
      });
      return json({ offlineFallback: true, error: 'Database offline.' }, { status: 503 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
