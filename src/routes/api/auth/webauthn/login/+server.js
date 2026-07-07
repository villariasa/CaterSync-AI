import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  try {
    const { username, email, accountType, credentialId, clientDataJSON, signature, authenticatorData } = await request.json();

    const type = accountType || 'operator';
    let accountId = null;
    let userRow = null;

    if (type === 'operator') {
      const userRes = await pool.query('SELECT id, username, role FROM users WHERE LOWER(username) = $1 LIMIT 1', [username.trim().toLowerCase()]);
      if (userRes.rows.length === 0) return json({ error: 'Operator not found' }, { status: 404 });
      userRow = userRes.rows[0];
      accountId = userRow.id;
    } else {
      const subRes = await pool.query('SELECT id, email, customer_id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1', [email.trim().toLowerCase()]);
      if (subRes.rows.length === 0) return json({ error: 'Subscriber account not found' }, { status: 404 });
      userRow = subRes.rows[0];
      accountId = userRow.id;
    }

    // Verify database registration
    const credRes = await pool.query(
      'SELECT id FROM webauthn_credentials WHERE account_id = $1 AND account_type = $2 AND credential_id = $3 LIMIT 1',
      [accountId, type, credentialId]
    );

    if (credRes.rows.length === 0) {
      return json({ error: 'Biometric passkey not recognized for this account.' }, { status: 401 });
    }

    // Set cookies / session state based on account type
    if (type === 'operator') {
      cookies.set('operator_session', userRow.username, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 12 // 12 hours
      });
    } else {
      cookies.set('portal_customer_id', userRow.customer_id.toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 6 // 6 hours
      });
    }

    return json({
      success: true,
      message: 'Biometric authentication successful!',
      user: type === 'operator' ? { username: userRow.username, role: userRow.role } : null,
      customer: type === 'subscriber' ? { id: userRow.customer_id, email: userRow.email } : null
    });
  } catch (err) {
    console.error('WebAuthn login validation error:', err);
    return json({ error: err.message }, { status: 500 });
  }
}
export async function GET({ url }) {
  try {
    const username = url.searchParams.get('username');
    const email = url.searchParams.get('email');
    const type = url.searchParams.get('type') || 'operator';

    let accountId = null;

    if (type === 'operator') {
      const userRes = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1', [username?.trim().toLowerCase()]);
      if (userRes.rows.length > 0) accountId = userRes.rows[0].id;
    } else {
      const subRes = await pool.query('SELECT id FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1', [email?.trim().toLowerCase()]);
      if (subRes.rows.length > 0) accountId = subRes.rows[0].id;
    }

    if (!accountId) {
      return json({ credentials: [] });
    }

    const creds = await pool.query(
      'SELECT credential_id, device_label FROM webauthn_credentials WHERE account_id = $1 AND account_type = $2',
      [accountId, type]
    );

    return json({ credentials: creds.rows });
  } catch (err) {
    return json({ credentials: [] });
  }
}
