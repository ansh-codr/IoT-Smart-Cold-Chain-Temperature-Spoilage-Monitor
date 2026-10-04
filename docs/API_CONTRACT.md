# API Contract — Smart Cold Chain Monitor
**Version:** 1.0.0  
**Last updated:** 2026-10-04  
**⚠️ Single Source of Truth — Never change endpoints or field names without updating this document first.**

---

## Base URL
```
http://<SERVER_LAN_IP>:<PORT>/api
```
Default port: `3000`. All timestamps are **Unix seconds, UTC**. All numeric values follow the ranges defined below.

---

## Error Format (All Errors)

Every non-2xx response has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of what went wrong"
  }
}
```

### Standard Error Codes

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body/query failed zod schema |
| 400 | `RANGE_ERROR` | Sensor value out of allowed range |
| 404 | `NOT_FOUND` | Device or profile not found |
| 409 | `CONFLICT` | (not used; duplicates are silently counted, see POST /readings) |
| 422 | `UNPROCESSABLE` | Data is structurally valid but semantically invalid |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Endpoints

---

### `POST /api/readings`

Ingest a single reading **or** a batch (array) from the ESP32.  
Idempotent on `(device_id, seq)` — duplicate entries are silently ignored and counted.

#### Single Reading — Request Body

```json
{
  "device_id": "esp32-001",
  "ts": 1717200000,
  "temp_c": 4.3,
  "humidity": 78.5,
  "voc_raw": 512,
  "seq": 42,
  "buffered": false
}
```

#### Batch Reading — Request Body

```json
[
  {
    "device_id": "esp32-001",
    "ts": 1717199700,
    "temp_c": 3.9,
    "humidity": 77.0,
    "voc_raw": 490,
    "seq": 40,
    "buffered": true
  },
  {
    "device_id": "esp32-001",
    "ts": 1717199760,
    "temp_c": 4.1,
    "humidity": 77.5,
    "voc_raw": 498,
    "seq": 41,
    "buffered": true
  }
]
```

#### Field Definitions

| Field | Type | Required | Range / Notes |
|---|---|---|---|
| `device_id` | string | ✅ | Max 64 chars; must match a row in `devices` table |
| `ts` | integer | ✅ | Unix seconds UTC; must be > 0 |
| `temp_c` | number | ✅ | −40.0 to 85.0 °C |
| `humidity` | number | ✅ | 0.0 to 100.0 %RH |
| `voc_raw` | integer | ✅ | 0 to 4095 (12-bit ADC) |
| `seq` | integer | ✅ | Monotonically increasing per device; ≥ 0 |
| `buffered` | boolean | ✅ | `true` if reading was stored offline and is being sent late |

#### Validation Failure — 400

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "temp_c: must be between -40 and 85"
  }
}
```

#### Success — 200

```json
{
  "accepted": 2,
  "duplicates": 0
}
```

For a single reading, `accepted` is either `1` or `0` (if duplicate).

#### Notes
- Batch arrays may contain up to **200** readings per request.
- If a batch contains mixed valid/invalid ranges, the entire request is rejected with 400 — all or nothing.
- Batches with `buffered: true` readings trigger a **recompute** of `consumed_life_hours` for that device (in `ts` ascending order).

---

### `GET /api/readings`

Retrieve historical readings for a device.

#### Query Parameters

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `device_id` | string | ✅ | — | |
| `from` | integer | ❌ | `0` | Unix seconds, inclusive |
| `to` | integer | ❌ | `now` | Unix seconds, inclusive |
| `limit` | integer | ❌ | `100` | Max `1000` |

Results are returned **ascending by `ts`**.

#### Success — 200

```json
{
  "device_id": "esp32-001",
  "count": 2,
  "readings": [
    {
      "id": 101,
      "ts": 1717199700,
      "temp_c": 3.9,
      "humidity": 77.0,
      "voc_raw": 490,
      "seq": 40,
      "buffered": true,
      "received_at": 1717200500
    },
    {
      "id": 102,
      "ts": 1717199760,
      "temp_c": 4.1,
      "humidity": 77.5,
      "voc_raw": 498,
      "seq": 41,
      "buffered": true,
      "received_at": 1717200500
    }
  ]
}
```

