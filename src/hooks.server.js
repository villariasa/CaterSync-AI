import { json } from '@sveltejs/kit';
import { platformStorage, pool } from '$lib/server/db.js';

export async function handle({ event, resolve }) {
  // Bind Cloudflare context to platform storage for database queries
  return platformStorage.run(event.platform, async () => {
    const sessionAdmin = event.cookies.get('cs_admin_session');
    const sessionOrg = event.cookies.get('cs_org_session') || event.cookies.get('session_user');
    const sessionCustomer = event.cookies.get('cs_customer_session');
    const sessionSupplier = event.cookies.get('cs_supplier_session');

    event.locals.user = null;
    event.locals.tenantId = null;

    if (sessionAdmin) {
      event.locals.user = { username: sessionAdmin, type: 'platform_admin' };
      event.locals.tenantId = null;
    } else if (sessionOrg) {
      try {
        const res = await pool.query('SELECT organization_id, role FROM users WHERE username = $1', [sessionOrg]);
        if (res.rows.length > 0) {
          event.locals.user = {
            username: sessionOrg,
            type: 'org_user',
            organization_id: res.rows[0].organization_id,
            role: res.rows[0].role
          };
          event.locals.tenantId = res.rows[0].organization_id;
        }
      } catch (e) {
        event.locals.user = { username: sessionOrg, type: 'org_user', organization_id: 1, role: 'Admin' };
        event.locals.tenantId = 1;
      }
    } else if (sessionCustomer) {
      try {
        const res = await pool.query('SELECT id, customer_id, email, phone FROM subscriber_accounts WHERE email = $1 OR phone = $1', [sessionCustomer]);
        if (res.rows.length > 0) {
          event.locals.user = {
            username: sessionCustomer,
            type: 'subscriber',
            subscriber_id: res.rows[0].id,
            customer_id: res.rows[0].customer_id
          };
          event.locals.tenantId = null;
        }
      } catch (e) {
        event.locals.user = { username: sessionCustomer, type: 'subscriber', subscriber_id: 1, customer_id: 1 };
        event.locals.tenantId = null;
      }
    } else if (sessionSupplier) {
      try {
        const res = await pool.query('SELECT id, supplier_id, email FROM supplier_accounts WHERE email = $1', [sessionSupplier]);
        if (res.rows.length > 0) {
          event.locals.user = {
            username: sessionSupplier,
            type: 'supplier',
            supplier_account_id: res.rows[0].id,
            supplier_id: res.rows[0].supplier_id
          };
          event.locals.tenantId = null;
        }
      } catch (e) {
        event.locals.user = { username: sessionSupplier, type: 'supplier', supplier_account_id: 1, supplier_id: 1 };
        event.locals.tenantId = null;
      }
    }

    const pathname = event.url.pathname;

    // Protect all non-auth API routes
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
      const isPublicSettingsGet = pathname === '/api/settings' && event.request.method === 'GET';
      if (!isPublicSettingsGet && !event.locals.user) {
        console.warn(`🔒 Unauthorized API access blocked: ${pathname}`);
        return json({ error: 'Unauthorized session access. Please login.' }, { status: 401 });
      }
    }

    return resolve(event);
  });
}


