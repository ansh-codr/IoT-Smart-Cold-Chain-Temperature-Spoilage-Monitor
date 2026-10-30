import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import * as sseManager from '../src/realtime/sseManager.js';

// Unique device ID for testing to isolate test data
const TEST_DEVICE = `test-node-${Date.now()}`;
let testSeq = 1;

test.before(async () => {
  // Ensure test device exists or can be ingested
});

test('1. Valid payload containing both sensor temperatures is accepted', async () => {
  const payload = {
    device_id: TEST_DEVICE,
    seq: testSeq++,
    ts: Math.floor(Date.now() / 1000) - 100,
    temp_c: 4.82,
    ds18b20_temp_c: 4.82,
    dht22_temp_c: 5.10,
    humidity: 66.5,
    voc_raw: 420,
    buffered: false,
  };

  const res = await request(app)
    .post('/api/readings')
    .send(payload);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.accepted, 1);
  assert.strictEqual(res.body.duplicates, 0);
});

test('2. Legacy payload containing only temp_c still works', async () => {
  const payload = {
    device_id: TEST_DEVICE,
    seq: testSeq++,
    ts: Math.floor(Date.now() / 1000) - 90,
    temp_c: 4.50,
    humidity: 65.0,
    voc_raw: 410,
    buffered: false,
  };

  const res = await request(app)
    .post('/api/readings')
    .send(payload);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.accepted, 1);
  assert.strictEqual(res.body.duplicates, 0);
});

test('3. Payload containing only one valid sensor temperature is accepted', async () => {
  // Only DS18B20 present
  const res1 = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 80,
      temp_c: 4.25,
      ds18b20_temp_c: 4.25,
      voc_raw: 415,
      buffered: false,
    });
  assert.strictEqual(res1.status, 201);
  assert.strictEqual(res1.body.accepted, 1);

  // Only DHT22 present
  const res2 = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 70,
      temp_c: 5.05,
      dht22_temp_c: 5.05,
      humidity: 70.2,
      voc_raw: 418,
      buffered: false,
    });
  assert.strictEqual(res2.status, 201);
  assert.strictEqual(res2.body.accepted, 1);
});

test('4. Missing optional fields are not converted to zero', async () => {
  const currentSeq = testSeq++;
  const payload = {
    device_id: TEST_DEVICE,
    seq: currentSeq,
    ts: Math.floor(Date.now() / 1000) - 60,
    temp_c: 4.10,
    voc_raw: 400,
    buffered: false,
  };

  const res = await request(app).post('/api/readings').send(payload);
  assert.strictEqual(res.status, 201);

  // Query database directly to verify missing fields are NULL, not 0
  const [rows] = await pool.execute(
    `SELECT ds18b20_temp_c, dht22_temp_c, humidity FROM readings WHERE device_id = ? AND seq = ?`,
    [TEST_DEVICE, currentSeq],
  );
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].ds18b20_temp_c, null);
  assert.strictEqual(rows[0].dht22_temp_c, null);
  assert.strictEqual(rows[0].humidity, null);
});

test('5. Explicit null is accepted for optional sensor fields and rejected for required fields', async () => {
  // Explicit null on optional sensor fields
  const resValid = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 50,
      temp_c: 4.30,
      ds18b20_temp_c: null,
      dht22_temp_c: null,
      humidity: null,
      voc_raw: 430,
      buffered: false,
    });
  assert.strictEqual(resValid.status, 201);

  // Explicit null on required temp_c should be rejected
  const resInvalid = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 40,
      temp_c: null,
      voc_raw: 430,
      buffered: false,
    });
  assert.strictEqual(resInvalid.status, 400);
  assert.strictEqual(resInvalid.body.error.code, 'VALIDATION_ERROR');
});

test('6. Invalid numeric strings are rejected', async () => {
  const res = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 30,
      temp_c: 4.30,
      ds18b20_temp_c: '4.82', // string instead of number
      voc_raw: 430,
      buffered: false,
    });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
});

