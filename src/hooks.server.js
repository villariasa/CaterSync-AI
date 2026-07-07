import { json } from '@sveltejs/kit';
import { platformStorage } from '$lib/server/db.js';

export async function handle({ event, resolve }) {
  const sessionUser = event.cookies.get('session_user');

  // Expose user session to locals
  event.locals.user = sessionUser ? { username: sessionUser } : null;

  const pathname = event.url.pathname;

  // Protect all non-auth API routes
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const isPublicSettingsGet = pathname === '/api/settings' && event.request.method === 'GET';
    if (!isPublicSettingsGet && !sessionUser) {
      console.warn(`🔒 Unauthorized API access blocked: ${pathname}`);
      return json({ error: 'Unauthorized session access. Please login.' }, { status: 401 });
    }
  }

  // Bind Cloudflare context to platform storage for database queries
  return platformStorage.run(event.platform, () => {
    return resolve(event);
  });
}

