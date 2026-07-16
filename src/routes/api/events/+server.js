import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { emitWsEvent } from '$lib/server/wsEmit.js';

export async function POST({ request, locals }) {
  try {
    const { customer_id, event_type, guest_count, event_date, budget, theme, venue_type, is_outdoor } = await request.json();

    if (!customer_id || !event_type || !guest_count || !event_date || !budget || !theme || !venue_type) {
      return json({ error: 'All event details are required' }, { status: 400 });
    }

    try {
      const result = await pool.query(
        `INSERT INTO events (customer_id, event_type, guest_count, event_date, budget, theme, venue_type, is_outdoor, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Confirmed')
         RETURNING *`,
        [
          parseInt(customer_id),
          event_type,
          parseInt(guest_count),
          new Date(event_date),
          parseFloat(budget),
          theme,
          venue_type,
          is_outdoor === true
        ]
      );

      const newEvent = result.rows[0];
      console.log('✅ Event created in DB:', newEvent);

      // Emit real-time WebSocket event (fire-and-forget)
      const organizationId = locals?.tenantId || locals?.user?.organization_id || 1;
      emitWsEvent('booking.created', {
        bookingId: newEvent.id,
        organizationId,
        clientName: newEvent.client || theme,
        status: newEvent.status,
        eventDate: newEvent.event_date
      });

      return json({ success: true, event: newEvent });
    } catch (dbErr) {
      console.error('❌ Database insert failed:', dbErr);
      return json({ error: 'Database write failed: ' + dbErr.message }, { status: 500 });
    }
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}


export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM events ORDER BY event_date DESC');
    return json({ success: true, events: res.rows });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
