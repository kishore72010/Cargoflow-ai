import React, { useState } from "react";
import { Delivery, Truck } from "../types";
import { Layers, AlertCircle, HelpCircle, ArrowDown, Package, DoorClosed } from "lucide-react";

interface CargoBayVisualizerProps {
  deliveries: Delivery[];
  trucks: Truck[];
  selectedTruckId: string;
}

export const CargoBayVisualizer: React.FC<CargoBayVisualizerProps> = ({
  deliveries,
  trucks,
  selectedTruckId,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);

  const activeTruckId = selectedTruckId === "ALL" ? "TRK-01" : selectedTruckId;
  const activeTruck = trucks.find((t) => t.truck_id === activeTruckId) || trucks[0];

  const truckPackages = deliveries
    .filter((d) => d.assigned_truck_id === activeTruckId)
    .sort((a, b) => a.lifo_stack_index - b.lifo_stack_index);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">
              Physical Cargo Bay (LIFO Rack)
            </h3>
            <p className="text-xs text-slate-400">
              {activeTruck?.name || activeTruckId} Hold Orientation
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>Why LIFO?</span>
        </button>
      </div>

      {showExplanation && (
        <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl text-xs text-purple-200 space-y-1">
          <div className="font-bold text-purple-300">The Physical Unloading Constraint:</div>
          <p className="text-[11px] text-purple-300/80 leading-relaxed">
            In physical logistics, packages near the van’s rear door (Index 1) are directly accessible.
            If a high-priority parcel is buried deep in the front (Index 15+), the driver must unpack and
            re-stack blocking boxes on the street curb. The CargoFlow Smart Shuffler balances urgency
            against this physical unpacking penalty!
          </p>
        </div>
      )}

      {/* Cargo Bay Graphic */}
      <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-3">
        {/* Rear Door Indicator */}
        <div className="flex items-center justify-between pb-2 border-b border-dashed border-slate-700 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <DoorClosed className="w-3.5 h-3.5" /> REAR ROLL-UP DOOR (Direct Access)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Unpack Priority #1</span>
        </div>

        {/* Stack Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 max-h-[220px] overflow-y-auto pr-1">
          {truckPackages.map((pkg) => {
            const isCritical = pkg.urgency === "CRITICAL";
            const isHigh = pkg.urgency === "HIGH";
            const isBuried = pkg.lifo_stack_index > 8;

            return (
              <div
                key={pkg.delivery_id}
                className={`p-2 rounded-lg border text-xs flex flex-col justify-between transition ${
                  isCritical
                    ? "bg-rose-950/40 border-rose-600/60 text-rose-200"
                    : isHigh
                    ? "bg-amber-950/30 border-amber-600/50 text-amber-200"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    Slot #{pkg.lifo_stack_index}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isCritical
                        ? "bg-rose-500 text-white"
                        : isHigh
                        ? "bg-amber-500 text-slate-900"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {pkg.urgency}
                  </span>
                </div>

                <div className="font-semibold truncate text-[11px] mt-1" title={pkg.recipient}>
                  {pkg.recipient}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono pt-1 border-t border-slate-800/80">
                  <span>Seq: #{pkg.optimized_sequence}</span>
                  <span>{pkg.weight_kg}kg</span>
                </div>

                {isCritical && isBuried && (
                  <div className="mt-1 text-[9px] text-rose-400 font-semibold flex items-center gap-0.5">
                    <AlertCircle className="w-2.5 h-2.5" /> Buried behind cargo
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Front Cab Indicator */}
        <div className="pt-2 border-t border-dashed border-slate-700 text-[11px] text-slate-400 text-center font-mono">
          FRONT CABIN (Driver Bulkhead Wall)
        </div>
      </div>
    </div>
  );
};
