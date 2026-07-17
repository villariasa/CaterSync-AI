/**
 * POST /api/auth/google-login
 * 
 * Customer Google OAuth authentication.
 * - Skips OTP for trusted devices (risk-based)
 * - Issues access + refresh token pair on success
 * - Falls back to OTP if device is new/untrusted
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { sendEmail } from '$lib/server/mailer.js';
import { generateOtp } from '$lib/server/auth/tokens.js';
import { createSession } from '$lib/server/auth/session.js';
import { setAuthCookies } from '$lib/server/auth/tokens.js';
import { getOrCreateDevice, isDeviceTrusted } from '$lib/server/auth/device.js';
import { computeRiskScore, getRequiredChallenge } from '$lib/server/auth/risk.js';
import { checkRateLimit, rateLimitExceededResponse } from '$lib/server/auth/rate-limit.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

// Decode Google JWT Identity Token without external libraries
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payloadB64.length % 4;
    if (pad === 2) payloadB64 += '==';
    else if (pad === 3) payloadB64 += '=';
    else if (pad === 1) return null;
    return JSON.parse(atob(payloadB64));
  } catch { return null; }
}

export async function POST({ request, cookies }) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  const deviceId = cookies.get('cs_device_id') || null;

  try {
    // ── Rate limiting ─────────────────────────────────────────────────
    const limit = await checkRateLimit('google', `ip:${ipAddress}`);
    if (!limit.allowed) {
      return json({ success: false, ...rateLimitExceededResponse(limit.retryAfterMs) }, { status: 429 });
    }

    const { credential } = await request.json();
    if (!credential) {
      return json({ success: false, error: 'Google credential token is missing.' }, { status: 400 });
    }

    const decoded = decodeJwt(credential);
    if (!decoded?.email) {
      return json({ success: false, error: 'Invalid Google credential token.' }, { status: 400 });
    }

    const { email, name } = decoded;
    const cleanEmail = email.toLowerCase();

    // ── Customer profile lookup / creation ────────────────────────────
    let customer = null;
    const customerRes = await pool.query(
      'SELECT id, name, contact, email FROM customers WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (customerRes.rows.length > 0) {
      customer = customerRes.rows[0];
    } else {
      const newCust = await pool.query(
        'INSERT INTO customers (name, contact, email) VALUES ($1, $2, $3) RETURNING id, name, contact, email',
        [name || cleanEmail.split('@')[0], cleanEmail, cleanEmail]
      );
      customer = newCust.rows[0];
    }

    // ── Subscriber account lookup ─────────────────────────────────────
    let subscriberAccountId = null;
    const subRes = await pool.query(
      'SELECT id, status FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    const isExistingVerified = subRes.rows.length > 0 && subRes.rows[0].status === 'active';
    subscriberAccountId = subRes.rows[0]?.id || null;

    // ── Device + risk check ───────────────────────────────────────────
    const { deviceId: resolvedDeviceId, isNew, isTrusted } = await getOrCreateDevice({
      deviceId,
      userId: subscriberAccountId || -1, // temp ID for new accounts
      userRole: 'subscriber',
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

    // Check WebAuthn registered for this subscriber
    let hasWebAuthn = false;
    if (subscriberAccountId) {
      const credCheck = await pool.query(
        "SELECT id FROM webauthn_credentials WHERE account_id = $1 AND account_type = 'subscriber' LIMIT 1",
        [subscriberAccountId]
      );
      hasWebAuthn = credCheck.rows.length > 0;
    }

    // Compute risk score
    const { score: riskScore } = await computeRiskScore({
      userId: subscriberAccountId,
      userRole: 'subscriber',
      deviceId: resolvedDeviceId,
      isDeviceTrusted: isTrusted,
      ipAddress,
      userAgent
    });

    const challenge = getRequiredChallenge(riskScore, isTrusted, hasWebAuthn);

    // ── Trusted device: skip OTP, create session directly ─────────────
    if (isExistingVerified && (challenge === 'none')) {
      // Upsert subscriber account
      if (subRes.rows.length > 0) {
        await pool.query(
          `UPDATE subscriber_accounts SET last_login_at = NOW() WHERE LOWER(email) = $1`,
          [cleanEmail]
        );
        subscriberAccountId = subRes.rows[0].id;
      }

      const { accessToken, refreshToken } = await createSession({
        userId: subscriberAccountId,
        userRole: 'subscriber',
        deviceId: resolvedDeviceId,
        ipAddress,
        userAgent,
        isTrusted
      });

      setAuthCookies(cookies, accessToken, refreshToken, isTrusted);

      logAuthEvent({
        eventType: AUTH_EVENTS.LOGIN_SUCCESS,
        userId: subscriberAccountId,
        userRole: 'subscriber',
        identifier: cleanEmail,
        method: 'google',
        deviceId: resolvedDeviceId,
        ipAddress,
        userAgent,
        riskScore
      });

      return json({
        success: true,
        needsOtp: false,
        customer,
        name
      });
    }

    // ── New / untrusted device: send OTP ──────────────────────────────
    const { code: otpCode, hash: otpHash } = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 600 * 1000).toISOString();

    // Upsert subscriber account
    if (subRes.rows.length > 0) {
      await pool.query(
        `UPDATE subscriber_accounts SET customer_id = $1, otp_hash = $2, otp_code = NULL, otp_expires_at = $3, otp_attempts = 0, status = 'pending' WHERE LOWER(email) = $4`,
        [customer.id, otpHash, otpExpiresAt, cleanEmail]
      );
      subscriberAccountId = subRes.rows[0].id;
    } else {
      const newSub = await pool.query(
        `INSERT INTO subscriber_accounts (customer_id, email, phone, otp_hash, otp_expires_at, otp_attempts, status)
         VALUES ($1, $2, $3, $4, $5, 0, 'pending') RETURNING id`,
        [customer.id, cleanEmail, cleanEmail, otpHash, otpExpiresAt]
      );
      subscriberAccountId = newSub.rows[0].id;
    }

    // Fetch SMTP settings and send email
    let businessSettings = null;
    try {
      const settingsRes = await pool.query('SELECT system_gmail_address, system_gmail_app_password, smtp_host, smtp_port FROM business_settings WHERE id = 1');
      if (settingsRes.rows.length > 0 && settingsRes.rows[0].system_gmail_address) {
        businessSettings = {
          gmail_address: settingsRes.rows[0].system_gmail_address,
          gmail_app_password: settingsRes.rows[0].system_gmail_app_password,
          smtp_host: 'smtp.gmail.com',
          smtp_port: 465
        };
      }
    } catch { /* Non-fatal */ }

    const mailResult = await sendEmail({
      to: cleanEmail,
      subject: `Your CaterSync Verification Code: ${otpCode}`,
      text: `Hello ${name},\n\nYour verification code: ${otpCode}\n\nValid for 10 minutes.`,
      html: `<div style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Hello ${name},</h2><p>Your 6-digit code:</p><div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#3E6650;padding:20px;border:2px dashed #3E6650;display:inline-block;border-radius:8px;">${otpCode}</div><p style="color:#767068;font-size:12px;">Valid for 10 minutes.</p></div>`,
      businessSettings
    });

    logAuthEvent({
      eventType: AUTH_EVENTS.OTP_SENT,
      userId: subscriberAccountId,
      userRole: 'subscriber',
      identifier: cleanEmail,
      method: 'google',
      deviceId: resolvedDeviceId,
      ipAddress,
      riskScore
    });

    return json({
      success: true,
      needsOtp: true,
      email: cleanEmail,
      name,
      usingFallback: mailResult.usingFallback,
      previewUrl: mailResult.previewUrl,
      otpCode: mailResult.usingFallback ? otpCode : null,
      riskScore
    });

  } catch (error) {
    console.error('[google-login] Error:', error);

    if (error.message?.includes('database connection') || error.message?.includes('ECONNREFUSED') || error.message?.includes('connection')) {
      return json({
        success: true,
        offlineFallback: true,
        needsOtp: true,
        email: 'offline@catersync.local'
      });
    }

    return json({ success: false, error: error.message }, { status: 500 });
  }
}
