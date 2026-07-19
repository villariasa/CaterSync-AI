/**
 * POST /api/auth/complete-profile
 *
 * Completes profile setup after OTP verification for Customer, Operator, or Supplier.
 * Must be called with the verified email and accountType.
 * Validates that the account exists and has been OTP-verified (email_verified_at is set).
 *
 * Body shape (all types share email + accountType):
 *   Customer:  { accountType:'customer',  email, fullName, phone, address?, birthday?, allergies?, dietaryPrefs? }
 *   Operator:  { accountType:'operator',  email, fullName, phone, position? }
 *   Supplier:  { accountType:'supplier',  email, companyName, contactName, contactPhone, address?, category? }
 */

import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

export async function POST({ request }) {
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';

  try {
    const body = await request.json();
    const { accountType, email } = body;

    if (!accountType || !email) {
      return json({ success: false, error: 'accountType and email are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── CUSTOMER ───────────────────────────────────────────────────────────────
    if (accountType === 'customer') {
      const { fullName, phone, address, birthday, allergies, dietaryPrefs } = body;

      if (!fullName?.trim()) {
        return json({ success: false, error: 'Full name is required.' }, { status: 400 });
      }
      if (!phone?.trim()) {
        return json({ success: false, error: 'Phone number is required.' }, { status: 400 });
      }

      // Verify user exists and is verified
      const subRes = await pool.query(
        `SELECT id, customer_id, email_verified_at FROM users WHERE LOWER(email) = $1 AND is_customer = 1 LIMIT 1`,
        [cleanEmail]
      );
      if (subRes.rows.length === 0) {
        return json({ success: false, error: 'Account not found. Please register first.' }, { status: 404 });
      }
      const sub = subRes.rows[0];
      if (!sub.email_verified_at) {
        return json({ success: false, error: 'Email not yet verified. Please complete OTP verification first.' }, { status: 403 });
      }

      const allergyJson = JSON.stringify(Array.isArray(allergies) ? allergies : []);
      const dietJson    = JSON.stringify(Array.isArray(dietaryPrefs) ? dietaryPrefs : []);
      const cleanName   = fullName.trim();
      const cleanPhone  = phone.trim();
      const cleanAddr   = address?.trim() || null;
      const cleanBday   = birthday?.trim() || null;

      // Update customers row (created during OTP registration)
      await pool.query(
        `UPDATE customers
         SET name = $1, contact = $2, address = $3, birthday = $4,
             allergies = $5, dietary_prefs = $6, status = 'active',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [cleanName, cleanPhone, cleanAddr, cleanBday, allergyJson, dietJson, sub.customer_id]
      );

      // Mark profile as complete on unified users table
      await pool.query(
        `UPDATE users SET full_name = $1, profile_complete = 1, is_active = 1 WHERE id = $2`,
        [cleanName, sub.id]
      );

      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_SUCCESS, identifier: cleanEmail, method: 'profile_complete', ipAddress });

      return json({ success: true, accountType: 'customer', redirectTo: '/customer' });
    }

    // ── OPERATOR ───────────────────────────────────────────────────────────────
    if (accountType === 'operator') {
      const { fullName, phone, position } = body;

      if (!fullName?.trim()) {
        return json({ success: false, error: 'Full name is required.' }, { status: 400 });
      }
      if (!phone?.trim()) {
        return json({ success: false, error: 'Phone number is required.' }, { status: 400 });
      }

      // Verify user exists and has been OTP-verified
      const userRes = await pool.query(
        `SELECT id, email_verified_at FROM users WHERE LOWER(email) = $1 AND is_operator = 1 LIMIT 1`,
        [cleanEmail]
      );
      if (userRes.rows.length === 0) {
        return json({ success: false, error: 'Operator account not found. Please register first.' }, { status: 404 });
      }
      const user = userRes.rows[0];
      if (!user.email_verified_at) {
        return json({ success: false, error: 'Email not yet verified. Please complete OTP verification first.' }, { status: 403 });
      }

      await pool.query(
        `UPDATE users
         SET full_name = $1, phone = $2, position = $3, is_active = 1,
             username = CASE WHEN username = $4 THEN $1 ELSE username END
         WHERE id = $5`,
        [fullName.trim(), phone.trim(), position?.trim() || null, cleanEmail, user.id]
      );

      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_SUCCESS, identifier: cleanEmail, method: 'profile_complete', ipAddress });

      return json({ success: true, accountType: 'operator', redirectTo: '/' });
    }

    // ── SUPPLIER ───────────────────────────────────────────────────────────────
    if (accountType === 'supplier') {
      const { companyName, contactName, contactPhone, address, category } = body;

      if (!companyName?.trim()) {
        return json({ success: false, error: 'Company name is required.' }, { status: 400 });
      }
      if (!contactName?.trim()) {
        return json({ success: false, error: 'Contact person name is required.' }, { status: 400 });
      }
      if (!contactPhone?.trim()) {
        return json({ success: false, error: 'Contact phone number is required.' }, { status: 400 });
      }

      // Verify supplier account exists and is verified on unified users table
      const accRes = await pool.query(
        `SELECT id, supplier_id, email_verified_at
         FROM users
         WHERE LOWER(email) = $1 AND is_supplier = 1 LIMIT 1`,
        [cleanEmail]
      );
      if (accRes.rows.length === 0) {
        return json({ success: false, error: 'Supplier account not found. Please register first.' }, { status: 404 });
      }
      const acc = accRes.rows[0];
      if (!acc.email_verified_at) {
        return json({ success: false, error: 'Email not yet verified. Please complete OTP verification first.' }, { status: 403 });
      }

      // Update suppliers profile row
      await pool.query(
        `UPDATE suppliers
         SET name = $1, contact_name = $2, contact_phone = $3, address = $4, category = $5, status = 'active',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [companyName.trim(), contactName.trim(), contactPhone.trim(), address?.trim() || null, category?.trim() || null, acc.supplier_id]
      );

      // Mark profile as complete on unified users table
      await pool.query(
        `UPDATE users SET profile_complete = 1, is_active = 1 WHERE id = $1`,
        [acc.id]
      );

      logAuthEvent({ eventType: AUTH_EVENTS.LOGIN_SUCCESS, identifier: cleanEmail, method: 'profile_complete', ipAddress });

      return json({ success: true, accountType: 'supplier', redirectTo: '/supplier' });
    }

    return json({ success: false, error: `Unknown accountType: ${accountType}` }, { status: 400 });

  } catch (err) {
    console.error('[complete-profile] Error:', err);
    return json({ success: false, error: 'Profile completion failed: ' + err.message }, { status: 500 });
  }
}
