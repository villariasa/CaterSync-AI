-- CaterSync-AI Database Schema
-- Multi-tenant AI-powered catering management system
-- PostgreSQL Database Structure

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TENANT MANAGEMENT
-- ==========================================

-- Organizations/Companies using the system
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    subscription_status VARCHAR(20) DEFAULT 'active',
    subscription_expires_at TIMESTAMP,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Users within organizations
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    permissions JSONB DEFAULT '[]',
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- ==========================================
-- CUSTOMER MANAGEMENT
-- ==========================================

-- Customer information
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_type VARCHAR(20) DEFAULT 'individual', -- 'individual', 'corporate'
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    secondary_phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Philippines',
    notes TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_events INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    customer_since DATE DEFAULT CURRENT_DATE,
    preferred_contact_method VARCHAR(20) DEFAULT 'phone', -- 'phone', 'email', 'sms'
    birthday DATE,
    anniversary DATE,
    dietary_restrictions TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Customer tags for categorization
CREATE TABLE customer_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Many-to-many relationship between customers and tags
CREATE TABLE customer_tag_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(customer_id, tag_id)
);

-- ==========================================
-- MENU MANAGEMENT
-- ==========================================

-- Menu categories
CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual menu items
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    unit VARCHAR(50) DEFAULT 'serving', -- 'serving', 'piece', 'kg', 'liter'
    minimum_order_quantity INTEGER DEFAULT 1,
    image_url VARCHAR(500),
    dietary_info JSONB DEFAULT '{}', -- vegetarian, vegan, gluten-free, etc.
    allergen_info JSONB DEFAULT '{}',
    preparation_time INTEGER, -- in minutes
    shelf_life INTEGER, -- in hours
    storage_requirements TEXT,
    nutritional_info JSONB DEFAULT '{}',
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Predefined package offerings
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_per_person DECIMAL(10,2) NOT NULL,
    minimum_guests INTEGER NOT NULL DEFAULT 1,
    maximum_guests INTEGER,
    image_url VARCHAR(500),
    inclusions TEXT,
    exclusions TEXT,
    package_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'premium', 'deluxe'
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Items included in each package
CREATE TABLE package_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity_per_person DECIMAL(8,2) NOT NULL DEFAULT 1.0,
    is_optional BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0
);

-- ==========================================
-- OCCASION & EVENT TYPES
-- ==========================================

-- Types of occasions/events
CREATE TABLE occasions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    typical_duration INTEGER, -- in hours
    typical_guest_count_min INTEGER,
    typical_guest_count_max INTEGER,
    season_preference VARCHAR(20), -- 'spring', 'summer', 'autumn', 'winter', 'any'
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- BOOKING MANAGEMENT
-- ==========================================

-- Event booking status enum
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- Payment status enum
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED');

-- Main booking/event records
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    occasion_id UUID REFERENCES occasions(id) ON DELETE SET NULL,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_start_time TIME,
    event_end_time TIME,
    venue_name VARCHAR(255),
    venue_address TEXT,
    venue_contact_person VARCHAR(255),
    venue_contact_phone VARCHAR(20),
    guest_count INTEGER NOT NULL,
    special_requests TEXT,
    dietary_requirements TEXT,
    equipment_needed TEXT,
    setup_requirements TEXT,
    service_style VARCHAR(50), -- 'buffet', 'plated', 'family_style', 'cocktail'
    status booking_status DEFAULT 'PENDING',
    payment_status payment_status DEFAULT 'UNPAID',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    service_charge DECIMAL(12,2) DEFAULT 0.00,
    delivery_fee DECIMAL(12,2) DEFAULT 0.00,
    additional_fees DECIMAL(12,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12,2) DEFAULT 0.00,
    downpayment_required DECIMAL(5,2) DEFAULT 50.00, -- percentage
    downpayment_due_date DATE,
    balance_due_date DATE,
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(12,2) DEFAULT 0.00,
    assigned_chef_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_coordinator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    estimated_preparation_hours DECIMAL(5,2),
    actual_preparation_hours DECIMAL(5,2),
    delivery_required BOOLEAN DEFAULT false,
    delivery_time TIMESTAMP,
    delivery_address TEXT,
    setup_required BOOLEAN DEFAULT false,
    setup_time TIMESTAMP,
    cleanup_required BOOLEAN DEFAULT false,
    contract_url VARCHAR(500),
    internal_notes TEXT,
    ai_insights JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Custom menu items for specific bookings
