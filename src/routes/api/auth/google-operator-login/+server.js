import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

// Decode Google JWT Identity Token with base64url padding
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
  let email = 'admin@catersync.ai';
  let name = 'admin';

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

    // 1. Check if Operator exists in users table
    const userRes = await pool.query(
      'SELECT id, username, role FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [email]
    );

    let user = null;

    if (userRes.rows.length > 0) {
      user = userRes.rows[0];
    } else {
      // Auto-create Operator account
      // Use a dummy password hash that cannot be matched normally
      const dummyHash = 'google-oauth-operator-account-placeholder-hash';
      const insertRes = await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'Operator') RETURNING username, role",
        [email, dummyHash]
      );
      user = insertRes.rows[0];
    }

    // 2. Set Operator session cookie
    cookies.set('session_user', user.username, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 12 // 12 hours
    });

    return json({
      success: true,
      user: {
        username: user.username,
        role: user.role,
        name: name,
        picture: payload.picture || null
      }
    });

  } catch (error) {
    console.error('Operator Google login error:', error);

    // Database connection offline fallback for local testing
    if (error.message.includes('database connection') || error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
      cookies.set('session_user', name, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 12
      });
      return json({
        success: true,
        offlineFallback: true,
        user: {
          username: name,
          role: 'Operator',
          name: name,
          picture: payload.picture || null
        }
      });
    }

    return json({ success: false, error: error.message }, { status: 500 });
  }
}
