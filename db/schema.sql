-- PostgreSQL Schema for AI Catering Intelligence Platform (ACIP)
-- Designed with detailed constraints, relationships, validations, and auto-updated timestamps.

-- Enable UUID extension if we want to use UUIDs, but SERIAL/INT is chosen for simpler model references.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define trigger function to auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 1. CUSTOMERS
-- =========================================================================
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
    contact VARCHAR(255) NOT NULL CHECK (length(trim(contact)) > 0),
    email VARCHAR(255) DEFAULT '' NOT NULL,
    allergies TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    dietary_prefs TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    preferred_theme VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER update_customers_timestamp
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_customers_name ON customers (name);

-- =========================================================================
-- 2. EVENTS
-- =========================================================================
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL CHECK (length(trim(event_type)) > 0),
    guest_count INT NOT NULL CONSTRAINT check_positive_guests CHECK (guest_count > 0),
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    budget NUMERIC(12, 2) NOT NULL CONSTRAINT check_positive_budget CHECK (budget >= 0.00),
    theme VARCHAR(100) NOT NULL CHECK (length(trim(theme)) > 0),
    status VARCHAR(50) DEFAULT 'Draft' NOT NULL CONSTRAINT check_valid_status CHECK (status IN ('Draft', 'Confirmed', 'Completed', 'Cancelled')),
    venue_type VARCHAR(100) NOT NULL CHECK (length(trim(venue_type)) > 0),
    is_outdoor BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_event_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE TRIGGER update_events_timestamp
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_events_customer_id ON events (customer_id);
CREATE INDEX idx_events_event_date ON events (event_date);
CREATE INDEX idx_events_status ON events (status);

-- =========================================================================
-- 3. MENUS
-- =========================================================================
CREATE TABLE menus (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    category VARCHAR(100) NOT NULL CHECK (length(trim(category)) > 0),
    cost_per_serving NUMERIC(10, 2) NOT NULL CONSTRAINT check_positive_cost CHECK (cost_per_serving >= 0.00),
    price_per_serving NUMERIC(10, 2) NOT NULL CONSTRAINT check_positive_price CHECK (price_per_serving >= 0.00),
    cuisine_tags TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_profit_margin CHECK (price_per_serving >= cost_per_serving)
);

CREATE TRIGGER update_menus_timestamp
BEFORE UPDATE ON menus
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_menus_category ON menus (category);

-- =========================================================================
-- 4. MENU ITEMS
-- =========================================================================
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    menu_id INT NOT NULL,
    dish_name VARCHAR(255) NOT NULL CHECK (length(trim(dish_name)) > 0),
    ingredients_json JSONB NOT NULL,
    prep_time_minutes INT NOT NULL CONSTRAINT check_prep_time CHECK (prep_time_minutes > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_menu_items_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    CONSTRAINT check_ingredients_json_array CHECK (jsonb_typeof(ingredients_json) = 'array')
);

CREATE TRIGGER update_menu_items_timestamp
BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_menu_items_menu_id ON menu_items (menu_id);

