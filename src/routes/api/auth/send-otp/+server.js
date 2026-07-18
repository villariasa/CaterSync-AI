/**
 * POST /api/auth/send-otp
 *
 * Unified OTP dispatch for ALL account types:
 *   - subscriber      (Customer Portal)
 *   - org_user        (Catering Operator)
 *   - supplier        (Supplier Hub)
 *   - platform_admin  (Admin Console)
 *
 * Generates a 6-digit OTP, hashes it, stores it in the DB,
 * and sends it to the account's email address.
 *
 * Returns { success: true } — NEVER returns the OTP code itself.
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { generateOtp } from '$lib/server/auth/tokens.js';
import { sendEmail } from '$lib/server/mailer.js';
import { checkRateLimit, rateLimitExceededResponse } from '$lib/server/auth/rate-limit.js';

// OTP valid for 10 minutes
const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * Lookup config per account type.
 * table:        DB table name
 * emailCol:     column holding the email address
 * activeCol:    column / expression to check if account is active (or null if always active)
 * otpHashCol:   column for storing the hashed OTP
 * otpExpiryCol: column for expiry timestamp
 * otpAttemptCol:column for attempt counter
 * identifierCol:column(s) to query by email
 */
const ACCOUNT_CONFIG = {
  subscriber: {
    table: 'subscriber_accounts',
    emailCol: 'email',
    activeCheck: "status = 'active'",
    otpHashCol: 'otp_hash',
    otpExpiryCol: 'otp_expires_at',
    otpAttemptCol: 'otp_attempts',
    nameCol: 'email'
  },
  org_user: {
    table: 'users',
    emailCol: 'email',
    activeCheck: 'is_active = 1',
    otpHashCol: 'email_otp_hash',
    otpExpiryCol: 'email_otp_expires_at',
    otpAttemptCol: 'email_otp_attempts',
    nameCol: 'username'
  },
  supplier: {
    table: 'supplier_accounts',
    emailCol: 'email',
    activeCheck: 'is_active = 1',
    otpHashCol: 'otp_hash',
    otpExpiryCol: 'otp_expires_at',
    otpAttemptCol: 'otp_attempts',
    nameCol: 'email'
  },
  platform_admin: {
    table: 'platform_admins',
    emailCol: 'email',
    activeCheck: 'is_active = 1',
    otpHashCol: 'email_otp_hash',
    otpExpiryCol: 'email_otp_expires_at',
    otpAttemptCol: 'email_otp_attempts',
    nameCol: 'username'
  }
};

export async function POST({ request, cookies }) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';

  let email = '';
  try {
    const body = await request.json().catch(() => ({}));
    email = body.email?.trim().toLowerCase() || '';
    const accountType = body.accountType || '';

    if (!email) {
      return json({ success: false, error: 'Email address is required.' }, { status: 400 });
    }

    const cfg = ACCOUNT_CONFIG[accountType];
    if (!cfg) {
      return json({ success: false, error: 'Invalid account type.' }, { status: 400 });
    }

    // Rate limiting — prevent OTP bombing
    const limit = await checkRateLimit('send_otp', `email:${email}`);
    if (!limit.allowed) {
      return json({ success: false, ...rateLimitExceededResponse(limit.retryAfterMs) }, { status: 429 });
    }

    // Look up account
    const res = await pool.query(
      `SELECT id, ${cfg.emailCol} AS email, ${cfg.nameCol} AS display_name FROM ${cfg.table} WHERE LOWER(${cfg.emailCol}) = ? LIMIT 1`,
      [email]
    );

    if (res.rows.length === 0) {
      // Don't reveal whether account exists — return same response
      return json({ success: true, message: 'If an account exists for this email, a code has been sent.' });
    }

    const account = res.rows[0];

    // Generate OTP
    const { code, hash } = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    // Store hashed OTP in DB (reset attempts)
    await pool.query(
      `UPDATE ${cfg.table} SET ${cfg.otpHashCol} = ?, ${cfg.otpExpiryCol} = ?, ${cfg.otpAttemptCol} = 0 WHERE id = ?`,
      [hash, expiresAt, account.id]
    );

    // Fetch business settings for mailer
    let businessSettings = null;
    try {
      const settingsRes = await pool.query(
        'SELECT gmail_address, gmail_app_password, smtp_host, smtp_port FROM business_settings LIMIT 1'
      );
      if (settingsRes.rows.length > 0) businessSettings = settingsRes.rows[0];
    } catch { /* Non-fatal — mailer handles missing settings */ }

    // Send OTP email
    const displayName = account.display_name || email;
    const portalLabel = {
      subscriber:     'Customer Portal',
      org_user:       'Operator Console',
      supplier:       'Supplier Hub',
      platform_admin: 'Admin Console'
    }[accountType] || 'CaterSync';

    await sendEmail({
      to: account.email,
      subject: `Your CaterSync verification code: ${code}`,
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 520px; margin: 0 auto; background: #1F1B18; color: #F6F2EA; padding: 32px; border-radius: 8px;">
          <div style="text-align:center; margin-bottom: 28px;">
            <div style="display:inline-block; background:#D9A441; color:#1F1B18; font-weight:900; font-size:14px; letter-spacing:0.2em; padding:4px 14px; border-radius:3px;">CATERSYNC</div>
            <p style="color:#767068; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; margin-top:8px;">${portalLabel}</p>
          </div>
          <p style="color:#F6F2EA; font-size:13px;">Hi <strong>${displayName}</strong>,</p>
          <p style="color:#A09890; font-size:12px; line-height:1.6;">Your one-time verification code for <strong style="color:#F6F2EA;">${portalLabel}</strong> is:</p>
          <div style="text-align:center; margin: 28px 0;">
            <div style="display:inline-block; background:#2A2521; border: 2px solid #D9A441; border-radius:8px; padding: 18px 36px;">
              <span style="font-size:36px; font-weight:900; letter-spacing:0.5em; color:#D9A441;">${code}</span>
            </div>
          </div>
          <p style="color:#767068; font-size:11px; text-align:center;">This code expires in <strong style="color:#F6F2EA;">10 minutes</strong>.</p>
          <hr style="border-color:#3A3530; margin: 24px 0;">
          <p style="color:#767068; font-size:10px; text-align:center;">If you did not request this code, please ignore this email. Do not share this code with anyone.</p>
          <p style="color:#5A5248; font-size:9px; text-align:center; letter-spacing:0.1em; margin-top:16px;">CATERSYNC OPERATIONS INC. · AUTOMATED SECURITY NOTIFICATION</p>
        </div>
      `,
      text: `Your CaterSync ${portalLabel} verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this message.`,
      businessSettings
    });

    return json({ success: true, message: 'If an account exists for this email, a code has been sent.' });

  } catch (err) {
    console.error('[send-otp] Error:', err.message);
    return json({ success: false, error: 'Failed to send verification code. Please try again.' }, { status: 500 });
  }
}
