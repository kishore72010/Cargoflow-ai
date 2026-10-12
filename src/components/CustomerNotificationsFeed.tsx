import React from "react";
import { CustomerNotification } from "../types";
import { Bell, MessageSquare, Mail, Phone, Clock, AlertCircle } from "lucide-react";

interface CustomerNotificationsFeedProps {
  notifications: CustomerNotification[];
}

export const CustomerNotificationsFeed: React.FC<CustomerNotificationsFeedProps> = ({
  notifications,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Customer Alerts Stream</h3>
            <p className="text-xs text-slate-400">Automated SMS & Email ETA Breach Dispatches</p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
          {notifications.length} Dispatched
        </span>
      </div>

      {/* Notifications Log */}
      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-slate-800/80">
            <MessageSquare className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <div className="text-xs font-semibold text-slate-400">No Customer Delay Alerts</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Dispatches trigger automatically if a stop breaches promised SLA windows.
            </div>
          </div>
        ) : (
          notifications.map((notif, index) => (
            <div
              key={notif._id || `${notif.delivery_id}-${index}`}
              className="p-3 bg-slate-950/70 border border-slate-800/90 rounded-xl hover:border-slate-700 transition space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-400">
                    {notif.delivery_id}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-200">
                    {notif.recipient}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    {typeof notif.dispatched_at === "string"
                      ? new Date(notif.dispatched_at).toLocaleTimeString()
                      : "Just now"}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 font-mono leading-relaxed">
                "{notif.message}"
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Phone className="w-3 h-3" /> {notif.recipient_phone}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Mail className="w-3 h-3" /> {notif.recipient_email}
                  </span>
                </div>
                <span className="font-semibold text-rose-400">
                  +{notif.delay_minutes}m Revised ETA
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
