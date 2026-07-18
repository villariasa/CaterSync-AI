/**
 * POST /api/auth/login  [DEPRECATED]
 *
 * Username/password login has been removed.
 * All operator accounts now authenticate via Gmail Email OTP.
 * Use POST /api/auth/verify-email-otp with accountType='org_user'.
 */
import { json } from '@sveltejs/kit';

export async function POST() {
  return json({
    success: false,
    error: 'Password login has been removed. Please use Email OTP authentication.',
    deprecated: true
  }, { status: 410 });
}
