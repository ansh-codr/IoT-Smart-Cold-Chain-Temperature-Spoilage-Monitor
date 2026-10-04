# Decay Model — Arrhenius / Q10 Shelf Life Calculator
**Smart Cold Chain Monitor — Backend Implementation Reference**  
**Status: Specification. The backend agent MUST implement this exactly.**

---

## Purpose

This document defines the physics-based decay model used to estimate the remaining shelf life of a cold-chain product from a continuous stream of temperature readings. The model integrates temperature-dependent ageing over time so that brief excursions above ideal storage temperature correctly shorten the predicted life.

---

## 1. Physical Foundation

Biological spoilage (microbial growth, enzymatic degradation) follows an Arrhenius-type temperature dependence:

```
k(T) = A · exp(-Ea / (R · T))
```

Where:
- `k(T)` — reaction rate at temperature T
- `A` — pre-exponential frequency factor (not needed; we use a ratio)
- `Ea` — activation energy in J/mol
- `R` — universal gas constant = **8.314 J/(mol·K)**
- `T` — absolute temperature in Kelvin

---

## 2. Rate Factor Calculation

We compute a dimensionless **rate factor** relative to the reference storage temperature:

```
rate_factor = k(T) / k(T_ref)
            = exp( (Ea/R) · (1/T_ref_K - 1/T_K) )
```

Where:
- `T_ref_K = T_ref_C + 273.15` — reference temperature in Kelvin
- `T_K = temp_c + 273.15` — current reading temperature in Kelvin
- `Ea` — activation energy from `product_profiles.ea_kj_per_mol` × 1000 (convert kJ → J)
- `R = 8.314`

### Interpretation of rate_factor

| rate_factor | Meaning |
|---|---|
| `< 1.0` | Product ageing **slower** than reference (below-ideal temperature) |
| `= 1.0` | Ideal storage; ageing at the reference rate |
| `> 1.0` | Product ageing **faster** than reference |
| `3.0` | Product ageing at 3× the reference rate |

---

## 3. Q10 Alternative Model

The Q10 coefficient is an empirical simplification:

```
rate_factor = Q10 ^ ((temp_c - T_ref_C) / 10)
```

Where `Q10` comes from `product_profiles.q10`.

### Model Selection

A configuration flag `DECAY_MODEL` in `.env` (or `config/decay.js`) selects the model:

- `DECAY_MODEL=arrhenius` — use the Arrhenius formula (**default**)
- `DECAY_MODEL=q10` — use the Q10 formula

The backend must read this flag at startup and apply it consistently for all devices. Mixing models within a single device's history is not supported.

---

## 4. Consumed Life Accumulation

For each new reading, the service updates `device_state.consumed_life_hours`:

```
dt_seconds = current_ts - device_state.last_ts
dt_hours   = clamp(dt_seconds, 0, MAX_GAP_S) / 3600

consumed_life_hours += rate_factor × dt_hours
```

### MAX_GAP_S (Gap Clamping)

`MAX_GAP_S` is set to **600 seconds (10 minutes)** by default and must be configurable via `.env`.

**Why?** If a device goes offline for hours or days, the gap between the last reading timestamp and the next one is unknowable in terms of actual conditions. We cannot assume the temperature was constant at the last known value the whole time. Instead, we clamp the time delta to at most 10 minutes per inter-reading interval. This means a long offline gap is accounted for as at most one "standard interval" of consumption, which is conservative but honest.

**Alternative for buffered batches:** When a late batch arrives (all readings flagged `buffered: true`), the readings *are* ordered in time and their actual timestamps are valid. In this case, the full time delta between consecutive buffered readings is used (still clamped at `MAX_GAP_S` per pair).

### Special Cases for dt

- `dt_seconds < 0` — clock skew or out-of-order delivery; **skip consumption update** for this pair, log a warning.
- `dt_seconds = 0` — two readings at the same timestamp; rate_factor is still applied with `dt_hours = 0`, so no consumption added (correct).
- `device_state.last_ts = 0` — first-ever reading for this device; set `last_ts = current_ts` without adding any consumption.

---

## 5. Remaining Shelf Life

```
remaining_life_hours   = max(0, shelf_life_hours_at_ref - consumed_life_hours)
remaining_life_percent = (remaining_life_hours / shelf_life_hours_at_ref) × 100
```

