/**
 * POST /api/auth/verify-totp  [DEPRECATED]
 *
 * Google Authenticator TOTP has been removed.
 * All accounts now use Gmail Email OTP.
 * Use POST /api/auth/verify-email-otp instead.
 */
import { json } from '@sveltejs/kit';

export async function POST() {
  return json({
    success: false,
    error: 'Google Authenticator has been removed. Please use the Email OTP login flow instead.',
    deprecated: true
  }, { status: 410 }); // 410 Gone
}
