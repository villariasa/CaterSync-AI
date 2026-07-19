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
    const { companyName, contactName, contactPhone } = body;

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

    // Check if supplier account already exists on unified users table
    const subRes = await pool.query(
      'SELECT id, supplier_id FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    let supplierId = null;
    let accountId = null;

    // Generate OTP (hashed before storage)
    const { code: otpCode, hash: otpHash } = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    if (subRes.rows.length > 0) {
      supplierId = subRes.rows[0].supplier_id;
      accountId = subRes.rows[0].id;
      // Update existing account's OTP columns
      await pool.query(
        `UPDATE users 
         SET otp_hash = $1, otp_expires_at = $2, otp_attempts = 0, is_supplier = 1, role = 'Supplier',
             full_name = COALESCE($4, full_name)
         WHERE id = $3`,
        [otpHash, otpExpiresAt, accountId, contactName?.trim() || null]
      );
    } else {
      // Validate required fields for new supplier registrations
      if (!companyName?.trim()) {
        return json({ success: false, error: 'Company / business name is required.' }, { status: 400 });
      }
      if (!contactName?.trim()) {
        return json({ success: false, error: 'Contact person name is required.' }, { status: 400 });
      }
      if (!contactPhone?.trim()) {
        return json({ success: false, error: 'Contact phone number is required.' }, { status: 400 });
      }

      // Auto-create supplier profile — only columns that exist in schema: name, reliability_score, avg_lead_time_days
      const supRes = await pool.query(
        `INSERT INTO suppliers (name, reliability_score, avg_lead_time_days) VALUES ($1, 1.00, 1) RETURNING id`,
        [companyName.trim()]
      );
      supplierId = supRes.rows[0].id;

      // Auto-provision supplier account — store contact name/phone on the users row
      const dummyHash = 'google-oauth-operator-account-placeholder-hash';
      const insertRes = await pool.query(
        `INSERT INTO users (supplier_id, email, username, phone, password_hash, is_active, otp_hash, otp_expires_at, otp_attempts, is_supplier, role, full_name)
         VALUES ($1, $2, $2, $3, $4, 1, $5, $6, 0, 1, 'Supplier', $7) RETURNING id`,
        [supplierId, cleanEmail, contactPhone?.trim() || null, dummyHash, otpHash, otpExpiresAt, contactName?.trim() || null]
      );
      accountId = insertRes.rows[0].id;
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
      subject: `Your CaterSync Supplier Verification Code: ${otpCode}`,
      text: `Hello,\n\nYour 6-digit supplier verification code is:\n\n${otpCode}\n\nValid for 10 minutes. Do not share this code.`,
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 520px; margin: 0 auto; background: #1F1B18; color: #F6F2EA; padding: 32px; border-radius: 8px;">
          <div style="text-align:center; margin-bottom: 28px;">
            <div style="display:inline-block; background:#D9A441; color:#1F1B18; font-weight:900; font-size:14px; letter-spacing:0.2em; padding:4px 14px; border-radius:3px;">CATERSYNC</div>
            <p style="color:#767068; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; margin-top:8px;">Supplier Hub Registration</p>
          </div>
          <p style="color:#F6F2EA; font-size:13px;">Hi Supplier Partner,</p>
          <p style="color:#A09890; font-size:12px; line-height:1.6;">Your supplier sign-up verification code is:</p>
          <div style="text-align:center; margin: 28px 0;">
            <div style="display:inline-block; background:#2A2521; border: 2px solid #D9A441; border-radius:8px; padding: 18px 36px;">
              <span style="font-size:36px; font-weight:900; letter-spacing:0.5em; color:#D9A441;">${otpCode}</span>
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
    console.error('[register-supplier] Error:', error);
    return json({ success: false, error: 'Registration failed: ' + error.message }, { status: 500 });
  }
}
