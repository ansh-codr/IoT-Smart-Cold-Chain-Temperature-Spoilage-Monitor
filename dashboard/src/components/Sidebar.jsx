import React from 'react';
import { 
  LayoutDashboard, 
  Boxes, 
  Layers, 
  Truck, 
  Cpu, 
  AlertTriangle, 
  Repeat, 
  FileText, 
  Settings, 
  ShieldAlert,
  ChevronRight,
  LogOut,
  Building2
} from 'lucide-react';

export function Sidebar({ activeTab, onSelectTab, userProfile, onLogout, collapsed, onToggleCollapse }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'profiles', label: 'Product Profiles', icon: Layers },
    { id: 'shipments', label: 'Shipments', icon: Truck },
    { id: 'iot', label: 'IoT Monitoring', icon: Cpu },
    { id: 'alerts', label: 'Risk & Alerts', icon: AlertTriangle },
    { id: 'replacement', label: 'Replacement Planner', icon: Repeat },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isAdmin = userProfile?.user?.system_role === 'admin' || userProfile?.active_organization?.role === 'platform_admin';

  return (
    <aside className={`bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 z-40 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-zinc-800 gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <span className="text-xl">❄️</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-base tracking-tight text-white leading-tight">ColdChain IQ</h1>
            <p className="text-[10px] text-zinc-400 font-medium tracking-wide">Monitor. Predict. Protect.</p>
          </div>
        )}
      </div>

      {/* Organization Badge */}
      {!collapsed && userProfile?.active_organization && (
        <div className="px-4 py-3 mx-3 my-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center gap-2">
          <Building2 size={15} className="text-emerald-400 shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[11px] font-semibold text-zinc-200 truncate">{userProfile.active_organization.org_name}</p>
            <p className="text-[9px] uppercase tracking-wider font-bold text-emerald-400">{userProfile.active_organization.role?.replace('_', ' ')}</p>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold text-zinc-500 px-3 pb-2 tracking-wider">
          {!collapsed ? 'Management' : '•••'}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive 
                  ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-zinc-400'} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Administration Section */}
        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-zinc-800/80">
            <div className="text-[10px] uppercase font-bold text-zinc-500 px-3 pb-2 tracking-wider">
              {!collapsed ? 'System' : '•••'}
            </div>
            <button
              onClick={() => onSelectTab('admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'text-zinc-400 hover:text-rose-200 hover:bg-zinc-800/60'
              }`}
              title={collapsed ? 'Admin Panel' : undefined}
            >
              <ShieldAlert size={18} className={activeTab === 'admin' ? 'text-rose-400' : 'text-zinc-400'} />
              {!collapsed && <span>Admin Panel</span>}
            </button>
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-zinc-800 flex items-center justify-between gap-2">
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-zinc-200 truncate">{userProfile?.user?.display_name || userProfile?.user?.email || 'Logged In'}</p>
            <p className="text-[10px] text-zinc-500 truncate">{userProfile?.user?.email}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

