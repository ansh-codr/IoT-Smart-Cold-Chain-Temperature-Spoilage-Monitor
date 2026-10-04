# AGENTS.md — Project Rules for All Agents
## Smart Cold Chain Temperature & Spoilage Monitor
**GLA University — B.Tech CSE Final Year Project**

---

## 1. Stack (Fixed — Do NOT Substitute)

| Layer | Technology |
|---|---|
| Backend runtime | Node.js LTS (≥ 20) |
| Backend framework | Express.js (ES modules, `"type": "module"`) |
| Database driver | mysql2 (promise API only, no callbacks) |
| Validation | zod — every inbound route input must be validated |
| Environment | dotenv |
| CORS | cors package |
| Dashboard | React + Vite + Recharts |
| Realtime | Server-Sent Events (SSE) — no WebSocket, no Socket.io |
| Database | MySQL (InnoDB, utf8mb4), DB name: `coldchain` |

**Any agent proposing a stack change must create a `docs/ADR_<topic>.md` and get explicit human approval before touching code.**

---

## 2. API Contract is the Single Source of Truth

- `docs/API_CONTRACT.md` defines every endpoint, request shape, response shape, and error format.
- **Never** add, remove, or change an endpoint, field name, HTTP status, or error code without **first** updating `API_CONTRACT.md` in the same commit/PR.
- Downstream agents (simulator, firmware, dashboard) MUST read `API_CONTRACT.md` before writing any HTTP or SSE client code.

---

## 3. Data Conventions (Immutable Across All Layers)

| Property | Convention |
|---|---|
| Timestamps | Unix seconds (integer), UTC — everywhere (DB, API, SSE, logs) |
| Temperature | °C (`temp_c`) |
| Humidity | %RH (`humidity`) |
| VOC raw ADC | 12-bit integer 0–4095 (`voc_raw`) — indicative only |
| IDs | `device_id` is a string (e.g. `"esp32-001"`) |
| Boolean in JSON | JSON `true`/`false` — never `0`/`1` in JSON |
| Boolean in MySQL | `TINYINT(1)` |

---

## 4. Database Rules

- **Parameterized SQL only.** String interpolation into SQL is a hard failure.
- All schema lives in `docs/DB_SCHEMA.sql`; any migration is a new numbered SQL file under `backend/src/db/migrations/`.
- `db/migrate.js` is the only entry point for running migrations.
- Never `DROP TABLE` without a corresponding backup/restore note in the migration file.

---

## 5. Code Quality Rules

- **ES modules throughout** — `import`/`export`, never `require`.
- **Small modules** — no file should exceed ~200 lines; split if it does.
- **No god files** — `app.js` wires middleware; route files import service files; service files import db/pool.
- **Comments explain the "why"** — not the "what". Example: `// clamp dt to MAX_GAP_S to avoid over-counting shelf life during offline periods`.
- **No secrets in source control.** Only `.env.example` with placeholder values. Real `.env` is in `.gitignore`.
- **Error propagation** — all async route handlers must be wrapped or use `express-async-errors`; unhandled rejections must reach the central error handler.

---

## 6. Assumptions Must Be Documented

- If an agent makes an assumption not covered by the spec, it **must** write it in `docs/ASSUMPTIONS.md` (create if absent) with a timestamp and the agent's task label.
- Silent assumptions that affect other agents' work are a project-level defect.

---

## 7. Decay Model

- The canonical decay model is documented in `docs/DECAY_MODEL.md`.
- The backend service must implement it exactly as specified there.
- If any parameter (Ea, Q10, T_ref, shelf_life_hours) is missing for a device's profile, return an explicit error — never silently default.

---

## 8. Realtime (SSE)

- SSE endpoint: `GET /api/stream?device_id=`
- Event types: `reading`, `status`, `alert` — each event's `data` field is a JSON string.
- Keep-alive: send a comment (`: keep-alive`) every 15 s.
- Each SSE client must be cleaned up on `req.on('close', ...)` to prevent memory leaks.

---

## 9. Testing (Future Phases)

- Unit tests go in `backend/tests/unit/`, integration tests in `backend/tests/integration/`.
- Test files mirror source structure: `src/services/decay.js` → `tests/unit/services/decay.test.js`.
- Use `vitest` (consistent with Vite on dashboard side).

---

## 10. Git Workflow

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`.
- Never commit directly to `main`; use feature branches.
- `.env`, `node_modules/`, `dist/`, `*.log` must be in `.gitignore`.

---

*Last updated: 2026-10-04 by Phase 1 scaffold agent.*
