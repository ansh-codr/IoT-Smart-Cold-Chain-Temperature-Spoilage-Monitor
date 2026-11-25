/**
 * services/buzzerService.js — Hardware Node Remote Buzzer Service
 * Manages remote buzzer triggers initiated by Dashboard or Telegram.
 */

const activeBuzzerTriggers = new Map();

/**
 * Trigger the buzzer for a specific device.
 * @param {string} deviceId
 * @param {number} durationS
 * @param {string} triggeredBy
 */
export function triggerBuzzer(deviceId, durationS = 10, triggeredBy = 'system') {
  const expiresAt = Date.now() + durationS * 1000;
  activeBuzzerTriggers.set(deviceId, {
    active: true,
    expiresAt,
    triggeredBy,
    triggeredAt: Date.now(),
  });
  return true;
}

/**
 * Check if the buzzer should sound on the device right now.
 * Cleans up expired triggers automatically.
 * @param {string} deviceId
 * @returns {boolean}
 */
export function isBuzzerActive(deviceId) {
  const entry = activeBuzzerTriggers.get(deviceId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    activeBuzzerTriggers.delete(deviceId);
    return false;
  }
  return true;
}

/**
 * Deactivate or acknowledge buzzer for a device.
 * @param {string} deviceId
 */
export function clearBuzzer(deviceId) {
  activeBuzzerTriggers.delete(deviceId);
}

/**
 * Get status of buzzer for a device.
 * @param {string} deviceId
 */
export function getBuzzerStatus(deviceId) {
  const active = isBuzzerActive(deviceId);
  const entry = activeBuzzerTriggers.get(deviceId);
  return {
    active,
    expiresInS: active ? Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000)) : 0,
    triggeredBy: entry?.triggeredBy || null,
  };
}
