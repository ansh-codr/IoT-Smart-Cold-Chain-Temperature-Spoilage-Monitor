/**
 * server.js — Entry point
 *
 * Why here: Keeps the startup concerns (port binding, graceful shutdown)
 * separate from the Express app wiring (app.js). This makes testing easier
 * because tests can import app.js directly without binding a port.
 */

import 'dotenv/config';
import app from './app.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] Listening on http://${HOST}:${PORT}`);
  console.log(`[server] Decay model: ${process.env.DECAY_MODEL ?? 'arrhenius'}`);
});

// Graceful shutdown: close the HTTP server and DB pool on SIGTERM/SIGINT.
// This matters when running under nodemon or Docker.
const shutdown = (signal) => {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      const { pool } = await import('./db/pool.js');
      await pool.end();
      console.log('[server] DB pool closed');
    } catch {
      // Pool may not have been initialised if startup failed early
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
