import React from "react";
import { Truck, Delivery, CustomerNotification } from "../types";
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Truck as TruckIcon,
  Database,
  Cpu,
  Package,
} from "lucide-react";

interface MetricsBarProps {
  deliveries: Delivery[];
  trucks: Truck[];
  notifications: CustomerNotification[];
  totalPreventedDelays: number;
  mongoConnected: boolean;
  onOpenInspector: () => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  deliveries,
  trucks,
  notifications,
  totalPreventedDelays,
  mongoConnected,
  onOpenInspector,
}) => {
  const totalDeliveries = deliveries.length;
  const delayedDeliveries = deliveries.filter((d) => d.is_delayed).length;
  const onTimeCount = totalDeliveries - delayedDeliveries;
  const onTimePercentage =
    totalDeliveries > 0 ? Math.round((onTimeCount / totalDeliveries) * 100) : 100;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* SLA On-Time Rate */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">SLA On-Time Rate</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className={`text-xl font-extrabold ${
                onTimePercentage >= 90
                  ? "text-emerald-400"
                  : onTimePercentage >= 75
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {onTimePercentage}%
            </span>
            <span className="text-[10px] text-slate-400">
              ({onTimeCount}/{totalDeliveries})
            </span>
          </div>
        </div>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            onTimePercentage >= 90
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>

      {/* Delays Prevented */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">Delays Prevented</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-extrabold text-sky-400">
              +{totalPreventedDelays}
            </span>
            <span className="text-[10px] text-slate-400">by Smart Shuffling</span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      {/* At-Risk SLA Deliveries */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">At-Risk Delayed</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className={`text-xl font-extrabold ${
                delayedDeliveries > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {delayedDeliveries}
            </span>
            <span className="text-[10px] text-slate-400">packages</span>
          </div>
        </div>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            delayedDeliveries > 0
              ? "bg-rose-500/10 text-rose-400 animate-pulse"
              : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
      </div>

      {/* Active Fleet Trucks */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">Active Fleet</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-extrabold text-slate-100">{trucks.length}</span>
            <span className="text-[10px] text-slate-400">Vans in transit</span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
          <TruckIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Architecture & AI Engine Status */}
      <div
        onClick={onOpenInspector}
        className="col-span-2 md:col-span-1 bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-xl p-3.5 flex items-center justify-between shadow-lg transition cursor-pointer group"
      >
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span className={`w-2 h-2 rounded-full ${mongoConnected ? "bg-emerald-400" : "bg-rose-500"}`} />
            <span>MongoDB + Python AI</span>
          </div>
          <div className="text-xs font-bold text-sky-400 group-hover:text-sky-300 mt-1 flex items-center gap-1">
            <span>Inspect Logic</span>
            <span className="text-[10px] font-normal text-slate-500">→</span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 group-hover:text-sky-400 group-hover:bg-sky-500/10 flex items-center justify-center transition">
          <Cpu className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
