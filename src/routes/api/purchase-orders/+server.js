import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET() {
  try {
    const res = await pool.query(`
      SELECT po.*, s.name as supplier_name, i.name as ingredient_name 
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN ingredients i ON po.ingredient_id = i.id
      ORDER BY po.order_date DESC
    `);
    return json(res.rows);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { supplier_id, ingredient_id, quantity, cost } = await request.json();
    const query = `
      INSERT INTO purchase_orders (supplier_id, ingredient_id, quantity, cost, status)
      VALUES ($1, $2, $3, $4, 'Ordered')
      RETURNING *
    `;
    const res = await pool.query(query, [supplier_id, ingredient_id, quantity, cost]);
    
    // Also trigger update on ingredient stock count
    await pool.query(`
      UPDATE ingredients 
      SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [quantity, ingredient_id]);

    return json({ success: true, order: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
