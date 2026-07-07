-- Seed data for AI Catering Intelligence Platform (ACIP)
-- Generates realistic records for training, validation, and dashboard simulation.

TRUNCATE TABLE risk_flags, consumption_logs, demand_forecasts, event_costs, staff_assignments, staff, event_menus, purchase_orders, supplier_prices, suppliers, ingredients, menu_items, menus, events, customers RESTART IDENTITY CASCADE;

-- =========================================================================
-- 1. SEED INGREDIENTS
-- =========================================================================
INSERT INTO ingredients (name, unit, current_stock, reorder_point, shelf_life_days) VALUES
('Jasmine Rice', 'kg', 150.0000, 50.0000, 365),
('Chicken Breast', 'kg', 80.0000, 30.0000, 5),
('Pork Belly', 'kg', 100.0000, 40.0000, 5),
('Beef Sirloin', 'kg', 60.0000, 20.0000, 5),
('Tiger Prawns', 'kg', 40.0000, 15.0000, 3),
('Salmon Fillet', 'kg', 30.0000, 10.0000, 3),
('Coconut Milk', 'liter', 80.0000, 20.0000, 90),
('Soy Sauce', 'liter', 40.0000, 10.0000, 365),
('Vinegar', 'liter', 30.0000, 10.0000, 365),
('Garlic', 'kg', 25.0000, 10.0000, 60),
('Onions', 'kg', 50.0000, 15.0000, 45),
('Tomatoes', 'kg', 40.0000, 15.0000, 7),
('Potatoes', 'kg', 80.0000, 20.0000, 30),
('Carrots', 'kg', 50.0000, 15.0000, 21),
('Broccoli', 'kg', 30.0000, 10.0000, 7),
('Tofu', 'kg', 20.0000, 8.0000, 5),
('Eggs', 'piece', 500.0000, 150.0000, 14),
('Cooking Oil', 'liter', 100.0000, 25.0000, 180),
('Sugar', 'kg', 50.0000, 15.0000, 365),
('Salt', 'kg', 20.0000, 5.0000, 365);

-- =========================================================================
-- 2. SEED SUPPLIERS & SUPPLIER PRICES
-- =========================================================================
INSERT INTO suppliers (name, reliability_score, avg_lead_time_days) VALUES
('Metro Meat Distributors', 0.95, 2),
('Fresh Catch Seafood', 0.88, 1),
('GreenGrocer Veggies', 0.92, 1),
('Assorted Dry Goods Inc.', 0.98, 3),
('Mega Food Wholesale', 0.85, 4);

-- Supplier prices maps (Ingredient ID mapping based on serial ordering 1..20)
-- Metro Meat (id=1): Chicken (id=2), Pork (id=3), Beef (id=4), Eggs (id=17)
INSERT INTO supplier_prices (supplier_id, ingredient_id, price_per_unit) VALUES
(1, 2, 180.00), (1, 3, 220.00), (1, 4, 350.00), (1, 17, 7.50);

-- Fresh Catch (id=2): Prawns (id=5), Salmon (id=6)
INSERT INTO supplier_prices (supplier_id, ingredient_id, price_per_unit) VALUES
(2, 5, 550.00), (2, 6, 680.00);

-- GreenGrocer (id=3): Garlic (id=10), Onions (id=11), Tomatoes (id=12), Potatoes (id=13), Carrots (id=14), Broccoli (id=15)
INSERT INTO supplier_prices (supplier_id, ingredient_id, price_per_unit) VALUES
(3, 10, 120.00), (3, 11, 80.00), (3, 12, 90.00), (3, 13, 70.00), (3, 14, 60.00), (3, 15, 140.00);

-- Assorted Dry Goods (id=4): Rice (id=1), Coconut Milk (id=7), Soy Sauce (id=8), Vinegar (id=9), Sugar (id=19), Salt (id=20)
INSERT INTO supplier_prices (supplier_id, ingredient_id, price_per_unit) VALUES
(4, 1, 52.00), (4, 7, 75.00), (4, 8, 45.00), (4, 9, 35.00), (4, 19, 65.00), (4, 20, 25.00);

