import React, { useState } from "react";
import { BatonPassRelay, GeminiRelayAnalysis } from "../types";
import {
  Repeat,
  Zap,
  Clock,
  MapPin,
  ShieldCheck,
  Navigation,
  ArrowRight,
  Sparkles,
  Radio,
  CheckCircle2,
  Eye,
  RefreshCw,
  Bot,
  AlertCircle
} from "lucide-react";

interface BatonPassPanelProps {
  relays: BatonPassRelay[];
  activeRelay: BatonPassRelay | null;
  onSelectRelay: (relay: BatonPassRelay | null) => void;
  onExecuteRelay: (relay: BatonPassRelay) => Promise<void>;
  isLoading: boolean;
  onRefreshScan: () => Promise<void>;
  onTriggerSimulation?: () => Promise<void>;
}

export const BatonPassPanel: React.FC<BatonPassPanelProps> = ({
  relays,
  activeRelay,
  onSelectRelay,
  onExecuteRelay,
  isLoading,
  onRefreshScan,
  onTriggerSimulation,
}) => {
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<GeminiRelayAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const currentRelay = activeRelay || relays[0] || null;

  const handleRunAiAnalysis = async (relay: BatonPassRelay) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/ai/analyze-relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relay }),
      });
      if (!res.ok) {
        throw new Error(`AI Analysis failed: ${res.statusText}`);
      }
      const data = await res.json();
      setAiAnalysis(data.analysis);
    } catch (err: any) {
      setAnalysisError(err.message || "Failed to analyze relay with Gemini");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecute = async (relay: BatonPassRelay) => {
    setIsExecuting(true);
    try {
      await onExecuteRelay(relay);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header with Swarm Badge */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md shadow-amber-900/20">
            <Repeat className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-100 text-sm tracking-tight">
                The Baton Pass
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> Cooperative Swarm
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Dynamic Multi-Vehicle Window Handoff
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshScan}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
          title="Rescan fleet for relay opportunities"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Problem & Innovation Callout Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-950 to-cyan-950/40 border border-amber-500/30 text-xs space-y-2">
        <div className="flex items-start gap-2.5 text-slate-300 leading-relaxed text-[11px]">
          <div className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
            !
          </div>
          <div>
            <strong className="text-rose-300 font-semibold">The Problem:</strong> When a vehicle carrying a time-sensitive package (e.g., medicine or express delivery) gets trapped in an unmoving gridlock, the entire delivery window is lost because systems treat vehicles as isolated islands.
          </div>
        </div>
        <div className="flex items-start gap-2.5 text-slate-300 leading-relaxed text-[11px] pt-1.5 border-t border-slate-800/80">
          <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-3 h-3" />
          </div>
          <div>
            <strong className="text-emerald-300 font-semibold">The Innovation:</strong> The Python engine calculates an optimal rendezvous point (such as a highway exit, fuel station, or metro parking lot) where two company vehicles intersect. Vehicle A hands the urgent parcel through the window to Vehicle B, which is travelling on a clear corridor, preserving the guaranteed arrival window.
          </div>
        </div>
        <div className="pt-1.5 border-t border-cyan-950 flex items-center justify-between text-[10px] text-cyan-300 font-medium">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>Why It Stands Out: It turns your fleet from disconnected trucks into a cooperative swarm.</span>
          </span>
          <span className="text-slate-400 font-mono">Python Vector Intersection</span>
        </div>
      </div>

      {/* Relays Count & Quick Simulator Trigger */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-300">
          Viable Swarm Relays: <span className="text-emerald-400 font-mono font-bold">({relays.length})</span>
        </span>
        {onTriggerSimulation && (
          <button
            onClick={onTriggerSimulation}
            disabled={isLoading || isExecuting}
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Simulate Gridlock & Relay
          </button>
        )}
      </div>

      {/* Relay Opportunities List / Selector */}
      {relays.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 text-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
          <div>No active vehicles currently trapped in gridlock.</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Click &ldquo;Simulate Gridlock & Relay&rdquo; or inject traffic in the panel above to calculate spatio-temporal intersection vectors.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
          {relays.map((relay) => {
            const isSelected = currentRelay?.delivery_id === relay.delivery_id;

            return (
              <div
                key={relay.delivery_id}
                onClick={() => onSelectRelay(relay)}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-slate-800/90 border-cyan-500/60 shadow-md shadow-cyan-950/30"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-100 font-mono">
                      {relay.delivery_id}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        relay.urgency === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {relay.urgency}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {relay.package_type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate mt-0.5">
                    {relay.carrier_truck.truck_id} &rarr; {relay.relay_truck.truck_id} at {relay.rendezvous_hub.name.split(" ")[0]}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-emerald-400 font-mono block">
                    +{relay.metrics.minutes_saved}m Saved
                  </span>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    {isSelected && (
                      <span className="text-[9px] font-bold text-cyan-400 flex items-center gap-0.5">
                        <Eye className="w-2.5 h-2.5" /> Mapped
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Relay Detailed Telemetry & Vector Breakdown */}
      {currentRelay && (
        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
          {/* Rendezvous Hub Location */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div>
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                <MapPin className="w-3.5 h-3.5" />
                <span>Optimal Rendezvous Point</span>
              </div>
              <div className="text-xs font-semibold text-slate-100 mt-0.5">
                {currentRelay.rendezvous_hub.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {currentRelay.rendezvous_hub.address}
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
              SLA PRESERVED
            </span>
          </div>

          {/* Synchronized Vector Telemetry Diagram */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Vehicle A (Stalled Carrier) */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 space-y-1">
              <div className="flex items-center justify-between text-amber-400 font-bold">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Vehicle A (Stalled)
                </span>
                <span className="font-mono text-[10px]">{currentRelay.carrier_truck.truck_id}</span>
              </div>
              <div className="text-slate-200 font-medium truncate">
                {currentRelay.carrier_truck.driver}
              </div>
              <div className="text-slate-400 flex justify-between font-mono text-[10px]">
                <span>Corridor Gridlock:</span>
                <span className="text-rose-400 font-bold">+{currentRelay.carrier_truck.traffic_delay_min}m delay</span>
              </div>
              <div className="text-slate-400 flex justify-between font-mono text-[10px]">
                <span>ETA to Rendezvous:</span>
                <span className="text-slate-200 font-bold">{currentRelay.carrier_truck.hub_arrival_time}</span>
              </div>
            </div>

            {/* Vehicle B (Clear Corridor Relay Partner) */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between text-cyan-400 font-bold">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Vehicle B (Clear)
                </span>
                <span className="font-mono text-[10px]">{currentRelay.relay_truck.truck_id}</span>
              </div>
              <div className="text-slate-200 font-medium truncate">
                {currentRelay.relay_truck.driver}
              </div>
              <div className="text-slate-400 flex justify-between font-mono text-[10px]">
                <span>Corridor Status:</span>
                <span className="text-emerald-400 font-bold">Free Flow (0m delay)</span>
              </div>
              <div className="text-slate-400 flex justify-between font-mono text-[10px]">
                <span>ETA to Rendezvous:</span>
                <span className="text-slate-200 font-bold">{currentRelay.relay_truck.hub_arrival_time}</span>
              </div>
            </div>
          </div>

          {/* Handshake Overlap & Time Saved Metrics */}
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Handshake Window:
              </span>
              <span className="font-mono font-bold text-slate-100">
                {currentRelay.handoff_details.synchronized_time} (Overlap delta: {currentRelay.handoff_details.wait_delta_minutes}m curb wait)
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Window-to-Window Exchange:</span>
              <span className="font-mono text-slate-200">
                {currentRelay.handoff_details.transfer_duration_minutes} min QR scan handoff
              </span>
            </div>

            <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/80">
              <span className="text-slate-400">Delivery Arrival Comparison:</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-rose-400 line-through text-[11px]">
                  {currentRelay.metrics.status_quo_arrival}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-emerald-400 font-bold">
                  {currentRelay.metrics.relay_projected_arrival}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>Customer SLA Deadline:</span>
              <span className="font-mono font-semibold text-slate-200">
                {currentRelay.metrics.sla_deadline}
              </span>
            </div>
          </div>

          {/* Gemini AI Swarm Intelligence Evaluation */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-900 border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>Gemini 3.8 Flash Swarm Evaluator</span>
              </div>
              <button
                onClick={() => handleRunAiAnalysis(currentRelay)}
                disabled={isAnalyzing}
                className="px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3 h-3 text-cyan-300 ${isAnalyzing ? "animate-spin" : ""}`} />
                <span>{isAnalyzing ? "Reasoning..." : "Analyze with Gemini"}</span>
              </button>
            </div>

            {analysisError && (
              <div className="text-[11px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{analysisError}</span>
              </div>
            )}

            {aiAnalysis ? (
              <div className="space-y-2 pt-1 border-t border-cyan-500/20 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Recommendation:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    aiAnalysis.recommendation === "EXECUTE_IMMEDIATELY"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}>
                    {aiAnalysis.recommendation.replace("_", " ")} ({aiAnalysis.confidenceScore}% Confidence)
                  </span>
                </div>
                <div className="text-slate-300 text-[11px] leading-relaxed">
                  <span className="font-semibold text-cyan-200">Tactical Rationale: </span>
                  {aiAnalysis.tacticalRationale}
                </div>
                <div className="text-slate-300 text-[11px] leading-relaxed">
                  <span className="font-semibold text-emerald-300">Cold-Chain Assurance: </span>
                  {aiAnalysis.coldChainSafetyMargin}
                </div>
                <div className="text-slate-400 text-[10px] italic">
                  &bull; Handshake Feasibility: {aiAnalysis.handshakeFeasibility}
                </div>
              </div>
            ) : !isAnalyzing && (
              <p className="text-[11px] text-slate-400 leading-snug">
                Click <span className="text-cyan-300 font-semibold">&ldquo;Analyze with Gemini&rdquo;</span> to evaluate vehicle trajectory risk, curbside handoff safety, and cargo temperature tolerances with the Gemini 3.8 Flash model.
              </p>
            )}
          </div>

          {/* Action Buttons: Preview on Map & Authorize Baton Pass */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onSelectRelay(currentRelay)}
              className="py-2 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Center on Map</span>
            </button>

            <button
              onClick={() => handleExecute(currentRelay)}
              disabled={isExecuting}
              className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/30 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{isExecuting ? "Executing Relay..." : "Authorize Baton Pass"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
