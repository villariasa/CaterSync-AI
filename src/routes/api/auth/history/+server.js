/**
 * GET /api/auth/history
 * Returns the login history for the current authenticated user.
 */

import { json } from '@sveltejs/kit';
import { getLoginHistory } from '$lib/server/auth/audit.js';

export async function GET({ locals, url }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const history = await getLoginHistory(locals.user.id, locals.user.type, limit);

  return json({ success: true, history });
}
