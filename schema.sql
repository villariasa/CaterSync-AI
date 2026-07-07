
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

-- PostgreSQL Schema for AI Catering Intelligence Platform (ACIP)
-- Designed with detailed constraints, relationships, validations, and auto-updated timestamps.

-- Enable UUID extension if we want to use UUIDs, but SERIAL/INTEGER is chosen for simpler model references.


-- Define trigger function to auto-update updated_at columns


-- =========================================================================
-- 1. CUSTOMERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    contact TEXT NOT NULL CHECK (length(trim(contact)) > 0),
    email TEXT DEFAULT '' NOT NULL,
    allergies TEXT DEFAULT '[]' NOT NULL,
    dietary_prefs TEXT DEFAULT '[]' NOT NULL,
    preferred_theme TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER IF NOT EXISTS update_customers_timestamp AFTER UPDATE ON customers
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);

-- =========================================================================
-- 2. EVENTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (length(trim(event_type)) > 0),
    guest_count INTEGER NOT NULL CONSTRAINT check_positive_guests CHECK (guest_count > 0),
    event_date DATETIME NOT NULL,
    budget REAL NOT NULL CONSTRAINT check_positive_budget CHECK (budget >= 0.00),
    theme TEXT NOT NULL CHECK (length(trim(theme)) > 0),
    status TEXT DEFAULT 'Draft' NOT NULL CONSTRAINT check_valid_status CHECK (status IN ('Draft', 'Confirmed', 'Completed', 'Cancelled')),
    venue_type TEXT NOT NULL CHECK (length(trim(venue_type)) > 0),
    is_outdoor INTEGER DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_event_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS update_events_timestamp AFTER UPDATE ON events
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE events SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_events_customer_id ON events (customer_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);

-- =========================================================================
-- 3. MENUS
-- =========================================================================
CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    category TEXT NOT NULL CHECK (length(trim(category)) > 0),
    cost_per_serving REAL NOT NULL CONSTRAINT check_positive_cost CHECK (cost_per_serving >= 0.00),
    price_per_serving REAL NOT NULL CONSTRAINT check_positive_price CHECK (price_per_serving >= 0.00),
    cuisine_tags TEXT DEFAULT '[]' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_profit_margin CHECK (price_per_serving >= cost_per_serving)
);

CREATE TRIGGER IF NOT EXISTS update_menus_timestamp AFTER UPDATE ON menus
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE menus SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_menus_category ON menus (category);

