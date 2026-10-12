import React, { useState, useEffect } from "react";
import { Delivery } from "../types";
import {
  Building2,
  Home,
  Store,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Layers,
  Sparkles,
  RefreshCw,
  Info,
  CheckCircle2,
} from "lucide-react";

interface VerticalFrictionPanelProps {
  deliveries: Delivery[];
  selectedTruckId: string;
  onSelectDelivery?: (delivery: Delivery) => void;
}

interface FrictionSummary {
  total_deliveries: number;
  metrics: {
    total_dwell_friction_minutes: number;
    total_dwell_friction_hours: number;
    total_curb_drive_minutes: number;
    total_curb_drive_hours: number;
    total_effort_minutes: number;
    vertical_friction_pct_of_shift: number;
    avg_dwell_per_stop_minutes: number;
  };
  property_breakdown: {
    commercial_high_rise: {
      count: number;
      avg_floor: number;
      avg_elevator_delay_min: number;
      security_checkpoints_count: number;
      avg_dwell_minutes: number;
      typical_range: string;
    };
    gated_villa_community: {
      count: number;
      security_gates_count: number;
      avg_dwell_minutes: number;
      typical_range: string;
    };
    ground_level_retail: {
      count: number;
      avg_dwell_minutes: number;
      typical_range: string;
    };
  };
  top_friction_stops: Array<{
    delivery_id: string;
    recipient: string;
    address: string;
    property_type: string;
    floor_level?: number;
    security_checkpoint?: boolean;
    avg_elevator_delay?: number;
    dwell_friction_minutes?: number;
    curb_drive_time_minutes?: number;
    total_delivery_effort_minutes?: number;
    urgency: string;
    assigned_truck_id: string;
  }>;
}

