/**
 * db/reset.js — Clean readings, alerts, and device_state for a fresh run
 *
 * Usage: npm run db:reset
 */

import 'dotenv/config';
import { pool } from './pool.js';

async function reset() {
  const conn = await pool.getConnection();
  try {
    console.log('[db:reset] Truncating readings, alerts, and device_state tables...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE readings');
    await conn.query('TRUNCATE TABLE alerts');
    await conn.query('TRUNCATE TABLE device_state');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[db:reset] ✅ All sensor data, alerts, and states cleared. Ready for fresh ESP32 sequence.');
  } catch (err) {
    console.error('[db:reset] ❌ Failed to reset tables:', err.message);
  } finally {
    conn.release();
    await pool.end();
  }
}

reset();
