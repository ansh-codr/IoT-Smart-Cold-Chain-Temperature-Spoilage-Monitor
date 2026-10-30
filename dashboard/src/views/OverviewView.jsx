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
  ArrowRight
} from 'lucide-react';

export function OverviewView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/overview')
      .then(res => res.json())
      .then(json => {
        setData(json.stats);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load overview data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-zinc-800 rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-zinc-800/60 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: 'Active Shipments',
      value: data?.active_shipments ?? 0,
      sub: 'In-transit & monitoring',
      icon: Truck,
      color: 'emerald',
      action: 'shipments'
    },
    {
      title: 'Inventory Batches',
      value: `${data?.inventory_batches ?? 0} batches`,
      sub: `${data?.inventory_quantity ?? 0} total units`,
      icon: Boxes,
      color: 'blue',
      action: 'inventory'
    },
    {
      title: 'Monitored IoT Nodes',
      value: `${data?.online_devices ?? 0} Online`,
      sub: `${data?.offline_devices ?? 0} Offline nodes`,
      icon: Cpu,
      color: data?.offline_devices > 0 ? 'amber' : 'emerald',
      action: 'iot'
    },
    {
      title: 'Critical Excursions',
      value: data?.critical_alerts ?? 0,
      sub: 'Active temperature alerts',
      icon: AlertTriangle,
      color: data?.critical_alerts > 0 ? 'rose' : 'emerald',
      action: 'alerts'
    },
    {
      title: 'Near-Expiry Batches',
      value: data?.near_expiry_batches ?? 0,
      sub: 'Expiring in next 7 days',
      icon: Clock,
      color: data?.near_expiry_batches > 0 ? 'amber' : 'emerald',
      action: 'inventory'
    },
    {
      title: 'Replacement Planner',
      value: `${data?.pending_replacements ?? 0} Pending`,
      sub: 'Shipment recovery requests',
      icon: Repeat,
      color: 'sky',
      action: 'replacement'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800/80 p-6 rounded-2xl border border-zinc-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">ColdChain IQ Operations Command Center</h2>
          <p className="text-xs text-zinc-400 mt-1">Multi-tenant pharmaceutical & perishables integrity monitoring with Arrhenius predictive kinetics.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-emerald-400">Sensors Ingesting Live (ESP32)</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div 
              key={i}
              onClick={() => onNavigate(c.action)}
              className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700/80 p-5 rounded-xl shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{c.title}</span>
                <div className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 group-hover:text-emerald-400 transition-colors">
                  <Icon size={18} />
                </div>
              </div>
              <div className="my-3">
                <div className="text-2xl font-extrabold text-white tracking-tight">{c.value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{c.sub}</div>
              </div>
              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                <span>View Details</span>
                <ArrowRight size={13} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Architecture & Live Status Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Kinetics Spoilage Engine Status</h3>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            The platform executes active Arrhenius and Q10 reaction kinetics models per sensor timestamp. Temperature breaches accelerate shelf life consumption dynamically (<code className="text-emerald-300">k = A &middot; e^(-Ea/RT)</code>).
          </p>
          <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/80 text-xs space-y-2">
            <div className="flex justify-between text-zinc-300">
              <span>Arrhenius Universal Gas Const (R)</span>
              <span className="font-mono text-emerald-400">8.314 J/(mol&middot;K)</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Sensor Sampling Rate</span>
              <span className="font-mono text-emerald-400">Every 2000 ms</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Offline Buffer Recovery</span>
              <span className="font-mono text-emerald-400">50-slot Flash Ring</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-sky-400" />
              <h3 className="text-sm font-semibold text-zinc-200">Quick Actions</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Access shipment creation, dispatch operations, or create an emergency replacement allocation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('shipments')}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Truck size={14} />
              <span>Create Shipment</span>
            </button>
            <button
              onClick={() => onNavigate('replacement')}
              className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-zinc-700/60"
            >
              <Repeat size={14} />
              <span>Replacement Request</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

