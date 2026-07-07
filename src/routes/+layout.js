import { 
  MOCK_CUSTOMERS,
  MOCK_EVENTS,
  MOCK_MENUS,
  MOCK_INGREDIENTS,
  MOCK_SUPPLIERS,
  MOCK_STAFF,
  MOCK_DEMAND,
  MOCK_SETTINGS
} from '$lib/mockData.js';

export const ssr = false;
export const prerender = false;

export async function load({ fetch }) {
  try {
    // Try to fetch settings from REST API first
    const settingsRes = await fetch('/api/settings');
    const contentType = settingsRes.headers.get('content-type');
    
    // If static host returns index.html fallback, content-type contains text/html (or is not JSON)
    if (!settingsRes.ok || !contentType || !contentType.includes('application/json')) {
      throw new Error('Backend REST APIs unreachable (Static Host Fallback)');
    }
    
    const settingsData = await settingsRes.json();
    if (!settingsData.success) {
      throw new Error('Settings API query failed');
    }

    // Parallel fetch of other entities
    const [custRes, evtsRes, menusRes, ingsRes, supsRes, staffRes] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/events'),
      fetch('/api/menus'),
      fetch('/api/ingredients'),
      fetch('/api/suppliers'),
      fetch('/api/staff')
    ]);

    if (!custRes.ok || !evtsRes.ok || !menusRes.ok || !ingsRes.ok || !supsRes.ok || !staffRes.ok) {
      throw new Error('Database REST API returned non-200 response (Database Offline)');
    }

    const [cust, evts, menus, ings, sups, staff] = await Promise.all([
      custRes.json(),
      evtsRes.json(),
      menusRes.json(),
      ingsRes.json(),
      supsRes.json(),
      staffRes.json()
    ]);

    return {
      customers: Array.isArray(cust) ? cust : (cust.customers || []),
      events: Array.isArray(evts) ? evts : (evts.events || []),
      menus: Array.isArray(menus) ? menus : (menus.menus || []),
      ingredients: Array.isArray(ings) ? ings : (ings.ingredients || []),
      suppliers: Array.isArray(sups) ? sups : (sups.suppliers || []),
      staff: Array.isArray(staff) ? staff : (staff.staff || []),
      demandForecasts: MOCK_DEMAND,
      settings: settingsData.settings,
      usingMockData: false
    };
  } catch (err) {
    console.warn('⚠️ Client-side load: PostgreSQL endpoints unreachable. Fallback to offline simulation mode:', err.message);
    return {
      customers: MOCK_CUSTOMERS,
      events: MOCK_EVENTS,
      menus: MOCK_MENUS,
      ingredients: MOCK_INGREDIENTS,
      suppliers: MOCK_SUPPLIERS,
      staff: MOCK_STAFF,
      demandForecasts: MOCK_DEMAND,
      settings: MOCK_SETTINGS,
      usingMockData: true
    };
  }
}
