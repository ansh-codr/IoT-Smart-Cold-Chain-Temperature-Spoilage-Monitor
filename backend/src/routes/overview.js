import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const overviewRouter = Router();

overviewRouter.get('/overview', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.activeOrg?.org_id || 1;

    // 1. Total active shipments
    const [shipRows] = await pool.execute(
      `SELECT COUNT(*) AS total_active FROM shipments WHERE org_id = ? AND status IN ('planned', 'in_transit', 'inspection')`,
      [orgId]
    );

    // 2. Total inventory count & quantity
    const [invRows] = await pool.execute(
      `SELECT COUNT(*) AS total_batches, COALESCE(SUM(quantity), 0) AS total_quantity 
         FROM inventory_items WHERE org_id = ? AND status = 'available'`,
      [orgId]
    );

    // 3. Devices status (online / offline)
    const [devRows] = await pool.execute(
      `SELECT d.device_id, d.name, ds.last_ts, ds.last_rate_factor, ds.consumed_life_hours
         FROM devices d
         LEFT JOIN device_state ds ON ds.device_id = d.device_id
        WHERE d.org_id = ? OR d.org_id IS NULL`,
      [orgId]
    );

    const now = Math.floor(Date.now() / 1000);
    let onlineDevices = 0;
    let offlineDevices = 0;
    for (const d of devRows) {
      if (d.last_ts && (now - d.last_ts) <= 30) {
        onlineDevices++;
      } else {
        offlineDevices++;
      }
    }

    // 4. Critical alerts count
    const [alertRows] = await pool.execute(
      `SELECT COUNT(*) AS active_critical 
         FROM alerts a
         JOIN devices d ON d.device_id = a.device_id
        WHERE (d.org_id = ? OR d.org_id IS NULL) AND a.ended_at IS NULL AND a.severity = 'critical'`,
      [orgId]
    );

    // 5. Near-expiry inventory (batches expiring in next 7 days)
    const sevenDaysLater = now + 86400 * 7;
    const [expiryRows] = await pool.execute(
      `SELECT COUNT(*) AS near_expiry_count 
         FROM inventory_items 
        WHERE org_id = ? AND status = 'available' AND expiry_date IS NOT NULL AND expiry_date <= ?`,
      [orgId, sevenDaysLater]
    );

    // 6. Pending replacement requests
    const [repRows] = await pool.execute(
      `SELECT COUNT(*) AS pending_replacements 
         FROM replacement_requests 
        WHERE org_id = ? AND status IN ('pending_approval', 'approved')`,
      [orgId]
    );

    res.json({
      stats: {
        active_shipments: Number(shipRows[0].total_active),
        inventory_batches: Number(invRows[0].total_batches),
        inventory_quantity: Number(invRows[0].total_quantity),
        online_devices: onlineDevices,
        offline_devices: offlineDevices,
        critical_alerts: Number(alertRows[0].active_critical),
        near_expiry_batches: Number(expiryRows[0].near_expiry_count),
        pending_replacements: Number(repRows[0].pending_replacements)
      }
    });
  } catch (err) {
    next(err);
  }
});

