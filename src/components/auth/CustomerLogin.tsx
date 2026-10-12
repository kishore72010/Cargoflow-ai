import React, { useState } from "react";
import { Package, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle2, UserPlus, Info } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface CustomerLoginProps {
  onSuccess: () => void;
  onNavigateToRegister: () => void;
  onNavigateToRoleSelect: () => void;
}

export const CustomerLogin: React.FC<CustomerLoginProps> = ({
  onSuccess,
  onNavigateToRegister,
  onNavigateToRoleSelect,
}) => {
  const { login, errorMessage, clearError } = useAuth();
  const [email, setEmail] = useState("customer01@cargoflow.demo");
  const [password, setPassword] = useState("Customer01@2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      const ok = await login(email.trim(), password, "CUSTOMER");
      if (ok) {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    clearError();
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-8 px-4 max-w-md mx-auto w-full">
      <div className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
            <Package className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">CARGOFLOW</span>
          <h1 className="text-2xl font-extrabold text-white">Customer Login</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access your orders, live GPS cargo tracking, and delivery updates
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Forgot password prototype notification */}
        {forgotPasswordNotice && (
          <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Password Reset Notice:</span>
              Password reset email service is not configured in this prototype. Please use the documented demo credentials or register a new customer account.
              <button
                type="button"
                onClick={() => setForgotPasswordNotice(false)}
                className="block mt-1 text-[11px] underline text-amber-200 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => setForgotPasswordNotice(true)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
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

          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>LOGIN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onNavigateToRegister}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>CREATE ACCOUNT</span>
            </button>
          </div>
        </form>

        {/* Demo Quick-Fill options */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] font-semibold text-slate-400 mb-2">Demo Customer Accounts:</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleFillDemo("customer01@cargoflow.demo", "Customer01@2026!")}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[10px] text-slate-300 font-mono transition cursor-pointer"
            >
              Kishore (customer01)
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo("customer02@cargoflow.demo", "Customer02@2026!")}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[10px] text-slate-300 font-mono transition cursor-pointer"
            >
              Dr. Sarah (customer02)
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
