/**
 * db/stateRepo.js — DB helpers for device_state and devices tables.
 *
 * device_state is updated after every reading ingestion.
 * devices is read to resolve profiles and auto-registered for unknown device_ids.
 */

import { pool } from './pool.js';

// ─── device_state ─────────────────────────────────────────────────────────────

/**
 * Get current state for a device. Returns null if no row exists yet.
 *
 * @param {object} conn - pool or transaction connection
 * @param {string} deviceId
 * @returns {Promise<object|null>}
 */
export async function getState(conn, deviceId) {
  const [rows] = await conn.execute(
    `SELECT device_id, consumed_life_hours, last_ts, last_rate_factor,
            updated_at, buffered_recovered_count
       FROM device_state
      WHERE device_id = ?`,
    [deviceId],
  );
  return rows[0] ?? null;
}

/**
 * Upsert device_state after a reading is processed.
 *
 * @param {object} conn - pool or transaction connection
 * @param {string} deviceId
 * @param {{ consumed_life_hours: number, last_ts: number, last_rate_factor: number }} state
 * @param {number} now - Unix seconds UTC
 * @param {boolean} incrementBuffered - if true, increment buffered_recovered_count
 */
export async function upsertState(conn, deviceId, state, now, incrementBuffered = false) {
  const bufIncrement = incrementBuffered ? 1 : 0;
  await conn.execute(
    `INSERT INTO device_state
        (device_id, consumed_life_hours, last_ts, last_rate_factor, updated_at, buffered_recovered_count)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        consumed_life_hours      = VALUES(consumed_life_hours),
        last_ts                  = VALUES(last_ts),
        last_rate_factor         = VALUES(last_rate_factor),
        updated_at               = VALUES(updated_at),
        buffered_recovered_count = buffered_recovered_count + ?`,
    [
      deviceId,
      state.consumed_life_hours,
      state.last_ts,
      state.last_rate_factor,
      now,
      0,           // initial insert count
      bufIncrement, // ON DUPLICATE KEY increment
    ],
  );
}

/**
 * Overwrite device_state completely (used after full recompute).
 * Also sets buffered_recovered_count to provided value.
 *
 * @param {object} conn
 * @param {string} deviceId
 * @param {{ consumed_life_hours: number, last_ts: number, last_rate_factor: number }} state
 * @param {number} now
 * @param {number} bufferedCount - total buffered readings for this device
 */
export async function overwriteState(conn, deviceId, state, now, bufferedCount) {
  await conn.execute(
    `INSERT INTO device_state
        (device_id, consumed_life_hours, last_ts, last_rate_factor, updated_at, buffered_recovered_count)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        consumed_life_hours      = VALUES(consumed_life_hours),
        last_ts                  = VALUES(last_ts),
        last_rate_factor         = VALUES(last_rate_factor),
        updated_at               = VALUES(updated_at),
        buffered_recovered_count = VALUES(buffered_recovered_count)`,
    [
      deviceId,
      state.consumed_life_hours,
      state.last_ts,
      state.last_rate_factor,
      now,
      bufferedCount,
    ],
  );
}

// ─── devices ──────────────────────────────────────────────────────────────────

/**
 * Find a device row by id. Returns null if not found.
 *
 * @param {string} deviceId
 * @returns {Promise<object|null>}
 */
export async function getDevice(deviceId) {
  const [rows] = await pool.execute(
    `SELECT device_id, name, profile_id, created_at FROM devices WHERE device_id = ?`,
    [deviceId],
  );
  return rows[0] ?? null;
}

/**
 * Auto-register an unknown device with the dairy profile (id=1) as the default.
 * Per Phase 2 task spec: "Auto-register unknown device_id with default profile = dairy".
 *
 * @param {object} conn
 * @param {string} deviceId
 * @param {number} now - Unix seconds UTC
 */
export async function ensureDevice(conn, deviceId, now) {
  await conn.execute(
    `INSERT IGNORE INTO devices (device_id, name, profile_id, created_at)
     VALUES (?, ?, 1, ?)`,
    [deviceId, deviceId, now],
  );
}

/**
 * Update a device's profile_id.
 *
 * @param {string} deviceId
 * @param {number} profileId
 */
export async function updateDeviceProfile(deviceId, profileId) {
  const [result] = await pool.execute(
    `UPDATE devices SET profile_id = ? WHERE device_id = ?`,
    [profileId, deviceId],
  );
  return result.affectedRows;
}

/**
 * Fetch a device with its joined profile row.
 *
 * @param {string} deviceId
 * @returns {Promise<{ device: object, profile: object|null }|null>}
 */
export async function getDeviceWithProfile(deviceId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT d.device_id, d.name, d.profile_id, d.created_at,
            p.id AS p_id, p.name AS p_name,
            p.t_ref_c, p.t_min_c, p.t_max_c,
            p.shelf_life_hours_at_ref, p.q10, p.ea_kj_per_mol,
            p.voc_baseline, p.voc_spoil_delta
       FROM devices d
       LEFT JOIN product_profiles p ON p.id = d.profile_id
      WHERE d.device_id = ?`,
    [deviceId],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  const device = {
    device_id: row.device_id,
    name: row.name,
    profile_id: row.profile_id,
    created_at: row.created_at,
  };
  const profile = row.p_id
    ? {
        id: row.p_id,
        name: row.p_name,
        t_ref_c: row.t_ref_c,
        t_min_c: row.t_min_c,
        t_max_c: row.t_max_c,
        shelf_life_hours_at_ref: row.shelf_life_hours_at_ref,
        q10: row.q10,
        ea_kj_per_mol: row.ea_kj_per_mol,
        voc_baseline: row.voc_baseline,
        voc_spoil_delta: row.voc_spoil_delta,
      }
    : null;
  return { device, profile };
}

// ─── product_profiles ─────────────────────────────────────────────────────────

/**
 * List all product profiles.
 *
 * @returns {Promise<object[]>}
 */
export async function listProfiles() {
  const [rows] = await pool.execute(
    `SELECT id, name, t_ref_c, t_min_c, t_max_c, shelf_life_hours_at_ref,
            q10, ea_kj_per_mol, voc_baseline, voc_spoil_delta
       FROM product_profiles
      ORDER BY id ASC`,
  );
  return rows;
}

/**
 * Get a single profile by id.
 *
 * @param {number} profileId
 * @returns {Promise<object|null>}
 */
export async function getProfile(profileId) {
  const [rows] = await pool.execute(
    `SELECT id, name, t_ref_c, t_min_c, t_max_c, shelf_life_hours_at_ref,
            q10, ea_kj_per_mol, voc_baseline, voc_spoil_delta
       FROM product_profiles WHERE id = ?`,
    [profileId],
  );
  return rows[0] ?? null;
}
