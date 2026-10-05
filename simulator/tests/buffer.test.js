import test from 'node:test';
import assert from 'node:assert';
import { PRNG, SensorModel } from '../src/sensorModel.js';
import { ScenarioManager } from '../src/scenarios.js';

test('Buffer logic with offline_burst', () => {
  const prng = new PRNG(1);
  const model = new SensorModel(prng);
  const manager = new ScenarioManager(model);
  
  manager.setScenario('offline_burst');
  
  // 15s normal
  let res = manager.tick(15);
  assert.strictEqual(res.offline, false);

  // then offline
  res = manager.tick(5);
  assert.strictEqual(res.offline, true);
});
