import React, { useState } from "react";
import { Package, Lock, Mail, Phone, MapPin, User, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface CustomerRegisterProps {
  onSuccessRedirectToLogin: () => void;
  onNavigateToLogin: () => void;
  onNavigateToRoleSelect: () => void;
}

export const CustomerRegister: React.FC<CustomerRegisterProps> = ({
  onSuccessRedirectToLogin,
  onNavigateToLogin,
  onNavigateToRoleSelect,
}) => {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ customerId?: string; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validation
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword || !address.trim()) {
      setLocalError("All fields are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match. Please verify.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        address: address.trim(),
        // Note: Role is intentionally not provided or forced to CUSTOMER on backend
      });

      if (res.success) {
        setSuccessInfo({
          customerId: res.customerId,
          message: res.message || "ACCOUNT CREATED SUCCESSFULLY",
        });
      } else {
        setLocalError(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-8 px-4 max-w-xl mx-auto w-full">
      <div className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
        {/* Success Modal / Banner */}
        {successInfo ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/50">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white tracking-wide">
                ACCOUNT CREATED SUCCESSFULLY
              </h2>
              <p className="text-sm text-slate-300 mt-2">
                Welcome to CargoFlow AI, <strong className="text-emerald-400">{name}</strong>!
              </p>
              {successInfo.customerId && (
                <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl inline-block">
                  <span className="text-xs text-slate-400 block">Assigned Customer ID:</span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {successInfo.customerId}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your profile is registered with role <strong className="text-slate-200">CUSTOMER</strong>. You may now proceed to log in and start ordering or tracking shipments.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onSuccessRedirectToLogin}
                className="w-full py-3 px-6 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-xl shadow-emerald-950/60 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>PROCEED TO CUSTOMER LOGIN</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <Package className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">CARGOFLOW</span>
              <h1 className="text-2xl font-extrabold text-white">Create Customer Account</h1>
              <p className="text-xs text-slate-400 mt-1">
                Register to dispatch on-demand freight and monitor cold-chain cargo
              </p>
            </div>

            {/* Error Message */}
            {localError && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{localError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Phone & Delivery Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Delivery Address *</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="456 Market St, San Francisco, CA"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password * (min 8 chars)</label>
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

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Role badge */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Account Role:</span>
                <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  CUSTOMER (Locked)
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>REGISTER CUSTOMER ACCOUNT</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Back to Login */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition cursor-pointer"
              >
                Already have an account? Log in →
              </button>
              <button
                type="button"
                onClick={onNavigateToRoleSelect}
                className="text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                Role Selection
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
