/**
 * services/alertService.js — Stateful alert management.
 *
 * Implements alert logic per API_CONTRACT.md.
 * NOTE: Contract specifies SHELF_LIFE_LOW warning < 20% (not 25%),
 * VOC_CONSECUTIVE_N = 3 (not 5) by default, and DEVICE_OFFLINE critical (not warning)
 * at 120s (not 30s). The implementation follows the API_CONTRACT.md as the
 * single source of truth.
 */

import { pool } from '../db/pool.js';
import * as alertsRepo from '../db/alertsRepo.js';
import * as readingsRepo from '../db/readingsRepo.js';
import * as sseManager from '../realtime/sseManager.js';

const VOC_CONSECUTIVE_N = parseInt(process.env.VOC_CONSECUTIVE_N ?? '3', 10);
const OFFLINE_ALERT_S = parseInt(process.env.OFFLINE_ALERT_S ?? '120', 10);

/**
 * Evaluates an alert condition. If it should be open, opens or escalates.
 * If it shouldn't be open, closes any existing open alert.
 * 
 * @param {object} conn 
 * @param {string} deviceId 
 * @param {string} type 
 * @param {boolean} conditionMet 
 * @param {string} severity 
 * @param {number} ts 
 * @param {number} value 
 * @param {string} message 
 */
async function processAlertCondition(conn, deviceId, type, conditionMet, severity, ts, value, message) {
  const openAlert = await alertsRepo.getOpenAlert(conn, deviceId, type);

  if (conditionMet) {
    if (!openAlert) {
      // Open new alert
      const id = await alertsRepo.openAlert(conn, deviceId, type, severity, ts, value, message);
      sseManager.broadcast(deviceId, 'alert', {
        device_id: deviceId,
        alert_id: id,
        type,
        severity,
        action: 'opened',
        started_at: ts,
        peak_value: value,
        message
      });
    } else {
      // Escalate if needed (warning -> critical) or update peak_value
      let newSeverity = openAlert.severity;
      if (openAlert.severity === 'warning' && severity === 'critical') {
        newSeverity = 'critical';
      }
      
      // For peak value, if it's TEMP_HIGH or VOC we want max. If TEMP_LOW or SHELF_LIFE we want min.
      // Simplify: just use the latest if it's "worse", but we can just use the provided logic or
      // track the max deviation. For now, simple peak value logic based on type.
      let newPeak = openAlert.peak_value;
      if (type === 'TEMP_HIGH' || type === 'SPOILAGE_SUSPECTED') {
        if (value > (openAlert.peak_value ?? -Infinity)) newPeak = value;
      } else if (type === 'TEMP_LOW' || type === 'SHELF_LIFE_LOW') {
        if (value < (openAlert.peak_value ?? Infinity)) newPeak = value;
      }

      if (newSeverity !== openAlert.severity || newPeak !== openAlert.peak_value) {
        await alertsRepo.escalateAlert(conn, openAlert.id, newSeverity, newPeak, message);
        
        if (newSeverity !== openAlert.severity) {
          sseManager.broadcast(deviceId, 'alert', {
            device_id: deviceId,
            alert_id: openAlert.id,
            type,
            severity: newSeverity,
            action: 'escalated',
            started_at: openAlert.started_at,
            peak_value: newPeak,
            message
          });
        }
      }
    }
  } else if (openAlert) {
    // Close the alert
    await alertsRepo.closeAlert(conn, openAlert.id, ts);
    sseManager.broadcast(deviceId, 'alert', {
      device_id: deviceId,
      alert_id: openAlert.id,
      type,
      severity: openAlert.severity,
      action: 'closed',
      started_at: openAlert.started_at,
      ended_at: ts,
      peak_value: openAlert.peak_value,
      message: openAlert.message
    });
  }
}

