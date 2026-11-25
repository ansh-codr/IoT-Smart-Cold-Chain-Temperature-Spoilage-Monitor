# Assumptions

## 2026-11-24 — Dashboard refactor

- The local backend port is standardised on `5000`. This matches the checked-in backend environment example, the Vite development proxy, and the supplied ESP32 endpoint. Existing deployments that explicitly configure `PORT` retain their configured value.

## 2026-11-25 — Telegram Bot Alerts & Reports Integration

- Telegram Bot integration is implemented via Node.js native `fetch` against the Telegram Bot API (`https://api.telegram.org`), requiring zero external dependencies.
- It is controlled by `TELEGRAM_ENABLED=true` (defaults to `false` so the backend runs completely normally if no bot is configured).
- Push alerts are dispatched to `TELEGRAM_CHAT_ID` when cold-chain alerts open or escalate.
- Long-polling listener allows querying `/status [node]`, `/report [node]` (which delivers a statistical summary and CSV audit log attachment), `/alerts [node]`, and `/devices`.

