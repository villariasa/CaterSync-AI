import { json } from '@sveltejs/kit';
import { mlClient } from '$lib/server/mlClient.js';

export async function GET() {
  try {
    const result = await mlClient.fetchSalesForecast();
    return json({ success: true, forecasts: result });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
