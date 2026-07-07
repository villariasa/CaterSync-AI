import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request }) {
  try {
    const { name, contact, email, allergies, dietary_prefs, preferred_theme } = await request.json();

    if (!name || name.trim() === '') {
      return json({ error: 'Customer name is required' }, { status: 400 });
    }
    if (!email || email.trim() === '') {
      return json({ error: 'Customer email is required' }, { status: 400 });
    }

    try {
      const result = await pool.query(
        `INSERT INTO customers (name, contact, email, allergies, dietary_prefs, preferred_theme)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          name.trim(),
          contact ? contact.trim() : '',
          email.trim(),
          allergies || [],
          dietary_prefs || [],
          preferred_theme || null
        ]
      );
      
      console.log('✅ Customer created in DB:', result.rows[0]);
      return json({ success: true, customer: result.rows[0] });
    } catch (dbErr) {
      console.error('❌ Database insert failed:', dbErr);
      return json({ error: 'Database write failed: ' + dbErr.message }, { status: 500 });
    }
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
