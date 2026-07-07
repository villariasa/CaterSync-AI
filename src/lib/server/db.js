import pg from 'pg';
import { env } from '$env/dynamic/private';

const connectionString = env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/catersync';

// Create a singleton connection pool
const pool = new pg.Pool({
  connectionString,
  // Add reasonable connection pool limits for a local/offline server
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('⚠️ Unexpected error on idle PostgreSQL client:', err);
});

// Run automatic schema upgrades if database is active
pool.query(`
  CREATE TABLE IF NOT EXISTS business_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      business_name VARCHAR(255) NOT NULL DEFAULT 'CaterSync',
      currency_symbol VARCHAR(5) NOT NULL DEFAULT '₱',
      overhead_rate NUMERIC(5,4) NOT NULL DEFAULT 0.12 CHECK (overhead_rate BETWEEN 0 AND 1),
      min_budget_per_guest NUMERIC(10,2) NOT NULL DEFAULT 150.00,
      risk_medium_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.35,
      risk_high_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.60,
      low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
      sound_enabled_default BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
  INSERT INTO business_settings (id, business_name, currency_symbol) 
  VALUES (1, 'CaterSync-AI Operations', '₱')
  ON CONFLICT (id) DO NOTHING;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  
  CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL DEFAULT 'Operator',
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
  INSERT INTO users (username, password_hash, role)
  VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Admin')
  ON CONFLICT (username) DO NOTHING;
`).then(() => {
  console.log('✅ PostgreSQL Schema upgrades completed successfully.');
}).catch((err) => {
  console.warn('⚠️ PostgreSQL Schema upgrade skipped or failed (offline simulation mode will handle config):', err.message);
});

export default pool;
export { pool };

