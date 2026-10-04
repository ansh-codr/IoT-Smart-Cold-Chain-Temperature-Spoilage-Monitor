/**
 * routes/report.js — GET /api/report
 *
 * SCAFFOLD STUB — implementation deferred to a future phase.
 * Returns 501 Not Implemented per API_CONTRACT.md.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetReportQuerySchema } from '../config/schemas.js';

export const reportRouter = Router();

// GET /api/report?device_id=&from=&to=&format=csv|pdf
reportRouter.get('/report', validate(GetReportQuerySchema, 'query'), (_req, res) => {
  res.status(501).json({
    error: { code: 'NOT_IMPLEMENTED', message: 'Report generation is not yet implemented' },
  });
});
