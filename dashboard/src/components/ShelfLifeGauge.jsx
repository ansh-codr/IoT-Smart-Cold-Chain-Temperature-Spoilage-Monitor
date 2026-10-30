/**
 * ShelfLifeGauge.jsx
 * Semicircle gauge for remaining shelf life %.
 * Color: green ≥25%, amber 10–25%, red <10%.
 */

export function ShelfLifeGauge({ percent = 0, remainingHours = null, rateFactor = null }) {
  // Clamp to 0–100
  const pct = Math.max(0, Math.min(100, percent))

  // SVG semicircle math
  const R = 56       // radius
  const CX = 70      // center x
  const CY = 70      // center y (bottom of viewBox — semicircle opens upward)
  const STROKE = 12  // stroke width
  const circumference = Math.PI * R   // half-circle arc length
  const dashOffset = circumference - (pct / 100) * circumference

  const color =
    pct >= 25 ? '#16A34A' :   // brand green
    pct >= 10 ? '#D97706' :   // brand amber
                '#A31C18'     // brand red

  const textColor =
    pct >= 25 ? 'text-[#16A34A]' :
    pct >= 10 ? 'text-[#D97706]'   :
                'text-[#A31C18]'

  const rateLabel = rateFactor
    ? rateFactor >= 1.05 || rateFactor <= 0.95
      ? `Ageing ${rateFactor.toFixed(2)}× ${rateFactor > 1 ? 'faster' : 'slower'} than ideal`
      : 'Ageing at ideal rate (1.0×)'
    : null

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-sm flex flex-col items-center gap-2">
      <span className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-widest self-start">
        Remaining Shelf Life
      </span>

      {/* SVG Gauge */}
      <div className="relative">
        <svg width="140" height="80" viewBox="0 0 140 80">
          {/* Background track */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke="#333333"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={`text-2xl font-extrabold font-mono tabular-nums ${textColor}`}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Hours remaining */}
      {remainingHours !== null && (
        <p className="text-[#F5F5F5] font-semibold text-sm">
          {remainingHours.toFixed(1)} hrs remaining
        </p>
      )}

      {/* Rate factor explanation */}
      {rateLabel && (
        <p className="text-[11px] text-[#A3A3A3] text-center border-t border-[#333333] pt-2 w-full">
          {rateLabel}
        </p>
      )}

      {!remainingHours && !rateFactor && (
        <p className="text-xs text-[#A3A3A3]">No profile assigned</p>
      )}
    </div>
  )
}

