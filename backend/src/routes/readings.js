import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { ReadingsPostSchema, GetReadingsQuerySchema } from '../config/schemas.js';
import * as readingsService from '../services/readingsService.js';

export const readingsRouter = Router();

// POST /api/readings
readingsRouter.post('/readings', validate(ReadingsPostSchema, 'body'), async (req, res, next) => {
  try {
    const result = await readingsService.ingest(req.body);
    res.status(result.accepted > 0 ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/readings
readingsRouter.get('/readings', validate(GetReadingsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const data = await readingsService.query(req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
