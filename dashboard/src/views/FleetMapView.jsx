import React, { useState } from 'react';
import { 
  Truck, 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Radio, 
  Battery, 
  PhoneCall, 
  Zap,
  Clock,
  Compass
} from 'lucide-react';

export function FleetMapView({ activeDeviceId = 'node-03', liveTemp = 26.1, onTriggerBuzzer }) {
  const [selectedTruck, setSelectedTruck] = useState('TRK-809');
  const [buzzerTriggered, setBuzzerTriggered] = useState(false);

  const fleet = [
    {
      id: 'TRK-809',
      nodeId: 'node-03',
      name: 'Reefer Express 809',
      driver: 'Vikram Singh',
      phone: '+91 98765 43210',
      manifest: 'Dairy & Biologics (2°C–6°C)',
      temp: liveTemp,
      targetRange: '2.0°C – 6.0°C',
      isBreached: liveTemp > 6.0 || liveTemp < 2.0,
      speed: '64 km/h',
      battery: '94%',
      lat: 27.892,
      lng: 77.674,
      locationName: 'NH-19 Expressway (Near Kosi Kalan)',
      destination: 'GLA University Logistics Depot, Mathura',
      eta: '34 mins',
      progress: 68,
      routePoints: [
        { name: 'Gurugram Superhub', status: 'completed', time: '19:40' },
        { name: 'Palwal Transit Gate', status: 'completed', time: '21:15' },
        { name: 'Kosi Kalan Checkpoint', status: 'active', time: '22:50' },
        { name: 'GLA University Depot', status: 'pending', time: '23:35 ETA' },
      ]
    },
    {
      id: 'TRK-412',
      nodeId: 'node-01',
      name: 'PharmaCold Liner 412',
      driver: 'Amit Kumar',
      phone: '+91 91234 56789',
      manifest: 'Insulin Glargine Vials',
      temp: 4.2,
      targetRange: '2.0°C – 8.0°C',
      isBreached: false,
      speed: '58 km/h',
      battery: '88%',
      lat: 28.140,
      lng: 77.320,
      locationName: 'Faridabad Bypass Road',
      destination: 'Agra Medical Supply Center',
      eta: '1 hr 15 mins',
      progress: 42,
      routePoints: [
        { name: 'Okhla Cold Storage', status: 'completed', time: '20:10' },
        { name: 'Faridabad Bypass', status: 'active', time: '22:30' },
        { name: 'Mathura Junction', status: 'pending', time: '00:10 ETA' },
      ]
    },
    {
      id: 'TRK-105',
      nodeId: 'node-02',
      name: 'CryoTrans 105',
      driver: 'Ramesh Yadav',
      phone: '+91 97890 12345',
      manifest: 'Fresh Milk & Paneer Lots',
      temp: 3.8,
      targetRange: '1.0°C – 4.0°C',
      isBreached: false,
      speed: '0 km/h (Docked)',
      battery: '100% (Charging)',
      lat: 28.459,
      lng: 77.026,
      locationName: 'Sector 18 Hub, Gurugram',
      destination: 'Dispatched / Pre-cooling',
      eta: 'Departing in 20m',
      progress: 5,
      routePoints: [
        { name: 'Loading Bay 3', status: 'active', time: '22:45' },
        { name: 'Departure Scan', status: 'pending', time: '23:15' },
      ]
    }
  ];

  const current = fleet.find(f => f.id === selectedTruck) || fleet[0];

  const handleBuzzerClick = async (nodeId) => {
    setBuzzerTriggered(true);
    if (onTriggerBuzzer) {
      await onTriggerBuzzer(nodeId);
    } else {
      await fetch(`/api/devices/${nodeId}/buzzer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_s: 20, triggered_by: 'fleet_map' })
      });
    }
    setTimeout(() => setBuzzerTriggered(false), 20000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight flex items-center gap-2">
            <span>Fleet Geospatial Transit Tracker</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30">
              Live GPS Sync
            </span>
          </h2>
          <p className="text-xs text-[#A3A3A3] mt-1">
            Real-time GPS transit tracking, driver cabin intercom &amp; emergency hardware buzzer actuation.
          </p>
        </div>

        {/* Selected Vehicle Quick Selector */}
        <div className="flex items-center gap-2">
          {fleet.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTruck(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
                selectedTruck === t.id
                  ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-md'
                  : 'bg-[#1E1E1E] text-[#A3A3A3] border-[#333333] hover:text-[#F5F5F5]'
              }`}
            >
              <Truck size={14} />
              <span>{t.id}</span>
              {t.isBreached && <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />}
            </button>
          ))}
        </div>
      </div>

      {/* Main Map & Vehicle Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Tactical Dark Vector Map */}
        <div className="lg:col-span-2 bg-[#121212] border border-[#333333] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[460px] shadow-2xl">
          {/* Map Grid Background Pattern */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #333333 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* Map Top HUD */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-[#1E1E1E]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#333333] text-xs">
              <Compass size={14} className="text-[#16A34A] animate-spin" style={{ animationDuration: '8s' }} />
              <span className="font-mono text-[#F5F5F5]">{current.locationName}</span>
              <span className="text-[#737373]">({current.lat.toFixed(3)}°N, {current.lng.toFixed(3)}°E)</span>
            </div>

            <div className="flex items-center gap-2 bg-[#1E1E1E]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#333333] text-xs font-mono">
              <span className="text-[#A3A3A3]">Speed:</span>
              <span className="text-[#16A34A] font-bold">{current.speed}</span>
            </div>
          </div>

          {/* Graphical Transit Route Canvas */}
          <div className="relative z-10 my-8 py-4">
            {/* Vector Route Line */}
            <div className="relative w-full h-40 flex items-center justify-between px-8">
              {/* Route Path Background Line */}
              <div className="absolute left-10 right-10 h-1 bg-[#282828] top-1/2 -translate-y-1/2" />
              {/* Active Progress Line */}
              <div 
                className="absolute left-10 h-1 bg-gradient-to-r from-[#16A34A] via-[#10B981] to-[#EF4444] top-1/2 -translate-y-1/2 transition-all duration-700"
                style={{ width: `${current.progress}%` }}
              />

              {/* Waypoints */}
              {current.routePoints.map((pt, idx) => {
                const isPassed = pt.status === 'completed';
                const isActive = pt.status === 'active';
                return (
                  <div key={idx} className="relative z-10 flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      isActive 
                        ? 'bg-[#1E1E1E] border-[#EF4444] text-[#EF4444] ring-4 ring-[#EF4444]/20 scale-110' 
                        : isPassed 
                        ? 'bg-[#16A34A] border-[#16A34A] text-white' 
                        : 'bg-[#222222] border-[#444444] text-[#737373]'
                    }`}>
                      {isPassed ? <CheckCircle2 size={14} /> : idx + 1}
                    </div>
                    <span className="text-[11px] font-semibold text-[#F5F5F5] mt-2 whitespace-nowrap">{pt.name}</span>
                    <span className="text-[10px] text-[#A3A3A3] font-mono">{pt.time}</span>
                  </div>
                );
              })}

              {/* Moving Vehicle Marker on Line */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 z-20 cursor-pointer"
                style={{ left: `calc(40px + (100% - 80px) * ${current.progress / 100})` }}
              >
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 shadow-2xl ${
                  current.isBreached 
                    ? 'bg-[#EF4444] border-white text-white animate-bounce' 
                    : 'bg-[#16A34A] border-white text-white'
                }`}>
                  <Truck size={18} />
                  <span className="font-mono text-xs font-bold">{current.id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Map Bottom Status Bar */}
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-[#262626] text-xs">
            <div className="flex items-center gap-4 text-[#A3A3A3]">
              <div className="flex items-center gap-1.5">
                <Navigation size={14} className="text-[#16A34A]" />
                <span>Dest: <strong className="text-white">{current.destination}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-[#A3A3A3]" />
                <span>ETA: <strong className="text-[#16A34A]">{current.eta}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#737373] uppercase tracking-wider font-mono">Assigned Node:</span>
              <span className="font-mono text-xs font-bold text-white bg-[#222222] px-2 py-0.5 rounded border border-[#333333]">
                {current.nodeId}
              </span>
            </div>
          </div>
        </div>

        {/* Vehicle Telemetry & Emergency Cabin Controls */}
        <div className="space-y-4">
          {/* Live Telemetry Card */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">Cargo &amp; Telemetry</span>
                <h3 className="text-base font-bold text-white mt-0.5">{current.manifest}</h3>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold font-mono border ${
                current.isBreached 
                  ? 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30 animate-pulse' 
                  : 'bg-[#16A34A]/20 text-[#16A34A] border-[#16A34A]/30'
              }`}>
                {current.isBreached ? 'EXCURSION' : 'NORMAL'}
              </span>
            </div>

            {/* Temp Gauge Box */}
            <div className={`p-4 rounded-xl border text-center transition-all ${
              current.isBreached 
                ? 'bg-[#EF4444]/10 border-[#EF4444]/40' 
                : 'bg-[#16A34A]/10 border-[#16A34A]/40'
            }`}>
              <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest">Reefer Cabin Temp</span>
              <div className="text-3xl font-bold font-mono text-white mt-1">
                {current.temp.toFixed(2)}&deg;C
              </div>
              <span className="text-[11px] text-[#A3A3A3] mt-1 inline-block">
                Allowed Envelope: <strong className="text-[#F5F5F5]">{current.targetRange}</strong>
              </span>
            </div>

            {/* Driver Profile */}
            <div className="p-3 bg-[#242424] rounded-xl border border-[#333333] flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">Driver Contact</span>
                <p className="font-semibold text-white">{current.driver}</p>
                <p className="text-[#A3A3A3] font-mono text-[11px]">{current.phone}</p>
              </div>
              <a
                href={`tel:${current.phone}`}
                className="p-2.5 rounded-lg bg-[#333333] hover:bg-[#444444] text-[#16A34A] transition-colors"
                title="Call Driver"
              >
                <PhoneCall size={16} />
              </a>
            </div>

            {/* Emergency Hardware Buzzer Actuator Button */}
            <div className="space-y-2 pt-2 border-t border-[#2e2e2e]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#A3A3A3] uppercase tracking-wider">Cabin Audio Alarm</span>
                <span className={`font-mono text-[10px] font-bold ${buzzerTriggered ? 'text-[#EF4444]' : 'text-[#737373]'}`}>
                  {buzzerTriggered ? '● SOUNDING (20s)' : 'STANDBY'}
                </span>
              </div>

              <button
                onClick={() => handleBuzzerClick(current.nodeId)}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                  buzzerTriggered
                    ? 'bg-[#EF4444] hover:bg-[#dc2626] text-white animate-pulse shadow-[#EF4444]/30'
                    : 'bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/40'
                }`}
              >
                <Volume2 size={16} className={buzzerTriggered ? 'animate-bounce' : ''} />
                <span>{buzzerTriggered ? 'Alarm Active on Hardware (Buzzing)' : '🚨 Sound Driver Cabin Buzzer'}</span>
              </button>

              <p className="text-[10px] text-[#737373] text-center leading-relaxed">
                Sends instant hardware actuation command to GPIO 25 on ESP32 node to awaken driver in case of unattended excursion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
