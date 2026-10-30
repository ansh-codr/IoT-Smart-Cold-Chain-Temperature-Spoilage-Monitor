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
          <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight">Replacement Planning &amp; Allocation</h2>
          <p className="text-xs text-[#A3A3A3] mt-1">Automated triage and transactional inventory re-allocation for spoiled or breached shipments.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={15} />
          <span>New Replacement Request</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.map(r => (
          <div key={r.id} className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#242424] text-[#64748B] border border-[#333333]">
                  <Repeat size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#F5F5F5]">{r.request_code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      r.status === 'allocated' 
                        ? 'bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/30' 
                        : 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/30'
                    }`}>
                      {r.status.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#A31C18]/15 text-[#A31C18] border border-[#A31C18]/30">
                      {r.priority}
                    </span>
                  </div>
                  <p className="text-xs text-[#A3A3A3] mt-0.5">
                    Product: <strong className="text-[#F5F5F5] capitalize">{r.product_name}</strong> &bull; Destination: <strong className="text-[#F5F5F5]">{r.destination}</strong>
                  </p>
                </div>
              </div>

              {r.status === 'pending_approval' && (
                <button
                  onClick={() => {
                    setShowAllocateModal(r);
                    setAllocateData({ warehouse_id: '1', inventory_id: inventory[0]?.id || '', quantity: r.required_quantity });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white text-xs font-semibold transition-colors"
                >
                  Allocate Stock
                </button>
              )}
            </div>

            <div className="p-3 bg-[#242424] rounded-lg border border-[#333333] text-xs">
              <p className="text-[#A3A3A3]"><strong className="text-[#F5F5F5]">Reason:</strong> {r.reason}</p>
              <div className="mt-2 pt-2 border-t border-[#333333] flex justify-between text-[#A3A3A3]">
                <span>Requested Quantity: <strong className="text-[#F5F5F5]">{r.required_quantity} {r.unit}</strong></span>
                <span>Required By: <strong className="text-[#F5F5F5]">{new Date(r.required_by_ts * 1000).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Allocations list if allocated */}
            {r.allocations?.length > 0 && (
              <div className="p-3 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-lg text-xs space-y-1">
                <p className="font-semibold text-[#16A34A] text-[11px] uppercase tracking-wider">Allocated Warehouse Stock</p>
                {r.allocations.map((a, i) => (
                  <div key={i} className="flex justify-between text-[#F5F5F5]">
                    <span>{a.warehouse_name} (Batch: {a.batch_number})</span>
                    <span className="font-semibold text-[#16A34A] font-mono">{a.allocated_quantity} units</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Allocate Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F5F5] mb-2">Fulfill Replacement {showAllocateModal.request_code}</h3>
            <p className="text-xs text-[#A3A3A3] mb-4">Select warehouse batch to reserve and dispatch replacement cargo.</p>
            <form onSubmit={handleAllocateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Source Warehouse</label>
                <select
                  value={allocateData.warehouse_id}
                  onChange={e => setAllocateData({ ...allocateData, warehouse_id: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Available Batch Lot</label>
                <select
                  value={allocateData.inventory_id}
                  onChange={e => setAllocateData({ ...allocateData, inventory_id: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
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
                <label className="block text-[#A3A3A3] font-semibold mb-1">Quantity to Allocate</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={allocateData.quantity}
                  onChange={e => setAllocateData({ ...allocateData, quantity: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] font-mono focus:outline-none focus:border-[#16A34A]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#333333]">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(null)}
                  className="px-4 py-2 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#A3A3A3] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F5F5] mb-4">Initiate Replacement Request</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Product Profile</label>
                <select
                  value={formData.profile_id}
                  onChange={e => setFormData({ ...formData, profile_id: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="1">Dairy (2°C – 6°C)</option>
                  <option value="2">Pharma (2°C – 8°C)</option>
                  <option value="3">Produce (1°C – 8°C)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A3A3A3] font-semibold mb-1">Required Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.required_quantity}
                    onChange={e => setFormData({ ...formData, required_quantity: e.target.value })}
                    className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] font-mono focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
                <div>
                  <label className="block text-[#A3A3A3] font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Destination Facility</label>
                <input
                  type="text"
                  required
                  value={formData.destination}
                  onChange={e => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                />
              </div>
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Reason / Incident Report</label>
                <textarea
                  required
                  rows={2}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#333333]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#A3A3A3] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold transition-colors"
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

