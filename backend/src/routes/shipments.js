import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import createHttpError from 'http-errors';

export const shipmentsRouter = Router();

// GET /api/shipments — List shipments
shipmentsRouter.get('/shipments', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const { status } = req.query;

    let query = `
      SELECT s.*, 
             w.name AS source_warehouse_name,
             d.name AS device_name,
             ds.last_ts AS device_last_ts,
             ds.last_rate_factor
        FROM shipments s
        JOIN warehouses w ON w.id = s.source_warehouse_id
        LEFT JOIN devices d ON d.device_id = s.assigned_device_id
        LEFT JOIN device_state ds ON ds.device_id = s.assigned_device_id
       WHERE s.org_id = ?
    `;
    const params = [orgId];

    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY s.id DESC`;

    const [rows] = await pool.execute(query, params);

    // Fetch items for each shipment
    for (const ship of rows) {
      const [items] = await pool.execute(
        `SELECT si.*, p.name AS product_name, p.t_min_c, p.t_max_c
           FROM shipment_items si
           JOIN product_profiles p ON p.id = si.profile_id
          WHERE si.shipment_id = ?`,
        [ship.id]
      );
      ship.items = items;
    }

    res.json({ shipments: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/shipments — Create new shipment with atomic inventory check & decrement
shipmentsRouter.post('/shipments', requireAuth, requireRole('platform_admin', 'org_manager'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const { shipment_code, source_warehouse_id, destination_name, destination_address, assigned_device_id, departure_time, expected_arrival_time, items, notes } = req.body;

    if (!shipment_code || !source_warehouse_id || !destination_name || !items || !items.length) {
      throw createHttpError(400, 'Missing required shipment parameters or items');
    }

    await conn.beginTransaction();
    const now = Math.floor(Date.now() / 1000);

    // 1. Insert shipment record
    const [shipResult] = await conn.execute(
      `INSERT INTO shipments 
         (org_id, shipment_code, source_warehouse_id, destination_name, destination_address, assigned_device_id, status, departure_time, expected_arrival_time, risk_level, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'in_transit', ?, ?, 'low', ?, ?, ?)`,
      [
        orgId, shipment_code, source_warehouse_id, destination_name, 
        destination_address || null, assigned_device_id || null, 
        departure_time || now, expected_arrival_time || (now + 86400 * 2),
        notes || null, now, now
      ]
    );

    const shipmentId = shipResult.insertId;

    // 2. Validate and decrement inventory for each item
    for (const item of items) {
      if (item.inventory_id) {
        const [invRows] = await conn.execute(
          `SELECT quantity FROM inventory_items WHERE id = ? AND org_id = ? FOR UPDATE`,
          [item.inventory_id, orgId]
        );
        if (!invRows.length || Number(invRows[0].quantity) < Number(item.quantity)) {
          throw createHttpError(400, `Insufficient stock for inventory item ID ${item.inventory_id}`);
        }

        // Decrement stock
        const newBalance = Number(invRows[0].quantity) - Number(item.quantity);
        await conn.execute(
          `UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?`,
          [newBalance, now, item.inventory_id]
        );

        // Record stock movement
        await conn.execute(
          `INSERT INTO stock_movements 
             (org_id, inventory_id, movement_type, quantity_delta, balance_after, reference_id, notes, created_by_user_id, created_at)
           VALUES (?, ?, 'dispatch', ?, ?, ?, 'Shipment dispatch', ?, ?)`,
          [orgId, item.inventory_id, -Number(item.quantity), newBalance, shipment_code, req.user?.id || null, now]
        );
      }

      // Insert shipment_item
      await conn.execute(
        `INSERT INTO shipment_items (shipment_id, inventory_id, profile_id, quantity, unit)
         VALUES (?, ?, ?, ?, ?)`,
        [shipmentId, item.inventory_id || null, item.profile_id, item.quantity, item.unit || 'units']
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, shipment_id: shipmentId, shipment_code });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

