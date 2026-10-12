import React, { useState, useEffect } from "react";
import { Delivery, Truck, CustomerNotification, SystemStatus, BatonPassRelay, Order, Customer, AuthUser } from "../types";
import { FleetMap } from "./FleetMap";
import { SmartShufflingPanel } from "./SmartShufflingPanel";
import { AtRiskDeliveries } from "./AtRiskDeliveries";
import { CargoBayVisualizer } from "./CargoBayVisualizer";
import { CustomerNotificationsFeed } from "./CustomerNotificationsFeed";
import { MetricsBar } from "./MetricsBar";
import { AlgorithmInspectorModal } from "./AlgorithmInspectorModal";
import { BatonPassPanel } from "./BatonPassPanel";
import { VerticalFrictionPanel } from "./VerticalFrictionPanel";
import { GeminiBriefingModal } from "./GeminiBriefingModal";
import { ColdChainDecayPanel } from "./ColdChainDecayPanel";
import {
  LayoutDashboard,
  Truck as TruckIcon,
  Package,
  Users,
  Compass,
  Zap,
  Snowflake,
  Building2,
  Layers,
  Bell,
  Sparkles,
  Activity,
  Flame,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Database,
  Radio,
  ExternalLink,
  X,
  Gauge,
  ArrowRight,
  LogOut,
} from "lucide-react";

