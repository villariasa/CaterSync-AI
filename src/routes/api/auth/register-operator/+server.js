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

    // Rate limiting
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

    // Check if operator already exists
    const userRes = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    let userId = null;
    let operatorName = name?.trim() || cleanEmail.split('@')[0];

    // Generate OTP (hashed before storage)
    const { code: otpCode, hash: otpHash } = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
      // If user exists, update their OTP info
      await pool.query(
        `UPDATE users 
         SET otp_hash = $1, otp_expires_at = $2, otp_attempts = 0, is_operator = 1,
             full_name = COALESCE($4, full_name)
         WHERE id = $3`,
        [otpHash, otpExpiresAt, userId, name?.trim() || null]
      );
    } else {
      // Validate required fields for new registrations
      if (!name?.trim()) {
        return json({ success: false, error: 'Full name is required.' }, { status: 400 });
      }
      if (!phone?.trim()) {
        return json({ success: false, error: 'Phone number is required.' }, { status: 400 });
      }

      // Auto-provision Operator profile with dummy password
      const dummyHash = 'google-oauth-operator-account-placeholder-hash';
      const insertRes = await pool.query(
        `INSERT INTO users (username, email, full_name, phone, password_hash, role, otp_hash, otp_expires_at, otp_attempts, is_active, is_operator)
         VALUES ($1, $1, $2, $3, $4, 'Operator', $5, $6, 0, 1, 1) RETURNING id`,
        [cleanEmail, name.trim(), phone.trim(), dummyHash, otpHash, otpExpiresAt]
      );
      userId = insertRes.rows[0].id;
    }

    // Fetch mailer config
    let businessSettings = null;
    try {
      const settingsRes = await pool.query('SELECT * FROM business_settings WHERE id = 1');
      if (settingsRes.rows.length > 0) businessSettings = settingsRes.rows[0];
    } catch { /* Non-fatal */ }

    // Send OTP email
    const mailResult = await sendEmail({
      to: cleanEmail,
      subject: `Your CaterSync Operator Verification Code: ${otpCode}`,
      text: `Hello ${operatorName},\n\nYour 6-digit operator verification code is:\n\n${otpCode}\n\nValid for 10 minutes. Do not share this code.`,
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 520px; margin: 0 auto; background: #1F1B18; color: #F6F2EA; padding: 32px; border-radius: 8px;">
          <div style="text-align:center; margin-bottom: 28px;">
            <div style="display:inline-block; background:#3E6650; color:#F6F2EA; font-weight:900; font-size:14px; letter-spacing:0.2em; padding:4px 14px; border-radius:3px;">CATERSYNC</div>
            <p style="color:#767068; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; margin-top:8px;">Operator Console Registration</p>
          </div>
          <p style="color:#F6F2EA; font-size:13px;">Hi <strong>${operatorName}</strong>,</p>
          <p style="color:#A09890; font-size:12px; line-height:1.6;">Your operator sign-up verification code is:</p>
          <div style="text-align:center; margin: 28px 0;">
            <div style="display:inline-block; background:#2A2521; border: 2px solid #3E6650; border-radius:8px; padding: 18px 36px;">
              <span style="font-size:36px; font-weight:900; letter-spacing:0.5em; color:#3E6650;">${otpCode}</span>
            </div>
          </div>
          <p style="color:#767068; font-size:11px; text-align:center;">This code expires in <strong style="color:#F6F2EA;">10 minutes</strong>.</p>
          <hr style="border-color:#3A3530; margin: 24px 0;">
          <p style="color:#767068; font-size:10px; text-align:center;">If you did not request this code, please ignore this email.</p>
        </div>
      `,
      businessSettings
    });

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
    console.error('[register-operator] Error:', error);
    return json({ success: false, error: 'Registration failed: ' + error.message }, { status: 500 });
  }
}
