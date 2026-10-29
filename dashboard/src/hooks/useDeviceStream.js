/**
 * useDeviceStream.js
 * 
 * Custom hook: opens SSE stream to /api/stream?device_id=<id>.
 * - Handles "reading", "status", "alert" SSE events.
 * - Keeps last 200 readings in state for chart history.
 * - Fetches initial snapshot (status + last 100 readings) on mount.
 * - Auto-reconnects with exponential backoff on disconnect.
 * - Exposes connState: "connecting" | "live" | "reconnecting" | "error"
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const API_BASE = '/api'
const MAX_HISTORY = 200
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

export function useDeviceStream(deviceId) {
  const [readings, setReadings] = useState([])      // last MAX_HISTORY readings
  const [status, setStatus] = useState(null)        // latest /api/status payload
  const [alerts, setAlerts] = useState([])          // alert history list
  const [activeAlert, setActiveAlert] = useState(null)
  const [connState, setConnState] = useState('connecting')
  const [profiles, setProfiles] = useState([])

  const esRef = useRef(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const retryRef = useRef(null)
  const mountedRef = useRef(true)

  // Fetch initial status snapshot
  const fetchInitialStatus = useCallback(async () => {
    if (!deviceId) return
    try {
      const res = await fetch(`${API_BASE}/status?device_id=${deviceId}`)
      if (!res.ok) return
      const data = await res.json()
      if (!mountedRef.current) return
      setStatus(data)
      if (data.active_alert) setActiveAlert(data.active_alert)
    } catch (_) { /* backend may be down — SSE will show reconnecting */ }
  }, [deviceId])

  // Fetch last 100 readings for initial chart fill
  const fetchInitialReadings = useCallback(async () => {
    if (!deviceId) return
    try {
      const res = await fetch(`${API_BASE}/readings?device_id=${deviceId}&limit=100`)
      if (!res.ok) return
      const data = await res.json()
      if (!mountedRef.current) return
      const normalized = (data.readings || []).map(normalizeReading)
      setReadings(normalized.slice(-MAX_HISTORY))
    } catch (_) {}
  }, [deviceId])

  // Fetch alert history
  const fetchAlerts = useCallback(async () => {
    if (!deviceId) return
    try {
      const res = await fetch(`${API_BASE}/alerts?device_id=${deviceId}&limit=50`)
      if (!res.ok) return
      const data = await res.json()
      if (!mountedRef.current) return
      setAlerts(data.alerts || [])
    } catch (_) {}
  }, [deviceId])

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profiles`)
      if (!res.ok) return
      const data = await res.json()
      if (!mountedRef.current) return
      setProfiles(data.profiles || [])
    } catch (_) {}
  }, [])

  // Open SSE with backoff reconnect
  const openStream = useCallback(() => {
    if (!deviceId || !mountedRef.current) return

    setConnState('connecting')
    const es = new EventSource(`${API_BASE}/stream?device_id=${deviceId}`)
    esRef.current = es

    es.onopen = () => {
      if (!mountedRef.current) return
      backoffRef.current = INITIAL_BACKOFF_MS
      setConnState('live')
    }

    es.addEventListener('reading', (e) => {
      if (!mountedRef.current) return
      try {
        const r = normalizeReading(JSON.parse(e.data))
        setReadings(prev => {
          const next = [...prev, r]
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
        })
      } catch (_) {}
    })

    es.addEventListener('status', (e) => {
      if (!mountedRef.current) return
      try {
        const s = JSON.parse(e.data)
        setStatus(prev => ({ ...(prev || {}), ...s }))
        setActiveAlert(s.active_alert ?? null)
      } catch (_) {}
    })

    es.addEventListener('alert', (e) => {
      if (!mountedRef.current) return
      try {
        const alertEvent = JSON.parse(e.data)
        // Refresh full alert list whenever any alert event arrives
        fetchAlerts()
        if (alertEvent.action === 'opened' || alertEvent.action === 'escalated') {
          setActiveAlert(alertEvent)
        } else if (alertEvent.action === 'closed') {
          setActiveAlert(prev =>
            prev && prev.id === alertEvent.alert_id ? null : prev
          )
        }
      } catch (_) {}
    })

    es.onerror = () => {
      if (!mountedRef.current) return
      es.close()
      esRef.current = null
      setConnState('reconnecting')
      const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS)
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
      retryRef.current = setTimeout(openStream, delay)
    }
  }, [deviceId, fetchAlerts])

  // Mount / deviceId change
  useEffect(() => {
    mountedRef.current = true
    backoffRef.current = INITIAL_BACKOFF_MS

    if (deviceId) {
      fetchInitialStatus()
      fetchInitialReadings()
      fetchAlerts()
      fetchProfiles()
      openStream()
    }

    return () => {
      mountedRef.current = false
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [deviceId, fetchInitialStatus, fetchInitialReadings, fetchAlerts, fetchProfiles, openStream])

  return { readings, status, alerts, activeAlert, connState, profiles, refetchAlerts: fetchAlerts }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a raw reading from the API into a consistent shape.
 * Fixes: temp_c/humidity returned as strings from MySQL DECIMAL columns.
 * Fixes: buffered returned as 0/1 integer instead of boolean.
 */
function normalizeReading(r) {
  return {
    ...r,
    temp_c:   Number(r.temp_c),
    humidity: Number(r.humidity),
    voc_raw:  Number(r.voc_raw),
    buffered: Boolean(r.buffered === true || r.buffered === 1),
    ts:       Number(r.ts),
  }
}