interface AdminPortalProps {
  deliveries: Delivery[];
  trucks: Truck[];
  notifications: CustomerNotification[];
  systemStatus: SystemStatus | null;
  batonRelays: BatonPassRelay[];
  activeBatonRelay: BatonPassRelay | null;
  onSelectBatonRelay: (relay: BatonPassRelay | null) => void;
  onExecuteBatonPass: (relay: BatonPassRelay) => Promise<void>;
  onScanBatonRelays: () => Promise<void>;
  isScanningRelays: boolean;
  onRunOptimization: (params: any) => Promise<void>;
  onSimulateTraffic: (truckId: string, delayMinutes: number) => Promise<void>;
  onSimulateHeatStall: (ambientTemp: number, idleStallMin: number, autoReshuffle: boolean) => Promise<void>;
  onResetData: () => Promise<void>;
  onRefreshData: () => Promise<void>;
  showToast: (msg: string) => void;
  onSwitchToCustomer: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export type AdminSection =
  | "dashboard"
  | "orders"
  | "fleet"
  | "customers"
  | "map"
  | "smart_shuffling"
  | "at_risk"
  | "baton_pass"
  | "cold_chain"
  | "vertical_dwell"
  | "cargo_bay"
  | "notifications"
  | "gemini_ai"
  | "simulation";

export const AdminPortal: React.FC<AdminPortalProps> = ({
  deliveries,
  trucks,
  notifications,
  systemStatus,
  batonRelays,
  activeBatonRelay,
  onSelectBatonRelay,
  onExecuteBatonPass,
  onScanBatonRelays,
  isScanningRelays,
  onRunOptimization,
  onSimulateTraffic,
  onSimulateHeatStall,
  onResetData,
  onRefreshData,
  showToast,
  onSwitchToCustomer,
  currentUser,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [selectedTruckId, setSelectedTruckId] = useState<string>("ALL");
  const [activeScenario, setActiveScenario] = useState<string>("NORMAL");
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastMetrics, setLastMetrics] = useState<any>(null);

  // Orders table state
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [orderToReassign, setOrderToReassign] = useState<Order | null>(null);
  const [targetTruckForReassign, setTargetTruckForReassign] = useState<string>("TRK-02");

  // Customers table state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>("");

  // Fetch all orders for Admin view
  const fetchAllOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.orders) {
        setAllOrders(data.orders);
      }
    } catch (e) {
      console.error("Failed to fetch admin orders:", e);
    }
  };

  // Fetch all customers for Admin view
  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (e) {
      console.error("Failed to fetch admin customers:", e);
    }
  };

  useEffect(() => {
    fetchAllOrders();
    fetchCustomers();
  }, []);

  // Demo Scenarios Trigger
  const handleTriggerScenario = async (scenario: string) => {
    setIsOptimizing(true);
    try {
      const res = await fetch("/api/demo/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveScenario(scenario);
        showToast(data.message || `Scenario ${scenario} executed`);
        if (scenario === "HEAVY_TRAFFIC" || scenario === "MULTI_GRIDLOCK") {
          setActiveSection("baton_pass");
        } else if (scenario === "COLD_CHAIN_EMERGENCY") {
          setActiveSection("cold_chain");
        } else if (scenario === "HIGH_RISE_DWELL") {
          setActiveSection("vertical_dwell");
        }
        await onRefreshData();
        await fetchAllOrders();
      } else {
        showToast("Scenario trigger failed: " + (data.error || "Unknown"));
      }
    } catch (err: any) {
      showToast("Error triggering scenario: " + err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Manual Order Reassignment
  const handleExecuteReassignment = async () => {
    if (!orderToReassign) return;
    try {
      const res = await fetch(`/api/orders/${orderToReassign.order_id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_truck_id: targetTruckForReassign }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Order #${orderToReassign.order_id} successfully reassigned to ${targetTruckForReassign}!`);
        setIsReassignModalOpen(false);
        setOrderToReassign(null);
        await onRefreshData();
        await fetchAllOrders();
      } else {
        showToast("Reassignment failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      showToast("Error reassigning order: " + err.message);
    }
  };

  const depot = systemStatus?.depot || {
    latitude: 37.7749,
    longitude: -122.4194,
    name: "CargoFlow Central Metro Depot",
  };

  // Operational metrics calculated from actual MongoDB state
  const totalOrdersCount = allOrders.length;
  const activeDeliveriesCount = deliveries.filter((d) => d.status !== "delivered").length;
  const inTransitCount = deliveries.filter((d) => d.status === "in_transit" || d.status === "pending").length;
  const atRiskCount = deliveries.filter((d) => d.is_delayed).length;
  const deliveredCount = deliveries.filter((d) => d.status === "delivered").length;
  const availableTrucksCount = trucks.filter((t) => (t.current_load_kg || 0) < (t.capacity_kg || 500) * 0.9).length;
  const liveGpsCount = trucks.filter((t) => t.tracking_mode === "LIVE" && t.tracking_active).length;
  const simulatedCount = trucks.length - liveGpsCount;
  const coldChainRisksCount = deliveries.filter(
    (d) => d.is_perishable && (d.spoilage_risk === "RED_CRITICAL" || d.spoilage_risk === "AMBER_WARNING")
  ).length;

  // Filtered orders list
  const filteredOrders = allOrders.filter((ord) => {
    const matchesStatus = orderFilterStatus === "ALL" || ord.status === orderFilterStatus;
    const q = orderSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      ord.order_id.toLowerCase().includes(q) ||
      ord.customer_name.toLowerCase().includes(q) ||
      ord.assigned_truck_id.toLowerCase().includes(q) ||
      ord.items.some((i) => i.name.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  // Filtered customers list
  const filteredCustomers = customers.filter((cust) => {
    const q = customerSearch.toLowerCase().trim();
    return (
      !q ||
      cust.name.toLowerCase().includes(q) ||
      cust.email.toLowerCase().includes(q) ||
      cust.customer_id.toLowerCase().includes(q) ||
      cust.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1850px] mx-auto w-full pb-16">
      {/* ========================================================================= */}
      {/* ADMIN CONTROL CENTER SIDEBAR (PART 31)                                    */}
      {/* ========================================================================= */}
      <aside className="w-full lg:w-64 shrink-0 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col gap-2">
        <div className="px-3 py-2 border-b border-slate-800 mb-2">
          <span className="text-[10px] font-extrabold uppercase text-sky-400 tracking-wider">Fleet Control Center</span>
          <h3 className="text-sm font-extrabold text-white">Operations Hub</h3>
        </div>

        <nav className="flex flex-col gap-1 text-xs font-semibold">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "orders", label: `Orders (${totalOrdersCount})`, icon: Package },
            { id: "fleet", label: `Fleet (${trucks.length})`, icon: TruckIcon },
            { id: "customers", label: `Customers (${customers.length})`, icon: Users },
            { id: "map", label: "Live Fleet Map", icon: Compass },
            { id: "smart_shuffling", label: "Smart Shuffling", icon: Activity },
            { id: "at_risk", label: `At-Risk (${atRiskCount})`, icon: AlertTriangle, badge: atRiskCount > 0 },
            { id: "baton_pass", label: `Baton Pass (${batonRelays.length})`, icon: Zap },
            { id: "cold_chain", label: `Cold Chain (${coldChainRisksCount})`, icon: Snowflake, alert: coldChainRisksCount > 0 },
            { id: "vertical_dwell", label: "Vertical Dwell (Df)", icon: Building2 },
            { id: "cargo_bay", label: "LIFO Cargo Bay", icon: Layers },
            { id: "notifications", label: `Alerts (${notifications.length})`, icon: Bell },
            { id: "gemini_ai", label: "Gemini AI Briefing", icon: Sparkles },
            { id: "simulation", label: "Simulation Toolbar", icon: Flame },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "gemini_ai") {
                    setIsBriefingOpen(true);
                  } else {
                    setActiveSection(item.id as AdminSection);
                  }
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md shadow-sky-950 font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
                {item.alert && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick System Status & Auth Card in Sidebar (Part 31) */}
        <div className="mt-auto pt-4 border-t border-slate-800 text-[11px] space-y-2.5 text-slate-400">
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Authentication:</span>
              <span className="flex items-center gap-1.5 font-bold text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              <span className="text-slate-500">Current Admin: </span>
              <span className="font-mono text-slate-200 font-medium">
                {currentUser?.email || "admin@cargoflow.demo"}
              </span>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full mt-2 py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LOGOUT</span>
              </button>
            )}
          </div>

          <div className="flex justify-between px-1">
            <span>MongoDB:</span>
            <span className="font-mono text-emerald-400 font-bold">CONNECTED</span>
          </div>
          <div className="flex justify-between px-1">
            <span>GPS Tracking:</span>
            <span className="font-mono text-slate-200">{liveGpsCount} LIVE • {simulatedCount} SIM</span>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN ADMIN WORKSPACE                                                      */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col gap-6">
        {/* Top Operational Metrics Bar (Part 17) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "TOTAL ORDERS", value: totalOrdersCount, color: "text-sky-400", sub: "MongoDB Orders" },
            { label: "ACTIVE DELIVERIES", value: activeDeliveriesCount, color: "text-slate-100", sub: "Active stops" },
            { label: "IN TRANSIT", value: inTransitCount, color: "text-emerald-400", sub: "Moving parcels" },
            { label: "AT RISK", value: atRiskCount, color: atRiskCount > 0 ? "text-rose-400" : "text-slate-400", sub: "SLA delayed" },
            { label: "DELIVERED", value: deliveredCount, color: "text-emerald-400", sub: "OTP verified" },
            { label: "AVAILABLE TRUCKS", value: `${availableTrucksCount}/${trucks.length}`, color: "text-purple-400", sub: "Fleet ready" },
            { label: "LIVE GPS", value: liveGpsCount, color: liveGpsCount > 0 ? "text-emerald-400" : "text-slate-400", sub: `${simulatedCount} simulated` },
            { label: "COLD CHAIN RISKS", value: coldChainRisksCount, color: coldChainRisksCount > 0 ? "text-amber-400" : "text-cyan-400", sub: "Thermal stress" },
          ].map((m, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md flex flex-col justify-between"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{m.label}</span>
              <div className="my-1">
                <span className={`text-xl font-extrabold font-mono ${m.color}`}>{m.value}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-medium">{m.sub}</span>
            </div>
          ))}
        </div>

        {/* Controlled Simulation Scenarios Toolbar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-slate-200">Simulation Scenarios:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleTriggerScenario("NORMAL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeScenario === "NORMAL" ? "bg-sky-600 text-white shadow-sm" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              1. Normal Ops
            </button>
            <button
              onClick={() => handleTriggerScenario("HEAVY_TRAFFIC")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeScenario === "HEAVY_TRAFFIC" ? "bg-rose-600 text-white shadow-sm" : "bg-slate-800 text-rose-300 hover:bg-slate-700"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>2. Heavy Traffic (+35m)</span>
            </button>
            <button
              onClick={() => handleTriggerScenario("COLD_CHAIN_EMERGENCY")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeScenario === "COLD_CHAIN_EMERGENCY" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-800 text-cyan-300 hover:bg-slate-700"
              }`}
            >
              <Snowflake className="w-3.5 h-3.5" />
              <span>3. Cold-Chain Emergency</span>
            </button>
            <button
              onClick={() => handleTriggerScenario("HIGH_RISE_DWELL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeScenario === "HIGH_RISE_DWELL" ? "bg-amber-600 text-white shadow-sm" : "bg-slate-800 text-amber-300 hover:bg-slate-700"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>4. High-Rise Dwell Delay</span>
            </button>
            <button
              onClick={() => handleTriggerScenario("MULTI_GRIDLOCK")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeScenario === "MULTI_GRIDLOCK" ? "bg-purple-600 text-white shadow-sm" : "bg-slate-800 text-purple-300 hover:bg-slate-700"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>5. Multi-Gridlock Relay</span>
            </button>
            <button
              onClick={async () => {
                setIsResetting(true);
                await onResetData();
                await fetchAllOrders();
                setIsResetting(false);
              }}
              disabled={isResetting}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
              <span>Reset Data</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 1: MAIN OPERATIONS DASHBOARD (Split Layout)                          */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Map Column (60%) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[540px] lg:min-h-[700px]">
              <FleetMap
                deliveries={deliveries}
                trucks={trucks}
                selectedTruckId={selectedTruckId}
                depot={depot}
                activeBatonRelay={activeBatonRelay}
                onExecuteBatonPass={onExecuteBatonPass}
                onReassignRequest={(delivery) => {
                  setActiveSection("at_risk");
                }}
              />
            </div>

            {/* Telemetry & Control Column (40%) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
              <SmartShufflingPanel
                trucks={trucks}
                selectedTruckId={selectedTruckId}
                onSelectTruck={setSelectedTruckId}
                onRunOptimization={onRunOptimization}
                onSimulateTraffic={onSimulateTraffic}
                onResetData={onResetData}
                isOptimizing={isOptimizing}
                isResetting={isResetting}
                lastOptimizationMetrics={lastMetrics}
              />

              {/* Quick Tabbed Sub-View */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <h4 className="font-bold text-xs text-slate-200 uppercase">Operational Modules</h4>
                  <button
                    onClick={() => setIsBriefingOpen(true)}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gemini AI Briefing</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveSection("baton_pass")}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> Baton Pass Swarm
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {batonRelays.length} active trajectory handoffs
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSection("cold_chain")}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-cyan-200 flex items-center gap-1.5">
                      <Snowflake className="w-3.5 h-3.5" /> Cold-Chain Decay
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {coldChainRisksCount} critical thermal risks
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSection("vertical_dwell")}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Vertical Dwell (Df)
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Elevator transit analysis
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSection("cargo_bay")}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-purple-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> LIFO Cargo Bay
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Van bed depth & penalty
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 2: ADMIN ORDER MANAGEMENT (PART 18)                                  */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "orders" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-400" />
                  <span>FLEET ORDER MANAGEMENT</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete ledger of consumer delivery orders recorded in MongoDB.
                </p>
              </div>

              {/* Search and Status Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by ID, customer, truck..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-56"
                  />
                </div>

                {["ALL", "CONFIRMED", "ASSIGNED", "OUT_FOR_DELIVERY", "REASSIGNED", "DELIVERED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderFilterStatus(st)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      orderFilterStatus === st
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Products</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Assigned Truck</th>
                    <th className="py-3 px-3">ETA</th>
                    <th className="py-3 px-3">OTP</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.order_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">#{ord.order_id}</td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-100 block">{ord.customer_name}</strong>
                        <span className="text-[10px] text-slate-500">{ord.delivery_address}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {ord.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.priority === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-300"
                              : ord.priority === "HIGH"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-sky-500/20 text-sky-300"
                          }`}
                        >
                          {ord.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            ord.status === "DELIVERED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : ord.status === "REASSIGNED"
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                              : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-sky-400">{ord.assigned_truck_id}</td>
                      <td className="py-3 px-3 font-mono text-slate-200">{ord.estimated_arrival || "18:42"}</td>
                      <td className="py-3 px-3 font-mono text-amber-300 font-bold">{ord.delivery_otp}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setOrderToReassign(ord);
                            setIsReassignModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-lg text-xs transition cursor-pointer"
                        >
                          Reassign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 3: ADMIN FLEET MANAGEMENT (PART 19)                                  */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "fleet" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <TruckIcon className="w-5 h-5 text-sky-400" />
                  <span>FLEET VEHICLE ROSTER & TELEMETRY</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time status, GPS coordinates, fuel levels, and current route checkpoints for all vans.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trucks.map((trk) => {
                const isLive = trk.tracking_mode === "LIVE" && trk.tracking_active;
                return (
                  <div
                    key={trk.truck_id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 relative overflow-hidden shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-white text-base font-mono">{trk.truck_id}</h4>
                        <span className="text-xs text-slate-400">{trk.name}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isLive
                            ? "bg-emerald-950 text-emerald-300 border-emerald-600"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {isLive ? "LIVE GPS ●" : "SIMULATED"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Driver:</span>
                        <strong className="text-slate-100">{trk.driver}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status:</span>
                        <span className="font-bold text-sky-400 uppercase">{trk.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Speed / Heading:</span>
                        <span className="font-mono text-slate-200">
                          {trk.speed_kmh != null ? Math.round(trk.speed_kmh) : 0} km/h • {trk.heading_deg != null ? Math.round(trk.heading_deg) : 0}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Fuel Level:</span>
                        <span className="font-mono text-amber-300 font-bold">{trk.fuel_level_pct || 85}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Active Load:</span>
                        <span className="font-mono text-slate-200">
                          {trk.current_load_kg || 0} / {trk.capacity_kg || 500} kg
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Remaining Stops:</span>
                        <span className="font-mono text-emerald-400 font-bold">{trk.total_packages || 0}</span>
                      </div>
                      {trk.current_traffic_delay_min > 0 && (
                        <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-slate-800">
                          <span>Corridor Traffic:</span>
                          <span>+{trk.current_traffic_delay_min}m delay</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 4: REGISTERED CUSTOMERS                                              */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "customers" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" />
                  <span>REGISTERED CONSUMER ROSTER</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customers registered for autonomous last-mile deliveries.
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="py-3 px-3">Customer ID</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Default Address</th>
                    <th className="py-3 px-3">Property Architecture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.customer_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-sky-400">{cust.customer_id}</td>
                      <td className="py-3 px-3 font-bold text-slate-100">{cust.name}</td>
                      <td className="py-3 px-3 text-slate-300">{cust.email}</td>
                      <td className="py-3 px-3 text-slate-400 font-mono">{cust.phone}</td>
                      <td className="py-3 px-3 text-slate-300">{cust.address}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {cust.property_type || "COMMERCIAL_HIGH_RISE"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 5: FULL-SCREEN LEAFLET FLEET MAP                                     */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "map" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-2xl h-[750px] flex flex-col">
            <FleetMap
              deliveries={deliveries}
              trucks={trucks}
              selectedTruckId={selectedTruckId}
              depot={depot}
              activeBatonRelay={activeBatonRelay}
              onExecuteBatonPass={onExecuteBatonPass}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 6: SMART SHUFFLING ROUTE RE-SEQUENCING                               */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "smart_shuffling" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <SmartShufflingPanel
              trucks={trucks}
              selectedTruckId={selectedTruckId}
              onSelectTruck={setSelectedTruckId}
              onRunOptimization={onRunOptimization}
              onSimulateTraffic={onSimulateTraffic}
              onResetData={onResetData}
              isOptimizing={isOptimizing}
              isResetting={isResetting}
              lastOptimizationMetrics={lastMetrics}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 7: AT-RISK DELIVERIES                                                */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "at_risk" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <AtRiskDeliveries
              deliveries={deliveries}
              trucks={trucks}
              onReassign={async (deliveryId, targetTruckId) => {
                await fetch(`/api/reassign`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ delivery_id: deliveryId, target_truck_id: targetTruckId }),
                });
                await onRefreshData();
                showToast(`Delivery ${deliveryId} reassigned to ${targetTruckId}`);
              }}
              isReassigning={false}
              onTrackAsCustomer={() => onSwitchToCustomer()}
              onSelectBatonPass={async () => {
                setActiveSection("baton_pass");
                await onScanBatonRelays();
              }}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 8: BATON PASS SWARM RELAY (PART 24)                                  */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "baton_pass" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <BatonPassPanel
              relays={batonRelays}
              activeRelay={activeBatonRelay}
              onSelectRelay={onSelectBatonRelay}
              onExecuteRelay={onExecuteBatonPass}
              isLoading={isScanningRelays}
              onRefreshScan={onScanBatonRelays}
              onTriggerSimulation={async () => {
                await onSimulateTraffic("TRK-01", 35);
              }}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 9: COLD-CHAIN DECAY MONITOR (PART 25)                                */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "cold_chain" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <ColdChainDecayPanel
              deliveries={deliveries}
              onSimulateHeatStall={onSimulateHeatStall}
              isSimulating={false}
              onRefresh={onRefreshData}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 10: VERTICAL DWELL FRICTION Df (PART 26)                             */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "vertical_dwell" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <VerticalFrictionPanel
              deliveries={deliveries}
              selectedTruckId={selectedTruckId}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 11: LIFO CARGO BAY VISUALIZER (PART 27)                              */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "cargo_bay" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <CargoBayVisualizer
              deliveries={deliveries}
              trucks={trucks}
              selectedTruckId={selectedTruckId}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 12: SYSTEM NOTIFICATIONS (PART 28)                                   */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "notifications" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <CustomerNotificationsFeed notifications={notifications} />
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* VIEW 13: SIMULATION TOOLBAR FULL VIEW                                     */}
        {/* ------------------------------------------------------------------------- */}
        {activeSection === "simulation" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <span>CONTROLLED SIMULATION SCENARIOS</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic scenario generator creating real state cascades across MongoDB, ETA calculations, Baton Pass candidates, and customer notifications.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: "NORMAL",
                  title: "1. Normal Operations",
                  desc: "Baseline schedule across San Francisco corridors with all vehicles on-time.",
                  btn: "Run Normal Operations",
                  action: () => handleTriggerScenario("NORMAL"),
                  color: "border-sky-500/30",
                },
                {
                  id: "HEAVY_TRAFFIC",
                  title: "2. Heavy Traffic Congestion (+35m)",
                  desc: "Injects +35m corridor gridlock on TRK-01. Immediately cascades SLA delay alerts, triggers Smart Shuffling, and reveals Baton Pass rendezvous opportunities.",
                  btn: "Simulate Heavy Traffic",
                  action: () => handleTriggerScenario("HEAVY_TRAFFIC"),
                  color: "border-rose-500/40",
                },
                {
                  id: "COLD_CHAIN_EMERGENCY",
                  title: "3. Cold-Chain Thermal Emergency",
                  desc: "Induces 34°C ambient heat stall on biologics & artisan perishables, transitioning thermal risk to RED_CRITICAL and elevating routing priority.",
                  btn: "Simulate Heat Stall",
                  action: () => handleTriggerScenario("COLD_CHAIN_EMERGENCY"),
                  color: "border-cyan-500/40",
                },
                {
                  id: "HIGH_RISE_DWELL",
                  title: "4. High-Rise Dwell Friction Delay",
                  desc: "Simulates elevator queue and security delays on downtown commercial towers (+15.5m Df), testing vertical dwell compensation.",
                  btn: "Simulate High-Rise Dwell",
                  action: () => handleTriggerScenario("HIGH_RISE_DWELL"),
                  color: "border-amber-500/40",
                },
              ].map((s) => (
                <div key={s.id} className={`p-5 rounded-2xl bg-slate-950 border ${s.color} space-y-3`}>
                  <h4 className="font-extrabold text-white text-sm">{s.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                  <button
                    onClick={s.action}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    {s.btn}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Manual Order Reassign Modal */}
      {isReassignModalOpen && orderToReassign && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsReassignModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-sky-400" />
              <span>REASSIGN ORDER #{orderToReassign.order_id}</span>
            </h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <strong className="text-slate-200">{orderToReassign.customer_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Assigned Truck:</span>
                <span className="font-mono text-rose-400 font-bold">{orderToReassign.assigned_truck_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destination:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{orderToReassign.delivery_address}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Select Target Fleet Vehicle:</label>
              <select
                value={targetTruckForReassign}
                onChange={(e) => setTargetTruckForReassign(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              >
                {trucks.map((t) => (
                  <option key={t.truck_id} value={t.truck_id}>
                    {t.truck_id} - {t.driver} ({t.total_packages || 0} stops, {t.current_load_kg || 0}kg)
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setIsReassignModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReassignment}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AlgorithmInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      <GeminiBriefingModal
        isOpen={isBriefingOpen}
        onClose={() => setIsBriefingOpen(false)}
        onTriggerSimulation={async () => {
          setIsBriefingOpen(false);
          await onSimulateTraffic("TRK-01", 35);
          setActiveSection("baton_pass");
        }}
        onViewBatonPass={() => {
          setIsBriefingOpen(false);
          setActiveSection("baton_pass");
        }}
      />
    </div>
  );
};
