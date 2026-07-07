import { json } from '@sveltejs/kit';
import nodemailer from 'nodemailer';

export async function POST({ request }) {
  try {
    const { email, name, contact, emailConfig } = await request.json();

    if (!email) {
      return json({ success: false, error: 'Customer email is missing.' }, { status: 400 });
    }

    if (!emailConfig || !emailConfig.gmailAddress || !emailConfig.gmailAppPassword) {
      return json({ success: false, error: 'Email App Configuration is incomplete in Settings!' }, { status: 400 });
    }

    const host = emailConfig.smtpHost || 'smtp.gmail.com';
    const port = parseInt(emailConfig.smtpPort || 465);
    const secure = port === 465;

    // Create SMTP transport
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: emailConfig.gmailAddress,
        pass: emailConfig.gmailAppPassword
      }
    });

    const origin = request.headers.get('origin') || 'http://localhost:5173';
    const portalLink = `${origin}/portal?contact=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `"CaterSync Customer Support" <${emailConfig.gmailAddress}>`,
      to: email,
      subject: 'Access Your CaterSync Customer Self-Service Portal Link',
      text: `Hello ${name || 'Customer'},\n\nYou can access your CaterSync Customer Self-Service Portal to review packages and sign agreements here:\n\n${portalLink}\n\nThank you,\nThe Catering Team`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2D3748; border-bottom: 2px solid #3E6650; padding-bottom: 10px; font-weight: bold;">CaterSync Customer Portal</h2>
          <p>Hello <strong>${name || 'Customer'}</strong>,</p>
          <p>You can now access your CaterSync Customer Self-Service Portal directly to check your event package details, sign agreements, and provide feedback.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${portalLink}" style="background-color: #3E6650; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; display: inline-block;">
              Go to Customer Portal
            </a>
          </div>
          <p style="font-size: 11px; color: #718096; margin-top: 20px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${portalLink}" style="color: #3E6650;">${portalLink}</a>
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return json({ success: true });
  } catch (error) {
    console.error('SMTP Mail error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
