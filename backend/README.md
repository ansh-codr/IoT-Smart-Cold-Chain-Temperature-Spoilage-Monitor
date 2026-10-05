# Cold Chain Backend

This is the Node.js + Express backend for the Smart Cold Chain Temperature & Spoilage Monitor.

## Features
- Ingests telemetry (single readings or buffered batches) from ESP32 sensors.
- Implements a pure-function physics-based decay model (Arrhenius / Q10) to estimate remaining shelf life.
- Manages stateful alerts (TEMP_HIGH, TEMP_LOW, SHELF_LIFE_LOW, SPOILAGE_SUSPECTED, DEVICE_OFFLINE).
- Broadcasts realtime updates via Server-Sent Events (SSE).

## Setup & Running

1. **Install dependencies:**
   \`\`\`bash
   cd backend
   npm install
   \`\`\`

2. **Configure environment:**
   Copy `.env.example` to `.env` and adjust as needed. By default, it connects to a local MySQL socket.

   | Variable | Default | Description |
   |---|---|---|
   | \`PORT\` | \`3000\` | HTTP server port |
   | \`HOST\` | \`0.0.0.0\` | HTTP server bind address |
   | \`CORS_ORIGIN\` | \`http://localhost:5173\` | Allowed CORS origin (Dashboard) |
   | \`DB_HOST\` | \`localhost\` | MySQL host / socket |
   | \`DB_PORT\` | \`3306\` | MySQL port |
   | \`DB_USER\` | \`root\` | MySQL user |
   | \`DB_PASSWORD\` | *(empty)* | MySQL password |
   | \`DB_NAME\` | \`coldchain\` | Database name |
   | \`MAX_GAP_S\` | \`600\` | Max offline gap (seconds) clamped in decay model |
   | \`DECAY_MODEL\` | \`arrhenius\` | Decay model type (\`arrhenius\` or \`q10\`) |
   | \`VOC_CONSECUTIVE_N\` | \`3\` | Number of consecutive readings to trigger VOC alert |
   | \`OFFLINE_ALERT_S\` | \`120\` | Threshold in seconds before a device is considered offline |

3. **Migrate the Database:**
   \`\`\`bash
   npm run migrate
   \`\`\`

4. **Start the Server:**
   \`\`\`bash
   npm run dev    # Watch mode
   # OR
   npm start      # Production mode
   \`\`\`

5. **Run Tests:**
   \`\`\`bash
   npm test
   \`\`\`
   Tests use the built-in Node.js test runner (\`node --test\`).

## API Endpoints & cURL Examples

### 1. Ingest Reading(s)
**Endpoint:** \`POST /api/readings\`
\`\`\`bash
# Single reading
curl -X POST http://localhost:3000/api/readings \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_id": "node-01",
    "ts": 1717200000,
    "temp_c": 4.5,
    "humidity": 78.5,
    "voc_raw": 512,
    "seq": 1,
    "buffered": false
  }'

# Batch reading (buffered)
curl -X POST http://localhost:3000/api/readings \\
  -H "Content-Type: application/json" \\
  -d '[
    {"device_id":"node-01","ts":1717199700,"temp_c":3.9,"humidity":77.0,"voc_raw":490,"seq":2,"buffered":true},
    {"device_id":"node-01","ts":1717199760,"temp_c":4.1,"humidity":77.5,"voc_raw":498,"seq":3,"buffered":true}
  ]'
\`\`\`

### 2. Get Device Status
**Endpoint:** \`GET /api/status?device_id=node-01\`
\`\`\`bash
curl -s "http://localhost:3000/api/status?device_id=node-01"
\`\`\`

### 3. Get Alert History
**Endpoint:** \`GET /api/alerts?device_id=node-01&limit=50\`
\`\`\`bash
curl -s "http://localhost:3000/api/alerts?device_id=node-01&limit=50"
\`\`\`

### 4. Get Readings History
**Endpoint:** \`GET /api/readings?device_id=node-01&limit=100\`
\`\`\`bash
curl -s "http://localhost:3000/api/readings?device_id=node-01&limit=100"
\`\`\`

### 5. List Profiles
**Endpoint:** \`GET /api/profiles\`
\`\`\`bash
curl -s "http://localhost:3000/api/profiles"
\`\`\`

### 6. Change Device Profile
**Endpoint:** \`PUT /api/devices/:device_id/profile\`
\`\`\`bash
curl -X PUT http://localhost:3000/api/devices/node-01/profile \\
  -H "Content-Type: application/json" \\
  -d '{"profile_id": 2}'
\`\`\`

### 7. Stream Realtime Events (SSE)
**Endpoint:** \`GET /api/stream?device_id=node-01\`
\`\`\`bash
curl -N "http://localhost:3000/api/stream?device_id=node-01"
\`\`\`

### 8. Health Check
**Endpoint:** \`GET /health\`
\`\`\`bash
curl -s "http://localhost:3000/health"
\`\`\`