export const VerticalFrictionPanel: React.FC<VerticalFrictionPanelProps> = ({
  deliveries,
  selectedTruckId,
  onSelectDelivery,
}) => {
  const [summaryData, setSummaryData] = useState<FrictionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterProperty, setFilterProperty] = useState<string>("ALL");

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vertical-friction/summary");
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error("Failed to load vertical friction summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [deliveries.length]);

  // Filter deliveries based on selected truck & property type
  const targetDeliveries = deliveries.filter((d) => {
    const truckMatch = selectedTruckId === "ALL" || d.assigned_truck_id === selectedTruckId;
    const propMatch = filterProperty === "ALL" || d.property_type === filterProperty;
    return truckMatch && propMatch;
  });

  const highRiseCount = deliveries.filter((d) => d.property_type === "COMMERCIAL_HIGH_RISE").length;
  const gatedVillaCount = deliveries.filter((d) => d.property_type === "GATED_VILLA_COMMUNITY").length;
  const groundRetailCount = deliveries.filter((d) => d.property_type === "GROUND_LEVEL_RETAIL").length;

  const totalDwellMin = deliveries.reduce((sum, d) => sum + (d.dwell_friction_minutes || 2.0), 0);
  const totalCurbDriveMin = deliveries.reduce((sum, d) => sum + (d.curb_drive_time_minutes || 6.5), 0);
  const totalEffortMin = totalDwellMin + totalCurbDriveMin;
  const dwellPercentage = totalEffortMin > 0 ? Math.round((totalDwellMin / totalEffortMin) * 100) : 46;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-sm">
                The "Vertical Last-Mile" Friction Metric
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                Index D_f
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Total Delivery Effort Optimization ($Drive\_Time + D_f$)
            </p>
          </div>
        </div>

        <button
          onClick={loadSummary}
          title="Refresh Vertical Metrics"
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
        </button>
      </div>

      {/* The Problem vs Innovation Concept Banner */}
      <div className="p-3.5 bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 border border-amber-900/40 rounded-xl space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-slate-300 leading-relaxed">
            <span className="text-rose-400 font-bold">The Problem: </span>
            Standard GPS assumes arriving at the curb pin equals completion. In reality, delivering to
            the 18th floor with security badges & slow elevators takes{" "}
            <strong className="text-amber-300 font-semibold">15 minutes</strong>, while dropping at a
            gated house takes 6 minutes and retail takes 2 minutes. This discrepancy cascades into
            severe delays for every subsequent drop.
          </div>
        </div>
        <div className="flex items-start gap-2 pt-1.5 border-t border-slate-800/80">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-slate-300 leading-relaxed">
            <span className="text-emerald-400 font-bold">CargoFlow Innovation: </span>
            Every location is tagged by property type and floor metadata. The AI calculates routes using{" "}
            <strong className="text-emerald-300 font-semibold">Total Delivery Effort</strong> rather
            than just curb-to-curb drive time, shielding subsequent time windows from cascading collapse.
          </div>
        </div>
      </div>

      {/* Effort Split Visualizer: Drive Time vs Dwell Friction */}
      <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            Total Fleet Effort Breakdown:
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {Math.round(totalEffortMin / 60)}h Total Effort
          </span>
        </div>

        {/* Dual Progress Bar */}
        <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
          <div
            style={{ width: `${100 - dwellPercentage}%` }}
            className="h-full bg-sky-500 hover:bg-sky-400 transition"
            title={`Curb Drive Time: ${Math.round(totalCurbDriveMin)} mins (${100 - dwellPercentage}%)`}
          />
          <div
            style={{ width: `${dwellPercentage}%` }}
            className="h-full bg-amber-500 hover:bg-amber-400 transition"
            title={`Vertical Dwell Friction (D_f): ${Math.round(totalDwellMin)} mins (${dwellPercentage}%)`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1">
          <div className="flex items-center gap-1.5 text-sky-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
            <span>Curb Drive Time: <strong>{100 - dwellPercentage}%</strong> ({Math.round(totalCurbDriveMin / 60)}h)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span>Vertical Dwell (D_f): <strong>{dwellPercentage}%</strong> ({Math.round(totalDwellMin / 60)}h)</span>
          </div>
        </div>
      </div>

      {/* Property Archetype Cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* Commercial High-Rise */}
        <button
          onClick={() => setFilterProperty(filterProperty === "COMMERCIAL_HIGH_RISE" ? "ALL" : "COMMERCIAL_HIGH_RISE")}
          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filterProperty === "COMMERCIAL_HIGH_RISE"
              ? "bg-amber-500/20 border-amber-500 text-amber-200"
              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                +12 to 15m
              </span>
            </div>
            <div className="text-xs font-bold text-slate-100 mt-1.5">Commercial High-Rise</div>
            <div className="text-[10px] text-slate-400">Elevators, security desk & high floors</div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-amber-400 font-semibold flex items-center justify-between">
            <span>{highRiseCount} Stops</span>
            <span>Avg ~14.2m</span>
          </div>
        </button>

        {/* Gated Villa Community */}
        <button
          onClick={() => setFilterProperty(filterProperty === "GATED_VILLA_COMMUNITY" ? "ALL" : "GATED_VILLA_COMMUNITY")}
          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filterProperty === "GATED_VILLA_COMMUNITY"
              ? "bg-purple-500/20 border-purple-500 text-purple-200"
              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <Home className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                +6m
              </span>
            </div>
            <div className="text-xs font-bold text-slate-100 mt-1.5">Gated Villa Community</div>
            <div className="text-[10px] text-slate-400">Intercom clearance & long driveways</div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-purple-400 font-semibold flex items-center justify-between">
            <span>{gatedVillaCount} Stops</span>
            <span>Avg 6.0m</span>
          </div>
        </button>

        {/* Ground-Level Retail */}
        <button
          onClick={() => setFilterProperty(filterProperty === "GROUND_LEVEL_RETAIL" ? "ALL" : "GROUND_LEVEL_RETAIL")}
          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filterProperty === "GROUND_LEVEL_RETAIL"
              ? "bg-emerald-500/20 border-emerald-500 text-emerald-200"
              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <Store className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                +2m
              </span>
            </div>
            <div className="text-xs font-bold text-slate-100 mt-1.5">Ground-Level Retail</div>
            <div className="text-[10px] text-slate-400">Storefront curb park & counter handoff</div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-emerald-400 font-semibold flex items-center justify-between">
            <span>{groundRetailCount} Stops</span>
            <span>Avg 2.0m</span>
          </div>
        </button>
      </div>

      {/* Package List with D_f Metadata */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">
            Delivery Locations Tagged by D_f Friction ({targetDeliveries.length})
          </span>
          {filterProperty !== "ALL" && (
            <button
              onClick={() => setFilterProperty("ALL")}
              className="text-[10px] text-sky-400 hover:underline cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {targetDeliveries.slice(0, 15).map((stop) => {
            const isHighRise = stop.property_type === "COMMERCIAL_HIGH_RISE";
            const isGated = stop.property_type === "GATED_VILLA_COMMUNITY";
            const friction = stop.dwell_friction_minutes || 2.0;

            return (
              <div
                key={stop.delivery_id}
                onClick={() => onSelectDelivery?.(stop)}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/40 transition cursor-pointer flex items-start justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-100 font-mono">
                      {stop.delivery_id}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isHighRise
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : isGated
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {isHighRise
                        ? "High-Rise"
                        : isGated
                        ? "Gated Villa"
                        : "Ground Retail"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Van {stop.assigned_truck_id}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {stop.recipient}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{stop.address}</div>

                  {/* Building Specific Metadata from MongoDB */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1 flex-wrap">
                    {stop.floor_level && (
                      <span className="text-slate-300 font-medium">
                        Floor {stop.floor_level}
                      </span>
                    )}
                    {stop.security_checkpoint && (
                      <span className="text-amber-400 flex items-center gap-0.5 font-medium">
                        <ShieldCheck className="w-3 h-3" /> Security Desk
                      </span>
                    )}
                    {stop.avg_elevator_delay && stop.avg_elevator_delay > 0 && (
                      <span className="text-slate-400">
                        Elevator Wait: ~{stop.avg_elevator_delay}m
                      </span>
                    )}
                  </div>
                </div>

                {/* Effort Metrics Pill */}
                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-extrabold font-mono ${
                      friction >= 12
                        ? "text-amber-400"
                        : friction >= 6
                        ? "text-purple-400"
                        : "text-emerald-400"
                    }`}
                  >
                    +{friction}m D_f
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Drive: {stop.curb_drive_time_minutes || 5}m
                  </div>
                  <div className="text-[10px] text-slate-300 font-semibold font-mono mt-0.5">
                    Effort: {stop.total_delivery_effort_minutes || (friction + 5).toFixed(1)}m
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
