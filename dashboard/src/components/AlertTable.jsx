/**
 * AlertTable.jsx
 * Table showing alert history for the device.
 */

import { fmtTs, fmtDuration, alertLabel } from '../utils/helpers.js'

const SEV_BADGE = {
  critical: 'bg-[#A31C18]/15 text-[#A31C18] border-[#A31C18]/30',
  warning:  'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/30',
  info:     'bg-[#64748B]/15 text-[#64748B] border-[#64748B]/30',
}

export function AlertTable({ alerts = [] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-sm">
        <h2 className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest mb-3">Alert History</h2>
        <p className="text-[#A3A3A3] text-sm">No alerts recorded for this device.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#333333]">
        <h2 className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest">Alert History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#F5F5F5]">
          <thead className="bg-[#242424]">
            <tr>
              {['Type', 'Severity', 'Started', 'Ended', 'Duration', 'Peak'].map(col => (
                <th key={col} className="px-4 py-2.5 text-left text-[#A3A3A3] font-semibold uppercase tracking-wider text-[11px]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333333]">
            {alerts.map(a => (
              <tr key={a.id} className="hover:bg-[#242424]/60 transition-colors">
                <td className="px-4 py-2.5 font-medium text-[#F5F5F5]">{alertLabel(a.type)}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${SEV_BADGE[a.severity] || SEV_BADGE.warning}`}>
                    {a.severity}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-[#A3A3A3]">{fmtTs(a.started_at)}</td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-[#A3A3A3]">
                  {a.ended_at ? fmtTs(a.ended_at) : <span className="text-[#A31C18] font-bold">Ongoing</span>}
                </td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-[#A3A3A3]">
                  {a.duration_s != null ? fmtDuration(a.duration_s) : '—'}
                </td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-[#F5F5F5]">
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

