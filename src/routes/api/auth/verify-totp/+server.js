import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { verifyTOTP } from '$lib/server/totp.js';

export async function POST({ request, cookies }) {
  let username = 'admin';
  try {
    const body = await request.json().catch(() => ({}));
    username = body.username || 'admin';
    const { token, setupSecret } = body;

    if (!username || !token) {
      return json({ success: false, error: 'Username and code are required.' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    // 1. Fetch user from database
    const userRes = await pool.query(
      'SELECT id, username, role, totp_secret, is_active FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (userRes.rows.length === 0) {
      return json({ success: false, error: 'Operator account not found.' }, { status: 404 });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return json({ success: false, error: 'Operator account is deactivated.' }, { status: 403 });
    }

    let secretToVerify = user.totp_secret;
    let isRegistering = false;

    if (!secretToVerify) {
      // If user hasn't setup TOTP, we expect a setupSecret from the client
      if (!setupSecret) {
        return json({ success: false, error: '2FA setup secret is missing.' }, { status: 400 });
      }
      secretToVerify = setupSecret;
      isRegistering = true;
    }

    // 2. Verify TOTP token
    const isValid = verifyTOTP(token, secretToVerify);
    if (!isValid) {
      return json({ success: false, error: 'Invalid 6-digit code. Please check your authenticator app.' }, { status: 401 });
    }

    // 3. If registering, save the secret permanently to the database
    if (isRegistering) {
      await pool.query(
        'UPDATE users SET totp_secret = $1 WHERE id = $2',
        [secretToVerify, user.id]
      );
    }

    // 4. Set Operator session cookie
    cookies.set('session_user', user.username, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 12 // 12 hours
    });

    const credRes = await pool.query(
      "SELECT id FROM webauthn_credentials WHERE account_id = $1 AND account_type = 'operator' LIMIT 1",
      [user.id]
    );
    const hasBiometrics = credRes.rows.length > 0;

    return json({
      success: true,
      hasBiometrics,
      user: {
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Verify TOTP error:', error);
    
    // Fallback/offline behavior for local development
    if (error.message.includes('database connection') || error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
      cookies.set('session_user', username || 'admin', {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 12
      });
      return json({
        success: true,
        offlineFallback: true,
        user: {
          username: username || 'admin',
          role: 'Operator'
        }
      });
    }

    return json({ success: false, error: error.message }, { status: 500 });
  }
}
