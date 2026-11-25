/**
 * TrendChart.jsx — High-Fidelity Multi-Sensor IoT Telemetry Graph
 *
 * Visualizes simultaneous Temperature, Humidity, and VOC Gas ADC streams
 * from the live ESP32 hardware in real time with dual axes, safe envelopes,
 * and live KPI cards.
 */

import { useState, useMemo } from 'react';
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
  Legend
} from 'recharts';
import { Thermometer, Droplets, Wind, Activity } from 'lucide-react';

const RANGE_MINUTES = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
  'All': Infinity
};

export function TrendChart({ readings = [], profile = null }) {
  const [range, setRange] = useState('30m');
  const [showTemp, setShowTemp] = useState(true);
  const [showHumidity, setShowHumidity] = useState(true);
  const [showVoc, setShowVoc] = useState(true);

  const tMin = profile ? Number(profile.t_min_c) : 2;
  const tMax = profile ? Number(profile.t_max_c) : 8;

  // Ensure chronological order and filter to selected range
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];

    const sorted = [...readings].sort((a, b) => (a.ts - b.ts) || (a.seq - b.seq));
    if (range === 'All') return sorted;

    const minutes = RANGE_MINUTES[range] || 30;
    const latestTs = sorted[sorted.length - 1]?.ts || Math.floor(Date.now() / 1000);
    const cutoff = latestTs - minutes * 60;
    const filtered = sorted.filter(r => r.ts >= cutoff);

    // Fallback: If time-window produces 0 records due to clock skew, show last 40 readings
    return filtered.length > 0 ? filtered : sorted.slice(-40);
  }, [readings, range]);

  const latest = chartData[chartData.length - 1] ?? null;

  // Format timestamp for X-Axis and Tooltip
  const fmtTime = (ts) => {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full gap-3">
      {/* Header and Live KPI Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#333333]/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
          <div>
            <h3 className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wider flex items-center gap-2">
              <span>Live Multi-Sensor Telemetry</span>
              <span className="text-[10px] text-[#10B981] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30">
                ACTIVE HARDWARE STREAM
              </span>
            </h3>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              Simultaneous 3-channel acquisition (DHT22 Temp, Ambient Humidity, MQ-135 Gas)
            </p>
          </div>
        </div>

        {/* Live Metric Badges */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-lg bg-[#242424] border border-[#10B981]/40 flex items-center gap-1.5 text-xs font-mono font-bold text-[#10B981]">
            <Thermometer size={13} />
            <span>{latest?.temp_c != null ? `${Number(latest.temp_c).toFixed(1)}°C` : '--'}</span>
          </div>
          <div className="px-3 py-1 rounded-lg bg-[#242424] border border-[#0EA5E9]/40 flex items-center gap-1.5 text-xs font-mono font-bold text-[#0EA5E9]">
            <Droplets size={13} />
            <span>{latest?.humidity != null ? `${Number(latest.humidity).toFixed(1)}%` : '--'}</span>
          </div>
          <div className="px-3 py-1 rounded-lg bg-[#242424] border border-[#F59E0B]/40 flex items-center gap-1.5 text-xs font-mono font-bold text-[#F59E0B]">
            <Wind size={13} />
            <span>{latest?.voc_raw != null ? `${latest.voc_raw} ADC` : '--'}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Time Range + Sensor Visibility */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Metric toggles */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#10B981]">
            <input
              type="checkbox"
              checked={showTemp}
              onChange={e => setShowTemp(e.target.checked)}
              className="accent-[#10B981] rounded"
            />
            <span>Temperature (°C)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#0EA5E9]">
            <input
              type="checkbox"
              checked={showHumidity}
              onChange={e => setShowHumidity(e.target.checked)}
              className="accent-[#0EA5E9] rounded"
            />
            <span>Humidity (% RH)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#F59E0B]">
            <input
              type="checkbox"
              checked={showVoc}
              onChange={e => setShowVoc(e.target.checked)}
              className="accent-[#F59E0B] rounded"
            />
            <span>Gas VOC (ADC)</span>
          </label>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1 bg-[#242424] border border-[#333333] rounded-lg p-0.5 font-medium">
          {Object.keys(RANGE_MINUTES).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                range === r
                  ? 'bg-[#10B981] text-[#120F0D]'
                  : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      {chartData.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-[#A3A3A3] text-xs gap-2 border border-dashed border-[#333333] rounded-xl">
          <Activity size={24} className="animate-spin text-[#10B981]" />
          <span>Awaiting live telemetry packets from ESP32 node...</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />

            <XAxis
              dataKey="ts"
              tickFormatter={fmtTime}
              tick={{ fill: '#A3A3A3', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#333333' }}
              minTickGap={35}
            />

            {/* Left Y-Axis: Temperature (°C) */}
            <YAxis
              yAxisId="temp"
              tick={{ fill: '#10B981', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#333333' }}
              unit="°C"
              domain={['auto', 'auto']}
              width={42}
            />

            {/* Right Y-Axis: Humidity (% RH) and VOC ADC */}
            <YAxis
              yAxisId="metrics"
              orientation="right"
              tick={{ fill: '#0EA5E9', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#333333' }}
              domain={[0, 'auto']}
              width={42}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#1E1E1E',
                border: '1px solid #444444',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#F5F5F5'
              }}
              labelFormatter={(ts) => `Time: ${fmtTime(ts)} (UTC)`}
              formatter={(val, name) => {
                if (name === 'Storage Temp (°C)') return [`${Number(val).toFixed(2)} °C`, name];
                if (name === 'Humidity (% RH)') return [`${Number(val).toFixed(1)} %`, name];
                if (name === 'VOC Gas Index') return [`${val} ADC`, name];
                return [val, name];
              }}
            />

            <Legend wrapperStyle={{ fontSize: 11, paddingTop: '10px' }} />

            {/* Safe Temperature Zone Reference Band */}
            {tMin != null && tMax != null && (
              <ReferenceArea
                yAxisId="temp"
                y1={tMin}
                y2={tMax}
                fill="#10B981"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            )}

            {/* Temperature Stream */}
            {showTemp && (
              <Area
                yAxisId="temp"
                type="monotone"
                dataKey="temp_c"
                name="Storage Temp (°C)"
                stroke="#10B981"
                strokeWidth={2.2}
                fill="url(#tempGradient)"
                isAnimationActive={false}
                dot={{ r: 2.5, fill: '#10B981' }}
              />
            )}

            {/* Humidity Stream */}
            {showHumidity && (
              <Line
                yAxisId="metrics"
                type="monotone"
                dataKey="humidity"
                name="Humidity (% RH)"
                stroke="#0EA5E9"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {/* VOC Gas ADC Stream */}
            {showVoc && (
              <Line
                yAxisId="metrics"
                type="monotone"
                dataKey="voc_raw"
                name="VOC Gas Index"
                stroke="#F59E0B"
                strokeWidth={1.8}
                strokeDasharray="4 2"
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Footer Meta Summary */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-[#A3A3A3] pt-1 border-t border-[#333333]/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            Safe Zone: {tMin}°C to {tMax}°C
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0EA5E9]" />
            Optimal RH: 40% – 85%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            Spoilage Trigger: &gt; 1,000 ADC
          </span>
        </div>
        <span className="font-mono text-[#F5F5F5]">
          Telemetry buffer: {chartData.length} packets recorded
        </span>
      </div>
    </div>
  );
}
