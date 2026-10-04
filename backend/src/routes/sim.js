/**
 * routes/sim.js — POST /api/sim/scenario
 *
 * SCAFFOLD STUB — reserved for the simulator agent.
 * Returns 501 Not Implemented per API_CONTRACT.md until the simulator is built.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { PostSimScenarioSchema } from '../config/schemas.js';

export const simRouter = Router();

// POST /api/sim/scenario
simRouter.post('/sim/scenario', validate(PostSimScenarioSchema), (_req, res) => {
  res.status(501).json({
    error: { code: 'NOT_IMPLEMENTED', message: 'Simulator is not yet implemented' },
  });
});
