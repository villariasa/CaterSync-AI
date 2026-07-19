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
    typeFlag: 'is_customer',
    userRole: 'subscriber',
    redirectTo: '/portal',
    profileCol: 'profile_complete'
  },
  org_user: {
    typeFlag: 'is_operator',
    userRole: 'org_user',
    redirectTo: '/',
    profileCol: 'full_name'
  },
  supplier: {
    typeFlag: 'is_supplier',
    userRole: 'supplier',
    redirectTo: '/supplier',
    profileCol: 'profile_complete'
  },
  platform_admin: {
    typeFlag: 'is_admin',
    userRole: 'platform_admin',
    redirectTo: '/admin',
    profileCol: null
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

    // Fetch account record from unified users table
    const query = `SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND ${cfg.typeFlag} = 1 LIMIT 1`;
    const params = [email, email];

    const res = await pool.query(query, params);

    if (res.rows.length === 0) {
      return json({ success: false, error: 'No account found for this email.' }, { status: 404 });
    }

    const account = res.rows[0];

    // Check attempt count
    const attempts = account.otp_attempts || 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'email_otp', ipAddress, failureReason: 'max_attempts_exceeded' });
      return json({ success: false, error: 'Too many incorrect attempts. Please request a new verification code.' }, { status: 400 });
    }

    // Verify OTP hash (timing-safe)
    const storedHash = account.otp_hash;
    if (!storedHash) {
      return json({ success: false, error: 'No pending verification code. Please request a new one.' }, { status: 400 });
    }

    const otpValid = verifyOtpHash(otpCode, storedHash);

    if (!otpValid) {
      // Increment attempt counter
      await pool.query(
        `UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?`,
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
    const expiresAt = account.otp_expires_at;
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      logAuthEvent({ eventType: AUTH_EVENTS.OTP_FAILED, identifier: email, method: 'email_otp', ipAddress, failureReason: 'otp_expired' });
      return json({ success: false, error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // ── SUCCESS ────────────────────────────────────────────────────────────

    // Clear OTP columns + stamp email_verified_at
    await pool.query(
      `UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0,
       email_verified_at = CURRENT_TIMESTAMP, last_login_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [account.id]
    );

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

    // Create session
    const { accessToken, refreshToken } = await createSession({
      userId: account.id,
      userRole: cfg.userRole,
      deviceId: resolvedDeviceId,
      ipAddress,
      userAgent
    });

    // Set cookies
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
      email: account.email,
      name: account.full_name || account.username || account.email,
      type: cfg.userRole
    };

    // Determine if this is a brand-new registration needing profile completion
    let needsProfile = false;
    if (cfg.profileCol === 'profile_complete') {
      needsProfile = !account.profile_complete || account.profile_complete === 0;
    } else if (cfg.profileCol === 'full_name') {
      needsProfile = !account.full_name || account.full_name.trim() === '';
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
