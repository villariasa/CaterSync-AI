/**
 * POST /api/auth/verify-otp
 * 
 * Customer OTP verification + session creation.
 * - Compares hashed OTP (never raw)
 * - Enforces max 5 attempts (account lockout per OTP cycle)
 * - Checks expiry
 * - Issues access + refresh token pair on success
 * - Rate limited
 * - Trusted device check (skip on future logins)
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { verifyOtpHash, setAuthCookies } from '$lib/server/auth/tokens.js';
import { createSession } from '$lib/server/auth/session.js';
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
    const body = await request.json();
    email = body.email?.trim().toLowerCase() || '';
    const otpCode = body.otpCode?.trim() || '';

    if (!email || !otpCode) {
      return json({ success: false, error: 'Email and OTP code are required.' }, { status: 400 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────
    const limit = await checkRateLimit('otp_verify', email);
    if (!limit.allowed) {
      return json({ success: false, ...rateLimitExceededResponse(limit.retryAfterMs) }, { status: 429 });
    }

    // ── Fetch subscriber account ──────────────────────────────────────
    const subRes = await pool.query(
      'SELECT * FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (subRes.rows.length === 0) {
      return json({ success: false, error: 'No pending verification for this email.' }, { status: 404 });
    }

    const account = subRes.rows[0];

    // ── Check attempt count ───────────────────────────────────────────
    const attempts = account.otp_attempts || 0;
    if (attempts >= 5) {
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'otp', ipAddress, failureReason: 'max_attempts_exceeded' });
      return json({ success: false, error: 'Too many incorrect attempts. Please request a new verification code.' }, { status: 400 });
    }

    // ── Verify OTP (hash comparison) ──────────────────────────────────
    // Support both new otp_hash and legacy otp_code during migration
    let otpValid = false;
    if (account.otp_hash) {
      otpValid = verifyOtpHash(otpCode, account.otp_hash);
    } else if (account.otp_code) {
      // Legacy plain-text comparison (migration period only)
      otpValid = account.otp_code === otpCode;
    }

    if (!otpValid) {
      // Increment attempt counter
      await pool.query(
        'UPDATE subscriber_accounts SET otp_attempts = otp_attempts + 1 WHERE id = $1',
        [account.id]
      );
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'otp', ipAddress, failureReason: 'invalid_code' });
      const remaining = 4 - attempts;
      return json({ success: false, error: `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }, { status: 400 });
    }

    // ── Check expiry ──────────────────────────────────────────────────
    if (new Date(account.otp_expires_at) < new Date()) {
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'otp', ipAddress, failureReason: 'otp_expired' });
      return json({ success: false, error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // ── Activate account ──────────────────────────────────────────────
    const updateRes = await pool.query(
      `UPDATE subscriber_accounts
       SET email_verified_at = CURRENT_TIMESTAMP,
           status = 'active',
           otp_code = NULL,
           otp_hash = NULL,
           otp_expires_at = NULL,
           otp_attempts = 0,
           last_login_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, customer_id, email, status`,
      [account.id]
    );

    // ── Fetch customer profile ────────────────────────────────────────
    let customerProfile = null;
    try {
      const custRes = await pool.query(
        'SELECT id, name, email, contact FROM customers WHERE id = $1',
        [updateRes.rows[0].customer_id]
      );
      if (custRes.rows.length > 0) customerProfile = custRes.rows[0];
    } catch { /* Non-fatal */ }

    // ── Device management ─────────────────────────────────────────────
    const { deviceId: resolvedDeviceId, isNew, isTrusted } = await getOrCreateDevice({
      deviceId,
      userId: account.id,
      userRole: 'subscriber',
      userAgent,
      ipAddress
    });

    // Set device ID cookie (JS-readable, for fingerprinting continuity)
    cookies.set('cs_device_id', resolvedDeviceId, {
      path: '/',
      httpOnly: false, // Must be readable by JS for fingerprint
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    // ── Create session ────────────────────────────────────────────────
    const { accessToken, refreshToken } = await createSession({
      userId: account.id,
      userRole: 'subscriber',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent,
      isTrusted
    });

    // Set auth cookies
    setAuthCookies(cookies, accessToken, refreshToken, isTrusted);

    // ── Reset rate limit on success ───────────────────────────────────
    await resetRateLimit('otp_verify', email);

    // ── Audit log ─────────────────────────────────────────────────────
    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_SUCCESS,
      userId: account.id,
      userRole: 'subscriber',
      identifier: email,
      method: 'otp',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    return json({
      success: true,
      message: 'Account verified and session created.',
      account: updateRes.rows[0],
      customer: customerProfile,
      isNewDevice: isNew,
      isTrustedDevice: isTrusted
    });
  } catch (error) {
    console.error('[verify-otp] Error:', error);
    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_FAILED,
      identifier: email,
      method: 'otp',
      ipAddress,
      failureReason: error.message
    });
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
