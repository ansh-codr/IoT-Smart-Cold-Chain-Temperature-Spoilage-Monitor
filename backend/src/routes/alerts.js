/**
 * routes/alerts.js — GET /api/alerts
 *
 * SCAFFOLD STUB — to be implemented by the backend logic agent.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetAlertsQuerySchema } from '../config/schemas.js';

export const alertsRouter = Router();

// GET /api/alerts?device_id=&limit=
alertsRouter.get('/alerts', validate(GetAlertsQuerySchema, 'query'), async (_req, res, next) => {
  try {
    // TODO: call alertsService.getAlerts(req.query)
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'alerts not yet implemented' } });
  } catch (err) {
    next(err);
  }
});
