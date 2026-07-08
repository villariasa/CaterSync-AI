import { json } from '@sveltejs/kit';

export async function POST({ cookies }) {
  cookies.delete('session_user', { path: '/' });
  cookies.delete('cs_admin_session', { path: '/' });
  cookies.delete('cs_org_session', { path: '/' });
  cookies.delete('cs_customer_session', { path: '/' });
  cookies.delete('portal_customer_id', { path: '/' });
  cookies.delete('cs_supplier_session', { path: '/' });
  return json({ success: true });
}
