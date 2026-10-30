import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const adminRouter = Router();

// GET /api/admin/overview — Platform-wide stats across all organizations
adminRouter.get('/admin/overview', requireAuth, requireRole('platform_admin'), async (req, res, next) => {
  try {
    const [orgCount] = await pool.execute(`SELECT COUNT(*) as count FROM organizations`);
    const [userCount] = await pool.execute(`SELECT COUNT(*) as count FROM users`);
    const [devCount] = await pool.execute(`SELECT COUNT(*) as count FROM devices`);
    const [shipCount] = await pool.execute(`SELECT COUNT(*) as count FROM shipments`);
    const [auditRows] = await pool.execute(
      `SELECT a.*, u.email as user_email, o.name as org_name 
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN organizations o ON o.id = a.org_id
        ORDER BY a.id DESC LIMIT 20`
    );

    res.json({
      platform: {
        total_organizations: orgCount[0].count,
        total_users: userCount[0].count,
        total_devices: devCount[0].count,
        total_shipments: shipCount[0].count,
        recent_audit_logs: auditRows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users — List all platform users with org memberships
adminRouter.get('/admin/users', requireAuth, requireRole('platform_admin'), async (req, res, next) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.id, u.email, u.display_name, u.system_role, u.is_active, u.created_at,
              GROUP_CONCAT(CONCAT(o.name, ' (', om.role, ')') SEPARATOR ', ') AS organizations_list
         FROM users u
         LEFT JOIN organization_members om ON om.user_id = u.id
         LEFT JOIN organizations o ON o.id = om.org_id
        GROUP BY u.id
        ORDER BY u.id ASC`
    );
    res.json({ users });
  } catch (err) {
    next(err);
  }
});