#### Error — 400

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "device_id is required"
  }
}
```

---

### `GET /api/status`

Returns the latest reading and computed shelf-life state for a device.

#### Query Parameters

| Param | Type | Required |
|---|---|---|
| `device_id` | string | ✅ |

#### Success — 200

```json
{
  "device_id": "esp32-001",
  "online": true,
  "last_seen_ts": 1717200000,
  "latest_reading": {
    "ts": 1717200000,
    "temp_c": 4.3,
    "humidity": 78.5,
    "voc_raw": 512,
    "seq": 42,
    "buffered": false
  },
  "shelf_life": {
    "remaining_life_hours": 142.5,
    "remaining_life_percent": 84.8,
    "rate_factor": 1.12,
    "consumed_life_hours": 25.5
  },
  "active_alert": {
    "id": 7,
    "type": "TEMP_HIGH",
    "severity": "warning",
    "started_at": 1717199500,
    "peak_value": 7.2,
    "message": "Temperature exceeded upper limit of 6°C"
  },
  "product_profile": {
    "id": 1,
    "name": "dairy",
    "t_ref_c": 4,
    "t_min_c": 2,
    "t_max_c": 6,
    "shelf_life_hours_at_ref": 168
  },
  "buffered_recovered_count": 3
}
```

- `online`: `true` if `last_seen_ts` is within the last **30 seconds** of server time.
- `active_alert`: `null` if no ongoing alert.
- `shelf_life` fields are `null` if the device has no assigned product profile.

#### Device Not Found — 404

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Device 'esp32-001' not found"
  }
}
```

---

### `GET /api/alerts`

Returns alert history for a device.

#### Query Parameters

| Param | Type | Required | Default |
|---|---|---|---|
| `device_id` | string | ✅ | — |
| `limit` | integer | ❌ | `50` |

Results ordered descending by `started_at`.

#### Success — 200

```json
{
  "device_id": "esp32-001",
  "count": 2,
  "alerts": [
    {
      "id": 7,
      "type": "TEMP_HIGH",
      "severity": "warning",
      "started_at": 1717199500,
      "ended_at": 1717200100,
      "duration_s": 600,
      "peak_value": 7.2,
      "message": "Temperature exceeded upper limit of 6°C"
    },
    {
      "id": 3,
      "type": "SHELF_LIFE_LOW",
      "severity": "critical",
      "started_at": 1717100000,
      "ended_at": null,
      "duration_s": null,
      "peak_value": 9.8,
      "message": "Remaining shelf life below 10%"
    }
  ]
}
```

#### Alert Types

| Type | Severity | Trigger Condition |
|---|---|---|
| `TEMP_HIGH` | `warning` | `temp_c > profile.t_max_c` |
| `TEMP_HIGH` | `critical` | `temp_c > profile.t_max_c + 3` (3°C grace margin) |
| `TEMP_LOW` | `warning` | `temp_c < profile.t_min_c` |
| `TEMP_LOW` | `critical` | `temp_c < profile.t_min_c - 3` |
| `SHELF_LIFE_LOW` | `warning` | `remaining_life_percent < 20%` |
| `SHELF_LIFE_LOW` | `critical` | `remaining_life_percent < 10%` |
| `SPOILAGE_SUSPECTED` | `critical` | `voc_raw > voc_baseline + voc_spoil_delta` for N consecutive readings (N = 3) |
| `DEVICE_OFFLINE` | `critical` | No reading for > 120 seconds |

- Alerts are **stateful**: an alert row is opened (`ended_at = NULL`) when triggered; closed (ended_at set) when condition resolves.
- `peak_value` stores the worst reading value during the alert window.
- `duration_s = ended_at - started_at`; `null` if still open.

---

### `GET /api/profiles`

Returns all available product profiles.

#### Success — 200

```json
{
  "profiles": [
    {
      "id": 1,
      "name": "dairy",
      "t_ref_c": 4,
      "t_min_c": 2,
      "t_max_c": 6,
      "shelf_life_hours_at_ref": 168,
      "q10": 2.0,
      "ea_kj_per_mol": 50.0,
      "voc_baseline": 600,
      "voc_spoil_delta": 400
    },
    {
      "id": 2,
      "name": "pharma",
      "t_ref_c": 5,
      "t_min_c": 2,
      "t_max_c": 8,
      "shelf_life_hours_at_ref": 720,
      "q10": 2.5,
      "ea_kj_per_mol": 60.0,
      "voc_baseline": 300,
      "voc_spoil_delta": 200
    },
    {
      "id": 3,
      "name": "produce",
      "t_ref_c": 4,
      "t_min_c": 1,
      "t_max_c": 8,
      "shelf_life_hours_at_ref": 240,
      "q10": 2.0,
      "ea_kj_per_mol": 55.0,
      "voc_baseline": 800,
      "voc_spoil_delta": 500
    }
  ]
}
```

