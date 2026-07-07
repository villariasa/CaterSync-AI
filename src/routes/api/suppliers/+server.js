import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM suppliers ORDER BY id ASC');
    return json({ success: true, suppliers: res.rows });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { name, reliability_score, avg_lead_time_days } = await request.json();
    const query = `
      INSERT INTO suppliers (name, reliability_score, avg_lead_time_days)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await pool.query(query, [name, reliability_score, avg_lead_time_days]);
    return json({ success: true, supplier: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  try {
    const { id, name, reliability_score, avg_lead_time_days } = await request.json();
    const query = `
      UPDATE suppliers 
      SET name = $1, reliability_score = $2, avg_lead_time_days = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const res = await pool.query(query, [name, reliability_score, avg_lead_time_days, id]);
    if (res.rows.length === 0) {
      return json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }
    return json({ success: true, supplier: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    const query = 'DELETE FROM suppliers WHERE id = $1 RETURNING *';
    const res = await pool.query(query, [id]);
    return json({ success: true, supplier: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
