import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { generateSecret } from '$lib/server/totp.js';

export async function POST({ request }) {
  let username = 'admin';
  try {
    const body = await request.json().catch(() => ({}));
    username = body.username || '';

    if (!username) {
      return json({ success: false, error: 'Username is required.' }, { status: 400 });
    }

    const cleanUsername = username.trim();

    // 1. Query operator database (users table)
    const userRes = await pool.query(
      'SELECT id, username, role, is_active, totp_secret FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      // Return default method if user not found to prevent user enumeration
      const isLinkAdmin = cleanUsername.toLowerCase() === 'admin';
      return json({
        success: true,
        userExists: false,
        methods: isLinkAdmin ? ['password'] : ['totp-setup'],
        totpSetup: isLinkAdmin ? null : {
          secret: 'OFFLINETOTPSECRET',
          qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FCaterSync-AI%3Aoffline%3Fsecret%3DOFFLINETOTPSECRET%26issuer%3DCaterSync-AI'
        }
      });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return json({ success: false, error: 'Operator account is deactivated.' }, { status: 403 });
    }

    const methods = [];
    let totpSetup = null;

    if (cleanUsername.toLowerCase() === 'admin') {
      methods.push('password');
    } else {
      if (user.totp_secret) {
        methods.push('totp');
      } else {
        methods.push('totp-setup');
        const setupSecret = generateSecret();
        const otpauthUrl = `otpauth://totp/CaterSync-AI:${encodeURIComponent(user.username)}?secret=${setupSecret}&issuer=CaterSync-AI`;
        totpSetup = {
          secret: setupSecret,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
        };
      }
    }

    // 2. Check registered WebAuthn credentials
    const credRes = await pool.query(
      "SELECT id FROM webauthn_credentials WHERE account_id = $1 AND account_type = 'operator' LIMIT 1",
      [user.id]
    );
    if (credRes.rows.length > 0) {
      methods.push('biometric');
    }

    return json({
      success: true,
      userExists: true,
      methods,
      totpSetup
    });
  } catch (error) {
    console.error('Pre-auth error:', error);
    const isLinkAdmin = username.trim().toLowerCase() === 'admin';
    return json({
      success: true,
      userExists: false,
      methods: isLinkAdmin ? ['password'] : ['totp-setup'],
      totpSetup: isLinkAdmin ? null : {
        secret: 'OFFLINETOTPSECRET',
        qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FCaterSync-AI%3Aoffline%3Fsecret%3DOFFLINETOTPSECRET%26issuer%3DCaterSync-AI'
      }
    });
  }
}
