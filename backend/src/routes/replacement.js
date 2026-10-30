import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import createHttpError from 'http-errors';

export const replacementRouter = Router();

// GET /api/replacements — List replacement requests
replacementRouter.get('/replacements', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const { status } = req.query;

    let query = `
      SELECT rr.*,
             p.name AS product_name,
             p.t_min_c, p.t_max_c,
             s.shipment_code,
             u.display_name AS requester_name
        FROM replacement_requests rr
        JOIN product_profiles p ON p.id = rr.profile_id
        LEFT JOIN shipments s ON s.id = rr.shipment_id
        LEFT JOIN users u ON u.id = rr.requested_by_user_id
       WHERE rr.org_id = ?
    `;
    const params = [orgId];

    if (status) {
      query += ` AND rr.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY rr.id DESC`;

    const [rows] = await pool.execute(query, params);

    // Fetch allocations for each request
    for (const reqRow of rows) {
      const [allocations] = await pool.execute(
        `SELECT ra.*, w.name AS warehouse_name, i.batch_number
           FROM replacement_allocations ra
           JOIN warehouses w ON w.id = ra.warehouse_id
           JOIN inventory_items i ON i.id = ra.inventory_id
          WHERE ra.request_id = ?`,
        [reqRow.id]
      );
      reqRow.allocations = allocations;
    }

    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/replacements — Create replacement request
replacementRouter.post('/replacements', requireAuth, async (req, res, next) => {
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const { shipment_id, profile_id, required_quantity, unit, destination, required_by_ts, priority, reason } = req.body;

    if (!profile_id || !required_quantity || !destination || !required_by_ts || !reason) {
      throw createHttpError(400, 'Missing required replacement request fields');
    }

    const now = Math.floor(Date.now() / 1000);
    const requestCode = `REP-${Date.now().toString().slice(-6)}`;

    const [result] = await pool.execute(
      `INSERT INTO replacement_requests
         (request_code, org_id, shipment_id, profile_id, required_quantity, unit, destination, required_by_ts, priority, reason, status, requested_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?)`,
      [
        requestCode, orgId, shipment_id || null, profile_id, required_quantity,
        unit || 'units', destination, required_by_ts, priority || 'normal',
        reason, req.user?.id || null, now, now
      ]
    );

    res.status(201).json({ success: true, request_id: result.insertId, request_code: requestCode });
  } catch (err) {
    next(err);
  }
});

// POST /api/replacements/:id/allocate — Allocate stock from authorized warehouse(s)
replacementRouter.post('/replacements/:id/allocate', requireAuth, requireRole('platform_admin', 'org_manager'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const orgId = req.activeOrg?.org_id || 1;
    const requestId = req.params.id;
    const { allocations } = req.body; // Array of { warehouse_id, inventory_id, quantity }

    if (!allocations || !allocations.length) {
      throw createHttpError(400, 'Allocations list cannot be empty');
    }

    await conn.beginTransaction();
    const now = Math.floor(Date.now() / 1000);

    let totalAllocated = 0;

    for (const alloc of allocations) {
      // Lock inventory row and verify quantity
      const [invRows] = await conn.execute(
        `SELECT quantity FROM inventory_items WHERE id = ? AND warehouse_id = ? AND org_id = ? FOR UPDATE`,
        [alloc.inventory_id, alloc.warehouse_id, orgId]
      );
      if (!invRows.length || Number(invRows[0].quantity) < Number(alloc.quantity)) {
        throw createHttpError(400, `Insufficient stock in batch ID ${alloc.inventory_id}`);
      }

      // Decrement inventory
      const newBal = Number(invRows[0].quantity) - Number(alloc.quantity);
      await conn.execute(
        `UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?`,
        [newBal, now, alloc.inventory_id]
      );

      // Record allocation record
      await conn.execute(
        `INSERT INTO replacement_allocations (request_id, warehouse_id, inventory_id, allocated_quantity, allocated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [requestId, alloc.warehouse_id, alloc.inventory_id, alloc.quantity, now]
      );

      // Record stock movement
      await conn.execute(
        `INSERT INTO stock_movements 
           (org_id, inventory_id, movement_type, quantity_delta, balance_after, reference_id, notes, created_by_user_id, created_at)
         VALUES (?, ?, 'dispatch', ?, ?, ?, 'Replacement allocation', ?, ?)`,
        [orgId, alloc.inventory_id, -Number(alloc.quantity), newBal, `REQ-${requestId}`, req.user?.id || null, now]
      );

      totalAllocated += Number(alloc.quantity);
    }

    // Update replacement request status to allocated
    await conn.execute(
      `UPDATE replacement_requests SET status = 'allocated', updated_at = ? WHERE id = ? AND org_id = ?`,
      [now, requestId, orgId]
    );

    await conn.commit();
    res.json({ success: true, message: `Successfully allocated ${totalAllocated} units` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});
