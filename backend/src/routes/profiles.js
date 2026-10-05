import { Router } from 'express';
import * as stateRepo from '../db/stateRepo.js';

export const profilesRouter = Router();

profilesRouter.get('/profiles', async (req, res, next) => {
  try {
    const profiles = await stateRepo.listProfiles();
    
    // Cast numeric types correctly
    const formatted = profiles.map(p => ({
      ...p,
      t_ref_c: Number(p.t_ref_c),
      t_min_c: Number(p.t_min_c),
      t_max_c: Number(p.t_max_c),
      shelf_life_hours_at_ref: Number(p.shelf_life_hours_at_ref),
      q10: Number(p.q10),
      ea_kj_per_mol: Number(p.ea_kj_per_mol),
    }));

    res.json({ profiles: formatted });
  } catch (err) {
    next(err);
  }
});
