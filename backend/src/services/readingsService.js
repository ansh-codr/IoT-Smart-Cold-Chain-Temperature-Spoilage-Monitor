/**
 * services/readingsService.js
 *
 * Business logic for ingesting and querying readings.
 */

import { pool } from '../db/pool.js';
import * as readingsRepo from '../db/readingsRepo.js';
import * as stateRepo from '../db/stateRepo.js';
import { evaluate as evaluateAlerts } from './alertService.js';
import * as sseManager from '../realtime/sseManager.js';
import { applyReading, recomputeFromReadings, computeRemaining } from './decayModel.js';

export async function ingest(payload) {
  const readings = Array.isArray(payload) ? payload : [payload];
  if (readings.length === 0) return { accepted: 0, duplicates: 0 };

  const deviceId = readings[0].device_id;
  const now = Math.floor(Date.now() / 1000);

  let accepted = 0;
  let duplicates = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Auto-register unknown device (dairy profile by default)
    await stateRepo.ensureDevice(conn, deviceId, now);

    // 2. Fetch device & profile
    const deviceData = await stateRepo.getDeviceWithProfile(deviceId, conn);
    if (!deviceData) {
      throw new Error('Device registration failed unexpectedly');
    }
    const profile = deviceData.profile;

    // 3. Fetch current device state
    let state = await stateRepo.getState(conn, deviceId);
    if (!state) {
      state = { consumed_life_hours: 0, last_ts: 0, last_rate_factor: 1.0, buffered_recovered_count: 0 };
    }

    // 4. Insert readings
    const newlyInserted = [];
    let hasBuffered = false;
    let hasOutOfOrder = false;

    for (const r of readings) {
      const affected = await readingsRepo.insertReading(conn, r, now);
      if (affected === 1) {
        accepted++;
        newlyInserted.push(r);
        if (r.buffered) hasBuffered = true;
        if (r.ts < state.last_ts) hasOutOfOrder = true;
      } else {
        duplicates++;
      }
    }

    // 5. Update state
    if (newlyInserted.length > 0) {
      let newState;
      
      if (hasBuffered || hasOutOfOrder) {
        // Full recompute needed
        const allReadings = await readingsRepo.getAllReadingsSorted(deviceId, conn);
        // Do recompute if profile exists, otherwise just store latest timestamp
        if (profile) {
           newState = recomputeFromReadings(allReadings, profile, { sortFirst: false });
        } else {
           newState = { consumed_life_hours: 0, last_ts: allReadings[allReadings.length - 1].ts, last_rate_factor: 1.0 };
        }
        
        let bufferedCount = 0;
        for (const r of allReadings) {
          if (r.buffered) bufferedCount++;
        }
        await stateRepo.overwriteState(conn, deviceId, newState, now, bufferedCount);
      } else {
        // Incremental update (sort just in case they sent a batch out of order relative to itself, but all > last_ts)
        newlyInserted.sort((a, b) => a.ts - b.ts);
        newState = state;
        let bufInc = 0;
        for (const r of newlyInserted) {
          if (profile) {
            newState = applyReading(newState, r, profile);
          } else {
            newState = { ...newState, last_ts: r.ts };
          }
          if (r.buffered) bufInc++;
        }
        await stateRepo.upsertState(conn, deviceId, newState, now, bufInc > 0);
      }

      // 6. Evaluate alerts for the chronologically last reading inserted (if we have a profile)
      if (profile) {
        newlyInserted.sort((a, b) => a.ts - b.ts);
        const lastReading = newlyInserted[newlyInserted.length - 1];
        await evaluateAlerts(conn, lastReading, newState, profile);
      }

      await conn.commit();
      
      // 7. Broadcast SSE
      if (profile) {
        const finalState = await stateRepo.getState(pool, deviceId); // Use fresh connection to avoid transaction scope issues for read, or just reuse newState
        const rem = computeRemaining(newState.consumed_life_hours, profile);
        sseManager.broadcast(deviceId, 'status', {
          device_id: deviceId,
          online: (now - newState.last_ts) <= 30, // Per contract
          remaining_life_hours: rem.remaining_life_hours,
          remaining_life_percent: rem.remaining_life_percent,
          rate_factor: newState.last_rate_factor,
          active_alert: null // Will be handled by the alert service emitting directly, or could be joined here. For SSE, contract allows null active_alert in status if we emit alert events, but let's query it.
        });
      }

      // Broadcast 'reading' event
      for (const r of newlyInserted) {
        sseManager.broadcast(deviceId, 'reading', r);
      }
    } else {
      await conn.commit();
    }

    console.log(`[ingest] device=${deviceId} count=${readings.length} accepted=${accepted} duplicates=${duplicates}`);
    return { accepted, duplicates };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function query(params) {
  const readings = await readingsRepo.queryReadings(params);
  return {
    device_id: params.device_id,
    count: readings.length,
    readings
  };
}
