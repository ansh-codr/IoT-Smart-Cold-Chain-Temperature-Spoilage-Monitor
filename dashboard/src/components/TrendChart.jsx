/**
 * TrendChart.jsx
 * 
 * Recharts line chart showing live temperature + safe-range band.
 * Optional toggle for humidity and VOC on secondary Y-axis.
 * Buffered readings are shown with a distinct dot marker.
 */

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  ReferenceArea,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Scatter,
} from 'recharts'

const RANGE_MINUTES = {
  '5m':  5,
  '30m': 30,
  '2h':  120,
}

export function TrendChart({ readings = [], profile = null }) {
  const [range, setRange] = useState('30m')
  const [showHumidity, setShowHumidity] = useState(false)
  const [showVoc, setShowVoc] = useState(false)

  const tMin = profile ? Number(profile.t_min_c) : null
  const tMax = profile ? Number(profile.t_max_c) : null

  // Filter readings to selected time range
  const filtered = useMemo(() => {
    const minutes = RANGE_MINUTES[range]
    const cutoff = Date.now() / 1000 - minutes * 60
    return readings.filter(r => r.ts >= cutoff)
  }, [readings, range])

  // Format x-axis as local HH:MM:SS
  const fmtTime = (ts) =>
    new Date(ts * 1000).toLocaleTimeString('en-IN', { hour12: false })

  // Custom dot for buffered readings (hollow circle)
  const BufferedDot = (props) => {
    const { cx, cy, payload } = props
    if (!payload?.buffered) return null
    return (
      <circle
        cx={cx} cy={cy} r={5}
        fill="transparent"
        stroke="#f59e0b"
        strokeWidth={2}
      />
    )
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5 shadow-lg flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Live Sensor Trend
        </h2>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-1 text-xs">
          {Object.keys(RANGE_MINUTES).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                range === r
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Axis toggles */}
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showHumidity}
              onChange={e => setShowHumidity(e.target.checked)}
              className="accent-sky-400"
            />
            <span className="text-sky-400 font-medium">Humidity %</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showVoc}
              onChange={e => setShowVoc(e.target.checked)}
              className="accent-amber-400"
            />
            <span className="text-amber-400 font-medium">VOC raw</span>
          </label>
        </div>
      </div>

      {/* Chart */}
      {filtered.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-zinc-500 text-sm">
          No readings in the selected time range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={filtered} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="ts"
              tickFormatter={fmtTime}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            {/* Left axis: temperature */}
            <YAxis
              yAxisId="temp"
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
              label={{ value: '°C', position: 'insideTop', fill: '#71717a', fontSize: 11 }}
            />
            {/* Right axis: humidity & VOC */}
            {(showHumidity || showVoc) && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={fmtTime}
              formatter={(val, name) => {
                if (name === 'temp_c')  return [`${Number(val).toFixed(2)} °C`, 'Temp']
                if (name === 'humidity') return [`${Number(val).toFixed(1)} %`, 'Humidity']
                if (name === 'voc_raw')  return [`${val} ADC`, 'VOC']
                return [val, name]
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }}
            />

            {/* Safe zone band */}
            {tMin !== null && tMax !== null && (
              <ReferenceArea
                yAxisId="temp"
                y1={tMin}
                y2={tMax}
                fill="#10b981"
                fillOpacity={0.07}
                strokeOpacity={0}
              />
            )}

            {/* Temperature line */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp_c"
              stroke="#10b981"
              strokeWidth={2}
              dot={<BufferedDot />}
              activeDot={{ r: 4, fill: '#10b981' }}
              isAnimationActive={false}
              name="temp_c"
            />

            {/* Humidity line (optional) */}
            {showHumidity && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="humidity"
                stroke="#38bdf8"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name="humidity"
              />
            )}

            {/* VOC scatter (optional) */}
            {showVoc && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="voc_raw"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name="voc_raw"
                strokeDasharray="4 2"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend note for buffered */}
      <p className="text-[11px] text-zinc-500">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-400 mr-1.5 align-middle" />
        Hollow amber circles = offline-buffered readings
        {tMin !== null && (
          <span className="ml-4">
            <span className="text-emerald-400 font-semibold">Safe zone: {tMin}°C – {tMax}°C</span>
          </span>
        )}
      </p>
    </div>
  )
}
