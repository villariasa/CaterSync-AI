/**
 * POST /api/auth/verify-email-otp
 *
 * Unified Email OTP verification + session creation for ALL account types:
 *   - subscriber      → redirects to /portal
 *   - org_user        → redirects to /
 *   - supplier        → redirects to /supplier
 *   - platform_admin  → redirects to /admin
 *
 * On success:
 *   - Validates OTP hash from DB (timing-safe)
 *   - Checks expiry and attempt count
 *   - Clears OTP columns
 *   - Creates session (access + refresh token pair)
 *   - Sets HttpOnly cookies (role-specific TTL)
 *   - Returns user profile + redirect hint
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { verifyOtpHash, setAuthCookies } from '$lib/server/auth/tokens.js';
import { createSession } from '$lib/server/auth/session.js';
import { getOrCreateDevice } from '$lib/server/auth/device.js';
import { checkRateLimit, resetRateLimit, rateLimitExceededResponse } from '$lib/server/auth/rate-limit.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

// Max wrong attempts before lockout (user must request new OTP)
const MAX_OTP_ATTEMPTS = 5;

/** Per account-type configuration */
const ACCOUNT_CONFIG = {
  subscriber: {
    table: 'subscriber_accounts',
    emailCol: 'email',
    otpHashCol: 'otp_hash',
    otpExpiryCol: 'otp_expires_at',
    otpAttemptCol: 'otp_attempts',
    userRole: 'subscriber',
    redirectTo: '/portal',
    activateOnVerify: true,  // sets status='active' and email_verified_at
    profileCol: 'profile_complete'  // column to check if profile form was filled
  },
  org_user: {
    table: 'users',
    emailCol: 'email',
    otpHashCol: 'email_otp_hash',
    otpExpiryCol: 'email_otp_expires_at',
    otpAttemptCol: 'email_otp_attempts',
    userRole: 'org_user',
    redirectTo: '/',
    activateOnVerify: true,  // stamp email_verified_at so complete-profile can validate
    profileCol: 'name'       // operators use 'name' column — null means profile not filled
  },
  supplier: {
    table: 'supplier_accounts',
    emailCol: 'email',
    otpHashCol: 'otp_hash',
    otpExpiryCol: 'otp_expires_at',
    otpAttemptCol: 'otp_attempts',
    userRole: 'supplier',
    redirectTo: '/supplier',
    activateOnVerify: true,  // stamp email_verified_at so complete-profile can validate
    profileCol: 'profile_complete'  // column to check if profile form was filled
  },
  platform_admin: {
    table: 'platform_admins',
    emailCol: 'email',
    otpHashCol: 'email_otp_hash',
    otpExpiryCol: 'email_otp_expires_at',
    otpAttemptCol: 'email_otp_attempts',
    userRole: 'platform_admin',
    redirectTo: '/admin',
    activateOnVerify: false
  }
};

