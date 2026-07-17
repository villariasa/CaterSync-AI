-- =========================================================================
-- Migration 0003: Enterprise Authentication Redesign (SQLite/D1 compatible)
-- CaterSync AI — Auth Architecture Upgrade
-- =========================================================================

-- =========================================================================
-- 1. SESSIONS TABLE (Centralized, Revocable Session Registry)
--    Note: D1/SQLite does not have UUID type — TEXT is used.
--    gen_random_uuid() is also not available; UUID generated in app layer.
-- =========================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id                  TEXT PRIMARY KEY,           -- UUID generated in application layer
    user_id             INTEGER NOT NULL,
    user_role           TEXT NOT NULL CHECK (user_role IN ('subscriber', 'org_user', 'supplier', 'platform_admin')),
    access_token_hash   TEXT NOT NULL,
    refresh_token_hash  TEXT NOT NULL UNIQUE,
    device_id           TEXT,
    ip_address          TEXT,
    user_agent          TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    last_active_at      TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at          TEXT NOT NULL,
    revoked_at          TEXT,
    revoke_reason       TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_sessions_access ON sessions(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- =========================================================================
-- 2. USER DEVICES TABLE (Trusted Device Registry)
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_devices (
    id              TEXT PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    user_role       TEXT NOT NULL,
    device_name     TEXT,
    browser         TEXT,
    platform        TEXT,
    os              TEXT,
    fingerprint     TEXT,
    last_ip         TEXT,
    last_country    TEXT,
    last_city       TEXT,
    is_trusted      INTEGER NOT NULL DEFAULT 0,     -- SQLite boolean
    trusted_at      TEXT,
    last_active_at  TEXT NOT NULL DEFAULT (datetime('now')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_user_devices_trusted ON user_devices(user_id, is_trusted);

-- =========================================================================
-- 3. LOGIN HISTORY TABLE (Immutable Audit Trail)
-- =========================================================================
CREATE TABLE IF NOT EXISTS login_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER,
    user_role       TEXT,
    identifier      TEXT,
    event_type      TEXT NOT NULL,
    method          TEXT,
    device_id       TEXT,
    ip_address      TEXT,
    country         TEXT,
    city            TEXT,
    user_agent      TEXT,
    failure_reason  TEXT,
    risk_score      INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_login_history_event ON login_history(event_type);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at);

-- =========================================================================
-- 4. RATE LIMITS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    key             TEXT NOT NULL UNIQUE,
    attempts        INTEGER NOT NULL DEFAULT 1,
    blocked_until   TEXT,
    last_attempt_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON auth_rate_limits(key);

-- =========================================================================
-- 5. COLUMN ADDITIONS: users
--    SQLite does not support multiple ADD COLUMN in one ALTER TABLE.
--    Each must be a separate statement.
-- =========================================================================
ALTER TABLE users ADD COLUMN pending_totp_secret TEXT;
ALTER TABLE users ADD COLUMN pending_totp_expires_at TEXT;
ALTER TABLE users ADD COLUMN password_algo TEXT DEFAULT 'sha256';
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- =========================================================================
-- 6. COLUMN ADDITIONS: platform_admins
-- =========================================================================
ALTER TABLE platform_admins ADD COLUMN pending_totp_secret TEXT;
ALTER TABLE platform_admins ADD COLUMN pending_totp_expires_at TEXT;
ALTER TABLE platform_admins ADD COLUMN password_algo TEXT DEFAULT 'sha256';
ALTER TABLE platform_admins ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE platform_admins ADD COLUMN locked_until TEXT;

-- =========================================================================
-- 7. COLUMN ADDITIONS: supplier_accounts
-- =========================================================================
ALTER TABLE supplier_accounts ADD COLUMN password_algo TEXT DEFAULT 'sha256';
ALTER TABLE supplier_accounts ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supplier_accounts ADD COLUMN locked_until TEXT;

-- =========================================================================
-- 8. COLUMN ADDITIONS: subscriber_accounts
-- =========================================================================
ALTER TABLE subscriber_accounts ADD COLUMN otp_hash TEXT;
ALTER TABLE subscriber_accounts ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriber_accounts ADD COLUMN magic_link_token_hash TEXT;
ALTER TABLE subscriber_accounts ADD COLUMN magic_link_expires_at TEXT;

-- =========================================================================
-- 9. COLUMN ADDITIONS: webauthn_credentials
-- =========================================================================
ALTER TABLE webauthn_credentials ADD COLUMN last_used_at TEXT;
ALTER TABLE webauthn_credentials ADD COLUMN device_id TEXT;
ALTER TABLE webauthn_credentials ADD COLUMN aaguid TEXT;
ALTER TABLE webauthn_credentials ADD COLUMN counter INTEGER NOT NULL DEFAULT 0;
