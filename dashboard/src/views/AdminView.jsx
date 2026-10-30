import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, Building2, Activity, UserCheck, UserX } from 'lucide-react';

export function AdminView() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/overview').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json())
    ]).then(([ovData, userData]) => {
      setData(ovData.platform);
      setUsers(userData.users || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-8 text-[#A3A3A3]">Loading system administration telemetry...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight flex items-center gap-2">
            <ShieldAlert size={22} className="text-[#A31C18]" />
            <span>Platform Administration &amp; Governance</span>
          </h2>
          <p className="text-xs text-[#A3A3A3] mt-1">Multi-tenant isolation, user accounts, and immutable audit logs.</p>
        </div>
      </div>

      {/* Platform Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#333333]">
          <p className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider">Organizations</p>
          <p className="text-2xl font-extrabold text-[#F5F5F5] font-mono mt-1">{data?.total_organizations ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#333333]">
          <p className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider">Provisioned Users</p>
          <p className="text-2xl font-extrabold text-[#F5F5F5] font-mono mt-1">{data?.total_users ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#333333]">
          <p className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider">Registered IoT Nodes</p>
          <p className="text-2xl font-extrabold text-[#F5F5F5] font-mono mt-1">{data?.total_devices ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#333333]">
          <p className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider">Total Shipments Run</p>
          <p className="text-2xl font-extrabold text-[#F5F5F5] font-mono mt-1">{data?.total_shipments ?? 0}</p>
        </div>
      </div>

      {/* Users Management */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-[#333333]">
          <h3 className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest">Platform User Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#242424] text-[#A3A3A3] border-b border-[#333333] font-semibold">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">System Role</th>
                <th className="px-4 py-3">Tenant Memberships</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333333] text-[#F5F5F5]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-[#242424]/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#F5F5F5]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#A31C18]/15 text-[#A31C18] border border-[#A31C18]/30">
                      {u.system_role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#A3A3A3]">{u.organizations_list || 'Global Platform'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/30">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#A3A3A3] font-mono">{new Date(u.created_at * 1000).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

