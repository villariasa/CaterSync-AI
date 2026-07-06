import { json } from '@sveltejs/kit';
import { mlClient } from '$lib/server/mlClient.js';

export async function POST({ request }) {
  try {
    const { event_id, dish_id, guest_count } = await request.json();
    const result = await mlClient.predictFoodQuantity(event_id, dish_id, guest_count);
    return json({ success: true, ...result });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
