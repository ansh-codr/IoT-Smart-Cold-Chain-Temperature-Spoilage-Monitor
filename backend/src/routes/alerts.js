import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetAlertsQuerySchema } from '../config/schemas.js';
import { getAlerts } from '../services/alertService.js';

export const alertsRouter = Router();

alertsRouter.get('/alerts', validate(GetAlertsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { device_id, limit } = req.query;
    const alerts = await getAlerts(device_id, limit);
    
    // cast decimals to number
    const formatted = alerts.map(a => ({
      ...a,
      duration_s: a.duration_s !== null ? Number(a.duration_s) : null,
      peak_value: a.peak_value !== null ? Number(a.peak_value) : null
    }));
    
    res.json({
      device_id,
      count: formatted.length,
      alerts: formatted
    });
  } catch (err) {
    next(err);
  }
});