CREATE TABLE booking_menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    custom_item_name VARCHAR(255), -- for items not in standard menu
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    special_instructions TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Additional services for bookings
CREATE TABLE booking_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    service_description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL
);

-- ==========================================
-- FINANCIAL MANAGEMENT
-- ==========================================

-- Payment methods enum
CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'GCASH', 'PAYMAYA', 'CHECK');

-- Payment records
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    payment_reference VARCHAR(100) UNIQUE NOT NULL,
    payment_method payment_method NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    transaction_reference VARCHAR(255),
    bank_name VARCHAR(255),
    check_number VARCHAR(100),
    check_date DATE,
    notes TEXT,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0.00,
    status payment_status DEFAULT 'UNPAID',
    notes TEXT,
    pdf_url VARCHAR(500),
    sent_at TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- KITCHEN & PRODUCTION MANAGEMENT
-- ==========================================

-- Kitchen order status enum
CREATE TYPE kitchen_order_status AS ENUM ('PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED');

-- Kitchen orders for production planning
CREATE TABLE kitchen_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    production_date DATE NOT NULL,
    status kitchen_order_status DEFAULT 'PENDING',
    priority_level INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=urgent
    estimated_prep_time INTEGER, -- in minutes
    actual_prep_time INTEGER,
    assigned_chef_id UUID REFERENCES users(id) ON DELETE SET NULL,
    prep_start_time TIMESTAMP,
    prep_completion_time TIMESTAMP,
    quality_notes TEXT,
    special_instructions TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual items in kitchen orders
CREATE TABLE kitchen_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kitchen_order_id UUID NOT NULL REFERENCES kitchen_orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit VARCHAR(50) DEFAULT 'serving',
    prep_notes TEXT,
    allergen_warnings TEXT,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- INVENTORY MANAGEMENT
-- ==========================================

-- Inventory categories
CREATE TABLE inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory items/ingredients
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100),
    unit_of_measure VARCHAR(50) NOT NULL, -- 'kg', 'liter', 'piece', 'box'
    current_stock DECIMAL(10,3) DEFAULT 0,
    minimum_stock DECIMAL(10,3) DEFAULT 0,
    maximum_stock DECIMAL(10,3),
    cost_per_unit DECIMAL(10,2),
    supplier_name VARCHAR(255),
    supplier_contact VARCHAR(255),
    storage_location VARCHAR(255),
    expiry_tracking BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock movements (in/out transactions)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT', 'WASTE'
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(12,2),
    reference_type VARCHAR(50), -- 'purchase', 'production', 'adjustment', 'waste'
    reference_id UUID,
    expiry_date DATE,
    batch_number VARCHAR(100),
    notes TEXT,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Recipe ingredients (what items are needed for menu items)
CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_needed DECIMAL(10,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    notes TEXT
);

-- ==========================================
-- STAFF MANAGEMENT
-- ==========================================

-- Staff availability
CREATE TABLE staff_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    availability_type VARCHAR(20) DEFAULT 'available', -- 'available', 'unavailable', 'limited'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date, start_time)
);

-- Staff assignments to events
CREATE TABLE event_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL, -- 'chef', 'sous_chef', 'server', 'coordinator'
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    hourly_rate DECIMAL(8,2),
    notes TEXT,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- LOGISTICS & DELIVERY
-- ==========================================

-- Delivery vehicles
CREATE TABLE delivery_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_name VARCHAR(255) NOT NULL,
    license_plate VARCHAR(50),
    vehicle_type VARCHAR(50), -- 'van', 'truck', 'motorcycle'
    capacity_kg DECIMAL(8,2),
    capacity_volume DECIMAL(8,2),
    fuel_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    maintenance_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Delivery assignments
