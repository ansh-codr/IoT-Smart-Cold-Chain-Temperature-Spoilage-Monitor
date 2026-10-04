/**
 * realtime/sseManager.js — SCAFFOLD STUB
 *
 * In-memory registry of active SSE client connections.
 * Services call broadcast() after inserting a reading or mutating an alert.
 *
 * Key rules (AGENTS.md §8):
 * - Every connected client must be stored here and cleaned up on 'close'.
 * - Keep-alives must be sent on an interval, not inline in the route.
 * - Multiple clients may subscribe to the same device_id.
 *
 * Event format expected by the dashboard:
 *   event: reading\ndata: {...}\n\n
 *   event: status\ndata: {...}\n\n
 *   event: alert\ndata: {...}\n\n
 */

// Map<deviceId, Set<Response>> — one Set of response objects per device
const clients = new Map();

/**
 * Register a new SSE client.
 *
 * @param {string} deviceId
 * @param {import('express').Response} res
 */
export function addClient(deviceId, res) {
  if (!clients.has(deviceId)) {
    clients.set(deviceId, new Set());
  }
  clients.get(deviceId).add(res);
}

/**
 * Remove an SSE client (call this inside req.on('close', ...)).
 *
 * @param {string} deviceId
 * @param {import('express').Response} res
 */
export function removeClient(deviceId, res) {
  const set = clients.get(deviceId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(deviceId);
  }
}

/**
 * Broadcast an SSE event to all clients subscribed to a device.
 *
 * @param {string} deviceId
 * @param {'reading'|'status'|'alert'} eventType
 * @param {object} data
 */
export function broadcast(deviceId, eventType, data) {
  const set = clients.get(deviceId);
  if (!set || set.size === 0) return;

  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      // Client disconnected between the check and the write; will be cleaned up on 'close'
    }
  }
}

/**
 * Returns the number of currently connected SSE clients across all devices.
 * Useful for health/metrics endpoints.
 */
export function clientCount() {
  let total = 0;
  for (const set of clients.values()) total += set.size;
  return total;
}
