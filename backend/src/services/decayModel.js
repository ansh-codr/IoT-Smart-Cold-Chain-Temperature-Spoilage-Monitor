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

/**
 * Compute the Dual-Modal Spoilage Risk Index (SRI) fusing
 * Arrhenius kinetic thermal ageing with MQ-135 biochemical gas release.
 *
 * @param {object} reading - { temp_c, voc_raw, humidity }
 * @param {object} profile - { t_min_c, t_max_c, t_ref_c, voc_baseline, voc_spoil_delta }
 * @param {object|null} shelfLife - { remaining_life_percent, rate_factor }
 * @returns {object} SRI analysis details
 */
export function computeSpoilageRiskIndex(reading, profile, shelfLife = null) {
  if (!reading || !profile) return null;

  const tempC = Number(reading.temp_c);
  const vocRaw = Number(reading.voc_raw ?? 0);
  const tMin = Number(profile.t_min_c);
  const tMax = Number(profile.t_max_c);
  const vocBaseline = Number(profile.voc_baseline ?? 500);
  const vocSpoilDelta = Math.max(1, Number(profile.voc_spoil_delta ?? 800));

  // 1. Thermal Component (0 - 100)
  let excursionPenalty = 0;
  if (tempC > tMax) {
    const deltaT = tempC - tMax;
    const rateFactor = shelfLife?.rate_factor ?? computeRateFactor(tempC, profile);
    excursionPenalty = Math.min(60, deltaT * 4.0) + Math.min(30, Math.max(0, rateFactor - 1.0) * 8.0);
  } else if (tempC < tMin) {
    const deltaT = tMin - tempC;
    excursionPenalty = Math.min(70, deltaT * 12.0); // Cold-damage / freezing denaturation
  }

  const consumedPct = shelfLife?.remaining_life_percent != null
    ? Math.max(0, 100 - Number(shelfLife.remaining_life_percent))
    : 0;

  const thermalComponent = Math.min(100, (consumedPct * 0.4) + excursionPenalty);

  // 2. Biochemical Gas Component (0 - 100)
  const deltaVoc = Math.max(0, vocRaw - vocBaseline);
  const gasComponent = Math.min(100, (deltaVoc / vocSpoilDelta) * 100);

  // 3. Synergistic Coupling Factor (gamma >= 1.0)
  let synergyFactor = 1.0;
  if (thermalComponent > 25 && gasComponent > 25) {
    synergyFactor = 1.0 + Math.min(0.35, ((thermalComponent * gasComponent) / 10000) * 0.5);
  }

  // 4. Synthesized Dual-Modal Score (0 - 100)
  const baseScore = (0.55 * thermalComponent) + (0.45 * gasComponent);
  const rawScore = baseScore * synergyFactor;
  const sriScore = Math.min(100, Math.round(rawScore * 10) / 10);

  // 5. Clinical / Logistics Classification
  let level = 'nominal';
  let statusLabel = 'OPTIMAL INTEGRITY';
  let details = 'Product biological envelope verified within safe reference bounds';

  if (sriScore >= 75) {
    level = 'critical';
    statusLabel = 'CRITICAL SPOILAGE HAZARD';
    details = 'Active volatile biomarker breakthrough detected co-occurring with thermal degradation';
  } else if (sriScore >= 50) {
    level = 'moderate';
    statusLabel = 'ELEVATED SPOILAGE RISK';
    details = 'Early metabolic volatile emissions or safe thermal envelope breached';
  } else if (sriScore >= 25) {
    level = 'low';
    statusLabel = 'STABLE / AGING';
    details = 'Nominal Arrhenius kinetic degradation under active monitoring';
  }

  return {
    sri_score: sriScore,
    level,
    status_label: statusLabel,
    thermal_component: Math.round(thermalComponent * 10) / 10,
    gas_component: Math.round(gasComponent * 10) / 10,
    synergy_factor: Math.round(synergyFactor * 100) / 100,
    details
  };
}
