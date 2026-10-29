/**
 * AlertTable.jsx
 * Table showing alert history for the device.
 */

import { fmtTs, fmtDuration, alertLabel } from '../utils/helpers.js'

const SEV_BADGE = {
  critical: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  warning:  'bg-amber-400/20 text-amber-300 border-amber-400/30',
  info:     'bg-sky-400/20 text-sky-300 border-sky-400/30',
}

export function AlertTable({ alerts = [] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Alert History</h2>
        <p className="text-zinc-500 text-sm">No alerts recorded for this device.</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl shadow-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-700/60">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Alert History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-zinc-300">
          <thead className="bg-zinc-900/60">
            <tr>
              {['Type', 'Severity', 'Started', 'Ended', 'Duration', 'Peak'].map(col => (
                <th key={col} className="px-4 py-2 text-left text-zinc-500 font-semibold uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id} className="border-t border-zinc-700/30 hover:bg-zinc-700/20 transition-colors">
                <td className="px-4 py-2.5 font-medium text-white">{alertLabel(a.type)}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${SEV_BADGE[a.severity] || SEV_BADGE.warning}`}>
                    {a.severity}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-zinc-400">{fmtTs(a.started_at)}</td>
                <td className="px-4 py-2.5 tabular-nums text-zinc-400">
                  {a.ended_at ? fmtTs(a.ended_at) : <span className="text-rose-400 font-semibold">Ongoing</span>}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-zinc-400">
                  {a.duration_s != null ? fmtDuration(a.duration_s) : '—'}
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {a.peak_value != null ? Number(a.peak_value).toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
