import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM staff ORDER BY id ASC');
    return json({ success: true, staff: res.rows });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { name, role, hourly_rate, max_hours_per_week } = await request.json();
    const query = `
      INSERT INTO staff (name, role, hourly_rate, max_hours_per_week, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `;
    const res = await pool.query(query, [name, role, hourly_rate, max_hours_per_week]);
    return json({ success: true, staff: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  try {
    const { id, name, role, hourly_rate, max_hours_per_week, is_active } = await request.json();
    const query = `
      UPDATE staff 
      SET name = $1, role = $2, hourly_rate = $3, max_hours_per_week = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    const res = await pool.query(query, [name, role, hourly_rate, max_hours_per_week, is_active, id]);
    if (res.rows.length === 0) {
      return json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }
    return json({ success: true, staff: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    // Deactivate instead of deleting to keep historical integrity intact
    const query = `
      UPDATE staff
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const res = await pool.query(query, [id]);
    return json({ success: true, staff: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
