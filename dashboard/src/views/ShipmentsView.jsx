import React, { useState, useEffect } from 'react';
import { Truck, Plus, CheckCircle2, Clock, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export function ShipmentsView() {
  const [shipments, setShipments] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    shipment_code: `SHP-${Date.now().toString().slice(-6)}`,
    source_warehouse_id: '1',
    destination_name: 'Metro Distribution Hub 5',
    destination_address: 'Sector 18, Gurugram, HR',
    assigned_device_id: 'node-01',
    profile_id: '2', // Pharma default
    quantity: '250',
    unit: 'vials'
  });

  const loadData = () => {
    Promise.all([
      fetch('/api/shipments').then(r => r.json()),
      fetch('/api/warehouses').then(r => r.json())
    ]).then(([shipData, whData]) => {
      setShipments(shipData.shipments || []);
      setWarehouses(whData.warehouses || []);
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
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_code: formData.shipment_code,
          source_warehouse_id: Number(formData.source_warehouse_id),
          destination_name: formData.destination_name,
          destination_address: formData.destination_address,
          assigned_device_id: formData.assigned_device_id,
          items: [{
            profile_id: Number(formData.profile_id),
            quantity: Number(formData.quantity),
            unit: formData.unit
          }]
        })
      });
      if (res.ok) {
        setShowCreateModal(false);
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
          <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight">Active Cold-Chain Shipments</h2>
          <p className="text-xs text-[#A3A3A3] mt-1">Real-time dispatched cargo paired with active ESP32 IoT telemetry tracking.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={15} />
          <span>Dispatch Shipment</span>
        </button>
      </div>

      {/* Shipments List */}
      <div className="space-y-4">
        {shipments.map(s => {
          const isAtRisk = s.risk_level === 'high' || s.risk_level === 'critical';
          return (
            <div key={s.id} className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#242424] text-[#16A34A] border border-[#333333]">
                    <Truck size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#F5F5F5]">{s.shipment_code}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/30">
                        {s.status.replace('_', ' ')}
                      </span>
                      {s.assigned_device_id && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#64748B]/15 text-[#64748B] border border-[#64748B]/30">
                          IoT: {s.assigned_device_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#A3A3A3] mt-0.5">
                      Origin: <strong className="text-[#F5F5F5]">{s.source_warehouse_name}</strong> &rarr; Destination: <strong className="text-[#F5F5F5]">{s.destination_name}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    isAtRisk 
                      ? 'bg-[#A31C18]/15 text-[#A31C18] border-[#A31C18]/30' 
                      : 'bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/30'
                  }`}>
                    {isAtRisk ? 'High Excursion Risk' : 'Thermal Envelope Normal'}
                  </span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="p-3 bg-[#242424] rounded-lg border border-[#333333] text-xs">
                <p className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mb-2">Manifest Cargo</p>
                <div className="space-y-1.5">
                  {s.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[#F5F5F5]">
                      <span className="font-medium text-[#F5F5F5]">{item.product_name} &bull; Safe Range: {item.t_min_c}&deg;C – {item.t_max_c}&deg;C</span>
                      <span className="font-semibold text-[#16A34A] font-mono">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F5F5] mb-4">Create &amp; Dispatch Shipment</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Shipment Code</label>
                <input
                  type="text"
                  required
                  value={formData.shipment_code}
                  onChange={e => setFormData({ ...formData, shipment_code: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] font-mono focus:outline-none focus:border-[#16A34A]"
                />
              </div>
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Source Warehouse</label>
                <select
                  value={formData.source_warehouse_id}
                  onChange={e => setFormData({ ...formData, source_warehouse_id: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Destination Facility</label>
                <input
                  type="text"
                  required
                  value={formData.destination_name}
                  onChange={e => setFormData({ ...formData, destination_name: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A3A3A3] font-semibold mb-1">Assigned IoT Node</label>
                  <input
                    type="text"
                    required
                    value={formData.assigned_device_id}
                    onChange={e => setFormData({ ...formData, assigned_device_id: e.target.value })}
                    className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] font-mono focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A3A3A3] font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
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
              <div className="flex justify-end gap-2 pt-3 border-t border-[#333333]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#A3A3A3] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold transition-colors"
                >
                  Authorize Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

