import test from 'node:test';
import assert from 'node:assert';
import { computeRateFactor, applyReading, computeRemaining, recomputeFromReadings } from '../src/services/decayModel.js';

const mockProfile = {
  shelf_life_hours_at_ref: 100,
  t_ref_c: 4,
  ea_kj_per_mol: 50,
  q10: 2.0
};

test('decayModel - rate_factor == 1.0 at T_ref (Arrhenius)', () => {
  const rate = computeRateFactor(4, mockProfile, 'arrhenius');
  assert.ok(Math.abs(rate - 1.0) < 0.001, `Expected ~1.0, got ${rate}`);
});

test('decayModel - rate_factor == 1.0 at T_ref (Q10)', () => {
  const rate = computeRateFactor(4, mockProfile, 'q10');
  assert.strictEqual(rate, 1.0);
});

test('decayModel - rate_factor > 1 above T_ref', () => {
  const rate = computeRateFactor(14, mockProfile, 'q10');
  assert.strictEqual(rate, 2.0); // 10 degrees above, Q10=2
});

test('decayModel - rate_factor < 1 below T_ref', () => {
  const rate = computeRateFactor(-6, mockProfile, 'q10');
  assert.strictEqual(rate, 0.5); // 10 degrees below, Q10=2
});

test('decayModel - gap clamping', () => {
  const initialState = { consumed_life_hours: 0, last_ts: 1000, last_rate_factor: 1.0 };
  const reading = { ts: 1000 + 3600, temp_c: 4 }; // 1 hour gap
  // But maxGapS is default 600s (10 min = 1/6 hr)
  
  const newState = applyReading(initialState, reading, mockProfile, { maxGapS: 600, model: 'q10' });
  
  // Rate is 1.0. Gap clamped to 600s = 0.1666 hours.
  assert.ok(Math.abs(newState.consumed_life_hours - (600/3600)) < 0.001);
});

test('decayModel - non-increasing ts ignored', () => {
  const initialState = { consumed_life_hours: 5, last_ts: 2000, last_rate_factor: 1.0 };
  const reading = { ts: 1500, temp_c: 4 }; 
  
  const newState = applyReading(initialState, reading, mockProfile);
  assert.strictEqual(newState.consumed_life_hours, 5); // Unchanged
  // rate factor is still calculated for the current temp
  assert.ok(Math.abs(newState.last_rate_factor - 1.0) < 0.001); 
});

test('decayModel - recomputeFromReadings', () => {
  const readings = [
    { ts: 1000, temp_c: 4 },
    { ts: 1600, temp_c: 14 } // 600s gap, 10C above -> rate=2.0 -> adds 2 * (600/3600) = 0.333 hr
  ];
  const state = recomputeFromReadings(readings, mockProfile, { maxGapS: 600, model: 'q10' });
  
  assert.strictEqual(state.last_ts, 1600);
  assert.strictEqual(state.last_rate_factor, 2.0);
  assert.ok(Math.abs(state.consumed_life_hours - (2 * (600/3600))) < 0.001);
});

test('decayModel - computeRemaining', () => {
  const res = computeRemaining(25, mockProfile); // 25 hours consumed out of 100
  assert.strictEqual(res.remaining_life_hours, 75);
  assert.strictEqual(res.remaining_life_percent, 75);
  
  const res2 = computeRemaining(150, mockProfile); // over consumed
  assert.strictEqual(res2.remaining_life_hours, 0);
  assert.strictEqual(res2.remaining_life_percent, 0);
});
