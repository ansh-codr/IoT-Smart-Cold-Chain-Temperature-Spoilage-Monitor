import React, { useState } from 'react';
import { Layers, Plus, ShieldCheck, Thermometer } from 'lucide-react';

export function ProfilesView({ profiles = [] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5] tracking-tight">Product Decay &amp; Spoilage Profiles</h2>
          <p className="text-xs text-[#A3A3A3] mt-1">Configured activation energy ($E_a$), $Q_{10}$ coefficients, and baseline thresholds.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map(p => (
          <div key={p.id} className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/30">
                  <Layers size={18} />
                </div>
                <h3 className="font-bold text-base text-[#F5F5F5] capitalize">{p.name}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#242424] text-[#A3A3A3] border border-[#333333]">
                ID: {p.id}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#242424] border border-[#333333] flex justify-between items-center">
                <span className="text-[#A3A3A3]">Safe Thermal Window:</span>
                <span className="font-semibold text-[#16A34A] font-mono">{p.t_min_c}&deg;C – {p.t_max_c}&deg;C</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#242424] border border-[#333333] flex justify-between items-center">
                <span className="text-[#A3A3A3]">Target Reference Temp:</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">{p.t_ref_c}&deg;C</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#242424] border border-[#333333] flex justify-between items-center">
                <span className="text-[#A3A3A3]">Nominal Shelf Life:</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">{p.shelf_life_hours_at_ref} hrs</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#242424] border border-[#333333] flex justify-between items-center">
                <span className="text-[#A3A3A3]">Q10 Reaction Factor:</span>
                <span className="font-semibold text-[#64748B] font-mono">{p.q10}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#242424] border border-[#333333] flex justify-between items-center">
                <span className="text-[#A3A3A3]">Activation Energy (Ea):</span>
                <span className="font-semibold text-[#64748B] font-mono">{p.ea_kj_per_mol} kJ/mol</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#242424] border border-[#333333] flex justify-between items-center">
                <span className="text-[#A3A3A3]">VOC Baseline / Spoil Delta:</span>
                <span className="font-semibold text-[#D97706] font-mono">{p.voc_baseline} / +{p.voc_spoil_delta} ADC</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

