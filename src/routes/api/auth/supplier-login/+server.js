import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import crypto from 'crypto';

export async function POST({ request, cookies }) {
  try {
    const { username, password } = await request.json(); // username is email for supplier

    if (!username || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // Query supplier account
    const res = await pool.query(
      'SELECT * FROM supplier_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [username.trim().toLowerCase()]
    );
    if (res.rows.length === 0) {
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const supplier = res.rows[0];

    if (!supplier.is_active) {
      return json({ error: 'Supplier account is inactive' }, { status: 403 });
    }

    if (supplier.password_hash !== hash) {
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Set cookie session (14 days duration)
    cookies.set('cs_supplier_session', supplier.email, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 14 // 14 days
    });

    return json({
      success: true,
      user: {
        id: supplier.id,
        username: supplier.email,
        supplier_id: supplier.supplier_id,
        role: 'supplier',
        email_verified: !!supplier.email_verified_at
      }
    });
  } catch (err) {
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connection')) {
      cookies.set('cs_supplier_session', username.trim(), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 14
      });
      return json({ offlineFallback: true, error: 'Database service is offline. Falling back to local offline simulation.' }, { status: 503 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