test('7. Non-finite numeric values (NaN, Infinity) are rejected', async () => {
  const resNaN = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 20,
      temp_c: 'NaN',
      voc_raw: 430,
      buffered: false,
    });
  assert.strictEqual(resNaN.status, 400);

  // Raw JSON with Infinity is malformed JSON in HTTP, but test Zod schema directly
  const { SingleReadingSchema } = await import('../src/config/schemas.js');
  const parsedInfinity = SingleReadingSchema.safeParse({
    device_id: TEST_DEVICE,
    seq: 999,
    ts: 1234567,
    temp_c: Infinity,
    voc_raw: 400,
    buffered: false,
  });
  assert.strictEqual(parsedInfinity.success, false);

  const parsedNaN = SingleReadingSchema.safeParse({
    device_id: TEST_DEVICE,
    seq: 999,
    ts: 1234567,
    temp_c: NaN,
    voc_raw: 400,
    buffered: false,
  });
  assert.strictEqual(parsedNaN.success, false);
});

test('8. Invalid humidity values are rejected', async () => {
  // Humidity > 100
  const resHigh = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 10,
      temp_c: 4.0,
      humidity: 105.5,
      voc_raw: 400,
      buffered: false,
    });
  assert.strictEqual(resHigh.status, 400);
  assert.strictEqual(resHigh.body.error.code, 'VALIDATION_ERROR');

  // Humidity < 0
  const resLow = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: testSeq++,
      ts: Math.floor(Date.now() / 1000) - 5,
      temp_c: 4.0,
      humidity: -5.0,
      voc_raw: 400,
      buffered: false,
    });
  assert.strictEqual(resLow.status, 400);
  assert.strictEqual(resLow.body.error.code, 'VALIDATION_ERROR');
});

test('9. Both sensor readings are persisted independently', async () => {
  const currentSeq = testSeq++;
  const payload = {
    device_id: TEST_DEVICE,
    seq: currentSeq,
    ts: Math.floor(Date.now() / 1000) - 2,
    temp_c: 4.82,
    ds18b20_temp_c: 4.82,
    dht22_temp_c: 5.10,
    humidity: 66.5,
    voc_raw: 420,
    buffered: false,
  };

  const res = await request(app).post('/api/readings').send(payload);
  assert.strictEqual(res.status, 201);

  const [rows] = await pool.execute(
    `SELECT temp_c, ds18b20_temp_c, dht22_temp_c FROM readings WHERE device_id = ? AND seq = ?`,
    [TEST_DEVICE, currentSeq],
  );
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(Number(rows[0].temp_c), 4.82);
  assert.strictEqual(Number(rows[0].ds18b20_temp_c), 4.82);
  assert.strictEqual(Number(rows[0].dht22_temp_c), 5.10);
});

test('10. Historical records without new columns remain readable with null sensor fields', async () => {
  // Query historical records (e.g. node-01 records seeded before migration 002)
  const res = await request(app)
    .get('/api/readings')
    .query({ device_id: 'node-01', limit: 5 });

  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.readings));
  if (res.body.readings.length > 0) {
    const historical = res.body.readings[0];
    assert.ok('temp_c' in historical);
    assert.ok('ds18b20_temp_c' in historical);
    assert.ok('dht22_temp_c' in historical);
    assert.strictEqual(historical.ds18b20_temp_c, null);
    assert.strictEqual(historical.dht22_temp_c, null);
  }
});

test('11. Reading retrieval returns both sensor fields in GET /api/readings and GET /api/status', async () => {
  const resReadings = await request(app)
    .get('/api/readings')
    .query({ device_id: TEST_DEVICE, limit: 10 });

  assert.strictEqual(resReadings.status, 200);
  assert.ok(resReadings.body.readings.length > 0);
  const latestInList = resReadings.body.readings[resReadings.body.readings.length - 1];
  assert.strictEqual(latestInList.ds18b20_temp_c, 4.82);
  assert.strictEqual(latestInList.dht22_temp_c, 5.10);

  const resStatus = await request(app)
    .get('/api/status')
    .query({ device_id: TEST_DEVICE });

  assert.strictEqual(resStatus.status, 200);
  assert.ok(resStatus.body.latest_reading);
  assert.strictEqual(resStatus.body.latest_reading.ds18b20_temp_c, 4.82);
  assert.strictEqual(resStatus.body.latest_reading.dht22_temp_c, 5.10);
  assert.strictEqual(resStatus.body.latest_reading.temp_c, 4.82);
});

