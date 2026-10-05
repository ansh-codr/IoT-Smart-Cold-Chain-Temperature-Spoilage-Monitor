# Smart Cold Chain Simulator

A pure Node.js ES modules simulator that behaves like the ESP32 node.

## Install
```bash
npm install
```

## Run
```bash
npm start -- [options]
```

## Options
- `--url <url>` (default: `http://localhost:3000`)
- `--device <id>` (default: `node-01`)
- `--interval <seconds>` (default: `2`)
- `--scenario <scenario>` (default: `normal`)
- `--speed <N>` (default: `1`)
- `--seed <N>`
- `--real-offline`
- `--control-port <port>` (default: `4001`)

## Interactive Keys
While running, press keys:
- `n` = normal
- `b` = breach
- `d` = door_open
- `s` = slow_drift
- `v` = spoilage
- `o` = offline_burst
- `q` = quit

## HTTP Control Server
```bash
curl -X POST -H "Content-Type: application/json" -d '{"scenario":"breach"}' http://localhost:4001/scenario
curl http://localhost:4001/state
```

## Offline Demo
Run with `--scenario offline_burst` or press `o`. It will buffer readings for 60s, then flush them via a batch POST with `buffered=true`.
Alternatively, run with `--real-offline` and shut down the backend server to simulate network loss.

## Tests
```bash
npm test
```
