import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputSchemaPath = path.join(__dirname, 'schema.sql');
const outputSchemaPath = path.resolve(__dirname, '../schema.sql');
const outputSeedPath = path.resolve(__dirname, '../seed.sql');

function convertSchema() {
  console.log('Converting schema...');
  let sql = fs.readFileSync(inputSchemaPath, 'utf-8');

  // 1. Remove Postgres extension creation
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS[\s\S]*?;/g, '');

  // 2. Remove update_timestamp function
  sql = sql.replace(/CREATE OR REPLACE FUNCTION update_timestamp\(\)[\s\S]*?LANGUAGE plpgsql;/g, '');

  // 3. Convert serials and primary keys
  sql = sql.replace(/\bSERIAL PRIMARY KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');

  // 4. Convert data types
  sql = sql.replace(/\bVARCHAR\(\d+\)/gi, 'TEXT');
  sql = sql.replace(/\bVARCHAR\b/gi, 'TEXT');
  sql = sql.replace(/\bTIMESTAMP WITH TIME ZONE\b/gi, 'DATETIME');
  sql = sql.replace(/\bTIMESTAMP\b/gi, 'DATETIME');
  sql = sql.replace(/\bNUMERIC\(\d+,\s*\d+\)/gi, 'REAL');
  sql = sql.replace(/\bNUMERIC\b/gi, 'REAL');
  sql = sql.replace(/\bJSONB\b/gi, 'TEXT');
  sql = sql.replace(/\bTEXT\[\]/gi, 'TEXT');
  sql = sql.replace(/\bBOOLEAN DEFAULT TRUE\b/gi, 'INTEGER DEFAULT 1');
  sql = sql.replace(/\bBOOLEAN DEFAULT FALSE\b/gi, 'INTEGER DEFAULT 0');
  sql = sql.replace(/\bBOOLEAN\b/gi, 'INTEGER');
  sql = sql.replace(/\bSMALLINT\b/gi, 'INTEGER');
  sql = sql.replace(/\bINT\b/gi, 'INTEGER');

  // 5. Clean up array syntax and casts
  sql = sql.replace(/'\{\}'::TEXT\[\]/g, "'[]'");
  sql = sql.replace(/'\{\}'::TEXT/g, "'[]'");
  sql = sql.replace(/::\w+(\[\])?/g, '');
  sql = sql.replace(/'\{\}'/g, "'[]'");

  // 6. Clean up check constraint on jsonb
  sql = sql.replace(/,\s*CONSTRAINT check_ingredients_json_array CHECK \(jsonb_typeof\(ingredients_json\) = 'array'\)/gi, '');

  // 7. Convert triggers
  const triggerRegex = /CREATE TRIGGER\s+(\w+)\s+BEFORE UPDATE ON\s+(\w+)\s+FOR EACH ROW EXECUTE FUNCTION update_timestamp\(\);/gi;
  sql = sql.replace(triggerRegex, (match, triggerName, tableName) => {
    return `CREATE TRIGGER IF NOT EXISTS ${triggerName} AFTER UPDATE ON ${tableName}\nFOR EACH ROW\nWHEN NEW.updated_at IS OLD.updated_at\nBEGIN\n    UPDATE ${tableName} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;\nEND;`;
  });

  // 7.2. Convert other CREATE statements to include IF NOT EXISTS
  sql = sql.replace(/\bCREATE TABLE (?!IF NOT EXISTS\b)(\w+)/gi, 'CREATE TABLE IF NOT EXISTS $1');
  sql = sql.replace(/\bCREATE INDEX (?!IF NOT EXISTS\b)(\w+)/gi, 'CREATE INDEX IF NOT EXISTS $1');
  // We don't need a general trigger replacement because the only triggers are update triggers handled above.


  // 7.5. Add is_active column to staff table since it is added via migration in pg
  sql = sql.replace(
    /CREATE TABLE IF NOT EXISTS staff \([\s\S]*?\);/gi,
    (match) => {
      return match.replace(
        /created_at DATETIME/gi,
        'is_active INTEGER NOT NULL DEFAULT 1,\n    created_at DATETIME'
      );
    }
  );


  // 8. Inject business_settings and users tables

  const injectTables = `
-- =========================================================================
-- 0. SYSTEM & SETTINGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS business_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
    business_name TEXT NOT NULL DEFAULT 'CaterSync',
    currency_symbol TEXT NOT NULL DEFAULT '₱',
    overhead_rate REAL NOT NULL DEFAULT 0.12 CHECK (overhead_rate BETWEEN 0 AND 1),
    min_budget_per_guest REAL NOT NULL DEFAULT 150.00,
    risk_medium_threshold REAL NOT NULL DEFAULT 0.35,
    risk_high_threshold REAL NOT NULL DEFAULT 0.60,
    low_stock_alerts_enabled INTEGER NOT NULL DEFAULT 1,
    sound_enabled_default INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    gmail_address TEXT,
    gmail_app_password TEXT,
    smtp_host TEXT,
    smtp_port INTEGER
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Operator',
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

`;

  // Inject at the beginning of the SQL (after comments)
  sql = injectTables + sql;

  fs.writeFileSync(outputSchemaPath, sql, 'utf-8');
  console.log(`Converted schema written to ${outputSchemaPath}`);
}

