/**
 * routes/status.js — GET /api/status
 *
 * SCAFFOLD STUB — to be implemented by the backend logic agent.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetStatusQuerySchema } from '../config/schemas.js';

export const statusRouter = Router();

// GET /api/status?device_id=
statusRouter.get('/status', validate(GetStatusQuerySchema, 'query'), async (_req, res, next) => {
  try {
    // TODO: call statusService.getStatus(req.query.device_id)
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'status not yet implemented' } });
  } catch (err) {
    next(err);
  }
});
