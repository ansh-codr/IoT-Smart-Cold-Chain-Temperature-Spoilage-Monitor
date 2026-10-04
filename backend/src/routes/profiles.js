/**
 * routes/profiles.js — GET /api/profiles
 *
 * SCAFFOLD STUB — to be implemented by the backend logic agent.
 */

import { Router } from 'express';

export const profilesRouter = Router();

// GET /api/profiles — returns all product profiles
profilesRouter.get('/profiles', async (_req, res, next) => {
  try {
    // TODO: call profilesService.listProfiles()
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'profiles not yet implemented' } });
  } catch (err) {
    next(err);
  }
});
