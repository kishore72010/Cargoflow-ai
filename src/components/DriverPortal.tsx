import React, { useState, useEffect, useRef } from "react";
import { Truck, Delivery, Driver, AuthUser } from "../types";
import {
  Navigation,
  Radio,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  Snowflake,
  ShieldCheck,
  Package,
  KeyRound,
  Zap,
  Phone,
  RefreshCw,
  Compass,
  Gauge,
  Signal,
  Check,
  X,
  LogOut,
} from "lucide-react";
import { getSocket } from "../services/socket";

interface DriverPortalProps {
  trucks: Truck[];
  deliveries: Delivery[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string) => void;
  onSwitchToAdmin?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({
  trucks,
  deliveries,
  onRefresh,
  showToast,
  onSwitchToAdmin,
  currentUser,
  onLogout,
}) => {
  // Driver Roster
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(currentUser?.driverId || "DRV-01");

  useEffect(() => {
    if (currentUser?.driverId) {
      setSelectedDriverId(currentUser.driverId);
    }
  }, [currentUser]);
  const [gpsStatus, setGpsStatus] = useState<
    "GPS_ACTIVE" | "GPS_OFF" | "GPS_CONNECTING" | "PERMISSION_DENIED" | "GPS_STALE" | "SIMULATED"
  >("GPS_OFF");

  // Telemetry state
  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    timestamp: number | null;
  }>({
    latitude: null,
    longitude: null,
    accuracy: null,
    speed: null,
    heading: null,
    timestamp: null,
  });