test('12. SSE reading events contain both fields', async () => {
  const events = [];
  const mockRes = {
    write: (data) => events.push(data),
  };

  sseManager.addClient(TEST_DEVICE, mockRes);

  const sseSeq = testSeq++;
  await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: sseSeq,
      ts: Math.floor(Date.now() / 1000),
      temp_c: 4.85,
      ds18b20_temp_c: 4.85,
      dht22_temp_c: 5.15,
      humidity: 68.0,
      voc_raw: 422,
      buffered: false,
    });

  sseManager.removeClient(TEST_DEVICE, mockRes);

  const readingEventRaw = events.find((e) => e.startsWith('event: reading'));
  assert.ok(readingEventRaw, 'Expected SSE reading event to be broadcast');

  const jsonLine = readingEventRaw.split('\n').find((l) => l.startsWith('data: '));
  const data = JSON.parse(jsonLine.replace('data: ', ''));
  assert.strictEqual(data.temp_c, 4.85);
  assert.strictEqual(data.ds18b20_temp_c, 4.85);
  assert.strictEqual(data.dht22_temp_c, 5.15);
});

test('13. Duplicate buffered requests do not create duplicate records', async () => {
  const dupSeq = testSeq++;
  const payload = {
    device_id: TEST_DEVICE,
    seq: dupSeq,
    ts: Math.floor(Date.now() / 1000) + 10,
    temp_c: 4.80,
    ds18b20_temp_c: 4.80,
    dht22_temp_c: 5.00,
    humidity: 65.0,
    voc_raw: 420,
    buffered: true,
  };

  // First request: accepted
  const res1 = await request(app).post('/api/readings').send(payload);
  assert.strictEqual(res1.status, 201);
  assert.strictEqual(res1.body.accepted, 1);
  assert.strictEqual(res1.body.duplicates, 0);

  // Retry duplicate buffered request: accepted 0, duplicates 1
  const res2 = await request(app).post('/api/readings').send(payload);
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.accepted, 0);
  assert.strictEqual(res2.body.duplicates, 1);

  // Check DB count for this seq
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM readings WHERE device_id = ? AND seq = ?`,
    [TEST_DEVICE, dupSeq],
  );
  assert.strictEqual(Number(rows[0].cnt), 1);
});

test('14. Unauthorized requests to protected endpoints remain unauthorized', async () => {
  // In production mode, requests without valid credentials must be rejected with 401
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await request(app).get('/api/overview');
    assert.strictEqual(res.status, 401);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('15. Primary temp_c decay and alert evaluation continue to function', async () => {
  const alertSeq = testSeq++;
  // Exceed t_max_c (dairy t_max_c is 6°C; sending 10°C triggers TEMP_HIGH critical)
  const res = await request(app)
    .post('/api/readings')
    .send({
      device_id: TEST_DEVICE,
      seq: alertSeq,
      ts: Math.floor(Date.now() / 1000) + 20,
      temp_c: 10.5,
      ds18b20_temp_c: 10.5,
      dht22_temp_c: 11.0,
      humidity: 70.0,
      voc_raw: 400,
      buffered: false,
    });
  assert.strictEqual(res.status, 201);

  const resStatus = await request(app)
    .get('/api/status')
    .query({ device_id: TEST_DEVICE });

  assert.strictEqual(resStatus.status, 200);
  assert.ok(resStatus.body.active_alert);
  assert.strictEqual(resStatus.body.active_alert.type, 'TEMP_HIGH');
});

test.after(async () => {
  // Clean up test readings
  try {
    await pool.execute(`DELETE FROM readings WHERE device_id = ?`, [TEST_DEVICE]);
    await pool.execute(`DELETE FROM alerts WHERE device_id = ?`, [TEST_DEVICE]);
    await pool.execute(`DELETE FROM device_state WHERE device_id = ?`, [TEST_DEVICE]);
    await pool.execute(`DELETE FROM devices WHERE device_id = ?`, [TEST_DEVICE]);
  } catch {
    // Ignore cleanup errors
  }
  await pool.end();
});
