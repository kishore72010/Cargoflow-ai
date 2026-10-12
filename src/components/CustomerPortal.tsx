import React, { useState, useMemo, useEffect } from "react";
import { Delivery, Truck, CustomerNotification, Product, Order, Customer, AuthUser, ColdChainCertificate } from "../types";
import {
  Search,
  Package,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Snowflake,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  Truck as TruckIcon,
  Navigation,
  Thermometer,
  Layers,
  ChevronRight,
  Info,
  ExternalLink,
  MessageSquare,
  ShoppingCart,
  Plus,
  Minus,
  KeyRound,
  X,
  User,
  History,
  Bell,
  Home,
  LogOut,
  UserCheck,
  Check,
  Compass,
  Award,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { getSocket } from "../services/socket";
import { ColdChainCertificateModal } from "./ColdChainCertificateModal";


interface CustomerPortalProps {
  deliveries: Delivery[];
  trucks: Truck[];
  notifications: CustomerNotification[];
  selectedDeliveryId: string;
  onSelectDelivery: (deliveryId: string) => void;
  onSwitchToDispatcher: () => void;
  showToast: (msg: string) => void;
  onRefreshData?: () => Promise<void>;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

// Leaflet markers for Customer View (Single Truck & Customer Pin Only)
const customerDestinationIcon = L.divIcon({
  className: "custom-customer-dest-pin",
  html: `
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(16, 185, 129, 0.7); border: 2.5px solid #ffffff;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

const customerTruckIcon = L.divIcon({
  className: "custom-customer-truck-pin",
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
      <div style="position: absolute; width: 50px; height: 50px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.35);" class="rendezvous-ping"></div>
      <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(37, 99, 235, 0.7); border: 2.5px solid #ffffff; z-index: 10;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
});

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  deliveries,
  trucks,
  notifications,
  selectedDeliveryId,
  onSelectDelivery,
  onSwitchToDispatcher,
  showToast,
  onRefreshData,
  currentUser,
  onLogout,
}) => {
  // Navigation tabs in Customer Portal
  const [activeTab, setActiveTab] = useState<"home" | "catalog" | "cart" | "tracking" | "orders" | "notifications">("home");

  // Customer Profile & Authentication State
  const [currentCustomer, setCurrentCustomer] = useState<Customer>({
    customer_id: currentUser?.customerId || "CUST-101",
    name: currentUser?.name || "Kishore Kumar",
    email: currentUser?.email || "customer01@cargoflow.demo",
    phone: currentUser?.phone || "+91 98765 43210",
    address: currentUser?.address || "350 Mission St, San Francisco, CA",
    property_type: "COMMERCIAL_HIGH_RISE",
    floor_level: 12,
    created_at: new Date(),
  });

  useEffect(() => {
    if (currentUser) {
      setCurrentCustomer((prev) => ({
        ...prev,
        customer_id: currentUser.customerId || prev.customer_id,
        name: currentUser.name || prev.name,
        email: currentUser.email || prev.email,
        phone: currentUser.phone || prev.phone,
        address: currentUser.address || prev.address,
      }));
    }
  }, [currentUser]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authAddress, setAuthAddress] = useState("");

  // Product Catalog
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Cart State: productId -> quantity
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);

  // Checkout Form
  const [checkoutAddress, setCheckoutAddress] = useState(currentCustomer.address);
  const [checkoutPhone, setCheckoutPhone] = useState(currentCustomer.phone);
  const [checkoutPropertyType, setCheckoutPropertyType] = useState<"COMMERCIAL_HIGH_RISE" | "GATED_VILLA_COMMUNITY" | "GROUND_LEVEL_RETAIL">("COMMERCIAL_HIGH_RISE");
  const [checkoutFloor, setCheckoutFloor] = useState<number>(12);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutPriority, setCheckoutPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Orders for current customer
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Active delivery tracking
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Cold-Chain Cryptographic Certificate State
  const [selectedCustomerCert, setSelectedCustomerCert] = useState<ColdChainCertificate | null>(null);
  const [isCustomerCertOpen, setIsCustomerCertOpen] = useState(false);
  const [isLoadingCertId, setIsLoadingCertId] = useState<string | null>(null);

  const handleOpenCustomerCert = async (deliveryId: string) => {
    setIsLoadingCertId(deliveryId);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/cold-chain-certificate`);
      const data = await res.json();
      if (data.success && data.certificate) {
        setSelectedCustomerCert(data.certificate);
        setIsCustomerCertOpen(true);
      } else {
        showToast("Could not load cold-chain certificate for this delivery.");
      }
    } catch (err: any) {
      showToast("Error retrieving certificate: " + err.message);
    } finally {
      setIsLoadingCertId(null);
    }
  };


  // Load products catalog from backend
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (e) {
      console.error("Failed to fetch products:", e);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Load customer orders from backend
  const fetchCustomerOrders = async (customerId: string) => {
    setIsLoadingOrders(true);
    try {
      const res = await fetch(`/api/orders?customer_id=${customerId}`);
      const data = await res.json();
      if (data.orders) {
        setCustomerOrders(data.orders);
        if (data.orders.length > 0 && !activeOrder) {
          setActiveOrder(data.orders[0]);
          if (data.orders[0].delivery_id) {
            onSelectDelivery(data.orders[0].delivery_id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load customer orders:", e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (currentCustomer.customer_id) {
      fetchCustomerOrders(currentCustomer.customer_id);
      setCheckoutAddress(currentCustomer.address);
      setCheckoutPhone(currentCustomer.phone);
    }
  }, [currentCustomer.customer_id]);

  // Real-time Socket.IO synchronization
  useEffect(() => {
    const socket = getSocket();
    const handleOrderStatus = (data: any) => {
      fetchCustomerOrders(currentCustomer.customer_id);
      if (onRefreshData) onRefreshData();
      if (data.status === "DELIVERED") {
        showToast(`🎉 Order #${data.orderId} has been successfully DELIVERED!`);
      }
    };
    const handleFleetUpdate = () => {
      fetchCustomerOrders(currentCustomer.customer_id);
      if (onRefreshData) onRefreshData();
    };

    socket.on("order:status", handleOrderStatus);
    socket.on("fleet:update", handleFleetUpdate);

    return () => {
      socket.off("order:status", handleOrderStatus);
      socket.off("fleet:update", handleFleetUpdate);
    };
  }, [currentCustomer.customer_id, onRefreshData]);

  // Active delivery object in fleet
  const activeDelivery = useMemo(() => {
    if (activeOrder) {
      const found = deliveries.find((d) => d.delivery_id === activeOrder.delivery_id || d.order_id === activeOrder.order_id);
      if (found) return found;
    }
    return deliveries.find((d) => d.delivery_id === selectedDeliveryId) || deliveries[0];
  }, [deliveries, selectedDeliveryId, activeOrder]);

  // Assigned Truck (Expose ONLY the truck assigned to this order)
  const assignedTruck = useMemo(() => {
    if (!activeDelivery) return null;
    return trucks.find((t) => t.truck_id === activeDelivery.assigned_truck_id) || null;
  }, [activeDelivery, trucks]);

  // Notifications relevant to current customer
  const customerNotifications = useMemo(() => {
    const orderIds = new Set(customerOrders.map((o) => o.order_id));
    const deliveryIds = new Set(customerOrders.map((o) => o.delivery_id));
    return notifications.filter((n) => orderIds.has(n.delivery_id) || deliveryIds.has(n.delivery_id) || n.recipient === currentCustomer.name);
  }, [notifications, customerOrders, currentCustomer.name]);

  // Cart operations
  const addToCart = (product: Product) => {
    const stock = product.stock ?? 25;
    if (stock <= 0) {
      showToast(`Sorry, "${product.name}" is currently out of stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.product_id === product.product_id);
      if (existing) {
        if (existing.quantity >= stock) {
          showToast(`Maximum available stock reached (${stock} units).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`Added "${product.name}" to cart.`);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.product_id === productId) {
            const newQty = item.quantity + delta;
            const maxStock = item.product.stock ?? 25;
            if (newQty > maxStock) {
              showToast(`Only ${maxStock} units available.`);
              return item;
            }
            return { ...item, quantity: Math.max(0, newQty) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.product_id !== productId));
  };

  // Cart financial summary
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price_usd * item.quantity, 0);
  }, [cart]);
  const deliveryFee = cart.length > 0 ? 40 : 0;
  const totalAmount = subtotal + deliveryFee;
  const hasColdChainInCart = useMemo(() => cart.some((item) => item.product.is_cold_chain), [cart]);

  // Place Order submission
  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      showToast("Your cart is empty. Add products before placing an order.");
      return;
    }
    if (!checkoutAddress.trim()) {
      showToast("Please enter a valid delivery address.");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const payload = {
        customer_id: currentCustomer.customer_id,
        customer_name: currentCustomer.name,
        customer_email: currentCustomer.email,
        customer_phone: checkoutPhone,
        items: cart.map((item) => ({
          product_id: item.product.product_id,
          quantity: item.quantity,
        })),
        delivery_address: checkoutAddress,
        property_type: checkoutPropertyType,
        floor_level: checkoutFloor,
        access_notes: checkoutNotes,
        priority: checkoutPriority,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success && data.order) {
        showToast(`🎉 Order #${data.order.order_id} placed! Vehicle ${data.order.assigned_truck_id} assigned.`);
        setCart([]); // Clear cart
        await fetchCustomerOrders(currentCustomer.customer_id);
        setActiveOrder(data.order);
        if (data.delivery?.delivery_id) {
          onSelectDelivery(data.delivery.delivery_id);
        }
        if (onRefreshData) await onRefreshData();
        setActiveTab("tracking"); // Switch directly to Live Tracking
      } else {
        showToast("Order placement failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      showToast("Error creating order: " + err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Switch demo customer profile
  const handleSelectCustomerProfile = (cust: Customer) => {
    setCurrentCustomer(cust);
    setIsAuthModalOpen(false);
    showToast(`Switched user profile to ${cust.name}`);
  };

  // Register new customer
  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authName || !authEmail) {
      showToast("Name and email are required.");
      return;
    }
    try {
      const res = await fetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          phone: authPhone,
          address: authAddress,
        }),
      });
      const data = await res.json();
      if (data.customer) {
        setCurrentCustomer(data.customer);
        setIsAuthModalOpen(false);
        showToast(`Registered and logged in as ${data.customer.name}!`);
      } else {
        showToast(data.error || "Registration failed");
      }
    } catch (e: any) {
      showToast("Registration error: " + e.message);
    }
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === "ALL" || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  // Order lifecycle status progression helper
  const getTimelineSteps = (statusStr: string = "ASSIGNED") => {
    const normalized = statusStr.toUpperCase();
    const steps = [
      { key: "CONFIRMED", label: "Order Confirmed", done: true },
      {
        key: "ASSIGNED",
        label: "Vehicle Assigned",
        done: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "IN_TRANSIT", "ARRIVED", "DELIVERED"].includes(normalized),
      },
      {
        key: "PICKED_UP",
        label: "Picked Up",
        done: ["PICKED_UP", "OUT_FOR_DELIVERY", "IN_TRANSIT", "ARRIVED", "DELIVERED"].includes(normalized),
      },
      {
        key: "OUT_FOR_DELIVERY",
        label: "Out for Delivery",
        done: ["OUT_FOR_DELIVERY", "IN_TRANSIT", "ARRIVED", "DELIVERED"].includes(normalized),
        current: ["OUT_FOR_DELIVERY", "IN_TRANSIT", "ARRIVED"].includes(normalized),
      },
      {
        key: "DELIVERED",
        label: "Delivered",
        done: normalized === "DELIVERED",
        current: normalized === "DELIVERED",
      },
    ];
    return steps;
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Top Customer Navigation Bar */}
      <header className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-white">CargoFlow Consumer Portal</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Single-Truck Precision GPS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Welcome, <strong className="text-emerald-300">{currentCustomer.name}</strong> • Account: {currentCustomer.customer_id}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <nav className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("home")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "home" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "catalog" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Products</span>
          </button>
          <button
            onClick={() => setActiveTab("cart")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer relative ${
              activeTab === "cart" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Cart</span>
            {cart.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "tracking" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Live Tracking</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "orders" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Orders ({customerOrders.length})</span>
          </button>
        </nav>

        {/* Requirement 32: Customer Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Orders</span>
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm relative"
          >
            <Bell className="w-3.5 h-3.5 text-emerald-400" />
            <span>Notifications</span>
            {notifications.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. CUSTOMER DASHBOARD / HOME VIEW                                         */}
      {/* ========================================================================= */}
      {activeTab === "home" && (
        <div className="flex flex-col gap-6">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/20 shadow-2xl p-6 md:p-8">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  CargoFlow Autonomous Logistics Network
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  Welcome, {currentCustomer.name}
                </h1>
                <p className="text-sm text-slate-300 mt-1 max-w-xl">
                  Order pharmaceuticals, fresh perishables, and urgent parcels with real-time temperature verification, vertical dwell compensation, and single-vehicle live GPS tracking.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab("catalog")}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition cursor-pointer flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Browse Products</span>
                </button>
                <button
                  onClick={() => setActiveTab("tracking")}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer flex items-center gap-2"
                >
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  <span>Track Active Order</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Order Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-base">ACTIVE DELIVERY</h3>
              </div>
              {activeOrder && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeOrder.status}
                </span>
              )}
            </div>

            {activeOrder ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div>
                  <span className="text-xs text-slate-400 block">Order Reference:</span>
                  <strong className="text-slate-100 text-base font-mono">{activeOrder.order_id}</strong>
                  <span className="text-xs text-slate-400 block mt-1">
                    {activeOrder.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">Total Amount:</span>
                  <span className="text-xl font-extrabold text-emerald-400">
                    ₹{activeOrder.total_amount_usd}
                  </span>
                  <span className="text-[11px] text-slate-500 block">Includes ₹{activeOrder.delivery_fee_usd || 40} courier fee</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">Assigned Truck & ETA:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-bold font-mono text-xs border border-sky-800">
                      {activeOrder.assigned_truck_id}
                    </span>
                    <span className="text-base font-bold text-slate-100 font-mono">
                      {activeOrder.estimated_arrival || "18:42"}
                    </span>
                  </div>
                  {activeDelivery?.delay_minutes ? (
                    <span className="text-xs text-rose-400 font-semibold block mt-0.5">
                      +{activeDelivery.delay_minutes} min traffic delay
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400 block mt-0.5">On Schedule</span>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => {
                      if (activeOrder.delivery_id) onSelectDelivery(activeOrder.delivery_id);
                      setActiveTab("tracking");
                    }}
                    className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs shadow-md shadow-emerald-950 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    <span>TRACK LIVE</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No active deliveries en route for {currentCustomer.name}.</p>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Order a Product Now
                </button>
              </div>
            )}
          </div>

          {/* Recent Orders & Notifications Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>RECENT ORDERS</span>
                </h3>
                <button
                  onClick={() => setActiveTab("orders")}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  View All
                </button>
              </div>

              {customerOrders.length > 0 ? (
                <div className="space-y-2.5">
                  {customerOrders.slice(0, 4).map((ord) => (
                    <div
                      key={ord.order_id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-200">#{ord.order_id}</span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              ord.status === "DELIVERED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : ord.status === "REASSIGNED"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "bg-sky-500/20 text-sky-400"
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {ord.items.map((i) => i.name).join(", ")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-xs text-slate-200 font-mono block">₹{ord.total_amount_usd}</span>
                        <button
                          onClick={() => {
                            setActiveOrder(ord);
                            if (ord.delivery_id) onSelectDelivery(ord.delivery_id);
                            setActiveTab("tracking");
                          }}
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 mt-1 inline-block cursor-pointer"
                        >
                          Track
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">No order records found.</p>
              )}
            </div>

            {/* Notifications Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>DISPATCH NOTIFICATIONS</span>
                </h3>
                <span className="text-[10px] text-slate-500">Simulated SMS & Email Records</span>
              </div>

              {customerNotifications.length > 0 ? (
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {customerNotifications.map((notif, idx) => (
                    <div
                      key={notif._id || idx}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-300 font-mono">[{notif.delivery_id}]</span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {new Date(notif.dispatched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{notif.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">No active alerts for this customer.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PRODUCT CATALOG VIEW                                                   */}
      {/* ========================================================================= */}
      {activeTab === "catalog" && (
        <div className="flex flex-col gap-6">
          {/* Search & Filter Header */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products (e.g. Medicine, Gelato, Sensors)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {["ALL", "PHARMACEUTICALS", "PERISHABLE_FOOD", "HIGH_VALUE_TECH", "STANDARD_CARGO"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {cat.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((prod) => {
              const stock = prod.stock ?? 25;
              const isCold = prod.is_cold_chain;

              return (
                <div
                  key={prod.product_id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col transition group"
                >
                  {/* Product Image */}
                  <div className="h-44 w-full relative overflow-hidden bg-slate-950">
                    <img
                      src={prod.image_url || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80"}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/90 text-slate-200 border border-slate-700 backdrop-blur-sm">
                        {prod.category.replace(/_/g, " ")}
                      </span>
                      {isCold && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-600 backdrop-blur-sm flex items-center gap-1">
                          <Snowflake className="w-3 h-3 text-cyan-400" />
                          <span>Cold-Chain ({prod.optimal_temp_c ?? 4}°C)</span>
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm ${
                          stock > 0
                            ? "bg-emerald-950/90 text-emerald-300 border border-emerald-600"
                            : "bg-rose-950/90 text-rose-300 border border-rose-600"
                        }`}
                      >
                        {stock > 0 ? `In Stock (${stock})` : "Out of Stock"}
                      </span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{prod.name}</h4>
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {prod.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Price</span>
                        <span className="text-lg font-extrabold text-emerald-400 font-mono">
                          ₹{prod.price_usd}
                        </span>
                      </div>

                      <button
                        onClick={() => addToCart(prod)}
                        disabled={stock <= 0}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                          stock > 0
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ADD TO CART</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FUNCTIONAL CART & CHECKOUT VIEW                                        */}
      {/* ========================================================================= */}
      {activeTab === "cart" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cart Items Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                  <span>SHOPPING CART ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {cart.length > 0 ? (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.product.product_id}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-14 h-14 rounded-lg object-cover bg-slate-900 border border-slate-700"
                        />
                        <div>
                          <h4 className="font-bold text-slate-100 text-xs">{item.product.name}</h4>
                          <span className="text-[11px] text-slate-400 block font-mono">
                            ₹{item.product.price_usd} each
                          </span>
                          {item.product.is_cold_chain && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-semibold mt-1">
                              <Snowflake className="w-3 h-3" /> Cold-Chain Required
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-1">
                          <button
                            onClick={() => updateCartQty(item.product.product_id, -1)}
                            className="p-1 hover:text-rose-400 text-slate-300 transition cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 font-mono font-bold text-xs text-slate-100">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.product.product_id, 1)}
                            className="p-1 hover:text-emerald-400 text-slate-300 transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="font-extrabold text-sm text-emerald-400 font-mono block">
                            ₹{item.product.price_usd * item.quantity}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.product.product_id)}
                            className="text-[10px] text-slate-500 hover:text-rose-400 mt-0.5 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <ShoppingCart className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">Your cart is currently empty.</p>
                  <button
                    onClick={() => setActiveTab("catalog")}
                    className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Browse Product Catalog
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Checkout & Summary Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="font-bold text-slate-100 text-base border-b border-slate-800 pb-3">
                CHECKOUT DETAILS
              </h3>

              {/* Cold-Chain Warning if required */}
              {hasColdChainInCart && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-600/50 flex items-start gap-2.5">
                  <Snowflake className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h5 className="font-bold text-xs text-cyan-200">Cold-Chain Delivery Active</h5>
                    <p className="text-[11px] text-cyan-300/80 leading-relaxed mt-0.5">
                      Your cart includes temperature-sensitive biologics/perishables. The assigned courier will enforce active thermal runway monitoring.
                    </p>
                  </div>
                </div>
              )}

              {/* Delivery Address */}
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Delivery Address:</label>
                <input
                  type="text"
                  value={checkoutAddress}
                  onChange={(e) => setCheckoutAddress(e.target.value)}
                  placeholder="Street Address, City, Postal Code"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Contact Phone Number:</label>
                <input
                  type="text"
                  value={checkoutPhone}
                  onChange={(e) => setCheckoutPhone(e.target.value)}
                  placeholder="+1 (415) 555-0199"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Property Type (Vertical Dwell Friction) */}
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1 flex items-center justify-between">
                  <span>Property Architecture Type:</span>
                  <span className="text-[10px] text-amber-400 font-mono">Dwell Overhead D_f</span>
                </label>
                <select
                  value={checkoutPropertyType}
                  onChange={(e) => setCheckoutPropertyType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="COMMERCIAL_HIGH_RISE">Commercial High-Rise (+15.5m elevator dwell)</option>
                  <option value="GATED_VILLA_COMMUNITY">Gated Villa Community (+6.0m security clearance)</option>
                  <option value="GROUND_LEVEL_RETAIL">Ground-Level Retail (+2.0m curb drop)</option>
                </select>
              </div>

              {checkoutPropertyType === "COMMERCIAL_HIGH_RISE" && (
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Floor Level:</label>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={checkoutFloor}
                    onChange={(e) => setCheckoutFloor(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              {/* Optional Instructions */}
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Courier Access Instructions:</label>
                <input
                  type="text"
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Gate passcode, security check-in, or reception instructions"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Order Financial Summary Box */}
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Standard Fleet Courier Fee:</span>
                  <span className="font-mono text-slate-200">₹{deliveryFee}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-100 pt-2 border-t border-slate-800">
                  <span>Grand Total:</span>
                  <span className="text-emerald-400 font-mono text-base">₹{totalAmount}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={cart.length === 0 || isSubmittingOrder}
                className={`w-full py-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                  cart.length > 0 && !isSubmittingOrder
                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                {isSubmittingOrder ? (
                  <span>Assigning Fleet Vehicle...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>PLACE ORDER (₹{totalAmount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CUSTOMER LIVE TRACKING VIEW (Single Vehicle Privacy Map)              */}
      {/* ========================================================================= */}
      {activeTab === "tracking" && (
        <div className="flex flex-col gap-6">
          {/* Tracking Header Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-white">
                    LIVE DELIVERY TRACKING: #{activeOrder?.order_id || activeDelivery?.delivery_id || "CF-1024"}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {activeOrder?.status || activeDelivery?.status?.toUpperCase() || "OUT_FOR_DELIVERY"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Recipient: <strong className="text-slate-200">{activeDelivery?.recipient || currentCustomer.name}</strong> • Destination: {activeDelivery?.address || currentCustomer.address}
                </p>
              </div>

              {/* Delivery OTP Card */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-emerald-500/10 border border-amber-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase block">Delivery Verification OTP</span>
                  <strong className="text-xl font-mono text-amber-200 tracking-wider">
                    {activeOrder?.delivery_otp || activeDelivery?.delivery_otp || "4821"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Stepper Timeline Lifecycle */}
            <div className="mt-6 pt-2">
              <span className="text-[11px] font-bold text-slate-400 block mb-3 uppercase">Order Progression Timeline</span>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {getTimelineSteps(activeOrder?.status || "OUT_FOR_DELIVERY").map((step, idx) => (
                  <div
                    key={step.key}
                    className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                      step.done
                        ? "bg-emerald-950/50 border-emerald-600/60 text-emerald-300"
                        : step.current
                        ? "bg-sky-950/60 border-sky-500 text-sky-200 animate-pulse"
                        : "bg-slate-950/40 border-slate-800 text-slate-500"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                        step.done
                          ? "bg-emerald-500 text-slate-950"
                          : step.current
                          ? "bg-sky-400 text-slate-950"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {step.done ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                    </div>
                    <span className="truncate">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Live Map (Customer Destination & Assigned Truck Only) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[480px] relative">
              <MapContainer
                center={[activeDelivery?.latitude || 37.7749, activeDelivery?.longitude || -122.4194]}
                zoom={14}
                className="w-full h-full"
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                />

                {/* Customer Destination Pin */}
                {activeDelivery && (
                  <Marker
                    position={[activeDelivery.latitude, activeDelivery.longitude]}
                    icon={customerDestinationIcon}
                  >
                    <Popup>
                      <div className="p-1 text-slate-900 text-xs">
                        <strong className="block text-emerald-700">Delivery Destination</strong>
                        <span>{activeDelivery.recipient}</span>
                        <div className="text-[11px] text-slate-500 mt-1">{activeDelivery.address}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Assigned Vehicle Only (Never Expose Entire Fleet) */}
                {assignedTruck && (
                  <Marker
                    position={[assignedTruck.latitude, assignedTruck.longitude]}
                    icon={customerTruckIcon}
                  >
                    <Popup>
                      <div className="p-1 text-slate-900 text-xs">
                        <strong className="block text-blue-700">{assignedTruck.name}</strong>
                        <span>Driver: {assignedTruck.driver}</span>
                        <div className="text-[11px] text-slate-600 mt-1 font-mono">
                          Speed: {assignedTruck.speed_kmh || 0} km/h • GPS: {assignedTruck.tracking_mode || "LIVE"}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Route Vector Between Truck and Customer */}
                {activeDelivery && assignedTruck && (
                  <Polyline
                    positions={[
                      [assignedTruck.latitude, assignedTruck.longitude],
                      [activeDelivery.latitude, activeDelivery.longitude],
                    ]}
                    pathOptions={{
                      color: "#10b981",
                      weight: 4,
                      opacity: 0.9,
                      dashArray: "6, 8",
                    }}
                  />
                )}
              </MapContainer>

              <div className="absolute top-4 left-4 z-[500] bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-xs text-slate-300 space-y-1 shadow-lg pointer-events-none">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Assigned Vehicle: {assignedTruck?.name || activeDelivery?.assigned_truck_id}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Speed: <strong className="text-slate-200">{assignedTruck?.speed_kmh || 0} km/h</strong> • Mode: <strong className="text-emerald-400">{assignedTruck?.tracking_mode || "LIVE"}</strong>
                </div>
              </div>
            </div>

            {/* Live Telemetry & ETA Panel */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h4 className="font-bold text-slate-100 text-sm border-b border-slate-800 pb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>PRECISION LIVE ETA</span>
                </h4>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Estimated Arrival Window:</span>
                  <span className="text-3xl font-extrabold text-emerald-400 font-mono block mt-1">
                    {activeDelivery?.estimated_arrival_time || activeOrder?.estimated_arrival || "18:42"}
                  </span>
                  {activeDelivery?.is_delayed ? (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      +{activeDelivery.delay_minutes} min corridor traffic delay
                    </span>
                  ) : (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Estimated on-time delivery
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Driver Courier:</span>
                    <strong className="text-slate-100">{assignedTruck?.driver || "Marcus Vance"}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Vehicle Unit:</span>
                    <strong className="text-sky-400 font-mono">{activeDelivery?.assigned_truck_id}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Property Type:</span>
                    <span>{activeDelivery?.property_type?.replace(/_/g, " ") || "HIGH RISE"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Vertical Dwell (D_f):</span>
                    <span className="font-mono text-amber-300 font-semibold">
                      +{activeDelivery?.dwell_friction_minutes || 15.5} min
                    </span>
                  </div>
                  {activeDelivery?.is_perishable && (
                    <div className="flex justify-between py-1 border-b border-slate-800/80 text-cyan-300">
                      <span className="text-slate-400">Thermal Runway:</span>
                      <span className="font-mono font-bold">
                        {activeDelivery.safe_runway_remaining_min || 35}m remaining
                      </span>
                    </div>
                  )}

                  {activeDelivery && (activeDelivery.is_perishable || activeOrder?.items.some((i) => i.is_cold_chain)) && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerCert(activeDelivery.delivery_id)}
                        disabled={isLoadingCertId === activeDelivery.delivery_id}
                        className="w-full py-2.5 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-950/50"
                      >
                        <Award className="w-4 h-4 text-cyan-400" />
                        <span>
                          {isLoadingCertId === activeDelivery.delivery_id
                            ? "Loading..."
                            : "View Cold-Chain Integrity Certificate"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 5. CUSTOMER ORDER HISTORY VIEW                                            */}
      {/* ========================================================================= */}
      {activeTab === "orders" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <span>ORDER HISTORY FOR {currentCustomer.name.toUpperCase()}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Past and current orders placed by customer account {currentCustomer.customer_id}.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("catalog")}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
            >
              + Place New Order
            </button>
          </div>

          {customerOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {customerOrders.map((ord) => (
                    <tr key={ord.order_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">#{ord.order_id}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(ord.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {ord.items.map((i) => `${i.name} (${i.quantity})`).join(", ")}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        ₹{ord.total_amount_usd}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
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
                      <td className="py-3 px-3 font-mono text-slate-300">{ord.assigned_truck_id}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ord.items.some((i) => i.is_cold_chain) && ord.delivery_id && (
                            <button
                              type="button"
                              onClick={() => handleOpenCustomerCert(ord.delivery_id!)}
                              className="px-2.5 py-1 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 font-bold rounded-lg transition cursor-pointer text-xs flex items-center gap-1"
                              title="View Cryptographic Cold-Chain Certificate"
                            >
                              <Award className="w-3 h-3 text-cyan-400" />
                              <span>Audit Cert</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActiveOrder(ord);
                              if (ord.delivery_id) onSelectDelivery(ord.delivery_id);
                              setActiveTab("tracking");
                            }}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-lg transition cursor-pointer text-xs"
                          >
                            Track Live
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm font-semibold">No order history available.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PROFILE SWITCHER / REGISTRATION MODAL                                   */}
      {/* ========================================================================= */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold text-white mb-1">Customer Profile & Switcher</h3>
            <p className="text-xs text-slate-400 mb-4">
              Select an existing demo customer or register a new customer account.
            </p>

            {/* Quick Demo Customer Profiles */}
            <div className="space-y-2 mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">1-Click Demo Profiles</span>
              {[
                {
                  customer_id: "CUST-101",
                  name: "Kishore Kumar",
                  email: "kishore@cargoflow.io",
                  phone: "+91 98765 43210",
                  address: "350 Mission St, San Francisco, CA",
                  property_type: "COMMERCIAL_HIGH_RISE" as const,
                  floor_level: 12,
                  created_at: new Date(),
                },
                {
                  customer_id: "CUST-102",
                  name: "Dr. Sarah Jenkins",
                  email: "sarah.jenkins@ucsf.edu",
                  phone: "+1 (415) 555-0199",
                  address: "505 Parnassus Ave, San Francisco, CA",
                  property_type: "COMMERCIAL_HIGH_RISE" as const,
                  floor_level: 14,
                  created_at: new Date(),
                },
                {
                  customer_id: "CUST-103",
                  name: "Marcus Thorne",
                  email: "marcus.thorne@bayretail.com",
                  phone: "+1 (415) 555-0244",
                  address: "1802 Market St, San Francisco, CA",
                  property_type: "GROUND_LEVEL_RETAIL" as const,
                  floor_level: 1,
                  created_at: new Date(),
                },
              ].map((cust) => (
                <button
                  key={cust.customer_id}
                  onClick={() => handleSelectCustomerProfile(cust)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    currentCustomer.customer_id === cust.customer_id
                      ? "bg-emerald-950/60 border-emerald-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <strong className="block text-xs">{cust.name}</strong>
                    <span className="text-[11px] text-slate-400">{cust.email}</span>
                  </div>
                  {currentCustomer.customer_id === cust.customer_id && (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Toggle Registration */}
            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 block mb-3 cursor-pointer"
              >
                {isRegistering ? "← Back to Profile Selection" : "+ Register New Customer Account"}
              </button>

              {isRegistering && (
                <form onSubmit={handleRegisterCustomer} className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Full Name:</label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Email:</label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Phone:</label>
                    <input
                      type="text"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+1 (415) 555-0199"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Register & Log In
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cryptographic Cold-Chain Audit Certificate Modal */}
      <ColdChainCertificateModal
        certificate={selectedCustomerCert}
        isOpen={isCustomerCertOpen}
        onClose={() => setIsCustomerCertOpen(false)}
        showToast={showToast}
      />
    </div>
  );
};

