/**
 * db/readingsRepo.js — DB helpers for the readings table.
 *
 * All SQL is parameterized. No string interpolation of user data.
 * All functions accept a connection or pool — callers pass whichever
 * is appropriate (pool for reads, connection inside transactions for writes).
 */

import { pool } from './pool.js';

/**
 * Normalizes reading rows returned from MySQL (converts DECIMAL strings to numbers,
 * flags to booleans, and missing sensor values to null).
 */
export function formatReadingRow(row) {
  if (!row) return null;
  const out = {
    ...row,
    seq: Number(row.seq),
    ts: Number(row.ts),
    temp_c: Number(row.temp_c),
    ds18b20_temp_c: row.ds18b20_temp_c !== null && row.ds18b20_temp_c !== undefined ? Number(row.ds18b20_temp_c) : null,
    dht22_temp_c: row.dht22_temp_c !== null && row.dht22_temp_c !== undefined ? Number(row.dht22_temp_c) : null,
    humidity: row.humidity !== null && row.humidity !== undefined ? Number(row.humidity) : null,
    voc_raw: Number(row.voc_raw),
    buffered: Boolean(row.buffered === 1 || row.buffered === true),
  };
  if (row.id !== undefined) out.id = Number(row.id);
  if (row.received_at !== undefined) out.received_at = Number(row.received_at);
  return out;
}

/**
 * Insert a single reading with INSERT IGNORE (idempotent on device_id, seq).
 * Returns affectedRows (1 = inserted, 0 = duplicate).
 *
 * @param {object} conn - mysql2 connection or pool
 * @param {object} r - reading object
 * @param {number} receivedAt - Unix seconds UTC (server wall-clock time)
 * @returns {Promise<number>} affectedRows
 */
export async function insertReading(conn, r, receivedAt) {
  const ds18b20 = r.ds18b20_temp_c !== undefined && r.ds18b20_temp_c !== null ? r.ds18b20_temp_c : null;
  const dht22 = r.dht22_temp_c !== undefined && r.dht22_temp_c !== null ? r.dht22_temp_c : null;
  const humidity = r.humidity !== undefined && r.humidity !== null ? r.humidity : null;

  const [result] = await conn.execute(
    `INSERT IGNORE INTO readings
       (device_id, seq, ts, temp_c, ds18b20_temp_c, dht22_temp_c, humidity, voc_raw, buffered, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.device_id,
      r.seq,
      r.ts,
      r.temp_c,
      ds18b20,
      dht22,
      humidity,
      r.voc_raw,
      r.buffered ? 1 : 0,
      receivedAt,
    ],
  );
  return result.affectedRows;
}

/**
 * Fetch all readings for a device sorted by ts ASC.
 * Used for full recompute after buffered batch arrives.
 *
 * @param {string} deviceId
 * @returns {Promise<object[]>}
 */
export async function getAllReadingsSorted(deviceId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT id, device_id, seq, ts, temp_c, ds18b20_temp_c, dht22_temp_c, humidity, voc_raw, buffered, received_at
       FROM readings
      WHERE device_id = ?
      ORDER BY ts ASC, seq ASC`,
    [deviceId],
  );
  return rows.map(formatReadingRow);
}

/**
 * Fetch the latest N readings for a device sorted by ts DESC.
 * Used for VOC consecutive-reading check.
 *
 * @param {string} deviceId
 * @param {number} n
 * @returns {Promise<object[]>}
 */
export async function getLatestReadings(deviceId, n) {
  const [rows] = await pool.execute(
    `SELECT ts, temp_c, ds18b20_temp_c, dht22_temp_c, voc_raw
       FROM readings
      WHERE device_id = ?
      ORDER BY ts DESC, seq DESC
      LIMIT ?`,
    [deviceId, n],
  );
  return rows.map(r => ({
    ts: Number(r.ts),
    temp_c: Number(r.temp_c),
    ds18b20_temp_c: r.ds18b20_temp_c !== null && r.ds18b20_temp_c !== undefined ? Number(r.ds18b20_temp_c) : null,
    dht22_temp_c: r.dht22_temp_c !== null && r.dht22_temp_c !== undefined ? Number(r.dht22_temp_c) : null,
    voc_raw: Number(r.voc_raw),
  }));
}

/**
 * Fetch historical readings with optional time window and limit.
 * Results are ascending by ts (per API contract).
 *
 * @param {object} params
 * @param {string} params.device_id
 * @param {number} params.from  - Unix seconds, inclusive
 * @param {number} params.to    - Unix seconds, inclusive
 * @param {number} params.limit
 * @returns {Promise<object[]>}
 */
export async function queryReadings({ device_id, from, to, limit }) {
  const toTs = to ?? Math.floor(Date.now() / 1000);
  const [rows] = await pool.execute(
    `SELECT id, seq, ts, temp_c, ds18b20_temp_c, dht22_temp_c, humidity, voc_raw, buffered, received_at
       FROM readings
      WHERE device_id = ?
        AND ts >= ?
        AND ts <= ?
      ORDER BY ts ASC
      LIMIT ?`,
    [device_id, from, toTs, limit],
  );
  return rows.map(formatReadingRow);
}

/**
 * Count readings flagged as buffered for a device.
 * Used for buffered_recovered_count in /api/status.
 *
 * @param {string} deviceId
 * @returns {Promise<number>}
 */
export async function countBuffered(deviceId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM readings WHERE device_id = ? AND buffered = 1`,
    [deviceId],
  );
  return Number(rows[0].cnt);
}

/**
 * Fetch the single most recent reading for a device.
 *
 * @param {string} deviceId
 * @returns {Promise<object|null>}
 */
export async function getLatestReading(deviceId) {
  const [rows] = await pool.execute(
    `SELECT seq, ts, temp_c, ds18b20_temp_c, dht22_temp_c, humidity, voc_raw, buffered
       FROM readings
      WHERE device_id = ?
      ORDER BY ts DESC, seq DESC
      LIMIT 1`,
    [deviceId],
  );
  return rows[0] ? formatReadingRow(rows[0]) : null;
}