export async function POST({ request, cookies }) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  const deviceId = cookies.get('cs_device_id') || null;

  let email = '';
  try {
    const body = await request.json().catch(() => ({}));
    email = body.email?.trim().toLowerCase() || '';
    const otpCode = body.otp?.trim() || body.otpCode?.trim() || '';
    const accountType = body.accountType || '';

    if (!email || !otpCode || !accountType) {
      return json({ success: false, error: 'Email, OTP code, and account type are required.' }, { status: 400 });
    }

    const cfg = ACCOUNT_CONFIG[accountType];
    if (!cfg) {
      return json({ success: false, error: 'Invalid account type.' }, { status: 400 });
    }

    // Rate limiting
    const limit = await checkRateLimit('otp_verify', `email:${email}`);
    if (!limit.allowed) {
      return json({ success: false, ...rateLimitExceededResponse(limit.retryAfterMs) }, { status: 429 });
    }

    // Fetch account record
    let query = `SELECT * FROM ${cfg.table} WHERE LOWER(${cfg.emailCol}) = ? LIMIT 1`;
    let params = [email];
    if (accountType === 'org_user') {
      query = `SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1`;
      params = [email, email];
    } else if (accountType === 'platform_admin') {
      query = `SELECT * FROM platform_admins WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1`;
      params = [email, email];
    }

    const res = await pool.query(query, params);

    if (res.rows.length === 0) {
      return json({ success: false, error: 'No account found for this email.' }, { status: 404 });
    }

    const account = res.rows[0];

    // Check attempt count
    const attempts = account[cfg.otpAttemptCol] || 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'email_otp', ipAddress, failureReason: 'max_attempts_exceeded' });
      return json({ success: false, error: 'Too many incorrect attempts. Please request a new verification code.' }, { status: 400 });
    }

    // Verify OTP hash (timing-safe)
    const storedHash = account[cfg.otpHashCol];
    if (!storedHash) {
      return json({ success: false, error: 'No pending verification code. Please request a new one.' }, { status: 400 });
    }

    const otpValid = verifyOtpHash(otpCode, storedHash);

    if (!otpValid) {
      // Increment attempt counter
      await pool.query(
        `UPDATE ${cfg.table} SET ${cfg.otpAttemptCol} = ${cfg.otpAttemptCol} + 1 WHERE id = ?`,
        [account.id]
      );
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'email_otp', ipAddress, failureReason: 'invalid_code' });
      const remaining = (MAX_OTP_ATTEMPTS - 1) - attempts;
      return json({
        success: false,
        error: `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      }, { status: 400 });
    }

    // Check expiry
    const expiresAt = account[cfg.otpExpiryCol];
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'email_otp', ipAddress, failureReason: 'otp_expired' });
      return json({ success: false, error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // ── SUCCESS ────────────────────────────────────────────────────────────

    // Clear OTP columns + stamp email_verified_at for all types
    await pool.query(
      `UPDATE ${cfg.table} SET ${cfg.otpHashCol} = NULL, ${cfg.otpExpiryCol} = NULL, ${cfg.otpAttemptCol} = 0,
       email_verified_at = CURRENT_TIMESTAMP, last_login_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [account.id]
    );

    // For subscriber, also activate status
    if (cfg.activateOnVerify && cfg.userRole === 'subscriber') {
      await pool.query(
        `UPDATE ${cfg.table} SET status = 'active' WHERE id = ?`,
        [account.id]
      );
    }

    // Device fingerprint
    const { deviceId: resolvedDeviceId } = await getOrCreateDevice({
      deviceId,
      userId: account.id,
      userRole: cfg.userRole,
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

    // Create session — uses per-role TTL from session.js
    const { accessToken, refreshToken } = await createSession({
      userId: account.id,
      userRole: cfg.userRole,
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    // Set cookies — pass role so cookie maxAge matches session TTL
    setAuthCookies(cookies, accessToken, refreshToken, cfg.userRole);

    await resetRateLimit('otp_verify', `email:${email}`);

    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_SUCCESS,
      userId: account.id,
      userRole: cfg.userRole,
      identifier: email,
      method: 'email_otp',
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    // Build user profile for frontend
    const userProfile = {
      id: account.id,
      email: account[cfg.emailCol],
      name: account.name || account.username || account[cfg.emailCol],
      type: cfg.userRole
    };

    // Determine if this is a brand-new registration needing profile completion
    // For subscriber/supplier: check profile_complete column
    // For org_user (operator): check if name column is null/empty (indicates fresh registration)
    let needsProfile = false;
    if (cfg.profileCol === 'profile_complete') {
      needsProfile = !account.profile_complete || account.profile_complete === 0;
    } else if (cfg.profileCol === 'name') {
      // org_user: name is null until profile form is submitted
      needsProfile = !account.name || account.name.trim() === account.email?.trim() ||
                     account.name.trim() === account.username?.trim();
    }

    // For customers, also fetch the linked customer record
    let customerProfile = null;
    if (accountType === 'subscriber' && account.customer_id) {
      try {
        const custRes = await pool.query(
          'SELECT id, name, email, contact, address, birthday, allergies, dietary_prefs, status FROM customers WHERE id = ? LIMIT 1',
          [account.customer_id]
        );
        if (custRes.rows.length > 0) {
          customerProfile = custRes.rows[0];
          // Override needsProfile based on customer status
          needsProfile = customerProfile.status === 'pending' || !account.profile_complete;
        }
      } catch { /* Non-fatal */ }
    }

    return json({
      success: true,
      redirect: needsProfile ? null : cfg.redirectTo,
      needsProfile,
      accountType,
      email,
      user: userProfile,
      customer: customerProfile
    });

  } catch (err) {
    console.error('[verify-email-otp] Error:', err.message);
    logAuthEvent({
      eventType: AUTH_EVENTS.LOGIN_FAILED,
      identifier: email,
      method: 'email_otp',
      ipAddress,
      failureReason: err.message
    });
    return json({ success: false, error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
