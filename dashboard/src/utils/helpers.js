/**
 * helpers.js
 * Pure utility functions: formatting, colour logic, alert label mapping.
 * These are the functions that Vitest unit tests will cover.
 */

// ── Timestamp Formatting ──────────────────────────────────────────────────────

/** Format a Unix-seconds timestamp to a local date-time string. */
export function fmtTs(ts) {
  if (!ts) return '—'
  return new Date(Number(ts) * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

/** Format a duration in seconds to "Xh Ym Zs" human-readable string. */
export function fmtDuration(seconds) {
  if (seconds == null || seconds < 0) return '—'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

// ── Alert Label Mapping ───────────────────────────────────────────────────────

/** Maps backend alert type strings to human-readable labels. */
export function alertLabel(type) {
  const labels = {
    TEMP_HIGH:          'High Temperature',
    TEMP_LOW:           'Low Temperature',
    SHELF_LIFE_LOW:     'Shelf Life Critical',
    SPOILAGE_SUSPECTED: 'Spoilage Suspected (VOC)',
    DEVICE_OFFLINE:     'Device Offline',
  }
  return labels[type] || type
}

// ── Colour / State Functions ──────────────────────────────────────────────────

/**
 * Returns badge colour (green/amber/red/gray) for a temperature reading
 * compared to a product profile's safe window.
 * 
 * @param {number} tempC
 * @param {object|null} profile  - { t_min_c, t_max_c }
 * @returns {'green'|'amber'|'red'|'gray'}
 */
export function tempColor(tempC, profile) {
  if (tempC == null || !profile) return 'gray'
  const t = Number(tempC)
  const tMin = Number(profile.t_min_c)
  const tMax = Number(profile.t_max_c)

  if (t > tMax + 3 || t < tMin - 3) return 'red'     // critical breach
  if (t > tMax || t < tMin)          return 'amber'   // warning breach
  if (t > tMax - 0.5 || t < tMin + 0.5) return 'amber' // near limit
  return 'green'
}

/**
 * Returns badge colour for remaining shelf life percentage.
 * 
 * @param {number} pct  - 0–100
 * @returns {'green'|'amber'|'red'|'gray'}
 */
export function shelfLifeColor(pct) {
  if (pct == null) return 'gray'
  if (pct >= 25)   return 'green'
  if (pct >= 10)   return 'amber'
  return 'red'
}

/**
 * Returns badge colour for VOC reading.
 * 
 * @param {number} vocRaw
 * @param {object|null} profile  - { voc_baseline, voc_spoil_delta }
 * @returns {'green'|'amber'|'red'|'gray'}
 */
export function vocColor(vocRaw, profile) {
  if (vocRaw == null || !profile) return 'gray'
  const baseline = Number(profile.voc_baseline)
  const delta    = Number(profile.voc_spoil_delta)
  const threshold = baseline + delta

  if (vocRaw > threshold)               return 'red'
  if (vocRaw > baseline + delta * 0.7)  return 'amber'
  return 'green'
}

/**
 * Returns human-readable badge text for a temperature colour.
 */
export function tempBadge(color) {
  return { green: 'Normal', amber: 'Near Limit', red: 'BREACH', gray: '—' }[color] || '—'
}

/**
 * Returns human-readable badge for VOC colour.
 */
export function vocBadge(color) {
  return { green: 'Fresh', amber: 'Elevated', red: 'Spoilage Risk', gray: '—' }[color] || '—'
}
