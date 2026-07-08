import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import nodemailer from 'nodemailer';

export async function POST({ request }) {
  try {
    const { email, name, phone } = await request.json();

    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Valid email address is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if client customer profile exists
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
      // Create a customer row
      const finalName = name && name.trim() ? name.trim() : cleanEmail.split('@')[0];
      const finalPhone = phone && phone.trim() ? phone.trim() : cleanEmail;
      const insertCustomerRes = await pool.query(
        'INSERT INTO customers (name, contact, email) VALUES ($1, $2, $3) RETURNING id, name',
        [finalName, finalPhone, cleanEmail]
      );
      customerId = insertCustomerRes.rows[0].id;
      customerName = insertCustomerRes.rows[0].name;
    }

    // 2. Generate 6-digit OTP code
    const otpCode = String(100000 + Math.floor(Math.random() * 900000));
    const otpExpiresAt = new Date(Date.now() + 120 * 1000).toISOString(); // 120 seconds (2 minutes)

    // 3. Upsert subscriber account
    const subRes = await pool.query(
      'SELECT id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (subRes.rows.length > 0) {
      await pool.query(
        'UPDATE subscriber_accounts SET customer_id = $1, phone = COALESCE($2, phone), otp_code = $3, otp_expires_at = $4, status = $5 WHERE LOWER(email) = $6',
        [customerId, phone ? phone.trim() : null, otpCode, otpExpiresAt, 'pending', cleanEmail]
      );
    } else {
      await pool.query(
        'INSERT INTO subscriber_accounts (customer_id, email, phone, otp_code, otp_expires_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [customerId, cleanEmail, phone ? phone.trim() : null, otpCode, otpExpiresAt, 'pending']
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

    let info = null;
    let mailSendError = null;

    try {
      if (!transporter) {
        usingFallback = true;
        try {
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
        } catch (e) {
          console.warn("Ethereal test account creation failed, skipping email sending:", e.message);
          transporter = null;
        }
      }

      if (transporter) {
        const mailOptions = {
          from: usingFallback
            ? `"CaterSync Sandbox Mailer" <support@catersync-sandbox.com>`
            : `"CaterSync Customer Support" <${gmailAddress}>`,
          to: cleanEmail,
          subject: `Your CaterSync Portal Registration OTP: ${otpCode}`,
          text: `Hello ${customerName},\n\nYour 6-digit confirmation OTP for the CaterSync Customer Self-Service Portal is:\n\n${otpCode}\n\nThis OTP is valid for 2 minutes.\n\nThank you,\nThe Catering Team`,
          html: `
            <div style="font-family: 'Outfit', 'Inter', -apple-system, sans-serif; background-color: #F6F2EA; padding: 40px 20px; text-align: center;">
              <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid rgba(118, 112, 104, 0.2); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(42, 37, 33, 0.05); text-align: left;">
                
                <div style="background-color: #3E6650; padding: 30px; text-align: center; border-bottom: 4px solid #D9A441;">
                  <h1 style="color: #F6F2EA; font-size: 24px; font-weight: 900; margin: 0; letter-spacing: -0.5px; text-transform: uppercase;">
                    CaterSync
                  </h1>
                  <p style="color: #D9A441; font-size: 10px; font-weight: bold; font-family: monospace; margin: 5px 0 0 0; text-transform: uppercase; tracking-wider: 1px;">
                    Customer Registration OTP
                  </p>
                </div>

                <div style="padding: 40px 30px; color: #2A2521;">
                  <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 15px 0; color: #3E6650;">
                    Hello ${customerName},
                  </h2>
                  <p style="font-size: 13px; line-height: 1.6; margin: 0 0 25px 0; color: #5A544F;">
                    Please use the following 6-digit verification code to confirm your registration and access the self-service client dashboard:
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

        info = await transporter.sendMail(mailOptions);
        if (usingFallback) {
          previewUrl = nodemailer.getTestMessageUrl(info);
          console.log(`✉️ OTP Ethereal Sandbox Mail Sent! Preview URL: ${previewUrl}`);
        }
      } else {
        usingFallback = true;
        console.warn(`⚠️ Mailer unavailable on this host. Direct login code for ${cleanEmail}: ${otpCode}`);
      }
    } catch (err) {
      usingFallback = true;
      mailSendError = err.message;
      console.warn("Mail sending block failed, falling back to direct OTP return:", err.message);
    }

    return json({ 
      success: true, 
      usingFallback, 
      previewUrl, 
      otpCode: usingFallback ? otpCode : null,
      mailSendError
    });
  } catch (error) {
    console.error('Subscriber registration error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
