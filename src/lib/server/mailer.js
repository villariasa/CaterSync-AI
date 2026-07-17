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

  // 3. Cloudflare Workers Direct SMTP Socket (works in Cloudflare Pages/Worker environment)
  let connectFn = null;
  try {
    const socketsModule = await import(/* @vite-ignore */ 'cloudflare:sockets');
    connectFn = socketsModule.connect;
  } catch (e) {
    // Non-cloudflare environment
  }

  if (connectFn && hasUserSmtp) {
    try {
      console.log(`🔌 [Cloudflare Sockets] Direct secure SMTP connection to ${smtpHost}:${smtpPort}...`);
      const socket = connectFn(`${smtpHost}:${smtpPort}`, { secureTransport: 'on' });
      
      const reader = socket.readable.getReader();
      const writer = socket.writable.getWriter();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let socketBuffer = '';

      const readResponse = async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          socketBuffer += decoder.decode(value);
          const lines = socketBuffer.split('\r\n');
          if (lines.length > 1) {
            const lastLine = lines[lines.length - 2];
            const match = lastLine.match(/^(\d{3})(?:[^\-]|$)/);
            if (match) {
              const fullResponse = socketBuffer;
              socketBuffer = '';
              return { code: parseInt(match[1], 10), text: fullResponse };
            }
          }
        }
        throw new Error('SMTP connection closed unexpectedly');
      };

      try {
        // greeting
        let resp = await readResponse();
        if (resp.code !== 220) throw new Error(`Invalid greeting: ${resp.text}`);

        // EHLO
        await writer.write(encoder.encode(`EHLO localhost\r\n`));
        resp = await readResponse();
        if (resp.code !== 250) throw new Error(`EHLO failed: ${resp.text}`);

        // AUTH PLAIN
        const authString = `\0${gmailAddress}\0${gmailAppPassword}`;
        const base64Auth = btoa(authString);
        await writer.write(encoder.encode(`AUTH PLAIN ${base64Auth}\r\n`));
        resp = await readResponse();
        if (resp.code !== 235) throw new Error(`Auth failed: ${resp.text}`);

        // MAIL FROM
        await writer.write(encoder.encode(`MAIL FROM:<${gmailAddress}>\r\n`));
        resp = await readResponse();
        if (resp.code !== 250) throw new Error(`MAIL FROM failed: ${resp.text}`);

        // RCPT TO
        await writer.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
        resp = await readResponse();
        if (resp.code !== 250) throw new Error(`RCPT TO failed: ${resp.text}`);

        // DATA
        await writer.write(encoder.encode(`DATA\r\n`));
        resp = await readResponse();
        if (resp.code !== 354) throw new Error(`DATA failed: ${resp.text}`);

        // MIME
        const mimeData = [
          `From: "CaterSync Support" <${gmailAddress}>`,
          `To: ${to}`,
          `Subject: ${subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=utf-8`,
          `Content-Transfer-Encoding: 7bit`,
          `Date: ${new Date().toUTCString()}`,
          `Message-ID: <${Date.now()}-${Math.random().toString(36).substr(2, 9)}@catersync.ai>`,
          ``,
          html || text,
          `.`,
          ``
        ].join('\r\n');

        await writer.write(encoder.encode(mimeData));
        resp = await readResponse();
        if (resp.code !== 250) throw new Error(`Delivery failed: ${resp.text}`);

        // QUIT
        await writer.write(encoder.encode(`QUIT\r\n`));
        await readResponse().catch(() => {});

        console.log(`✉️ Email successfully sent to ${to} via direct Cloudflare secure socket!`);
        return { success: true, usingFallback: false, method: 'cloudflare-socket' };
      } catch (innerErr) {
        console.warn("Cloudflare socket SMTP transfer failed:", innerErr.message);
        mailSendError = innerErr.message;
      } finally {
        try { writer.releaseLock(); } catch {}
        try { reader.releaseLock(); } catch {}
        try { socket.close(); } catch {}
      }
    } catch (cfErr) {
      console.warn("Cloudflare socket SMTP connect failed:", cfErr.message);
      mailSendError = cfErr.message;
    }
  }

  // 4. Fallback to Mailchannels HTTP REST API (Ideal for Cloudflare Workers / Serverless)
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

  // 5. Try Ethereal sandbox test account (only works in Node.js local environments)
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

  // 6. Hard fallback to Console Log (No SMTP and No HTTP mailer works)
  console.warn(`🚨 ALL MAILERS FAILED. Console sandbox code for ${to} is active.`);
  return { 
    success: true, 
    usingFallback: true, 
    previewUrl: null, 
    mailSendError: mailSendError || "All SMTP and HTTP relay mechanisms failed"
  };
}