-- Mega Food Wholesale (id=5): All main ingredients at bulk discount (slightly cheaper but higher lead time)
INSERT INTO supplier_prices (supplier_id, ingredient_id, price_per_unit) VALUES
(5, 1, 48.00), (5, 2, 172.00), (5, 3, 210.00), (5, 4, 335.00), (5, 18, 90.00); -- Oil id=18

-- Let's make sure all ingredients have at least one supplier price
INSERT INTO supplier_prices (supplier_id, ingredient_id, price_per_unit) VALUES
(3, 16, 95.00), -- Tofu (id=16) from GreenGrocer
(4, 18, 95.00); -- Oil (id=18) from Assorted Dry Goods

-- =========================================================================
-- 3. SEED STAFF
-- =========================================================================
INSERT INTO staff (name, role, hourly_rate, max_hours_per_week) VALUES
('Juan Cruz', 'Chef', 350.00, 48),
('Maria Santos', 'Chef', 320.00, 48),
('Pedro Gomez', 'Sous Chef', 250.00, 48),
('Anna Reyes', 'Sous Chef', 240.00, 48),
('Mark Mendoza', 'Coordinator', 220.00, 40),
('Sarah Lim', 'Coordinator', 220.00, 40),
('David Sy', 'Bartender', 180.00, 30),
('Elena Torralba', 'Bartender', 180.00, 30),
('James Lao', 'Server', 150.00, 30),
('Clara Diaz', 'Server', 150.00, 30),
('Robert Tan', 'Server', 150.00, 30),
('Lisa Ramos', 'Server', 150.00, 30),
('Paolo Roxas', 'Server', 150.00, 30),
('Grace Poe', 'Server', 150.00, 30),
('Alex Villa', 'Server', 150.00, 30);

-- =========================================================================
-- 4. SEED MENUS
-- =========================================================================
INSERT INTO menus (name, category, cost_per_serving, price_per_serving, cuisine_tags) VALUES
('Classic Filipino Feast', 'Traditional', 180.00, 450.00, ARRAY['filipino', 'comfort-food', 'pork', 'chicken']),
('Premium Seafood Buffet', 'Seafood', 320.00, 750.00, ARRAY['seafood', 'premium', 'prawn', 'salmon']),
('Vegan Garden Delight', 'Vegetarian', 120.00, 350.00, ARRAY['vegan', 'healthy', 'tofu', 'gluten-free']),
('Corporate Express Luncheon', 'Corporate', 150.00, 400.00, ARRAY['chicken', 'beef', 'fast', 'lunch']),
('Western BBQ Social', 'Western', 240.00, 600.00, ARRAY['beef', 'bbq', 'pork', 'heavy']);

-- =========================================================================
-- 5. SEED MENU ITEMS (DISHES)
-- =========================================================================
-- Classic Filipino Feast (menu_id = 1)
INSERT INTO menu_items (menu_id, dish_name, ingredients_json, prep_time_minutes) VALUES
(1, 'Chicken & Pork Adobo', '[{"ingredient_id": 2, "qty": 0.15}, {"ingredient_id": 3, "qty": 0.15}, {"ingredient_id": 8, "qty": 0.05}, {"ingredient_id": 9, "qty": 0.05}, {"ingredient_id": 10, "qty": 0.02}]'::JSONB, 90),
(1, 'Garlic Fried Rice', '[{"ingredient_id": 1, "qty": 0.20}, {"ingredient_id": 10, "qty": 0.03}, {"ingredient_id": 18, "qty": 0.02}]'::JSONB, 30),
(1, 'Pork Sinigang', '[{"ingredient_id": 3, "qty": 0.20}, {"ingredient_id": 11, "qty": 0.03}, {"ingredient_id": 12, "qty": 0.05}, {"ingredient_id": 14, "qty": 0.05}]'::JSONB, 75);

-- Premium Seafood Buffet (menu_id = 2)
INSERT INTO menu_items (menu_id, dish_name, ingredients_json, prep_time_minutes) VALUES
(2, 'Garlic Butter Tiger Prawns', '[{"ingredient_id": 5, "qty": 0.25}, {"ingredient_id": 10, "qty": 0.04}, {"ingredient_id": 18, "qty": 0.03}]'::JSONB, 45),
(2, 'Baked Salmon Fillet', '[{"ingredient_id": 6, "qty": 0.20}, {"ingredient_id": 10, "qty": 0.02}, {"ingredient_id": 12, "qty": 0.04}]'::JSONB, 60),
(2, 'Steamed Rice', '[{"ingredient_id": 1, "qty": 0.20}]'::JSONB, 25);

