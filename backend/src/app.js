/**
 * app.js — Express application factory
 *
 * Why separated from server.js: allows tests to import the app
 * without binding a port. Also keeps middleware wiring visible
 * in one place without mixing I/O concerns.
 */

import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

// Allow cross-origin requests (required for the dashboard served by Vite dev server)
app.use(cors());

// Parse JSON request bodies; limit size to prevent large-payload attacks
app.use(express.json({ limit: '1mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — outside /api prefix, lightweight, no DB dependency
app.use('/', healthRouter);

// API routes — implemented in Phase 2
import { readingsRouter }  from './routes/readings.js';
import { statusRouter }    from './routes/status.js';
import { alertsRouter }    from './routes/alerts.js';
import { profilesRouter }  from './routes/profiles.js';
import { devicesRouter }   from './routes/devices.js';
import { streamRouter }    from './routes/stream.js';
import { reportRouter }    from './routes/report.js';
import { simRouter }       from './routes/sim.js';

app.use('/api', readingsRouter);
app.use('/api', statusRouter);
app.use('/api', alertsRouter);
app.use('/api', profilesRouter);
app.use('/api/devices', devicesRouter); // specific prefix for devices (/:device_id/profile)
app.use('/api', streamRouter);
app.use('/api', reportRouter);
app.use('/api', simRouter);

// ── Central Error Handler ─────────────────────────────────────────────────────
// Must be registered LAST so it catches errors from all routes above.
app.use(errorHandler);

export default app;
