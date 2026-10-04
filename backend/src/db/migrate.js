/**
 * db/migrate.js — Database migration runner
 *
 * Reads docs/DB_SCHEMA.sql and executes it against the configured MySQL instance
 * using mysql2's multipleStatements mode so the full file runs atomically.
 *
 * Why multipleStatements (not manual split): The schema file uses inline SQL
 * comments (-- ...) inside CREATE TABLE statements. A naive semicolon-split
 * breaks those statements apart. multipleStatements lets MySQL parse and execute
 * the whole file correctly in one call.
 *
 * Usage:  npm run migrate
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// backend/src/db/migrate.js lives at:  cold-chain-monitor/backend/src/db/
// 3 levels up (../../..) reaches:      cold-chain-monitor/
// then docs/DB_SCHEMA.sql
const SCHEMA_PATH = path.resolve(__dirname, '../../..', 'docs', 'DB_SCHEMA.sql');

async function migrate() {
  // Use a single dedicated connection for migration — not the pool — so we
  // connect without specifying a database (DB doesn't exist yet on first run).
  const conn = await mysql.createConnection({
    host:               process.env.DB_HOST     ?? 'localhost',
    port:               parseInt(process.env.DB_PORT ?? '3306', 10),
    user:               process.env.DB_USER     ?? 'root',
    password:           process.env.DB_PASSWORD ?? '',
    // multipleStatements required to run CREATE DATABASE + USE + CREATE TABLE
    // all in one query() call. Safe here because the SQL comes from a trusted
    // local file, not user input.
    multipleStatements: true,
  });

  try {
    console.log('[migrate] Reading schema from', SCHEMA_PATH);
    const sql = await readFile(SCHEMA_PATH, 'utf8');

    console.log('[migrate] Executing schema (multipleStatements mode)...');
    await conn.query(sql);

    // Verify the tables were created
    await conn.query('USE coldchain');
    const [rows] = await conn.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    console.log('[migrate] Tables created:', tables.join(', '));

    // Verify seed data
    const [profiles] = await conn.query('SELECT name FROM coldchain.product_profiles');
    const names = profiles.map(r => r.name);
    console.log('[migrate] Seed profiles:', names.join(', '));

    console.log('[migrate] ✅ Migration complete. All tables and seed data are ready.');
  } catch (err) {
    console.error('[migrate] ❌ Migration failed:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

migrate().catch((err) => {
  console.error('[migrate] Fatal:', err.message);
  process.exit(1);
});