-- Vegan Garden Delight (menu_id = 3)
INSERT INTO menu_items (menu_id, dish_name, ingredients_json, prep_time_minutes) VALUES
(3, 'Crispy Garlic Tofu', '[{"ingredient_id": 16, "qty": 0.25}, {"ingredient_id": 10, "qty": 0.03}, {"ingredient_id": 18, "qty": 0.03}]'::JSONB, 35),
(3, 'Broccoli & Carrots Stir Fry', '[{"ingredient_id": 15, "qty": 0.15}, {"ingredient_id": 14, "qty": 0.10}, {"ingredient_id": 8, "qty": 0.02}]'::JSONB, 30),
(3, 'Steamed Brown Rice', '[{"ingredient_id": 1, "qty": 0.20}]'::JSONB, 25);

-- Corporate Express Luncheon (menu_id = 4)
INSERT INTO menu_items (menu_id, dish_name, ingredients_json, prep_time_minutes) VALUES
(4, 'Beef Caldereta', '[{"ingredient_id": 4, "qty": 0.20}, {"ingredient_id": 11, "qty": 0.03}, {"ingredient_id": 13, "qty": 0.05}, {"ingredient_id": 14, "qty": 0.05}]'::JSONB, 120),
(4, 'Chicken Curry', '[{"ingredient_id": 2, "qty": 0.20}, {"ingredient_id": 7, "qty": 0.10}, {"ingredient_id": 13, "qty": 0.05}, {"ingredient_id": 14, "qty": 0.05}]'::JSONB, 80),
(4, 'Steamed Rice', '[{"ingredient_id": 1, "qty": 0.20}]'::JSONB, 25);

-- Western BBQ Social (menu_id = 5)
INSERT INTO menu_items (menu_id, dish_name, ingredients_json, prep_time_minutes) VALUES
(5, 'BBQ Pork Ribs', '[{"ingredient_id": 3, "qty": 0.30}, {"ingredient_id": 19, "qty": 0.05}, {"ingredient_id": 10, "qty": 0.02}]'::JSONB, 180),
(5, 'Mashed Potatoes', '[{"ingredient_id": 13, "qty": 0.25}, {"ingredient_id": 20, "qty": 0.01}]'::JSONB, 40),
(5, 'Garden Salad', '[{"ingredient_id": 12, "qty": 0.10}, {"ingredient_id": 14, "qty": 0.05}]'::JSONB, 20);

-- =========================================================================
-- 6. SEED CUSTOMERS (50+ records)
-- =========================================================================
-- Helper to generate 55 customers using generate_series
INSERT INTO customers (name, contact, allergies, dietary_prefs, preferred_theme)
SELECT
    'Customer ' || i AS name,
    '+63 917 ' || lpad(floor(random()*9000000 + 1000000)::text, 7, '0') AS contact,
    CASE 
        WHEN i % 7 = 0 THEN ARRAY['Shellfish']
        WHEN i % 11 = 0 THEN ARRAY['Peanuts', 'Gluten']
        ELSE '{}'::TEXT[]
    END AS allergies,
    CASE
        WHEN i % 5 = 0 THEN ARRAY['Vegetarian']
        WHEN i % 9 = 0 THEN ARRAY['No Pork']
        ELSE '{}'::TEXT[]
    END AS dietary_prefs,
    CASE (i % 4)
        WHEN 0 THEN 'Modern Elegant'
        WHEN 1 THEN 'Rustic Barn'
        WHEN 2 THEN 'Tropical Luau'
        ELSE 'Corporate Minimalist'
    END AS preferred_theme
FROM generate_series(1, 55) AS i;

