import React, { useState, useEffect, useMemo } from 'react';
import { 
  Boxes, 
  Plus, 
  Warehouse, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  RefreshCw,
  X,
  Layers,
  ThermometerSnowflake,
  ShieldAlert
} from 'lucide-react';

export function InventoryView() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState({
    warehouse_id: '',
    profile_id: '',
    batch_number: '',
    quantity: '',
    unit: 'vials',
    expiry_days: '30'
  });

  const loadData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [invRes, whRes, profRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/warehouses'),
        fetch('/api/profiles')
      ]);

      if (!invRes.ok) throw new Error(`Failed to load inventory (${invRes.status})`);
      if (!whRes.ok) throw new Error(`Failed to load warehouses (${whRes.status})`);
      if (!profRes.ok) throw new Error(`Failed to load profiles (${profRes.status})`);

      const [invData, whData, profData] = await Promise.all([
        invRes.json(),
        whRes.json(),
        profRes.json()
      ]);

      setItems(invData.items || []);
      setWarehouses(whData.warehouses || []);
      setProfiles(profData.profiles || []);

      // Auto-populate form initial defaults if not yet chosen
      setFormData(prev => ({
        ...prev,
        warehouse_id: prev.warehouse_id || (whData.warehouses?.[0]?.id ? String(whData.warehouses[0].id) : ''),
        profile_id: prev.profile_id || (profData.profiles?.[0]?.id ? String(profData.profiles[0].id) : '1')
      }));
    } catch (err) {
      console.error('Error fetching inventory state:', err);
      setError(err.message || 'Failed to communicate with inventory service');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    // Validation
    if (!formData.warehouse_id) {
      setFormError('Please select a storage warehouse.');
      setSubmitting(false);
      return;
    }
    if (!formData.profile_id) {
      setFormError('Please select a valid product decay profile.');
      setSubmitting(false);
      return;
    }
    if (!formData.batch_number.trim()) {
      setFormError('Batch / Lot number cannot be empty.');
      setSubmitting(false);
      return;
    }
    const qty = Number(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Quantity must be a positive number.');
      setSubmitting(false);
      return;
    }

    const expiryTimestamp = Math.floor(Date.now() / 1000) + Number(formData.expiry_days) * 86400;

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_id: Number(formData.warehouse_id),
          profile_id: Number(formData.profile_id),
          batch_number: formData.batch_number.trim(),
          quantity: qty,
          unit: formData.unit.trim() || 'units',
          mfg_date: Math.floor(Date.now() / 1000),
          expiry_date: expiryTimestamp
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Server rejected batch creation');
      }

      // Success
      setShowAddModal(false);
      setSuccessToast(`Batch ${formData.batch_number.trim()} registered successfully with ${qty} ${formData.unit}.`);
      setTimeout(() => setSuccessToast(null), 5000);

      // Reset batch number and load fresh data
      setFormData(prev => ({ ...prev, batch_number: '', quantity: '' }));
      await loadData();
    } catch (err) {
      console.error('Receive batch submission failed:', err);
      setFormError(err.message || 'Failed to submit batch. Verify permissions or duplicate lot numbers.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered & searched items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        (item.batch_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.warehouse_name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesWarehouse = 
        selectedWarehouseFilter === 'ALL' || String(item.warehouse_id) === String(selectedWarehouseFilter);

      const matchesStatus = 
        selectedStatusFilter === 'ALL' || item.status === selectedStatusFilter;

      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [items, searchTerm, selectedWarehouseFilter, selectedStatusFilter]);

  // Selected profile details preview for the modal
  const selectedProfileObj = useMemo(() => {
    return profiles.find(p => String(p.id) === String(formData.profile_id)) || null;
  }, [profiles, formData.profile_id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#333333]">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight flex items-center gap-2">
            <Boxes size={22} className="text-[#16A34A]" />
            <span>Cold-Chain Inventory &amp; Batches</span>
          </h2>
          <p className="text-xs text-[#A3A3A3] mt-1">
            Enterprise batch tracking linked to physical Arrhenius thermal decay profiles and multi-facility storage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="p-2.5 rounded-lg bg-[#1E1E1E] hover:bg-[#242424] text-[#A3A3A3] hover:text-[#F5F5F5] border border-[#333333] transition-colors"
            title="Refresh inventory"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={15} />
            <span>Receive Batch</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <div className="bg-[#16A34A]/15 border border-[#16A34A]/40 text-[#16A34A] px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-[#A3A3A3] hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-[#A31C18]/15 border border-[#A31C18]/40 text-[#F5F5F5] px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[#A31C18]" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="underline text-xs hover:text-white ml-4">
            Retry
          </button>
        </div>
      )}

      {/* Warehouse Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(w => (
          <div key={w.id} className="p-4 rounded-xl bg-[#1E1E1E] border border-[#333333] flex items-center justify-between gap-3 shadow-sm hover:border-[#444444] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[#242424] text-[#16A34A] border border-[#333333]">
                <Warehouse size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F5F5F5]">{w.name}</p>
                <p className="text-xs text-[#A3A3A3]">{w.location || 'Hub'} &bull; Target: <span className="font-mono text-[#F5F5F5]">{w.target_temp_c}&deg;C</span></p>
                <p className="text-[11px] font-medium text-[#16A34A] mt-1">
                  {Number(w.total_stock || 0).toLocaleString()} units &bull; {w.total_batches || 0} active lots
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-[#16A34A]/30 text-[#16A34A] bg-[#16A34A]/10">
              {w.status || 'Active'}
            </span>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1E1E1E] p-3 rounded-xl border border-[#333333]">
        <div className="flex items-center gap-2 bg-[#242424] border border-[#333333] rounded-lg px-3 py-1.5 flex-1 max-w-md">
          <Search size={14} className="text-[#A3A3A3]" />
          <input
            type="text"
            placeholder="Search by lot number, product, or warehouse..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent border-none text-xs text-[#F5F5F5] placeholder-[#A3A3A3] focus:outline-none w-full"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-[#A3A3A3] hover:text-[#F5F5F5]">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#A3A3A3]">
            <Filter size={13} />
            <span className="hidden md:inline">Warehouse:</span>
            <select
              value={selectedWarehouseFilter}
              onChange={e => setSelectedWarehouseFilter(e.target.value)}
              className="bg-[#242424] border border-[#333333] text-xs text-[#F5F5F5] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#16A34A]"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#A3A3A3]">
            <span className="hidden md:inline">Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="bg-[#242424] border border-[#333333] text-xs text-[#F5F5F5] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#16A34A]"
            >
              <option value="ALL">All Status</option>
              <option value="available">Available</option>
              <option value="quarantined">Quarantined</option>
              <option value="depleted">Depleted</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-[#333333] flex items-center justify-between bg-[#1E1E1E]">
          <h3 className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest">
            Monitored Inventory Batches ({filteredItems.length})
          </h3>
          <span className="text-[11px] text-[#A3A3A3]">
            {items.length} total lots in custody
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#A3A3A3] animate-pulse">
            Loading real inventory telemetry and batch logs...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-[#A3A3A3] space-y-3">
            <Boxes size={32} className="mx-auto text-[#333333]" />
            <p className="text-sm font-semibold text-[#F5F5F5]">No matching batches found</p>
            <p className="text-xs max-w-sm mx-auto">
              {searchTerm || selectedWarehouseFilter !== 'ALL' || selectedStatusFilter !== 'ALL'
                ? 'Try clearing active filters to see all recorded inventory.'
                : 'No inventory batches registered yet. Click "Receive Batch" above to log incoming cargo.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#171717] text-[#A3A3A3] border-b border-[#333333] font-semibold">
                <tr>
                  <th className="px-4 py-3">Batch Number</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3">Available Quantity</th>
                  <th className="px-4 py-3">Thermal Bounds</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333333] text-[#F5F5F5]">
                {filteredItems.map(item => {
                  const isNearExpiry = item.expiry_date && (item.expiry_date - Date.now() / 1000) < 86400 * 7;
                  const isExpired = item.expiry_date && (item.expiry_date < Date.now() / 1000);

                  return (
                    <tr key={item.id} className="hover:bg-[#242424]/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-white flex items-center gap-2">
                        <span>{item.batch_number}</span>
                      </td>
                      <td className="px-4 py-3.5 font-medium capitalize text-[#F5F5F5]">
                        <span className="text-[#16A34A] mr-1.5">&bull;</span>
                        {item.product_name}
                      </td>
                      <td className="px-4 py-3.5 text-[#A3A3A3]">
                        {item.warehouse_name}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-white">
                        {Number(item.quantity).toLocaleString()} <span className="text-[#A3A3A3] font-normal">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[#A3A3A3]">
                        {item.t_min_c}&deg;C – {item.t_max_c}&deg;C
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isExpired ? (
                            <span className="text-[#A31C18] font-bold">Expired</span>
                          ) : isNearExpiry ? (
                            <span className="text-[#D97706] font-semibold flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(item.expiry_date * 1000).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-[#A3A3A3]">
                              {item.expiry_date ? new Date(item.expiry_date * 1000).toLocaleDateString() : '—'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isExpired || item.status === 'expired'
                            ? 'bg-[#A31C18]/15 text-[#A31C18] border-[#A31C18]/30'
                            : isNearExpiry
                            ? 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/30'
                            : 'bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/30'
                        }`}>
                          {isExpired ? 'Expired' : item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Batch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-[#A3A3A3] hover:text-[#F5F5F5] p-1"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A]">
                <Boxes size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F5F5]">Receive New Inventory Batch</h3>
                <p className="text-xs text-[#A3A3A3]">Register validated inbound lot to warehouse custody.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 bg-[#A31C18]/15 border border-[#A31C18]/40 text-[#F5F5F5] px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} className="text-[#A31C18] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Destination Warehouse</label>
                <select
                  value={formData.warehouse_id}
                  onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                  required
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.location || 'Hub'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Product Spoilage Profile</label>
                <select
                  value={formData.profile_id}
                  onChange={e => setFormData({ ...formData, profile_id: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                  required
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name.toUpperCase()} &bull; Safe Range: {p.t_min_c}&deg;C – {p.t_max_c}&deg;C (Ref: {p.t_ref_c}&deg;C)
                    </option>
                  ))}
                </select>
                {selectedProfileObj && (
                  <p className="text-[11px] text-[#16A34A] mt-1 font-mono">
                    Nominal: {selectedProfileObj.shelf_life_hours_at_ref}h &bull; Q10: {selectedProfileObj.q10} &bull; Ea: {selectedProfileObj.ea_kj_per_mol} kJ/mol
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Lot / Batch Code Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BATCH-2026-NOV-01"
                  value={formData.batch_number}
                  onChange={e => setFormData({ ...formData, batch_number: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] font-mono focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A3A3A3] font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="500"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
                <div>
                  <label className="block text-[#A3A3A3] font-semibold mb-1">Unit of Measurement</label>
                  <input
                    type="text"
                    required
                    placeholder="vials / liters / kg"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#A3A3A3] font-semibold mb-1">Shelf Life Duration (Days until expiry)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.expiry_days}
                  onChange={e => setFormData({ ...formData, expiry_days: e.target.value })}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg p-2.5 text-[#F5F5F5] focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#333333]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#242424] hover:bg-[#333333] text-[#A3A3A3] hover:text-[#F5F5F5] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {submitting && <RefreshCw size={12} className="animate-spin" />}
                  <span>{submitting ? 'Registering...' : 'Commit Batch Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
