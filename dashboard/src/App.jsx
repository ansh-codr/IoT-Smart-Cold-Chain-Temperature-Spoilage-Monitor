/**
 * App.jsx — ColdChain IQ Enterprise Platform
 *
 * Stack: React 19 + Vite + Tailwind CSS v4 + Recharts + Lucide React + Firebase Auth
 * Backend: Express + MySQL at http://localhost:5000 (proxied via Vite)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Package,
  Menu,
  Download
} from 'lucide-react';

import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { OverviewView } from './views/OverviewView.jsx';
import { InventoryView } from './views/InventoryView.jsx';
import { ShipmentsView } from './views/ShipmentsView.jsx';
import { ReplacementView } from './views/ReplacementView.jsx';
import { AdminView } from './views/AdminView.jsx';
import { ProfilesView } from './views/ProfilesView.jsx';
import { ReportsView } from './views/ReportsView.jsx';
import { FleetMapView } from './views/FleetMapView.jsx';

import { useDeviceStream } from './hooks/useDeviceStream.js';
import { MetricCard } from './components/MetricCard.jsx';
import { ShelfLifeGauge } from './components/ShelfLifeGauge.jsx';
import { TrendChart } from './components/TrendChart.jsx';
import { AlertBanner } from './components/AlertBanner.jsx';
import { AlertTable } from './components/AlertTable.jsx';
import { DualModalSpoilageWidget } from './components/DualModalSpoilageWidget.jsx';
import { Volume2 } from 'lucide-react';

import {
  tempColor, tempBadge,
  vocColor, vocBadge,
  shelfLifeColor,
  fmtTs,
} from './utils/helpers.js';

const DEVICE_STORAGE_KEY = 'coldchain_device_id';
const DEFAULT_DEVICE = 'node-03';
const API_BASE = '/api';

function DashboardContent() {
  const { userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Device selection
  const [deviceId, setDeviceId] = useState(() => {
    const saved = localStorage.getItem(DEVICE_STORAGE_KEY);
    return (saved && saved !== 'node-01') ? saved : DEFAULT_DEVICE;
  });
  const [deviceInput, setDeviceInput] = useState(deviceId);
  const [profileChanging, setProfileChanging] = useState(false);
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [buzzerLoading, setBuzzerLoading] = useState(false);
  const buzzerTimerRef = React.useRef(null);

  const handleToggleBuzzer = useCallback(async (devId = deviceId) => {
    setBuzzerLoading(true);
    try {
      if (buzzerActive) {
        // Immediate stop request
        if (buzzerTimerRef.current) clearTimeout(buzzerTimerRef.current);
        await fetch(`/api/devices/${devId}/buzzer`, {
          method: 'DELETE'
        });
        setBuzzerActive(false);
      } else {
        // Start 30-second continuous alarm
        await fetch(`/api/devices/${devId}/buzzer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration_s: 30, action: 'start', triggered_by: 'dashboard' })
        });
        setBuzzerActive(true);

        if (buzzerTimerRef.current) clearTimeout(buzzerTimerRef.current);
        buzzerTimerRef.current = setTimeout(() => {
          setBuzzerActive(false);
        }, 30000); // Auto-stops after 30 seconds
      }
    } catch (e) {
      console.error('Buzzer toggle failed:', e);
    } finally {
      setBuzzerLoading(false);
    }
  }, [deviceId, buzzerActive]);

  const {
    readings,
    status,
    alerts,
    activeAlert,
    connState,
    profiles,
    refetchAlerts,
  } = useDeviceStream(deviceId);

  useEffect(() => {
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }, [deviceId]);

  const handleProfileChange = useCallback(async (profileId) => {
    if (!profileId || !deviceId) return;
    setProfileChanging(true);
    try {
      await fetch(`${API_BASE}/devices/${deviceId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: Number(profileId) }),
      });
    } catch (e) {
      console.error('Profile change failed:', e);
    } finally {
      setProfileChanging(false);
    }
  }, [deviceId]);

  const applyDevice = () => {
    const trimmed = deviceInput.trim();
    if (trimmed) setDeviceId(trimmed);
  };

  const latest = readings[readings.length - 1] ?? status?.latest_reading ?? null;
  const profile = status?.product_profile ?? null;
  const shelfLife = status?.shelf_life ?? null;
  const online = status?.online ?? false;
  const buffered = status?.buffered_recovered_count ?? 0;

  const tColor = tempColor(latest?.temp_c, profile);
  const vColor = vocColor(latest?.voc_raw, profile);
  const sColor = shelfLifeColor(shelfLife?.remaining_life_percent);

  // Render subviews
  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewView
            onNavigate={setActiveTab}
            liveReadings={readings}
            activeDeviceId={deviceId}
            activeStatus={status}
            onSelectDevice={id => {
              setDeviceId(id);
              setDeviceInput(id);
            }}
          />
        );
      case 'inventory':
        return <InventoryView />;
      case 'shipments':
        return <ShipmentsView />;
      case 'replacement':
        return <ReplacementView />;
      case 'profiles':
        return <ProfilesView profiles={profiles} />;
      case 'admin':
        return <AdminView />;
      case 'alerts':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight">Active Excursions &amp; Risk Register</h2>
              <p className="text-xs text-[#A3A3A3] mt-1">Stateful monitoring of thermal limits, VOC spoilage indicators, and offline alarms.</p>
            </div>
            {activeAlert && <AlertBanner alert={activeAlert} startedAt={activeAlert.started_at} />}
            <AlertTable alerts={alerts} />
          </div>
        );
      case 'fleet':
        return (
          <FleetMapView 
            activeDeviceId={deviceId} 
            liveTemp={latest?.temp_c != null ? Number(latest.temp_c) : 26.1} 
            onTriggerBuzzer={handleToggleBuzzer}
            buzzerActive={buzzerActive}
          />
        );
      case 'reports':
        return <ReportsView activeDeviceId={deviceId} />;
      case 'settings':
        return (
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-6 space-y-4 max-w-xl">
            <h3 className="text-base font-bold text-[#F5F5F5]">Organization &amp; Node Settings</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Active Organization</label>
                <input
                  type="text"
                  disabled
                  value={userProfile?.active_organization?.org_name || 'Apex Pharma & Cold Logistics'}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5]"
                />
              </div>
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Kinetics Model</label>
                <input
                  type="text"
                  disabled
                  value="Arrhenius Physical Kinetics (Ea / R · T)"
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5]"
                />
              </div>
            </div>
          </div>
        );
      case 'node':
      case 'iot':
      default:
        return (
          <div className="space-y-6">
            {activeAlert && (
              <AlertBanner alert={activeAlert} startedAt={activeAlert.started_at} />
            )}

            {connState === 'reconnecting' && !status && (
              <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-5 py-4 text-zinc-400 text-sm flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-amber-400" />
                Waiting for backend at <code className="text-amber-300 bg-zinc-900/60 px-1.5 py-0.5 rounded text-xs">localhost:5000</code>…
              </div>
            )}

            {/* Metric Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                type="temp"
                label="Temperature"
                value={latest?.temp_c != null ? Number(latest.temp_c).toFixed(2) : null}
                unit="°C"
                badge={tempBadge(tColor)}
                badgeColor={tColor}
                subLabel={
                  profile
                    ? `Safe: ${profile.t_min_c}°C – ${profile.t_max_c}°C · Updated ${latest?.ts ? fmtTs(latest.ts) : '—'}`
                    : 'No profile assigned'
                }
              />

              <MetricCard
                type="humidity"
                label="Humidity"
                value={latest?.humidity != null ? Number(latest.humidity).toFixed(1) : null}
                unit="% RH"
                badge="DHT22"
                badgeColor="blue"
                subLabel={latest?.ts ? `Updated ${fmtTs(latest.ts)}` : 'No data yet'}
              />

              <MetricCard
                type="voc"
                label="VOC (indicative)"
                value={latest?.voc_raw != null ? latest.voc_raw : null}
                unit="ADC"
                badge={vocBadge(vColor)}
                badgeColor={vColor}
                subLabel={
                  profile
                    ? `Baseline: ${profile.voc_baseline} · Spoilage threshold: ${Number(profile.voc_baseline) + Number(profile.voc_spoil_delta)}`
                    : 'MQ-135 raw 12-bit reading'
                }
              />

              <MetricCard
                type="shelf"
                label="Remaining Shelf Life"
                value={shelfLife?.remaining_life_percent != null
                  ? `${Number(shelfLife.remaining_life_percent).toFixed(1)}`
                  : null}
                unit="%"
                badge={
                  shelfLife?.remaining_life_percent != null
                    ? `${Number(shelfLife.remaining_life_hours).toFixed(1)} hrs left`
                    : 'No profile'
                }
                badgeColor={sColor}
                subLabel={
                  shelfLife?.rate_factor != null
                    ? shelfLife.rate_factor >= 1.05 || shelfLife.rate_factor <= 0.95
                      ? `Ageing ${Number(shelfLife.rate_factor).toFixed(2)}× ${shelfLife.rate_factor > 1 ? 'faster' : 'slower'}`
                      : 'Ageing at ideal rate (1.0×)'
                    : null
                }
              />
            </section>

            {/* Dual-Modal Spoilage Risk Index Analyzer */}
            <section>
              <DualModalSpoilageWidget
                spoilageRisk={status?.spoilage_risk}
                latestReading={latest}
                profile={profile}
                rateFactor={shelfLife?.rate_factor ?? 1.0}
              />
            </section>

            {/* Gauge + Chart Row */}
            <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-1">
                <ShelfLifeGauge
                  percent={shelfLife?.remaining_life_percent ?? 0}
                  remainingHours={shelfLife?.remaining_life_hours ?? null}
                  rateFactor={shelfLife?.rate_factor ?? null}
                />
              </div>
              <div className="lg:col-span-3">
                <TrendChart readings={readings} profile={profile} />
              </div>
            </section>

            {/* Alert History */}
            <section>
              <AlertTable alerts={alerts} />
            </section>
          </div>
        );
    }
  };

  return (
    <div className="forensics-shell flex h-screen overflow-hidden">
      {/* Platform Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        userProfile={userProfile}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="forensics-topbar h-16 border-b px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#242424] transition-colors"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-sm font-bold text-[#F5F5F5] capitalize hidden sm:block">
              {activeTab === 'iot' ? 'IoT Sensor Node Monitor' : activeTab.replace('-', ' ')}
            </h2>
          </div>

          {/* Right Header Status Bar */}
          <div className="flex items-center gap-3">
            {/* Device selector */}
            <div className="flex items-center gap-2">
              <input
                className="bg-[#242424] border border-[#333333] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F5F5] w-28 focus:outline-none focus:border-[#16A34A] font-mono"
                value={deviceInput}
                onChange={e => setDeviceInput(e.target.value)}
                onBlur={applyDevice}
                onKeyDown={e => e.key === 'Enter' && applyDevice()}
                placeholder="node-03"
              />
              <button
                onClick={applyDevice}
                className="p-1.5 rounded-lg bg-[#242424] hover:bg-[#333333] border border-[#333333] text-[#A3A3A3] hover:text-[#F5F5F5] transition-colors"
                title="Connect Node"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {/* Emergency Hardware Cabin Buzzer Actuator Toggle */}
            <button
              onClick={() => handleToggleBuzzer(deviceId)}
              disabled={buzzerLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border shadow-sm cursor-pointer ${
                buzzerActive
                  ? 'bg-[#EF4444] text-white border-white animate-pulse shadow-[#EF4444]/40 hover:bg-[#dc2626]'
                  : 'bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border-[#EF4444]/40'
              }`}
              title={buzzerActive ? "Click to immediately STOP hardware cabin buzzer" : "Click to sound continuous 30-second emergency buzzer"}
            >
              <Volume2 size={13} className={buzzerActive ? 'animate-bounce' : ''} />
              <span>{buzzerActive ? '🔕 Stop Cabin Alarm' : '🚨 Sound Buzzer'}</span>
            </button>

            {/* Profile Dropdown */}
            <div className="hidden md:flex items-center gap-1.5">
              <select
                className="bg-[#242424] border border-[#333333] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#16A34A] font-medium"
                value={profile?.id ?? ''}
                onChange={e => handleProfileChange(e.target.value)}
                disabled={profileChanging || profiles.length === 0}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name.charAt(0).toUpperCase() + p.name.slice(1)} ({p.t_min_c}°C–{p.t_max_c}°C)
                  </option>
                ))}
              </select>
            </div>

            {/* Online Status Pill */}
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              online
                ? 'bg-[#16A34A]/15 border-[#16A34A]/40 text-[#16A34A]'
                : 'bg-[#242424] border-[#333333] text-[#A3A3A3]'
            }`}>
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="text-[11px] font-bold">{online ? 'Online' : 'Offline'}</span>
            </div>

            {/* SSE Pulse Indicator */}
            <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${
              connState === 'live'
                ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30'
                : 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
            }`}>
              {connState === 'live' ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />Live SSE</>
              ) : (
                <><Loader2 size={10} className="animate-spin text-[#D97706]" />Sync</>
              )}
            </div>

            {buffered > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D97706]/15 text-[#D97706] border border-[#D97706]/30 hidden lg:inline-block">
                📦 {buffered} recovered
              </span>
            )}
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