function generateSeed() {
  console.log('Generating seed...');
  let sql = [];

  // Disable FK constraints during truncation / seeding
  sql.push('PRAGMA foreign_keys = OFF;');
  sql.push('DELETE FROM risk_flags;');
  sql.push('DELETE FROM consumption_logs;');
  sql.push('DELETE FROM demand_forecasts;');
  sql.push('DELETE FROM event_costs;');
  sql.push('DELETE FROM staff_assignments;');
  sql.push('DELETE FROM staff;');
  sql.push('DELETE FROM event_menus;');
  sql.push('DELETE FROM purchase_orders;');
  sql.push('DELETE FROM supplier_prices;');
  sql.push('DELETE FROM suppliers;');
  sql.push('DELETE FROM ingredients;');
  sql.push('DELETE FROM menu_items;');
  sql.push('DELETE FROM menus;');
  sql.push('DELETE FROM events;');
  sql.push('DELETE FROM customers;');
  sql.push('DELETE FROM users;');
  sql.push('DELETE FROM business_settings;');
  sql.push('DELETE FROM sqlite_sequence;');
  sql.push('PRAGMA foreign_keys = ON;');

  // Seed default business settings and users
  sql.push(`INSERT INTO business_settings (id, business_name, currency_symbol) VALUES (1, 'CaterSync-AI Operations', '₱') ON CONFLICT (id) DO NOTHING;`);
  sql.push(`INSERT INTO users (username, password_hash, role) VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Admin') ON CONFLICT (username) DO NOTHING;`);

  // 1. Ingredients
  const ingredients = [
    ['Jasmine Rice', 'kg', 150.0000, 50.0000, 365],
    ['Chicken Breast', 'kg', 80.0000, 30.0000, 5],
    ['Pork Belly', 'kg', 100.0000, 40.0000, 5],
    ['Beef Sirloin', 'kg', 60.0000, 20.0000, 5],
    ['Tiger Prawns', 'kg', 40.0000, 15.0000, 3],
    ['Salmon Fillet', 'kg', 30.0000, 10.0000, 3],
    ['Coconut Milk', 'liter', 80.0000, 20.0000, 90],
    ['Soy Sauce', 'liter', 40.0000, 10.0000, 365],
    ['Vinegar', 'liter', 30.0000, 10.0000, 365],
    ['Garlic', 'kg', 25.0000, 10.0000, 60],
    ['Onions', 'kg', 50.0000, 15.0000, 45],
    ['Tomatoes', 'kg', 40.0000, 15.0000, 7],
    ['Potatoes', 'kg', 80.0000, 20.0000, 30],
    ['Carrots', 'kg', 50.0000, 15.0000, 21],
    ['Broccoli', 'kg', 30.0000, 10.0000, 7],
    ['Tofu', 'kg', 20.0000, 8.0000, 5],
    ['Eggs', 'piece', 500.0000, 150.0000, 14],
    ['Cooking Oil', 'liter', 100.0000, 25.0000, 180],
    ['Sugar', 'kg', 50.0000, 15.0000, 365],
    ['Salt', 'kg', 20.0000, 5.0000, 365]
  ];
  for (const ing of ingredients) {
    sql.push(`INSERT INTO ingredients (name, unit, current_stock, reorder_point, shelf_life_days) VALUES ('${ing[0]}', '${ing[1]}', ${ing[2]}, ${ing[3]}, ${ing[4]});`);
  }

  // 2. Suppliers
  const suppliers = [
    ['Metro Meat Distributors', 0.95, 2],
    ['Fresh Catch Seafood', 0.88, 1],
    ['GreenGrocer Veggies', 0.92, 1],
    ['Assorted Dry Goods Inc.', 0.98, 3],
    ['Mega Food Wholesale', 0.85, 4]
  ];
  for (const s of suppliers) {
    sql.push(`INSERT INTO suppliers (name, reliability_score, avg_lead_time_days) VALUES ('${s[0]}', ${s[1]}, ${s[2]});`);
  }

  // 3. Supplier Prices
  const supplierPrices = [
    [1, 2, 180.00], [1, 3, 220.00], [1, 4, 350.00], [1, 17, 7.50],
    [2, 5, 550.00], [2, 6, 680.00],
    [3, 10, 120.00], [3, 11, 80.00], [3, 12, 90.00], [3, 13, 70.00], [3, 14, 60.00], [3, 15, 140.00], [3, 16, 95.00],
    [4, 1, 52.00], [4, 7, 75.00], [4, 8, 45.00], [4, 9, 35.00], [4, 19, 65.00], [4, 20, 25.00], [4, 18, 95.00],
    [5, 1, 48.00], [5, 2, 172.00], [5, 3, 210.00], [5, 4, 335.00], [5, 18, 90.00]
  ];
  for (const sp of supplierPrices) {
    sql.push(`INSERT INTO supplier_prices (supplier_id, ingredient_id, price_per_unit) VALUES (${sp[0]}, ${sp[1]}, ${sp[2]});`);
  }

  // 4. Staff
  const staff = [
    ['Juan Cruz', 'Chef', 350.00, 48],
    ['Maria Santos', 'Chef', 320.00, 48],
    ['Pedro Gomez', 'Sous Chef', 250.00, 48],
    ['Anna Reyes', 'Sous Chef', 240.00, 48],
    ['Mark Mendoza', 'Coordinator', 220.00, 40],
    ['Sarah Lim', 'Coordinator', 220.00, 40],
    ['David Sy', 'Bartender', 180.00, 30],
    ['Elena Torralba', 'Bartender', 180.00, 30],
    ['James Lao', 'Server', 150.00, 30],
    ['Clara Diaz', 'Server', 150.00, 30],
    ['Robert Tan', 'Server', 150.00, 30],
    ['Lisa Ramos', 'Server', 150.00, 30],
    ['Paolo Roxas', 'Server', 150.00, 30],
    ['Grace Poe', 'Server', 150.00, 30],
    ['Alex Villa', 'Server', 150.00, 30]
  ];
  for (const st of staff) {
    sql.push(`INSERT INTO staff (name, role, hourly_rate, max_hours_per_week, is_active) VALUES ('${st[0]}', '${st[1]}', ${st[2]}, ${st[3]}, 1);`);
  }

  // 5. Menus
  const menus = [
    ['Classic Filipino Feast', 'Traditional', 180.00, 450.00, '["filipino", "comfort-food", "pork", "chicken"]'],
    ['Premium Seafood Buffet', 'Seafood', 320.00, 750.00, '["seafood", "premium", "prawn", "salmon"]'],
    ['Vegan Garden Delight', 'Vegetarian', 120.00, 350.00, '["vegan", "healthy", "tofu", "gluten-free"]'],
    ['Corporate Express Luncheon', 'Corporate', 150.00, 400.00, '["chicken", "beef", "fast", "lunch"]'],
    ['Western BBQ Social', 'Western', 240.00, 600.00, '["beef", "bbq", "pork", "heavy"]']
  ];
  for (const m of menus) {
    sql.push(`INSERT INTO menus (name, category, cost_per_serving, price_per_serving, cuisine_tags) VALUES ('${m[0]}', '${m[1]}', ${m[2]}, ${m[3]}, '${m[4]}');`);
  }

  // 6. Menu Items
  const menuItems = [
    [1, 'Chicken & Pork Adobo', '[{"ingredient_id": 2, "qty": 0.15}, {"ingredient_id": 3, "qty": 0.15}, {"ingredient_id": 8, "qty": 0.05}, {"ingredient_id": 9, "qty": 0.05}, {"ingredient_id": 10, "qty": 0.02}]', 90],
    [1, 'Garlic Fried Rice', '[{"ingredient_id": 1, "qty": 0.20}, {"ingredient_id": 10, "qty": 0.03}, {"ingredient_id": 18, "qty": 0.02}]', 30],
    [1, 'Pork Sinigang', '[{"ingredient_id": 3, "qty": 0.20}, {"ingredient_id": 11, "qty": 0.03}, {"ingredient_id": 12, "qty": 0.05}, {"ingredient_id": 14, "qty": 0.05}]', 75],
    [2, 'Garlic Butter Tiger Prawns', '[{"ingredient_id": 5, "qty": 0.25}, {"ingredient_id": 10, "qty": 0.04}, {"ingredient_id": 18, "qty": 0.03}]', 45],
    [2, 'Baked Salmon Fillet', '[{"ingredient_id": 6, "qty": 0.20}, {"ingredient_id": 10, "qty": 0.02}, {"ingredient_id": 12, "qty": 0.04}]', 60],
    [2, 'Steamed Rice', '[{"ingredient_id": 1, "qty": 0.20}]', 25],
    [3, 'Crispy Garlic Tofu', '[{"ingredient_id": 16, "qty": 0.25}, {"ingredient_id": 10, "qty": 0.03}, {"ingredient_id": 18, "qty": 0.03}]', 35],
    [3, 'Broccoli & Carrots Stir Fry', '[{"ingredient_id": 15, "qty": 0.15}, {"ingredient_id": 14, "qty": 0.10}, {"ingredient_id": 8, "qty": 0.02}]', 30],
    [3, 'Steamed Brown Rice', '[{"ingredient_id": 1, "qty": 0.20}]', 25],
    [4, 'Beef Caldereta', '[{"ingredient_id": 4, "qty": 0.20}, {"ingredient_id": 11, "qty": 0.03}, {"ingredient_id": 13, "qty": 0.05}, {"ingredient_id": 14, "qty": 0.05}]', 120],
    [4, 'Chicken Curry', '[{"ingredient_id": 2, "qty": 0.20}, {"ingredient_id": 7, "qty": 0.10}, {"ingredient_id": 13, "qty": 0.05}, {"ingredient_id": 14, "qty": 0.05}]', 80],
    [4, 'Steamed Rice', '[{"ingredient_id": 1, "qty": 0.20}]', 25],
    [5, 'BBQ Pork Ribs', '[{"ingredient_id": 3, "qty": 0.30}, {"ingredient_id": 19, "qty": 0.05}, {"ingredient_id": 10, "qty": 0.02}]', 180],
    [5, 'Mashed Potatoes', '[{"ingredient_id": 13, "qty": 0.25}, {"ingredient_id": 20, "qty": 0.01}]', 40],
    [5, 'Garden Salad', '[{"ingredient_id": 12, "qty": 0.10}, {"ingredient_id": 14, "qty": 0.05}]', 20]
  ];
  for (const mi of menuItems) {
    sql.push(`INSERT INTO menu_items (menu_id, dish_name, ingredients_json, prep_time_minutes) VALUES (${mi[0]}, '${mi[1]}', '${mi[2]}', ${mi[3]});`);
  }

  // 7. Customers (55 generated rows)
  console.log('Generating 55 customers...');
  const themes = ['Modern Elegant', 'Rustic Barn', 'Tropical Luau', 'Corporate Minimalist'];
  for (let i = 1; i <= 55; i++) {
    const name = `Customer ${i}`;
    const contact = `+63 917 ${Math.floor(1000000 + (i * 1234567) % 9000000)}`;
    const allergies = i % 7 === 0 ? '["Shellfish"]' : (i % 11 === 0 ? '["Peanuts", "Gluten"]' : '[]');
    const dietary = i % 5 === 0 ? '["Vegetarian"]' : (i % 9 === 0 ? '["No Pork"]' : '[]');
    const prefTheme = themes[i % 4];
    sql.push(`INSERT INTO customers (id, name, contact, allergies, dietary_prefs, preferred_theme) VALUES (${i}, '${name}', '${contact}', '${allergies}', '${dietary}', '${prefTheme}');`);
  }

  // 8. Events (110 generated rows)
  console.log('Generating 110 events...');
  const eventTypes = ['Wedding', 'Corporate Seminar', 'Birthday Party', 'Social Gathering'];
  const venueTypes = ['Indoor Ballroom', 'Garden Resort'];
  const events = [];
  
  for (let i = 1; i <= 110; i++) {
    const customer_id = ((i * 17) % 55) + 1;
    const event_type = eventTypes[i % 4];
    const guest_count = ((i * 23) % 220) + 30;
    
    // Date: Past -360 days to future +60 days (relative to a fixed point or current time)
    const daysOffset = (i - 90) * 4;
    const eventDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    
    const budget = ((i * 1357) % 130000) + 20000;
    const theme = themes[i % 4];
    
    let status = 'Draft';
    if (i - 90 < 0) {
      status = 'Completed';
    } else if (i - 90 === 0) {
      status = 'Confirmed';
    } else {
      status = (i % 3 === 0) ? 'Draft' : 'Confirmed';
    }
    
    const venue_type = venueTypes[i % 2];
    const is_outdoor = (i % 5 === 0) ? 1 : 0;
    
    events.push({
      id: i,
      customer_id,
      event_type,
      guest_count,
      eventDate,
      budget,
      theme,
      status,
      venue_type,
      is_outdoor
    });

    sql.push(`INSERT INTO events (id, customer_id, event_type, guest_count, event_date, budget, theme, status, venue_type, is_outdoor) VALUES (${i}, ${customer_id}, '${event_type}', ${guest_count}, '${eventDate}', ${budget}, '${theme}', '${status}', '${venue_type}', ${is_outdoor});`);
  }

  // 9. Event Menus
  console.log('Generating event menus...');
  const eventMenus = [];
  for (const e of events) {
    const menu_id = (e.id % 5) + 1;
    const quantity_planned = e.guest_count;
    let quantity_consumed_actual = 'NULL';
    if (e.status === 'Completed') {
      quantity_consumed_actual = Math.floor(e.guest_count * (0.9 + (e.id % 15) / 100));
    }
    eventMenus.push({
      event_id: e.id,
      menu_id,
      quantity_planned,
      quantity_consumed_actual
    });
    sql.push(`INSERT INTO event_menus (event_id, menu_id, quantity_planned, quantity_consumed_actual) VALUES (${e.id}, ${menu_id}, ${quantity_planned}, ${quantity_consumed_actual});`);
  }

  // 10. Consumption Logs
  console.log('Generating consumption logs...');
  for (const em of eventMenus) {
    const e = events.find(ev => ev.id === em.event_id);
    if (e.status !== 'Completed') continue;

    // menu items in this menu: 3 * (menu_id - 1) + 1, +2, +3
    const baseDishId = 3 * (em.menu_id - 1) + 1;
    for (let offset = 0; offset < 3; offset++) {
      const dish_id = baseDishId + offset;
      const guests = e.guest_count;
      const planned_qty = guests * 0.40;
      let factor = 0.88;
      if (e.event_type === 'Wedding') {
        factor = 0.85 + (e.id % 20) / 100;
      } else if (e.event_type === 'Corporate Seminar') {
        factor = 0.75 + (e.id % 15) / 100;
      } else {
        factor = 0.80 + (e.id % 20) / 100;
      }
      const actual_qty_consumed = planned_qty * factor;
      sql.push(`INSERT INTO consumption_logs (event_id, dish_id, guests, planned_qty, actual_qty_consumed) VALUES (${e.id}, ${dish_id}, ${guests}, ${planned_qty.toFixed(4)}, ${actual_qty_consumed.toFixed(4)});`);
    }
  }

  // 11. Staff Assignments & Event Costs
  console.log('Generating staff assignments and event costs...');
  const staffByRole = {
    'Chef': [1, 2],
    'Sous Chef': [3, 4],
    'Coordinator': [5, 6],
    'Bartender': [7, 8],
    'Server': [9, 10, 11, 12, 13, 14, 15]
  };

  const menuCosts = { 1: 180, 2: 320, 3: 120, 4: 150, 5: 240 };

  for (const e of events) {
    if (e.status !== 'Completed' && e.status !== 'Confirmed') continue;

    let numStaff = 3;
    if (e.guest_count >= 150) numStaff = 10;
    else if (e.guest_count >= 60) numStaff = 6;

    // Select unique staff members
    const assignedStaffIds = [];
    const allStaffIds = Array.from({ length: 15 }, (_, idx) => idx + 1);
    // Shuffle deterministic using modulo
    let seedVal = e.id;
    for (let k = 0; k < numStaff; k++) {
      const targetIdx = (seedVal + k * 7) % allStaffIds.length;
      assignedStaffIds.push(allStaffIds.splice(targetIdx, 1)[0]);
    }

    let totalLaborCost = 0;
    for (const staffId of assignedStaffIds) {
      const stDetails = staff[staffId - 1]; // [name, role, rate, max_hours]
      const role = stDetails[1];
      const rate = stDetails[2];
      const hours_assigned = 4 + Math.floor(e.guest_count / 50) + (e.id % 3);
      totalLaborCost += hours_assigned * rate;
      sql.push(`INSERT INTO staff_assignments (event_id, staff_id, role, hours_assigned) VALUES (${e.id}, ${staffId}, '${role}', ${hours_assigned.toFixed(2)});`);
    }

    if (e.status === 'Completed') {
      const menuId = (e.id % 5) + 1;
      const baseCost = menuCosts[menuId];
      const ingredient_cost = e.guest_count * baseCost * (0.95 + (e.id % 15) / 100);
      const overhead_cost = e.budget * 0.12;
      const actual_revenue = e.budget;
      sql.push(`INSERT INTO event_costs (event_id, ingredient_cost, labor_cost, overhead_cost, actual_revenue) VALUES (${e.id}, ${ingredient_cost.toFixed(2)}, ${totalLaborCost.toFixed(2)}, ${overhead_cost.toFixed(2)}, ${actual_revenue.toFixed(2)});`);
    }
  }

  // 12. Purchase Orders
  console.log('Generating purchase orders...');
  // sp list length is 25:
  for (let i = 1; i <= 15; i++) {
    const spIdx = (i * 7) % supplierPrices.length;
    const sp = supplierPrices[spIdx]; // [supplier_id, ingredient_id, price_per_unit]
    const supplier_id = sp[0];
    const ingredient_id = sp[1];
    const price_per_unit = sp[2];
    
    const quantity = 50 + (i * 13) % 100;
    const cost = quantity * price_per_unit;
    
    const daysAgo = i * 3;
    const orderDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    
    let deliveryDate = 'NULL';
    let status = 'Ordered';
    if (i > 2) {
      status = 'Delivered';
      const leadTime = suppliers[supplier_id - 1][2];
      deliveryDate = `'${new Date(new Date(orderDate).getTime() + leadTime * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19)}'`;
    }
    
    sql.push(`INSERT INTO purchase_orders (supplier_id, ingredient_id, quantity, order_date, delivery_date, cost, status) VALUES (${supplier_id}, ${ingredient_id}, ${quantity.toFixed(4)}, '${orderDate}', ${deliveryDate}, ${cost.toFixed(2)}, '${status}');`);
  }

  // 13. Demand Forecasts
  console.log('Generating demand forecasts...');
  // Get start of current week (Monday)
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const startOfWeek = new Date(today.setDate(diff));

  for (let i = 0; i < 12; i++) {
    const fDate = new Date(startOfWeek.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const predicted_bookings = 2 + (i % 4) + (i * 0.1);
    const predicted_revenue = 80000 + (i % 6) * 20000 + (i * 1500);
    sql.push(`INSERT INTO demand_forecasts (week_start, predicted_bookings, predicted_revenue, model_version) VALUES ('${fDate}', ${predicted_bookings.toFixed(2)}, ${predicted_revenue.toFixed(2)}, 'prophet_v1.0');`);
  }

  // 14. Risk Flags
  console.log('Generating risk flags...');
  let flagsCount = 0;
  for (const e of events) {
    if (e.status !== 'Confirmed' && e.status !== 'Draft') continue;
    if (new Date(e.eventDate).getTime() <= Date.now()) continue;

    const risk_score = e.is_outdoor ? 0.85 : 0.40;
    const reason = e.is_outdoor 
      ? 'High risk due to outdoor venue coupled with 60% probability of heavy rainfall forecast.'
      : 'Moderate risk due to overlapping events on the same date causing kitchen staff supply crunch.';
    
    sql.push(`INSERT INTO risk_flags (event_id, risk_score, reason) VALUES (${e.id}, ${risk_score.toFixed(2)}, '${reason}');`);
    
    flagsCount++;
    if (flagsCount >= 8) break;
  }

  fs.writeFileSync(outputSeedPath, sql.join('\n'), 'utf-8');
  console.log(`Generated seed written to ${outputSeedPath}`);
}

try {
  convertSchema();
  generateSeed();
} catch (e) {
  console.error(e);
}

