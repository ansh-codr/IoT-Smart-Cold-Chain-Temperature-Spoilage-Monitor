/**
 * app.js — Express application factory
 *
 * Keeps startup concerns separate from Express route wiring.
 * Extends the existing IoT APIs with ColdChain IQ multi-tenant features.
 */

import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';

// Existing IoT core routes
import { readingsRouter } from './routes/readings.js';
import { statusRouter } from './routes/status.js';
import { alertsRouter } from './routes/alerts.js';
import { profilesRouter } from './routes/profiles.js';
import { devicesRouter } from './routes/devices.js';
import { streamRouter } from './routes/stream.js';
import { reportRouter } from './routes/report.js';
import { simRouter } from './routes/sim.js';

// ColdChain IQ extended management routes
import { authRouter } from './routes/auth.js';
import { overviewRouter } from './routes/overview.js';
import { inventoryRouter } from './routes/inventory.js';
import { shipmentsRouter } from './routes/shipments.js';
import { replacementRouter } from './routes/replacement.js';
import { adminRouter } from './routes/admin.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', healthRouter);

// Existing sensor ingestion & realtime routes
app.use('/api', readingsRouter);
app.use('/api', statusRouter);
app.use('/api', alertsRouter);
app.use('/api', profilesRouter);
app.use('/api/devices', devicesRouter);
app.use('/api', streamRouter);
app.use('/api', reportRouter);
app.use('/api', simRouter);

// Platform & enterprise routes
app.use('/api', authRouter);
app.use('/api', overviewRouter);
app.use('/api', inventoryRouter);
app.use('/api', shipmentsRouter);
app.use('/api', replacementRouter);
app.use('/api', adminRouter);

// ── Central Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
