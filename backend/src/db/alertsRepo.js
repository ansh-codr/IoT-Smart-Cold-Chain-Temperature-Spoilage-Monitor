/**
 * db/alertsRepo.js — DB helpers for the alerts table.
 *
 * Alert lifecycle: opened (ended_at IS NULL) → closed (ended_at set).
 * One open alert per (device_id, type) at any time.
 */

import { pool } from './pool.js';

/**
 * Find the current open alert of a given type for a device.
 * Returns null if no open alert exists.
 *
 * @param {object} conn - pool or transaction connection
 * @param {string} deviceId
 * @param {string} type
 * @returns {Promise<object|null>}
 */
export async function getOpenAlert(conn, deviceId, type) {
  const [rows] = await conn.execute(
    `SELECT id, device_id, type, severity, started_at, peak_value, message
       FROM alerts
      WHERE device_id = ? AND type = ? AND ended_at IS NULL
      LIMIT 1`,
    [deviceId, type],
  );
  return rows[0] ?? null;
}

/**
 * Open (insert) a new alert row.
 *
 * @param {object} conn
 * @param {string} deviceId
 * @param {string} type
 * @param {string} severity
 * @param {number} startedAt  - Unix seconds UTC
 * @param {number} peakValue
 * @param {string} message
 * @returns {Promise<number>} insertId
 */
export async function openAlert(conn, deviceId, type, severity, startedAt, peakValue, message) {
  const [result] = await conn.execute(
    `INSERT INTO alerts (device_id, type, severity, started_at, peak_value, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [deviceId, type, severity, startedAt, peakValue, message],
  );
  return result.insertId;
}

/**
 * Update an open alert's severity and/or peak_value if the condition escalates.
 *
 * @param {object} conn
 * @param {number} alertId
 * @param {string} severity
 * @param {number} peakValue
 * @param {string} message
 */
export async function escalateAlert(conn, alertId, severity, peakValue, message) {
  await conn.execute(
    `UPDATE alerts SET severity = ?, peak_value = ?, message = ? WHERE id = ?`,
    [severity, peakValue, message, alertId],
  );
}

/**
 * Close an open alert by setting ended_at.
 *
 * @param {object} conn
 * @param {number} alertId
 * @param {number} endedAt - Unix seconds UTC
 */
export async function closeAlert(conn, alertId, endedAt) {
  await conn.execute(
    `UPDATE alerts SET ended_at = ? WHERE id = ? AND ended_at IS NULL`,
    [endedAt, alertId],
  );
}

/**
 * Get all currently open alerts for a device.
 *
 * @param {string} deviceId
 * @returns {Promise<object[]>}
 */
export async function getOpenAlerts(deviceId) {
  const [rows] = await pool.execute(
    `SELECT id, type, severity, started_at, peak_value, message
       FROM alerts
      WHERE device_id = ? AND ended_at IS NULL`,
    [deviceId],
  );
  return rows;
}

/**
 * Get the single most prominent open alert for a device (for /api/status).
 * Priority: DEVICE_OFFLINE > SPOILAGE_SUSPECTED > TEMP_HIGH/LOW > SHELF_LIFE_LOW.
 *
 * @param {string} deviceId
 * @returns {Promise<object|null>}
 */
export async function getPrimaryOpenAlert(deviceId) {
  const [rows] = await pool.execute(
    `SELECT id, type, severity, started_at, peak_value, message
       FROM alerts
      WHERE device_id = ? AND ended_at IS NULL
      ORDER BY FIELD(type, 'DEVICE_OFFLINE','SPOILAGE_SUSPECTED','TEMP_HIGH','TEMP_LOW','SHELF_LIFE_LOW'),
               FIELD(severity, 'critical', 'warning')
      LIMIT 1`,
    [deviceId],
  );
  return rows[0] ?? null;
}

/**
 * Fetch alert history for a device, descending by started_at.
 *
 * @param {string} deviceId
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function listAlerts(deviceId, limit) {
  const [rows] = await pool.execute(
    `SELECT id, type, severity, started_at, ended_at,
            CASE WHEN ended_at IS NOT NULL THEN ended_at - started_at ELSE NULL END AS duration_s,
            peak_value, message
       FROM alerts
      WHERE device_id = ?
      ORDER BY started_at DESC
      LIMIT ?`,
    [deviceId, limit],
  );
  return rows;
}

/**
 * Close all open alerts of a specific type for a device.
 * Used when a device comes back online (close DEVICE_OFFLINE).
 *
 * @param {object} conn
 * @param {string} deviceId
 * @param {string} type
 * @param {number} endedAt
 */
export async function closeAlertsByType(conn, deviceId, type, endedAt) {
  await conn.execute(
    `UPDATE alerts SET ended_at = ? WHERE device_id = ? AND type = ? AND ended_at IS NULL`,
    [endedAt, deviceId, type],
  );
}
