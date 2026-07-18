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

    // 1. Platform Admins
    const adminRes = await pool.query(
      'SELECT id, is_active FROM platform_admins WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
      [identifier, identifier]
    );
    if (adminRes.rows.length > 0) {
      if (!adminRes.rows[0].is_active) {
        return json({ success: false, error: 'Account is deactivated.' }, { status: 403 });
      }
      return json({ success: true, userExists: true, userType: 'platform_admin' });
    }

    // 2. Supplier Accounts
    const supplierRes = await pool.query(
      'SELECT id, is_active FROM supplier_accounts WHERE LOWER(email) = ? LIMIT 1',
      [identifier]
    );
    if (supplierRes.rows.length > 0) {
      if (!supplierRes.rows[0].is_active) {
        return json({ success: false, error: 'Account is deactivated.' }, { status: 403 });
      }
      return json({ success: true, userExists: true, userType: 'supplier' });
    }

    // 3. Subscriber (Customer) Accounts
    const subscriberRes = await pool.query(
      "SELECT id FROM subscriber_accounts WHERE LOWER(email) = ? AND status = 'active' LIMIT 1",
      [identifier]
    );
    if (subscriberRes.rows.length > 0) {
      return json({ success: true, userExists: true, userType: 'subscriber' });
    }

    // 4. Org Users (Operators)
    const userRes = await pool.query(
      'SELECT id, is_active FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
      [identifier, identifier]
    );
    if (userRes.rows.length > 0) {
      if (!userRes.rows[0].is_active) {
        return json({ success: false, error: 'Account is deactivated.' }, { status: 403 });
      }
      return json({ success: true, userExists: true, userType: 'org_user' });
    }

    return json({ success: true, userExists: false, userType: null });

  } catch (error) {
    console.error('[pre-auth] Error:', error.message);
    return json({ success: false, error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
