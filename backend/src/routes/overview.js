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

    // 7. IoT Telemetry overview for the active organization's primary node
    // Get primary device (or first available)
    const primaryDevice = devRows[0] || null;
    let telemetrySnapshot = null;

    if (primaryDevice) {
      const [latestReadings] = await pool.execute(
        `SELECT seq, ts, temp_c, ds18b20_temp_c, dht22_temp_c, humidity, voc_raw, buffered
           FROM readings
          WHERE device_id = ?
          ORDER BY ts DESC, seq DESC
          LIMIT 1`,
        [primaryDevice.device_id]
      );

      const latestReading = latestReadings[0] ? {
        seq: Number(latestReadings[0].seq),
        ts: Number(latestReadings[0].ts),
        temp_c: Number(latestReadings[0].temp_c),
        ds18b20_temp_c: latestReadings[0].ds18b20_temp_c !== null && latestReadings[0].ds18b20_temp_c !== undefined
          ? Number(latestReadings[0].ds18b20_temp_c)
          : null,
        dht22_temp_c: latestReadings[0].dht22_temp_c !== null && latestReadings[0].dht22_temp_c !== undefined
          ? Number(latestReadings[0].dht22_temp_c)
          : null,
        humidity: latestReadings[0].humidity !== null && latestReadings[0].humidity !== undefined
          ? Number(latestReadings[0].humidity)
          : null,
        voc_raw: Number(latestReadings[0].voc_raw),
        buffered: Boolean(latestReadings[0].buffered === 1 || latestReadings[0].buffered === true)
      } : null;

      // Check primary open alert
      const [openAlerts] = await pool.execute(
        `SELECT id, type, severity, started_at, peak_value, message
           FROM alerts
          WHERE device_id = ? AND ended_at IS NULL
          ORDER BY started_at DESC
          LIMIT 1`,
        [primaryDevice.device_id]
      );

      // Check device profile
      const [profRows] = await pool.execute(
        `SELECT p.id, p.name, p.t_min_c, p.t_max_c, p.t_ref_c, p.shelf_life_hours_at_ref, p.q10, p.ea_kj_per_mol, p.voc_baseline, p.voc_spoil_delta
           FROM devices d
           JOIN product_profiles p ON p.id = d.profile_id
          WHERE d.device_id = ?`,
        [primaryDevice.device_id]
      );

      telemetrySnapshot = {
        device_id: primaryDevice.device_id,
        device_name: primaryDevice.name,
        online: primaryDevice.last_ts ? ((now - primaryDevice.last_ts) <= 30) : false,
        last_seen_ts: primaryDevice.last_ts || null,
        latest_reading: latestReading,
        active_alert: openAlerts[0] ? {
          ...openAlerts[0],
          peak_value: openAlerts[0].peak_value != null ? Number(openAlerts[0].peak_value) : null
        } : null,
        profile: profRows[0] ? {
          ...profRows[0],
          t_min_c: Number(profRows[0].t_min_c),
          t_max_c: Number(profRows[0].t_max_c),
          t_ref_c: Number(profRows[0].t_ref_c),
          shelf_life_hours_at_ref: Number(profRows[0].shelf_life_hours_at_ref),
          q10: Number(profRows[0].q10),
          ea_kj_per_mol: Number(profRows[0].ea_kj_per_mol)
        } : null,
        rate_factor: primaryDevice.last_rate_factor != null ? Number(primaryDevice.last_rate_factor) : 1.0,
        consumed_life_hours: primaryDevice.consumed_life_hours != null ? Number(primaryDevice.consumed_life_hours) : 0
      };
    }

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
      },
      telemetry: telemetrySnapshot,
      server_time: now
    });
  } catch (err) {
    next(err);
  }
});

