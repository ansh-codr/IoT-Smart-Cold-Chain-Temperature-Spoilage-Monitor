import test from 'node:test';
import assert from 'node:assert';
import { PRNG, SensorModel } from '../src/sensorModel.js';
import { ScenarioManager } from '../src/scenarios.js';

test('ScenarioManager transitions', () => {
  const prng = new PRNG(1);
  const model = new SensorModel(prng);
  const manager = new ScenarioManager(model);

  manager.setScenario('breach');
  assert.strictEqual(manager.currentScenario, 'breach');
  
  // tick 20s (normal phase)
  manager.tick(20);
  assert.strictEqual(model.targetTemp, 4.0);

  // tick 10s more (ramping up)
  manager.tick(10);
  assert.strictEqual(model.targetTemp, 12.0);

  // set to door_open
  manager.setScenario('door_open');
  manager.tick(5);
  assert.strictEqual(model.targetTemp, 8.0);
});
