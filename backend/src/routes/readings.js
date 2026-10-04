/**
 * routes/readings.js — POST /api/readings, GET /api/readings
 *
 * SCAFFOLD STUB — to be implemented by the backend logic agent.
 *
 * Why stub exists: Gives the next agent a clearly typed starting point
 * that already imports the correct schema and middleware, so it only
 * needs to fill in the handler bodies.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ReadingsPostSchema, GetReadingsQuerySchema } from '../config/schemas.js';

export const readingsRouter = Router();

// POST /api/readings — ingest single or batch readings from ESP32
readingsRouter.post('/readings', validate(ReadingsPostSchema), async (_req, res, next) => {
  try {
    // TODO: call readingsService.ingest(req.body)
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'readings ingestion not yet implemented' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/readings?device_id=&from=&to=&limit=
readingsRouter.get('/readings', validate(GetReadingsQuerySchema, 'query'), async (_req, res, next) => {
  try {
    // TODO: call readingsService.query(req.query)
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'readings query not yet implemented' } });
  } catch (err) {
    next(err);
  }
});
