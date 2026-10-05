/**
 * services/decayModel.js — Pure functions, no DB access.
 *
 * Implements the Arrhenius / Q10 decay model exactly as specified
 * in docs/DECAY_MODEL.md. All constants come from profile rows or env.
 *
 * R (universal gas constant) = 8.314 J/(mol·K)  — NIST value, never hardcode differently.
 * Ea is stored in kJ/mol in the DB; we multiply by 1000 here to get J/mol.
 */

const R = 8.314; // J/(mol·K) — universal gas constant

/**
 * Compute the dimensionless rate factor for a given temperature.
 *
 * rate_factor = 1.0 means ageing at the reference (ideal) rate.
 * rate_factor > 1.0 means faster ageing (too warm).
 * rate_factor < 1.0 means slower ageing (too cold).
 *
 * @param {number} tempC        - Current temperature in °C
 * @param {object} profile      - Row from product_profiles table
 * @param {string} [model]      - 'arrhenius' | 'q10'; defaults to env DECAY_MODEL
 * @returns {number}
 */
export function computeRateFactor(
  tempC,
  profile,
  model = process.env.DECAY_MODEL ?? 'arrhenius',
) {
  const { t_ref_c, ea_kj_per_mol, q10 } = profile;
  const t_c = Number(tempC);

  if (model === 'q10') {
    // Q10 formula: rate = Q10 ^ ((T - T_ref) / 10)
    return Math.pow(Number(q10), (t_c - Number(t_ref_c)) / 10);
  }

  // Arrhenius: rate = exp( (Ea/R) × (1/T_ref_K - 1/T_K) )
  // Convert Ea from kJ/mol → J/mol before dividing by R
  const eaJ    = Number(ea_kj_per_mol) * 1000;
  const tRefK  = Number(t_ref_c) + 273.15;
  const tK     = t_c + 273.15;
  return Math.exp((eaJ / R) * (1 / tRefK - 1 / tK));
}

/**
 * Apply a single reading to an accumulated state and return the new state.
 *
 * Rules per DECAY_MODEL.md §4:
 *  - dt < 0: skip (clock skew / out-of-order); return unchanged state.
 *  - last_ts === 0: first reading; record ts but add 0 consumption.
 *  - dt > 0: clamp to MAX_GAP_S, convert to hours, multiply by rate_factor.
 *
 * @param {{ consumed_life_hours: number, last_ts: number, last_rate_factor: number }} state
 * @param {{ ts: number, temp_c: number }} reading
 * @param {object} profile
 * @param {{ maxGapS?: number, model?: string }} [opts]
 * @returns {{ consumed_life_hours: number, last_ts: number, last_rate_factor: number }}
 */
export function applyReading(state, reading, profile, opts = {}) {
  const maxGapS = opts.maxGapS ?? parseInt(process.env.MAX_GAP_S ?? '600', 10);
  const model   = opts.model   ?? (process.env.DECAY_MODEL ?? 'arrhenius');

  const { ts, temp_c } = reading;
  const { last_ts, consumed_life_hours } = state;
  const rateFactor = computeRateFactor(temp_c, profile, model);

  // First-ever reading for this device: anchor timestamp, no consumption yet.
  if (last_ts === 0) {
    return {
      consumed_life_hours,
      last_ts: ts,
      last_rate_factor: rateFactor,
    };
  }

  const dtSeconds = ts - last_ts;

  // Skip backward/same-timestamp readings to avoid negative consumption.
  if (dtSeconds <= 0) {
    return { ...state, last_rate_factor: rateFactor };
  }

  // Clamp gap to prevent over-counting during long offline periods.
  const dtHours = Math.min(dtSeconds, maxGapS) / 3600;
  const added   = rateFactor * dtHours;

  return {
    consumed_life_hours: Number(consumed_life_hours) + added,
    last_ts: ts,
    last_rate_factor: rateFactor,
  };
}

/**
 * Compute remaining shelf life from accumulated consumption.
 *
 * @param {number} consumedHours
 * @param {object} profile
 * @returns {{ remaining_life_hours: number, remaining_life_percent: number }}
 */
export function computeRemaining(consumedHours, profile) {
  const total   = Number(profile.shelf_life_hours_at_ref);
  const remaining = Math.max(0, total - consumedHours);
  const percent   = (remaining / total) * 100;
  return {
    remaining_life_hours:   Math.round(remaining * 10000) / 10000,
    remaining_life_percent: Math.min(100, Math.round(percent * 100) / 100),
  };
}

/**
 * Replay all readings in ts order from scratch to compute final state.
 *
 * Used when a buffered batch arrives with older timestamps that interleave
 * with previously stored readings — per DECAY_MODEL.md §6.
 *
 * Input MUST be sorted by ts ascending. If not sorted, pass unsorted and
 * set sortFirst = true.
 *
 * @param {Array<{ ts: number, temp_c: number }>} readings - sorted ascending
 * @param {object} profile
 * @param {{ maxGapS?: number, model?: string, sortFirst?: boolean }} [opts]
 * @returns {{ consumed_life_hours: number, last_ts: number, last_rate_factor: number }}
 */
export function recomputeFromReadings(readings, profile, opts = {}) {
  const sorted = opts.sortFirst
    ? [...readings].sort((a, b) => a.ts - b.ts)
    : readings;

  let state = { consumed_life_hours: 0, last_ts: 0, last_rate_factor: 1.0 };
  for (const r of sorted) {
    state = applyReading(state, r, profile, opts);
  }
  return state;
}
