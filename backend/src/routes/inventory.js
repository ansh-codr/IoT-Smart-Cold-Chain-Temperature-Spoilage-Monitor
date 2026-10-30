import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import createHttpError from 'http-errors';

export const inventoryRouter = Router();

// GET /api/inventory — List inventory items with profile & warehouse details
inventoryRouter.get('/inventory', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const { warehouse_id, status } = req.query;

    let query = `
      SELECT i.*, 
             p.name AS product_name, p.t_min_c, p.t_max_c, p.shelf_life_hours_at_ref,
             w.name AS warehouse_name, w.location AS warehouse_location
        FROM inventory_items i
        JOIN product_profiles p ON p.id = i.profile_id
        JOIN warehouses w ON w.id = i.warehouse_id
       WHERE i.org_id = ?
    `;
    const params = [orgId];

    if (warehouse_id) {
      query += ` AND i.warehouse_id = ?`;
      params.push(warehouse_id);
    }
    if (status) {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY i.expiry_date ASC, i.id DESC`;

    const [rows] = await pool.execute(query, params);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory — Add new inventory batch
inventoryRouter.post('/inventory', requireAuth, requireRole('platform_admin', 'org_manager'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const { warehouse_id, profile_id, batch_number, quantity, unit, mfg_date, expiry_date } = req.body;

    if (!warehouse_id || !profile_id || !batch_number || quantity === undefined) {
      throw createHttpError(400, 'Missing required inventory fields');
    }

    await conn.beginTransaction();

    const now = Math.floor(Date.now() / 1000);
    const [result] = await conn.execute(
      `INSERT INTO inventory_items 
         (org_id, warehouse_id, profile_id, batch_number, quantity, unit, mfg_date, expiry_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)
       ON DUPLICATE KEY UPDATE 
         quantity = quantity + VALUES(quantity),
         updated_at = VALUES(updated_at)`,
      [orgId, warehouse_id, profile_id, batch_number, quantity, unit || 'units', mfg_date || null, expiry_date || null, now, now]
    );

    const inventoryId = result.insertId || (await conn.execute(`SELECT id FROM inventory_items WHERE batch_number=? AND warehouse_id=?`, [batch_number, warehouse_id]))[0][0].id;

    // Log Stock Movement
    await conn.execute(
      `INSERT INTO stock_movements 
         (org_id, inventory_id, movement_type, quantity_delta, balance_after, reference_id, notes, created_by_user_id, created_at)
       VALUES (?, ?, 'receive', ?, ?, ?, ?, ?, ?)`,
      [orgId, inventoryId, quantity, quantity, 'MANUAL-RECEIVE', 'Stock receive', req.user?.id || null, now]
    );

    await conn.commit();
    res.status(201).json({ success: true, inventory_id: inventoryId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/warehouses — List warehouses
inventoryRouter.get('/warehouses', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const [rows] = await pool.execute(
      `SELECT w.*, COUNT(i.id) AS total_batches, COALESCE(SUM(i.quantity), 0) AS total_stock
         FROM warehouses w
         LEFT JOIN inventory_items i ON i.warehouse_id = w.id
        WHERE w.org_id = ?
        GROUP BY w.id
        ORDER BY w.name ASC`,
      [orgId]
    );
    res.json({ warehouses: rows });
  } catch (err) {
    next(err);
  }
});

