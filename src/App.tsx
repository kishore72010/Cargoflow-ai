import React, { useState, useEffect, useCallback } from "react";
import { Delivery, Truck, CustomerNotification, SystemStatus, BatonPassRelay } from "./types";
import { FleetMap } from "./components/FleetMap";
import { SmartShufflingPanel } from "./components/SmartShufflingPanel";
import { AtRiskDeliveries } from "./components/AtRiskDeliveries";
import { CargoBayVisualizer } from "./components/CargoBayVisualizer";
import { CustomerNotificationsFeed } from "./components/CustomerNotificationsFeed";
import { MetricsBar } from "./components/MetricsBar";
import { AlgorithmInspectorModal } from "./components/AlgorithmInspectorModal";
import { BatonPassPanel } from "./components/BatonPassPanel";
import { VerticalFrictionPanel } from "./components/VerticalFrictionPanel";
import { GeminiBriefingModal } from "./components/GeminiBriefingModal";
import { ColdChainDecayPanel } from "./components/ColdChainDecayPanel";
import { CustomerPortal } from "./components/CustomerPortal";
import { DriverPortal } from "./components/DriverPortal";
import { AdminPortal } from "./components/AdminPortal";
import { getSocket } from "./services/socket";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RoleSelectionLogin } from "./components/auth/RoleSelectionLogin";
import { CustomerLogin } from "./components/auth/CustomerLogin";
import { CustomerRegister } from "./components/auth/CustomerRegister";
import { AdminLogin } from "./components/auth/AdminLogin";
import { DriverLogin } from "./components/auth/DriverLogin";
import { AccessDeniedModal } from "./components/auth/AccessDeniedModal";
import {
  Truck as TruckIcon,
  Layers,
  AlertTriangle,
  Bell,
  Code,
  RefreshCw,
  Database,
  Radio,
  Sparkles,
  Zap,
  Building2,
  Snowflake,
  Package,
  Smartphone,
  CheckCircle2,
  Activity,
  Flame,
  Compass,
  ShieldCheck,
  ShoppingBag,
  ArrowRight,
  LogOut,
  User as UserIcon,
  ShieldAlert,
  KeyRound,
  Lock,
} from "lucide-react";

export type UserRole = "hub" | "dispatcher" | "customer" | "driver";

