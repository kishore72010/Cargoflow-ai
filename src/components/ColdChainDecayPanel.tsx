import React, { useState, useEffect } from "react";
import { Delivery, ColdChainCertificate } from "../types";
import {
  Snowflake,
  Thermometer,
  Flame,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Package,
  Zap,
  Info,
  Award,
  FileCheck,
} from "lucide-react";
import { ColdChainCertificateModal } from "./ColdChainCertificateModal";


interface ColdChainDecayPanelProps {
  deliveries: Delivery[];
  onSimulateHeatStall: (ambientTemp: number, idleStallMin: number, autoReshuffle: boolean) => Promise<void>;
  isSimulating: boolean;
  onRefresh: () => void;
}

export const ColdChainDecayPanel: React.FC<ColdChainDecayPanelProps> = ({
  deliveries,
  onSimulateHeatStall,
  isSimulating,
  onRefresh,
}) => {
  const [ambientTemp, setAmbientTemp] = useState<number>(34.0);
  const [idleStallMin, setIdleStallMin] = useState<number>(28.0);
  const [autoReshuffle, setAutoReshuffle] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [selectedCert, setSelectedCert] = useState<ColdChainCertificate | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState<boolean>(false);
  const [isLoadingCert, setIsLoadingCert] = useState<string | null>(null);

  const handleOpenCertificate = async (deliveryId: string) => {
    setIsLoadingCert(deliveryId);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/cold-chain-certificate`);
      const data = await res.json();
      if (data.success && data.certificate) {
        setSelectedCert(data.certificate);
        setIsCertModalOpen(true);
      }
    } catch (err) {
      console.error("Error loading cold-chain certificate:", err);
    } finally {
      setIsLoadingCert(null);
    }
  };


  const perishableItems = deliveries.filter((d) => d.is_perishable);
  const redCriticalItems = perishableItems.filter((d) => d.spoilage_risk === "RED_CRITICAL");
  const amberWarningItems = perishableItems.filter((d) => d.spoilage_risk === "AMBER_WARNING");
  const safeItems = perishableItems.filter((d) => d.spoilage_risk === "SAFE" || !d.spoilage_risk);

  const filteredItems = filterCategory === "ALL"
    ? perishableItems
    : perishableItems.filter((d) => d.perishable_category === filterCategory);

  const totalAtRiskValue = [...redCriticalItems, ...amberWarningItems].reduce(
    (acc, item) => acc + (item.cargo_value_usd || 450),
    0
  );

  const handleTriggerSimulation = async () => {
    await onSimulateHeatStall(ambientTemp, idleStallMin, autoReshuffle);
  };

  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case "ICE_CREAM":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "PHARMACEUTICALS":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "SEAFOOD_DAIRY":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "FRESH_FLOWERS":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  const getRiskBadge = (risk?: string, score?: number) => {
    if (risk === "RED_CRITICAL" || (score && score >= 75)) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-red-500/25 text-red-300 border border-red-500/50 flex items-center gap-1 shadow-sm animate-pulse">
          <Flame className="w-3 h-3 text-red-400" />
          RED CRITICAL
        </span>
      );
    }
    if (risk === "AMBER_WARNING" || (score && score >= 45)) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-500/25 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-sm">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          AMBER WARNING
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        SAFE
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Snowflake className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-sm">Cold-Chain Decay Curve</h3>
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 rounded">
                Python/Pandas + Node.js
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Thermal Degradation & Dynamic Reshuffling
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          title="Refresh Cold-Chain Telemetry"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Mathematical Innovation Banner */}
      <div className="p-3 bg-cyan-950/30 border border-cyan-900/50 rounded-xl text-xs space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Dynamic Decay Curve Model</span>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed font-mono">
          Decay Score: S(t) = 100 × (1 - e<sup>-λ·τ<sub>eff</sub></sup>) where τ<sub>eff</sub> = idle_stall × (T<sub>amb</sub>/22)<sup>1.35</sup> + transit × 0.25
        </p>
        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>If idle exceeds safe limits, priority weight surges exponentially: e<sup>0.85 × (Δstress/15)</sup></span>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Perishables</div>
          <div className="text-base font-bold text-slate-100 font-mono mt-0.5">{perishableItems.length}</div>
          <div className="text-[10px] text-slate-500">Tracked Units</div>
        </div>

        <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl p-2.5">
          <div className="text-[10px] uppercase font-semibold text-amber-300 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Amber
          </div>
          <div className="text-base font-bold text-amber-400 font-mono mt-0.5">{amberWarningItems.length}</div>
          <div className="text-[10px] text-amber-500/80">45% - 74% Decay</div>
        </div>

        <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-2.5">
          <div className="text-[10px] uppercase font-semibold text-red-300 flex items-center justify-center gap-1">
            <Flame className="w-3 h-3 text-red-400" />
            Red Critical
          </div>
          <div className="text-base font-bold text-red-400 font-mono mt-0.5">{redCriticalItems.length}</div>
          <div className="text-[10px] text-red-500/80">≥75% Spoilage</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
          <div className="text-[10px] uppercase font-semibold text-slate-400">At-Risk Value</div>
          <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">${totalAtRiskValue}</div>
          <div className="text-[10px] text-slate-500">Protected Cargo</div>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Thermal Stress Simulator
          </span>
          <span className="text-[11px] text-cyan-400 font-mono">Real-time Node/Python Bridge</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Ambient Temp */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                Ambient Air:
              </span>
              <span className="font-bold text-rose-300">{ambientTemp}°C</span>
            </div>
            <input
              type="range"
              min="20"
              max="42"
              step="1"
              value={ambientTemp}
              onChange={(e) => setAmbientTemp(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>20°C (Mild)</span>
              <span>42°C (Extreme Heat)</span>
            </div>
          </div>

          {/* Idle Stall */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Idle Stall:
              </span>
              <span className="font-bold text-amber-300">{idleStallMin} mins</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="2"
              value={idleStallMin}
              onChange={(e) => setIdleStallMin(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0m (Moving)</span>
              <span>60m (Gridlock)</span>
            </div>
          </div>
        </div>

        {/* Reshuffle Checkbox & Action Button */}
        <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoReshuffle}
              onChange={(e) => setAutoReshuffle(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>Auto-Reshuffle Route (Priority Surge)</span>
          </label>

          <button
            onClick={handleTriggerSimulation}
            disabled={isSimulating}
            className="py-2 px-3.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-rose-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50 shadow-md"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-rose-300" />
                <span>Simulate Thermal Stress</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0">Category:</span>
        {["ALL", "ICE_CREAM", "PHARMACEUTICALS", "SEAFOOD_DAIRY", "FRESH_FLOWERS"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filterCategory === cat
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/50"
                : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {cat === "ALL" ? "All Goods" : cat.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Perishable Items Telemetry List */}
      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
            No perishable goods found for this filter.
          </div>
        ) : (
          filteredItems.map((item) => {
            const decay = item.decay_score || 0;
            const decayColor =
              decay >= 75
                ? "bg-red-500"
                : decay >= 45
                ? "bg-amber-500"
                : "bg-emerald-500";

            return (
              <div
                key={item.delivery_id}
                className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-100 font-mono">
                        {item.delivery_id}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getCategoryColor(item.perishable_category)}`}>
                        {item.perishable_category?.replace("_", " ") || "PERISHABLE"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Stop #{item.optimized_sequence || item.original_sequence} on {item.assigned_truck_id}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-200 mt-1">{item.package_type}</div>
                    <div className="text-[11px] text-slate-400">{item.recipient}</div>
                  </div>

                  <div className="text-right shrink-0">
                    {getRiskBadge(item.spoilage_risk, item.decay_score)}
                    <div className="text-[10px] font-mono text-slate-400 mt-1">
                      Value: <strong className="text-emerald-400">${item.cargo_value_usd || 320}</strong>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Telemetry Metrics */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Decay Score:</span>
                    <span className={`font-bold ${decay >= 75 ? "text-red-400" : decay >= 45 ? "text-amber-400" : "text-emerald-400"}`}>
                      {decay.toFixed(1)}% / 100%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${decayColor}`}
                      style={{ width: `${Math.min(100, Math.max(5, decay))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono text-slate-400 border-t border-slate-900">
                  <div>
                    <span>Cargo Temp: </span>
                    <strong className="text-slate-200">{item.current_cargo_temp_c ?? 4.0}°C</strong>
                  </div>
                  <div>
                    <span>Priority Boost: </span>
                    <strong className="text-cyan-300">
                      {(item.exponential_weight_multiplier || 1.0).toFixed(2)}x
                    </strong>
                  </div>
                  <div>
                    <span>Safe Runway: </span>
                    <strong className={item.safe_runway_remaining_min && item.safe_runway_remaining_min < 15 ? "text-rose-400" : "text-slate-200"}>
                      {item.safe_runway_remaining_min ? `${item.safe_runway_remaining_min}m` : "Safe"}
                    </strong>
                  </div>
                </div>

                {/* Audit Certificate Button */}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenCertificate(item.delivery_id)}
                    disabled={isLoadingCert === item.delivery_id}
                    className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Award className="w-3 h-3 text-cyan-400" />
                    <span>{isLoadingCert === item.delivery_id ? "Loading..." : "View Cryptographic IoT Certificate"}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cryptographic Cold-Chain Audit Certificate Modal */}
      <ColdChainCertificateModal
        certificate={selectedCert}
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
      />
    </div>
  );
};