  const [lastUpdatedSec, setLastUpdatedSec] = useState<number>(0);
  const [otpModalDelivery, setOtpModalDelivery] = useState<Delivery | null>(null);
  const [otpInput, setOtpInput] = useState<string>("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isMarkingArrived, setIsMarkingArrived] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const tickerRef = useRef<any>(null);

  // Fetch drivers list on mount
  useEffect(() => {
    fetch("/api/drivers")
      .then((res) => res.json())
      .then((data) => {
        if (data.drivers && data.drivers.length > 0) {
          setDrivers(data.drivers);
        }
      })
      .catch(() => {});
  }, []);

  // Determine active driver & truck
  const activeDriver = drivers.find((d) => d.driver_id === selectedDriverId) || {
    driver_id: "DRV-01",
    name: "Marcus Vance",
    assigned_truck_id: "TRK-01",
    phone: "+1 (415) 555-0111",
    active: true,
  };

  const assignedTruck = trucks.find((t) => t.truck_id === activeDriver.assigned_truck_id) || trucks[0];

  // Deliveries for this driver's truck
  const driverDeliveries = deliveries
    .filter((d) => d.assigned_truck_id === assignedTruck?.truck_id)
    .sort((a, b) => (a.optimized_sequence || 0) - (b.optimized_sequence || 0));

  const pendingDeliveries = driverDeliveries.filter((d) => d.status !== "delivered");
  const completedDeliveries = driverDeliveries.filter((d) => d.status === "delivered");
  const currentStop = pendingDeliveries[0] || null;

  // Stale GPS ticker
  useEffect(() => {
    tickerRef.current = setInterval(() => {
      if (coords.timestamp) {
        const sec = Math.floor((Date.now() - coords.timestamp) / 1000);
        setLastUpdatedSec(sec);
        if (sec > 25 && gpsStatus === "GPS_ACTIVE") {
          setGpsStatus("GPS_STALE");
        }
      }
    }, 1000);

    return () => clearInterval(tickerRef.current);
  }, [coords.timestamp, gpsStatus]);

  // Clean up geolocation on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // START GPS TRACKING
  const handleStartTracking = () => {
    if (!navigator.geolocation) {
      setGpsStatus("PERMISSION_DENIED");
      showToast("Geolocation is not supported by your browser.");
      return;
    }

    setGpsStatus("GPS_CONNECTING");
    showToast("Requesting GPS access. Please allow location permissions...");

    // Notify backend tracking started
    fetch(`/api/trucks/${assignedTruck.truck_id}/tracking/start`, { method: "POST" }).catch(() => {});

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        const now = Date.now();

        setCoords({
          latitude,
          longitude,
          accuracy,
          speed: speed ? Math.round(speed * 3.6) : 0, // m/s to km/h
          heading: heading || 0,
          timestamp: now,
        });

        setGpsStatus("GPS_ACTIVE");
        setLastUpdatedSec(0);

        // Push to server
        try {
          await fetch(`/api/trucks/${assignedTruck.truck_id}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy: Math.round(accuracy),
              speed: speed ? Math.round(speed * 3.6) : 0,
              heading: heading || 0,
              timestamp: new Date(now).toISOString(),
              driver_id: activeDriver.driver_id,
            }),
          });
        } catch (err) {
          console.warn("Failed to stream GPS coordinates to server:", err);
        }
      },
      (error) => {
        console.error("GPS Watch Error:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus("PERMISSION_DENIED");
          showToast("Location permission was denied. Please enable GPS in your browser.");
        } else if (error.code === error.TIMEOUT) {
          setGpsStatus("GPS_STALE");
          showToast("GPS position request timed out.");
        } else {
          setGpsStatus("GPS_OFF");
          showToast("GPS error: " + error.message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  // STOP GPS TRACKING
  const handleStopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsStatus("GPS_OFF");
    showToast("GPS tracking stopped.");

    fetch(`/api/trucks/${assignedTruck.truck_id}/tracking/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fallback_to_simulation: false }),
    }).catch(() => {});
  };

  // SIMULATE POSITION (for testing without moving outdoors)
  const handleSimulatePosition = async () => {
    const lat = Number((assignedTruck.latitude + (Math.random() - 0.5) * 0.005).toFixed(6));
    const lng = Number((assignedTruck.longitude + (Math.random() - 0.5) * 0.005).toFixed(6));
    const now = Date.now();

    setCoords({
      latitude: lat,
      longitude: lng,
      accuracy: 6,
      speed: 28,
      heading: 45,
      timestamp: now,
    });
    setGpsStatus("SIMULATED");
    setLastUpdatedSec(0);

    try {
      await fetch(`/api/trucks/${assignedTruck.truck_id}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracy: 6,
          speed: 28,
          heading: 45,
          timestamp: new Date(now).toISOString(),
          driver_id: activeDriver.driver_id,
        }),
      });
      showToast(`Position ping sent to dispatcher (${lat}, ${lng})!`);
    } catch (err: any) {
      showToast("Error updating position: " + err.message);
    }
  };

  // MARK ARRIVED
  const handleMarkArrived = async (deliveryId: string) => {
    setIsMarkingArrived(deliveryId);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/mark-arrived`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(`Arrived at destination for ${deliveryId}. Request customer OTP.`);
        await onRefresh();
      }
    } catch (err: any) {
      showToast("Error: " + err.message);
    } finally {
      setIsMarkingArrived(null);
    }
  };

  // CONFIRM OTP
  const handleVerifyOtp = async () => {
    if (!otpModalDelivery) return;
    if (!otpInput.trim()) {
      setOtpError("Please enter the 6-digit customer OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await fetch(`/api/deliveries/${otpModalDelivery.delivery_id}/confirm-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: otpInput.trim(),
          driver_id: activeDriver.driver_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Delivery ${otpModalDelivery.delivery_id} completed successfully!`);
        setOtpModalDelivery(null);
        setOtpInput("");
        await onRefresh();
      } else {
        setOtpError(data.error || "Invalid OTP. Please check with customer.");
      }
    } catch (err: any) {
      setOtpError("Network error: " + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto pb-20 px-2 sm:px-4">
      {/* Top Mobile Driver Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-blue-400 uppercase">Driver Mobile Portal</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-xs font-bold text-slate-300 font-mono">{assignedTruck?.truck_id}</span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-100">{activeDriver.name}</h1>
            </div>
          </div>

          {/* Role switcher link */}
          {onSwitchToAdmin && (
            <button
              onClick={onSwitchToAdmin}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition border border-slate-700 cursor-pointer"
            >
              Admin View
            </button>
          )}
        </div>

        {/* Requirement 33: Driver Header Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-400 block text-[10px]">Driver:</span>
              <strong className="text-white font-bold">{currentUser?.name || activeDriver.name}</strong>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-slate-400 block text-[10px]">Truck:</span>
              <span className="font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {currentUser?.assignedVehicleId || assignedTruck?.truck_id || "TRK-01"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-slate-400 block text-[10px]">GPS:</span>
              <span className={`font-mono font-bold flex items-center gap-1.5 ${gpsStatus === "GPS_ACTIVE" ? "text-emerald-400" : "text-amber-400"}`}>
                <span className={`w-2 h-2 rounded-full ${gpsStatus === "GPS_ACTIVE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                {gpsStatus === "GPS_ACTIVE" ? "ACTIVE" : "STANDBY"}
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="py-1 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOGOUT</span>
            </button>
          )}
        </div>

        {/* Driver selector dropdown (Prototype Identity Switcher) */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Driver Profile:</span>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DRV-01">Marcus Vance — Alpha Van 01 (North)</option>
              <option value="DRV-02">Elena Rostova — Beta Van 02 (Central)</option>
              <option value="DRV-03">Darnell Washington — Gamma Van 03 (South)</option>
            </select>
          </div>

          {/* Real-Time GPS Status Badge */}
          <div className="flex items-center gap-2">
            {gpsStatus === "GPS_ACTIVE" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE GPS ACTIVE
              </span>
            )}
            {gpsStatus === "GPS_CONNECTING" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                GPS CONNECTING...
              </span>
            )}
            {gpsStatus === "GPS_STALE" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-orange-400" />
                GPS STALE ({lastUpdatedSec}s)
              </span>
            )}
            {gpsStatus === "PERMISSION_DENIED" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                <X className="w-3 h-3 text-rose-400" />
                PERMISSION DENIED
              </span>
            )}
            {gpsStatus === "SIMULATED" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-blue-400" />
                SIMULATED PING
              </span>
            )}
            {gpsStatus === "GPS_OFF" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                GPS OFF
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Primary GPS Hardware Control Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Signal className="w-4 h-4 text-blue-400" />
          <span>Vehicle GPS Hardware Telemetry</span>
        </h2>

        {/* Telemetry Readout Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Latitude</span>
            <span className="text-sm font-black text-slate-100 font-mono block mt-1">
              {coords.latitude !== null ? coords.latitude.toFixed(5) : assignedTruck.latitude.toFixed(5)}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Longitude</span>
            <span className="text-sm font-black text-slate-100 font-mono block mt-1">
              {coords.longitude !== null ? coords.longitude.toFixed(5) : assignedTruck.longitude.toFixed(5)}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Speed</span>
            <span className="text-sm font-black text-cyan-300 font-mono block mt-1">
              {coords.speed !== null ? `${coords.speed} km/h` : `${assignedTruck.speed_kmh || 0} km/h`}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Accuracy</span>
            <span className="text-sm font-black text-emerald-400 font-mono block mt-1">
              {coords.accuracy !== null ? `±${Math.round(coords.accuracy)}m` : `±${assignedTruck.gps_accuracy_m || 10}m`}
            </span>
          </div>
        </div>

        {/* Big Touch-Friendly Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {gpsStatus !== "GPS_ACTIVE" ? (
            <button
              onClick={handleStartTracking}
              className="py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-base flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/40 active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>START LIVE GPS TRACKING</span>
            </button>
          ) : (
            <button
              onClick={handleStopTracking}
              className="py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-base flex items-center justify-center gap-2 transition shadow-lg shadow-rose-900/40 active:scale-95 cursor-pointer"
            >
              <Square className="w-5 h-5 fill-white" />
              <span>STOP GPS TRACKING</span>
            </button>
          )}

          <button
            onClick={handleSimulatePosition}
            className="py-4 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition border border-slate-700 active:scale-95 cursor-pointer"
            title="Simulate a single vehicle coordinate movement without walking outside"
          >
            <Compass className="w-5 h-5 text-blue-400" />
            <span>SIMULATE DRIVER MOVEMENT</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          *Phone GPS runs via browser Geolocation API. Active screen tracking streams live telemetry to dispatcher and customer in real time.
        </p>
      </div>

      {/* Active Baton Pass Swarm Alert (if any package was relayed) */}
      {driverDeliveries.some((d) => d.baton_pass) && (
        <div className="bg-purple-950/50 border border-purple-500/40 rounded-3xl p-5 shadow-xl flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-purple-200">Baton Pass Rendezvous Waypoint Active</h3>
            <p className="text-xs text-purple-300/80 mt-1 leading-relaxed">
              Dispatch assigned a cooperative multi-vehicle handoff. Proceed to curbside commercial staging bay to complete barcode transfer.
            </p>
          </div>
        </div>
      )}

      {/* Next Up Delivery Card */}
      {currentStop && (
        <div className="bg-slate-900 border-2 border-blue-500/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              CURRENT STOP #{currentStop.optimized_sequence || 1}
            </span>
            <span className="text-xs font-mono font-bold text-slate-300">ETA {currentStop.estimated_arrival_time}</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{currentStop.recipient}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{currentStop.address}</span>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg text-xs font-bold font-mono bg-slate-800 text-slate-200">
                {currentStop.delivery_id}
              </span>
            </div>

            {/* Building & Access notes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Property Type</span>
                <span className="font-semibold text-slate-200 mt-0.5 block truncate">
                  {currentStop.building_metadata?.property_label || "Commercial"}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Floor / Access</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">
                  {currentStop.floor_level ? `${currentStop.floor_level}th Floor` : "Ground Level"}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Cargo Weight</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{currentStop.weight_kg} kg</span>
              </div>
            </div>

            {/* Customer Access Notes */}
            {currentStop.building_metadata?.access_notes && (
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200 mt-1">
                <strong>Access Instructions:</strong> {currentStop.building_metadata.access_notes}
              </div>
            )}

            {/* Action Buttons for Current Stop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => handleMarkArrived(currentStop.delivery_id)}
                disabled={isMarkingArrived === currentStop.delivery_id}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>{isMarkingArrived === currentStop.delivery_id ? "Updating..." : "1. ARRIVED AT CURB"}</span>
              </button>

              <button
                onClick={() => {
                  setOtpModalDelivery(currentStop);
                  setOtpInput("");
                  setOtpError(null);
                }}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-900/30"
              >
                <KeyRound className="w-4 h-4" />
                <span>2. VERIFY CUSTOMER OTP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">Assigned Route Manifest ({driverDeliveries.length})</h3>
          </div>
          <span className="text-xs text-slate-400">
            {pendingDeliveries.length} remaining • {completedDeliveries.length} completed
          </span>
        </div>

        <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1 divide-y divide-slate-800/60">
          {driverDeliveries.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No deliveries assigned to {assignedTruck.name} yet.
            </div>
          ) : (
            driverDeliveries.map((deliv, idx) => {
              const isDelivered = deliv.status === "delivered";
              return (
                <div key={deliv.delivery_id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isDelivered
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {isDelivered ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-200">{deliv.recipient}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold">{deliv.delivery_id}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{deliv.address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDelivered ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        DELIVERED
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setOtpModalDelivery(deliv);
                          setOtpInput("");
                          setOtpError(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>OTP</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* OTP Verification Modal */}
      {otpModalDelivery && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm">Verify Delivery OTP</h3>
              </div>
              <button
                onClick={() => setOtpModalDelivery(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-300 font-semibold">{otpModalDelivery.recipient}</p>
              <p className="text-[11px] text-slate-400">{otpModalDelivery.address}</p>
              <p className="text-xs text-slate-400 mt-2">
                Ask the customer for the 6-digit confirmation code shown on their tracking screen.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                maxLength={6}
                autoFocus
                placeholder="Enter 6-digit OTP..."
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/\D/g, ""));
                  setOtpError(null);
                }}
                className="w-full text-center tracking-widest text-2xl font-black py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              {otpError && <p className="text-xs text-rose-400 font-medium text-center">{otpError}</p>}
            </div>

            {/* Prototype helper hint for easy demonstration */}
            {otpModalDelivery.delivery_otp && (
              <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                Demo Hint: Customer's OTP is{" "}
                <strong className="text-emerald-400 font-mono">{otpModalDelivery.delivery_otp}</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setOtpModalDelivery(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otpInput.length < 4}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-900/40 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isVerifyingOtp ? "Verifying..." : "Confirm Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