function CargoFlowApp() {
  const { user, authState, logout } = useAuth();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [selectedTruckId, setSelectedTruckId] = useState<string>("ALL");
  const [trackedDeliveryId, setTrackedDeliveryId] = useState<string>("DEL-1001");
  const [activeRightTab, setActiveRightTab] = useState<
    "cold_chain" | "baton_pass" | "vertical_friction" | "at_risk" | "cargo_bay" | "notifications"
  >("cold_chain");

  // Routing State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname.toLowerCase() || "/";
  });
  const [deniedAttemptRole, setDeniedAttemptRole] = useState<string | null>(null);

  // Baton Pass Swarm Relay State
  const [batonRelays, setBatonRelays] = useState<BatonPassRelay[]>([]);
  const [activeBatonRelay, setActiveBatonRelay] = useState<BatonPassRelay | null>(null);
  const [isScanningRelays, setIsScanningRelays] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isReassigning, setIsReassigning] = useState<boolean>(false);
  const [isSimulatingColdChain, setIsSimulatingColdChain] = useState<boolean>(false);
  const [lastMetrics, setLastMetrics] = useState<any>(null);
  const [totalPreventedDelays, setTotalPreventedDelays] = useState<number>(0);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string>("NORMAL");

  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const navigateTo = (path: string) => {
    const clean = path.toLowerCase();
    setCurrentPath(clean);
    setDeniedAttemptRole(null);
    if (window.location.pathname.toLowerCase() !== clean) {
      window.history.pushState(null, "", path);
    }
  };

  // Sync routing on browser Back / Forward
  useEffect(() => {
    const handleLocationChange = () => {
      const p = window.location.pathname.toLowerCase();
      setCurrentPath(p);
      setDeniedAttemptRole(null);
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  // Fetch all fleet data from Express & MongoDB
  const fetchData = useCallback(async () => {
    try {
      const [delRes, trkRes, notifRes, statusRes, relayRes] = await Promise.all([
        fetch("/api/deliveries"),
        fetch("/api/trucks"),
        fetch("/api/notifications"),
        fetch("/api/system-status"),
        fetch("/api/baton-pass/scan"),
      ]);

      if (delRes.ok) {
        const data = await delRes.json();
        setDeliveries(data.deliveries || []);
      }
      if (trkRes.ok) {
        const data = await trkRes.json();
        setTrucks(data.trucks || []);
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.notifications || []);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setSystemStatus(data);
      }
      if (relayRes.ok) {
        const data = await relayRes.json();
        setBatonRelays(data.relays || []);
        if (data.relays && data.relays.length > 0) {
          setActiveBatonRelay((prev) => {
            if (!prev) return data.relays[0];
            const found = data.relays.find((r: BatonPassRelay) => r.delivery_id === prev.delivery_id);
            return found || data.relays[0];
          });
        }
      }
    } catch (err) {
      console.error("Failed to load CargoFlow fleet data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleScanBatonRelays = async () => {
    setIsScanningRelays(true);
    try {
      const res = await fetch("/api/baton-pass/scan");
      const data = await res.json();
      setBatonRelays(data.relays || []);
      if (data.relays && data.relays.length > 0) {
        setActiveBatonRelay(data.relays[0]);
        showToast(`Baton Pass: Found ${data.relays.length} viable multi-vehicle trajectory rendezvous options!`);
      } else {
        showToast("Baton Pass Scan: No active gridlock corridor requiring dynamic relay.");
      }
    } catch (err: any) {
      showToast("Error scanning relays: " + err.message);
    } finally {
      setIsScanningRelays(false);
    }
  };

  // Execute a Baton Pass multi-vehicle relay
  const handleExecuteBatonPass = async (relay: BatonPassRelay) => {
    try {
      const res = await fetch("/api/baton-pass/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          delivery_id: relay.delivery_id,
          target_truck_id: relay.relay_truck.truck_id,
          hub_id: relay.rendezvous_hub.hub_id,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        showToast(
          `Baton Pass Executed! Package ${relay.delivery_id} transferred to ${relay.relay_truck.truck_id} at ${relay.rendezvous_hub.name}.`
        );
        setTotalPreventedDelays((prev) => prev + 1);
        await fetchData();
        setActiveRightTab("notifications");
      } else {
        showToast("Baton Pass execution error: " + (data.message || data.error || "Failed"));
      }
    } catch (err: any) {
      showToast("Error executing relay: " + err.message);
    }
  };

  // Socket.IO real-time event listeners
  useEffect(() => {
    fetchData();

    const socket = getSocket();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    const onTruckLocation = (loc: any) => {
      setTrucks((prevTrucks) =>
        prevTrucks.map((truck) =>
          truck.truck_id === loc.truckId
            ? {
                ...truck,
                latitude: loc.latitude,
                longitude: loc.longitude,
                speed_kmh: loc.speed,
                heading: loc.heading,
                last_updated: loc.timestamp,
                tracking_mode: "LIVE",
                tracking_active: true,
              }
            : truck
        )
      );
    };

    const onDeliveryStatus = (update: any) => {
      setDeliveries((prev) =>
        prev.map((d) =>
          d.delivery_id === update.deliveryId
            ? { ...d, status: update.status, actual_delivery_time: update.timestamp }
            : d
        )
      );
      if (update.status === "delivered") {
        showToast(`Delivery ${update.deliveryId} confirmed by driver!`);
      }
    };

    const onBatchOptimized = (data: any) => {
      fetchData();
      showToast(`Fleet Shuffling Completed: ${data.changes?.length || "Dynamic"} manifests reordered.`);
    };

    const onRelayTriggered = (relay: any) => {
      fetchData();
      showToast(`⚡ Baton Pass Alert: Package ${relay.delivery_id} flagged for dynamic handover!`);
    };

    const onHeatDecayUpdate = (data: any) => {
      fetchData();
      showToast(`Cold-Chain Alert: Thermal stress active on ${data.impactedTrucks?.length || 1} vehicles!`);
    };

    const onNotificationNew = (notif: CustomerNotification) => {
      setNotifications((prev) => [notif, ...prev]);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("truck:location", onTruckLocation);
    socket.on("delivery:status", onDeliveryStatus);
    socket.on("batch:optimized", onBatchOptimized);
    socket.on("relay:triggered", onRelayTriggered);
    socket.on("heat_decay:update", onHeatDecayUpdate);
    socket.on("notification:new", onNotificationNew);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("truck:location", onTruckLocation);
      socket.off("delivery:status", onDeliveryStatus);
      socket.off("batch:optimized", onBatchOptimized);
      socket.off("relay:triggered", onRelayTriggered);
      socket.off("heat_decay:update", onHeatDecayUpdate);
      socket.off("notification:new", onNotificationNew);
    };
  }, [fetchData]);

  // Run Global 2-Opt Optimization
  const handleRunOptimization = async (params: {
    trafficMultiplier: number;
    lifoWeight: number;
    elevationWeight: number;
    coldChainWeight: number;
  }) => {
    setIsOptimizing(true);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          trafficMultiplier: params.trafficMultiplier,
          weights: {
            lifo: params.lifoWeight,
            elevation: params.elevationWeight,
            coldChain: params.coldChainWeight,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastMetrics(data.metrics);
        showToast(
          `Optimization Complete! Fuel saved: ${data.metrics?.fuelSavedGallons || "2.4"} gal. Violations: ${
            data.metrics?.spoilageViolations || 0
          }`
        );
        await fetchData();
      } else {
        showToast("Optimization failed: " + (data.error || "Permission denied"));
      }
    } catch (err: any) {
      showToast("Error running optimization: " + err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Simulate Traffic Delay on Specific Truck
  const handleSimulateTraffic = async (truckId: string, delayMinutes: number) => {
    setIsOptimizing(true);
    try {
      const res = await fetch("/api/simulate-traffic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ truckId, delayMinutes }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Traffic Gridlock (${delayMinutes}m) simulated on ${truckId}. Reshuffle triggered.`);
        await fetchData();
      } else {
        showToast("Simulation failed: " + (data.error || "Permission denied"));
      }
    } catch (err: any) {
      showToast("Error simulating traffic: " + err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Reset 50 Mock Deliveries in MongoDB
  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/reset-data", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        showToast("Database Reset: Fresh fleet and orders restored in MongoDB.");
        await fetchData();
      } else {
        showToast("Reset failed: " + (data.error || "Admin permission required"));
      }
    } catch (err: any) {
      showToast("Error resetting data: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // Cold-Chain Dynamic Decay & Heat Stall Simulation
  const handleSimulateHeatStall = async (
    ambientTemp: number,
    idleStallMin: number,
    autoReshuffle: boolean
  ) => {
    setIsSimulatingColdChain(true);
    try {
      const res = await fetch("/api/cold-chain/simulate-heat-stall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ambient_temp_c: ambientTemp,
          idle_stall_minutes: idleStallMin,
          auto_reshuffle: autoReshuffle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const { red_critical_count, amber_warning_count, reshuffled_trucks } = data.simulation_summary;
        showToast(
          `Thermal Stress Alert: ${red_critical_count} Red Critical, ${amber_warning_count} Amber Warning. ${
            reshuffled_trucks.length > 0 ? `Reshuffled: ${reshuffled_trucks.join(", ")}` : ""
          }`
        );
        await fetchData();
      } else {
        showToast("Simulation failed: " + (data.error || "Permission denied"));
      }
    } catch (err: any) {
      showToast("Error simulating thermal stress: " + err.message);
    } finally {
      setIsSimulatingColdChain(false);
    }
  };

  // Role Switch Request handler from top nav buttons
  const handleNavClick = (target: "hub" | "dispatcher" | "customer" | "driver") => {
    if (target === "hub") {
      navigateTo("/login");
      return;
    }
    if (target === "dispatcher") {
      if (!user) {
        navigateTo("/admin/login");
      } else if (user.role !== "ADMIN") {
        setDeniedAttemptRole("ADMIN");
      } else {
        navigateTo("/admin");
      }
      return;
    }
    if (target === "customer") {
      if (!user) {
        navigateTo("/customer/login");
      } else if (user.role !== "CUSTOMER" && user.role !== "ADMIN") {
        setDeniedAttemptRole("CUSTOMER");
      } else {
        navigateTo("/customer");
      }
      return;
    }
    if (target === "driver") {
      if (!user) {
        navigateTo("/driver/login");
      } else if (user.role !== "DRIVER" && user.role !== "ADMIN") {
        setDeniedAttemptRole("DRIVER");
      } else {
        navigateTo("/driver");
      }
      return;
    }
  };

  // If Auth state is still authenticating, show professional loading screen
  if (authState === "AUTHENTICATING") {
    return (
      <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mb-4 animate-pulse shadow-2xl shadow-sky-900/50">
          <TruckIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          CargoFlow <span className="text-sky-400">AI</span>
        </h2>
        <p className="text-xs text-slate-400 font-mono">Verifying secure authentication session...</p>
      </div>
    );
  }

  // Render Main Content with Strict RBAC Route Protection
  const renderMainContent = () => {
    // 1. Explicit Access Denied Modal triggered
    if (deniedAttemptRole) {
      return (
        <AccessDeniedModal
          user={user}
          targetRole={deniedAttemptRole}
          onRedirectToOwnDashboard={() => {
            setDeniedAttemptRole(null);
            if (user?.role === "ADMIN") navigateTo("/admin");
            else if (user?.role === "DRIVER") navigateTo("/driver");
            else navigateTo("/customer");
          }}
          onLogout={async () => {
            setDeniedAttemptRole(null);
            await logout();
            navigateTo("/login");
          }}
        />
      );
    }

    // 2. Customer Registration Page
    if (currentPath === "/customer/register") {
      return (
        <CustomerRegister
          onSuccessRedirectToLogin={() => navigateTo("/customer/login")}
          onNavigateToLogin={() => navigateTo("/customer/login")}
          onNavigateToRoleSelect={() => navigateTo("/login")}
        />
      );
    }

    // 3. Customer Login Page
    if (currentPath === "/customer/login") {
      return (
        <CustomerLogin
          onSuccess={() => navigateTo("/customer")}
          onNavigateToRegister={() => navigateTo("/customer/register")}
          onNavigateToRoleSelect={() => navigateTo("/login")}
        />
      );
    }

    // 4. Admin Login Page
    if (currentPath === "/admin/login") {
      return (
        <AdminLogin
          onSuccess={() => navigateTo("/admin")}
          onNavigateToRoleSelect={() => navigateTo("/login")}
        />
      );
    }

    // 5. Driver Login Page
    if (currentPath === "/driver/login") {
      return (
        <DriverLogin
          onSuccess={() => navigateTo("/driver")}
          onNavigateToRoleSelect={() => navigateTo("/login")}
        />
      );
    }

    // 6. Role Selection Page (/login)
    if (currentPath === "/login") {
      return (
        <RoleSelectionLogin
          onSelectRole={(role) =>
            navigateTo(
              role === "CUSTOMER" ? "/customer/login" : role === "DRIVER" ? "/driver/login" : "/admin/login"
            )
          }
        />
      );
    }

    // 7. Protected Route: /customer
    if (currentPath === "/customer" || currentPath.startsWith("/customer/")) {
      if (!user) {
        return (
          <CustomerLogin
            onSuccess={() => navigateTo("/customer")}
            onNavigateToRegister={() => navigateTo("/customer/register")}
            onNavigateToRoleSelect={() => navigateTo("/login")}
          />
        );
      }
      if (user.role !== "CUSTOMER" && user.role !== "ADMIN") {
        return (
          <AccessDeniedModal
            user={user}
            targetRole="CUSTOMER"
            onRedirectToOwnDashboard={() =>
              navigateTo(user.role === "DRIVER" ? "/driver" : "/admin")
            }
            onLogout={async () => {
              await logout();
              navigateTo("/login");
            }}
          />
        );
      }
      return (
        <CustomerPortal
          deliveries={deliveries}
          trucks={trucks}
          notifications={notifications}
          selectedDeliveryId={trackedDeliveryId}
          onSelectDelivery={setTrackedDeliveryId}
          onSwitchToDispatcher={() => navigateTo("/admin")}
          showToast={showToast}
          currentUser={user}
          onLogout={async () => {
            await logout();
            navigateTo("/login");
          }}
        />
      );
    }

    // 8. Protected Route: /admin
    if (currentPath === "/admin" || currentPath.startsWith("/admin/")) {
      if (!user) {
        return (
          <AdminLogin
            onSuccess={() => navigateTo("/admin")}
            onNavigateToRoleSelect={() => navigateTo("/login")}
          />
        );
      }
      if (user.role !== "ADMIN") {
        return (
          <AccessDeniedModal
            user={user}
            targetRole="ADMIN"
            onRedirectToOwnDashboard={() =>
              navigateTo(user.role === "CUSTOMER" ? "/customer" : "/driver")
            }
            onLogout={async () => {
              await logout();
              navigateTo("/login");
            }}
          />
        );
      }
      return (
        <AdminPortal
          deliveries={deliveries}
          trucks={trucks}
          notifications={notifications}
          systemStatus={systemStatus}
          batonRelays={batonRelays}
          activeBatonRelay={activeBatonRelay}
          onSelectBatonRelay={setActiveBatonRelay}
          onExecuteBatonPass={handleExecuteBatonPass}
          onScanBatonRelays={handleScanBatonRelays}
          isScanningRelays={isScanningRelays}
          onRunOptimization={handleRunOptimization}
          onSimulateTraffic={handleSimulateTraffic}
          onSimulateHeatStall={handleSimulateHeatStall}
          onResetData={handleResetData}
          onRefreshData={fetchData}
          showToast={showToast}
          onSwitchToCustomer={() => navigateTo("/customer")}
          currentUser={user}
          onLogout={async () => {
            await logout();
            navigateTo("/login");
          }}
        />
      );
    }

    // 9. Protected Route: /driver
    if (currentPath === "/driver" || currentPath.startsWith("/driver/")) {
      if (!user) {
        return (
          <DriverLogin
            onSuccess={() => navigateTo("/driver")}
            onNavigateToRoleSelect={() => navigateTo("/login")}
          />
        );
      }
      if (user.role !== "DRIVER" && user.role !== "ADMIN") {
        return (
          <AccessDeniedModal
            user={user}
            targetRole="DRIVER"
            onRedirectToOwnDashboard={() =>
              navigateTo(user.role === "CUSTOMER" ? "/customer" : "/admin")
            }
            onLogout={async () => {
              await logout();
              navigateTo("/login");
            }}
          />
        );
      }
      return (
        <DriverPortal
          trucks={trucks}
          deliveries={deliveries}
          onRefresh={fetchData}
          showToast={showToast}
          onSwitchToAdmin={() => navigateTo("/admin")}
          currentUser={user}
          onLogout={async () => {
            await logout();
            navigateTo("/login");
          }}
        />
      );
    }

    // 10. Default / Root Route ("/")
    if (user) {
      if (user.role === "CUSTOMER") {
        return (
          <CustomerPortal
            deliveries={deliveries}
            trucks={trucks}
            notifications={notifications}
            selectedDeliveryId={trackedDeliveryId}
            onSelectDelivery={setTrackedDeliveryId}
            onSwitchToDispatcher={() => navigateTo("/admin")}
            showToast={showToast}
            currentUser={user}
            onLogout={async () => {
              await logout();
              navigateTo("/login");
            }}
          />
        );
      } else if (user.role === "DRIVER") {
        return (
          <DriverPortal
            trucks={trucks}
            deliveries={deliveries}
            onRefresh={fetchData}
            showToast={showToast}
            onSwitchToAdmin={() => navigateTo("/admin")}
            currentUser={user}
            onLogout={async () => {
              await logout();
              navigateTo("/login");
            }}
          />
        );
      } else {
        return (
          <AdminPortal
            deliveries={deliveries}
            trucks={trucks}
            notifications={notifications}
            systemStatus={systemStatus}
            batonRelays={batonRelays}
            activeBatonRelay={activeBatonRelay}
            onSelectBatonRelay={setActiveBatonRelay}
            onExecuteBatonPass={handleExecuteBatonPass}
            onScanBatonRelays={handleScanBatonRelays}
            isScanningRelays={isScanningRelays}
            onRunOptimization={handleRunOptimization}
            onSimulateTraffic={handleSimulateTraffic}
            onSimulateHeatStall={handleSimulateHeatStall}
            onResetData={handleResetData}
            onRefreshData={fetchData}
            showToast={showToast}
            onSwitchToCustomer={() => navigateTo("/customer")}
            currentUser={user}
            onLogout={async () => {
              await logout();
              navigateTo("/login");
            }}
          />
        );
      }
    }

    // Default unauthenticated experience (Requirement 38)
    return (
      <RoleSelectionLogin
        onSelectRole={(role) =>
          navigateTo(
            role === "CUSTOMER" ? "/customer/login" : role === "DRIVER" ? "/driver/login" : "/admin/login"
          )
        }
      />
    );
  };

  const isCurrentView = (pathPrefix: string) => {
    return currentPath === pathPrefix || currentPath.startsWith(pathPrefix + "/");
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col selection:bg-sky-500/30">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div onClick={() => navigateTo("/login")} className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-sky-900/40 group-hover:scale-105 transition">
            <TruckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white group-hover:text-sky-300 transition">
                CargoFlow <span className="text-sky-400">AI</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                <Radio className="w-3 h-3 text-sky-400 animate-pulse" /> Live Fleet Decision Support
              </span>
            </div>
            <p className="text-xs text-slate-400">
              LIFO Priority Routing • Topographic Fuel Weighting • Mid-Route Rescheduling
            </p>
          </div>
        </div>

        {/* Mode Switcher: 4 User Roles (Role Hub, Fleet Admin, Customer Portal, Driver Mode) */}
        <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1 shadow-inner">
          <button
            onClick={() => handleNavClick("hub")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              currentPath === "/login" || currentPath === "/"
                ? "bg-slate-700 text-white shadow-md shadow-slate-700/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Role Hub</span>
          </button>
          <button
            onClick={() => handleNavClick("dispatcher")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isCurrentView("/admin")
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <TruckIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fleet Admin</span>
            <span className="sm:hidden">Admin</span>
          </button>
          <button
            onClick={() => handleNavClick("customer")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isCurrentView("/customer")
                ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-emerald-400"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customer Portal</span>
            <span className="sm:hidden">Customer</span>
          </button>
          <button
            onClick={() => handleNavClick("driver")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isCurrentView("/driver")
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30"
                : "text-slate-400 hover:text-cyan-400"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Driver GPS</span>
            <span className="sm:hidden">Driver</span>
            {trucks.some((t) => t.tracking_mode === "LIVE" && t.tracking_active) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* Stack Architecture Indicator, Gemini Trigger & User Auth Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBriefingOpen(true)}
            className="hidden sm:flex px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-300 bg-gradient-to-r from-amber-500/15 via-cyan-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 border border-amber-500/40 transition items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Gemini AI Briefing</span>
          </button>

          <button
            onClick={() => setIsInspectorOpen(true)}
            className="hidden md:flex px-3.5 py-1.5 rounded-xl text-xs font-semibold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Code className="w-3.5 h-3.5 text-sky-400" />
            <span>Routing Logic</span>
          </button>

          {/* User Account / Auth Status Pill */}
          {user ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 shadow-inner">
              <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-none max-w-[100px] truncate">
                  {user.name}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold uppercase mt-0.5 ${
                    user.role === "ADMIN"
                      ? "text-indigo-400"
                      : user.role === "CUSTOMER"
                      ? "text-emerald-400"
                      : "text-cyan-400"
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  navigateTo("/login");
                  showToast("You have been securely logged out.");
                }}
                title="Log Out"
                className="ml-1 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigateTo("/login")}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition shadow-md shadow-sky-950/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Real-time System Observability Bar */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-semibold">Backend:</span>
            <span className="text-emerald-400 font-mono">ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                systemStatus?.mongoConnected ? "bg-emerald-400" : "bg-rose-500"
              }`}
            />
            <span className="text-slate-300 font-semibold">MongoDB:</span>
            <span
              className={
                systemStatus?.mongoConnected
                  ? "text-emerald-400 font-mono"
                  : "text-rose-400 font-mono"
              }
            >
              {systemStatus?.mongoConnected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                user ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span className="text-slate-300 font-semibold">Auth Session:</span>
            <span
              className={
                user
                  ? "text-emerald-400 font-mono font-bold"
                  : "text-amber-400 font-mono font-bold"
              }
            >
              {user ? `AUTHENTICATED (${user.role})` : "UNAUTHENTICATED"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                socketConnected ? "bg-emerald-400" : "bg-amber-500"
              }`}
            />
            <span className="text-slate-300 font-semibold">Socket.IO:</span>
            <span
              className={
                socketConnected ? "text-emerald-400 font-mono" : "text-amber-400 font-mono"
              }
            >
              {socketConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-semibold">Fleet:</span>
            <span className="text-slate-100 font-mono">{trucks.length} ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-semibold">GPS:</span>
            <span className="text-emerald-400 font-mono">
              {trucks.filter((t) => t.tracking_mode === "LIVE" && t.tracking_active).length} LIVE
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-sky-300 font-mono">
              {trucks.filter((t) => t.tracking_mode !== "LIVE" || !t.tracking_active).length} SIMULATED
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 hidden md:inline">
            Cryptographic RBAC & Token Verification Engine
          </span>
        </div>
      </div>

      {/* Main App Body */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1850px] w-full mx-auto flex flex-col gap-4">
        {renderMainContent()}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs max-w-md animate-in slide-in-from-bottom-5 duration-200">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Algorithm Mathematical Inspector Modal */}
      <AlgorithmInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      {/* Gemini AI Tactical Fleet Briefing Modal */}
      <GeminiBriefingModal
        isOpen={isBriefingOpen}
        onClose={() => setIsBriefingOpen(false)}
        onTriggerSimulation={async () => {
          setIsBriefingOpen(false);
          await handleSimulateTraffic("TRK-01", 35);
          setActiveRightTab("baton_pass");
        }}
        onViewBatonPass={() => {
          setIsBriefingOpen(false);
          setActiveRightTab("baton_pass");
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CargoFlowApp />
    </AuthProvider>
  );
}
