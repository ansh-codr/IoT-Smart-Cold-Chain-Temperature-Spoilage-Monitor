/**
 * App.jsx — Cold Chain Monitor Dashboard
 *
 * Stack: React 19 + Vite + Tailwind CSS v4 + Recharts + Lucide-react
 * Backend: Express + MySQL at http://localhost:3000 (proxied via Vite)
 *
 * Responsibilities:
 *  - Device selector (persisted in localStorage)
 *  - Profile selector (GET /api/profiles → PUT /api/devices/:id/profile)
 *  - SSE stream via useDeviceStream hook
 *  - Live metric cards (temp / humidity / VOC / shelf life)
 *  - Shelf-life semicircle gauge
 *  - Live Recharts trend chart with safe-range band
 *  - Alert banner + alert history table
 *  - Buffered recovery count
 *  - Connection status badge
 */

import { useState, useEffect, useCallback } from 'react'
import { Wifi, WifiOff, Loader2, RefreshCw, Package } from 'lucide-react'

import { useDeviceStream } from './hooks/useDeviceStream.js'
import { MetricCard }     from './components/MetricCard.jsx'
import { ShelfLifeGauge } from './components/ShelfLifeGauge.jsx'
import { TrendChart }     from './components/TrendChart.jsx'
import { AlertBanner }    from './components/AlertBanner.jsx'
import { AlertTable }     from './components/AlertTable.jsx'
import {
  tempColor, tempBadge,
  vocColor, vocBadge,
  shelfLifeColor,
  fmtTs,
} from './utils/helpers.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const DEVICE_STORAGE_KEY = 'coldchain_device_id'
const DEFAULT_DEVICE     = 'node-01'
const API_BASE           = '/api'

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // Device selector — persisted in localStorage
  const [deviceId, setDeviceId] = useState(
    () => localStorage.getItem(DEVICE_STORAGE_KEY) || DEFAULT_DEVICE
  )
  const [deviceInput, setDeviceInput] = useState(deviceId)

  // Profile change state
  const [profileChanging, setProfileChanging] = useState(false)

  // Stream hook
  const {
    readings,
    status,
    alerts,
    activeAlert,
    connState,
    profiles,
    refetchAlerts,
  } = useDeviceStream(deviceId)

  // Persist device selection
  useEffect(() => {
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId)
  }, [deviceId])

  // Change profile
  const handleProfileChange = useCallback(async (profileId) => {
    if (!profileId || !deviceId) return
    setProfileChanging(true)
    try {
      await fetch(`${API_BASE}/devices/${deviceId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: Number(profileId) }),
      })
      // status will auto-refresh via SSE on next reading
    } catch (e) {
      console.error('Profile change failed:', e)
    } finally {
      setProfileChanging(false)
    }
  }, [deviceId])

  // Apply device input
  const applyDevice = () => {
    const trimmed = deviceInput.trim()
    if (trimmed) setDeviceId(trimmed)
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const latest      = readings[readings.length - 1] ?? null
  const profile     = status?.product_profile ?? null
  const shelfLife   = status?.shelf_life ?? null
  const online      = status?.online ?? false
  const buffered    = status?.buffered_recovered_count ?? 0

  const tColor  = tempColor(latest?.temp_c, profile)
  const vColor  = vocColor(latest?.voc_raw, profile)
  const sColor  = shelfLifeColor(shelfLife?.remaining_life_percent)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans antialiased">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur border-b border-zinc-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">

          {/* Title */}
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-lg">❄️</span>
            <span className="font-bold text-sm text-zinc-100 hidden sm:block">
              Cold Chain Monitor
            </span>
          </div>

          {/* Device selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 font-medium hidden sm:block">Device:</label>
            <input
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white w-32 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={deviceInput}
              onChange={e => setDeviceInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyDevice()}
              placeholder="device-id"
            />
            <button
              onClick={applyDevice}
              className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
              title="Apply device"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Profile selector */}
          <div className="flex items-center gap-2">
            <Package size={14} className="text-zinc-500 shrink-0" />
            <select
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={profile?.id ?? ''}
              onChange={e => handleProfileChange(e.target.value)}
              disabled={profileChanging || profiles.length === 0}
            >
              {profiles.length === 0 && (
                <option value="">Loading profiles…</option>
              )}
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Online pill */}
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
            online
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
              : 'bg-zinc-800 border-zinc-700 text-zinc-500'
          }`}>
            {online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {online ? 'Online' : 'Offline'}
          </div>

          {/* SSE connection badge */}
          <div className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            connState === 'live'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : connState === 'connecting'
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {connState === 'live'
              ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live</>
              : connState === 'connecting'
              ? <><Loader2 size={11} className="animate-spin" />Connecting</>
              : <><Loader2 size={11} className="animate-spin" />Reconnecting</>
            }
          </div>

          {/* Buffered recovery badge */}
          {buffered > 0 && (
            <div className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              📦 {buffered} offline readings recovered
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Alert Banner */}
        {activeAlert && (
          <AlertBanner alert={activeAlert} startedAt={activeAlert.started_at} />
        )}

        {/* Backend down notice */}
        {connState === 'reconnecting' && !status && (
          <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-5 py-4 text-zinc-400 text-sm flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-amber-400" />
            Waiting for backend at <code className="text-amber-300 bg-zinc-900/60 px-1.5 py-0.5 rounded text-xs">localhost:5000</code>…
          </div>
        )}

        {/* ── Metric Cards ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Temperature */}
          <MetricCard
            type="temp"
            label="Temperature"
            value={latest?.temp_c != null ? Number(latest.temp_c).toFixed(2) : null}
            unit="°C"
            badge={tempBadge(tColor)}
            badgeColor={tColor}
            subLabel={
              profile
                ? `Safe: ${profile.t_min_c}°C – ${profile.t_max_c}°C · Updated ${latest?.ts ? fmtTs(latest.ts) : '—'}`
                : 'No profile assigned'
            }
          />

          {/* Humidity */}
          <MetricCard
            type="humidity"
            label="Humidity"
            value={latest?.humidity != null ? Number(latest.humidity).toFixed(1) : null}
            unit="% RH"
            badge="DHT22"
            badgeColor="blue"
            subLabel={latest?.ts ? `Updated ${fmtTs(latest.ts)}` : 'No data yet'}
          />

          {/* VOC */}
          <MetricCard
            type="voc"
            label="VOC (indicative)"
            value={latest?.voc_raw != null ? latest.voc_raw : null}
            unit="ADC"
            badge={vocBadge(vColor)}
            badgeColor={vColor}
            subLabel={
              profile
                ? `Baseline: ${profile.voc_baseline} · Spoilage threshold: ${Number(profile.voc_baseline) + Number(profile.voc_spoil_delta)}`
                : 'MQ-135 raw 12-bit reading'
            }
          />

          {/* Shelf Life */}
          <MetricCard
            type="shelf"
            label="Shelf Life"
            value={shelfLife?.remaining_life_percent != null
              ? `${Number(shelfLife.remaining_life_percent).toFixed(1)}`
              : null}
            unit="%"
            badge={
              shelfLife?.remaining_life_percent != null
                ? `${Number(shelfLife.remaining_life_hours).toFixed(1)} hrs left`
                : 'No profile'
            }
            badgeColor={sColor}
            subLabel={
              shelfLife?.rate_factor != null
                ? shelfLife.rate_factor >= 1.05 || shelfLife.rate_factor <= 0.95
                  ? `Ageing ${Number(shelfLife.rate_factor).toFixed(2)}× ${shelfLife.rate_factor > 1 ? 'faster' : 'slower'}`
                  : 'Ageing at ideal rate (1.0×)'
                : null
            }
          />
        </section>

        {/* ── Gauge + Chart Row ─────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <ShelfLifeGauge
              percent={shelfLife?.remaining_life_percent ?? 0}
              remainingHours={shelfLife?.remaining_life_hours ?? null}
              rateFactor={shelfLife?.rate_factor ?? null}
            />
          </div>
          <div className="lg:col-span-3">
            <TrendChart readings={readings} profile={profile} />
          </div>
        </section>

        {/* ── Alert History ────────────────────────────────────────────────── */}
        <section>
          <AlertTable alerts={alerts} />
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-zinc-600 py-4 border-t border-zinc-800/60">
          GLA University · B.Tech CSE Final Year Project · Cold Chain Monitor · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  )
}