-- =========================================================================
-- 4. MENU ITEMS
-- =========================================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER NOT NULL,
    dish_name TEXT NOT NULL CHECK (length(trim(dish_name)) > 0),
    ingredients_json TEXT NOT NULL,
    prep_time_minutes INTEGER NOT NULL CONSTRAINT check_prep_time CHECK (prep_time_minutes > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_menu_items_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS update_menu_items_timestamp AFTER UPDATE ON menu_items
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items (menu_id);

-- =========================================================================
-- 5. INGREDIENTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    current_stock REAL DEFAULT 0.0000 NOT NULL CONSTRAINT check_stock CHECK (current_stock >= 0.0000),
    reorder_point REAL DEFAULT 0.0000 NOT NULL CONSTRAINT check_reorder CHECK (reorder_point >= 0.0000),
    shelf_life_days INTEGER NOT NULL CONSTRAINT check_shelf_life CHECK (shelf_life_days > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER IF NOT EXISTS update_ingredients_timestamp AFTER UPDATE ON ingredients
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE ingredients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients (name);

-- =========================================================================
-- 6. SUPPLIERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    reliability_score REAL DEFAULT 1.00 NOT NULL CONSTRAINT check_reliability CHECK (reliability_score >= 0.00 AND reliability_score <= 1.00),
    avg_lead_time_days INTEGER NOT NULL CONSTRAINT check_lead_time CHECK (avg_lead_time_days >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER IF NOT EXISTS update_suppliers_timestamp AFTER UPDATE ON suppliers
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =========================================================================
-- 7. SUPPLIER PRICES
-- =========================================================================
CREATE TABLE IF NOT EXISTS supplier_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    price_per_unit REAL NOT NULL CONSTRAINT check_positive_unit_price CHECK (price_per_unit > 0.00),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_supplier_prices_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_prices_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    CONSTRAINT uq_supplier_ingredient UNIQUE (supplier_id, ingredient_id)
);

CREATE TRIGGER IF NOT EXISTS update_supplier_prices_timestamp AFTER UPDATE ON supplier_prices
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE supplier_prices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_supplier_prices_supplier ON supplier_prices (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_prices_ingredient ON supplier_prices (ingredient_id);

-- =========================================================================
-- 8. PURCHASE ORDERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity REAL NOT NULL CONSTRAINT check_order_qty CHECK (quantity > 0.0000),
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    delivery_date DATETIME,
    cost REAL NOT NULL CONSTRAINT check_order_cost CHECK (cost >= 0.00),
    status TEXT DEFAULT 'Ordered' NOT NULL CONSTRAINT check_po_status CHECK (status IN ('Ordered', 'Delivered', 'Cancelled')),
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
    CONSTRAINT check_delivery_date CHECK (delivery_date IS NULL OR delivery_date >= order_date)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ingredient ON purchase_orders (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders (status);

-- =========================================================================
-- 9. EVENT MENUS
-- =========================================================================
CREATE TABLE IF NOT EXISTS event_menus (
    event_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    quantity_planned REAL NOT NULL CONSTRAINT check_planned_qty CHECK (quantity_planned >= 0.0000),
    quantity_consumed_actual REAL CONSTRAINT check_consumed_qty CHECK (quantity_consumed_actual >= 0.0000),
    PRIMARY KEY (event_id, menu_id),
    CONSTRAINT fk_event_menus_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_menus_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE RESTRICT
);

-- =========================================================================
-- 10. STAFF
-- =========================================================================
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    role TEXT NOT NULL CONSTRAINT check_valid_role CHECK (role IN ('Chef', 'Sous Chef', 'Server', 'Bartender', 'Coordinator')),
    hourly_rate REAL NOT NULL CONSTRAINT check_rate CHECK (hourly_rate > 0.00),
    max_hours_per_week INTEGER NOT NULL CONSTRAINT check_max_hours CHECK (max_hours_per_week > 0),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER IF NOT EXISTS update_staff_timestamp AFTER UPDATE ON staff
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE staff SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_staff_role ON staff (role);

-- =========================================================================
-- 11. STAFF ASSIGNMENTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS staff_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (length(trim(role)) > 0),
    hours_assigned REAL NOT NULL CONSTRAINT check_hours CHECK (hours_assigned > 0.00),
    CONSTRAINT fk_assignments_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignments_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    CONSTRAINT uq_event_staff UNIQUE (event_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_event ON staff_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff ON staff_assignments (staff_id);

-- =========================================================================
-- 12. EVENT COSTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS event_costs (
    event_id INTEGER PRIMARY KEY,
    ingredient_cost REAL DEFAULT 0.00 NOT NULL CONSTRAINT check_ing_cost CHECK (ingredient_cost >= 0.00),
    labor_cost REAL DEFAULT 0.00 NOT NULL CONSTRAINT check_lab_cost CHECK (labor_cost >= 0.00),
    overhead_cost REAL DEFAULT 0.00 NOT NULL CONSTRAINT check_oh_cost CHECK (overhead_cost >= 0.00),
    actual_revenue REAL DEFAULT 0.00 NOT NULL CONSTRAINT check_act_rev CHECK (actual_revenue >= 0.00),
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_costs_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- =========================================================================
-- 13. DEMAND FORECASTS (AI Populated)
-- =========================================================================
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start DATE NOT NULL UNIQUE,
    predicted_bookings REAL NOT NULL CONSTRAINT check_pred_bookings CHECK (predicted_bookings >= 0.00),
    predicted_revenue REAL NOT NULL CONSTRAINT check_pred_rev CHECK (predicted_revenue >= 0.00),
    model_version TEXT NOT NULL CHECK (length(trim(model_version)) > 0),
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_week_start ON demand_forecasts (week_start);

-- =========================================================================
-- 14. CONSUMPTION LOGS (Historical / Training Data)
-- =========================================================================
CREATE TABLE IF NOT EXISTS consumption_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    dish_id INTEGER NOT NULL,
    guests INTEGER NOT NULL CONSTRAINT check_log_guests CHECK (guests > 0),
    planned_qty REAL NOT NULL CONSTRAINT check_log_plan_qty CHECK (planned_qty >= 0.0000),
    actual_qty_consumed REAL NOT NULL CONSTRAINT check_log_act_qty CHECK (actual_qty_consumed >= 0.0000),
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_logs_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_logs_dish FOREIGN KEY (dish_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_consumption_logs_event ON consumption_logs (event_id);
CREATE INDEX IF NOT EXISTS idx_consumption_logs_dish ON consumption_logs (dish_id);

-- =========================================================================
-- 15. RISK FLAGS (AI Populated)
-- =========================================================================
CREATE TABLE IF NOT EXISTS risk_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    risk_score REAL NOT NULL CONSTRAINT check_risk_score CHECK (risk_score >= 0.00 AND risk_score <= 1.00),
    reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_risk_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_risk_flags_event ON risk_flags (event_id);


-- =========================================================================
-- Phase 12 Database Schema Extensions (Operational Modules)
-- =========================================================================

-- A. Identity & Access
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    location TEXT
);

-- B. CRM & Sales
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Quoted', 'Won', 'Lost')),
    lost_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS lead_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    total_amount REAL DEFAULT 0.00 NOT NULL,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected'))
);
CREATE TABLE IF NOT EXISTS quotation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS quotation_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- C. Booking/Orders
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'menu', 'rental', 'service', 'fee'
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by INTEGER,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS resource_holds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id INTEGER NOT NULL,
    hold_start DATETIME NOT NULL,
    hold_end DATETIME NOT NULL
);

-- D. Contracts
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Signed', 'Expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS contract_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    signer_name TEXT NOT NULL,
    signature_svg TEXT,
    ip_address TEXT,
    signed_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- E. Menu/Recipe
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS menu_item_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS allergen_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS menu_item_allergens (
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    allergen_tag_id INTEGER NOT NULL REFERENCES allergen_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, allergen_tag_id)
);
CREATE TABLE IF NOT EXISTS menu_cost_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    cost_per_serving REAL NOT NULL,
    price_per_serving REAL NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- F. Inventory
CREATE TABLE IF NOT EXISTS inventory_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS units_of_measure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS unit_conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_unit_id INTEGER NOT NULL REFERENCES units_of_measure(id),
    to_unit_id INTEGER NOT NULL REFERENCES units_of_measure(id),
    multiplier REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    expiry_date DATE,
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES inventory_locations(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Receipt', 'Consumption', 'Waste', 'Adjustment', 'Transfer', 'Return')),
    quantity REAL NOT NULL,
    unit_cost REAL,
    reference_id INTEGER,
    reference_type TEXT,
    performed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS stocktakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL REFERENCES inventory_locations(id),
    conducted_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    conducted_by INTEGER
);
CREATE TABLE IF NOT EXISTS stocktake_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stocktake_id INTEGER NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    system_qty REAL NOT NULL,
    actual_qty REAL NOT NULL,
    variance REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS waste_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity REAL NOT NULL,
    reason TEXT NOT NULL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- G. Purchasing
CREATE TABLE IF NOT EXISTS purchase_order_headers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Sent', 'Partially Received', 'Closed')),
    total_amount REAL DEFAULT 0.00 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_order_headers(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    total_cost REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS goods_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER REFERENCES purchase_order_headers(id) ON DELETE SET NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    received_by INTEGER
);
CREATE TABLE IF NOT EXISTS supplier_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    price_per_unit REAL NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS supplier_performance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    on_time_delivery_rate REAL,
    fulfillment_rate REAL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS rfqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'Draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- H. Equipment/Venue
CREATE TABLE IF NOT EXISTS equipment_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    total_qty INTEGER NOT NULL DEFAULT 1,
    damaged_qty INTEGER NOT NULL DEFAULT 0,
    unit_cost REAL
);
CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER,
    address TEXT
);
CREATE TABLE IF NOT EXISTS equipment_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    checked_out_at DATETIME,
    checked_in_at DATETIME
);
CREATE TABLE IF NOT EXISTS equipment_maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    cost REAL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- I. Kitchen
CREATE TABLE IF NOT EXISTS kitchen_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    prep_time_minutes INTEGER NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed'))
);
CREATE TABLE IF NOT EXISTS production_status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES kitchen_tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS haccp_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES kitchen_tasks(id) ON DELETE SET NULL,
    temperature REAL NOT NULL,
    hold_time_minutes INTEGER,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- J. Staffing
