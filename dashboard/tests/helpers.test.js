/**
 * helpers.test.js
 * Vitest unit tests for pure helper functions.
 */

import { describe, it, expect } from 'vitest'
import {
  fmtDuration,
  alertLabel,
  tempColor,
  shelfLifeColor,
  vocColor,
  tempBadge,
  vocBadge,
} from '../src/utils/helpers.js'

// ── fmtDuration ───────────────────────────────────────────────────────────────
describe('fmtDuration', () => {
  it('formats seconds < 60', () => {
    expect(fmtDuration(45)).toBe('45s')
  })
  it('formats seconds in minutes range', () => {
    expect(fmtDuration(125)).toBe('2m 5s')
  })
  it('formats hours range', () => {
    expect(fmtDuration(3720)).toBe('1h 2m')
  })
  it('returns — for null', () => {
    expect(fmtDuration(null)).toBe('—')
  })
  it('returns — for negative', () => {
    expect(fmtDuration(-5)).toBe('—')
  })
  it('formats 0 as 0s', () => {
    expect(fmtDuration(0)).toBe('0s')
  })
})

// ── alertLabel ────────────────────────────────────────────────────────────────
describe('alertLabel', () => {
  it('maps TEMP_HIGH to human label', () => {
    expect(alertLabel('TEMP_HIGH')).toBe('High Temperature')
  })
  it('maps TEMP_LOW to human label', () => {
    expect(alertLabel('TEMP_LOW')).toBe('Low Temperature')
  })
  it('maps SHELF_LIFE_LOW', () => {
    expect(alertLabel('SHELF_LIFE_LOW')).toBe('Shelf Life Critical')
  })
  it('maps SPOILAGE_SUSPECTED', () => {
    expect(alertLabel('SPOILAGE_SUSPECTED')).toBe('Spoilage Suspected (VOC)')
  })
  it('maps DEVICE_OFFLINE', () => {
    expect(alertLabel('DEVICE_OFFLINE')).toBe('Device Offline')
  })
  it('returns the raw type for unknown codes', () => {
    expect(alertLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
  })
})

// ── tempColor ─────────────────────────────────────────────────────────────────
describe('tempColor', () => {
  const profile = { t_min_c: 2, t_max_c: 6 }

  it('returns green when inside safe window', () => {
    expect(tempColor(4, profile)).toBe('green')
  })
  it('returns amber when exactly at max limit', () => {
    expect(tempColor(6, profile)).toBe('amber')
  })
  it('returns amber when just above max', () => {
    expect(tempColor(6.5, profile)).toBe('amber')
  })
  it('returns red when >3°C above max (critical breach)', () => {
    expect(tempColor(9.5, profile)).toBe('red')
  })
  it('returns amber when below min', () => {
    expect(tempColor(1.5, profile)).toBe('amber')
  })
  it('returns red when <3°C below min (critical breach)', () => {
    expect(tempColor(-2, profile)).toBe('red')
  })
  it('returns gray when no profile', () => {
    expect(tempColor(4, null)).toBe('gray')
  })
  it('returns gray when temp is null', () => {
    expect(tempColor(null, profile)).toBe('gray')
  })
})

// ── shelfLifeColor ────────────────────────────────────────────────────────────
describe('shelfLifeColor', () => {
  it('returns green for >= 25%', () => {
    expect(shelfLifeColor(80)).toBe('green')
    expect(shelfLifeColor(25)).toBe('green')
  })
  it('returns amber for 10-24%', () => {
    expect(shelfLifeColor(20)).toBe('amber')
    expect(shelfLifeColor(10)).toBe('amber')
  })
  it('returns red for < 10%', () => {
    expect(shelfLifeColor(9)).toBe('red')
    expect(shelfLifeColor(0)).toBe('red')
  })
  it('returns gray for null', () => {
    expect(shelfLifeColor(null)).toBe('gray')
  })
})

// ── vocColor ──────────────────────────────────────────────────────────────────
describe('vocColor', () => {
  const profile = { voc_baseline: 600, voc_spoil_delta: 400 }

  it('returns green below baseline+delta', () => {
    expect(vocColor(500, profile)).toBe('green')
  })
  it('returns amber when approaching threshold', () => {
    // amber zone: voc_baseline + voc_spoil_delta*0.7 < voc < threshold
    // threshold = 600 + 400 = 1000; amber zone start = 600 + 400*0.7 = 880
    // Use 881 (strictly above 880) to be in amber zone
    expect(vocColor(881, profile)).toBe('amber')
  })
  it('returns red at or above threshold (1000)', () => {
    expect(vocColor(1001, profile)).toBe('red')
  })
  it('returns gray when no profile', () => {
    expect(vocColor(500, null)).toBe('gray')
  })
})

// ── badge text helpers ────────────────────────────────────────────────────────
describe('tempBadge', () => {
  it('returns Normal for green', () => expect(tempBadge('green')).toBe('Normal'))
  it('returns BREACH for red',  () => expect(tempBadge('red')).toBe('BREACH'))
  it('returns Near Limit for amber', () => expect(tempBadge('amber')).toBe('Near Limit'))
})

describe('vocBadge', () => {
  it('returns Fresh for green',        () => expect(vocBadge('green')).toBe('Fresh'))
  it('returns Elevated for amber',     () => expect(vocBadge('amber')).toBe('Elevated'))
  it('returns Spoilage Risk for red',  () => expect(vocBadge('red')).toBe('Spoilage Risk'))
})
