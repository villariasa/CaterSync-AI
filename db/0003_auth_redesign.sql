-- =========================================================================
-- Migration 0003: Enterprise Authentication Redesign
-- CaterSync AI — Auth Architecture Upgrade
-- =========================================================================

-- =========================================================================
-- 1. SESSIONS TABLE (Centralized, Revocable Session Registry)
-- =========================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             INT NOT NULL,
    user_role           VARCHAR(20) NOT NULL CHECK (user_role IN ('subscriber', 'org_user', 'supplier', 'platform_admin')),
    access_token_hash   TEXT NOT NULL,
    refresh_token_hash  TEXT NOT NULL UNIQUE,
    device_id           TEXT,
    ip_address          VARCHAR(45),
    user_agent          TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_active_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at          TIMESTAMP WITH TIME ZONE,
    revoke_reason       VARCHAR(100)
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
    user_id         INT NOT NULL,
    user_role       VARCHAR(20) NOT NULL,
    device_name     VARCHAR(255),
    browser         VARCHAR(100),
    platform        VARCHAR(100),
    os              VARCHAR(100),
    fingerprint     TEXT,
    last_ip         VARCHAR(45),
    last_country    VARCHAR(5),
    last_city       VARCHAR(100),
    is_trusted      BOOLEAN DEFAULT FALSE NOT NULL,
    trusted_at      TIMESTAMP WITH TIME ZONE,
    last_active_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_user_devices_trusted ON user_devices(user_id, is_trusted);

-- =========================================================================
-- 3. LOGIN HISTORY TABLE (Immutable Audit Trail)
-- =========================================================================
CREATE TABLE IF NOT EXISTS login_history (
    id              SERIAL PRIMARY KEY,
    user_id         INT,
    user_role       VARCHAR(20),
    identifier      VARCHAR(255),
    event_type      VARCHAR(50) NOT NULL,
    method          VARCHAR(50),
    device_id       TEXT,
    ip_address      VARCHAR(45),
    country         VARCHAR(5),
    city            VARCHAR(100),
    user_agent      TEXT,
    failure_reason  VARCHAR(255),
    risk_score      SMALLINT DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_login_history_event ON login_history(event_type);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at DESC);

-- =========================================================================
-- 4. RATE LIMITS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    id              SERIAL PRIMARY KEY,
    key             VARCHAR(255) NOT NULL UNIQUE,
    attempts        INT DEFAULT 1 NOT NULL,
    blocked_until   TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON auth_rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON auth_rate_limits(blocked_until);

-- =========================================================================
-- 5. COLUMN ADDITIONS: users
-- =========================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_totp_secret VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_totp_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_algo VARCHAR(10) DEFAULT 'sha256';
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =========================================================================
-- 6. COLUMN ADDITIONS: platform_admins
-- =========================================================================
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS pending_totp_secret VARCHAR(128);
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS pending_totp_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS password_algo VARCHAR(10) DEFAULT 'sha256';
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0 NOT NULL;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- =========================================================================
-- 7. COLUMN ADDITIONS: supplier_accounts
-- =========================================================================
ALTER TABLE supplier_accounts ADD COLUMN IF NOT EXISTS password_algo VARCHAR(10) DEFAULT 'sha256';
ALTER TABLE supplier_accounts ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0 NOT NULL;
ALTER TABLE supplier_accounts ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- =========================================================================
-- 8. COLUMN ADDITIONS: subscriber_accounts
--    Replace plain otp_code with otp_hash (hashed OTP storage)
-- =========================================================================
ALTER TABLE subscriber_accounts ADD COLUMN IF NOT EXISTS otp_hash TEXT;
ALTER TABLE subscriber_accounts ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0 NOT NULL;
ALTER TABLE subscriber_accounts ADD COLUMN IF NOT EXISTS magic_link_token_hash TEXT;
ALTER TABLE subscriber_accounts ADD COLUMN IF NOT EXISTS magic_link_expires_at TIMESTAMP WITH TIME ZONE;
-- Note: otp_code column is kept for backwards compat during migration. 
-- Drop it after full rollout: ALTER TABLE subscriber_accounts DROP COLUMN otp_code;

-- =========================================================================
-- 9. COLUMN ADDITIONS: webauthn_credentials
-- =========================================================================
ALTER TABLE webauthn_credentials ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE webauthn_credentials ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE webauthn_credentials ADD COLUMN IF NOT EXISTS aaguid TEXT;
ALTER TABLE webauthn_credentials ADD COLUMN IF NOT EXISTS transports TEXT[];
ALTER TABLE webauthn_credentials ADD COLUMN IF NOT EXISTS counter BIGINT DEFAULT 0 NOT NULL;

-- =========================================================================
-- 10. SESSION CLEANUP FUNCTION (for cron / maintenance)
-- =========================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days';
    DELETE FROM auth_rate_limits WHERE last_attempt_at < NOW() - INTERVAL '24 hours' AND blocked_until IS NULL;
END;
$$ LANGUAGE plpgsql;
