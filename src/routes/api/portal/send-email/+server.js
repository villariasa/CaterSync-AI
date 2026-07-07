import { json } from '@sveltejs/kit';
import nodemailer from 'nodemailer';

export async function POST({ request }) {
  try {
    const { email, name, contact, preferred_theme, dietary_prefs, emailConfig } = await request.json();

    if (!email) {
      return json({ success: false, error: 'Customer email is missing.' }, { status: 400 });
    }

    let transporter;
    let usingFallback = false;
    let previewUrl = null;

    const hasUserSmtp = emailConfig && emailConfig.gmailAddress && emailConfig.gmailAppPassword;

    if (hasUserSmtp) {
      try {
        const host = emailConfig.smtpHost || 'smtp.gmail.com';
        const port = parseInt(emailConfig.smtpPort || 465);
        const secure = port === 465;

        transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user: emailConfig.gmailAddress,
            pass: emailConfig.gmailAppPassword
          },
          connectionTimeout: 4000, 
          greetingTimeout: 4000
        });

        // Test connection
        await transporter.verify();
      } catch (smtpErr) {
        console.warn("Configured SMTP server authentication or connect failed, falling back to Ethereal Mail sandbox:", smtpErr.message);
        transporter = null;
      }
    }

    // Dynamic sandbox fallback if user has no SMTP setup or user SMTP failed
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

    const origin = request.headers.get('origin') || 'http://localhost:5173';
    const portalLink = `${origin}/portal?contact=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: usingFallback
        ? `"CaterSync Sandbox Mailer" <support@catersync-sandbox.com>`
        : `"CaterSync Customer Support" <${emailConfig.gmailAddress}>`,
      to: email,
      subject: 'Access Your CaterSync Customer Self-Service Portal Link',
      text: `Hello ${name || 'Customer'},\n\nYou can access your CaterSync Customer Self-Service Portal to review packages and sign agreements here:\n\n${portalLink}\n\nThank you,\nThe Catering Team`,
      html: `
        <div style="font-family: 'Outfit', 'Inter', -apple-system, sans-serif; background-color: #F6F2EA; padding: 40px 20px; text-align: center;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid rgba(118, 112, 104, 0.2); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(42, 37, 33, 0.05); text-align: left;">
            
            <!-- Header Banner -->
            <div style="background-color: #3E6650; padding: 30px; text-align: center; border-bottom: 4px solid #D9A441;">
              <h1 style="color: #F6F2EA; font-size: 24px; font-weight: 900; margin: 0; letter-spacing: -0.5px; text-transform: uppercase;">
                CaterSync
              </h1>
              <p style="color: #D9A441; font-size: 10px; font-weight: bold; font-family: monospace; margin: 5px 0 0 0; text-transform: uppercase; tracking-wider: 1px;">
                Customer Self-Service Console
              </p>
            </div>

            <!-- Email Body Content -->
            <div style="padding: 40px 30px; color: #2A2521;">
              <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 15px 0; color: #3E6650;">
                Hello ${name || 'Valued Customer'},
              </h2>
              <p style="font-size: 13px; line-height: 1.6; margin: 0 0 25px 0; color: #5A544F;">
                Your catering planner has generated your private access link to the <strong>CaterSync Self-Service Portal</strong>. Through this portal, you can directly review your event packages, sign agreements, specify dietary preferences, and browse menus.
              </p>

              <!-- Client Portal Registry Info Card -->
              <div style="background-color: #F6F2EA; border-left: 3px solid #D9A441; padding: 15px 20px; border-radius: 4px; margin-bottom: 30px; font-size: 12px; border: 1px solid rgba(118, 112, 104, 0.1);">
                <h4 style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: #767068; font-family: monospace;">Registered Client Profile:</h4>
                <div style="margin-bottom: 6px;"><strong>Name:</strong> ${name || 'Customer'}</div>
                <div style="margin-bottom: 6px;"><strong>Contact:</strong> ${contact || 'Not registered'}</div>
                <div style="margin-bottom: 6px;"><strong>Preferred Theme:</strong> ${preferred_theme || 'Standard'}</div>
                ${dietary_prefs ? `<div style="margin-bottom: 6px;"><strong>Dietary Info:</strong> ${dietary_prefs}</div>` : ''}
              </div>

              <!-- Button CTA -->
              <div style="margin: 30px 0; text-align: center;">
                <a href="${portalLink}" style="background-color: #3E6650; color: #F6F2EA; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 3px 6px rgba(62, 102, 80, 0.2); border: 1px solid #3E6650; transition: background-color 0.2s;">
                  Access My Portal Now
                </a>
              </div>

              <p style="font-size: 12px; line-height: 1.5; margin: 25px 0 0 0; color: #767068;">
                Best regards,<br/>
                <strong>The Culinary & Planning Team</strong><br/>
                <span style="font-size: 10px; color: #D9A441; text-transform: uppercase; font-weight: bold;">CaterSync AI</span>
              </p>
            </div>

            <!-- Footer Details -->
            <div style="background-color: #2A2521; padding: 20px 30px; text-align: center; border-top: 1px solid rgba(118, 112, 104, 0.25); font-size: 10px; color: #767068; font-family: monospace;">
              <p style="margin: 0 0 6px 0;">This email was sent to ${email} automatically by CaterSync.</p>
              <p style="margin: 0; color: #767068;">If the button doesn't respond, open this direct key URL: <br/>
                <a href="${portalLink}" style="color: #D9A441; text-decoration: underline;">${portalLink}</a>
              </p>
            </div>
            
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    if (usingFallback) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✉️ Ethereal Sandbox Mail Sent! Preview URL: ${previewUrl}`);
    }

    return json({ success: true, usingFallback, previewUrl });
  } catch (error) {
    console.error('SMTP Mail error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
