import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  try {
    const { email, otpCode } = await request.json();

    if (!email || !otpCode) {
      return json({ success: false, error: 'Email and OTP code are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Fetch subscriber account
    const subRes = await pool.query(
      'SELECT * FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (subRes.rows.length === 0) {
      return json({ success: false, error: 'No registration pending for this email.' }, { status: 404 });
    }

    const account = subRes.rows[0];

    // Verify status
    if (account.status === 'active' && !account.otp_code) {
      // Already verified — just set session cookie and return
      cookies.set('cs_customer_session', cleanEmail, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
      return json({ success: true, message: 'Account is already verified and active.', account });
    }

    // Verify OTP code
    if (account.otp_code !== otpCode.trim()) {
      return json({ success: false, error: 'Invalid verification code.' }, { status: 400 });
    }

    // Check expiration
    if (new Date(account.otp_expires_at) < new Date()) {
      return json({ success: false, error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // Activate account
    const updateRes = await pool.query(
      `UPDATE subscriber_accounts 
       SET email_verified_at = CURRENT_TIMESTAMP, 
           status = 'active', 
           otp_code = NULL, 
           otp_expires_at = NULL 
       WHERE id = $1 
       RETURNING id, customer_id, email, status`,
      [account.id]
    );

    // Fetch customer profile for greeting
    let customerProfile = null;
    try {
      const custRes = await pool.query(
        'SELECT id, name, email, contact FROM customers WHERE id = $1',
        [updateRes.rows[0].customer_id]
      );
      if (custRes.rows.length > 0) customerProfile = custRes.rows[0];
    } catch (e) {
      console.warn('Could not fetch customer profile:', e.message);
    }

    // Set session cookie — customer stays logged in for 7 days
    cookies.set('cs_customer_session', cleanEmail, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    return json({
      success: true,
      message: 'Account successfully verified and activated.',
      account: updateRes.rows[0],
      customer: customerProfile
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
