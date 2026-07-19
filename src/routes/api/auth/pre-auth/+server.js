/**
 * POST /api/auth/pre-auth
 *
 * Simplified account lookup — no longer sets up TOTP.
 * Returns whether the account exists and what type it is,
 * so the login page can show the right UI and call /api/auth/send-otp.
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = body.username?.trim().toLowerCase() || body.email?.trim().toLowerCase() || '';

    if (!identifier) {
      return json({ success: false, error: 'Email is required.' }, { status: 400 });
    }

    const res = await pool.query(
      'SELECT id, is_active, is_admin, is_supplier, is_customer, is_operator FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
      [identifier, identifier]
    );
    if (res.rows.length > 0) {
      const user = res.rows[0];
      if (!user.is_active) {
        return json({ success: false, error: 'Account is deactivated.' }, { status: 403 });
      }
      let userType = null;
      if (user.is_admin) userType = 'platform_admin';
      else if (user.is_supplier) userType = 'supplier';
      else if (user.is_customer) userType = 'subscriber';
      else if (user.is_operator) userType = 'org_user';

      return json({ success: true, userExists: true, userType });
    }

    return json({ success: true, userExists: false, userType: null });

  } catch (error) {
    console.error('[pre-auth] Error:', error.message);
    return json({ success: false, error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
