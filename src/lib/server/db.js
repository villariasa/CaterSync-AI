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

export default pool;
export { pool };
