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
  Building2,
  Navigation
} from 'lucide-react';

export function Sidebar({ activeTab, onSelectTab, userProfile, onLogout, collapsed, onToggleCollapse }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'node', label: 'IoT Node Console', icon: Cpu },
    { id: 'fleet', label: 'Fleet Transit Map', icon: Navigation },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'profiles', label: 'Product Profiles', icon: Layers },
    { id: 'shipments', label: 'Shipments', icon: Truck },
    { id: 'alerts', label: 'Risk & Alerts', icon: AlertTriangle },
    { id: 'replacement', label: 'Replacement Planner', icon: Repeat },
    { id: 'reports', label: 'Audit Reports (PDF)', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isAdmin = userProfile?.user?.system_role === 'admin' || userProfile?.active_organization?.role === 'platform_admin';

  return (
    <aside className={`forensics-sidebar border-r flex flex-col transition-all duration-300 z-40 ${collapsed ? 'w-16' : 'w-52'}`}>
      {/* Brand Header */}
      <div className="h-14 flex items-center px-3 border-b border-[#333333] gap-2.5">
        <div className="forensics-mark w-8 h-8 rounded-sm flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path fill="currentColor" d="M12 2 4 7v10l8 5 8-5V7zm0 3.1 4.8 3L12 11 7.2 8.1zm-5 5.3 4 2.5v4.2l-4-2.5zm6 6.7v-4.2l4-2.5v4.2z"/></svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-display font-bold text-base tracking-[.1em] text-[var(--bone)] leading-tight">ColdChain IQ</h1>
            <p className="text-[9px] text-[var(--muted)] font-medium tracking-[.16em]">THERMAL FORENSICS</p>
          </div>
        )}
      </div>

      {/* Organization Badge */}
      {!collapsed && userProfile?.active_organization && (
        <div className="px-3 py-2 mx-2 my-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] flex items-center gap-2">
          <Building2 size={14} className="text-[#16A34A] shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[11px] font-semibold text-[#F5F5F5] truncate">{userProfile.active_organization.org_name}</p>
            <p className="text-[9px] uppercase tracking-wider font-bold text-[#16A34A]">{userProfile.active_organization.role?.replace('_', ' ')}</p>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <div className="text-[9px] uppercase font-bold text-[#A3A3A3] px-2.5 pb-1 tracking-wider">
          {!collapsed ? 'Management' : '•••'}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive 
                  ? 'bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/30 shadow-sm' 
                  : 'text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#1E1E1E]'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} className={isActive ? 'text-[#16A34A]' : 'text-[#A3A3A3]'} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Administration Section */}
        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-[#333333]">
            <div className="text-[9px] uppercase font-bold text-[#A3A3A3] px-2.5 pb-1 tracking-wider">
              {!collapsed ? 'System' : '•••'}
            </div>
            <button
              onClick={() => onSelectTab('admin')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-[#A31C18]/15 text-[#A31C18] border border-[#A31C18]/30'
                  : 'text-[#A3A3A3] hover:text-[#A31C18] hover:bg-[#1E1E1E]'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? 'Admin Panel' : undefined}
            >
              <ShieldAlert size={16} className={activeTab === 'admin' ? 'text-[#A31C18]' : 'text-[#A3A3A3]'} />
              {!collapsed && <span>Admin Panel</span>}
            </button>
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-2.5 border-t border-[#333333] flex items-center justify-between gap-2">
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-[11px] font-semibold text-[#F5F5F5] truncate">{userProfile?.user?.display_name || userProfile?.user?.email || 'Logged In'}</p>
            <p className="text-[9px] text-[#A3A3A3] truncate">{userProfile?.user?.email}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#A31C18] hover:bg-[#1E1E1E] transition-colors"
          title="Sign Out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}

