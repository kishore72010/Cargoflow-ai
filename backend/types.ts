export type UrgencyTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type PropertyType = "COMMERCIAL_HIGH_RISE" | "GATED_VILLA_COMMUNITY" | "GROUND_LEVEL_RETAIL";

export type PerishableCategory = "ICE_CREAM" | "PHARMACEUTICALS" | "SEAFOOD_DAIRY" | "FRESH_FLOWERS" | "STANDARD";

export type SpoilageRiskBadge = "SAFE" | "AMBER_WARNING" | "RED_CRITICAL";

export interface BuildingMetadata {
  property_type: PropertyType;
  property_label: string;
  floor_level: number;
  security_checkpoint: boolean;
  avg_elevator_delay: number; // in minutes
  dwell_friction_minutes: number; // D_f
  access_notes?: string;
}

export interface ColdChainMetadata {
  is_perishable: boolean;
  category: PerishableCategory;
  category_label: string;
  optimal_temp_c: number; // Target cold storage temp (e.g. -18°C, 4°C)
  max_safe_temp_c: number; // Threshold beyond which rapid decay starts
  decay_rate: number; // Decay constant lambda (min^-1)
  spoilage_threshold_min: number; // Safe thermal idle limit in minutes
  idle_stall_minutes: number; // Accumulated idle time in traffic/heat
  ambient_temp_c: number; // External temperature
  current_cargo_temp_c: number; // Modeled temperature inside container
  decay_score: number; // 0% to 100% degradation
  spoilage_risk: SpoilageRiskBadge; // SAFE | AMBER_WARNING | RED_CRITICAL
  exponential_weight_multiplier: number; // Dynamic priority boost e^(k * stress)
  safe_runway_remaining_min: number; // Minutes remaining until spoilage
  estimated_loss_value_usd?: number; // Cargo dollar value at risk
}

export interface Delivery {
  _id?: string;
  delivery_id: string;
  recipient: string;
  address: string;
  latitude: number;
  longitude: number;
  elevation_meters?: number;
  urgency: UrgencyTier;
  priority_score: number;
  package_type: string;
  weight_kg: number;
  time_window_start: string;
  time_window_end: string;
  window_start_minutes: number;
  window_end_minutes: number;
  window_duration_minutes: number;
  assigned_truck_id: string;
  lifo_stack_index: number;
  original_sequence: number;
  optimized_sequence: number;
  estimated_arrival_time: string;
  estimated_arrival_minutes: number;
  status: "pending" | "in_transit" | "arrived" | "delivered" | "delayed";
  is_delayed: boolean;
  delay_minutes: number;
  customer_notified: boolean;
  customer_phone?: string;
  customer_email?: string;
  fuel_factor?: number;
  distance_from_prev_km?: number;
  // Vertical Last-Mile Friction Metric (D_f)
  property_type?: PropertyType;
  floor_level?: number;
  security_checkpoint?: boolean;
  avg_elevator_delay?: number;
  dwell_friction_minutes?: number; // D_f: commercial high-rise (+12-15m), gated villa (+6m), ground retail (+2m)
  curb_drive_time_minutes?: number; // Pure drive time
  total_delivery_effort_minutes?: number; // Drive time + D_f
  building_metadata?: BuildingMetadata;
  // Cold-Chain & Perishability Decay Curve
  is_perishable?: boolean;
  perishable_category?: PerishableCategory;
  decay_rate?: number; // Lambda degradation rate
  spoilage_threshold_min?: number; // Safe thermal idle limit in minutes
  current_cargo_temp_c?: number;
  optimal_temp_c?: number;
  ambient_temp_c?: number;
  idle_stall_minutes?: number;
  decay_score?: number; // 0 to 100 (%)
  spoilage_risk?: SpoilageRiskBadge; // SAFE | AMBER_WARNING | RED_CRITICAL
  exponential_weight_multiplier?: number;
  safe_runway_remaining_min?: number;
  cargo_value_usd?: number;
  cold_chain_metadata?: ColdChainMetadata;
  order_id?: string;
  delivery_otp?: string;
  delivered_at?: string | Date;
  baton_pass?: {
    delivery_id: string;
    origin_truck_id: string;
    relay_truck_id: string;
    rendezvous_hub: {
      id: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    };
    executed_at: string;
    custody_state: string;
    barcode_token: string;
  };
}

export interface Truck {
  _id?: string;
  truck_id: string;
  name: string;
  driver: string;
  driver_id?: string;
  latitude: number;
  longitude: number;
  status: "in_transit" | "idle" | "delayed" | "returning";
  current_traffic_delay_min: number;
  fuel_level_pct: number;
  capacity_kg: number;
  current_load_kg: number;
  total_packages: number;
  assigned_deliveries?: Delivery[];
  tracking_mode?: "LIVE" | "SIMULATED";
  tracking_active?: boolean;
  speed_kmh?: number;
  heading_deg?: number;
  gps_accuracy_m?: number;
  last_location_at?: string | Date;
}

export interface Driver {
  _id?: string;
  driver_id: string;
  name: string;
  phone: string;
  assigned_truck_id: string;
  active: boolean;
}

export interface Customer {
  _id?: string;
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  property_type?: PropertyType;
  floor_level?: number;
  created_at: string | Date;
}

