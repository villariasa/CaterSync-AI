/**
 * Database Migration & Seeding Runner Script for ACIP
 * 
 * This script runs the schema.sql and seed.sql scripts against the target PostgreSQL database.
 * Usage: DATABASE_URL=postgres://user:pass@localhost:5432/dbname node migrate.js [--seed]
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not defined.');
  console.error('Usage: DATABASE_URL=postgresql://user:password@host:port/database node migrate.js [--seed]');
  process.exit(1);
}

const shouldSeed = process.argv.includes('--seed');

async function runMigrations() {
  const client = new pg.Client({ connectionString });
  
  try {
    console.log('🔄 Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully.');

    // 1. Run Schema Setup
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`📁 Reading schema file: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('⚡ Executing schema.sql (tables, constraints, triggers, indexes)...');
    await client.query(schemaSql);
    console.log('✅ Database schema applied successfully.');

    // 2. Run Seeding (optional)
    if (shouldSeed) {
      const seedPath = path.join(__dirname, 'seed.sql');
      console.log(`📁 Reading seed data file: ${seedPath}`);
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      
      console.log('⚡ Executing seed.sql (populating tables with 50+ customers, 100+ events, etc.)...');
      await client.query(seedSql);
      console.log('✅ Seeding completed successfully.');
    } else {
      console.log('ℹ️ Seeding skipped. Run with --seed to populate initial data.');
    }

  } catch (error) {
    console.error('❌ Error executing database operations:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed.');
  }
}

runMigrations();
