import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Delivery, Truck, BatonPassRelay } from "../types";
import { MapPin, Navigation, Package, Clock, AlertTriangle, ShieldCheck, Fuel, Zap, ArrowRight, Building2 } from "lucide-react";

interface FleetMapProps {
  deliveries: Delivery[];
  trucks: Truck[];
  selectedTruckId: string;
  depot: { latitude: number; longitude: number; name: string };
  activeBatonRelay?: BatonPassRelay | null;
  onSelectDelivery?: (delivery: Delivery) => void;
  onReassignRequest?: (delivery: Delivery) => void;
  onExecuteBatonPass?: (relay: BatonPassRelay) => void;
}

// Map recenter helper
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13, { duration: 1.2 });
  }, [center, map]);
  return null;
}

// Color palette for trucks and routes
const TRUCK_COLORS: Record<string, string> = {
  "TRK-01": "#38bdf8", // Sky blue (North corridor)
  "TRK-02": "#34d399", // Emerald green (Central corridor)
  "TRK-03": "#c084fc", // Purple (South-East corridor)
};

// Urgency color helper
function getUrgencyBadgeColor(urgency: string): { bg: string; text: string; border: string } {
  switch (urgency) {
    case "CRITICAL":
      return { bg: "#e11d48", text: "#ffffff", border: "#f43f5e" };
    case "HIGH":
      return { bg: "#f59e0b", text: "#111827", border: "#fbbf24" };
    case "MEDIUM":
      return { bg: "#3b82f6", text: "#ffffff", border: "#60a5fa" };
    default:
      return { bg: "#64748b", text: "#ffffff", border: "#94a3b8" };
  }
}

// Create custom SVG Leaflet DivIcon for Delivery Stop
function createDeliveryStopIcon(delivery: Delivery) {
  const urgencyColor = getUrgencyBadgeColor(delivery.urgency);
  const isDelayed = delivery.is_delayed;
  const isCritical = delivery.urgency === "CRITICAL";

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
      ${
        isCritical || isDelayed
          ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: ${
              isDelayed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(244, 63, 94, 0.3)'
            };" class="pulse-critical"></div>`
          : ""
      }
      <div style="
        width: 30px; 
        height: 30px; 
        border-radius: 9999px; 
        background: ${urgencyColor.bg}; 
        color: ${urgencyColor.text}; 
        border: 2px solid ${isDelayed ? '#ef4444' : urgencyColor.border}; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        display: flex; 
        flex-direction: column;
        align-items: center; 
        justify-content: center;
        font-weight: 700;
        font-size: 12px;
      ">
        <span>${delivery.optimized_sequence || delivery.original_sequence}</span>
      </div>
      ${
        isDelayed
          ? `<div style="position: absolute; top: -3px; right: -3px; width: 12px; height: 12px; border-radius: 9999px; background: #ef4444; border: 2px solid #111827;"></div>`
          : ""
      }
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-delivery-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// Determine GPS state: LIVE GPS vs SIMULATED vs GPS STALE
export function getTruckGpsState(truck: Truck): {
  label: string;
  isLive: boolean;
  isStale: boolean;
  isSimulated: boolean;
  timeAgoText: string;
} {
  const isLive = truck.tracking_mode === "LIVE" && Boolean(truck.tracking_active);
  let isStale = false;
  let timeAgoText = "Simulated";

  if (truck.last_location_at) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(truck.last_location_at).getTime()) / 1000));
    if (elapsedSec < 5) {
      timeAgoText = "Just now";
    } else if (elapsedSec < 60) {
      timeAgoText = `${elapsedSec}s ago`;
    } else {
      timeAgoText = `${Math.floor(elapsedSec / 60)}m ago`;
    }
    if (isLive && elapsedSec > 25) {
      isStale = true;
    }
  }

  if (isLive) {
    if (isStale) {
      return { label: "GPS STALE", isLive: false, isStale: true, isSimulated: false, timeAgoText };
    }
    return { label: "LIVE GPS ●", isLive: true, isStale: false, isSimulated: false, timeAgoText };
  }

  return { label: "SIMULATED", isLive: false, isStale: false, isSimulated: true, timeAgoText };
}