/**
 * Evaluate all alert conditions for a single new reading and the current device state.
 *
 * @param {object} conn         - DB connection (for transaction)
 * @param {object} reading      - The freshly inserted reading row
 * @param {object} deviceState  - Current device_state row
 * @param {object} profile      - Product profile for the device
 */
export async function evaluate(conn, reading, deviceState, profile) {
  if (!profile) return; // No profile, no alerts

  const { device_id, ts, temp_c, voc_raw } = reading;
  
  // 1. TEMP_HIGH
  let tempHighMet = false;
  let tempHighSev = 'warning';
  let tempHighMsg = '';
  if (temp_c > profile.t_max_c) {
    tempHighMet = true;
    if (temp_c > Number(profile.t_max_c) + 3) {
      tempHighSev = 'critical';
    }
    tempHighMsg = `Temperature exceeded upper limit of ${profile.t_max_c}°C`;
  }
  await processAlertCondition(conn, device_id, 'TEMP_HIGH', tempHighMet, tempHighSev, ts, temp_c, tempHighMsg);

  // 2. TEMP_LOW
  let tempLowMet = false;
  let tempLowSev = 'warning';
  let tempLowMsg = '';
  if (temp_c < profile.t_min_c) {
    tempLowMet = true;
    if (temp_c < Number(profile.t_min_c) - 3) {
      tempLowSev = 'critical';
    }
    tempLowMsg = `Temperature dropped below lower limit of ${profile.t_min_c}°C`;
  }
  await processAlertCondition(conn, device_id, 'TEMP_LOW', tempLowMet, tempLowSev, ts, temp_c, tempLowMsg);

  // 3. SHELF_LIFE_LOW
  const totalLife = Number(profile.shelf_life_hours_at_ref);
  const remainingLife = Math.max(0, totalLife - Number(deviceState.consumed_life_hours));
  const remainingPct = (remainingLife / totalLife) * 100;
  
  let shelfLowMet = false;
  let shelfLowSev = 'warning';
  let shelfLowMsg = '';
  // Contract says < 20% warning, < 10% critical
  if (remainingPct < 20) {
    shelfLowMet = true;
    if (remainingPct < 10) {
      shelfLowSev = 'critical';
      shelfLowMsg = 'Remaining shelf life below 10%';
    } else {
      shelfLowMsg = 'Remaining shelf life below 20%';
    }
  }
  await processAlertCondition(conn, device_id, 'SHELF_LIFE_LOW', shelfLowMet, shelfLowSev, ts, remainingPct, shelfLowMsg);

  // 4. SPOILAGE_SUSPECTED
  const latestReadings = await readingsRepo.getLatestReadings(device_id, VOC_CONSECUTIVE_N);
  let spoilageMet = false;
  const vocThreshold = Number(profile.voc_baseline) + Number(profile.voc_spoil_delta);
  if (latestReadings.length >= VOC_CONSECUTIVE_N) {
    spoilageMet = latestReadings.every(r => r.voc_raw > vocThreshold);
  }
  await processAlertCondition(conn, device_id, 'SPOILAGE_SUSPECTED', spoilageMet, 'critical', ts, voc_raw, `VOC exceeded baseline (indicative)`);
  
  // Close DEVICE_OFFLINE if open (since we just got a reading)
  const offlineAlert = await alertsRepo.getOpenAlert(conn, device_id, 'DEVICE_OFFLINE');
  if (offlineAlert) {
    await alertsRepo.closeAlert(conn, offlineAlert.id, ts);
    sseManager.broadcast(device_id, 'alert', {
      device_id,
      alert_id: offlineAlert.id,
      type: 'DEVICE_OFFLINE',
      severity: offlineAlert.severity,
      action: 'closed',
      started_at: offlineAlert.started_at,
      ended_at: ts,
      peak_value: offlineAlert.peak_value,
      message: offlineAlert.message
    });
  }
}

/**
 * Used by endpoints to fetch alerts.
 */
export async function getAlerts(deviceId, limit = 50) {
  return alertsRepo.listAlerts(deviceId, limit);
}
