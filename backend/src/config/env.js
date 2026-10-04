/**
 * config/env.js — Typed, validated environment configuration
 *
 * Why validate env at startup: crashes at boot with a clear message are
 * far better than silent mis-configuration that causes data corruption later.
 *
 * All other modules should import from here rather than reading process.env
 * directly. That way type coercions (parseInt, etc.) happen in one place.
 */

import { z } from 'zod';

const EnvSchema = z.object({
  HOST:               z.string().default('0.0.0.0'),
  PORT:               z.coerce.number().int().default(3000),
  DB_HOST:            z.string().default('127.0.0.1'),
  DB_PORT:            z.coerce.number().int().default(3306),
  DB_USER:            z.string().default('root'),
  DB_PASSWORD:        z.string().default(''),
  DB_NAME:            z.string().default('coldchain'),
  DECAY_MODEL:        z.enum(['arrhenius', 'q10']).default('arrhenius'),
  MAX_GAP_S:          z.coerce.number().int().positive().default(600),
  VOC_CONSECUTIVE_N:  z.coerce.number().int().positive().default(3),
  SSE_KEEPALIVE_MS:   z.coerce.number().int().positive().default(15000),
  ONLINE_THRESHOLD_S: z.coerce.number().int().positive().default(30),
  OFFLINE_ALERT_S:    z.coerce.number().int().positive().default(120),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] ❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
