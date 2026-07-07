import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import crypto from 'crypto';

export async function POST({ request, cookies }) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // Query user
    const res = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (res.rows.length === 0) {
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const user = res.rows[0];

    if (!user.is_active) {
      return json({ error: 'User account is inactive' }, { status: 403 });
    }

    if (user.password_hash !== hash) {
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Set cookie session (simple username token for demo verification, or signed session)
    cookies.set('session_user', user.username, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connection')) {
      return json({ offlineFallback: true, error: 'Database service is offline. Falling back to local offline simulation.' }, { status: 503 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
