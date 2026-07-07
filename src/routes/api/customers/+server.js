import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    return json({ success: true, customers: res.rows });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

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

export async function PATCH({ request }) {
  try {
    const { id, name, contact, email, allergies, dietary_prefs, preferred_theme } = await request.json();
    const query = `
      UPDATE customers 
      SET name = $1, contact = $2, email = $3, allergies = $4, dietary_prefs = $5, preferred_theme = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;
    const res = await pool.query(query, [name, contact, email, allergies, dietary_prefs, preferred_theme, id]);
    if (res.rows.length === 0) {
      return json({ success: false, error: 'Customer profile not found' }, { status: 404 });
    }
    return json({ success: true, customer: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    const res = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    if (res.rows.length === 0) {
      return json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    return json({ success: true, customer: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
