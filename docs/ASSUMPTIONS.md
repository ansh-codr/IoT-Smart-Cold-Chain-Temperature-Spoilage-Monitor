# Assumptions

## 2026-11-24 — Dashboard refactor

- The local backend port is standardised on `5000`. This matches the checked-in backend environment example, the Vite development proxy, and the supplied ESP32 endpoint. Existing deployments that explicitly configure `PORT` retain their configured value.
