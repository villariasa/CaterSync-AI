/**
 * POST /api/auth/supplier-login  [DEPRECATED]
 *
 * Password login for Suppliers has been removed.
 * Suppliers now authenticate with Gmail Email OTP.
 * Use POST /api/auth/verify-email-otp with accountType='supplier'.
 */
import { json } from '@sveltejs/kit';

export async function POST() {
  return json({
    success: false,
    error: 'Password login has been removed. Please use Email OTP authentication.',
    deprecated: true
  }, { status: 410 });
}
