import React, { useState, useEffect } from 'react';
import { Boxes, Plus, Warehouse, Calendar, Clock, AlertCircle } from 'lucide-react';

export function InventoryView() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouse_id: '',
    profile_id: '1',
    batch_number: '',
    quantity: '',
    unit: 'vials',
    expiry_days: '30'
  });

  const loadData = () => {
    Promise.all([
      fetch('/api/inventory').then(r => r.json()),
      fetch('/api/warehouses').then(r => r.json())
    ]).then(([invData, whData]) => {
      setItems(invData.items || []);
      setWarehouses(whData.warehouses || []);
      if (whData.warehouses?.length && !formData.warehouse_id) {
        setFormData(prev => ({ ...prev, warehouse_id: whData.warehouses[0].id }));
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const expiryTimestamp = Math.floor(Date.now() / 1000) + Number(formData.expiry_days) * 86400;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_id: Number(formData.warehouse_id),
          profile_id: Number(formData.profile_id),
          batch_number: formData.batch_number,
          quantity: Number(formData.quantity),
          unit: formData.unit,
          mfg_date: Math.floor(Date.now() / 1000),
          expiry_date: expiryTimestamp
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Cold-Chain Inventory & Batches</h2>
          <p className="text-xs text-zinc-400 mt-1">Multi-warehouse stock tracking linked to Arrhenius product decay profiles.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={15} />
          <span>Receive Batch</span>
        </button>
      </div>

      {/* Warehouse Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(w => (
          <div key={w.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-zinc-800 text-emerald-400">
              <Warehouse size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{w.name}</p>
              <p className="text-xs text-zinc-400">{w.location} &bull; Target: {w.target_temp_c}&deg;C</p>
              <p className="text-[11px] font-medium text-emerald-400 mt-1">{w.total_stock} {w.total_batches} batches stored</p>
            </div>
          </div>
        ))}
      </div>

      {/* Inventory Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Active Inventory Batches</h3>
          <span className="text-xs text-zinc-500 font-semibold">{items.length} Batches Monitored</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Batch Number</th>
                <th className="px-4 py-3">Product Type</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Safe Window</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-white">{item.batch_number}</td>
                  <td className="px-4 py-3 font-medium capitalize text-emerald-400">{item.product_name}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.warehouse_name}</td>
                  <td className="px-4 py-3 font-semibold text-white">{Number(item.quantity).toLocaleString()} <span className="text-zinc-500 font-normal">{item.unit}</span></td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{item.t_min_c}&deg;C – {item.t_max_c}&deg;C</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {item.expiry_date ? new Date(item.expiry_date * 1000).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Receive New Batch</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Target Warehouse</label>
                <select
                  value={formData.warehouse_id}
                  onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                  required
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Product Profile</label>
                <select
                  value={formData.profile_id}
                  onChange={e => setFormData({ ...formData, profile_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                >
                  <option value="1">Dairy (2°C – 6°C)</option>
                  <option value="2">Pharma (2°C – 8°C)</option>
                  <option value="3">Produce (1°C – 8°C)</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Batch Code / Lot ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LOT-2026-X99"
                  value={formData.batch_number}
                  onChange={e => setFormData({ ...formData, batch_number: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="1000"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Days Until Expiry</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.expiry_days}
                  onChange={e => setFormData({ ...formData, expiry_days: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Confirm Receive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

