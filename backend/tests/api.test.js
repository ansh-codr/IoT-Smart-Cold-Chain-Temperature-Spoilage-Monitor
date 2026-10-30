import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';

test('GET /health returns 200 with ok status', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.ok(typeof res.body.uptime_s === 'number');
});

test('GET /api/profiles returns seeded profiles', async () => {
  const res = await request(app).get('/api/profiles');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.profiles));
  assert.ok(res.body.profiles.length >= 3);
});

test('GET /api/auth/me resolves simulated user in development', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('x-dev-email', 'tester@coldchainiq.com')
    .set('x-dev-name', 'Test Engineer');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.email, 'tester@coldchainiq.com');
  assert.ok(res.body.active_organization);
});

test('GET /api/overview returns aggregated statistics', async () => {
  const res = await request(app)
    .get('/api/overview')
    .set('x-dev-email', 'tester@coldchainiq.com');

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.stats);
  assert.ok('active_shipments' in res.body.stats);
  assert.ok('inventory_batches' in res.body.stats);
});

test('GET /api/inventory returns seeded inventory batches', async () => {
  const res = await request(app)
    .get('/api/inventory')
    .set('x-dev-email', 'tester@coldchainiq.com');

  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.items));
});

test.after(async () => {
  const { pool } = await import('../src/db/pool.js');
  await pool.end();
});
