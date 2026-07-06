import { pool } from '$lib/server/db.js';

// Comprehensive mock data mirroring seed.sql for resilient standalone execution
const MOCK_CUSTOMERS = Array.from({ length: 55 }, (_, idx) => {
  const i = idx + 1;
  const allergies = i % 7 === 0 ? ['Shellfish'] : (i % 11 === 0 ? ['Peanuts', 'Gluten'] : []);
  const dietary_prefs = i % 5 === 0 ? ['Vegetarian'] : (i % 9 === 0 ? ['No Pork'] : []);
  const themes = ['Modern Elegant', 'Rustic Barn', 'Tropical Luau', 'Corporate Minimalist'];
  return {
    id: i,
    name: `Customer ${i}`,
    contact: `+63 917 123${String(i).padStart(4, '0')}`,
    allergies,
    dietary_prefs,
    preferred_theme: themes[i % 4]
  };
});

const MOCK_INGREDIENTS = [
  { id: 1, name: 'Jasmine Rice', unit: 'kg', current_stock: 150.0, reorder_point: 50.0, shelf_life_days: 365 },
  { id: 2, name: 'Chicken Breast', unit: 'kg', current_stock: 80.0, reorder_point: 30.0, shelf_life_days: 5 },
  { id: 3, name: 'Pork Belly', unit: 'kg', current_stock: 100.0, reorder_point: 40.0, shelf_life_days: 5 },
  { id: 4, name: 'Beef Sirloin', unit: 'kg', current_stock: 60.0, reorder_point: 20.0, shelf_life_days: 5 },
  { id: 5, name: 'Tiger Prawns', unit: 'kg', current_stock: 40.0, reorder_point: 15.0, shelf_life_days: 3 },
  { id: 6, name: 'Salmon Fillet', unit: 'kg', current_stock: 30.0, reorder_point: 10.0, shelf_life_days: 3 },
  { id: 7, name: 'Coconut Milk', unit: 'liter', current_stock: 80.0, reorder_point: 20.0, shelf_life_days: 90 },
  { id: 8, name: 'Soy Sauce', unit: 'liter', current_stock: 40.0, reorder_point: 10.0, shelf_life_days: 365 },
  { id: 15, name: 'Broccoli', unit: 'kg', current_stock: 30.0, reorder_point: 10.0, shelf_life_days: 7 },
  { id: 16, name: 'Tofu', unit: 'kg', current_stock: 20.0, reorder_point: 8.0, shelf_life_days: 5 }
];

const MOCK_SUPPLIERS = [
  { id: 1, name: 'Metro Meat Distributors', reliability_score: 0.95, avg_lead_time_days: 2 },
  { id: 2, name: 'Fresh Catch Seafood', reliability_score: 0.88, avg_lead_time_days: 1 },
  { id: 3, name: 'GreenGrocer Veggies', reliability_score: 0.92, avg_lead_time_days: 1 },
  { id: 4, name: 'Assorted Dry Goods Inc.', reliability_score: 0.98, avg_lead_time_days: 3 }
];

const MOCK_MENUS = [
  { id: 1, name: 'Classic Filipino Feast', category: 'Traditional', cost_per_serving: 180.0, price_per_serving: 450.0, cuisine_tags: ['filipino', 'comfort-food', 'pork'] },
  { id: 2, name: 'Premium Seafood Buffet', category: 'Seafood', cost_per_serving: 320.0, price_per_serving: 750.0, cuisine_tags: ['seafood', 'premium', 'salmon'] },
  { id: 3, name: 'Vegan Garden Delight', category: 'Vegetarian', cost_per_serving: 120.0, price_per_serving: 350.0, cuisine_tags: ['vegan', 'healthy', 'tofu'] },
  { id: 4, name: 'Corporate Express Luncheon', category: 'Corporate', cost_per_serving: 150.0, price_per_serving: 400.0, cuisine_tags: ['chicken', 'beef', 'lunch'] }
];

const MOCK_STAFF = [
  { id: 1, name: 'Juan Cruz', role: 'Chef', hourly_rate: 350.0, max_hours_per_week: 48 },
  { id: 2, name: 'Maria Santos', role: 'Chef', hourly_rate: 320.0, max_hours_per_week: 48 },
  { id: 3, name: 'Pedro Gomez', role: 'Sous Chef', hourly_rate: 250.0, max_hours_per_week: 48 },
  { id: 5, name: 'Mark Mendoza', role: 'Coordinator', hourly_rate: 220.0, max_hours_per_week: 40 },
  { id: 7, name: 'David Sy', role: 'Bartender', hourly_rate: 180.0, max_hours_per_week: 30 },
  { id: 9, name: 'James Lao', role: 'Server', hourly_rate: 150.0, max_hours_per_week: 30 }
];

