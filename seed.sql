-- =============================================================================
-- CaterSync-AI — Clean Seed
--
-- This seed file resets all operational tables to a COMPLETELY EMPTY state.
-- A new operator starts with zero inventory, zero customers, zero suppliers,
-- zero staff, zero menus, and zero events. They build their own data from scratch.
--
-- Only two rows are seeded:
--   1. business_settings (id=1) — required singleton row for app config
--   2. users admin row — platform-level admin account
--
-- DO NOT add sample/demo data here. If you need a dev dataset for testing,
-- create a separate seed.dev.sql file and run it manually in dev only.
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- Clear all operational tables (order respects FK dependencies)
DELETE FROM risk_flags;
DELETE FROM consumption_logs;
DELETE FROM demand_forecasts;
DELETE FROM event_costs;
DELETE FROM staff_assignments;
DELETE FROM staff;
DELETE FROM event_menus;
DELETE FROM purchase_orders;
DELETE FROM supplier_prices;
DELETE FROM suppliers;
DELETE FROM ingredients;
DELETE FROM menu_items;
DELETE FROM menus;
DELETE FROM events;
DELETE FROM customers;
DELETE FROM users;
DELETE FROM organizations;
DELETE FROM sessions;
DELETE FROM devices;
DELETE FROM business_settings;
DELETE FROM sqlite_sequence;

PRAGMA foreign_keys = ON;

-- ── System-level singleton row ────────────────────────────────────────────────
-- Required: settings endpoint reads id=1. DO NOT remove.
INSERT INTO business_settings (id, business_name, currency_symbol)
  VALUES (1, 'CaterSync-AI Operations', '₱')
  ON CONFLICT (id) DO NOTHING;

-- ── Platform admin account ────────────────────────────────────────────────────
-- Password hash is SHA-256 of 'admin' (dev only — change before production).
INSERT INTO users (username, password_hash, role, is_active, is_admin)
  VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Admin', 1, 1)
  ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- All other tables are intentionally left empty.
-- Operators provision their own inventory, suppliers, staff, and menus
-- after completing the onboarding flow.
-- =============================================================================