export interface Product {
  _id?: string;
  product_id: string;
  name: string;
  category: "PHARMACEUTICALS" | "PERISHABLE_FOOD" | "HIGH_VALUE_TECH" | "STANDARD_CARGO";
  price_usd: number;
  weight_kg: number;
  is_cold_chain: boolean;
  optimal_temp_c?: number;
  description: string;
  image_url?: string;
  stock?: number;
  priority?: UrgencyTier;
  active?: boolean;
}

export interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price_usd: number;
  weight_kg: number;
  is_cold_chain: boolean;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "AT_RISK"
  | "REASSIGNED"
  | "DELIVERED"
  | "CANCELLED"
  | "ORDER_PLACED"
  | "IN_TRANSIT"
  | "ARRIVED";

export interface Order {
  _id?: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  total_amount_usd: number;
  delivery_fee_usd?: number;
  delivery_address: string;
  latitude: number;
  longitude: number;
  property_type: PropertyType;
  floor_level: number;
  access_notes?: string;
  priority: UrgencyTier;
  delivery_otp: string;
  status: OrderStatus;
  delivery_id: string;
  assigned_truck_id: string;
  estimated_arrival?: string;
  created_at: string | Date;
  updated_at: string | Date;
  delivered_at?: string | Date;
}

export interface CustomerNotification {
  _id?: string;
  delivery_id: string;
  truck_id: string;
  recipient: string;
  package_type: string;
  urgency: UrgencyTier;
  promised_window: string;
  revised_eta: string;
  delay_minutes: number;
  channel: "SMS_AND_EMAIL";
  recipient_phone: string;
  recipient_email: string;
  message: string;
  dispatched_at: string | Date;
}

export interface OptimizationMetrics {
  total_distance_km: number;
  total_duration_minutes: number;
  at_risk_count: number;
  prevented_delays_count: number;
  naive_late_count: number;
  fuel_efficiency_score: number;
  traffic_delay_applied_min: number;
  shuffled_count: number;
}

export interface RendezvousHub {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  description: string;
}

export interface VehicleRelayInfo {
  truck_id: string;
  name: string;
  driver: string;
  coordinates: [number, number];
  traffic_delay_min: number;
  speed_kmh: number;
  eta_to_rendezvous_min: number;
}

export interface HandshakeMetrics {
  time_window_overlap_min: number;
  earlier_arrival_vehicle: string;
  curb_wait_time_min: number;
  handshake_timestamp_min: number;
  handshake_window_clock: string;
  window_handoff_duration_min: number;
  final_leg_duration_min: number;
  total_relay_time_min: number;
}

export interface RelayImpact {
  isolated_delivery_eta_min: number;
  isolated_clock_eta: string;
  baton_pass_delivery_eta_min: number;
  baton_pass_clock_eta: string;
  time_saved_minutes: number;
  sla_preserved: boolean;
  score: number;
}

export interface RelayTrajectories {
  source_to_rendezvous: [number, number][];
  target_to_rendezvous: [number, number][];
  rendezvous_to_destination: [number, number][];
}

export interface BatonPassOpportunity {
  relay_id: string;
  delivery_id: string;
  recipient: string;
  address: string;
  package_type: string;
  urgency: UrgencyTier;
  destination_coordinates: [number, number];
  promised_window: string;
  window_end_minutes: number;
  source_truck: VehicleRelayInfo;
  target_truck: VehicleRelayInfo;
  rendezvous_hub: RendezvousHub;
  handshake_metrics: HandshakeMetrics;
  impact: RelayImpact;
  trajectories: RelayTrajectories;
}

export interface BatonPassMission {
  _id?: string;
  relay_id: string;
  delivery_id: string;
  recipient: string;
  package_type: string;
  urgency: UrgencyTier;
  source_truck_id: string;
  target_truck_id: string;
  rendezvous_name: string;
  rendezvous_coordinates: number[];
  time_saved_minutes: number;
  status: "ACTIVE_HANDSHAKE" | "IN_TRANSIT" | "COMPLETED";
  created_at: string;
}

export type UserRole = "ADMIN" | "CUSTOMER" | "DRIVER";

export interface User {
  _id?: any;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Role specific fields
  driverId?: string;
  assignedVehicleId?: string;
  customerId?: string;
  address?: string;
  adminId?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  isActive: boolean;
  driverId?: string;
  assignedVehicleId?: string;
  customerId?: string;
  address?: string;
  adminId?: string;
}

export interface ColdChainTelemetryBlock {
  blockIndex: number;
  timestamp: string;
  sensorId: string;
  ambientTempC: number;
  cargoTempC: number;
  maxSafeTempC: number;
  location: { lat: number; lng: number; label?: string };
  batteryPct: number;
  status: "COMPLIANT" | "WARNING" | "EXCURSION";
  prevHash: string;
  hash: string;
}

export interface ColdChainCertificate {
  certificateId: string;
  deliveryId: string;
  orderId?: string;
  productName: string;
  category: PerishableCategory;
  recipient: string;
  destinationAddress: string;
  carrierTruckId: string;
  sensorId: string;
  issuedAt: string;
  standardCompliance: string;
  integrityStatus: "CERTIFIED_SAFE" | "EXCURSION_DETECTED";
  minTempRecorded: number;
  maxTempRecorded: number;
  avgTempRecorded: number;
  totalCheckpoints: number;
  rootHash: string;
  digitalSignature: string;
  blockchainVerified: boolean;
  telemetryBlocks: ColdChainTelemetryBlock[];
}