CREATE TABLE delivery_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES delivery_vehicles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    helper_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scheduled_pickup_time TIMESTAMP NOT NULL,
    scheduled_delivery_time TIMESTAMP NOT NULL,
    actual_pickup_time TIMESTAMP,
    actual_delivery_time TIMESTAMP,
    delivery_status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'picked_up', 'in_transit', 'delivered', 'failed'
    distance_km DECIMAL(8,2),
    fuel_cost DECIMAL(8,2),
    toll_fees DECIMAL(8,2),
    delivery_notes TEXT,
    customer_signature_url VARCHAR(500),
    photo_proof_urls JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- AI & ANALYTICS
-- ==========================================

-- AI-generated insights and recommendations
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    insight_type VARCHAR(100) NOT NULL, -- 'demand_forecast', 'menu_recommendation', 'pricing_optimization'
    entity_type VARCHAR(50), -- 'booking', 'customer', 'menu_item', 'organization'
    entity_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    priority_level INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Customer behavior analytics
CREATE TABLE customer_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,5) NOT NULL,
    metric_date DATE NOT NULL,
    additional_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- SYSTEM ADMINISTRATION
-- ==========================================

-- System activity logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    entity_name VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- System notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'booking_reminder', 'payment_due', 'stock_low', 'system_alert'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- File uploads/attachments
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);

