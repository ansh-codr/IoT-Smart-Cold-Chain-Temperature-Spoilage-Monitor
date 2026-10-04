/**
 * services/readingsService.js — SCAFFOLD STUB
 *
 * Business logic for ingesting and querying readings.
 * Implement these functions in Phase 2.
 *
 * Contract: See docs/API_CONTRACT.md §POST /api/readings and §GET /api/readings
 * Model:    See docs/DECAY_MODEL.md for how consumed_life_hours is updated
 */

// import { pool } from '../db/pool.js';
// import { decayService } from './decayService.js';
// import { alertService } from './alertService.js';
// import { sseManager } from '../realtime/sseManager.js';

/**
 * Ingest one or many readings. Idempotent on (device_id, seq).
 *
 * @param {object|object[]} payload - Single reading or array
 * @returns {{ accepted: number, duplicates: number }}
 */
export async function ingest(_payload) {
  // TODO:
  // 1. Normalise to array
  // 2. INSERT IGNORE INTO readings (...) VALUES (...)
  // 3. Count affected rows vs total to determine accepted vs duplicates
  // 4. If any buffered readings, trigger recompute of consumed_life_hours
  // 5. Update device_state with new rate_factor and last_ts
  // 6. Run alert evaluation
  // 7. Broadcast via sseManager
  throw new Error('Not implemented');
}

/**
 * Query historical readings for a device.
 *
 * @param {{ device_id: string, from: number, to: number, limit: number }} query
 * @returns {{ device_id: string, count: number, readings: object[] }}
 */
export async function query(_params) {
  // TODO: SELECT ... WHERE device_id = ? AND ts BETWEEN ? AND ? ORDER BY ts ASC LIMIT ?
  throw new Error('Not implemented');
}
