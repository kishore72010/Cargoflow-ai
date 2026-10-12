import React from "react";
import { Package, Smartphone, Shield, ArrowRight, Sparkles, Truck, Lock } from "lucide-react";

interface RoleSelectionLoginProps {
  onSelectRole: (role: "CUSTOMER" | "DRIVER" | "ADMIN") => void;
}

export const RoleSelectionLogin: React.FC<RoleSelectionLoginProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 max-w-5xl mx-auto w-full">
      {/* Brand Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span>Secure Enterprise Access Control</span>
        </div>
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-sky-900/50">
            <Truck className="w-7 h-7" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            CargoFlow <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-teal-400 bg-clip-text text-transparent">AI</span>
          </h1>
        </div>
        <p className="text-xl font-semibold text-slate-200 mt-2">Who are you?</p>
        <p className="text-sm text-slate-400 mt-1">
          Select your portal to authenticate. Each portal enforces strict cryptographic role-based access control.
        </p>
      </div>

      {/* 3 Role Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {/* CUSTOMER CARD */}
        <div
          onClick={() => onSelectRole("CUSTOMER")}
          className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-emerald-500/30 hover:border-emerald-400 rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-950/50 backdrop-blur-xl"
        >
          <div className="absolute top-4 right-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Self-Service
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
              <Package className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-300 transition">
              Customer
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Track deliveries in real-time, view live GPS truck progress, receive arrival alerts, and place orders.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole("CUSTOMER");
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 group-hover:shadow-emerald-900/50 transition cursor-pointer"
            >
              <span>CUSTOMER LOGIN</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
            <div className="text-[11px] text-center text-slate-400">
              Demo: <span className="text-slate-300 font-mono">customer01@cargoflow.demo</span>
            </div>
          </div>
        </div>

        {/* DRIVER CARD */}
        <div
          onClick={() => onSelectRole("DRIVER")}
          className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-cyan-500/30 hover:border-cyan-400 rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-900/40 backdrop-blur-xl"
        >
          <div className="absolute top-4 right-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Mobile Field
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all">
              <Smartphone className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-300 transition">
              Driver
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Assigned truck telemetry, live GPS broadcast, LIFO cargo bay manifest, and customer OTP delivery completion.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole("DRIVER");
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 group-hover:shadow-cyan-900/50 transition cursor-pointer"
            >
              <span>DRIVER LOGIN</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
            <div className="text-[11px] text-center text-slate-400">
              Demo: <span className="text-slate-300 font-mono">driver01@cargoflow.demo</span>
            </div>
          </div>
        </div>

        {/* ADMIN CARD */}
        <div
          onClick={() => onSelectRole("ADMIN")}
          className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-indigo-500/30 hover:border-indigo-400 rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-950/50 backdrop-blur-xl"
        >
          <div className="absolute top-4 right-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Fleet HQ
          </div>

          <div>
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
              <Shield className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-300 transition">
              Fleet Admin
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Complete dispatch authority: 2-opt routing, dynamic Baton Pass relays, Cold-Chain decay simulation, and Gemini AI.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole("ADMIN");
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30 group-hover:shadow-indigo-900/50 transition cursor-pointer"
            >
              <span>ADMIN LOGIN</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
            <div className="text-[11px] text-center text-slate-400">
              Demo: <span className="text-slate-300 font-mono">admin@cargoflow.demo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
