-- SQLite Migration: Multi-Tenant Marketplace & Auth Setup

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL CHECK (length(trim(slug)) > 0),
    name TEXT NOT NULL,
    logo_url TEXT,
    cover_image_url TEXT,
    description TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    service_areas TEXT DEFAULT '[]',
    min_guest_count INTEGER,
    max_guest_count INTEGER,
    price_range TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    verified_at DATETIME,
    is_active INTEGER NOT NULL DEFAULT 1,
    onboarded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_verification ON organizations(verification_status);

-- 2. Alter users table to add organization_id
ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

-- 3. Seed default organization (id = 1)
INSERT OR IGNORE INTO organizations (id, slug, name, contact_email, verification_status)
VALUES (1, 'default-org', 'Default Organization', 'org@example.com', 'verified');

-- 4. Backfill users to organization 1
UPDATE users SET organization_id = 1 WHERE organization_id IS NULL;

-- 5. Create platform_admins table
CREATE TABLE IF NOT EXISTS platform_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    permission_level TEXT NOT NULL DEFAULT 'support',
    is_active INTEGER NOT NULL DEFAULT 1,
    totp_secret TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at DATETIME
);

-- Seed default platform admin (username: platform_admin, password: admin)
INSERT OR IGNORE INTO platform_admins (username, email, password_hash, permission_level)
VALUES ('platform_admin', 'admin@catersync.ai', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'super_admin');

-- 6. Create supplier_accounts table
CREATE TABLE IF NOT EXISTS supplier_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    email_verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at DATETIME
);

-- 7. Create organization_suppliers table
CREATE TABLE IF NOT EXISTS organization_suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (organization_id, supplier_id)
);