-- =========================================================================
-- 7. SEED EVENTS (100+ records)
-- Over the past 360 days (Completed) to the next 60 days (Confirmed/Draft)
-- =========================================================================
INSERT INTO events (customer_id, event_type, guest_count, event_date, budget, theme, status, venue_type, is_outdoor)
SELECT
    floor(random()*55 + 1)::int AS customer_id,
    CASE (i % 4)
        WHEN 0 THEN 'Wedding'
        WHEN 1 THEN 'Corporate Seminar'
        WHEN 2 THEN 'Birthday Party'
        ELSE 'Social Gathering'
    END AS event_type,
    floor(random()*250 + 30)::int AS guest_count,
    -- Spanning past -360 days to future +60 days
    CURRENT_TIMESTAMP + ((i - 90) * INTERVAL '4 days') AS event_date,
    floor(random()*150000 + 20000)::numeric AS budget,
    CASE (i % 4)
        WHEN 0 THEN 'Modern Elegant'
        WHEN 1 THEN 'Rustic Barn'
        WHEN 2 THEN 'Tropical Luau'
        ELSE 'Corporate Minimalist'
    END AS theme,
    CASE 
        WHEN (i - 90) < 0 THEN 'Completed'::varchar
        WHEN (i - 90) = 0 THEN 'Confirmed'::varchar
        ELSE 
            CASE WHEN random() > 0.4 THEN 'Confirmed'::varchar ELSE 'Draft'::varchar END
    END AS status,
    CASE WHEN random() > 0.5 THEN 'Indoor Ballroom' ELSE 'Garden Resort' END AS venue_type,
    CASE WHEN random() > 0.6 THEN TRUE ELSE FALSE END AS is_outdoor
FROM generate_series(1, 110) AS i;

-- =========================================================================
-- 8. SEED EVENT MENUS & CONSUMPTION LOGS
-- For Completed and Confirmed events.
-- Map specific menus based on theme or random choices.
-- =========================================================================
-- Assign a menu to every event
INSERT INTO event_menus (event_id, menu_id, quantity_planned, quantity_consumed_actual)
SELECT
    e.id AS event_id,
    -- Assign a menu index 1..5
    (e.id % 5 + 1) AS menu_id,
    e.guest_count AS quantity_planned,
    -- If Completed, actual consumed is random deviation (-10% to +5% to represent real catering volatility)
    CASE 
        WHEN e.status = 'Completed' THEN floor(e.guest_count * (0.9 + random()*0.15))
        ELSE NULL
    END AS quantity_consumed_actual
FROM events e;

-- Seed consumption logs for menu items of completed events to create a rich XGBoost dataset.
-- Every menu item in the assigned menu logs the actual amount consumed.
INSERT INTO consumption_logs (event_id, dish_id, guests, planned_qty, actual_qty_consumed)
SELECT
    e.id AS event_id,
    mi.id AS dish_id,
    e.guest_count AS guests,
    -- Planned qty is recipe base per guest * guest count
    -- We extract ingredients weight to estimate general planned weight or standard portions
    e.guest_count * 0.40 AS planned_qty, 
    -- Actual consumed shows realistic deviation based on event type
    CASE
        WHEN e.event_type = 'Wedding' THEN e.guest_count * 0.40 * (0.85 + random()*0.20) -- higher waste risk
        WHEN e.event_type = 'Corporate Seminar' THEN e.guest_count * 0.40 * (0.75 + random()*0.15) -- generally less consumption
        ELSE e.guest_count * 0.40 * (0.80 + random()*0.20)
    END AS actual_qty_consumed
FROM events e
JOIN event_menus em ON em.event_id = e.id
JOIN menu_items mi ON mi.menu_id = em.menu_id
WHERE e.status = 'Completed';

-- =========================================================================
-- 9. SEED STAFF ASSIGNMENTS
-- Assignments for past events and confirmed upcoming events
-- =========================================================================
INSERT INTO staff_assignments (event_id, staff_id, role, hours_assigned)
SELECT
    e.id AS event_id,
    s.id AS staff_id,
    s.role AS role,
    -- 4 to 8 hours depending on guest count
    (4 + floor((e.guest_count / 50.0)) + random()*2)::numeric(5,2) AS hours_assigned
FROM events e
-- Cross join to select a subset of staff for each event
CROSS JOIN LATERAL (
    SELECT id, role, hourly_rate
    FROM staff
    ORDER BY random()
    LIMIT CASE 
        WHEN e.guest_count < 60 THEN 3
        WHEN e.guest_count < 150 THEN 6
        ELSE 10
    END
) s
WHERE e.status IN ('Completed', 'Confirmed');

