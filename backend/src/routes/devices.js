/**
 * routes/devices.js — PUT /api/devices/:device_id/profile
 *
 * SCAFFOLD STUB — to be implemented by the backend logic agent.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { PutProfileBodySchema } from '../config/schemas.js';

export const devicesRouter = Router();

// PUT /api/devices/:device_id/profile
devicesRouter.put('/devices/:device_id/profile', validate(PutProfileBodySchema), async (_req, res, next) => {
  try {
    // TODO: call devicesService.assignProfile(req.params.device_id, req.body.profile_id)
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'device profile assignment not yet implemented' } });
  } catch (err) {
    next(err);
  }
});
