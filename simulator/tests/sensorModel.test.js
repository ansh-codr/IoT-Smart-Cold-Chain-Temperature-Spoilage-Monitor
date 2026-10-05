import test from 'node:test';
import assert from 'node:assert';
import { PRNG, SensorModel } from '../src/sensorModel.js';

test('PRNG is deterministic', () => {
  const prng1 = new PRNG(12345);
  const prng2 = new PRNG(12345);
  assert.strictEqual(prng1.next(), prng2.next());
  assert.strictEqual(prng1.gaussian(), prng2.gaussian());
});

test('SensorModel bounds and smoothing', () => {
  const prng = new PRNG(123);
  const model = new SensorModel(prng, { vocBaseline: 300, inertia: 1.0 });
  
  // Set a target and see if it moves
  model.setTargetTemp(10.0);
  const r1 = model.tick();
  assert.ok(r1.temp_c > 4.0, `Expected temp to rise, got ${r1.temp_c}`);
  assert.ok(r1.humidity >= 0 && r1.humidity <= 100);
  assert.ok(r1.voc_raw >= 0 && r1.voc_raw <= 4095);
});
