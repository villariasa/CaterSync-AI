/**
 * POST /api/auth/supplier-login
 * 
 * Supplier email + password authentication.
 * - bcrypt password verification (migrates from SHA-256 on next login)
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

  let email = '';
  try {
    const { username: rawEmail, password } = await request.json();
    email = rawEmail?.trim().toLowerCase() || '';

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────
    const limit = await checkRateLimit('login', `ip:${ipAddress}`);
    if (!limit.allowed) {
      return json({ error: rateLimitExceededResponse(limit.retryAfterMs).error }, { status: 429 });
    }

    // ── Fetch supplier account ────────────────────────────────────────
    const res = await pool.query(
      'SELECT * FROM supplier_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );
    if (res.rows.length === 0) {
      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_FAILED, identifier: email, method: 'password', ipAddress, failureReason: 'not_found' });
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const supplier = res.rows[0];

    if (!supplier.is_active) {
      return json({ error: 'Supplier account is inactive' }, { status: 403 });
    }

    // ── Verify password (bcrypt or legacy SHA-256) ────────────────────
    const algo = supplier.password_algo || 'sha256';
    let passwordValid = false;

    if (algo === 'bcrypt') {
      passwordValid = await bcrypt.compare(password, supplier.password_hash);
    } else {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      passwordValid = supplier.password_hash === hash;
      if (passwordValid) {
        // Migrate to bcrypt silently
        const bcryptHash = await bcrypt.hash(password, 12);
        pool.query(
          'UPDATE supplier_accounts SET password_hash = $1, password_algo = $2 WHERE id = $3',
          [bcryptHash, 'bcrypt', supplier.id]
        ).catch(() => {});
      }
    }

    if (!passwordValid) {
      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_FAILED, identifier: email, method: 'password', ipAddress, failureReason: 'invalid_password' });
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // ── Device management ─────────────────────────────────────────────
    const { deviceId: resolvedDeviceId, isTrusted } = await getOrCreateDevice({
      deviceId,
      userId: supplier.id,
      userRole: 'supplier',
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
      userId: supplier.id,
      userRole: 'supplier',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent,
      isTrusted
    });

    setAuthCookies(cookies, accessToken, refreshToken, isTrusted);
    await resetRateLimit('login', `ip:${ipAddress}`);

    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_SUCCESS,
      userId: supplier.id,
      userRole: 'supplier',
      identifier: email,
      method: 'password',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    // Update last_login_at
    pool.query('UPDATE supplier_accounts SET last_login_at = NOW() WHERE id = $1', [supplier.id]).catch(() => {});

    return json({
      success: true,
      user: {
        id: supplier.id,
        username: supplier.email,
        supplier_id: supplier.supplier_id,
        role: 'supplier',
        email_verified: !!supplier.email_verified_at
      }
    });
  } catch (err) {
    if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connection')) {
      cookies.set('cs_supplier_session', email, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 14
      });
      return json({ offlineFallback: true, error: 'Database offline.' }, { status: 503 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
