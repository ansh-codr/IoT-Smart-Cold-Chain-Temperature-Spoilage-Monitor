/**
 * MetricCard.jsx
 * Displays a single sensor metric (temp/humidity/voc/shelf-life).
 */

import { Thermometer, Droplets, Wind, Clock } from 'lucide-react'

const ICONS = {
  temp: Thermometer,
  humidity: Droplets,
  voc: Wind,
  shelf: Clock,
}

export function MetricCard({ type, label, value, unit, badge, badgeColor, subLabel }) {
  const Icon = ICONS[type] || Thermometer

  const borderColors = {
    green:  'border-emerald-500/50',
    amber:  'border-amber-400/50',
    red:    'border-rose-500/50',
    blue:   'border-sky-400/50',
    gray:   'border-zinc-600/50',
  }

  const badgeColors = {
    green:  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    amber:  'bg-amber-400/20 text-amber-300 border border-amber-400/30',
    red:    'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    blue:   'bg-sky-400/20 text-sky-300 border border-sky-400/30',
    gray:   'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30',
  }

  const iconColors = {
    green:  'text-emerald-400',
    amber:  'text-amber-400',
    red:    'text-rose-400',
    blue:   'text-sky-400',
    gray:   'text-zinc-500',
  }

  const color = badgeColor || 'gray'

  return (
    <div className={`bg-zinc-800/80 backdrop-blur border ${borderColors[color]} rounded-xl p-5 flex flex-col gap-3 shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={18} className={iconColors[color]} />
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{label}</span>
        </div>
        {badge && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeColors[color]}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-white tabular-nums leading-none">
          {value ?? '—'}
        </span>
        {unit && <span className="text-sm text-zinc-400 font-medium">{unit}</span>}
      </div>

      {subLabel && (
        <p className="text-xs text-zinc-500 border-t border-zinc-700/60 pt-2">{subLabel}</p>
      )}
    </div>
  )
}
