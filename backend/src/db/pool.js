/**
 * db/pool.js — MySQL connection pool
 *
 * Why a singleton pool: mysql2 pools manage connection lifecycle automatically.
 * Exporting a single pool instance means every service module shares
 * connections efficiently without each one creating its own.
 *
 * All DB operations must use parameterized queries (pool.execute or pool.query
 * with placeholder arrays) — never string-interpolate user input into SQL.
 */

import mysql from 'mysql2/promise';

// Read connection config from environment (populated by dotenv in server.js)
const pool = mysql.createPool({
  host:               process.env.DB_HOST     ?? '127.0.0.1',
  port:               parseInt(process.env.DB_PORT ?? '3306', 10),
  user:               process.env.DB_USER     ?? 'root',
  password:           process.env.DB_PASSWORD ?? '',
  database:           process.env.DB_NAME     ?? 'coldchain',
  // Keep connections alive so ESP32 bursts don't exhaust the pool
  connectionLimit:    10,
  // Automatically reconnect if a connection is lost mid-session
  waitForConnections: true,
  queueLimit:         0,
  // Return dates as strings, not Date objects, to avoid timezone surprises.
  // All timestamps are stored as Unix ints anyway, so this is belt-and-suspenders.
  dateStrings: true,
});

export { pool };
