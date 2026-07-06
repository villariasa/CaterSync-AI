import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function POST({ request }) {
  try {
    const { name, contact, allergies, dietary_prefs, preferred_theme } = await request.json();

    if (!name || name.trim() === '') {
      return json({ error: 'Customer name is required' }, { status: 400 });
    }

    try {
      const result = await pool.query(
        `INSERT INTO customers (name, contact, allergies, dietary_prefs, preferred_theme)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          name.trim(),
          contact ? contact.trim() : '',
          allergies || [],
          dietary_prefs || [],
          preferred_theme || null
        ]
      );
      
      console.log('✅ Customer created in DB:', result.rows[0]);
      return json({ success: true, customer: result.rows[0] });
    } catch (dbErr) {
      console.warn('⚠️ DB insert failed. Simulating local insert.');
      const mockCustomer = {
        id: Math.floor(Math.random() * 1000) + 100,
        name: name.trim(),
        contact: contact ? contact.trim() : '',
        allergies: allergies || [],
        dietary_prefs: dietary_prefs || [],
        preferred_theme: preferred_theme || null,
        simulated: true
      };
      return json({ success: true, customer: mockCustomer });
    }
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
