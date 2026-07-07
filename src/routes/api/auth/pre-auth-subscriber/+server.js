import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request }) {
  try {
    const { email } = await request.json();

    if (!email) {
      return json({ success: false, error: 'Email is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check subscriber account
    const subRes = await pool.query(
      'SELECT id, status, customer_id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (subRes.rows.length === 0) {
      return json({
        success: true,
        registered: false,
        methods: []
      });
    }

    const account = subRes.rows[0];

    const methods = [];
    if (account.password_hash) {
      methods.push('password');
    }
    // PIN is always allowed for quick local access
    methods.push('pin');

    // Check if WebAuthn enrolled
    const credRes = await pool.query(
      "SELECT id FROM webauthn_credentials WHERE account_id = $1 AND account_type = 'subscriber' LIMIT 1",
      [account.id]
    );
    if (credRes.rows.length > 0) {
      methods.push('biometric');
    }

    return json({
      success: true,
      registered: true,
      customerId: account.customer_id,
      status: account.status,
      methods
    });
  } catch (error) {
    console.error('Subscriber pre-auth error:', error);
    return json({
      success: true,
      registered: false,
      methods: ['pin']
    });
  }
}
