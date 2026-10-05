import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { PutProfileBodySchema } from '../config/schemas.js';
import { pool } from '../db/pool.js';
import * as stateRepo from '../db/stateRepo.js';
import * as readingsRepo from '../db/readingsRepo.js';
import { recomputeFromReadings, computeRemaining } from '../services/decayModel.js';
import * as sseManager from '../realtime/sseManager.js';
import createHttpError from 'http-errors';

export const devicesRouter = Router();

devicesRouter.put('/:device_id/profile', validate(PutProfileBodySchema, 'body'), async (req, res, next) => {
  try {
    const { device_id } = req.params;
    const { profile_id } = req.body;

    const device = await stateRepo.getDevice(device_id);
    if (!device) {
      throw createHttpError(404, `Device '${device_id}' not found`);
    }

    const profile = await stateRepo.getProfile(profile_id);
    if (!profile) {
      throw createHttpError(404, `Profile with id ${profile_id} not found`);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Update device profile
      await stateRepo.updateDeviceProfile(device_id, profile_id);

      // Recompute consumed life
      const readings = await readingsRepo.getAllReadingsSorted(device_id);
      let newState = { consumed_life_hours: 0, last_ts: 0, last_rate_factor: 1.0 };
      
      if (readings.length > 0) {
        newState = recomputeFromReadings(readings, profile, { sortFirst: false });
      }

      let bufferedCount = readings.filter(r => r.buffered).length;
      const now = Math.floor(Date.now() / 1000);
      
      await stateRepo.overwriteState(conn, device_id, newState, now, bufferedCount);
      
      await conn.commit();

      // Broadcast status
      const rem = computeRemaining(newState.consumed_life_hours, profile);
      sseManager.broadcast(device_id, 'status', {
        device_id,
        online: (now - newState.last_ts) <= 30,
        remaining_life_hours: rem.remaining_life_hours,
        remaining_life_percent: rem.remaining_life_percent,
        rate_factor: Number(newState.last_rate_factor),
        active_alert: null // or fetch actual open alert
      });

      res.json({
        device_id,
        profile_id,
        message: "Profile updated successfully"
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});