-- =========================================================================
-- 10. SEED EVENT COSTS
-- Post-event financial records for completed events
-- =========================================================================
INSERT INTO event_costs (event_id, ingredient_cost, labor_cost, overhead_cost, actual_revenue)
SELECT
    e.id AS event_id,
    -- Ingredient cost derived from event menu * menu unit cost + random variance
    (e.guest_count * m.cost_per_serving * (0.95 + random()*0.15))::numeric(12,2) AS ingredient_cost,
    -- Labor cost derived from sum of staff hours assigned * rate
    COALESCE(sa.total_labor, e.guest_count * 45.00 * (0.9 + random()*0.2))::numeric(12,2) AS labor_cost,
    -- Overhead (venue, transport, etc.)
    (e.budget * 0.12)::numeric(12,2) AS overhead_cost,
    -- Actual revenue matches budget or slight changes if guests changed
    e.budget AS actual_revenue
FROM events e
JOIN event_menus em ON em.event_id = e.id
JOIN menus m ON m.id = em.menu_id
LEFT JOIN (
    -- Subquery to calculate actual labor sum per event
    SELECT s_a.event_id, SUM(s_a.hours_assigned * st.hourly_rate) AS total_labor
    FROM staff_assignments s_a
    JOIN staff st ON st.id = s_a.staff_id
    GROUP BY s_a.event_id
) sa ON sa.event_id = e.id
WHERE e.status = 'Completed';

-- =========================================================================
-- 11. SEED PURCHASE ORDERS
-- Active and past purchase orders
-- =========================================================================
INSERT INTO purchase_orders (supplier_id, ingredient_id, quantity, order_date, delivery_date, cost, status)
SELECT
    sp.supplier_id,
    sp.ingredient_id,
    (50 + random()*100)::numeric(12,4) AS quantity,
    CURRENT_TIMESTAMP - (i * INTERVAL '3 days') AS order_date,
    CASE 
        WHEN i > 2 THEN CURRENT_TIMESTAMP - (i * INTERVAL '3 days') + (s.avg_lead_time_days * INTERVAL '1 day')
        ELSE NULL
    END AS delivery_date,
    ((50 + random()*100) * sp.price_per_unit)::numeric(12,2) AS cost,
    CASE WHEN i > 2 THEN 'Delivered'::varchar ELSE 'Ordered'::varchar END AS status
FROM (
    SELECT supplier_id, ingredient_id, row_number() OVER () as rn
    FROM supplier_prices
) sp
JOIN suppliers s ON s.id = sp.supplier_id
JOIN generate_series(1, 15) AS i ON i = (sp.rn % 15 + 1);

-- =========================================================================
-- 12. SEED DEMAND FORECASTS (Weekly bookings / revenue predictions)
-- =========================================================================
INSERT INTO demand_forecasts (week_start, predicted_bookings, predicted_revenue, model_version)
SELECT
    (date_trunc('week', CURRENT_DATE) + (i * INTERVAL '1 week'))::date AS week_start,
    (2 + random()*4)::numeric(8,2) AS predicted_bookings,
    (80000 + random()*120000)::numeric(12,2) AS predicted_revenue,
    'prophet_v1.0' AS model_version
FROM generate_series(0, 11) AS i;

-- =========================================================================
-- 13. SEED RISK FLAGS
-- AI analysis flag mockups for Confirmed and Draft upcoming events
-- =========================================================================
INSERT INTO risk_flags (event_id, risk_score, reason)
SELECT
    e.id AS event_id,
    CASE 
        WHEN e.is_outdoor AND random() > 0.5 THEN 0.85 
        ELSE 0.40
    END AS risk_score,
    CASE 
        WHEN e.is_outdoor AND random() > 0.5 THEN 'High risk due to outdoor venue coupled with 60% probability of heavy rainfall forecast.'
        ELSE 'Moderate risk due to overlapping events on the same date causing kitchen staff supply crunch.'
    END AS reason
FROM events e
WHERE e.status IN ('Confirmed', 'Draft') AND e.event_date > CURRENT_TIMESTAMP
LIMIT 8;

-- =========================================================================
-- 14. SEED OPERATOR & SUBSCRIBER USERS
-- =========================================================================
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO subscriber_accounts (customer_id, email, status)
VALUES (1, 'customer@example.com', 'active')
ON CONFLICT (email) DO NOTHING;
