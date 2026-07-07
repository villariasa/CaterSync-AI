import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

// Decode Google JWT Identity Token without external libraries
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(payloadB64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT decoding failed:", e);
    return null;
  }
}

export async function POST({ request, cookies }) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return json({ success: false, error: 'Google credential token is missing.' }, { status: 400 });
    }

    const payload = decodeJwt(credential);
    if (!payload || !payload.email) {
      return json({ success: false, error: 'Invalid Google identity token.' }, { status: 400 });
    }

    const email = payload.email.trim().toLowerCase();
    const name = payload.name || payload.given_name || email.split('@')[0];

    // 1. Locate or auto-create Customer profile
    let customerId = null;
    let customerRes = await pool.query(
      'SELECT id, name, contact FROM customers WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (customerRes.rows.length > 0) {
      customerId = customerRes.rows[0].id;
    } else {
      // Auto-create customer profile
      const insertCustomerRes = await pool.query(
        'INSERT INTO customers (name, contact, email) VALUES ($1, $2, $3) RETURNING id',
        [name, email, email]
      );
      customerId = insertCustomerRes.rows[0].id;
    }

    // 2. Locate or auto-create Subscriber account
    let subRes = await pool.query(
      'SELECT id, status FROM subscriber_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (subRes.rows.length === 0) {
      // Auto-create subscriber account
      await pool.query(
        'INSERT INTO subscriber_accounts (customer_id, email, status, email_verified_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [customerId, email, 'active']
      );
    } else if (subRes.rows[0].status !== 'active') {
      // Reactivate if pending/inactive
      await pool.query(
        "UPDATE subscriber_accounts SET status = 'active', email_verified_at = CURRENT_TIMESTAMP WHERE LOWER(email) = $1",
        [email]
      );
    }

    // 3. Query customer details and their most recent event
    const finalRes = await pool.query(
      `SELECT c.id AS customer_id, c.name AS customer_name, c.contact, 
              e.id AS event_id, e.event_type, e.guest_count, e.event_date, 
              e.budget, e.theme, e.status, e.venue_type, e.is_outdoor 
       FROM customers c 
       LEFT JOIN events e ON e.customer_id = c.id 
       WHERE c.id = $1
       ORDER BY e.event_date DESC LIMIT 1`,
      [customerId]
    );

    if (finalRes.rows.length === 0) {
      return json({ success: false, error: 'Account matching failed.' }, { status: 500 });
    }

    const row = finalRes.rows[0];

    // Set portal session cookie
    cookies.set('portal_customer_id', row.customer_id.toString(), {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 6 // 6 hours
    });

    return json({
      success: true,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        contact: row.contact,
        email: email
      },
      event: row.event_id ? {
        id: row.event_id,
        event_type: row.event_type,
        guest_count: row.guest_count,
        event_date: row.event_date,
        budget: row.budget,
        theme: row.theme,
        status: row.status,
        venue_type: row.venue_type,
        is_outdoor: row.is_outdoor
      } : null
    });
  } catch (error) {
    console.error('Google login error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
