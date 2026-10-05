import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetStreamQuerySchema } from '../config/schemas.js';
import * as sseManager from '../realtime/sseManager.js';
import * as stateRepo from '../db/stateRepo.js';
import * as readingsRepo from '../db/readingsRepo.js';
import * as alertsRepo from '../db/alertsRepo.js';
import { computeRemaining } from '../services/decayModel.js';
import { pool } from '../db/pool.js';

export const streamRouter = Router();

streamRouter.get('/stream', validate(GetStreamQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { device_id } = req.query;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    sseManager.addClient(device_id, res);

    req.on('close', () => {
      sseManager.removeClient(device_id, res);
    });

    // Send initial status event on connect
    try {
      const deviceData = await stateRepo.getDeviceWithProfile(device_id);
      const state = await stateRepo.getState(pool, device_id);
      
      if (deviceData && deviceData.profile && state) {
        const rem = computeRemaining(state.consumed_life_hours, deviceData.profile);
        const now = Math.floor(Date.now() / 1000);
        const activeAlert = await alertsRepo.getPrimaryOpenAlert(device_id);
        
        sseManager.broadcast(device_id, 'status', {
          device_id,
          online: (now - state.last_ts) <= 30,
          remaining_life_hours: rem.remaining_life_hours,
          remaining_life_percent: rem.remaining_life_percent,
          rate_factor: Number(state.last_rate_factor),
          active_alert: activeAlert ? {
            ...activeAlert,
            peak_value: activeAlert.peak_value !== null ? Number(activeAlert.peak_value) : null
          } : null
        });
      }
    } catch (err) {
      console.error('Failed to send initial status on connect', err);
    }

  } catch (err) {
    next(err);
  }
});
