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
    green:  'border-[#16A34A]/40',
    amber:  'border-[#D97706]/40',
    red:    'border-[#A31C18]/40',
    blue:   'border-[#64748B]/40',
    gray:   'border-[#333333]',
  }

  const badgeColors = {
    green:  'bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/30',
    amber:  'bg-[#D97706]/15 text-[#D97706] border border-[#D97706]/30',
    red:    'bg-[#A31C18]/15 text-[#A31C18] border border-[#A31C18]/30',
    blue:   'bg-[#64748B]/15 text-[#64748B] border border-[#64748B]/30',
    gray:   'bg-[#242424] text-[#A3A3A3] border border-[#333333]',
  }

  const iconColors = {
    green:  'text-[#16A34A]',
    amber:  'text-[#D97706]',
    red:    'text-[#A31C18]',
    blue:   'text-[#64748B]',
    gray:   'text-[#A3A3A3]',
  }

  const color = badgeColor || 'gray'

  return (
    <div className={`bg-[#1E1E1E] border ${borderColors[color]} rounded-xl p-5 flex flex-col gap-3 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={18} className={iconColors[color]} />
          <span className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-widest">{label}</span>
        </div>
        {badge && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeColors[color]}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-[#F5F5F5] font-mono tabular-nums leading-none">
          {value ?? '—'}
        </span>
        {unit && <span className="text-sm text-[#A3A3A3] font-medium">{unit}</span>}
      </div>

      {subLabel && (
        <p className="text-xs text-[#A3A3A3] border-t border-[#333333] pt-2">{subLabel}</p>
      )}
    </div>
  )
}

