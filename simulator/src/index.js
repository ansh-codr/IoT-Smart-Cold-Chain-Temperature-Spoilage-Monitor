import { PRNG, SensorModel } from './sensorModel.js';
import { ScenarioManager } from './scenarios.js';
import { ApiClient } from './apiClient.js';
import fs from 'fs';
import http from 'http';
import path from 'path';

const args = process.argv.slice(2);
const config = {
  url: process.env.URL || 'http://localhost:3000',
  device: process.env.DEVICE || 'node-01',
  interval: parseInt(process.env.INTERVAL || 2),
  scenario: process.env.SCENARIO || 'normal',
  speed: parseFloat(process.env.SPEED || 1),
  seed: parseInt(process.env.SEED || Date.now()),
  realOffline: args.includes('--real-offline'),
  controlPort: parseInt(process.env.CONTROL_PORT || 4001)
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') config.url = args[++i];
  if (args[i] === '--device') config.device = args[++i];
  if (args[i] === '--interval') config.interval = parseInt(args[++i]);
  if (args[i] === '--scenario') config.scenario = args[++i];
  if (args[i] === '--speed') config.speed = parseFloat(args[++i]);
  if (args[i] === '--seed') config.seed = parseInt(args[++i]);
  if (args[i] === '--control-port') config.controlPort = parseInt(args[++i]);
}

if (config.speed !== 1) {
  console.warn(`\x1b[33mWARNING: Running in fast mode (speed=${config.speed}). Timestamps will run ahead of wall-clock. Offline detection may not behave realistically.\x1b[0m`);
}

const stateFile = path.resolve('.state.json');
let seq = 0;
if (fs.existsSync(stateFile)) {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (s.seq) seq = s.seq + 1;
  } catch (e) {}
}
function saveState() {
  fs.writeFileSync(stateFile, JSON.stringify({ seq }));
}
process.on('SIGINT', () => { saveState(); process.exit(); });
process.on('SIGTERM', () => { saveState(); process.exit(); });

const prng = new PRNG(config.seed);
const sensorModel = new SensorModel(prng);
const scenarioManager = new ScenarioManager(sensorModel);
scenarioManager.setScenario(config.scenario);
const apiClient = new ApiClient(config.url, config.realOffline);

let buffer = [];
let ts = Math.floor(Date.now() / 1000);

async function start() {
  const p = await apiClient.getProfiles();
  if (p && p.profiles) {
    const dairy = p.profiles.find(x => x.name === 'dairy');
    if (dairy && dairy.voc_baseline) {
      sensorModel.vocBaseline = dairy.voc_baseline;
    }
  }

  setInterval(tick, 1000 / config.speed); // loop based on speed

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    if (req.method === 'GET' && req.url === '/state') {
      return res.writeHead(200, {'Content-Type':'application/json'})
        .end(JSON.stringify({ scenario: scenarioManager.currentScenario }));
    }
    if (req.method === 'POST' && req.url === '/scenario') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (d.scenario) scenarioManager.setScenario(d.scenario);
          res.writeHead(200).end(JSON.stringify({ok: true}));
        } catch(e) {
          res.writeHead(400).end();
        }
      });
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(config.controlPort, () => {
    console.log(`Control server listening on port ${config.controlPort}`);
  });

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    if (key === '\u0003' || key === 'q') { saveState(); process.exit(); }
    if (key === 'n') scenarioManager.setScenario('normal');
    if (key === 'b') scenarioManager.setScenario('breach');
    if (key === 'd') scenarioManager.setScenario('door_open');
    if (key === 's') scenarioManager.setScenario('slow_drift');
    if (key === 'v') scenarioManager.setScenario('spoilage');
    if (key === 'o') scenarioManager.setScenario('offline_burst');
  });
}

let tickTimer = 0;
let isFlushing = false;

async function tick() {
  ts += 1;
  tickTimer++;
  if (tickTimer < config.interval) return;
  tickTimer = 0;

  const { offline } = scenarioManager.tick(config.interval);
  const readingValues = sensorModel.tick();
  const reading = {
    device_id: config.device,
    ts,
    ...readingValues,
    seq: seq++,
    buffered: false
  };

  if (offline) {
    reading.buffered = true;
    buffer.push(reading);
    console.log(`${ts} [${scenarioManager.currentScenario}] T:${reading.temp_c} H:${reading.humidity} V:${reading.voc_raw} S:${reading.seq} BUFFERED`);
    saveState();
    return;
  }

  buffer.push(reading);

  if (!isFlushing) {
    isFlushing = true;
    try {
      const batch = buffer.splice(0, 500);
      try {
        const res = await apiClient.postReadings(batch);
        console.log(`${ts} [${scenarioManager.currentScenario}] T:${reading.temp_c} H:${reading.humidity} V:${reading.voc_raw} S:${reading.seq} FLUSHED (${batch.length} accepted: ${res.accepted})`);
      } catch (e) {
        batch.forEach(r => r.buffered = true);
        buffer.unshift(...batch);
        console.log(`${ts} [${scenarioManager.currentScenario}] POST failed, bufferd ${batch.length}`);
      }
    } finally {
      isFlushing = false;
    }
  }
  saveState();
}

start();
