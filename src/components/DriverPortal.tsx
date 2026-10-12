import React, { useState, useEffect, useRef } from "react";
import { Truck, Delivery, Driver, AuthUser, TrafficPrediction, ColdChainCertificate } from "../types";
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
  TrendingUp,
  ShieldAlert,
  ExternalLink,
  Award,
  Search,
  Filter,
  Navigation2,
  PhoneCall,
  CheckSquare,
  Layers,
  ArrowUpRight,
  Shield,
  LocateFixed,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { DriverVoiceCopilot } from "./DriverVoiceCopilot";
import { ColdChainCertificateModal } from "./ColdChainCertificateModal";

// Custom Leaflet map pins for driver turn-by-turn navigation view
const driverVanIcon = L.divIcon({
  className: "custom-driver-van-pin",
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
      <div style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.4);" class="rendezvous-ping"></div>
      <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(37, 99, 235, 0.8); border: 2.5px solid #ffffff; z-index: 10;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
});

const driverStopIcon = L.divIcon({
  className: "custom-driver-dest-pin",
  html: `
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(16, 185, 129, 0.7); border: 2.5px solid #ffffff;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// Helper component to smoothly center Leaflet map when coordinates change
const MapRecenter: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom(), { animate: true });
  }, [center, zoom, map]);
  return null;
};

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
  const [trafficPrediction, setTrafficPrediction] = useState<TrafficPrediction | null>(null);

  // Cold Chain Certificate Inspection Modal state
  const [selectedCert, setSelectedCert] = useState<ColdChainCertificate | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState<boolean>(false);
  const [loadingCertId, setLoadingCertId] = useState<string | null>(null);

  // Manifest Filter & Search state
  const [manifestFilter, setManifestFilter] = useState<"ALL" | "PENDING" | "DELIVERED" | "COLD_CHAIN">("ALL");
  const [manifestSearch, setManifestSearch] = useState<string>("");

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

  const assignedTruck = trucks.find((t) => t.truck_id === activeDriver.assigned_truck_id) || trucks[0] || {
    truck_id: "TRK-01",
    name: "Alpha Van 01",
    driver: "Marcus Vance",
    latitude: 37.7749,
    longitude: -122.4194,
    status: "in_transit",
    current_traffic_delay_min: 0,
    fuel_level_pct: 82,
    capacity_kg: 850,
    current_load_kg: 320,
    total_packages: 6,
    speed_kmh: 32,
  };

  // Predictive Traffic Risk Effect
  useEffect(() => {
    if (!assignedTruck?.truck_id) return;
    fetch(`/api/traffic/prediction?truck_id=${assignedTruck.truck_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.prediction) {
          setTrafficPrediction(data.prediction);
        }
      })
      .catch(() => {});
  }, [assignedTruck?.truck_id, assignedTruck?.current_traffic_delay_min, deliveries]);

  // Deliveries for this driver's truck
  const driverDeliveries = deliveries
    .filter((d) => d.assigned_truck_id === assignedTruck?.truck_id)
    .sort((a, b) => (a.optimized_sequence || 0) - (b.optimized_sequence || 0));

  const pendingDeliveries = driverDeliveries.filter((d) => d.status !== "delivered");
  const completedDeliveries = driverDeliveries.filter((d) => d.status === "delivered");
  const currentStop = pendingDeliveries[0] || null;

  // Shift & Manifest metrics
  const totalWeightKg = driverDeliveries.reduce((sum, d) => sum + (d.weight_kg || 0), 0);
  const pendingWeightKg = pendingDeliveries.reduce((sum, d) => sum + (d.weight_kg || 0), 0);
  const coldChainDeliveries = driverDeliveries.filter((d) => d.is_perishable || d.perishable_category);
  const completionRatePct = driverDeliveries.length > 0
    ? Math.round((completedDeliveries.length / driverDeliveries.length) * 100)
    : 0;

  // Filtered deliveries for manifest
  const filteredDeliveries = driverDeliveries.filter((deliv) => {
    if (manifestFilter === "PENDING" && deliv.status === "delivered") return false;
    if (manifestFilter === "DELIVERED" && deliv.status !== "delivered") return false;
    if (manifestFilter === "COLD_CHAIN" && !deliv.is_perishable && !deliv.perishable_category) return false;

    if (manifestSearch.trim()) {
      const q = manifestSearch.toLowerCase();
      const matchRecipient = deliv.recipient.toLowerCase().includes(q);
      const matchId = deliv.delivery_id.toLowerCase().includes(q);
      const matchAddress = deliv.address.toLowerCase().includes(q);
      if (!matchRecipient && !matchId && !matchAddress) return false;
    }
    return true;
  });

  // Active Vehicle Coordinates for Map
  const truckLat = coords.latitude !== null ? coords.latitude : assignedTruck.latitude;
  const truckLng = coords.longitude !== null ? coords.longitude : assignedTruck.longitude;

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

    fetch(`/api/trucks/${assignedTruck.truck_id}/tracking/start`, { method: "POST" }).catch(() => {});

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        const now = Date.now();

        setCoords({
          latitude,
          longitude,
          accuracy,
          speed: speed ? Math.round(speed * 3.6) : 0,
          heading: heading || 0,
          timestamp: now,
        });

        setGpsStatus("GPS_ACTIVE");
        setLastUpdatedSec(0);

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

  // OPEN CRYPTOGRAPHIC COLD-CHAIN CERTIFICATE
  const handleOpenCertificate = async (deliveryId: string) => {
    setLoadingCertId(deliveryId);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/cold-chain-certificate`);
      const data = await res.json();
      if (data.certificate) {
        setSelectedCert(data.certificate);
        setIsCertModalOpen(true);
      } else {
        showToast("No cold-chain certificate generated for this standard delivery.");
      }
    } catch (err: any) {
      showToast("Error loading certificate: " + err.message);
    } finally {
      setLoadingCertId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto pb-24 px-2 sm:px-4">
      {/* Top Mobile Driver Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-blue-400 uppercase">Driver Cockpit Portal</span>
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

        {/* Driver Header Status Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-400 block text-[10px]">Driver:</span>
              <strong className="text-white font-bold">{currentUser?.name || activeDriver.name}</strong>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-slate-400 block text-[10px]">Vehicle:</span>
              <span className="font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {currentUser?.assignedVehicleId || assignedTruck?.truck_id || "TRK-01"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-slate-400 block text-[10px]">GPS Beacon:</span>
              <span className={`font-mono font-bold flex items-center gap-1.5 ${gpsStatus === "GPS_ACTIVE" ? "text-emerald-400" : "text-amber-400"}`}>
                <span className={`w-2 h-2 rounded-full ${gpsStatus === "GPS_ACTIVE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                {gpsStatus === "GPS_ACTIVE" ? "STREAMING" : "STANDBY"}
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

        {/* Driver Selector & GPS status pill */}
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

      {/* SHIFT PROGRESS & PAYLOAD CAPACITY HUD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">Shift Progress & Manifest HUD</h2>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            {completionRatePct}% Completed
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${completionRatePct}%` }}
          />
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Stops Finished</span>
            <span className="text-base font-black text-slate-100 font-mono mt-0.5">
              {completedDeliveries.length} / {driverDeliveries.length}
            </span>
            <span className="text-[10px] text-emerald-400 mt-0.5">{pendingDeliveries.length} Pending</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Onboard Weight</span>
            <span className="text-base font-black text-cyan-300 font-mono mt-0.5">
              {pendingWeightKg} kg
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Max {assignedTruck.capacity_kg} kg</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Cold-Chain Units</span>
            <span className="text-base font-black text-sky-400 font-mono mt-0.5 flex items-center gap-1">
              <Snowflake className="w-3.5 h-3.5" />
              {coldChainDeliveries.length}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">IoT Audited</span>
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

        {/* Predictive AI Traffic Occurrence Possibility */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-inner">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={`w-4 h-4 ${
                  (trafficPrediction?.congestionProbabilityPct || 18) >= 80
                    ? "text-rose-400 animate-pulse"
                    : (trafficPrediction?.congestionProbabilityPct || 18) >= 60
                    ? "text-orange-400"
                    : (trafficPrediction?.congestionProbabilityPct || 18) >= 35
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              />
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                Predictive Traffic Risk
              </span>
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">• Lookahead: 20m</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Occurrence Possibility:</span>
              <span
                className={`text-base font-black font-mono ${
                  (trafficPrediction?.congestionProbabilityPct || 18) >= 80
                    ? "text-rose-400 animate-pulse"
                    : (trafficPrediction?.congestionProbabilityPct || 18) >= 60
                    ? "text-orange-400"
                    : (trafficPrediction?.congestionProbabilityPct || 18) >= 35
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {trafficPrediction?.congestionProbabilityPct ?? 18}%
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  (trafficPrediction?.congestionProbabilityPct || 18) >= 80
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : (trafficPrediction?.congestionProbabilityPct || 18) >= 60
                    ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                    : (trafficPrediction?.congestionProbabilityPct || 18) >= 35
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {trafficPrediction?.riskTier ?? "LOW RISK"}
              </span>
            </div>
          </div>

          {/* Probability Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                (trafficPrediction?.congestionProbabilityPct || 18) >= 80
                  ? "bg-rose-500"
                  : (trafficPrediction?.congestionProbabilityPct || 18) >= 60
                  ? "bg-orange-500"
                  : (trafficPrediction?.congestionProbabilityPct || 18) >= 35
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${trafficPrediction?.congestionProbabilityPct ?? 18}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400 pt-1">
            <span className="truncate">{trafficPrediction?.advisory || "Corridor flow nominal. No major bottlenecks predicted."}</span>
            {trafficPrediction && trafficPrediction.predictedShockwaveDelayMin > 5 && (
              <span className="font-mono text-rose-300 text-[10px] shrink-0 font-bold">
                +{trafficPrediction.predictedShockwaveDelayMin}m Shockwave Delay
              </span>
            )}
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
            title="Simulate vehicle coordinate movement along route"
          >
            <Compass className="w-5 h-5 text-blue-400" />
            <span>SIMULATE DRIVER MOVEMENT</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          *Phone GPS runs via browser Geolocation API. Active screen tracking streams live telemetry to dispatcher and customer in real time.
        </p>
      </div>

      {/* INTERACTIVE TURN-BY-TURN LEAFLET GPS MAP */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Live Turn-by-Turn GPS Map
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Vehicle
            </span>
            {currentStop && (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Stop #{currentStop.optimized_sequence || 1}
              </span>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="h-64 sm:h-80 w-full rounded-2xl overflow-hidden border border-slate-800 relative shadow-inner">
          <MapContainer
            center={[truckLat, truckLng]}
            zoom={14}
            scrollWheelZoom={false}
            className="w-full h-full z-0"
          >
            <MapRecenter center={[truckLat, truckLng]} />
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            {/* Vehicle Marker */}
            <Marker position={[truckLat, truckLng]} icon={driverVanIcon}>
              <Popup className="font-sans text-xs">
                <div className="p-1">
                  <div className="font-bold text-slate-900">{assignedTruck.name} ({assignedTruck.truck_id})</div>
                  <div className="text-slate-600">Driver: {activeDriver.name}</div>
                  <div className="text-blue-600 font-semibold mt-1">
                    Speed: {coords.speed !== null ? coords.speed : assignedTruck.speed_kmh || 0} km/h
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Next Destination Stop Marker */}
            {currentStop && (
              <Marker position={[currentStop.latitude, currentStop.longitude]} icon={driverStopIcon}>
                <Popup className="font-sans text-xs">
                  <div className="p-1">
                    <div className="font-bold text-emerald-800">Next: {currentStop.recipient}</div>
                    <div className="text-slate-600">{currentStop.address}</div>
                    <div className="text-slate-800 font-semibold mt-1">
                      ETA: {currentStop.estimated_arrival_time} • {currentStop.weight_kg}kg
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Turn-by-Turn Waypoint Polyline connecting vehicle to next delivery */}
            {currentStop && (
              <Polyline
                positions={[
                  [truckLat, truckLng],
                  [currentStop.latitude, currentStop.longitude],
                ]}
                color="#2563eb"
                weight={5}
                opacity={0.8}
                dashArray="8, 8"
              />
            )}
          </MapContainer>

          {/* Map Overlay Badge */}
          <div className="absolute top-3 right-3 z-[1000] bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-slate-200 font-bold">
              {currentStop ? `Heading to Stop #${currentStop.optimized_sequence || 1}` : "Route Finished"}
            </span>
          </div>
        </div>
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

      {/* Requirement: Hands-Free AI Voice Copilot for Commercial Drivers */}
      <DriverVoiceCopilot
        activeDriver={activeDriver}
        assignedTruck={assignedTruck}
        driverDeliveries={driverDeliveries}
        currentStop={currentStop}
        showToast={showToast}
      />

      {/* CURRENT STOP CARD WITH DETAILED VERTICAL DWELL & WATCHMAN GATE BREAKDOWN */}
      {currentStop && (
        <div className="bg-slate-900 border-2 border-blue-500/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              CURRENT STOP #{currentStop.optimized_sequence || 1}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-300">ETA {currentStop.estimated_arrival_time}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                currentStop.urgency === "CRITICAL"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : currentStop.urgency === "HIGH"
                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/40"
              }`}>
                {currentStop.urgency}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{currentStop.recipient}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{currentStop.address}</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-slate-800 text-slate-200 border border-slate-700">
                {currentStop.delivery_id}
              </span>
            </div>

            {/* Quick Contact & External GPS Navigation Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${currentStop.latitude},${currentStop.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
              </a>

              <a
                href={`tel:${currentStop.customer_phone || "+14155550199"}`}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call Recipient</span>
              </a>

              {(currentStop.is_perishable || currentStop.perishable_category) && (
                <button
                  type="button"
                  onClick={() => handleOpenCertificate(currentStop.delivery_id)}
                  disabled={loadingCertId === currentStop.delivery_id}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-sky-400" />
                  <span>{loadingCertId === currentStop.delivery_id ? "Loading Cert..." : "View Cold-Chain Cert"}</span>
                </button>
              )}
            </div>

            {/* Building & Access specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Property Type</span>
                <span className="font-semibold text-slate-200 mt-0.5 block truncate">
                  {currentStop.building_metadata?.property_label || currentStop.property_type?.replace(/_/g, " ") || "Commercial High-Rise"}
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

            {/* DETAILED VERTICAL DWELL & WATCHMAN SECURITY CHECKPOINT BREAKDOWN */}
            <div className="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-3.5 flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Vertical Dwell Friction & Security Protocol
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  +{((currentStop.dwell_friction_minutes || currentStop.building_metadata?.dwell_friction_minutes || (currentStop.floor_level ? 9.5 : 2.0))).toFixed(1)}m dwell
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                {/* Watchman Protocol */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">Security Gate & Watchman</span>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                      +3.5m checkpoint: Visitor badge check-in, parking gate validation, and entry logbook required.
                    </p>
                  </div>
                </div>

                {/* Vertical Elevation & Floor Transit */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                  <Layers className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">Vertical Transit / Stairs</span>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                      {currentStop.floor_level && currentStop.floor_level > 0
                        ? `Floor ${currentStop.floor_level} • Elevator wait: 6.0m • Floor transit: ${(currentStop.floor_level * 0.18).toFixed(1)}m`
                        : "Ground level ingress • Direct curb-to-door (0.5m dwell)"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Access Notes */}
              {currentStop.building_metadata?.access_notes && (
                <div className="p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200 mt-1">
                  <strong>Access Instructions:</strong> {currentStop.building_metadata.access_notes}
                </div>
              )}
            </div>

            {/* Action Buttons for Current Stop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => handleMarkArrived(currentStop.delivery_id)}
                disabled={isMarkingArrived === currentStop.delivery_id}
                className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
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
                className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-900/30 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>2. VERIFY CUSTOMER OTP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNED ROUTE MANIFEST QUEUE WITH SEARCH, FILTER & CERTIFICATE INSPECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">Assigned Route Manifest ({driverDeliveries.length})</h3>
          </div>
          <span className="text-xs text-slate-400">
            {pendingDeliveries.length} remaining • {completedDeliveries.length} completed
          </span>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipient, address or delivery ID..."
              value={manifestSearch}
              onChange={(e) => setManifestSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setManifestFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                manifestFilter === "ALL"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({driverDeliveries.length})
            </button>

            <button
              onClick={() => setManifestFilter("PENDING")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                manifestFilter === "PENDING"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Pending ({pendingDeliveries.length})
            </button>

            <button
              onClick={() => setManifestFilter("DELIVERED")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                manifestFilter === "DELIVERED"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Done ({completedDeliveries.length})
            </button>

            <button
              onClick={() => setManifestFilter("COLD_CHAIN")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                manifestFilter === "COLD_CHAIN"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Snowflake className="w-3 h-3" />
              Cold ({coldChainDeliveries.length})
            </button>
          </div>
        </div>

        {/* Deliveries List */}
        <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1 divide-y divide-slate-800/60 mt-1">
          {filteredDeliveries.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching deliveries found in manifest.
            </div>
          ) : (
            filteredDeliveries.map((deliv, idx) => {
              const isDelivered = deliv.status === "delivered";
              const isColdChain = deliv.is_perishable || deliv.perishable_category;

              return (
                <div key={deliv.delivery_id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isDelivered
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {isDelivered ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-200">{deliv.recipient}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold">{deliv.delivery_id}</span>
                        {isColdChain && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                            <Snowflake className="w-2.5 h-2.5" />
                            {deliv.perishable_category || "Cold"}
                          </span>
                        )}
                        {deliv.floor_level ? (
                          <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                            Fl {deliv.floor_level}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{deliv.address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* If cold-chain certified, show cryptographic audit inspection button */}
                    {isColdChain && (
                      <button
                        type="button"
                        onClick={() => handleOpenCertificate(deliv.delivery_id)}
                        disabled={loadingCertId === deliv.delivery_id}
                        title="View Cryptographic Cold-Chain Audit Certificate"
                        className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs transition cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5" />
                      </button>
                    )}

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
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
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
                className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-300 font-semibold">{otpModalDelivery.recipient}</p>
              <p className="text-[11px] text-slate-400">{otpModalDelivery.address}</p>
              <p className="text-xs text-slate-400 mt-2">
                Ask customer for the 6-digit confirmation code shown on their tracking screen.
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
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otpInput.length < 4}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-900/40 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isVerifyingOtp ? "Verifying..." : "Confirm Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cryptographic Cold-Chain Certificate Modal */}
      <ColdChainCertificateModal
        certificate={selectedCert}
        isOpen={isCertModalOpen}
        onClose={() => {
          setIsCertModalOpen(false);
          setSelectedCert(null);
        }}
        showToast={showToast}
      />
    </div>
  );
};
