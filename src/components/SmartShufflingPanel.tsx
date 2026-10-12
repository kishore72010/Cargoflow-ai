import React, { useState } from "react";
import { Truck, UrgencyTier } from "../types";
import {
  Shuffle,
  AlertOctagon,
  RefreshCw,
  Fuel,
  Layers,
  Sliders,
  Sparkles,
  CheckCircle2,
  TrendingDown,
  Building2,
} from "lucide-react";

interface SmartShufflingPanelProps {
  trucks: Truck[];
  selectedTruckId: string;
  onSelectTruck: (truckId: string) => void;
  onRunOptimization: (params: {
    truck_id: string;
    traffic_delay: number;
    fuel_weight: number;
    lifo_strictness: number;
    dwell_friction_weight?: number;
  }) => Promise<void>;
  onSimulateTraffic: (truckId: string, delayMinutes: number) => Promise<void>;
  onResetData: () => Promise<void>;
  isOptimizing: boolean;
  isResetting: boolean;
  lastOptimizationMetrics?: any;
}

export const SmartShufflingPanel: React.FC<SmartShufflingPanelProps> = ({
  trucks,
  selectedTruckId,
  onSelectTruck,
  onRunOptimization,
  onSimulateTraffic,
  onResetData,
  isOptimizing,
  isResetting,
  lastOptimizationMetrics,
}) => {
  const [fuelWeight, setFuelWeight] = useState<number>(0.4);
  const [lifoStrictness, setLifoStrictness] = useState<number>(0.3);
  const [dwellFrictionWeight, setDwellFrictionWeight] = useState<number>(0.5);
  const [trafficDelayInput, setTrafficDelayInput] = useState<number>(35);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const handleShuffleClick = () => {
    onRunOptimization({
      truck_id: selectedTruckId,
      traffic_delay: 0,
      fuel_weight: fuelWeight,
      lifo_strictness: lifoStrictness,
      dwell_friction_weight: dwellFrictionWeight,
    });
  };

  const handleTrafficSimClick = () => {
    const target = selectedTruckId === "ALL" ? "TRK-01" : selectedTruckId;
    onSimulateTraffic(target, trafficDelayInput);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Shuffle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Smart Shuffling Engine</h3>
            <p className="text-xs text-slate-400">Python LIFO Priority Routing</p>
          </div>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 transition cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          {showAdvanced ? "Hide Weights" : "Weights & Sliders"}
        </button>
      </div>

      {/* Target Truck Selector */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
          Target Delivery Fleet:
        </label>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => onSelectTruck("ALL")}
            className={`py-2 px-2 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1 cursor-pointer ${
              selectedTruckId === "ALL"
                ? "bg-sky-500/20 border-sky-500 text-sky-300"
                : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800"
            }`}
          >
            All Fleet
          </button>
          {trucks.map((t) => (
            <button
              key={t.truck_id}
              onClick={() => onSelectTruck(t.truck_id)}
              className={`py-2 px-2 text-xs font-semibold rounded-xl border transition flex flex-col items-center justify-center cursor-pointer ${
                selectedTruckId === t.truck_id
                  ? "bg-sky-500/20 border-sky-500 text-sky-300"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <span>{t.truck_id}</span>
              {t.current_traffic_delay_min > 0 && (
                <span className="text-[9px] text-rose-400 font-bold">+{t.current_traffic_delay_min}m</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Sliders for Fuel Efficiency & LIFO */}
      {showAdvanced && (
        <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                Fuel-Efficiency Incline Penalty:
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                {Math.round(fuelWeight * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={fuelWeight}
              onChange={(e) => setFuelWeight(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Penalizes heavy uphill cargo routes (San Francisco hills) in favor of flatter, fuel-saving paths.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                LIFO Cargo Stack Strictness:
              </span>
              <span className="font-mono text-purple-400 font-semibold">
                {Math.round(lifoStrictness * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={lifoStrictness}
              onChange={(e) => setLifoStrictness(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Prefers delivering boxes loaded near the rear door to avoid physical van unpacking delays.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Vertical Dwell Friction (D_f) Factor:
              </span>
              <span className="font-mono text-amber-400 font-semibold">
                {Math.round(dwellFrictionWeight * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={dwellFrictionWeight}
              onChange={(e) => setDwellFrictionWeight(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Accounts for non-driving building dwell (high-rises +15m, villas +6m, retail +2m) to prevent downstream SLA cascade.
            </p>
          </div>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          onClick={handleShuffleClick}
          disabled={isOptimizing}
          className="py-2.5 px-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          {isOptimizing ? (
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Sparkles className="w-4 h-4 text-sky-200" />
          )}
          <span>{isOptimizing ? "Shuffling in Python..." : "Execute Smart Shuffling"}</span>
        </button>

        <button
          onClick={handleTrafficSimClick}
          disabled={isOptimizing}
          className="py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          <span>Simulate Delay (+{trafficDelayInput}m)</span>
        </button>
      </div>

      {/* Reset Baseline Data Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <span className="text-[11px] text-slate-400">
          50 Mock Deliveries Seeded in MongoDB
        </span>
        <button
          onClick={onResetData}
          disabled={isResetting}
          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isResetting ? "animate-spin text-amber-400" : ""}`} />
          {isResetting ? "Seeding..." : "Reset Data"}
        </button>
      </div>

      {/* Real-time feedback from last optimization */}
      {lastOptimizationMetrics && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-emerald-200">
              {lastOptimizationMetrics.total_prevented_delays || 0} Delivery SLA Breaches Prevented!
            </span>
            <div className="text-[11px] text-emerald-400/80">
              Sequence reordered via urgency matrix & LIFO priority.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
