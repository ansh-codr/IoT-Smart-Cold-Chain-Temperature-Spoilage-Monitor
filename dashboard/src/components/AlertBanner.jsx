/**
 * AlertBanner.jsx
 * Sticky top banner shown while an alert is active.
 */

import { AlertTriangle, XCircle, Info } from 'lucide-react'
import { fmtDuration, alertLabel } from '../utils/helpers.js'

const SEV_STYLES = {
  critical: {
    wrapper: 'bg-rose-950/80 border-rose-500/60 text-rose-200',
    icon:    'text-rose-400',
    Icon:    XCircle,
  },
  warning: {
    wrapper: 'bg-amber-950/80 border-amber-500/60 text-amber-200',
    icon:    'text-amber-400',
    Icon:    AlertTriangle,
  },
  info: {
    wrapper: 'bg-sky-950/80 border-sky-500/60 text-sky-200',
    icon:    'text-sky-400',
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
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${style.wrapper}`}
    >
      <Icon size={20} className={`mt-0.5 shrink-0 ${style.icon}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm">{alertLabel(alert.type)}</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.icon} border-current bg-white/5`}>
            {sev}
          </span>
        </div>
        <p className="text-xs opacity-80 mt-0.5">{alert.message}</p>
        {durationS !== null && (
          <p className="text-[11px] opacity-60 mt-1">
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

