import React, { useState } from "react";
import { Smartphone, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, Truck, Navigation } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface DriverLoginProps {
  onSuccess: () => void;
  onNavigateToRoleSelect: () => void;
}

export const DriverLogin: React.FC<DriverLoginProps> = ({ onSuccess, onNavigateToRoleSelect }) => {
  const { login, errorMessage, clearError } = useAuth();
  const [emailOrId, setEmailOrId] = useState("driver01@cargoflow.demo");
  const [password, setPassword] = useState("Driver01@2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      const ok = await login(emailOrId.trim(), password, "DRIVER");
      if (ok) {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (idOrEmail: string, pass: string) => {
    setEmailOrId(idOrEmail);
    setPassword(pass);
    clearError();
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-8 px-4 max-w-md mx-auto w-full">
      <div className="w-full bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
            <Smartphone className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">CARGOFLOW</span>
          <h1 className="text-2xl font-extrabold text-white">Driver Login</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access assigned vehicle, live GPS broadcast, and LIFO cargo bay
          </p>
        </div>

        {/* Truck Lock Enforcement Notice */}
        <div className="mb-5 p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/20 text-cyan-200 text-xs flex items-start gap-2.5">
          <Navigation className="w-4 h-4 flex-shrink-0 text-cyan-400 mt-0.5" />
          <div className="flex-1 text-[11px] leading-relaxed">
            <strong className="text-white block mb-0.5">Cryptographic Truck Isolation:</strong>
            Drivers are strictly locked to their assigned vehicle. Cross-vehicle telematics manipulation is rejected by server RBAC.
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Driver ID / Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={emailOrId}
                onChange={(e) => setEmailOrId(e.target.value)}
                placeholder="driver01@cargoflow.demo or DRV-01"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>AUTHENTICATE DRIVER</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Demo Quick-Fill options */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] font-semibold text-slate-400 mb-2">Assigned Demo Drivers:</p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => handleFillDemo("driver01@cargoflow.demo", "Driver01@2026!")}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[11px] text-cyan-300 font-mono transition cursor-pointer flex items-center justify-between"
            >
              <span>Driver 1 (DRV-01)</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                Truck: TRK-01
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo("driver02@cargoflow.demo", "Driver02@2026!")}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[11px] text-cyan-300 font-mono transition cursor-pointer flex items-center justify-between"
            >
              <span>Driver 2 (DRV-02)</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                Truck: TRK-02
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo("driver03@cargoflow.demo", "Driver03@2026!")}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[11px] text-cyan-300 font-mono transition cursor-pointer flex items-center justify-between"
            >
              <span>Driver 3 (DRV-03)</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                Truck: TRK-03
              </span>
            </button>
          </div>
        </div>

        {/* Back to Role Selector */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onNavigateToRoleSelect}
            className="text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer underline"
          >
            ← Return to Role Selection
          </button>
        </div>
      </div>
    </div>
  );
};
