import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import crypto from 'crypto';

export async function POST({ request }) {
  try {
    const { username, password, role } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, { status: 400 });
    }

    if (password.length < 5) {
      return json({ error: 'Password must be at least 5 characters long' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role`,
      [username.trim(), hash, role || 'Operator']
    );

    return json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return json({ error: 'Username already exists' }, { status: 409 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
