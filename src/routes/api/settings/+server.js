import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET({ locals }) {
  try {
    const res = await pool.query('SELECT * FROM business_settings WHERE id = 1');
    const settings = res.rows.length > 0 ? res.rows[0] : {
      business_name: 'CaterSync-AI Operations',
      currency_symbol: '₱',
      overhead_rate: 0.12,
      min_budget_per_guest: 150.00,
      risk_medium_threshold: 0.35,
      risk_high_threshold: 0.60,
      low_stock_alerts_enabled: true,
      sound_enabled_default: false,
      gmail_address: null,
      gmail_app_password: null,
      smtp_host: 'smtp.gmail.com',
      smtp_port: 465,
      google_client_id: null
    };

    const googleClientId = settings.google_client_id || '';

    // If user is not authenticated (anonymous user requesting from Landing Page), strip sensitive credentials!
    if (!locals.user) {
      return json({
        success: true,
        settings: {
          business_name: settings.business_name || 'CaterSync',
          currency_symbol: settings.currency_symbol || '₱',
          googleClientId: googleClientId
        }
      });
    }

    // Format for authenticated frontend
    settings.emailConfig = {
      gmailAddress: settings.gmail_address || '',
      gmailAppPassword: settings.gmail_app_password || '',
      smtpHost: settings.smtp_host || 'smtp.gmail.com',
      smtpPort: settings.smtp_port || 465
    };
    settings.googleClientId = googleClientId;

    return json({ success: true, settings });
  } catch (error) {
    // Return 503 so layout loader knows to fall back to offline mock mode
    return json({ success: false, error: error.message }, { status: 503 });
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
      sound_enabled_default,
      emailConfig,
      googleClientId
    } = body;

    const query = `
      INSERT INTO business_settings (
        id, business_name, currency_symbol, overhead_rate, min_budget_per_guest,
        risk_medium_threshold, risk_high_threshold, low_stock_alerts_enabled, sound_enabled_default,
        gmail_address, gmail_app_password, smtp_host, smtp_port, google_client_id
      ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        currency_symbol = EXCLUDED.currency_symbol,
        overhead_rate = EXCLUDED.overhead_rate,
        min_budget_per_guest = EXCLUDED.min_budget_per_guest,
        risk_medium_threshold = EXCLUDED.risk_medium_threshold,
        risk_high_threshold = EXCLUDED.risk_high_threshold,
        low_stock_alerts_enabled = EXCLUDED.low_stock_alerts_enabled,
        sound_enabled_default = EXCLUDED.sound_enabled_default,
        gmail_address = EXCLUDED.gmail_address,
        gmail_app_password = EXCLUDED.gmail_app_password,
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        google_client_id = EXCLUDED.google_client_id,
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
      sound_enabled_default,
      emailConfig?.gmailAddress || null,
      emailConfig?.gmailAppPassword || null,
      emailConfig?.smtpHost || null,
      emailConfig?.smtpPort ? parseInt(emailConfig.smtpPort) : null,
      googleClientId || null
    ]);

    const settings = res.rows[0];
    settings.emailConfig = {
      gmailAddress: settings.gmail_address || '',
      gmailAppPassword: settings.gmail_app_password || '',
      smtpHost: settings.smtp_host || 'smtp.gmail.com',
      smtpPort: settings.smtp_port || 465
    };
    settings.googleClientId = settings.google_client_id || '';

    return json({ success: true, settings });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
