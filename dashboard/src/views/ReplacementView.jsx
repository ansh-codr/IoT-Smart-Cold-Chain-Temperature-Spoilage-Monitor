import React, { useState, useEffect } from 'react';
import { Repeat, Plus, CheckCircle2, Clock, AlertTriangle, ArrowRight, Building2 } from 'lucide-react';

export function ReplacementView() {
  const [requests, setRequests] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(null); // active request object

  const [allocateData, setAllocateData] = useState({
    warehouse_id: '1',
    inventory_id: '',
    quantity: ''
  });

  const [formData, setFormData] = useState({
    profile_id: '2',
    required_quantity: '100',
    unit: 'vials',
    destination: 'Emergency Care Center North',
    required_by_hours: '24',
    priority: 'urgent',
    reason: 'Active shipment excursion detected on Route 4. Replacement needed immediately.'
  });

  const loadData = () => {
    Promise.all([
      fetch('/api/replacements').then(r => r.json()),
      fetch('/api/warehouses').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json())
    ]).then(([repData, whData, invData]) => {
      setRequests(repData.requests || []);
      setWarehouses(whData.warehouses || []);
      setInventory(invData.items || []);
      if (invData.items?.length && !allocateData.inventory_id) {
        setAllocateData(prev => ({ ...prev, inventory_id: invData.items[0].id }));
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

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const reqByTs = Math.floor(Date.now() / 1000) + Number(formData.required_by_hours) * 3600;
    try {
      const res = await fetch('/api/replacements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: Number(formData.profile_id),
          required_quantity: Number(formData.required_quantity),
          unit: formData.unit,
          destination: formData.destination,
          required_by_ts: reqByTs,
          priority: formData.priority,
          reason: formData.reason
        })
      });
      if (res.ok) {
        setShowModal(false);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/replacements/${showAllocateModal.id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: [{
            warehouse_id: Number(allocateData.warehouse_id),
            inventory_id: Number(allocateData.inventory_id),
            quantity: Number(allocateData.quantity)
          }]
        })
      });
      if (res.ok) {
        setShowAllocateModal(null);
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
          <h2 className="text-xl font-bold text-white tracking-tight">Replacement Planning &amp; Allocation</h2>
          <p className="text-xs text-zinc-400 mt-1">Automated triage and transactional inventory re-allocation for spoiled or breached shipments.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={15} />
          <span>New Replacement Request</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.map(r => (
          <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-800 text-sky-400 border border-zinc-700/60">
                  <Repeat size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">{r.request_code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      r.status === 'allocated' 
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}>
                      {r.status.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      {r.priority}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Product: <strong className="text-zinc-200 capitalize">{r.product_name}</strong> &bull; Destination: <strong className="text-zinc-200">{r.destination}</strong>
                  </p>
                </div>
              </div>

              {r.status === 'pending_approval' && (
                <button
                  onClick={() => {
                    setShowAllocateModal(r);
                    setAllocateData({ warehouse_id: '1', inventory_id: inventory[0]?.id || '', quantity: r.required_quantity });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Allocate Stock
                </button>
              )}
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/80 text-xs">
              <p className="text-zinc-400"><strong className="text-zinc-300">Reason:</strong> {r.reason}</p>
              <div className="mt-2 pt-2 border-t border-zinc-800/60 flex justify-between text-zinc-400">
                <span>Requested Quantity: <strong className="text-white">{r.required_quantity} {r.unit}</strong></span>
                <span>Required By: <strong className="text-white">{new Date(r.required_by_ts * 1000).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Allocations list if allocated */}
            {r.allocations?.length > 0 && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg text-xs space-y-1">
                <p className="font-semibold text-emerald-400 text-[11px] uppercase tracking-wider">Allocated Warehouse Stock</p>
                {r.allocations.map((a, i) => (
                  <div key={i} className="flex justify-between text-zinc-300">
                    <span>{a.warehouse_name} (Batch: {a.batch_number})</span>
                    <span className="font-semibold text-emerald-400">{a.allocated_quantity} units</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Allocate Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Fulfill Replacement {showAllocateModal.request_code}</h3>
            <p className="text-xs text-zinc-400 mb-4">Select warehouse batch to reserve and dispatch replacement cargo.</p>
            <form onSubmit={handleAllocateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Source Warehouse</label>
                <select
                  value={allocateData.warehouse_id}
                  onChange={e => setAllocateData({ ...allocateData, warehouse_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Available Batch Lot</label>
                <select
                  value={allocateData.inventory_id}
                  onChange={e => setAllocateData({ ...allocateData, inventory_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                >
                  {inventory
                    .filter(item => String(item.warehouse_id) === String(allocateData.warehouse_id))
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.batch_number} — Available: {item.quantity} {item.unit}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Quantity to Allocate</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={allocateData.quantity}
                  onChange={e => setAllocateData({ ...allocateData, quantity: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Initiate Replacement Request</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Required Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.required_quantity}
                    onChange={e => setFormData({ ...formData, required_quantity: e.target.value })}
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
                <label className="block text-zinc-400 font-semibold mb-1">Destination Facility</label>
                <input
                  type="text"
                  required
                  value={formData.destination}
                  onChange={e => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Reason / Incident Report</label>
                <textarea
                  required
                  rows={2}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