---

### `PUT /api/devices/:device_id/profile`

Assigns a product profile to a device.

#### URL Parameter
- `:device_id` — string, the device ID.

#### Request Body

```json
{
  "profile_id": 2
}
```

#### Success — 200

```json
{
  "device_id": "esp32-001",
  "profile_id": 2,
  "message": "Profile updated successfully"
}
```

#### Errors

**Device not found — 404**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Device 'esp32-999' not found"
  }
}
```

**Profile not found — 404**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Profile with id 99 not found"
  }
}
```

---

### `GET /api/stream`

Server-Sent Events stream for a device. Connect once; receive live updates.

#### Query Parameters

| Param | Type | Required |
|---|---|---|
| `device_id` | string | ✅ |

#### Response Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

#### Event Types

Each SSE message follows the format:
```
event: <type>
data: <JSON string>

```

**`reading` event** — fired on each new reading inserted:
```json
{
  "device_id": "esp32-001",
  "ts": 1717200060,
  "temp_c": 4.5,
  "humidity": 79.0,
  "voc_raw": 520,
  "seq": 43,
  "buffered": false
}
```

**`status` event** — fired after every reading (with updated shelf-life):
```json
{
  "device_id": "esp32-001",
  "online": true,
  "remaining_life_hours": 141.9,
  "remaining_life_percent": 84.5,
  "rate_factor": 1.15,
  "active_alert": null
}
```

**`alert` event** — fired when an alert opens or closes:
```json
{
  "device_id": "esp32-001",
  "alert_id": 8,
  "type": "TEMP_HIGH",
  "severity": "warning",
  "action": "opened",
  "started_at": 1717200060,
  "peak_value": 6.8,
  "message": "Temperature exceeded upper limit of 6°C"
}
```

**Keep-alive** — sent every 15 seconds to prevent proxy timeouts:
```
: keep-alive
```

#### Notes
- One stream per `device_id`. Multiple clients may connect for the same device.
- On client disconnect, the server removes the client from the broadcast list (no memory leak).
- Clients should reconnect automatically using the EventSource API's built-in retry.

---

### `GET /api/report`

**Status: Contract defined; implementation deferred to a future phase.**

#### Query Parameters

| Param | Type | Required | Notes |
|---|---|---|---|
| `device_id` | string | ✅ | |
| `from` | integer | ✅ | Unix seconds |
| `to` | integer | ✅ | Unix seconds |
| `format` | string | ✅ | `csv` or `pdf` |

#### Success (csv) — 200
`Content-Type: text/csv`
Raw CSV file download.

#### Success (pdf) — 200
`Content-Type: application/pdf`
PDF file download.

#### Error — 501 (Not Implemented, until the feature is built)
```json
{
  "error": {
    "code": "NOT_IMPLEMENTED",
    "message": "Report generation is not yet implemented"
  }
}
```

---

### `POST /api/sim/scenario`

**Status: Contract defined; reserved for the simulator agent. Do NOT call from firmware.**

#### Request Body

```json
{
  "device_id": "sim-001",
  "scenario": "breach"
}
```

| Field | Type | Allowed Values |
|---|---|---|
| `device_id` | string | Any registered device |
| `scenario` | string | `"normal"` \| `"breach"` \| `"offline_burst"` |

#### Success — 202 Accepted

```json
{
  "message": "Scenario 'breach' started for device 'sim-001'",
  "scenario": "breach",
  "device_id": "sim-001"
}
```

#### Error — 501 (Not Implemented, until simulator is built)
```json
{
  "error": {
    "code": "NOT_IMPLEMENTED",
    "message": "Simulator is not yet implemented"
  }
}
```

---

## `GET /health`

Health check — not under `/api` prefix.

#### Success — 200

```json
{
  "status": "ok",
  "ts": 1717200000,
  "uptime_s": 3600
}
```

---

*End of API Contract v1.0.0*
