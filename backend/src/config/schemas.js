/**
 * config/schemas.js — Zod schemas for API input validation
 *
 * These schemas are the authoritative definition of acceptable input shapes.
 * They must remain consistent with docs/API_CONTRACT.md.
 *
 * Rules:
 * - All sensor value ranges must match API_CONTRACT.md exactly.
 * - If a range changes here, update API_CONTRACT.md in the same commit.
 */

import { z } from 'zod';

// ─── Sensor range constants (mirror of API_CONTRACT.md) ──────────────────────
export const SENSOR_RANGES = {
  TEMP_C_MIN:     -40,
  TEMP_C_MAX:      85,
  HUMIDITY_MIN:     0,
  HUMIDITY_MAX:   100,
  VOC_RAW_MIN:      0,
  VOC_RAW_MAX:   4095,
  BATCH_MAX_SIZE:  200,
};

// ─── Single reading schema ────────────────────────────────────────────────────
export const SingleReadingSchema = z.object({
  device_id: z.string().min(1).max(64),
  ts:        z.number().int().positive(),
  temp_c:    z.number()
               .min(SENSOR_RANGES.TEMP_C_MIN, { message: `temp_c must be ≥ ${SENSOR_RANGES.TEMP_C_MIN}` })
               .max(SENSOR_RANGES.TEMP_C_MAX, { message: `temp_c must be ≤ ${SENSOR_RANGES.TEMP_C_MAX}` }),
  humidity:  z.number()
               .min(SENSOR_RANGES.HUMIDITY_MIN)
               .max(SENSOR_RANGES.HUMIDITY_MAX),
  voc_raw:   z.number().int()
               .min(SENSOR_RANGES.VOC_RAW_MIN)
               .max(SENSOR_RANGES.VOC_RAW_MAX),
  seq:       z.number().int().min(0),
  buffered:  z.boolean(),
});

// ─── Batch reading schema — array of singles, capped at 200 entries ──────────
export const BatchReadingSchema = z
  .array(SingleReadingSchema)
  .min(1)
  .max(SENSOR_RANGES.BATCH_MAX_SIZE, {
    message: `Batch may not exceed ${SENSOR_RANGES.BATCH_MAX_SIZE} readings`,
  });

// Accept either format from POST /api/readings
export const ReadingsPostSchema = SingleReadingSchema.or(BatchReadingSchema);

// ─── GET /api/readings query params ──────────────────────────────────────────
export const GetReadingsQuerySchema = z.object({
  device_id: z.string().min(1).max(64),
  from:      z.coerce.number().int().min(0).optional().default(0),
  to:        z.coerce.number().int().min(0).optional(),
  limit:     z.coerce.number().int().min(1).max(1000).optional().default(100),
});

// ─── GET /api/status query params ────────────────────────────────────────────
export const GetStatusQuerySchema = z.object({
  device_id: z.string().min(1).max(64),
});

// ─── GET /api/alerts query params ────────────────────────────────────────────
export const GetAlertsQuerySchema = z.object({
  device_id: z.string().min(1).max(64),
  limit:     z.coerce.number().int().min(1).max(500).optional().default(50),
});

// ─── PUT /api/devices/:device_id/profile body ────────────────────────────────
export const PutProfileBodySchema = z.object({
  profile_id: z.number().int().positive(),
});

// ─── GET /api/stream query params ────────────────────────────────────────────
export const GetStreamQuerySchema = z.object({
  device_id: z.string().min(1).max(64),
});

// ─── GET /api/report query params ────────────────────────────────────────────
export const GetReportQuerySchema = z.object({
  device_id: z.string().min(1).max(64),
  from:      z.coerce.number().int().positive(),
  to:        z.coerce.number().int().positive(),
  format:    z.enum(['csv', 'pdf']),
});

// ─── POST /api/sim/scenario body ─────────────────────────────────────────────
export const PostSimScenarioSchema = z.object({
  device_id: z.string().min(1).max(64),
  scenario:  z.enum(['normal', 'breach', 'offline_burst']),
});
