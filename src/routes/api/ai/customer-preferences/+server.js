import { json } from '@sveltejs/kit';
import { mlClient } from '$lib/server/mlClient.js';

export async function POST({ request }) {
  try {
    const { customer_id } = await request.json();
    const result = await mlClient.recommendCustomerPreferences(customer_id);
    return json({ success: true, recommendations: result });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
