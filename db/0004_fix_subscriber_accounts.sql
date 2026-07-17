-- =========================================================================
-- Recreate subscriber_accounts with INTEGER PRIMARY KEY AUTOINCREMENT
-- Fixes SERIAL gotcha in SQLite/D1 where id would default to null.
-- =========================================================================

DROP TABLE IF EXISTS subscriber_accounts;

CREATE TABLE subscriber_accounts (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id             INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    email                   TEXT UNIQUE,
    phone                   TEXT UNIQUE,
    password_hash           TEXT,
    email_verified_at       TEXT,
    phone_verified_at       TEXT,
    otp_code                TEXT,
    otp_expires_at          TEXT,
    status                  TEXT NOT NULL DEFAULT 'pending',
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at           TEXT,
    otp_hash                TEXT,
    otp_attempts            INTEGER NOT NULL DEFAULT 0,
    magic_link_token_hash   TEXT,
    magic_link_expires_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscriber_accounts_email ON subscriber_accounts(email);
