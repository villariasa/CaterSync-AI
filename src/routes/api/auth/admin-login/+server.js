/**
 * POST /api/auth/admin-login  [DEPRECATED]
 *
 * Password login for Platform Admins has been removed.
 * Admins now authenticate with Gmail Email OTP.
 * Use POST /api/auth/verify-email-otp with accountType='platform_admin'.
 */
import { json } from '@sveltejs/kit';

export async function POST() {
  return json({
    success: false,
    error: 'Password login has been removed. Please use Email OTP authentication.',
    deprecated: true
  }, { status: 410 });
}
