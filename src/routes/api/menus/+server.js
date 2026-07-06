import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM menus ORDER BY id ASC');
    return json(res.rows);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { name, category, cost_per_serving, price_per_serving, cuisine_tags } = await request.json();
    const query = `
      INSERT INTO menus (name, category, cost_per_serving, price_per_serving, cuisine_tags)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await pool.query(query, [name, category, cost_per_serving, price_per_serving, cuisine_tags || []]);
    return json({ success: true, menu: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  try {
    const { id, name, category, cost_per_serving, price_per_serving, cuisine_tags } = await request.json();
    const query = `
      UPDATE menus 
      SET name = $1, category = $2, cost_per_serving = $3, price_per_serving = $4, cuisine_tags = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    const res = await pool.query(query, [name, category, cost_per_serving, price_per_serving, cuisine_tags || [], id]);
    if (res.rows.length === 0) {
      return json({ success: false, error: 'Menu not found' }, { status: 404 });
    }
    return json({ success: true, menu: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    const query = 'DELETE FROM menus WHERE id = $1 RETURNING *';
    const res = await pool.query(query, [id]);
    return json({ success: true, menu: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
