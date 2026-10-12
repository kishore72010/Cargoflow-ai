import React from "react";
import { ShieldX, AlertTriangle, ArrowRight, UserCheck } from "lucide-react";
import { AuthUser } from "../../types";

interface AccessDeniedModalProps {
  user: AuthUser | null;
  targetRole: string;
  onRedirectToOwnDashboard: () => void;
  onLogout: () => void;
}

export const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
  user,
  targetRole,
  onRedirectToOwnDashboard,
  onLogout,
}) => {
  const getDashboardName = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return "Fleet Admin Dashboard";
      case "DRIVER":
        return "Driver Portal";
      case "CUSTOMER":
        return "Customer Orders & Tracking";
      default:
        return "Role Portal";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/50 text-center animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4 shadow-lg shadow-rose-900/40">
          <ShieldX className="w-9 h-9" />
        </div>

        <div className="inline-block px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold uppercase tracking-wider mb-2">
          Security Violation
        </div>

        <h2 className="text-2xl font-black text-white tracking-wide">
          ACCESS DENIED
        </h2>

        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          You do not have the required permissions to access this route. This area requires the{" "}
          <strong className="text-rose-300 font-mono">{targetRole}</strong> role.
        </p>

        {user && (
          <div className="mt-5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span>Authenticated User:</span>
              <span className="text-white font-semibold">{user.name}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Account Email:</span>
              <span className="text-slate-300 font-mono text-[11px]">{user.email}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Your Active Role:</span>
              <span className="text-amber-400 font-bold font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {user.role}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={onRedirectToOwnDashboard}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 transition shadow-lg shadow-sky-950/50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>RETURN TO {user ? getDashboardName(user.role).toUpperCase() : "PORTAL"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
          >
            Log Out & Switch Accounts
          </button>
        </div>
      </div>
    </div>
  );
};
