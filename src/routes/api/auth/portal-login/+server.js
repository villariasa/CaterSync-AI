import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request, cookies }) {
  try {
    const { contact } = await request.json();

    if (!contact || contact.trim() === '') {
      return json({ error: 'Contact detail is required' }, { status: 400 });
    }

    // Query customer and their most recent event
    const res = await pool.query(
      `SELECT c.id AS customer_id, c.name AS customer_name, c.contact, 
              e.id AS event_id, e.event_type, e.guest_count, e.event_date, 
              e.budget, e.theme, e.status, e.venue_type, e.is_outdoor 
       FROM customers c 
       LEFT JOIN events e ON e.customer_id = c.id 
       WHERE LOWER(c.contact) = $1 OR LOWER(c.name) = $1 OR LOWER(c.email) = $1
       ORDER BY e.event_date DESC LIMIT 1`,
      [contact.trim().toLowerCase()]
    );

    if (res.rows.length === 0) {
      return json({ error: 'No customer profile found matching this identifier' }, { status: 404 });
    }

    const row = res.rows[0];

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
        contact: row.contact
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
  } catch (err) {
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connection')) {
      return json({ offlineFallback: true, error: 'Database service is offline. Falling back to local offline simulation.' }, { status: 503 });
    }
    return json({ error: err.message }, { status: 500 });
  }
}