CREATE TABLE IF NOT EXISTS staff_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available INTEGER DEFAULT 1 NOT NULL,
    CONSTRAINT uq_staff_date UNIQUE (staff_id, date)
);
CREATE TABLE IF NOT EXISTS staff_time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    clock_in DATETIME NOT NULL,
    clock_out DATETIME,
    total_hours REAL
);
CREATE TABLE IF NOT EXISTS staff_leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);
CREATE TABLE IF NOT EXISTS staff_certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    certification_name TEXT NOT NULL,
    expiry_date DATE NOT NULL
);
CREATE TABLE IF NOT EXISTS payroll_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS payroll_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    total_hours REAL NOT NULL,
    gross_pay REAL NOT NULL
);

-- K. Logistics
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL UNIQUE,
    model TEXT,
    capacity_kg REAL
);
CREATE TABLE IF NOT EXISTS delivery_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    route_date DATE NOT NULL,
    status TEXT DEFAULT 'Pending'
);
CREATE TABLE IF NOT EXISTS delivery_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stop_sequence INTEGER NOT NULL,
    eta DATETIME
);
CREATE TABLE IF NOT EXISTS proof_of_delivery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stop_id INTEGER NOT NULL REFERENCES delivery_stops(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    signature_svg TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- L. Billing
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    total_amount REAL NOT NULL,
    tax_amount REAL DEFAULT 0.00 NOT NULL,
    discount_amount REAL DEFAULT 0.00 NOT NULL,
    status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount REAL NOT NULL,
    transaction_reference TEXT,
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'Pending'
);
CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    reason TEXT,
    refunded_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- M. Accounting
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_code TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT,
    entry_date DATE NOT NULL,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    debit REAL DEFAULT 0.00 NOT NULL,
    credit REAL DEFAULT 0.00 NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    spent_at DATE NOT NULL
);

-- N. Comms
CREATE TABLE IF NOT EXISTS notifications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    type TEXT NOT NULL, -- 'email', 'sms', 'push'
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'Sent',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS communication_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    message TEXT NOT NULL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    subject TEXT,
    body_template TEXT NOT NULL
);

-- O/P. Portal/Feedback
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- R. Real AI
CREATE TABLE IF NOT EXISTS model_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL,
    file_path TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL
);
CREATE TABLE IF NOT EXISTS prediction_accuracy_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    prediction_id INTEGER NOT NULL,
    predicted_val REAL NOT NULL,
    actual_val REAL NOT NULL,
    error_rate REAL NOT NULL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
