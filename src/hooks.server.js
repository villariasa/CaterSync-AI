import { json } from '@sveltejs/kit';
import { platformStorage, pool } from '$lib/server/db.js';
import { validateAccessToken, refreshSession } from '$lib/server/auth/session.js';
import { setAuthCookies, clearAuthCookies } from '$lib/server/auth/tokens.js';

export async function handle({ event, resolve }) {
  return platformStorage.run(event.platform, async () => {
    const pathname = event.url.pathname;

    // Initialize locals
    event.locals.user = null;
    event.locals.tenantId = null;
    event.locals.sessionId = null;

    // ================================================================
    // 1. NEW TOKEN-BASED SESSION VALIDATION
    //    Try access token first, then silent refresh via refresh token.
    // ================================================================
    const accessToken = event.cookies.get('cs_access_token');
    const refreshToken = event.cookies.get('cs_refresh_token');

    if (accessToken) {
      const session = await validateAccessToken(accessToken);
      if (session) {
        await attachUserFromSession(event, session);
      }
    }

    // If access token failed but we have a refresh token — silent refresh
    if (!event.locals.user && refreshToken) {
      const ipAddress = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
        || event.request.headers.get('cf-connecting-ip') 
        || null;

      const refreshResult = await refreshSession(refreshToken, ipAddress);
      if (refreshResult) {
        const { accessToken: newAccess, refreshToken: newRefresh, session } = refreshResult;
        // Check if device is trusted (for cookie lifetime)
        const isTrusted = session.device_id ? true : false;
        setAuthCookies(event.cookies, newAccess, newRefresh, isTrusted);
        await attachUserFromSession(event, session);
      } else {
        // Refresh token is invalid/expired — clear all cookies
        clearAuthCookies(event.cookies);
      }
    }

    // ================================================================
    // 2. LEGACY SESSION FALLBACK
    //    Support old cookie-based sessions during migration period.
    //    These will be phased out as users re-login with new token system.
    // ================================================================
    if (!event.locals.user) {
      await legacySessionFallback(event);
    }

    // ================================================================
    // 3. API ROUTE PROTECTION
    //    All /api/ routes require authentication except /api/auth/*
    //    and the public settings GET endpoint.
    // ================================================================
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

/**
 * Populate event.locals from a resolved session object.
 */
async function attachUserFromSession(event, session) {
  const { user_id, user_role, device_id } = session;

  event.locals.sessionId = session.id;

  try {
    if (user_role === 'platform_admin') {
      const res = await pool.query(
        'SELECT id, username, email, permission_level FROM platform_admins WHERE id = $1 AND is_active = TRUE LIMIT 1',
        [user_id]
      );
      if (res.rows.length > 0) {
        event.locals.user = { 
          id: user_id, 
          username: res.rows[0].username, 
          type: 'platform_admin',
          role: res.rows[0].permission_level,
          deviceId: device_id
        };
        event.locals.tenantId = null;
      }
    } else if (user_role === 'org_user') {
      const res = await pool.query(
        'SELECT id, username, organization_id, role FROM users WHERE id = $1 AND is_active = TRUE LIMIT 1',
        [user_id]
      );
      if (res.rows.length > 0) {
        event.locals.user = {
          id: user_id,
          username: res.rows[0].username,
          type: 'org_user',
          role: res.rows[0].role,
          organization_id: res.rows[0].organization_id,
          deviceId: device_id
        };
        event.locals.tenantId = res.rows[0].organization_id;
      }
    } else if (user_role === 'subscriber') {
      const res = await pool.query(
        `SELECT sa.id, sa.email, sa.customer_id, c.name 
         FROM subscriber_accounts sa
         LEFT JOIN customers c ON c.id = sa.customer_id
         WHERE sa.id = $1 AND sa.status = 'active' LIMIT 1`,
        [user_id]
      );
      if (res.rows.length > 0) {
        event.locals.user = {
          id: user_id,
          username: res.rows[0].email,
          type: 'subscriber',
          subscriber_id: res.rows[0].id,
          customer_id: res.rows[0].customer_id,
          name: res.rows[0].name,
          deviceId: device_id
        };
        event.locals.tenantId = null;
      }
    } else if (user_role === 'supplier') {
      const res = await pool.query(
        'SELECT id, email, supplier_id FROM supplier_accounts WHERE id = $1 AND is_active = TRUE LIMIT 1',
        [user_id]
      );
      if (res.rows.length > 0) {
        event.locals.user = {
          id: user_id,
          username: res.rows[0].email,
          type: 'supplier',
          supplier_account_id: res.rows[0].id,
          supplier_id: res.rows[0].supplier_id,
          deviceId: device_id
        };
        event.locals.tenantId = null;
      }
    }
  } catch (e) {
    console.error('[hooks] attachUserFromSession error:', e.message);
  }
}

/**
 * Legacy session fallback — supports old username-cookie sessions during migration.
 * Removed once all users have re-authenticated with the new token system.
 */
async function legacySessionFallback(event) {
  const sessionAdmin = event.cookies.get('cs_admin_session');
  const sessionOrg = event.cookies.get('cs_org_session') || event.cookies.get('session_user');
  const sessionCustomer = event.cookies.get('cs_customer_session') || event.cookies.get('portal_customer_id');
  const sessionSupplier = event.cookies.get('cs_supplier_session');

  if (sessionAdmin) {
    event.locals.user = { username: sessionAdmin, type: 'platform_admin' };
    event.locals.tenantId = null;
  } else if (sessionOrg) {
    try {
      const res = await pool.query('SELECT id, organization_id, role FROM users WHERE LOWER(username) = LOWER($1)', [sessionOrg]);
      if (res.rows.length > 0) {
        event.locals.user = {
          id: res.rows[0].id,
          username: sessionOrg,
          type: 'org_user',
          organization_id: res.rows[0].organization_id,
          role: res.rows[0].role
        };
        event.locals.tenantId = res.rows[0].organization_id;
      }
    } catch {
      event.locals.user = { username: sessionOrg, type: 'org_user', organization_id: 1, role: 'Admin' };
      event.locals.tenantId = 1;
    }
  } else if (sessionCustomer) {
    try {
      const isNumeric = /^\d+$/.test(sessionCustomer);
      const queryStr = isNumeric
        ? 'SELECT id, id as customer_id, email FROM customers WHERE id = $1'
        : 'SELECT id, customer_id, email FROM subscriber_accounts WHERE LOWER(email) = LOWER($1)';
      const res = await pool.query(queryStr, [isNumeric ? parseInt(sessionCustomer, 10) : sessionCustomer]);
      if (res.rows.length > 0) {
        event.locals.user = {
          username: res.rows[0].email || sessionCustomer,
          type: 'subscriber',
          subscriber_id: res.rows[0].id,
          customer_id: res.rows[0].customer_id
        };
      }
    } catch {
      event.locals.user = { username: sessionCustomer, type: 'subscriber', subscriber_id: 1, customer_id: 1 };
    }
  } else if (sessionSupplier) {
    try {
      const res = await pool.query('SELECT id, supplier_id FROM supplier_accounts WHERE LOWER(email) = LOWER($1)', [sessionSupplier]);
      if (res.rows.length > 0) {
        event.locals.user = {
          username: sessionSupplier,
          type: 'supplier',
          supplier_account_id: res.rows[0].id,
          supplier_id: res.rows[0].supplier_id
        };
      }
    } catch {
      event.locals.user = { username: sessionSupplier, type: 'supplier', supplier_account_id: 1, supplier_id: 1 };
    }
  }
}
