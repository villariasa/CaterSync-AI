import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import crypto from 'crypto';

export async function POST({ request, cookies }) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username/email and password are required' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // Query platform admin
    const res = await pool.query(
      'SELECT * FROM platform_admins WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1',
      [username.trim().toLowerCase()]
    );
    if (res.rows.length === 0) {
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const admin = res.rows[0];

    if (!admin.is_active) {
      return json({ error: 'Platform Admin account is inactive' }, { status: 403 });
    }

    if (admin.password_hash !== hash) {
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Set cookie session (7 days duration)
    cookies.set('cs_admin_session', admin.username, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return json({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        role: 'platform_admin'
      }
    });
  } catch (err) {
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connection')) {
      // Offline fallback
      cookies.set('cs_admin_session', username.trim(), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7
      });
      return json({ offlineFallback: true, error: 'Database service is offline. Falling back to local offline simulation.' }, { status: 503 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
