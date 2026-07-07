-- Migration: Subscriber Authentication & WebAuthn Credentials Setup

-- 1. Operator Users Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'Operator',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Subscriber Accounts Table
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

-- 3. WebAuthn Credentials Table
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    account_type VARCHAR(20) NOT NULL, -- 'operator' or 'subscriber'
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    sign_count BIGINT NOT NULL DEFAULT 0,
    device_label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
