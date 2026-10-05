import { pool } from '../db/pool.js';
import * as alertsRepo from '../db/alertsRepo.js';
import * as sseManager from '../realtime/sseManager.js';

const OFFLINE_ALERT_S = parseInt(process.env.OFFLINE_ALERT_S ?? '120', 10);

/**
 * Check for DEVICE_OFFLINE alert.
 * 
 * @param {string} deviceId
 * @param {number} lastTs
 * @param {number} now
 */
export async function checkOfflineForDevice(deviceId, lastTs, now) {
  if (lastTs === 0) return; // Never sent a reading

  if (now - lastTs > OFFLINE_ALERT_S) {
    // Should be offline
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const openAlert = await alertsRepo.getOpenAlert(conn, deviceId, 'DEVICE_OFFLINE');
      if (!openAlert) {
        const id = await alertsRepo.openAlert(
          conn, 
          deviceId, 
          'DEVICE_OFFLINE', 
          'critical', 
          lastTs + OFFLINE_ALERT_S, 
          null, 
          `No reading received for > ${OFFLINE_ALERT_S} seconds`
        );
        await conn.commit();
        
        sseManager.broadcast(deviceId, 'alert', {
          device_id: deviceId,
          alert_id: id,
          type: 'DEVICE_OFFLINE',
          severity: 'critical',
          action: 'opened',
          started_at: lastTs + OFFLINE_ALERT_S,
          peak_value: null,
          message: `No reading received for > ${OFFLINE_ALERT_S} seconds`
        });
      } else {
        await conn.rollback();
      }
    } catch (err) {
      await conn.rollback();
      console.error(`[offlineWatcher] Error checking device ${deviceId}:`, err);
    } finally {
      conn.release();
    }
  }
}

let watcherTimer = null;

export function startOfflineWatcher() {
  watcherTimer = setInterval(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const [devices] = await pool.execute('SELECT device_id FROM devices');
      for (const row of devices) {
        const [stateRows] = await pool.execute('SELECT last_ts FROM device_state WHERE device_id = ?', [row.device_id]);
        if (stateRows.length > 0) {
          await checkOfflineForDevice(row.device_id, stateRows[0].last_ts, now);
        }
      }
    } catch (err) {
      console.error('[offlineWatcher] Run failed:', err);
    }
  }, 10000); // Check every 10s
}

export function stopOfflineWatcher() {
  if (watcherTimer) clearInterval(watcherTimer);
}
