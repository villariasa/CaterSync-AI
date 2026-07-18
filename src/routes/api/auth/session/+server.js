/**
 * GET /api/auth/session
 *
 * Universal session check endpoint used by all four login pages
 * to detect an active session and skip straight to the dashboard
 * (Facebook-style persistent login).
 *
 * Returns:
 *   { authenticated: true,  user: {...}, redirect: '/portal' | '/' | '/supplier' | '/admin' }
 *   { authenticated: false }
 */

import { json } from '@sveltejs/kit';

const REDIRECT_BY_ROLE = {
  subscriber:     '/portal',
  org_user:       '/',
  supplier:       '/supplier',
  platform_admin: '/admin'
};

export async function GET({ locals }) {
  if (!locals.user) {
    return json({ authenticated: false }, { status: 401 });
  }

  const userType = locals.user.type;
  const redirect = REDIRECT_BY_ROLE[userType] || '/';

  return json({
    authenticated: true,
    redirect,
    user: {
      id: locals.user.id,
      username: locals.user.username,
      name: locals.user.name || locals.user.username,
      email: locals.user.username,
      type: userType,
      role: locals.user.role,
      organization_id: locals.user.organization_id,
      customer_id: locals.user.customer_id,
      deviceId: locals.user.deviceId
    },
    sessionId: locals.sessionId
  });
}
