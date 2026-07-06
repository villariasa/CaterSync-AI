import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM business_settings WHERE id = 1');
    if (res.rows.length === 0) {
      // Return default configuration if database is empty/mock
      return json({
        business_name: 'CaterSync-AI Operations',
        currency_symbol: '₱',
        overhead_rate: 0.12,
        min_budget_per_guest: 150.00,
        risk_medium_threshold: 0.35,
        risk_high_threshold: 0.60,
        low_stock_alerts_enabled: true,
        sound_enabled_default: false
      });
    }
    return json(res.rows[0]);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const {
      business_name,
      currency_symbol,
      overhead_rate,
      min_budget_per_guest,
      risk_medium_threshold,
      risk_high_threshold,
      low_stock_alerts_enabled,
      sound_enabled_default
    } = body;

    const query = `
      INSERT INTO business_settings (
        id, business_name, currency_symbol, overhead_rate, min_budget_per_guest,
        risk_medium_threshold, risk_high_threshold, low_stock_alerts_enabled, sound_enabled_default
      ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        currency_symbol = EXCLUDED.currency_symbol,
        overhead_rate = EXCLUDED.overhead_rate,
        min_budget_per_guest = EXCLUDED.min_budget_per_guest,
        risk_medium_threshold = EXCLUDED.risk_medium_threshold,
        risk_high_threshold = EXCLUDED.risk_high_threshold,
        low_stock_alerts_enabled = EXCLUDED.low_stock_alerts_enabled,
        sound_enabled_default = EXCLUDED.sound_enabled_default,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const res = await pool.query(query, [
      business_name,
      currency_symbol,
      overhead_rate,
      min_budget_per_guest,
      risk_medium_threshold,
      risk_high_threshold,
      low_stock_alerts_enabled,
      sound_enabled_default
    ]);

    return json({ success: true, settings: res.rows[0] });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
