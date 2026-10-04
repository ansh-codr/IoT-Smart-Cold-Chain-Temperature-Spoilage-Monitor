/**
 * services/alertService.js — SCAFFOLD STUB
 *
 * Stateful alert management. Evaluates thresholds after each reading
 * and opens/closes alert rows in the DB.
 *
 * Alert types and thresholds: see docs/API_CONTRACT.md §Alert Types
 */

// import { pool } from '../db/pool.js';
// import { sseManager } from '../realtime/sseManager.js';

/**
 * Evaluate all alert conditions for a single new reading and the current device state.
 * Opens new alerts or closes resolved ones in the DB, then broadcasts via SSE.
 *
 * @param {object} reading      - The freshly inserted reading row
 * @param {object} deviceState  - Current device_state row (consumed_life_hours etc.)
 * @param {object} profile      - Product profile for the device
 * @returns {Promise<object|null>} The active alert object (or null)
 */
export async function evaluate(_reading, _deviceState, _profile) {
  // TODO:
  // 1. Check TEMP_HIGH / TEMP_LOW against profile.t_max_c / t_min_c
  // 2. Check SHELF_LIFE_LOW against remaining_life_percent thresholds (20%, 10%)
  // 3. Check VOC consecutive readings for SPOILAGE_SUSPECTED
  // 4. Use SELECT ... WHERE device_id = ? AND type = ? AND ended_at IS NULL
  //    to find any currently open alert of the same type
  // 5. Open new alert (INSERT) or close resolved alert (UPDATE ended_at)
  // 6. Broadcast 'alert' SSE event via sseManager
  throw new Error('Not implemented');
}

/**
 * Check for DEVICE_OFFLINE alert (called by a background timer, not per-reading).
 *
 * @param {string} deviceId
 * @param {number} lastTs         - Last known reading timestamp (Unix s)
 * @param {number} offlineAlertS  - Threshold seconds from env
 */
export async function checkOffline(_deviceId, _lastTs, _offlineAlertS) {
  // TODO: if (now - lastTs > offlineAlertS) open DEVICE_OFFLINE alert
  throw new Error('Not implemented');
}
