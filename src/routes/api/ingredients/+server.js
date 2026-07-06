import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM ingredients ORDER BY name ASC');
    return json(res.rows);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { name, unit, current_stock, reorder_point, shelf_life_days } = await request.json();
    const query = `
      INSERT INTO ingredients (name, unit, current_stock, reorder_point, shelf_life_days)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await pool.query(query, [name, unit, current_stock, reorder_point, shelf_life_days]);
    return json({ success: true, ingredient: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  try {
    const { id, name, unit, current_stock, reorder_point, shelf_life_days } = await request.json();
    const query = `
      UPDATE ingredients 
      SET name = $1, unit = $2, current_stock = $3, reorder_point = $4, shelf_life_days = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    const res = await pool.query(query, [name, unit, current_stock, reorder_point, shelf_life_days, id]);
    if (res.rows.length === 0) {
      return json({ success: false, error: 'Ingredient not found' }, { status: 404 });
    }
    return json({ success: true, ingredient: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    const query = 'DELETE FROM ingredients WHERE id = $1 RETURNING *';
    const res = await pool.query(query, [id]);
    return json({ success: true, ingredient: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
