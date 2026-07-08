import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET({ cookies }) {
  try {
    const customerId = cookies.get('portal_customer_id');
    if (!customerId) {
      return json({ success: false, error: 'No active session' });
    }

    // Query customer and their most recent event
    const res = await pool.query(
      `SELECT c.id AS customer_id, c.name AS customer_name, c.contact, c.email,
              e.id AS event_id, e.event_type, e.guest_count, e.event_date, 
              e.budget, e.theme, e.status, e.venue_type, e.is_outdoor 
       FROM customers c 
       LEFT JOIN events e ON e.customer_id = c.id 
       WHERE c.id = $1
       ORDER BY e.event_date DESC LIMIT 1`,
      [parseInt(customerId, 10)]
    );

    if (res.rows.length === 0) {
      return json({ success: false, error: 'No customer profile found' });
    }

    const row = res.rows[0];

    return json({
      success: true,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        contact: row.contact,
        email: row.email
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
    if (err.message.includes('database connection') || err.message.includes('ECONNREFUSED') || err.message.includes('connection')) {
      // Local offline fallback
      const offlineId = cookies.get('portal_customer_id') || '101';
      return json({
        success: true,
        offlineFallback: true,
        customer: {
          id: parseInt(offlineId, 10),
          name: 'Offline Customer',
          contact: 'customer@example.com',
          email: 'customer@example.com'
        },
        event: {
          id: 505,
          event_type: 'Birthday Celebration',
          guest_count: 120,
          event_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
          budget: 85000,
          theme: 'Modern Rustic',
          status: 'Confirmed',
          venue_type: 'Al Fresco Deck',
          is_outdoor: true
        }
      });
    }
    return json({ success: false, error: err.message });
  }
}

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
