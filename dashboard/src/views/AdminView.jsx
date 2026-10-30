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
    return <div className="p-8 text-zinc-400">Loading system administration telemetry...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert size={22} className="text-rose-400" />
            <span>Platform Administration &amp; Governance</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Multi-tenant isolation, user accounts, and immutable audit logs.</p>
        </div>
      </div>

      {/* Platform Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Organizations</p>
          <p className="text-2xl font-extrabold text-white mt-1">{data?.total_organizations ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Provisioned Users</p>
          <p className="text-2xl font-extrabold text-white mt-1">{data?.total_users ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Registered IoT Nodes</p>
          <p className="text-2xl font-extrabold text-white mt-1">{data?.total_devices ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Shipments Run</p>
          <p className="text-2xl font-extrabold text-white mt-1">{data?.total_shipments ?? 0}</p>
        </div>
      </div>

      {/* Users Management */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Platform User Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">System Role</th>
                <th className="px-4 py-3">Tenant Memberships</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      {u.system_role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{u.organizations_list || 'Global Platform'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{new Date(u.created_at * 1000).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

