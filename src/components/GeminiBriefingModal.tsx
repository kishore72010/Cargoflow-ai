import React, { useState, useEffect } from "react";
import { GeminiTacticalBriefing } from "../types";
import {
  Sparkles,
  X,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Zap,
  TrendingDown,
  Compass,
  Radio,
  CheckCircle2
} from "lucide-react";

interface GeminiBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSimulation?: () => void;
  onViewBatonPass?: () => void;
}

export const GeminiBriefingModal: React.FC<GeminiBriefingModalProps> = ({
  isOpen,
  onClose,
  onTriggerSimulation,
  onViewBatonPass,
}) => {
  const [briefing, setBriefing] = useState<GeminiTacticalBriefing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Gemini Briefing failed: ${res.statusText}`);
      }
      const data = await res.json();
      setBriefing(data.briefing);
    } catch (err: any) {
      setError(err.message || "Failed to generate briefing with Gemini API");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !briefing) {
      fetchBriefing();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-md">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-100 text-base tracking-tight">
                  Gemini Tactical Fleet Briefing
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> gemini-3.8-flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Autonomous Dispatch Copilot & Swarm Assessment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchBriefing}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Regenerate Briefing with Gemini"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {isLoading && (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-200">
                Gemini 3.8 Flash synthesizing fleet telemetry & corridor vectors...
              </div>
              <p className="text-xs text-slate-500">
                Analyzing LIFO stacks, traffic delay distributions, and Baton Pass rendezvous feasibility.
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
              <div>
                <div className="font-bold">Gemini API Briefing Error</div>
                <div className="mt-1 text-slate-300">{error}</div>
                <button
                  onClick={fetchBriefing}
                  className="mt-3 px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg text-rose-200 text-xs font-semibold cursor-pointer"
                >
                  Retry Analysis
                </button>
              </div>
            </div>
          )}

          {briefing && !isLoading && (
            <>
              {/* Executive Headline & Urgency Status */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Live Situation Status
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                      briefing.urgencyLevel === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : briefing.urgencyLevel === "ELEVATED"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    }`}
                  >
                    {briefing.urgencyLevel === "CRITICAL" && <ShieldAlert className="w-3.5 h-3.5" />}
                    {briefing.urgencyLevel === "ELEVATED" && <Zap className="w-3.5 h-3.5" />}
                    {briefing.urgencyLevel === "NOMINAL" && <ShieldCheck className="w-3.5 h-3.5" />}
                    {briefing.urgencyLevel} RISK TIER
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-100">
                  {briefing.headline}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {briefing.summary}
                </p>
              </div>

              {/* Strategic AI Recommendations */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>Strategic Tactical Actions</span>
                </div>
                <div className="space-y-1.5">
                  {briefing.strategicRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Swarm Intelligence & Baton Pass Assessment */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/30 to-cyan-950/30 border border-cyan-500/30 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Zap className="w-4 h-4" />
                  <span>Cooperative Swarm Dynamic Relays</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {briefing.swarmsAssessment}
                </p>
                {onViewBatonPass && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        onClose();
                        onViewBatonPass();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-semibold transition cursor-pointer"
                    >
                      Inspect Baton Pass Trajectories &rarr;
                    </button>
                  </div>
                )}
              </div>

              {/* Topographic & Fuel Efficiency */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-start gap-2.5 text-slate-300">
                <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-300">Fuel & Carbon Conservation: </span>
                  <span className="text-[11px] text-slate-400">{briefing.fuelAndCarbonImpact}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Powered by Gemini 3.8 Flash via Google GenAI SDK
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer transition"
          >
            Close Briefing
          </button>
        </div>
      </div>
    </div>
  );
};
