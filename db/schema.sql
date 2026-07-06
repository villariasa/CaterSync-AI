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
