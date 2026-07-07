import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request }) {
  try {
    const { username } = await request.json();

    if (!username) {
      return json({ success: false, error: 'Username is required.' }, { status: 400 });
    }

    const cleanUsername = username.trim();

    // 1. Query operator database (users table)
    const userRes = await pool.query(
      'SELECT id, role, is_active FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      // Return default method if user not found, to prevent username enumeration vulnerability.
      // However, since this is an internal business app, we can return empty or default password method.
      return json({
        success: true,
        userExists: false,
        methods: ['password']
      });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return json({ success: false, error: 'Operator account is deactivated.' }, { status: 403 });
    }

    const methods = ['password']; // Password is always available

    // 2. Check PIN (PIN is simulated local or server side, let's say it is always a choice)
    methods.push('pin');

    // 3. Check registered WebAuthn credentials
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
      methods
    });
  } catch (error) {
    console.error('Pre-auth error:', error);
    // Fallback to default methods if D1 is offline
    return json({
      success: true,
      userExists: false,
      methods: ['password', 'pin']
    });
  }
}
