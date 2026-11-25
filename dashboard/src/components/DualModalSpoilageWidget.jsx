import React from 'react';
import { 
  Activity, 
  Flame, 
  Wind, 
  Zap, 
  ShieldAlert, 
  ShieldCheck, 
  HelpCircle,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

export function DualModalSpoilageWidget({ spoilageRisk, latestReading, profile, rateFactor }) {
  // If backend hasn't delivered SRI yet, compute client-side fallback
  const tempC = Number(latestReading?.temp_c ?? 26.1);
  const vocRaw = Number(latestReading?.voc_raw ?? 2200);
  const tMin = Number(profile?.t_min_c ?? 2);
  const tMax = Number(profile?.t_max_c ?? 6);
  const vocBaseline = Number(profile?.voc_baseline ?? 600);
  const vocSpoilDelta = Math.max(1, Number(profile?.voc_spoil_delta ?? 400));

  let thermalComp = 0;
  if (tempC > tMax) {
    const deltaT = tempC - tMax;
    thermalComp = Math.min(100, Math.round((deltaT * 4.2 + (Number(rateFactor || 1) - 1) * 8) * 10) / 10);
  } else if (tempC < tMin) {
    thermalComp = Math.min(100, Math.round((tMin - tempC) * 12 * 10) / 10);
  }

  const deltaVoc = Math.max(0, vocRaw - vocBaseline);
  const gasComp = Math.min(100, Math.round((deltaVoc / vocSpoilDelta) * 100 * 10) / 10);

  let synergy = 1.0;
  if (thermalComp > 25 && gasComp > 25) {
    synergy = 1.0 + Math.min(0.35, Math.round(((thermalComp * gasComp) / 10000) * 0.5 * 100) / 100);
  }

  const calculatedSri = Math.min(100, Math.round(((0.55 * thermalComp) + (0.45 * gasComp)) * synergy * 10) / 10);

  const sri = spoilageRisk?.sri_score != null ? spoilageRisk.sri_score : calculatedSri;
  const tComponent = spoilageRisk?.thermal_component != null ? spoilageRisk.thermal_component : thermalComp;
  const gComponent = spoilageRisk?.gas_component != null ? spoilageRisk.gas_component : gasComp;
  const synFactor = spoilageRisk?.synergy_factor != null ? spoilageRisk.synergy_factor : synergy;

  const isCritical = sri >= 75;
  const isModerate = sri >= 50 && sri < 75;
  const isLow = sri >= 25 && sri < 50;

  const statusLabel = isCritical 
    ? 'CRITICAL SPOILAGE HAZARD' 
    : isModerate 
    ? 'ELEVATED SPOILAGE RISK' 
    : isLow 
    ? 'STABLE / AGING' 
    : 'OPTIMAL INTEGRITY';

  const statusColor = isCritical
    ? 'text-[#EF4444]'
    : isModerate
    ? 'text-[#F59E0B]'
    : isLow
    ? 'text-[#EAB308]'
    : 'text-[#16A34A]';

  const borderColor = isCritical
    ? 'border-[#EF4444]/40 bg-[#EF4444]/5'
    : isModerate
    ? 'border-[#F59E0B]/40 bg-[#F59E0B]/5'
    : 'border-[#16A34A]/40 bg-[#16A34A]/5';

  const gaugeGradient = isCritical
    ? 'from-[#EF4444] via-[#DC2626] to-[#991B1B]'
    : isModerate
    ? 'from-[#F59E0B] to-[#D97706]'
    : 'from-[#16A34A] to-[#15803D]';

  return (
    <div className={`border rounded-2xl p-5 transition-all shadow-xl flex flex-col justify-between h-full ${borderColor}`}>
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#333333] gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${
            isCritical ? 'bg-[#EF4444]/20 border-[#EF4444]/40 text-[#EF4444]' : 'bg-[#16A34A]/20 border-[#16A34A]/40 text-[#16A34A]'
          }`}>
            <Activity size={18} className={isCritical ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-[#F5F5F5] tracking-tight">
                Dual-Modal Spoilage Risk Index (SRI)
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
                isCritical
                  ? 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 animate-pulse'
                  : 'bg-[#16A34A]/20 text-[#16A34A] border-[#16A34A]/40'
              }`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              Cross-domain sensor fusion: Arrhenius thermal kinetics (55%) &amp; MQ-135 volatiles (45%).
            </p>
          </div>
        </div>

        {/* Synergistic Amplification Pill */}
        {synFactor > 1.0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[11px] font-mono font-bold animate-pulse shrink-0">
            <Zap size={13} />
            <span>Synergy: {synFactor.toFixed(2)}&times;</span>
          </div>
        )}
      </div>

      {/* Main Grid: Score Meter + Two Modal Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 my-3.5 items-center flex-1">
        {/* Left: Overall SRI Score Gauge */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center p-3.5 bg-[#181818] rounded-xl border border-[#333333] text-center shadow-inner h-full">
          <span className="text-[10px] uppercase font-bold text-[#A3A3A3] tracking-wider">
            Synthesized Spoilage Score
          </span>
          <div className="my-2 flex items-baseline justify-center gap-1">
            <span className={`text-4xl font-black font-mono tracking-tight ${statusColor}`}>
              {sri.toFixed(1)}
            </span>
            <span className="text-sm font-bold text-[#737373]">%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#262626] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#333333]">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${gaugeGradient} transition-all duration-700`}
              style={{ width: `${Math.min(100, Math.max(4, sri))}%` }}
            />
          </div>

          <div className="flex justify-between w-full text-[9px] text-[#737373] font-mono mt-1">
            <span>0% (Fresh)</span>
            <span>50% (Risk)</span>
            <span>100% (Spoiled)</span>
          </div>
        </div>

        {/* Right: Modal Channels Breakdown */}
        <div className="sm:col-span-7 space-y-2.5 flex flex-col justify-center h-full">
          {/* Modal Channel A: Thermal Kinetic Component */}
          <div className="p-3 bg-[#1E1E1E] rounded-xl border border-[#333333] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#F5F5F5] truncate">
                <Flame size={14} className="text-[#F59E0B] shrink-0" />
                <span className="truncate">Channel A: Thermal Degradation (55% wt)</span>
              </div>
              <span className="font-mono font-bold text-white shrink-0">{tComponent.toFixed(1)}%</span>
            </div>

            <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, tComponent)}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-[10px] text-[#A3A3A3] pt-0.5">
              <span>Temp: <strong className="text-white font-mono">{tempC.toFixed(1)}&deg;C</strong></span>
              <span>Safe: <strong className="text-[#16A34A] font-mono">{tMin}&deg;C&ndash;{tMax}&deg;C</strong></span>
              <span>Factor: <strong className="text-[#F59E0B] font-mono">{Number(rateFactor || 1).toFixed(2)}&times;</strong></span>
            </div>
          </div>

          {/* Modal Channel B: Biochemical Volatiles Component */}
          <div className="p-3 bg-[#1E1E1E] rounded-xl border border-[#333333] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#F5F5F5] truncate">
                <Wind size={14} className="text-[#38BDF8] shrink-0" />
                <span className="truncate">Channel B: Microbial Volatiles (45% wt)</span>
              </div>
              <span className="font-mono font-bold text-white shrink-0">{gComponent.toFixed(1)}%</span>
            </div>

            <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#38BDF8] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, gComponent)}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-[10px] text-[#A3A3A3] pt-0.5">
              <span>MQ-135: <strong className="text-white font-mono">{vocRaw} ADC</strong></span>
              <span>Base: <strong className="text-[#A3A3A3] font-mono">{vocBaseline} ADC</strong></span>
              <span>Spike: <strong className="text-[#38BDF8] font-mono">+{deltaVoc} ADC</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Forensic Findings Footer Note */}
      <div className="pt-2.5 border-t border-[#333333] flex items-center justify-between text-[11px] text-[#A3A3A3] gap-2">
        <div className="flex items-center gap-1.5 truncate">
          <ShieldAlert size={14} className={`shrink-0 ${isCritical ? 'text-[#EF4444]' : 'text-[#16A34A]'}`} />
          <span className="truncate">
            {isCritical
              ? 'Volatile biomarker spike co-occurs with thermal acceleration.'
              : isModerate
              ? 'Moderate degradation detected. Monitor refrigeration.'
              : 'All chemical and physical spoilage indicators within safe limits.'}
          </span>
        </div>

        <div className="font-mono text-[10px] text-[#737373] shrink-0 hidden sm:block">
          SRI = min(100, [0.55 &times; T + 0.45 &times; G] &times; &gamma;)
        </div>
      </div>
    </div>
  );
}
