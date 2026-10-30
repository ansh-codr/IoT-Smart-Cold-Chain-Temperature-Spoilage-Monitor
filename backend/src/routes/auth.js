import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.get('/auth/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      display_name: req.user.display_name,
      system_role: req.user.system_role
    },
    organizations: req.userOrgs,
    active_organization: req.activeOrg
  });
});
