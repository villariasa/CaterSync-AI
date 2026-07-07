import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request }) {
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
      
      console.log('✅ Event created in DB:', result.rows[0]);
      return json({ success: true, event: result.rows[0] });
    } catch (dbErr) {
      console.error('❌ Database insert failed:', dbErr);
      return json({ error: 'Database write failed: ' + dbErr.message }, { status: 500 });
    }
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
