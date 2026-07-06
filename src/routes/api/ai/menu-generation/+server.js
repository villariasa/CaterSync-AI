import { json } from '@sveltejs/kit';
import { mlClient } from '$lib/server/mlClient.js';

export async function POST({ request }) {
  try {
    const { budget, guest_count, theme } = await request.json();
    const result = await mlClient.generateMenu(budget, guest_count, theme);
    return json({ success: true, ...result });
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
