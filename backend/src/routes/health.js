/**
 * routes/health.js — GET /health
 *
 * Why no /api prefix: health checks are typically called by load balancers,
 * Docker HEALTHCHECK, and monitoring systems that expect /health directly.
 * It also avoids coupling the health check to the API versioning.
 *
 * This route intentionally has NO database dependency so it returns
 * even when the DB is unavailable (useful for distinguishing app vs DB failures).
 */

import { Router } from 'express';

export const healthRouter = Router();

const startedAt = Math.floor(Date.now() / 1000);

healthRouter.get('/health', (_req, res) => {
  const now = Math.floor(Date.now() / 1000);
  res.status(200).json({
    status: 'ok',
    ts: now,
    uptime_s: now - startedAt,
  });
});
