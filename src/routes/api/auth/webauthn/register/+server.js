import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request }) {
  try {
    const { username, email, accountType, credentialId, publicKey, deviceLabel } = await request.json();

    let accountId = null;
    const type = accountType || 'operator';

    if (type === 'operator') {
      if (!username) return json({ error: 'Username is required for operator registration' }, { status: 400 });
      const userRes = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1', [username.trim().toLowerCase()]);
      if (userRes.rows.length === 0) return json({ error: 'Operator not found' }, { status: 404 });
      accountId = userRes.rows[0].id;
    } else {
      if (!email) return json({ error: 'Email is required for subscriber registration' }, { status: 400 });
      const subRes = await pool.query('SELECT id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1', [email.trim().toLowerCase()]);
      if (subRes.rows.length === 0) return json({ error: 'Subscriber account not found' }, { status: 404 });
      accountId = subRes.rows[0].id;
    }

    if (!credentialId || !publicKey) {
      return json({ error: 'Credential ID and Public Key are required' }, { status: 400 });
    }

    // Insert credential
    await pool.query(
      `INSERT INTO webauthn_credentials (account_id, account_type, credential_id, public_key, sign_count, device_label)
       VALUES ($1, $2, $3, $4, 0, $5)
       ON CONFLICT (credential_id) DO UPDATE SET public_key = EXCLUDED.public_key, device_label = EXCLUDED.device_label`,
      [accountId, type, credentialId, publicKey, deviceLabel || 'Biometric Device']
    );

    return json({ success: true, message: 'WebAuthn passkey registered successfully' });
  } catch (err) {
    console.error('WebAuthn register error:', err);
    return json({ error: err.message }, { status: 500 });
  }
}