// Create custom SVG Icon for Delivery Truck
function createTruckMarkerIcon(truck: Truck) {
  const color = TRUCK_COLORS[truck.truck_id] || "#38bdf8";
  const isDelayed = truck.current_traffic_delay_min > 0;
  const gpsState = getTruckGpsState(truck);

  const badgeHtml = gpsState.isLive
    ? `<div style="position: absolute; top: -14px; background: #064e3b; color: #34d399; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid #059669; white-space: nowrap; display: flex; align-items: center; gap: 3px; box-shadow: 0 2px 6px rgba(0,0,0,0.5);"><span style="display:inline-block; width:5px; height:5px; border-radius:99px; background:#34d399; box-shadow:0 0 6px #34d399;"></span>LIVE GPS</div>`
    : gpsState.isStale
    ? `<div style="position: absolute; top: -14px; background: #451a03; color: #fbbf24; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid #d97706; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">GPS STALE</div>`
    : `<div style="position: absolute; top: -14px; background: #0f172a; color: #94a3b8; font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 4px; border: 1px solid #334155; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">SIMULATED</div>`;

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px;">
      ${badgeHtml}
      ${
        gpsState.isLive
          ? `<div style="position: absolute; width: 54px; height: 54px; border-radius: 12px; background-color: rgba(52, 211, 153, 0.25);" class="rendezvous-ping"></div>`
          : isDelayed
          ? `<div style="position: absolute; width: 56px; height: 56px; border-radius: 12px; background-color: rgba(239, 68, 68, 0.35);" class="pulse-critical"></div>`
          : ""
      }
      <div style="
        width: 40px; 
        height: 40px; 
        border-radius: 10px; 
        background: #1e293b; 
        border: 2px solid ${gpsState.isLive ? '#34d399' : color}; 
        box-shadow: 0 6px 14px rgba(0,0,0,0.6);
        display: flex; 
        flex-direction: column;
        align-items: center; 
        justify-content: center;
        color: ${gpsState.isLive ? '#34d399' : color};
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
        <span style="font-size: 8px; font-weight: 800; color: #f8fafc; margin-top: -2px;">${truck.truck_id}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-truck-marker",
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -24],
  });
}