-- =========================================================================
-- 5. INGREDIENTS
-- =========================================================================
CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    unit VARCHAR(50) NOT NULL CHECK (length(trim(unit)) > 0),
    current_stock NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL CONSTRAINT check_stock CHECK (current_stock >= 0.0000),
    reorder_point NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL CONSTRAINT check_reorder CHECK (reorder_point >= 0.0000),
    shelf_life_days INT NOT NULL CONSTRAINT check_shelf_life CHECK (shelf_life_days > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER update_ingredients_timestamp
BEFORE UPDATE ON ingredients
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_ingredients_name ON ingredients (name);

-- =========================================================================
-- 6. SUPPLIERS
-- =========================================================================
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    reliability_score NUMERIC(3, 2) DEFAULT 1.00 NOT NULL CONSTRAINT check_reliability CHECK (reliability_score >= 0.00 AND reliability_score <= 1.00),
    avg_lead_time_days INT NOT NULL CONSTRAINT check_lead_time CHECK (avg_lead_time_days >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER update_suppliers_timestamp
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- =========================================================================
-- 7. SUPPLIER PRICES
-- =========================================================================
CREATE TABLE supplier_prices (
    id SERIAL PRIMARY KEY,
    supplier_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    price_per_unit NUMERIC(10, 2) NOT NULL CONSTRAINT check_positive_unit_price CHECK (price_per_unit > 0.00),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_supplier_prices_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_prices_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    CONSTRAINT uq_supplier_ingredient UNIQUE (supplier_id, ingredient_id)
);

CREATE TRIGGER update_supplier_prices_timestamp
BEFORE UPDATE ON supplier_prices
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_supplier_prices_supplier ON supplier_prices (supplier_id);
CREATE INDEX idx_supplier_prices_ingredient ON supplier_prices (ingredient_id);

-- =========================================================================
-- 8. PURCHASE ORDERS
-- =========================================================================
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    supplier_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL CONSTRAINT check_order_qty CHECK (quantity > 0.0000),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    delivery_date TIMESTAMP WITH TIME ZONE,
    cost NUMERIC(12, 2) NOT NULL CONSTRAINT check_order_cost CHECK (cost >= 0.00),
    status VARCHAR(50) DEFAULT 'Ordered' NOT NULL CONSTRAINT check_po_status CHECK (status IN ('Ordered', 'Delivered', 'Cancelled')),
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
    CONSTRAINT check_delivery_date CHECK (delivery_date IS NULL OR delivery_date >= order_date)
);

CREATE INDEX idx_purchase_orders_supplier ON purchase_orders (supplier_id);
CREATE INDEX idx_purchase_orders_ingredient ON purchase_orders (ingredient_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders (status);

-- =========================================================================
-- 9. EVENT MENUS
-- =========================================================================
CREATE TABLE event_menus (
    event_id INT NOT NULL,
    menu_id INT NOT NULL,
    quantity_planned NUMERIC(12, 4) NOT NULL CONSTRAINT check_planned_qty CHECK (quantity_planned >= 0.0000),
    quantity_consumed_actual NUMERIC(12, 4) CONSTRAINT check_consumed_qty CHECK (quantity_consumed_actual >= 0.0000),
    PRIMARY KEY (event_id, menu_id),
    CONSTRAINT fk_event_menus_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_menus_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE RESTRICT
);

-- =========================================================================
-- 10. STAFF
-- =========================================================================
CREATE TABLE staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
    role VARCHAR(100) NOT NULL CONSTRAINT check_valid_role CHECK (role IN ('Chef', 'Sous Chef', 'Server', 'Bartender', 'Coordinator')),
    hourly_rate NUMERIC(10, 2) NOT NULL CONSTRAINT check_rate CHECK (hourly_rate > 0.00),
    max_hours_per_week INT NOT NULL CONSTRAINT check_max_hours CHECK (max_hours_per_week > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TRIGGER update_staff_timestamp
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_staff_role ON staff (role);

-- =========================================================================
-- 11. STAFF ASSIGNMENTS
-- =========================================================================
CREATE TABLE staff_assignments (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    staff_id INT NOT NULL,
    role VARCHAR(100) NOT NULL CHECK (length(trim(role)) > 0),
    hours_assigned NUMERIC(5, 2) NOT NULL CONSTRAINT check_hours CHECK (hours_assigned > 0.00),
    CONSTRAINT fk_assignments_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignments_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    CONSTRAINT uq_event_staff UNIQUE (event_id, staff_id)
);

CREATE INDEX idx_staff_assignments_event ON staff_assignments (event_id);
CREATE INDEX idx_staff_assignments_staff ON staff_assignments (staff_id);

-- =========================================================================
-- 12. EVENT COSTS
-- =========================================================================
CREATE TABLE event_costs (
    event_id INT PRIMARY KEY,
    ingredient_cost NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CONSTRAINT check_ing_cost CHECK (ingredient_cost >= 0.00),
    labor_cost NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CONSTRAINT check_lab_cost CHECK (labor_cost >= 0.00),
    overhead_cost NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CONSTRAINT check_oh_cost CHECK (overhead_cost >= 0.00),
    actual_revenue NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CONSTRAINT check_act_rev CHECK (actual_revenue >= 0.00),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_costs_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- =========================================================================
-- 13. DEMAND FORECASTS (AI Populated)
-- =========================================================================
CREATE TABLE demand_forecasts (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    predicted_bookings NUMERIC(8, 2) NOT NULL CONSTRAINT check_pred_bookings CHECK (predicted_bookings >= 0.00),
    predicted_revenue NUMERIC(12, 2) NOT NULL CONSTRAINT check_pred_rev CHECK (predicted_revenue >= 0.00),
    model_version VARCHAR(100) NOT NULL CHECK (length(trim(model_version)) > 0),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_demand_forecasts_week_start ON demand_forecasts (week_start);

-- =========================================================================
-- 14. CONSUMPTION LOGS (Historical / Training Data)
-- =========================================================================
CREATE TABLE consumption_logs (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    dish_id INT NOT NULL,
    guests INT NOT NULL CONSTRAINT check_log_guests CHECK (guests > 0),
    planned_qty NUMERIC(12, 4) NOT NULL CONSTRAINT check_log_plan_qty CHECK (planned_qty >= 0.0000),
    actual_qty_consumed NUMERIC(12, 4) NOT NULL CONSTRAINT check_log_act_qty CHECK (actual_qty_consumed >= 0.0000),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_logs_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_logs_dish FOREIGN KEY (dish_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_consumption_logs_event ON consumption_logs (event_id);
CREATE INDEX idx_consumption_logs_dish ON consumption_logs (dish_id);

-- =========================================================================
-- 15. RISK FLAGS (AI Populated)
-- =========================================================================
CREATE TABLE risk_flags (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    risk_score NUMERIC(3, 2) NOT NULL CONSTRAINT check_risk_score CHECK (risk_score >= 0.00 AND risk_score <= 1.00),
    reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_risk_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX idx_risk_flags_event ON risk_flags (event_id);


-- =========================================================================
-- Phase 12 Database Schema Extensions (Operational Modules)
-- =========================================================================

-- A. Identity & Access
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255)
);

-- B. CRM & Sales
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    status VARCHAR(50) DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Quoted', 'Won', 'Lost')),
    lost_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS lead_activities (
    id SERIAL PRIMARY KEY,
    lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS quotations (
    id SERIAL PRIMARY KEY,
    lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
    total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected'))
);
CREATE TABLE IF NOT EXISTS quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL
);
CREATE TABLE IF NOT EXISTS quotation_versions (
    id SERIAL PRIMARY KEY,
    quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- C. Booking/Orders
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    item_type VARCHAR(100) NOT NULL, -- 'menu', 'rental', 'service', 'fee'
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL
);
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS resource_holds (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_id INT NOT NULL,
    hold_start TIMESTAMP WITH TIME ZONE NOT NULL,
    hold_end TIMESTAMP WITH TIME ZONE NOT NULL
);

-- D. Contracts
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Signed', 'Expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS contract_signatures (
    id SERIAL PRIMARY KEY,
    contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    signer_name VARCHAR(255) NOT NULL,
    signature_svg TEXT,
    ip_address VARCHAR(45),
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- E. Menu/Recipe
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 4) NOT NULL,
    unit VARCHAR(50) NOT NULL
);
CREATE TABLE IF NOT EXISTS menu_item_steps (
    id SERIAL PRIMARY KEY,
    menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    instruction TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS allergen_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS menu_item_allergens (
    menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    allergen_tag_id INT NOT NULL REFERENCES allergen_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, allergen_tag_id)
);
CREATE TABLE IF NOT EXISTS menu_cost_history (
    id SERIAL PRIMARY KEY,
    menu_id INT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    cost_per_serving NUMERIC(10, 2) NOT NULL,
    price_per_serving NUMERIC(10, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- F. Inventory
CREATE TABLE IF NOT EXISTS inventory_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS units_of_measure (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS unit_conversions (
    id SERIAL PRIMARY KEY,
    from_unit_id INT NOT NULL REFERENCES units_of_measure(id),
    to_unit_id INT NOT NULL REFERENCES units_of_measure(id),
    multiplier NUMERIC(12, 6) NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_batches (
    id SERIAL PRIMARY KEY,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE,
    quantity NUMERIC(12, 4) NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    location_id INT REFERENCES inventory_locations(id),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('Receipt', 'Consumption', 'Waste', 'Adjustment', 'Transfer', 'Return')),
    quantity NUMERIC(12, 4) NOT NULL,
    unit_cost NUMERIC(10, 2),
    reference_id INT,
    reference_type VARCHAR(100),
    performed_by INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS stocktakes (
    id SERIAL PRIMARY KEY,
    location_id INT NOT NULL REFERENCES inventory_locations(id),
    conducted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    conducted_by INT
);
CREATE TABLE IF NOT EXISTS stocktake_lines (
    id SERIAL PRIMARY KEY,
    stocktake_id INT NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredients(id),
    system_qty NUMERIC(12, 4) NOT NULL,
    actual_qty NUMERIC(12, 4) NOT NULL,
    variance NUMERIC(12, 4) NOT NULL
);
CREATE TABLE IF NOT EXISTS waste_logs (
    id SERIAL PRIMARY KEY,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 4) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- G. Purchasing
CREATE TABLE IF NOT EXISTS purchase_order_headers (
    id SERIAL PRIMARY KEY,
    supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Sent', 'Partially Received', 'Closed')),
    total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id SERIAL PRIMARY KEY,
    purchase_order_id INT NOT NULL REFERENCES purchase_order_headers(id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 4) NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL
);
CREATE TABLE IF NOT EXISTS goods_receipts (
    id SERIAL PRIMARY KEY,
    purchase_order_id INT REFERENCES purchase_order_headers(id) ON DELETE SET NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    received_by INT
);
CREATE TABLE IF NOT EXISTS supplier_price_history (
    id SERIAL PRIMARY KEY,
    supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    price_per_unit NUMERIC(10, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS supplier_performance_snapshots (
    id SERIAL PRIMARY KEY,
    supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    on_time_delivery_rate NUMERIC(5, 2),
    fulfillment_rate NUMERIC(5, 2),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS rfqs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- H. Equipment/Venue
CREATE TABLE IF NOT EXISTS equipment_assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100),
    total_qty INT NOT NULL DEFAULT 1,
    damaged_qty INT NOT NULL DEFAULT 0,
    unit_cost NUMERIC(10, 2)
);
CREATE TABLE IF NOT EXISTS venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    capacity INT,
    address TEXT
);
CREATE TABLE IF NOT EXISTS equipment_bookings (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    equipment_id INT NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    checked_out_at TIMESTAMP WITH TIME ZONE,
    checked_in_at TIMESTAMP WITH TIME ZONE
);
CREATE TABLE IF NOT EXISTS equipment_maintenance_logs (
    id SERIAL PRIMARY KEY,
    equipment_id INT NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    cost NUMERIC(10, 2),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- I. Kitchen
CREATE TABLE IF NOT EXISTS kitchen_tasks (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    prep_time_minutes INT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed'))
);
CREATE TABLE IF NOT EXISTS production_status_logs (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES kitchen_tasks(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS haccp_logs (
    id SERIAL PRIMARY KEY,
    task_id INT REFERENCES kitchen_tasks(id) ON DELETE SET NULL,
    temperature NUMERIC(5, 2) NOT NULL,
    hold_time_minutes INT,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- J. Staffing
CREATE TABLE IF NOT EXISTS staff_availability (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT uq_staff_date UNIQUE (staff_id, date)
);
CREATE TABLE IF NOT EXISTS staff_time_logs (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE SET NULL,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    total_hours NUMERIC(5, 2)
);
CREATE TABLE IF NOT EXISTS staff_leave_requests (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);
CREATE TABLE IF NOT EXISTS staff_certifications (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    expiry_date DATE NOT NULL
);
CREATE TABLE IF NOT EXISTS payroll_runs (
    id SERIAL PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS payroll_lines (
    id SERIAL PRIMARY KEY,
    payroll_run_id INT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    total_hours NUMERIC(6, 2) NOT NULL,
    gross_pay NUMERIC(10, 2) NOT NULL
);

-- K. Logistics
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    plate_number VARCHAR(50) NOT NULL UNIQUE,
    model VARCHAR(100),
    capacity_kg NUMERIC(8, 2)
);
CREATE TABLE IF NOT EXISTS delivery_routes (
    id SERIAL PRIMARY KEY,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
    route_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending'
);
CREATE TABLE IF NOT EXISTS delivery_stops (
    id SERIAL PRIMARY KEY,
    route_id INT NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stop_sequence INT NOT NULL,
    eta TIMESTAMP WITH TIME ZONE
);
CREATE TABLE IF NOT EXISTS proof_of_delivery (
    id SERIAL PRIMARY KEY,
    stop_id INT NOT NULL REFERENCES delivery_stops(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255) NOT NULL,
    signature_svg TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- L. Billing
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    total_amount NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    status VARCHAR(50) DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_lines (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    transaction_reference VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_schedules (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending'
);
CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    payment_id INT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    reason TEXT,
    refunded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- M. Accounting
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id SERIAL PRIMARY KEY,
    account_code VARCHAR(50) NOT NULL UNIQUE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(255),
    entry_date DATE NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id INT NOT NULL REFERENCES chart_of_accounts(id),
    debit NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    credit NUMERIC(12, 2) DEFAULT 0.00 NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    spent_at DATE NOT NULL
);

-- N. Comms
CREATE TABLE IF NOT EXISTS notifications_log (
    id SERIAL PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'push'
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Sent',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS communication_log (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    message TEXT NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    subject VARCHAR(255),
    body_template TEXT NOT NULL
);

-- O/P. Portal/Feedback
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- R. Real AI
CREATE TABLE IF NOT EXISTS model_registry (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);
CREATE TABLE IF NOT EXISTS prediction_accuracy_logs (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    prediction_id INT NOT NULL,
    predicted_val NUMERIC(12, 4) NOT NULL,
    actual_val NUMERIC(12, 4) NOT NULL,
    error_rate NUMERIC(5, 4) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =========================================================================
-- S. SUBSCRIBER REGISTRATION & SECURE AUTHENTICATION (Phase 13)
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'Operator',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    totp_secret VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriber_accounts (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) UNIQUE,
    password_hash TEXT,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    phone_verified_at TIMESTAMP WITH TIME ZONE,
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    sign_count BIGINT NOT NULL DEFAULT 0,
    device_label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
