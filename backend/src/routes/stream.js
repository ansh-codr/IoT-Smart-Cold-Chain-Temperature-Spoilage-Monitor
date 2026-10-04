/**
 * routes/stream.js — GET /api/stream (Server-Sent Events)
 *
 * SCAFFOLD STUB — to be implemented by the backend logic agent.
 *
 * Key SSE rules (from AGENTS.md and API_CONTRACT.md):
 * - Set correct headers before writing any data.
 * - Send `: keep-alive` comment every SSE_KEEPALIVE_MS milliseconds.
 * - Register req.on('close', cleanup) to prevent memory leaks.
 * - Import the sseManager from realtime/sseManager.js to register/deregister clients.
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { GetStreamQuerySchema } from '../config/schemas.js';

export const streamRouter = Router();

// GET /api/stream?device_id=
streamRouter.get('/stream', validate(GetStreamQuerySchema, 'query'), (req, res) => {
  // TODO: implement SSE using realtime/sseManager.js
  // Required headers for SSE:
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': SSE scaffold — not yet implemented\n\n');

  req.on('close', () => {
    // TODO: deregister client from sseManager
  });
});
