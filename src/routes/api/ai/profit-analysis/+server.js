import { json } from '@sveltejs/kit';
import { mlClient } from '$lib/server/mlClient.js';

export async function POST({ request }) {
  try {
    const { event_id } = await request.json();
    const result = await mlClient.analyzeProfitAnomaly(event_id);
    return json({ success: true, ...result });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