-- Users
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Customers
CREATE INDEX idx_customers_organization_id ON customers(organization_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_customer_type ON customers(customer_type);

-- Bookings
CREATE INDEX idx_bookings_organization_id ON bookings(organization_id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_event_date ON bookings(event_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_booking_reference ON bookings(booking_reference);

-- Menu Items
CREATE INDEX idx_menu_items_organization_id ON menu_items(organization_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);

-- Kitchen Orders
CREATE INDEX idx_kitchen_orders_organization_id ON kitchen_orders(organization_id);
CREATE INDEX idx_kitchen_orders_booking_id ON kitchen_orders(booking_id);
CREATE INDEX idx_kitchen_orders_production_date ON kitchen_orders(production_date);
CREATE INDEX idx_kitchen_orders_status ON kitchen_orders(status);

-- Inventory
CREATE INDEX idx_inventory_items_organization_id ON inventory_items(organization_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_stock_movements_organization_id ON stock_movements(organization_id);
CREATE INDEX idx_stock_movements_inventory_item_id ON stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_transaction_date ON stock_movements(transaction_date);

-- Payments
CREATE INDEX idx_payments_organization_id ON payments(organization_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Activity Logs
CREATE INDEX idx_activity_logs_organization_id ON activity_logs(organization_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_entity_type_id ON activity_logs(entity_type, entity_id);

-- Notifications
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ==========================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON menu_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_occasions_updated_at BEFORE UPDATE ON occasions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kitchen_orders_updated_at BEFORE UPDATE ON kitchen_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_vehicles_updated_at BEFORE UPDATE ON delivery_vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_assignments_updated_at BEFORE UPDATE ON delivery_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- VIEWS FOR COMMON QUERIES
-- ==========================================

-- Active bookings with customer info
CREATE VIEW v_active_bookings AS
SELECT 
    b.id,
    b.booking_reference,
    b.event_name,
    b.event_date,
    b.guest_count,
    b.status,
    b.payment_status,
    b.total_amount,
    b.amount_paid,
    (b.total_amount - b.amount_paid) AS balance_due,
    c.first_name || ' ' || COALESCE(c.last_name, '') AS customer_name,
    c.phone AS customer_phone,
    c.email AS customer_email,
    o.name AS occasion_name,
    p.name AS package_name
FROM bookings b
JOIN customers c ON b.customer_id = c.id
LEFT JOIN occasions o ON b.occasion_id = o.id
LEFT JOIN packages p ON b.package_id = p.id
WHERE b.status IN ('PENDING', 'CONFIRMED')
    AND b.deleted_at IS NULL;

-- Customer loyalty summary
CREATE VIEW v_customer_loyalty AS
SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.loyalty_points,
    c.total_events,
    c.total_spent,
    c.customer_since,
    CASE 
        WHEN c.total_spent >= 100000 THEN 'VIP'
        WHEN c.total_spent >= 50000 THEN 'Gold'
        WHEN c.total_spent >= 20000 THEN 'Silver'
        ELSE 'Bronze'
    END AS loyalty_tier,
    COUNT(b.id) AS upcoming_bookings
FROM customers c
LEFT JOIN bookings b ON c.id = b.customer_id 
    AND b.event_date >= CURRENT_DATE 
    AND b.status = 'CONFIRMED'
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, 
         c.loyalty_points, c.total_events, c.total_spent, c.customer_since;

-- Kitchen production schedule
CREATE VIEW v_kitchen_schedule AS
SELECT 
    ko.id AS kitchen_order_id,
    ko.order_number,
    ko.production_date,
    ko.status,
    ko.priority_level,
    b.booking_reference,
    b.event_name,
    b.event_date,
    b.guest_count,
    c.first_name || ' ' || COALESCE(c.last_name, '') AS customer_name,
    u.first_name || ' ' || u.last_name AS assigned_chef,
    COUNT(koi.id) AS total_items,
    SUM(CASE WHEN koi.is_completed THEN 1 ELSE 0 END) AS completed_items
FROM kitchen_orders ko
JOIN bookings b ON ko.booking_id = b.id
JOIN customers c ON b.customer_id = c.id
LEFT JOIN users u ON ko.assigned_chef_id = u.id
LEFT JOIN kitchen_order_items koi ON ko.id = koi.kitchen_order_id
WHERE ko.status IN ('PENDING', 'IN_PREPARATION')
GROUP BY ko.id, ko.order_number, ko.production_date, ko.status, 
         ko.priority_level, b.booking_reference, b.event_name, 
         b.event_date, b.guest_count, c.first_name, c.last_name, 
         u.first_name, u.last_name;

-- Inventory alerts
CREATE VIEW v_inventory_alerts AS
SELECT 
    ii.id,
    ii.name,
    ii.sku,
    ii.current_stock,
    ii.minimum_stock,
    ii.unit_of_measure,
    ic.name AS category_name,
    CASE 
        WHEN ii.current_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN ii.current_stock <= ii.minimum_stock THEN 'LOW_STOCK'
        ELSE 'SUFFICIENT'
    END AS alert_level,
    ii.supplier_name,
    ii.supplier_contact
FROM inventory_items ii
LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
WHERE ii.is_active = true
    AND ii.current_stock <= ii.minimum_stock
ORDER BY ii.current_stock ASC;

-- Financial summary
CREATE VIEW v_financial_summary AS
SELECT 
    DATE_TRUNC('month', b.event_date) AS month,
    COUNT(b.id) AS total_bookings,
    SUM(b.total_amount) AS total_revenue,
    SUM(b.amount_paid) AS total_collected,
    SUM(b.total_amount - b.amount_paid) AS total_outstanding,
    AVG(b.total_amount) AS average_booking_value,
    COUNT(CASE WHEN b.status = 'COMPLETED' THEN 1 END) AS completed_bookings,
    COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END) AS cancelled_bookings
FROM bookings b
WHERE b.deleted_at IS NULL
    AND b.event_date >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY DATE_TRUNC('month', b.event_date)
ORDER BY month;

-- ==========================================
-- SAMPLE DATA FUNCTIONS
-- ==========================================

-- Function to generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference(org_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    prefix VARCHAR(5);
    sequence_num INTEGER;
    reference VARCHAR(20);
BEGIN
    -- Get organization prefix (first 2 letters of slug, uppercase)
    SELECT UPPER(LEFT(slug, 2)) INTO prefix FROM organizations WHERE id = org_id;
    
    -- Get next sequence number for this organization
    SELECT COALESCE(MAX(CAST(SUBSTRING(booking_reference FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM bookings 
    WHERE organization_id = org_id 
        AND booking_reference LIKE prefix || '%';
    
    -- Format: AA240001 (prefix + year + sequence)
    reference := prefix || EXTRACT(YEAR FROM CURRENT_DATE)::text || LPAD(sequence_num::text, 4, '0');
    
    RETURN reference;
END;
$$ LANGUAGE plpgsql;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number(org_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    prefix VARCHAR(5);
    sequence_num INTEGER;
    order_num VARCHAR(50);
BEGIN
    SELECT UPPER(LEFT(slug, 2)) INTO prefix FROM organizations WHERE id = org_id;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM kitchen_orders 
    WHERE organization_id = org_id 
        AND order_number LIKE 'KO-' || prefix || '%';
    
    order_num := 'KO-' || prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(sequence_num::text, 3, '0');
    
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- STORED PROCEDURES FOR BUSINESS LOGIC
-- ==========================================

-- Procedure to update booking totals
CREATE OR REPLACE FUNCTION update_booking_totals(booking_id UUID)
RETURNS VOID AS $$
DECLARE
    menu_total DECIMAL(12,2);
    service_total DECIMAL(12,2);
    calculated_total DECIMAL(12,2);
BEGIN
    -- Calculate menu items total
    SELECT COALESCE(SUM(total_price), 0)
    INTO menu_total
    FROM booking_menu_items
    WHERE booking_id = booking_id;
    
    -- Calculate services total
    SELECT COALESCE(SUM(total_price), 0)
    INTO service_total
    FROM booking_services
    WHERE booking_id = booking_id;
    
    -- Update booking subtotal and total
    UPDATE bookings
    SET subtotal = menu_total + service_total,
        total_amount = menu_total + service_total + tax_amount + service_charge + delivery_fee + additional_fees - discount_amount
    WHERE id = booking_id;
END;
$$ LANGUAGE plpgsql;

-- Procedure to update customer statistics
CREATE OR REPLACE FUNCTION update_customer_stats(customer_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE customers
    SET 
        total_events = (
            SELECT COUNT(*) 
            FROM bookings 
            WHERE customer_id = customers.id 
                AND status IN ('CONFIRMED', 'COMPLETED')
                AND deleted_at IS NULL
        ),
        total_spent = (
            SELECT COALESCE(SUM(amount_paid), 0)
            FROM bookings 
            WHERE customer_id = customers.id 
                AND status IN ('CONFIRMED', 'COMPLETED')
                AND deleted_at IS NULL
        )
    WHERE id = customer_id;
END;
$$ LANGUAGE plpgsql;

-- Procedure to update inventory stock
CREATE OR REPLACE FUNCTION update_inventory_stock(
    item_id UUID, 
    quantity DECIMAL(10,3), 
    movement_type VARCHAR(20),
    reference_type VARCHAR(50) DEFAULT NULL,
    reference_id UUID DEFAULT NULL,
    user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Insert stock movement record
    INSERT INTO stock_movements (
        organization_id,
        inventory_item_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        processed_by
    )
    SELECT 
        organization_id,
        item_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        user_id
    FROM inventory_items
    WHERE id = item_id;
    
    -- Update current stock
    UPDATE inventory_items
    SET current_stock = CASE 
        WHEN movement_type = 'IN' THEN current_stock + quantity
        WHEN movement_type = 'OUT' THEN current_stock - quantity
        WHEN movement_type = 'ADJUSTMENT' THEN quantity
        ELSE current_stock
    END,
    updated_at = NOW()
    WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

-- Create notification function
CREATE OR REPLACE FUNCTION create_notification(
    org_id UUID,
    user_id UUID,
    notification_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        organization_id,
        user_id,
        type,
        title,
        message,
        data
    ) VALUES (
        org_id,
        user_id,
        notification_type,
        title,
        message,
        data
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- END OF SCHEMA
-- ==========================================

COMMENT ON DATABASE postgres IS 'CaterSync-AI: Multi-tenant AI-powered catering management system';