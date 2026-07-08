import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { sendEmail } from '$lib/server/mailer.js';

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

    const payloadStr = atob(payloadB64);
    return JSON.parse(payloadStr);
  } catch (err) {
    console.error('Failed to decode Google JWT token payload:', err);
    return null;
  }
}

export async function POST({ request, cookies }) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return json({ success: false, error: 'Google credential token is missing.' }, { status: 400 });
    }

    const decoded = decodeJwt(credential);
    if (!decoded || !decoded.email) {
      return json({ success: false, error: 'Invalid Google credential token.' }, { status: 400 });
    }

    const { email, name, picture } = decoded;

    // 1. Check if client customer profile exists
    let customer = null;
    const customerRes = await pool.query(
      'SELECT id, name, contact, email FROM customers WHERE LOWER(email) = $1 LIMIT 1',
      [email.toLowerCase()]
    );

    if (customerRes.rows.length > 0) {
      customer = customerRes.rows[0];
    } else {
      // Create new customer profile
      const newCustRes = await pool.query(
        'INSERT INTO customers (name, contact, email) VALUES ($1, $2, $3) RETURNING id, name, contact, email',
        [name || email.split('@')[0], email, email]
      );
      customer = newCustRes.rows[0];
    }

    // 2. Generate 6-digit OTP code (120 seconds duration)
    const otpCode = String(100000 + Math.floor(Math.random() * 900000));
    const otpExpiresAt = new Date(Date.now() + 120 * 1000).toISOString();

    // 3. Upsert subscriber account
    const subRes = await pool.query(
      'SELECT id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [email.toLowerCase()]
    );

    if (subRes.rows.length > 0) {
      await pool.query(
        'UPDATE subscriber_accounts SET customer_id = $1, otp_code = $2, otp_expires_at = $3, status = $4 WHERE LOWER(email) = $5',
        [customer.id, otpCode, otpExpiresAt, 'pending', email.toLowerCase()]
      );
    } else {
      await pool.query(
        'INSERT INTO subscriber_accounts (customer_id, email, phone, otp_code, otp_expires_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [customer.id, email.toLowerCase(), email, otpCode, otpExpiresAt, 'pending']
      );
    }

    // 4. Fetch SMTP mail configurations
    let businessSettings = null;
    try {
      const settingsRes = await pool.query('SELECT * FROM business_settings WHERE id = 1');
      if (settingsRes.rows.length > 0) {
        businessSettings = settingsRes.rows[0];
      }
    } catch (e) {
      console.warn("Could not load business settings, using default/sandbox config", e.message);
    }

    // 5. Send Email using unified mailer utility (gracefully falls back to Mailchannels/Sandbox)
    const mailResult = await sendEmail({
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
      `,
      businessSettings
    });

    return json({ 
      success: true, 
      needsOtp: true, 
      email, 
      usingFallback: mailResult.usingFallback, 
      previewUrl: mailResult.previewUrl,
      otpCode: mailResult.usingFallback ? otpCode : null,
      mailSendError: mailResult.mailSendError || null
    });
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
