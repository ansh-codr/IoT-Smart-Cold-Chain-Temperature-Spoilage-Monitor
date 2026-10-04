/**
 * services/decayService.js — SCAFFOLD STUB
 *
 * Implements the Arrhenius / Q10 decay model as specified in docs/DECAY_MODEL.md.
 * This is the MOST critical service — read DECAY_MODEL.md carefully before implementing.
 *
 * Constants:
 *   R (gas constant) = 8.314 J/(mol·K)
 *   MAX_GAP_S        from env.MAX_GAP_S (default 600 s)
 *   DECAY_MODEL      from env.DECAY_MODEL ('arrhenius' | 'q10')
 */

// import { env } from '../config/env.js';

const R = 8.314; // J/(mol·K)

/**
 * Compute the rate factor for a given temperature.
 *
 * @param {number} tempC       - Current temperature in °C
 * @param {number} tRefC       - Reference temperature in °C (from profile)
 * @param {number} eaKjPerMol  - Activation energy in kJ/mol (Arrhenius model)
 * @param {number} q10         - Q10 coefficient (Q10 model)
 * @param {'arrhenius'|'q10'} model
 * @returns {number} rate_factor (dimensionless; 1.0 = ideal)
 */
export function computeRateFactor(tempC, tRefC, eaKjPerMol, q10, model = 'arrhenius') {
  if (model === 'q10') {
    // Q10 formula: rate_factor = Q10 ^ ((T - T_ref) / 10)
    return Math.pow(q10, (tempC - tRefC) / 10);
  }

  // Arrhenius formula: rate_factor = exp((Ea/R) * (1/T_ref_K - 1/T_K))
  const eaJPerMol = eaKjPerMol * 1000; // convert kJ → J
  const tRefK = tRefC + 273.15;
  const tK    = tempC  + 273.15;
  return Math.exp((eaJPerMol / R) * (1 / tRefK - 1 / tK));
}

/**
 * Calculate the dt_hours to add to consumed life, clamped to MAX_GAP_S.
 *
 * @param {number} currentTs  - Current reading Unix timestamp (seconds)
 * @param {number} lastTs     - Previous reading Unix timestamp (seconds, 0 if first)
 * @param {number} maxGapS    - Maximum allowed gap in seconds
 * @returns {number} dt_hours (clamped, >= 0)
 */
export function computeDtHours(currentTs, lastTs, maxGapS) {
  if (lastTs === 0) return 0; // first reading — no consumption yet
  const dtS = currentTs - lastTs;
  if (dtS < 0) {
    // Clock skew or out-of-order reading — skip, log a warning in the caller
    return -1; // sentinel: caller should skip this update
  }
  return Math.min(dtS, maxGapS) / 3600;
}

/**
 * Recompute consumed_life_hours from scratch given an ordered list of readings.
 * Used when a buffered batch arrives that interleaves with existing readings.
 *
 * @param {object[]} orderedReadings - All readings for device, sorted by ts ASC
 * @param {object} profile           - Product profile row from DB
 * @param {number} maxGapS           - Clamping constant from env
 * @param {'arrhenius'|'q10'} model
 * @returns {{ consumed_life_hours: number, last_ts: number, last_rate_factor: number }}
 */
export function recomputeConsumedLife(orderedReadings, profile, maxGapS, model) {
  // TODO: implement per DECAY_MODEL.md §Recompute Procedure
  // Walk readings in order, apply computeRateFactor and computeDtHours to each pair
  void orderedReadings; void profile; void maxGapS; void model;
  throw new Error('decayService.recomputeConsumedLife not implemented');
}
