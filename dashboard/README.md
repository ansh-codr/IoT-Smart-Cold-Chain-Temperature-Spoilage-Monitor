# Cold Chain Monitor — React Dashboard

React 19 + Vite + Tailwind CSS v4 + Recharts + Lucide-react frontend for the Cold Chain Monitoring System.

## Prerequisites
- Node.js ≥ 20
- Backend running at `http://localhost:3000` (see `../backend/`)
- (Optional) Simulator running at `http://localhost:4001` (see `../simulator/`)

## Setup & Run

```bash
# 1. Install dependencies
cd dashboard
npm install

# 2. Start the development server
npm run dev
# → Opens at http://localhost:5173
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR (port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Vitest unit tests |

## Architecture

```
dashboard/src/
├── App.jsx                 # Root: layout, device/profile selector, SSE orchestration
├── main.jsx                # React entry point
├── index.css               # Tailwind v4 import (@import "tailwindcss")
├── hooks/
│   └── useDeviceStream.js  # SSE stream hook — handles "reading"/"status"/"alert" events
├── components/
│   ├── MetricCard.jsx      # Sensor value card (temp / humidity / VOC / shelf-life)
│   ├── ShelfLifeGauge.jsx  # SVG semicircle gauge for remaining shelf life %
│   ├── TrendChart.jsx      # Recharts live trend chart with safe-range band
│   ├── AlertBanner.jsx     # Sticky alert banner (active alert)
│   └── AlertTable.jsx      # Alert history table
└── utils/
    └── helpers.js          # Pure functions: formatting, colour logic, label mapping
tests/
└── helpers.test.js         # Vitest unit tests for pure helpers
```

## Running the Full Stack

Open three terminal windows:

**Terminal 1 — MySQL (if not running):**
```bash
sudo /usr/local/mysql/support-files/mysql.server start
```

**Terminal 2 — Backend:**
```bash
cd backend
npm start
```

**Terminal 3 — Simulator (virtual ESP32):**
```bash
cd simulator
npm start -- --device node-01 --url http://localhost:3000 --control-port 4001
```

**Terminal 4 — Dashboard:**
```bash
cd dashboard
npm run dev
# Open http://localhost:5173
```

## SSE Stream Events

| Event | Data | Effect |
|---|---|---|
| `reading` | Sensor values | Appended to chart (max 200 kept) |
| `status` | Shelf-life + rate factor + active alert | Updates metric cards + gauge |
| `alert` | Alert open/close/escalate | Updates banner + refreshes alert table |

Buffered readings (from offline ring-buffer) appear with a **hollow amber circle** on the chart.
