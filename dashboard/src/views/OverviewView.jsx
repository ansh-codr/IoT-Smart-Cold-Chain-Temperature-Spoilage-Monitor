import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Boxes, 
  AlertTriangle, 
  Cpu, 
  Repeat, 
  Clock, 
  TrendingUp, 
  Activity,
  ArrowRight,
  Wifi,
  WifiOff,
  Thermometer,
  Droplets,
  Wind,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { TrendChart } from '../components/TrendChart.jsx';
import { ShelfLifeGauge } from '../components/ShelfLifeGauge.jsx';
import { tempColor, tempBadge, vocColor, vocBadge, shelfLifeColor, fmtTs } from '../utils/helpers.js';

export function OverviewView({ onNavigate, liveReadings = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());

  const loadOverview = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/overview');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastFetchTime(Date.now());
      }
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 10000); // 10s polling for background stats
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-[#1E1E1E] rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-[#1E1E1E] rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const telemetry = data?.telemetry;
  const serverTime = data?.server_time || Math.floor(Date.now() / 1000);

  // Determine freshness of IoT telemetry
  const readingAgeS = telemetry?.last_seen_ts ? (serverTime - telemetry.last_seen_ts) : null;
  const liveLatest = liveReadings.length > 0 ? liveReadings[liveReadings.length - 1] : null;
  const isTelemetryLive = liveLatest ? true : (readingAgeS !== null && readingAgeS <= 35);
  const isTelemetryStale = !liveLatest && readingAgeS !== null && readingAgeS > 35 && readingAgeS <= 300;
  const isTelemetryUnavailable = !liveLatest && (readingAgeS === null || readingAgeS > 300);

  // Primary sensor metrics (prefer real-time live SSE readings over polled snapshot)
  const latestR = liveLatest || telemetry?.latest_reading;
  const profile = telemetry?.profile;
  const tColor = tempColor(latestR?.temp_c, profile);
  const vColor = vocColor(latestR?.voc_raw, profile);

  const cards = [
    {
      title: 'Active Shipments',
      value: stats?.active_shipments ?? 0,
      sub: 'Dispatched & monitoring in transit',
      icon: Truck,
      color: '#16A34A',
      action: 'shipments'
    },
    {
      title: 'Inventory Batches',
      value: `${stats?.inventory_batches ?? 0} Lots`,
      sub: `${Number(stats?.inventory_quantity ?? 0).toLocaleString()} stored units`,
      icon: Boxes,
      color: '#64748B',
      action: 'inventory'
    },
    {
      title: 'IoT Monitoring Nodes',
      value: `${stats?.online_devices ?? 0} Online`,
      sub: stats?.offline_devices > 0 ? `${stats.offline_devices} node(s) offline` : 'All telemetry active',
      icon: Cpu,
      color: stats?.offline_devices > 0 ? '#D97706' : '#16A34A',
      action: 'iot'
    },
    {
      title: 'Thermal Excursions',
      value: stats?.critical_alerts ?? 0,
      sub: 'Active safe-window breaches',
      icon: AlertTriangle,
      color: stats?.critical_alerts > 0 ? '#A31C18' : '#16A34A',
      action: 'alerts'
    },
    {
      title: 'Batches Near Expiry',
      value: stats?.near_expiry_batches ?? 0,
      sub: 'Expiring within 7 days',
      icon: Clock,
      color: stats?.near_expiry_batches > 0 ? '#D97706' : '#16A34A',
      action: 'inventory'
    },
    {
      title: 'Replacement Planner',
      value: `${stats?.pending_replacements ?? 0} Pending`,
      sub: 'Emergency re-allocation tasks',
      icon: Repeat,
      color: '#64748B',
      action: 'replacement'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Overview Header Banner */}
      <div className="bg-[#1E1E1E] border border-[#333333] p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]"></span>
            <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight">ColdChain IQ Operations Dashboard</h2>
          </div>
          <p className="text-xs text-[#A3A3A3]">
            Integrated multi-tenant cold-chain logistics, batch-level Arrhenius physical degradation tracking, and ESP32 telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Telemetry freshness pill */}
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
            isTelemetryLive
              ? 'bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/40'
              : isTelemetryStale
              ? 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/40'
              : 'bg-[#A31C18]/15 text-[#A31C18] border-[#A31C18]/40'
          }`}>
            {isTelemetryLive ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>
              {isTelemetryLive ? 'Sensors Ingesting Live (ESP32)' : isTelemetryStale ? 'Telemetry Stale (>35s)' : 'Sensors Offline'}
            </span>
          </div>

          <button
            onClick={loadOverview}
            disabled={refreshing}
            className="p-2 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#A3A3A3] hover:text-[#F5F5F5] border border-[#333333] transition-colors"
            title="Refresh dashboard stats"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div 
              key={i}
              onClick={() => onNavigate(c.action)}
              className="bg-[#1E1E1E] border border-[#333333] hover:border-[#444444] p-5 rounded-xl shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider">{c.title}</span>
                <div className="p-2 rounded-lg bg-[#242424] text-[#A3A3A3] group-hover:text-[#F5F5F5] border border-[#333333] transition-colors">
                  <Icon size={17} />
                </div>
              </div>
              <div className="my-3">
                <div className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">{c.value}</div>
                <div className="text-xs text-[#A3A3A3] mt-0.5">{c.sub}</div>
              </div>
              <div className="pt-2 border-t border-[#333333] flex items-center justify-between text-[11px] font-semibold text-[#16A34A] group-hover:translate-x-0.5 transition-transform">
                <span>Inspect Module</span>
                <ArrowRight size={12} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── DEDICATED IOT MONITORING SECTION ─────────────────────────────────── */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#333333] gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#06110C] border border-[#333333] text-[#16A34A]">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#F5F5F5]">Live IoT Sensor Telemetry</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#242424] text-[#16A34A] border border-[#333333]">
                  Node: {telemetry?.device_id || 'node-01'}
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3]">
                Calibrated DS18B20 1-Wire thermal probe, DHT22 ambient humidity, and MQ-135 VOC indicative channel.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('iot')}
            className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#F5F5F5] text-xs font-semibold flex items-center gap-1.5 border border-[#333333] transition-colors"
          >
            <span>Full Node Console</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {/* 4 Sensor Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Temperature */}
          <div className={`bg-[#242424] border ${tColor === 'red' ? 'border-[#A31C18]' : tColor === 'amber' ? 'border-[#D97706]' : 'border-[#333333]'} rounded-xl p-4 flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Storage Temp</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                tColor === 'red' ? 'bg-[#A31C18]/15 text-[#A31C18] border-[#A31C18]/40' :
                tColor === 'amber' ? 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/40' :
                'bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/40'
              }`}>
                {tempBadge(tColor)}
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#F5F5F5] font-mono">
                {latestR?.temp_c != null ? Number(latestR.temp_c).toFixed(2) : '—'}
              </span>
              <span className="text-xs text-[#A3A3A3] font-semibold">&deg;C</span>
            </div>
            <div className="text-[11px] text-[#A3A3A3] border-t border-[#333333] pt-2">
              Safe window: <strong className="text-[#F5F5F5]">{profile ? `${profile.t_min_c}°C – ${profile.t_max_c}°C` : '2°C – 8°C'}</strong>
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-[#242424] border border-[#333333] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Humidity (DHT22)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#64748B]/15 text-[#64748B] border border-[#64748B]/40">
                Optimal
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#F5F5F5] font-mono">
                {latestR?.humidity != null ? Number(latestR.humidity).toFixed(1) : '—'}
              </span>
              <span className="text-xs text-[#A3A3A3] font-semibold">% RH</span>
            </div>
            <div className="text-[11px] text-[#A3A3A3] border-t border-[#333333] pt-2">
              Ambient condensation baseline
            </div>
          </div>

          {/* VOC Spoilage */}
          <div className={`bg-[#242424] border ${vColor === 'red' ? 'border-[#A31C18]' : vColor === 'amber' ? 'border-[#D97706]' : 'border-[#333333]'} rounded-xl p-4 flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">VOC Gas (MQ-135)</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                vColor === 'red' ? 'bg-[#A31C18]/15 text-[#A31C18] border-[#A31C18]/40' :
                vColor === 'amber' ? 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/40' :
                'bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/40'
              }`}>
                {vocBadge(vColor)}
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#F5F5F5] font-mono">
                {latestR?.voc_raw != null ? latestR.voc_raw : '—'}
              </span>
              <span className="text-xs text-[#A3A3A3] font-semibold">ADC (12-bit)</span>
            </div>
            <div className="text-[11px] text-[#A3A3A3] border-t border-[#333333] pt-2">
              Indicative microbial gas threshold
            </div>
          </div>

          {/* Kinetic Decay Rate */}
          <div className="bg-[#242424] border border-[#333333] rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">Reaction Kinetics</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/40">
                Arrhenius
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#F5F5F5] font-mono">
                {telemetry?.rate_factor != null ? `${Number(telemetry.rate_factor).toFixed(2)}×` : '1.00×'}
              </span>
              <span className="text-xs text-[#A3A3A3] font-semibold">Rate Factor</span>
            </div>
            <div className="text-[11px] text-[#A3A3A3] border-t border-[#333333] pt-2">
              {telemetry?.rate_factor > 1.05 
                ? `Ageing ${(telemetry.rate_factor).toFixed(1)}× faster than reference`
                : 'Storage at ideal baseline rate'}
            </div>
          </div>
        </div>

        {/* Real-time Trend Chart embedded in Overview */}
        <div className="border border-[#333333] rounded-xl p-4 bg-[#171717]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wider">Thermal Stability Curve</h4>
              <p className="text-[11px] text-[#A3A3A3]">Dynamic sensor stream with safe-range envelope</p>
            </div>
            <span className="text-[11px] text-[#A3A3A3] font-mono">
              Last packet: {latestR?.ts ? fmtTs(latestR.ts) : 'Awaiting sensor'}
            </span>
          </div>

          <TrendChart 
            readings={liveReadings} 
            profile={profile || { t_min_c: 2, t_max_c: 8 }} 
          />
        </div>
      </div>

      {/* Quick Action Dock */}
      <div className="bg-[#1E1E1E] border border-[#333333] p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-[#F5F5F5]">Operations Command Workflow</h4>
          <p className="text-xs text-[#A3A3A3] mt-0.5">Quickly dispatch inventory lots or trigger emergency replacement allocation.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => onNavigate('inventory')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Boxes size={14} />
            <span>Receive Batch</span>
          </button>
          <button
            onClick={() => onNavigate('shipments')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#F5F5F5] font-semibold text-xs flex items-center justify-center gap-2 border border-[#333333] transition-colors"
          >
            <Truck size={14} />
            <span>Dispatch Cargo</span>
          </button>
          <button
            onClick={() => onNavigate('replacement')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#F5F5F5] font-semibold text-xs flex items-center justify-center gap-2 border border-[#333333] transition-colors"
          >
            <Repeat size={14} />
            <span>Replacement Request</span>
          </button>
        </div>
      </div>
    </div>
  );
}
