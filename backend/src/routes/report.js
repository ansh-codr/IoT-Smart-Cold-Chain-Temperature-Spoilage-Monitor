/**
 * routes/report.js — GET /api/report
 *
 * Implements historical CSV and JSON export for regulatory compliance & HACCP audits.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetReportQuerySchema } from '../config/schemas.js';
import * as readingsRepo from '../db/readingsRepo.js';
import * as stateRepo from '../db/stateRepo.js';
import { generateReadingsCsv } from '../services/telegramFormatter.js';
import createHttpError from 'http-errors';

export const reportRouter = Router();

// GET /api/report?device_id=&from=&to=&format=csv|json
reportRouter.get('/report', validate(GetReportQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { device_id, from, to, format } = req.query;

    const device = await stateRepo.getDeviceWithProfile(device_id);
    if (!device) {
      throw createHttpError(404, `Device '${device_id}' not found`);
    }

    const readings = await readingsRepo.queryReadings({
      device_id,
      from: from ?? 0,
      to: to ?? Math.floor(Date.now() / 1000),
      limit: 1000,
    });

    if (format === 'csv') {
      const csvData = generateReadingsCsv(readings);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${device_id}_compliance_audit_${Date.now()}.csv"`);
      return res.status(200).send(csvData);
    }

    // Default or json format
    res.json({
      device_id,
      profile: device.profile,
      from: from ?? 0,
      to: to ?? Math.floor(Date.now() / 1000),
      record_count: readings.length,
      readings,
    });
  } catch (err) {
    next(err);
  }
});
