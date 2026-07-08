import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import nodemailer from 'nodemailer';

// Decode Google JWT Identity Token without external libraries, handling base64url padding
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    let payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payloadB64.length % 4;
    if (pad === 2) {
      payloadB64 += '==';
    } else if (pad === 3) {
      payloadB64 += '=';
    } else if (pad === 1) {
      return null;
    }

    const jsonPayload = decodeURIComponent(
      atob(payloadB64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT decoding failed:", e);
    return null;
  }
}

export async function POST({ request, cookies }) {
  let email = 'offline-google@catersync.ai';
  let name = 'Google Offline Client';

  try {
    const { credential } = await request.json();

    if (!credential) {
      return json({ success: false, error: 'Google credential token is missing.' }, { status: 400 });
    }

    const payload = decodeJwt(credential);
    if (!payload || !payload.email) {
      return json({ success: false, error: 'Invalid Google identity token.' }, { status: 400 });
    }

    email = payload.email.trim().toLowerCase();
    name = payload.name || payload.given_name || email.split('@')[0];

    // 1. Locate or auto-create Customer profile
    let customerId = null;
    const customerRes = await pool.query(
      'SELECT id, name, contact FROM customers WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (customerRes.rows.length > 0) {
      customerId = customerRes.rows[0].id;
    } else {
      // Auto-create customer profile
      const insertCustomerRes = await pool.query(
        'INSERT INTO customers (name, contact, email) VALUES ($1, $2, $3) RETURNING id',
        [name, email, email]
      );
      customerId = insertCustomerRes.rows[0].id;
    }

    // 2. Generate 6-digit OTP code (120 seconds lifetime)
    const otpCode = String(100000 + Math.floor(Math.random() * 900000));
    const otpExpiresAt = new Date(Date.now() + 120 * 1000).toISOString(); // 120 seconds

    // 3. Locate or auto-create/update Subscriber account with the new OTP
    const subRes = await pool.query(
      'SELECT id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (subRes.rows.length > 0) {
      await pool.query(
        'UPDATE subscriber_accounts SET customer_id = $1, otp_code = $2, otp_expires_at = $3, status = $4 WHERE LOWER(email) = $5',
        [customerId, otpCode, otpExpiresAt, 'pending', email]
      );
    } else {
      await pool.query(
        'INSERT INTO subscriber_accounts (customer_id, email, otp_code, otp_expires_at, status) VALUES ($1, $2, $3, $4, $5)',
        [customerId, email, otpCode, otpExpiresAt, 'pending']
      );
    }

    // 4. Fetch SMTP mail configurations
    let gmailAddress = null;
    let gmailAppPassword = null;
    let smtpHost = 'smtp.gmail.com';
    let smtpPort = 465;

    try {
      const settingsRes = await pool.query('SELECT * FROM business_settings WHERE id = 1');
      if (settingsRes.rows.length > 0) {
        gmailAddress = settingsRes.rows[0].gmail_address;
        gmailAppPassword = settingsRes.rows[0].gmail_app_password;
        smtpHost = settingsRes.rows[0].smtp_host || 'smtp.gmail.com';
        smtpPort = parseInt(settingsRes.rows[0].smtp_port || 465);
      }
    } catch (e) {
      console.warn("Could not load business settings, using default/sandbox mailer", e.message);
    }

    let transporter;
    let usingFallback = false;
    let previewUrl = null;

    const hasUserSmtp = gmailAddress && gmailAppPassword;

    if (hasUserSmtp) {
      try {
        const secure = smtpPort === 465;
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure,
          auth: {
            user: gmailAddress,
            pass: gmailAppPassword
          },
          connectionTimeout: 4000,
          greetingTimeout: 4000
        });
        await transporter.verify();
      } catch (smtpErr) {
        console.warn("SMTP config failed verification, using Ethereal sandbox fallback:", smtpErr.message);
        transporter = null;
      }
    }

    if (!transporter) {
      usingFallback = true;
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const mailOptions = {
      from: usingFallback
        ? `"CaterSync Sandbox Mailer" <support@catersync-sandbox.com>`
        : `"CaterSync Customer Support" <${gmailAddress}>`,
      to: email,
      subject: `Your CaterSync Portal Registration OTP: ${otpCode}`,
      text: `Hello ${name},\n\nYour 6-digit confirmation OTP for the CaterSync Customer Self-Service Portal is:\n\n${otpCode}\n\nThis OTP is valid for 2 minutes.\n\nThank you,\nThe Catering Team`,
      html: `
        <div style="font-family: 'Outfit', 'Inter', -apple-system, sans-serif; background-color: #F6F2EA; padding: 40px 20px; text-align: center;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid rgba(118, 112, 104, 0.2); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(42, 37, 33, 0.05); text-align: left;">
            
            <div style="background-color: #3E6650; padding: 30px; text-align: center; border-bottom: 4px solid #D9A441;">
              <h1 style="color: #F6F2EA; font-size: 24px; font-weight: 900; margin: 0; letter-spacing: -0.5px; text-transform: uppercase;">
                CaterSync
              </h1>
              <p style="color: #D9A441; font-size: 10px; font-weight: bold; font-family: monospace; margin: 5px 0 0 0; text-transform: uppercase; tracking-wider: 1px;">
                Customer OTP Verification
              </p>
            </div>

            <div style="padding: 40px 30px; color: #2A2521;">
              <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 15px 0; color: #3E6650;">
                Hello ${name},
              </h2>
              <p style="font-size: 13px; line-height: 1.6; margin: 0 0 25px 0; color: #5A544F;">
                Please use the following 6-digit verification code to confirm your Google sign-in and access the self-service client dashboard:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background-color: #F6F2EA; border: 2px dashed #3E6650; border-radius: 8px; padding: 15px 40px; font-size: 28px; font-weight: 900; letter-spacing: 5px; color: #2A2521; font-family: monospace;">
                  ${otpCode}
                </div>
                <p style="font-size: 10px; color: #767068; margin-top: 10px;">Valid for 2 minutes. Do not share this code.</p>
              </div>

              <p style="font-size: 12px; line-height: 1.5; margin: 25px 0 0 0; color: #767068;">
                Best regards,<br/>
                <strong>The Culinary & Planning Team</strong><br/>
                <span style="font-size: 10px; color: #D9A441; text-transform: uppercase; font-weight: bold;">CaterSync AI</span>
              </p>
            </div>
            
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    if (usingFallback) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✉️ Google OTP Sandbox Mail Sent! Preview URL: ${previewUrl}`);
    }

    return json({ success: true, needsOtp: true, email, usingFallback, previewUrl });
  } catch (error) {
    console.error('Google login error:', error);
    
    // Check if database service is missing/offline (local development / offline simulation)
    if (error.message.includes('database connection') || error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
      const mockOtp = '888888';
      const mockPreviewUrl = `https://ethereal.email/message/mock-google-otp`;
      console.log(`✉️ Google OTP Offline Fallback generated: ${mockOtp}`);
      return json({
        success: true,
        offlineFallback: true,
        needsOtp: true,
        email,
        previewUrl: mockPreviewUrl
      });
    }

    return json({ success: false, error: error.message }, { status: 500 });
  }
}
