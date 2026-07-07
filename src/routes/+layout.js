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

/** Fetch a JSON endpoint and return parsed body, or null on any failure */
async function safeFetch(fetch, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function load({ fetch }) {
  let usingMockData = false;

  // ── Settings ────────────────────────────────────────────────────────────────
  let settings = MOCK_SETTINGS;
  const settingsData = await safeFetch(fetch, '/api/settings');
  if (settingsData?.success && settingsData.settings) {
    settings = settingsData.settings;
  } else {
    usingMockData = true;
    console.warn('⚠️ Settings API unavailable — using mock settings.');
  }

  // ── Parallel entity fetches ──────────────────────────────────────────────────
  const [custData, evtsData, menusData, ingsData, supsData, staffData] = await Promise.all([
    safeFetch(fetch, '/api/customers'),
    safeFetch(fetch, '/api/events'),
    safeFetch(fetch, '/api/menus'),
    safeFetch(fetch, '/api/ingredients'),
    safeFetch(fetch, '/api/suppliers'),
    safeFetch(fetch, '/api/staff')
  ]);

  // Helper: extract array from response or fall back to mock
  function resolveList(data, key, mock, label) {
    const list = data?.success ? (data[key] ?? (Array.isArray(data) ? data : null)) : null;
    if (!list) {
      usingMockData = true;
      console.warn(`⚠️ ${label} API unavailable — using mock data.`);
      return mock;
    }
    return list;
  }

  const customers    = resolveList(custData,  'customers',   MOCK_CUSTOMERS,   'Customers');
  const events       = resolveList(evtsData,  'events',      MOCK_EVENTS,      'Events');
  const menus        = resolveList(menusData, 'menus',       MOCK_MENUS,       'Menus');
  const ingredients  = resolveList(ingsData,  'ingredients', MOCK_INGREDIENTS, 'Ingredients');
  const suppliers    = resolveList(supsData,  'suppliers',   MOCK_SUPPLIERS,   'Suppliers');
  const staff        = resolveList(staffData, 'staff',       MOCK_STAFF,       'Staff');

  if (usingMockData) {
    console.warn('📦 One or more data sources offline — running in offline simulation mode.');
  }

  return {
    customers,
    events,
    menus,
    ingredients,
    suppliers,
    staff,
    demandForecasts: MOCK_DEMAND,
    settings,
    usingMockData
  };
}

