import nodemailer from 'nodemailer';

/**
 * Robust email sender utility that supports local Node.js (SMTP) and Cloudflare Workers (Mailchannels / Fetch fallback)
 */
export async function sendEmail({ to, subject, text, html, businessSettings = null }) {
  let transporter = null;
  let usingFallback = false;
  let previewUrl = null;
  let mailSendError = null;

  const gmailAddress = businessSettings?.gmail_address;
  const gmailAppPassword = businessSettings?.gmail_app_password;
  const smtpHost = businessSettings?.smtp_host || 'smtp.gmail.com';
  const smtpPort = parseInt(businessSettings?.smtp_port || 465);

  const hasUserSmtp = gmailAddress && gmailAppPassword;

  // 1. Try configured SMTP (works in standard Node.js environments)
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
      console.warn("SMTP config verification failed, skipping nodemailer transporter:", smtpErr.message);
      transporter = null;
    }
  }

  // 2. Try sending using nodemailer transporter (SMTP or Ethereal sandbox)
  if (transporter) {
    try {
      const mailOptions = {
        from: `"CaterSync Support" <${gmailAddress}>`,
        to,
        subject,
        text,
        html
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`✉️ Email successfully dispatched via SMTP to ${to}`);
      return { success: true, usingFallback: false, info };
    } catch (err) {
      console.warn("Nodemailer SMTP dispatch failed:", err.message);
      mailSendError = err.message;
    }
  }

  // 3. Fallback to Mailchannels HTTP REST API (Ideal for Cloudflare Workers / Serverless)
  try {
    console.log(`📡 Attempting Mailchannels HTTP API dispatch to ${to}...`);
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }]
          }
        ],
        from: {
          email: gmailAddress || 'no-reply@catersync.ai',
          name: 'CaterSync Customer Support'
        },
        subject,
        content: [
          {
            type: 'text/html',
            value: html || text
          }
        ]
      })
    });

    if (response.ok) {
      console.log(`✉️ Email successfully dispatched via Mailchannels HTTP to ${to}`);
      return { success: true, usingFallback: false, method: 'mailchannels' };
    } else {
      const errText = await response.text();
      console.warn(`Mailchannels API rejected email: ${response.status} - ${errText}`);
      mailSendError = mailSendError || `Mailchannels error: ${errText}`;
    }
  } catch (mcErr) {
    console.warn("Mailchannels dispatch failed:", mcErr.message);
    mailSendError = mailSendError || mcErr.message;
  }

  // 4. Try Ethereal sandbox test account (only works in Node.js local environments)
  try {
    console.log("🛠️ Attempting Ethereal Sandbox mailer setup...");
    const testAccount = await nodemailer.createTestAccount();
    const sandboxTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const mailOptions = {
      from: `"CaterSync Sandbox Mailer" <support@catersync-sandbox.com>`,
      to,
      subject,
      text,
      html
    };

    const info = await sandboxTransporter.sendMail(mailOptions);
    previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`✉️ Sandbox Email Sent! Preview Link: ${previewUrl}`);
    return { success: true, usingFallback: true, previewUrl };
  } catch (ethErr) {
    console.warn("Ethereal Sandbox setup failed:", ethErr.message);
    mailSendError = mailSendError || ethErr.message;
  }

  // 5. Hard fallback to Console Log (No SMTP and No HTTP mailer works)
  console.warn(`🚨 ALL MAILERS FAILED. Console sandbox code for ${to} is active.`);
  return { 
    success: true, 
    usingFallback: true, 
    previewUrl: null, 
    mailSendError: mailSendError || "All SMTP and HTTP relay mechanisms failed"
  };
}
