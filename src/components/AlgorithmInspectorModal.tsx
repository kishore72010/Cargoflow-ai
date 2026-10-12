import React from "react";
import { Code, BookOpen, X, Cpu, Layers, Fuel, Compass, AlertTriangle, Building2 } from "lucide-react";

interface AlgorithmInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlgorithmInspectorModal: React.FC<AlgorithmInspectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                CargoFlow AI: Smart Shuffling Routing Formula
              </h2>
              <p className="text-xs text-slate-400">
                Multi-Objective LIFO Priority Sorting Formulation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Why Section */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
              <Compass className="w-4 h-4" />
              Why Standard Dijkstra / TSP Fails High-Stakes Logistics
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Standard vehicle routing engines (TSP, Google Maps, OpenRouteService) find the physically
              shortest path. However, in urban logistics:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
              <li>
                <strong className="text-rose-400">Urgency Blindness:</strong> A Critical medical parcel
                at stop #9 can miss its 30-minute SLA window even if the truck drives the fastest road.
              </li>
              <li>
                <strong className="text-purple-400">Physical LIFO Cargo Friction:</strong> Parcels are
                physically loaded in a truck bed. Reaching a box buried at the front requires 10-15 minutes
                of unpacking blocking items on the sidewalk.
              </li>
              <li>
                <strong className="text-emerald-400">Topographic Fuel Penalty:</strong> Climbing steep
                inclines (such as San Francisco's 15% hills) with a loaded commercial van burns up to 3x
                more fuel than flat arterial corridors.
              </li>
            </ul>
          </div>

          {/* Mathematical Formulation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                Composite Cost Objective Function with Vertical Last-Mile (D_f)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                Total Delivery Effort
              </span>
            </div>
            <p className="text-slate-400">
              For every candidate remaining stop <span className="font-mono text-sky-300">j</span> from
              current truck location <span className="font-mono text-sky-300">i</span>, the Smart
              Shuffler computes:
            </p>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs leading-relaxed space-y-1 text-sky-300">
              <div>
                Cost(i, j) = Distance_Cost(i, j) + Total_Delivery_Effort(i, j) + Incline_Fuel_Cost(i, j)
              </div>
              <div className="pl-14 text-purple-300">
                + LIFO_Hold_Penalty(j) + Cascade_Dwell_Penalty(j)
              </div>
              <div className="pl-14 text-rose-300">
                - Urgency_Priority_Bonus(j) + SLA_Breach_Penalty(j)
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300">
                Where: Total_Delivery_Effort(i, j) = Curb_Drive_Time(i, j) + D_f(j)
              </div>
            </div>
          </div>

          {/* Component Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-amber-900/40 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Building2 className="w-4 h-4" /> 1. Vertical Last-Mile Friction Index (D_f)
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Calculates total physical delivery effort rather than just curb-to-curb drive time:
                <br />
                <span className="text-amber-300 font-mono">• Commercial High-Rise: +12 to 15m</span> (elevators, floor $h$, security check-in)
                <br />
                <span className="text-purple-300 font-mono">• Gated Villa Community: +6m</span> (intercom clearance, long driveway)
                <br />
                <span className="text-emerald-300 font-mono">• Ground-Level Retail: +2m</span> (counter handover)
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                <Layers className="w-4 h-4" /> 2. LIFO Cargo Depth Penalty
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <code className="text-slate-200">lifo_penalty = count(remaining_parcels with index &lt; target.index) * 1.5</code>.
                Directly accounts for physical obstruction in the delivery van.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Fuel className="w-4 h-4" /> 3. Topographic Incline Factor
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <code className="text-slate-200">grade = (Δelevation / distance) * 100</code>.
                If grade &gt; 3%, applies up to a 2.2x fuel burn penalty, guiding the truck along energy-optimal paths.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                <AlertTriangle className="w-4 h-4" /> 4. Cascading Delay Protection
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Prevents scheduling high-friction drops (e.g. 15m high-rise) immediately before critical SLA stops,
                ensuring vertical dwell does not cascade into deadline collapse for downstream deliveries.
              </p>
            </div>
          </div>

          {/* "The Baton Pass" Swarm Innovation */}
          <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-slate-950 to-slate-950 border border-cyan-800/60 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                "The Baton Pass" (Dynamic Multi-Vehicle Relay)
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-mono">
                Cooperative Swarm
              </span>
            </div>
            
            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong className="text-rose-400">The Problem:</strong> When a vehicle carrying a time-sensitive package (e.g., medicine or express delivery) gets trapped in an unmoving gridlock, the entire delivery window is lost because systems treat vehicles as isolated islands.
              </p>
              <p>
                <strong className="text-emerald-400">The Innovation:</strong> The Python engine calculates an optimal rendezvous point (such as a highway exit, fuel station, or metro parking lot) where two company vehicles intersect. Vehicle A hands the urgent parcel through the window to Vehicle B, which is travelling on a clear corridor, preserving the guaranteed arrival window.
              </p>
            </div>

            {/* Stack Implementation Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-cyan-400 font-bold font-mono">Python Vector Engine:</span>
                <p className="text-slate-400">
                  Calculates intersection coordinates and time-window overlaps between two vehicle trajectory vectors.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-emerald-400 font-bold font-mono">React Dashboard:</span>
                <p className="text-slate-400">
                  Renders converging dotted lines that meet at an animated rendezvous pin on the Leaflet map.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-950 flex items-center justify-between text-[11px] text-amber-300 font-semibold">
              <span>Why It Stands Out: It turns your fleet from disconnected trucks into a cooperative swarm.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
