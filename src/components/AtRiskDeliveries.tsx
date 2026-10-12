import React, { useState } from "react";
import { Delivery, Truck } from "../types";
import {
  AlertTriangle,
  ShieldAlert,
  ArrowRightLeft,
  Clock,
  MapPin,
  Package,
  Check,
  X,
  Zap,
  Building2,
  Snowflake,
  Flame,
} from "lucide-react";

interface AtRiskDeliveriesProps {
  deliveries: Delivery[];
  trucks: Truck[];
  onReassign: (deliveryId: string, targetTruckId: string) => Promise<void>;
  isReassigning: boolean;
  onSelectBatonPass?: (deliveryId: string) => void;
  onTrackAsCustomer?: (deliveryId: string) => void;
}

export const AtRiskDeliveries: React.FC<AtRiskDeliveriesProps> = ({
  deliveries,
  trucks,
  onReassign,
  isReassigning,
  onSelectBatonPass,
  onTrackAsCustomer,
}) => {
  const [activeModalDelivery, setActiveModalDelivery] = useState<Delivery | null>(null);
  const [selectedTargetTruck, setSelectedTargetTruck] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"ALL" | "SLA_DELAY" | "COLD_CHAIN">("ALL");

  const delayedList = deliveries.filter((d) => d.is_delayed || d.delay_minutes > 0);
  const coldChainRiskList = deliveries.filter(
    (d) => d.is_perishable && (d.spoilage_risk === "RED_CRITICAL" || d.spoilage_risk === "AMBER_WARNING")
  );

  const atRiskList = deliveries.filter((d) => {
    const isDelayed = d.is_delayed || d.delay_minutes > 0;
    const isThermalRisk = d.is_perishable && (d.spoilage_risk === "RED_CRITICAL" || d.spoilage_risk === "AMBER_WARNING");
    if (filterMode === "SLA_DELAY") return isDelayed;
    if (filterMode === "COLD_CHAIN") return isThermalRisk;
    return isDelayed || isThermalRisk;
  });

  const handleOpenReassign = (delivery: Delivery) => {
    setActiveModalDelivery(delivery);
    // Default to an alternate truck
    const alternate = trucks.find((t) => t.truck_id !== delivery.assigned_truck_id);
    setSelectedTargetTruck(alternate ? alternate.truck_id : trucks[0]?.truck_id || "");
  };

  const handleConfirmReassign = async () => {
    if (!activeModalDelivery || !selectedTargetTruck) return;
    await onReassign(activeModalDelivery.delivery_id, selectedTargetTruck);
    setActiveModalDelivery(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">At-Risk Packages</h3>
            <p className="text-xs text-slate-400">SLA Delays & Cold-Chain Spoilage Alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {coldChainRiskList.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <Snowflake className="w-3 h-3 text-cyan-400" />
              {coldChainRiskList.length} Perishable
            </span>
          )}
          <span
            className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
              delayedList.length > 0
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {delayedList.length} Delayed
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setFilterMode("ALL")}
          className={`py-1 rounded-lg font-semibold transition cursor-pointer ${
            filterMode === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          All ({delayedList.length + coldChainRiskList.length})
        </button>
        <button
          onClick={() => setFilterMode("SLA_DELAY")}
          className={`py-1 rounded-lg font-semibold transition cursor-pointer ${
            filterMode === "SLA_DELAY" ? "bg-rose-950/80 text-rose-200 border border-rose-800/50" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          SLA Delays ({delayedList.length})
        </button>
        <button
          onClick={() => setFilterMode("COLD_CHAIN")}
          className={`py-1 rounded-lg font-semibold transition cursor-pointer ${
            filterMode === "COLD_CHAIN" ? "bg-amber-950/80 text-amber-200 border border-amber-800/50" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Cold-Chain ({coldChainRiskList.length})
        </button>
      </div>

      {/* Package List */}
      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
        {atRiskList.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-slate-800/80">
            <ShieldAlert className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
            <div className="text-xs font-semibold text-slate-200">
              Zero Active Bottlenecks or Spoilage Warnings!
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              All deliveries are projected on-schedule and cold-chain cargo temperatures remain in safe ranges.
            </div>
          </div>
        ) : (
          atRiskList.map((pkg) => {
            const isPerishRisk = pkg.is_perishable && (pkg.spoilage_risk === "RED_CRITICAL" || pkg.spoilage_risk === "AMBER_WARNING");

            return (
              <div
                key={pkg.delivery_id}
                className={`p-3 bg-slate-950/60 border rounded-xl hover:border-opacity-80 transition group ${
                  pkg.spoilage_risk === "RED_CRITICAL"
                    ? "border-red-600/70 shadow-sm shadow-red-950/40"
                    : pkg.spoilage_risk === "AMBER_WARNING"
                    ? "border-amber-600/60 shadow-sm shadow-amber-950/30"
                    : "border-rose-900/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-100 font-mono">{pkg.delivery_id}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {pkg.urgency}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Van {pkg.assigned_truck_id}
                      </span>

                      {/* Amber / Red Spoilage Badge */}
                      {pkg.spoilage_risk === "RED_CRITICAL" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/30 text-red-300 border border-red-500/60 flex items-center gap-1 animate-pulse">
                          <Flame className="w-3 h-3 text-red-400" />
                          RED SPOILAGE CRITICAL
                        </span>
                      )}
                      {pkg.spoilage_risk === "AMBER_WARNING" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/30 text-amber-300 border border-amber-500/60 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          AMBER DECAY WARNING
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-200 mt-1">{pkg.recipient}</div>
                    <div className="text-[11px] text-slate-400">{pkg.address}</div>
                    
                    {/* Perishable info */}
                    {pkg.is_perishable && (
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono">
                        <span className="text-cyan-300 flex items-center gap-1">
                          <Snowflake className="w-3 h-3 text-cyan-400" />
                          {pkg.perishable_category?.replace("_", " ")}
                        </span>
                        <span className="text-slate-400">
                          Temp: <strong className="text-slate-200">{pkg.current_cargo_temp_c ?? 4}°C</strong>
                        </span>
                        <span className={pkg.decay_score && pkg.decay_score >= 45 ? "text-amber-400 font-bold" : "text-slate-400"}>
                          Decay: {pkg.decay_score ?? 0}%
                        </span>
                        {pkg.exponential_weight_multiplier && pkg.exponential_weight_multiplier > 1.0 && (
                          <span className="text-cyan-400">
                            Boost: +{pkg.exponential_weight_multiplier}x
                          </span>
                        )}
                      </div>
                    )}

                    {pkg.property_type && (
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-amber-300 font-mono">
                        <Building2 className="w-3 h-3 text-amber-400" />
                        <span>
                          {pkg.property_type === "COMMERCIAL_HIGH_RISE"
                            ? `High-Rise Flr ${pkg.floor_level || 12} (+${pkg.dwell_friction_minutes || 14}m Dwell)`
                            : pkg.property_type === "GATED_VILLA_COMMUNITY"
                            ? "Gated Villa (+6m Dwell)"
                            : "Ground Retail (+2m Dwell)"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {pkg.delay_minutes > 0 ? (
                      <span className="text-xs font-bold text-rose-400 font-mono block">
                        +{pkg.delay_minutes}m Late
                      </span>
                    ) : isPerishRisk ? (
                      <span className="text-xs font-bold text-amber-400 font-mono block">
                        Thermal Risk
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 font-mono block">
                        On-Time
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      ETA {pkg.estimated_arrival_time}
                    </span>
                  </div>
                </div>

                {/* Time Window Details & Action Buttons */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>Window: {pkg.time_window_start} - {pkg.time_window_end}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onTrackAsCustomer && (
                      <button
                        onClick={() => onTrackAsCustomer(pkg.delivery_id)}
                        className="py-1 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold cursor-pointer shadow-sm"
                        title="View Live Tracking as Customer"
                      >
                        <Package className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Track</span>
                      </button>
                    )}

                    {onSelectBatonPass && (
                      <button
                        onClick={() => onSelectBatonPass(pkg.delivery_id)}
                        className="py-1 px-2.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold cursor-pointer shadow-sm"
                        title="Initiate Dynamic Multi-Vehicle Baton Pass Relay"
                      >
                        <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
                        Baton Pass
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenReassign(pkg)}
                      disabled={isReassigning}
                      className="py-1 px-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-rose-400" />
                      Reassign
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reassign Modal */}
      {activeModalDelivery && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ArrowRightLeft className="w-4 h-4" />
                <span>Reassign Package {activeModalDelivery.delivery_id}</span>
              </div>
              <button
                onClick={() => setActiveModalDelivery(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-100">{activeModalDelivery.recipient}</div>
                <div className="text-slate-400">{activeModalDelivery.address}</div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-900 font-mono">
                  <span>Urgency: <strong className="text-rose-400">{activeModalDelivery.urgency}</strong></span>
                  <span>Weight: {activeModalDelivery.weight_kg} kg</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Select Adjacent Delivery Van:
                </label>
                <div className="space-y-2">
                  {trucks.map((t) => (
                    <label
                      key={t.truck_id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                        selectedTargetTruck === t.truck_id
                          ? "bg-sky-500/20 border-sky-500 text-sky-200"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="targetTruck"
                          value={t.truck_id}
                          checked={selectedTargetTruck === t.truck_id}
                          onChange={() => setSelectedTargetTruck(t.truck_id)}
                          className="accent-sky-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-100">{t.name}</div>
                          <div className="text-[11px] text-slate-400">Driver: {t.driver}</div>
                        </div>
                      </div>
                      <div className="text-right text-[11px]">
                        <span className="font-mono text-slate-300">{t.total_packages} active stops</span>
                        {t.truck_id === activeModalDelivery.assigned_truck_id && (
                          <div className="text-[10px] text-rose-400 font-semibold">(Current Assigned)</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveModalDelivery(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReassign}
                disabled={isReassigning || selectedTargetTruck === activeModalDelivery.assigned_truck_id}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition shadow-lg shadow-rose-900/40 flex items-center gap-1.5 cursor-pointer"
              >
                {isReassigning ? (
                  <span>Reassigning & Recalculating...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Dispatch Transfer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
