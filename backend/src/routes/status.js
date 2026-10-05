import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetStatusQuerySchema } from '../config/schemas.js';
import { pool } from '../db/pool.js';
import * as stateRepo from '../db/stateRepo.js';
import * as readingsRepo from '../db/readingsRepo.js';
import * as alertsRepo from '../db/alertsRepo.js';
import { computeRemaining } from '../services/decayModel.js';
import createHttpError from 'http-errors';

export const statusRouter = Router();

statusRouter.get('/status', validate(GetStatusQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { device_id } = req.query;
    
    // Check device exists
    const deviceData = await stateRepo.getDeviceWithProfile(device_id);
    if (!deviceData) {
      throw createHttpError(404, `Device '${device_id}' not found`);
    }

    const state = await stateRepo.getState(pool, device_id);
    const latestReading = await readingsRepo.getLatestReading(device_id);
    const activeAlert = await alertsRepo.getPrimaryOpenAlert(device_id);

    const now = Math.floor(Date.now() / 1000);
    const online = state ? ((now - state.last_ts) <= 30) : false;

    let shelfLife = null;
    if (deviceData.profile && state) {
      const rem = computeRemaining(state.consumed_life_hours, deviceData.profile);
      shelfLife = {
        remaining_life_hours: rem.remaining_life_hours,
        remaining_life_percent: rem.remaining_life_percent,
        rate_factor: Number(state.last_rate_factor),
        consumed_life_hours: Number(state.consumed_life_hours)
      };
    }

    // Convert booleans for JSON output if needed, but sqlite tinyint might return 0/1. 
    // In mysql2, boolean usually returns 0/1, so we cast to boolean.
    if (latestReading) {
      latestReading.buffered = Boolean(latestReading.buffered);
      // Ensure temp_c etc are numbers
      latestReading.temp_c = Number(latestReading.temp_c);
      latestReading.humidity = Number(latestReading.humidity);
      latestReading.voc_raw = Number(latestReading.voc_raw);
    }
    
    if (activeAlert) {
      activeAlert.peak_value = activeAlert.peak_value !== null ? Number(activeAlert.peak_value) : null;
    }

    res.json({
      device_id,
      online,
      last_seen_ts: state ? state.last_ts : 0,
      latest_reading: latestReading,
      shelf_life: shelfLife,
      active_alert: activeAlert,
      product_profile: deviceData.profile,
      buffered_recovered_count: state ? state.buffered_recovered_count : 0
    });
  } catch (err) {
    next(err);
  }
});
