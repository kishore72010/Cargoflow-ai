import React, { useState } from "react";
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, KeyRound, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface AdminLoginProps {
  onSuccess: () => void;
  onNavigateToRoleSelect: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onNavigateToRoleSelect }) => {
  const { login, errorMessage, clearError } = useAuth();
  const [email, setEmail] = useState("admin@cargoflow.demo");
  const [password, setPassword] = useState("Admin@CargoFlow2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      const ok = await login(email.trim(), password, "ADMIN");
      if (ok) {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setEmail("admin@cargoflow.demo");
    setPassword("Admin@CargoFlow2026!");
    clearError();
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-8 px-4 max-w-md mx-auto w-full">
      <div className="w-full bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">CARGOFLOW</span>
          <h1 className="text-2xl font-extrabold text-white">Fleet Admin Login</h1>
          <p className="text-xs text-slate-400 mt-1">
            Restricted operations portal for fleet dispatchers and hub controllers
          </p>
        </div>

        {/* Security Policy Notice */}
        <div className="mb-5 p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/20 text-indigo-200 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 text-indigo-400 mt-0.5" />
          <div className="flex-1 text-[11px] leading-relaxed">
            <strong className="text-white block mb-0.5">Admin Security Protocol:</strong>
            Public administrator self-registration is strictly disabled. Administrative credentials are provisioned exclusively via encrypted backend database seeding.
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
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Email / Username</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cargoflow.demo"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
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
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
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
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 transition cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>AUTHENTICATE FLEET ADMIN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Demo Quick-Fill */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] font-semibold text-slate-400 mb-2">Seeded Admin Account:</p>
          <button
            type="button"
            onClick={handleFillDemo}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-indigo-300 font-mono transition cursor-pointer"
          >
            admin@cargoflow.demo (ADM-01)
          </button>
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