const MOCK_EVENTS = Array.from({ length: 30 }, (_, idx) => {
  const i = idx + 1;
  const types = ['Wedding', 'Corporate Seminar', 'Birthday Party', 'Social Gathering'];
  const themes = ['Modern Elegant', 'Rustic Barn', 'Tropical Luau', 'Corporate Minimalist'];
  const statuses = ['Completed', 'Confirmed', 'Draft'];
  
  // Dates ranging from past 40 days to future 20 days
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + (i - 20) * 3);

  return {
    id: i,
    customer_id: (i % 15) + 1,
    customer_name: `Customer ${(i % 15) + 1}`,
    event_type: types[i % 4],
    guest_count: 50 + (i * 8) % 200,
    event_date: eventDate.toISOString(),
    budget: 25000 + (i * 5000) % 100000,
    theme: themes[i % 4],
    status: i <= 15 ? 'Completed' : (i <= 25 ? 'Confirmed' : 'Draft'),
    venue_type: i % 2 === 0 ? 'Indoor Ballroom' : 'Garden Resort',
    is_outdoor: i % 3 === 0
  };
});

const MOCK_DEMAND = Array.from({ length: 12 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay() + 1 + i * 7); // Start of week
  return {
    week_start: date.toISOString().split('T')[0],
    predicted_bookings: (2 + Math.sin(i / 1.5) + Math.random() * 2).toFixed(1),
    predicted_revenue: (75000 + Math.sin(i / 1.5) * 40000 + Math.random() * 30000).toFixed(2),
    model_version: 'prophet_v1.0'
  };
});

export async function load() {
  try {
    console.log('🔌 Layout Server: Fetching configuration settings...');
    
    // Load config settings first
    let settings = {
      business_name: 'CaterSync-AI Operations',
      currency_symbol: '₱',
      overhead_rate: 0.12,
      min_budget_per_guest: 150.00,
      risk_medium_threshold: 0.35,
      risk_high_threshold: 0.60,
      low_stock_alerts_enabled: true,
      sound_enabled_default: false
    };

    try {
      const settingsQuery = await pool.query('SELECT * FROM business_settings WHERE id = 1');
      if (settingsQuery.rows.length > 0) {
        settings = settingsQuery.rows[0];
      }
    } catch (e) {
      console.warn('⚠️ Layout Server: business_settings read skipped (table might be initializing)');
    }

    console.log('🔌 Layout Server: Fetching CaterSync-AI data from database...');
    
    const customersQuery = await pool.query('SELECT * FROM customers ORDER BY id ASC LIMIT 100');
    const eventsQuery = await pool.query(`
      SELECT e.*, c.name as customer_name 
      FROM events e 
      JOIN customers c ON e.customer_id = c.id 
      ORDER BY e.event_date DESC LIMIT 100
    `);
    const menusQuery = await pool.query('SELECT * FROM menus ORDER BY id ASC');
    const ingredientsQuery = await pool.query('SELECT * FROM ingredients ORDER BY name ASC');
    const suppliersQuery = await pool.query('SELECT * FROM suppliers ORDER BY id ASC');
    const staffQuery = await pool.query('SELECT * FROM staff ORDER BY id ASC');
    const demandQuery = await pool.query('SELECT * FROM demand_forecasts ORDER BY week_start ASC');

    console.log('✅ Layout Server: Successfully fetched data from PostgreSQL.');

    return {
      customers: customersQuery.rows,
      events: eventsQuery.rows,
      menus: menusQuery.rows,
      ingredients: ingredientsQuery.rows,
      suppliers: suppliersQuery.rows,
      staff: staffQuery.rows,
      demandForecasts: demandQuery.rows,
      settings,
      usingMockData: false
    };
  } catch (error) {
    console.warn('⚠️ Layout Server: PostgreSQL connection failed. Falling back to Mock Data.');
    console.error(error.message);

    return {
      customers: MOCK_CUSTOMERS,
      events: MOCK_EVENTS,
      menus: MOCK_MENUS,
      ingredients: MOCK_INGREDIENTS,
      suppliers: MOCK_SUPPLIERS,
      staff: MOCK_STAFF,
      demandForecasts: MOCK_DEMAND,
      settings: {
        business_name: 'CaterSync Mock Simulation',
        currency_symbol: '₱',
        overhead_rate: 0.12,
        min_budget_per_guest: 150.00,
        risk_medium_threshold: 0.35,
        risk_high_threshold: 0.60,
        low_stock_alerts_enabled: true,
        sound_enabled_default: false
      },
      usingMockData: true
    };
  }
}
