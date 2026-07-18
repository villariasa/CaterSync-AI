/**
 * POST /api/auth/register-subscriber
 * 
 * Customer registration and OTP dispatch.
 * - Hashes OTP before storage (never store raw OTP)
 * - Rate limited: 5 requests per 10 minutes per email/IP
 * - OTP valid for 10 minutes (up from 2 minutes)
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { sendEmail } from '$lib/server/mailer.js';
import { generateOtp } from '$lib/server/auth/tokens.js';
import { checkRateLimit, rateLimitExceededResponse } from '$lib/server/auth/rate-limit.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

const OTP_TTL_SECONDS = 600; // 10 minutes

export async function POST({ request }) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';

  let email = '';
  try {
    const body = await request.json();
    email = body.email || '';
    const { name, phone } = body;

    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Valid email address is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── Rate limiting ──────────────────────────────────────────────────
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit('otp_send', cleanEmail),
      checkRateLimit('otp_send', `ip:${ipAddress}`)
    ]);

    if (!emailLimit.allowed) {
      return json({ success: false, ...rateLimitExceededResponse(emailLimit.retryAfterMs) }, { status: 429 });
    }
    if (!ipLimit.allowed) {
      return json({ success: false, ...rateLimitExceededResponse(ipLimit.retryAfterMs) }, { status: 429 });
    }

    // ── Customer profile lookup / creation ────────────────────────────
    let customerId = null;
    let customerName = 'Valued Client';

    const customerRes = await pool.query(
      'SELECT id, name FROM customers WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (customerRes.rows.length > 0) {
      customerId = customerRes.rows[0].id;
      customerName = customerRes.rows[0].name;
    } else {
      const finalName = name?.trim() || null; // NULL until Step 3 profile form
      const finalPhone = phone?.trim() || null;
      const insertRes = await pool.query(
        `INSERT INTO customers (name, contact, email, status) VALUES ($1, $2, $3, 'pending') RETURNING id, name`,
        [finalName, finalPhone, cleanEmail]
      );
      customerId = insertRes.rows[0].id;
      customerName = insertRes.rows[0].name || 'Valued Client';
    }

    // ── Generate OTP (hashed before storage) ──────────────────────────
    const { code: otpCode, hash: otpHash } = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    // ── Upsert subscriber account ─────────────────────────────────────
    const subRes = await pool.query(
      'SELECT id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (subRes.rows.length > 0) {
      await pool.query(
        `UPDATE subscriber_accounts 
         SET customer_id = $1, phone = COALESCE($2, phone), 
             otp_hash = $3, otp_code = NULL,
             otp_expires_at = $4, otp_attempts = 0, status = 'pending'
         WHERE LOWER(email) = $5`,
        [customerId, phone?.trim() || null, otpHash, otpExpiresAt, cleanEmail]
      );
    } else {
      await pool.query(
        `INSERT INTO subscriber_accounts 
          (customer_id, email, phone, otp_hash, otp_expires_at, otp_attempts, status)
         VALUES ($1, $2, $3, $4, $5, 0, 'pending')`,
        [customerId, cleanEmail, phone?.trim() || null, otpHash, otpExpiresAt]
      );
    }

    // ── Fetch mailer config ───────────────────────────────────────────
    let businessSettings = null;
    try {
      const settingsRes = await pool.query('SELECT * FROM business_settings WHERE id = 1');
      if (settingsRes.rows.length > 0) businessSettings = settingsRes.rows[0];
    } catch { /* Non-fatal */ }

    // ── Send OTP email ────────────────────────────────────────────────
    const mailResult = await sendEmail({
      to: cleanEmail,
      subject: `Your CaterSync Verification Code: ${otpCode}`,
      text: `Hello ${customerName},\n\nYour 6-digit verification code is:\n\n${otpCode}\n\nValid for 10 minutes. Do not share this code.\n\nThank you,\nThe Catering Team`,
      html: buildOtpEmailHtml(customerName, otpCode),
      businessSettings
    });

    // ── Audit log ─────────────────────────────────────────────────────
    logAuthEvent({
      eventType: AUTH_EVENTS.OTP_SENT,
      identifier: cleanEmail,
      method: 'otp',
      ipAddress,
      userAgent: request.headers.get('user-agent')
    });

    return json({
      success: true,
      usingFallback: mailResult.usingFallback,
      previewUrl: mailResult.previewUrl,
      otpCode: mailResult.usingFallback ? otpCode : null,
      expiresInSeconds: OTP_TTL_SECONDS
    });
  } catch (error) {
    console.error('[register-subscriber] Error:', error);
    logAuthEvent({
      eventType: AUTH_EVENTS.OTP_SENT,
      identifier: email,
      method: 'otp',
      ipAddress,
      failureReason: error.message
    });
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

function buildOtpEmailHtml(customerName, otpCode) {
  return `
    <div style="font-family:'Inter',-apple-system,sans-serif;background:#F6F2EA;padding:40px 20px;text-align:center;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid rgba(118,112,104,0.2);border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(42,37,33,0.05);text-align:left;">
        <div style="background:#3E6650;padding:28px;text-align:center;border-bottom:4px solid #D9A441;">
          <h1 style="color:#F6F2EA;font-size:22px;font-weight:900;margin:0;text-transform:uppercase;letter-spacing:-0.5px;">CaterSync</h1>
          <p style="color:#D9A441;font-size:10px;font-weight:bold;font-family:monospace;margin:5px 0 0;text-transform:uppercase;">Email Verification</p>
        </div>
        <div style="padding:36px 30px;color:#2A2521;">
          <h2 style="font-size:17px;font-weight:bold;margin:0 0 14px;color:#3E6650;">Hello ${customerName},</h2>
          <p style="font-size:13px;line-height:1.6;margin:0 0 24px;color:#5A544F;">
            Use the following 6-digit code to verify your identity. This code expires in <strong>10 minutes</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <div style="display:inline-block;background:#F6F2EA;border:2px dashed #3E6650;border-radius:8px;padding:14px 40px;font-size:30px;font-weight:900;letter-spacing:6px;color:#2A2521;font-family:monospace;">
              ${otpCode}
            </div>
            <p style="font-size:10px;color:#767068;margin-top:10px;">Do not share this code with anyone.</p>
          </div>
          <p style="font-size:11px;color:#767068;margin:20px 0 0;">
            Best regards,<br/><strong>The CaterSync Team</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}