// Create custom Depot Marker Icon
function createDepotMarkerIcon() {
  const html = `
    <div style="
      width: 44px; 
      height: 44px; 
      border-radius: 12px; 
      background: #0f172a; 
      border: 2px solid #f59e0b; 
      box-shadow: 0 6px 18px rgba(245, 158, 11, 0.4);
      display: flex; 
      flex-direction: column;
      align-items: center; 
      justify-content: center;
      color: #fbbf24;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <span style="font-size: 7px; font-weight: 900; color: #fbbf24; margin-top: -2px;">DEPOT</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-depot-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

// Create animated Rendezvous Hub icon for "The Baton Pass"
function createRendezvousHubIcon(relay: BatonPassRelay) {
  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 72px; height: 72px;">
      <!-- Outer Concentric Glowing Animated Ripple Ring -->
      <div style="
        position: absolute; 
        width: 68px; 
        height: 68px; 
        border-radius: 9999px; 
        background-color: rgba(6, 182, 212, 0.35);
        border: 2px solid #22d3ee;
      " class="rendezvous-ping"></div>

      <!-- Inner Alert Ripple Ring -->
      <div style="
        position: absolute; 
        width: 50px; 
        height: 50px; 
        border-radius: 9999px; 
        background-color: rgba(245, 158, 11, 0.3);
        border: 2px solid #fbbf24;
      " class="pulse-critical"></div>

      <!-- Hexagonal / Shield Center Pin with Baton Label & ETA -->
      <div class="baton-glow-box" style="
        position: relative;
        width: 44px; 
        height: 44px; 
        border-radius: 14px; 
        background: linear-gradient(135deg, #083344 0%, #1e1b4b 100%); 
        border: 2px solid #38bdf8; 
        display: flex; 
        flex-direction: column;
        align-items: center; 
        justify-content: center;
        color: #67e8f9;
        z-index: 10;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 11l4-4-4-4"/>
          <path d="M21 7H9a4 4 0 0 0-4 4v2"/>
          <path d="M7 13l-4 4 4 4"/>
          <path d="M3 17h12a4 4 0 0 0 4-4v-2"/>
        </svg>
        <span style="font-size: 7.5px; font-weight: 900; color: #fef08a; letter-spacing: -0.2px; margin-top: -1px;">
          ${relay.handoff_details.synchronized_time}
        </span>
      </div>

      <!-- Floating Badge: Window Handoff -->
      <div style="
        position: absolute;
        bottom: -2px;
        background: #0f172a;
        border: 1px solid #38bdf8;
        color: #38bdf8;
        font-size: 8px;
        font-weight: 800;
        padding: 1px 5px;
        border-radius: 6px;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,0.6);
        z-index: 15;
      ">
        RELAY PIN
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-rendezvous-marker",
    iconSize: [72, 72],
    iconAnchor: [36, 36],
    popupAnchor: [0, -36],
  });
}

// Create destination beacon marker icon for the rescued package
function createBatonDestinationIcon(relay: BatonPassRelay) {
  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
      <div style="
        position: absolute; 
        width: 44px; 
        height: 44px; 
        border-radius: 9999px; 
        background-color: rgba(16, 185, 129, 0.4);
        border: 2px solid #34d399;
      " class="pulse-critical"></div>
      <div style="
        position: relative;
        width: 32px; 
        height: 32px; 
        border-radius: 9999px; 
        background: #022c22; 
        border: 2px solid #10b981; 
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.9);
        display: flex; 
        flex-direction: column;
        align-items: center; 
        justify-content: center;
        color: #a7f3d0;
        z-index: 10;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-baton-dest-marker",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
}

export const FleetMap: React.FC<FleetMapProps> = ({
  deliveries,
  trucks,
  selectedTruckId,
  depot,
  activeBatonRelay,
  onReassignRequest,
  onExecuteBatonPass,
}) => {
  const defaultCenter: [number, number] = activeBatonRelay
    ? [activeBatonRelay.rendezvous_hub.latitude, activeBatonRelay.rendezvous_hub.longitude]
    : [depot.latitude, depot.longitude];

  // Filter deliveries by selected truck
  const filteredDeliveries =
    selectedTruckId === "ALL"
      ? deliveries
      : deliveries.filter((d) => d.assigned_truck_id === selectedTruckId);

  // Filter trucks
  const visibleTrucks =
    selectedTruckId === "ALL"
      ? trucks
      : trucks.filter((t) => t.truck_id === selectedTruckId);

  // Group deliveries into ordered route polylines
  const truckRoutes = visibleTrucks.map((truck) => {
    const truckStops = deliveries
      .filter((d) => d.assigned_truck_id === truck.truck_id)
      .sort((a, b) => a.optimized_sequence - b.optimized_sequence);

    // Route coordinates: Truck Current Pos -> Stop 1 -> Stop 2 -> ... -> Depot Return
    const positions: [number, number][] = [
      [truck.latitude, truck.longitude],
      ...truckStops.map((s) => [s.latitude, s.longitude] as [number, number]),
      [depot.latitude, depot.longitude],
    ];

    return {
      truckId: truck.truck_id,
      color: TRUCK_COLORS[truck.truck_id] || "#38bdf8",
      positions,
    };
  });

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      {/* Map Header Overlay */}
      <div className="absolute top-4 left-4 z-[500] flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700/80 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-semibold text-slate-200">Open-Source Leaflet GIS</span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-100">{filteredDeliveries.length}</span> stops
          across <span className="font-semibold text-slate-100">{visibleTrucks.length}</span> vehicles
        </span>
      </div>

      {/* The Baton Pass — Active Multi-Vehicle Swarm HUD */}
      {activeBatonRelay && (
        <div className="absolute top-4 right-4 z-[500] max-w-sm hidden sm:flex flex-col gap-1.5 bg-gradient-to-r from-slate-950/95 via-cyan-950/90 to-slate-950/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-cyan-500/50 shadow-2xl text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-extrabold text-cyan-200 text-xs truncate">The Baton Pass (Active Swarm)</span>
                <span className="font-mono text-[10px] font-bold text-emerald-400 shrink-0">
                  +{activeBatonRelay.metrics.minutes_saved}m Saved
                </span>
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                <span className="text-amber-400 font-bold">{activeBatonRelay.carrier_truck.truck_id}</span>
                <span className="text-slate-500 mx-1">&rarr;</span>
                <span className="text-cyan-300 font-semibold">{activeBatonRelay.rendezvous_hub.name.split(" ")[0]}</span>
                <span className="text-slate-500 mx-1">&rarr;</span>
                <span className="text-emerald-400 font-bold">{activeBatonRelay.relay_truck.truck_id}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-cyan-900/60 text-[10px] text-slate-400">
            <span>Rendezvous ETA: <strong className="text-slate-200 font-mono">{activeBatonRelay.handoff_details.synchronized_time}</strong></span>
            <span className="text-emerald-400 font-semibold">SLA Window Preserved</span>
          </div>
        </div>
      )}

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[500] hidden md:flex items-center gap-3 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-600 border border-rose-400"></span>
          <span className="text-slate-300 font-medium">Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-300"></span>
          <span className="text-slate-300 font-medium">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-300"></span>
          <span className="text-slate-300 font-medium">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-500 border border-slate-300"></span>
          <span className="text-slate-300 font-medium">Low</span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-rose-400 font-semibold">At-Risk SLA Breach</span>
        </div>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
      >
        <MapRecenter center={defaultCenter} />

        {/* High-Performance Dark Open-Source Map Tiles (CartoDB Dark Matter / Stadia / OSM) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Depot Hub Marker */}
        <Marker
          position={[depot.latitude, depot.longitude]}
          icon={createDepotMarkerIcon()}
        >
          <Popup>
            <div className="text-slate-900 p-1">
              <h4 className="font-bold text-sm text-amber-600 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {depot.name}
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Central Operations Hub & Distribution Yard
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                Lat: {depot.latitude.toFixed(4)}, Lng: {depot.longitude.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Truck Positions */}
        {visibleTrucks.map((truck) => {
          const gpsState = getTruckGpsState(truck);
          return (
            <Marker
              key={truck.truck_id}
              position={[truck.latitude, truck.longitude]}
              icon={createTruckMarkerIcon(truck)}
            >
              <Popup>
                <div className="p-1 min-w-[240px]">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
                    <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                      <Navigation className="w-4 h-4 text-sky-400" />
                      {truck.name}
                    </h4>
                    <span
                      className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                        gpsState.isLive
                          ? "bg-emerald-950 text-emerald-300 border-emerald-600"
                          : gpsState.isStale
                          ? "bg-amber-950 text-amber-300 border-amber-600"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {gpsState.label}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>Driver: <strong className="text-slate-200">{truck.driver}</strong></span>
                    <span className="font-mono text-[10px] text-slate-400">Upd: {gpsState.timeAgoText}</span>
                  </div>

                  <div className="mt-2.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">Speed / Heading:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {truck.speed_kmh != null ? Math.round(truck.speed_kmh) : 0} km/h • {truck.heading_deg != null ? Math.round(truck.heading_deg) : 0}°
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">GPS Accuracy:</span>
                      <span className="font-mono text-emerald-400 text-[11px]">
                        ±{Math.round(truck.gps_accuracy_m || 5)}m
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">Fuel Level:</span>
                      <span className="font-mono text-amber-300 text-[11px]">
                        {truck.fuel_level_pct || 85}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">Payload Load:</span>
                      <span className="font-semibold text-slate-100">
                        {truck.current_load_kg} / {truck.capacity_kg || 500} kg
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">Remaining Stops:</span>
                      <span className="font-semibold text-sky-300">{truck.total_packages} stops</span>
                    </div>

                    {truck.current_traffic_delay_min > 0 && (
                      <div className="flex justify-between items-center text-rose-400 font-semibold pt-1 border-t border-slate-800">
                        <span className="text-[11px]">Corridor Traffic:</span>
                        <span>+{truck.current_traffic_delay_min} min delay</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Planned Route Polylines */}
        {truckRoutes.map((route) => (
          <Polyline
            key={`route-${route.truckId}`}
            positions={route.positions}
            pathOptions={{
              color: route.color,
              weight: 3.5,
              opacity: activeBatonRelay ? 0.35 : 0.8,
              dashArray: "6, 8",
            }}
          />
        ))}

        {/* ============================================================ */}
        {/* "THE BATON PASS" — DYNAMIC MULTI-VEHICLE RELAY VISUALIZATION */}
        {/* Converging animated dotted vectors meeting at Rendezvous Hub */}
        {/* ============================================================ */}
        {activeBatonRelay && (
          <>
            {/* Trajectory Vector 1: Gridlocked Carrier Truck A -> Rendezvous Hub */}
            <Polyline
              positions={
                activeBatonRelay.carrier_truck.trajectory_path && activeBatonRelay.carrier_truck.trajectory_path.length > 0
                  ? activeBatonRelay.carrier_truck.trajectory_path
                  : [
                      [activeBatonRelay.carrier_truck.current_lat, activeBatonRelay.carrier_truck.current_lng],
                      [activeBatonRelay.rendezvous_hub.latitude, activeBatonRelay.rendezvous_hub.longitude],
                    ]
              }
              pathOptions={{
                color: "#f59e0b", // Glowing Amber high-vis dotted line
                weight: 5,
                opacity: 0.95,
                dashArray: "6, 10",
                className: "converging-dash-a",
              }}
            />

            {/* Trajectory Vector 2: Clear Corridor Relay Truck B -> Rendezvous Hub */}
            <Polyline
              positions={
                activeBatonRelay.relay_truck.trajectory_path && activeBatonRelay.relay_truck.trajectory_path.length > 0
                  ? activeBatonRelay.relay_truck.trajectory_path
                  : [
                      [activeBatonRelay.relay_truck.current_lat, activeBatonRelay.relay_truck.current_lng],
                      [activeBatonRelay.rendezvous_hub.latitude, activeBatonRelay.rendezvous_hub.longitude],
                    ]
              }
              pathOptions={{
                color: "#06b6d4", // Electric Cyan high-vis dotted line
                weight: 5,
                opacity: 0.95,
                dashArray: "6, 10",
                className: "converging-dash-b",
              }}
            />

            {/* Post-Handoff Forward Leg: Rendezvous Hub -> Final Customer Delivery */}
            <Polyline
              positions={
                activeBatonRelay.post_handoff_leg.trajectory_path && activeBatonRelay.post_handoff_leg.trajectory_path.length > 0
                  ? activeBatonRelay.post_handoff_leg.trajectory_path
                  : [
                      [activeBatonRelay.rendezvous_hub.latitude, activeBatonRelay.rendezvous_hub.longitude],
                      [activeBatonRelay.post_handoff_leg.destination_lat, activeBatonRelay.post_handoff_leg.destination_lng],
                    ]
              }
              pathOptions={{
                color: "#10b981", // High-vis emerald dotted line
                weight: 5,
                opacity: 0.95,
                dashArray: "6, 6",
                className: "post-handoff-dash",
              }}
            />

            {/* Destination Target Beacon Marker */}
            <Marker
              position={[activeBatonRelay.post_handoff_leg.destination_lat, activeBatonRelay.post_handoff_leg.destination_lng]}
              icon={createBatonDestinationIcon(activeBatonRelay)}
            >
              <Popup>
                <div className="p-1 min-w-[220px]">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs border-b border-slate-700 pb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Guaranteed SLA Delivery Target</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mt-1.5">
                    {activeBatonRelay.recipient} ({activeBatonRelay.delivery_id})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {activeBatonRelay.post_handoff_leg.destination_address}
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-300 font-mono">
                    Projected Arrival: {activeBatonRelay.metrics.relay_projected_arrival} (Deadline: {activeBatonRelay.metrics.sla_deadline})
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Animated Rendezvous Point Marker */}
            <Marker
              position={[activeBatonRelay.rendezvous_hub.latitude, activeBatonRelay.rendezvous_hub.longitude]}
              icon={createRendezvousHubIcon(activeBatonRelay)}
            >
              <Popup>
                <div className="p-2 min-w-[280px]">
                  <div className="flex items-center justify-between border-b border-cyan-800/80 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span className="font-bold text-cyan-200 text-sm">Baton Pass Rendezvous</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                      Spatio-Temporal Sync
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-200 font-semibold">
                    {activeBatonRelay.rendezvous_hub.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {activeBatonRelay.rendezvous_hub.address} ({activeBatonRelay.rendezvous_hub.type})
                  </div>

                  {/* Converging Truck Telemetry in Popup */}
                  <div className="mt-3 p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-rose-300">
                      <span className="font-medium">Gridlocked Carrier ({activeBatonRelay.carrier_truck.truck_id}):</span>
                      <span className="font-mono">ETA {activeBatonRelay.carrier_truck.hub_arrival_time}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-300">
                      <span className="font-medium">Relay Vehicle ({activeBatonRelay.relay_truck.truck_id}):</span>
                      <span className="font-mono">ETA {activeBatonRelay.relay_truck.hub_arrival_time}</span>
                    </div>
                    <div className="flex items-center justify-between text-cyan-300 font-bold pt-1 border-t border-slate-800">
                      <span>Synchronized Handoff:</span>
                      <span className="font-mono">{activeBatonRelay.handoff_details.synchronized_time}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1 text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Package:</span>
                      <span className="font-mono text-slate-100">{activeBatonRelay.delivery_id} ({activeBatonRelay.urgency})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Time Salvaged:</span>
                      <span className="font-bold text-emerald-400">+{activeBatonRelay.metrics.minutes_saved} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Preserves SLA:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        Arrives {activeBatonRelay.metrics.relay_projected_arrival} (Before {activeBatonRelay.metrics.sla_deadline})
                      </span>
                    </div>
                  </div>

                  {onExecuteBatonPass && (
                    <div className="mt-3 pt-2 border-t border-cyan-900/60">
                      <button
                        onClick={() => onExecuteBatonPass(activeBatonRelay)}
                        className="w-full py-1.5 px-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Authorize Window Handoff
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Delivery Stop Markers */}
        {filteredDeliveries.map((delivery) => (
          <Marker
            key={delivery.delivery_id}
            position={[delivery.latitude, delivery.longitude]}
            icon={createDeliveryStopIcon(delivery)}
          >
            <Popup>
              <div className="p-1 min-w-[240px]">
                <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-slate-100 text-sm">{delivery.delivery_id}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: getUrgencyBadgeColor(delivery.urgency).bg,
                      color: getUrgencyBadgeColor(delivery.urgency).text,
                    }}
                  >
                    {delivery.urgency}
                  </span>
                </div>

                <div className="mt-2 text-xs space-y-1">
                  <div className="font-semibold text-slate-200">{delivery.recipient}</div>
                  <div className="text-slate-400 text-[11px]">{delivery.address}</div>
                  <div className="text-slate-400 text-[11px]">Type: {delivery.package_type}</div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" /> Window:
                    </span>
                    <span className="font-mono text-slate-200">
                      {delivery.time_window_start} – {delivery.time_window_end}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span>Estimated ETA:</span>
                    <span
                      className={`font-mono font-bold ${
                        delivery.is_delayed ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {delivery.estimated_arrival_time}
                      {delivery.is_delayed && ` (+${delivery.delay_minutes}m late)`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>LIFO Stack Depth:</span>
                    <span className="font-semibold text-slate-200">
                      #{delivery.lifo_stack_index} in Van Bed
                    </span>
                  </div>

                  {delivery.elevation_meters && (
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-emerald-400" /> Elevation:
                      </span>
                      <span>{delivery.elevation_meters}m</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Assigned Vehicle:</span>
                    <span className="font-bold text-sky-400">{delivery.assigned_truck_id}</span>
                  </div>

                  {/* Vertical Last-Mile Friction Details */}
                  {delivery.property_type && (
                    <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <Building2 className="w-3 h-3" /> Property Type:
                        </span>
                        <span className="text-slate-200 font-medium">
                          {delivery.property_type === "COMMERCIAL_HIGH_RISE"
                            ? "High-Rise Tower"
                            : delivery.property_type === "GATED_VILLA_COMMUNITY"
                            ? "Gated Villa"
                            : "Ground Retail"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Vertical Dwell (D_f):</span>
                        <span className="font-mono font-bold text-amber-300">
                          +{delivery.dwell_friction_minutes || 2}m
                        </span>
                      </div>
                      {delivery.floor_level && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Floor Level:</span>
                          <span className="text-slate-300 font-semibold">Flr {delivery.floor_level}</span>
                        </div>
                      )}
                      {delivery.security_checkpoint && (
                        <div className="flex items-center justify-between text-[10px] text-amber-300/90">
                          <span>Security Check-in:</span>
                          <span className="font-semibold">Required</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Delay Warning & Reassign Action */}
                {delivery.is_delayed && onReassignRequest && (
                  <div className="mt-3 pt-2 border-t border-slate-700">
                    <div className="flex items-center gap-1 text-rose-400 text-[11px] font-semibold mb-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Projected SLA Breach!
                    </div>
                    <button
                      onClick={() => onReassignRequest(delivery)}
                      className="w-full py-1.5 px-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-900/30 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Reassign to Nearby Truck
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