- `remaining_life_hours` is floored at **0** — it never goes negative.
- `remaining_life_percent` is therefore also bounded to **[0, 100]**.

---

## 6. Handling Buffered (Late-Arriving) Batches

When the ESP32 reconnects after an offline period, it sends all buffered readings in one POST with `buffered: true`. These readings have timestamps that are **in the past** relative to the server's current time.

### Recompute Procedure

1. Insert all buffered readings into the `readings` table (using IGNORE for duplicates).
2. Reload the full reading history for the device ordered by `ts` ascending.
3. Reset `consumed_life_hours = 0` and `last_ts = 0` for the device.
4. Walk through all readings in order, applying the accumulation formula to reconstruct the consumed life from the beginning.
5. Update `device_state` with the final accumulated value.

**Why from the beginning?** Because the buffered readings interleave with previously received readings, and the time deltas between them change. A partial recompute starting from an arbitrary checkpoint risks compounding error.

**Performance note:** For long-lived devices with many readings, this recompute can be expensive. A future optimisation is to checkpoint `consumed_life_hours` at regular intervals, but this is deferred. Document the trade-off.

---

## 7. VOC-Based Spoilage Suspicion (Indicative Only)

The MQ-135 sensor is a **non-selective semiconductor gas sensor** that responds to a broad range of volatile organic compounds (VOCs), ammonia, and CO₂. Its output is a raw 12-bit ADC value — it does not directly measure concentration in ppm without calibration.

### Rule

```
if voc_raw > (profile.voc_baseline + profile.voc_spoil_delta)
   for N ≥ 3 consecutive readings:
   → raise SPOILAGE_SUSPECTED alert (critical)
```

- `voc_baseline` and `voc_spoil_delta` are per-profile parameters stored in `product_profiles`.
- N = 3 is the default; must be configurable via `.env` as `VOC_CONSECUTIVE_N`.
- The alert clears when the VOC reading drops back below the threshold.

### Humidity Context

`humidity` (from DHT22) is stored and surfaced in the API but **does not directly enter the decay calculation** in Phase 1. High humidity can accelerate microbial growth and affect MQ-135 sensitivity. Both are noted in the dashboard as contextual information.

---

## 8. Assumptions and Limitations

The following assumptions are explicit. Any agent changing them must update this document:

1. **Uniform temperature between readings.** The rate factor is calculated using the temperature at the reading timestamp and applied to the entire interval since the previous reading. In reality, temperature varies continuously. This is a standard trapezoidal-integration approximation adequate for 30-second sampling intervals.

2. **Single-product-profile per device.** A device is assigned one profile at a time. Changing the profile mid-deployment resets or recomputes the consumed life according to the recompute procedure above (TBD by the profile-change service).

3. **MQ-135 readings are indicative only.** The sensor has not been calibrated with certified reference gases. VOC alerts should be treated as an additional signal, not a definitive spoilage determination.

4. **Ea and Q10 values are literature defaults.** The seeded values in `product_profiles` are illustrative. Real deployments must use values validated for the specific product, packaging, and microbial load.

5. **No temperature-humidity coupling in decay rate.** Humidity-corrected Arrhenius models (e.g., Modified Gompertz for specific pathogens) are out of scope for Phase 1.

6. **Clock drift / skew between firmware and server.** The firmware timestamp (`ts`) from the ESP32 is used for decay calculation, not the server receive time (`received_at`). If the ESP32 clock drifts significantly (e.g., no NTP sync after cold boot), readings may accumulate with incorrect deltas. A future phase should add NTP status to the device state.

7. **MAX_GAP_S clamping is conservative.** During a long offline gap, actual spoilage may have occurred at a much higher rate if the refrigeration failed. The clamped estimate will under-report consumption. This is a known and accepted limitation of offline operation.

8. **No path-dependence for Q10.** The Q10 model assumes an empirical relationship. For very large temperature swings, Arrhenius is more physically accurate.

---

## 9. Constants Reference

| Constant | Value | Source |
|---|---|---|
| `R` (gas constant) | 8.314 J/(mol·K) | NIST |
| `MAX_GAP_S` (default) | 600 s | Configurable |
| `VOC_CONSECUTIVE_N` (default) | 3 | Configurable |
| `DECAY_MODEL` (default) | `arrhenius` | Configurable |
| Online threshold | 30 s | API Contract |
| Offline alert threshold | 120 s | API Contract |

---

*End of Decay Model Specification v1.0*
