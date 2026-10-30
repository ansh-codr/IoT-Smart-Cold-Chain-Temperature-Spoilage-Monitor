/**
 * AlertBanner.jsx
 * Sticky top banner shown while an alert is active.
 */

import { AlertTriangle, XCircle, Info } from 'lucide-react'
import { fmtDuration, alertLabel } from '../utils/helpers.js'

const SEV_STYLES = {
  critical: {
    wrapper: 'bg-[#A31C18]/15 border-[#A31C18]/40 text-[#F5F5F5]',
    icon:    'text-[#A31C18]',
    badge:   'bg-[#A31C18]/20 text-[#A31C18] border-[#A31C18]/40',
    Icon:    XCircle,
  },
  warning: {
    wrapper: 'bg-[#D97706]/15 border-[#D97706]/40 text-[#F5F5F5]',
    icon:    'text-[#D97706]',
    badge:   'bg-[#D97706]/20 text-[#D97706] border-[#D97706]/40',
    Icon:    AlertTriangle,
  },
  info: {
    wrapper: 'bg-[#64748B]/15 border-[#64748B]/40 text-[#F5F5F5]',
    icon:    'text-[#64748B]',
    badge:   'bg-[#64748B]/20 text-[#64748B] border-[#64748B]/40',
    Icon:    Info,
  },
}

export function AlertBanner({ alert, startedAt }) {
  if (!alert) return null

  const sev = alert.severity || 'warning'
  const style = SEV_STYLES[sev] || SEV_STYLES.warning
  const { Icon } = style

  const durationS = startedAt
    ? Math.floor(Date.now() / 1000) - startedAt
    : null

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm ${style.wrapper}`}
    >
      <Icon size={20} className={`mt-0.5 shrink-0 ${style.icon}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm text-[#F5F5F5]">{alertLabel(alert.type)}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.badge}`}>
            {sev}
          </span>
        </div>
        <p className="text-xs text-[#A3A3A3] mt-0.5">{alert.message}</p>
        {durationS !== null && (
          <p className="text-[11px] text-[#A3A3A3] opacity-80 mt-1">
            Active for {fmtDuration(durationS)}
            {alert.peak_value !== null && alert.peak_value !== undefined
              ? ` · Peak: ${Number(alert.peak_value).toFixed(2)}`
              : ''}
          </p>
        )}
      </div>
    </div>
  )
}

