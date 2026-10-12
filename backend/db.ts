import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Db } from "mongodb";
import { Delivery, Truck, PropertyType, BuildingMetadata, Product, Driver, Customer, User } from "./types.js";
import bcrypt from "bcryptjs";

let mongodInstance: MongoMemoryServer | null = null;
let client: MongoClient | null = null;
let db: Db | null = null;
let initPromise: Promise<Db> | null = null;

const DB_NAME = "fleet_db";

export const DEPOT = {
  config_key: "depot",
  name: "CargoFlow Central Metro Depot (SF Hub #1)",
  latitude: 37.7749,
  longitude: -122.4194,
  total_packages: 50,
  active_trucks: 3,
};

export const INITIAL_DRIVERS: Driver[] = [
  {
    driver_id: "DRV-01",
    name: "Marcus Vance",
    phone: "+1 (415) 555-0111",
    assigned_truck_id: "TRK-01",
    active: true,
  },
  {
    driver_id: "DRV-02",
    name: "Elena Rostova",
    phone: "+1 (415) 555-0122",
    assigned_truck_id: "TRK-02",
    active: true,
  },
  {
    driver_id: "DRV-03",
    name: "Darnell Washington",
    phone: "+1 (415) 555-0133",
    assigned_truck_id: "TRK-03",
    active: true,
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    customer_id: "CUST-101",
    name: "Kishore Kumar",
    email: "kishore@cargoflow.io",
    phone: "+91 98765 43210",
    address: "350 Mission St, San Francisco, CA",
    property_type: "COMMERCIAL_HIGH_RISE",
    floor_level: 12,
    created_at: new Date(),
  },
  {
    customer_id: "CUST-102",
    name: "Dr. Sarah Jenkins",
    email: "sarah.jenkins@ucsf.edu",
    phone: "+1 (415) 555-0199",
    address: "505 Parnassus Ave, San Francisco, CA",
    property_type: "COMMERCIAL_HIGH_RISE",
    floor_level: 14,
    created_at: new Date(),
  },
  {
    customer_id: "CUST-103",
    name: "Marcus Thorne",
    email: "marcus.thorne@bayretail.com",
    phone: "+1 (415) 555-0244",
    address: "1802 Market St, San Francisco, CA",
    property_type: "GROUND_LEVEL_RETAIL",
    floor_level: 1,
    created_at: new Date(),
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    product_id: "PROD-01",
    name: "Cold-Chain Biologics & Vaccines (2-8°C)",
    category: "PHARMACEUTICALS",
    price_usd: 1850.0,
    weight_kg: 2.5,
    is_cold_chain: true,
    optimal_temp_c: 4.0,
    description: "Time-critical certified temperature biologics requiring active cold-chain containment.",
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    stock: 25,
    priority: "CRITICAL",
    active: true,
  },
  {
    product_id: "PROD-02",
    name: "Artisanal Gelato & Ice Cream Pints",
    category: "PERISHABLE_FOOD",
    price_usd: 320.0,
    weight_kg: 3.0,
    is_cold_chain: true,
    optimal_temp_c: -18.0,
    description: "Deep-frozen artisan gelato. Requires sub-zero thermal buffer during transit.",
    image_url: "https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=400&q=80",
    stock: 40,
    priority: "HIGH",
    active: true,
  },
  {
    product_id: "PROD-03",
    name: "Fresh Sushi-Grade Seafood Platter",
    category: "PERISHABLE_FOOD",
    price_usd: 680.0,
    weight_kg: 4.2,
    is_cold_chain: true,
    optimal_temp_c: 2.0,
    description: "Ultra-fresh sashimi salmon and tuna cuts requiring strict refrigerated courier handling.",
    image_url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=80",
    stock: 15,
    priority: "HIGH",
    active: true,
  },
  {
    product_id: "PROD-04",
    name: "Robotics Precision Micro-Sensors",
    category: "HIGH_VALUE_TECH",
    price_usd: 1250.0,
    weight_kg: 1.8,
    is_cold_chain: false,
    description: "High-value fragile optical encoders and LIDAR sensors for autonomous laboratory robotics.",
    image_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80",
    stock: 30,
    priority: "MEDIUM",
    active: true,
  },
  {
    product_id: "PROD-05",
    name: "Urgent Legal & Contract Dossier",
    category: "STANDARD_CARGO",
    price_usd: 240.0,
    weight_kg: 1.2,
    is_cold_chain: false,
    description: "Time-sensitive court documents and acquisition escrow files requiring chain-of-custody OTP.",
    image_url: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&q=80",
    stock: 50,
    priority: "HIGH",
    active: true,
  },
  {
    product_id: "PROD-06",
    name: "Emergency Clinical Diagnostic Kits",
    category: "PHARMACEUTICALS",
    price_usd: 890.0,
    weight_kg: 3.5,
    is_cold_chain: true,
    optimal_temp_c: 5.0,
    description: "Rapid polymerase chain test cartridges for hospital urgent care pathology labs.",
    image_url: "https://images.unsplash.com/photo-1583912267670-6575ad31e1fd?w=400&q=80",
    stock: 20,
    priority: "CRITICAL",
    active: true,
  },
];

export const INITIAL_TRUCKS: Truck[] = [
  {
    truck_id: "TRK-01",
    name: "Alpha Van 01 (North Zone)",
    driver: "Marcus Vance",
    driver_id: "DRV-01",
    latitude: 37.7780,
    longitude: -122.4160,
    status: "in_transit",
    current_traffic_delay_min: 0,
    fuel_level_pct: 86,
    capacity_kg: 500,
    current_load_kg: 185.4,
    total_packages: 17,
    tracking_mode: "SIMULATED",
    tracking_active: false,
    speed_kmh: 0,
    heading_deg: 0,
    gps_accuracy_m: 10,
    last_location_at: new Date().toISOString(),
  },
  {
    truck_id: "TRK-02",
    name: "Beta Van 02 (Central Zone)",
    driver: "Elena Rostova",
    driver_id: "DRV-02",
    latitude: 37.7710,
    longitude: -122.4210,
    status: "in_transit",
    current_traffic_delay_min: 0,
    fuel_level_pct: 92,
    capacity_kg: 500,
    current_load_kg: 172.8,
    total_packages: 17,
    tracking_mode: "SIMULATED",
    tracking_active: false,
    speed_kmh: 0,
    heading_deg: 0,
    gps_accuracy_m: 10,
    last_location_at: new Date().toISOString(),
  },
  {
    truck_id: "TRK-03",
    name: "Gamma Van 03 (South-East Hub)",
    driver: "Darnell Washington",
    driver_id: "DRV-03",
    latitude: 37.7650,
    longitude: -122.4080,
    status: "in_transit",
    current_traffic_delay_min: 0,
    fuel_level_pct: 78,
    capacity_kg: 500,
    current_load_kg: 164.2,
    total_packages: 16,
    tracking_mode: "SIMULATED",
    tracking_active: false,
    speed_kmh: 0,
    heading_deg: 0,
    gps_accuracy_m: 10,
    last_location_at: new Date().toISOString(),
  },
];

/**
 * Calculates the Vertical Last-Mile Dwell Friction Index (D_f)
 * Commercial High-Rise: +12 to 15 mins (floor transit, security checkpoint, slow elevators)
 * Gated Villa Community: +6 mins (guard gate clearance, courtyard access)
 * Ground-Level Retail: +2 mins (direct street-level storefront drop)
 */
export function calculateDwellFriction(
  propertyType: PropertyType,
  floorLevel: number,
  securityCheckpoint: boolean,
  avgElevatorDelay: number
): number {
  if (propertyType === "COMMERCIAL_HIGH_RISE") {
    // Floor level traversal + security sign-in + elevator queue
    const baseWalk = 2.5;
    const securityTime = securityCheckpoint ? 3.5 : 1.0;
    const elevatorTime = avgElevatorDelay > 0 ? avgElevatorDelay : 6.0;
    const floorTransit = Math.min(3.5, Math.max(0.8, (floorLevel - 1) * 0.18));
    const total = baseWalk + securityTime + elevatorTime + floorTransit;
    return Number(Math.min(15.5, Math.max(12.0, total)).toFixed(1));
  } else if (propertyType === "GATED_VILLA_COMMUNITY") {
    // Intercom guard gate clearance + driveway transit
    const gateClearance = securityCheckpoint ? 3.5 : 1.0;
    const drivewayWalk = 2.5;
    return Number((gateClearance + drivewayWalk).toFixed(1)); // ~6.0 mins
  } else {
    // Ground-level storefront counter drop
    return 2.0;
  }
}

export function generateSeedDeliveries(): Delivery[] {
  const streets = [
    "Market St", "Mission St", "Howard St", "Folsom St", "Harrison St",
    "Valencia St", "Guerrero St", "Van Ness Ave", "Geary Blvd", "California St",
    "Montgomery St", "Sansome St", "Columbus Ave", "Lombard St", "The Embarcadero"
  ];

  const recipients = [
    "Apex Medical Urgent Care", "St. Jude Clinical Labs", "Mission Bay BioPharma",
    "OmniTech Robotics R&D", "Silicon Horizon Systems", "CloudScale Datacenter",
    "Pioneer Legal Group", "Veritas Law Chambers", "Bayview Diagnostic Center",
    "Golden Gate Regional Grocers", "Artisan Bakery Hub", "GreenLeaf Organic Foods",
    "Pacific Science Academy", "Sunset Audio Visual Labs", "Presidio Architecture Co.",
    "Valencia Books & Print", "SOMA Digital Media", "Marina Specialty Pharmacy",
    "Embarcadero Financial Partners", "North Beach Hardware", "Dogpatch Maker Space",
    "Financial District Logistics", "Richmond Clinical Sciences", "Beacon Hill Engineering"
  ];

  const urgencyTiers: Array<{
    urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    priority_score: number;
    types: string[];
    min_window: number;
    max_window: number;
  }> = [
    {
      urgency: "CRITICAL",
      priority_score: 100,
      types: ["Emergency Medical Supplies", "Urgent Legal Documents", "Perishable Bioreagents"],
      min_window: 45,
      max_window: 80,
    },
    {
      urgency: "HIGH",
      priority_score: 75,
      types: ["Refrigerated Goods", "Express High-Value Tech", "Cold-Chain Pharmaceuticals"],
      min_window: 60,
      max_window: 120,
    },
    {
      urgency: "MEDIUM",
      priority_score: 50,
      types: ["Retail Restock", "Commercial Office Hardware", "Apparel & Consumer Goods"],
      min_window: 90,
      max_window: 180,
    },
    {
      urgency: "LOW",
      priority_score: 25,
      types: ["Standard Catalog Parcels", "Dry Storage Materials", "Bulk Consolidated Cargo"],
      min_window: 150,
      max_window: 320,
    },
  ];

  const deliveries: Delivery[] = [];
  const shiftStartHour = 8;

  for (let i = 1; i <= 50; i++) {
    const deliveryId = `DEL-${1000 + i}`;
    // Fixed distribution for reproducibility
    const tierIndex = i % 10 === 0 || i % 10 === 1 ? 0 : i % 10 <= 4 ? 1 : i % 10 <= 7 ? 2 : 3;
    const tier = urgencyTiers[tierIndex];

    const latOffset = ((Math.sin(i * 12.3) * 10000) % 1) * 0.035;
    const lngOffset = ((Math.cos(i * 7.9) * 10000) % 1) * 0.045;
    const lat = Number((DEPOT.latitude + latOffset).toFixed(6));
    const lng = Number((DEPOT.longitude + lngOffset).toFixed(6));

    const elevation = Number((15 + Math.abs(Math.sin(i)) * 60).toFixed(1));
    const startOffset = 30 + (i * 7) % 180;
    const duration = tier.min_window + (i * 5) % (tier.max_window - tier.min_window + 1);
    const endOffset = startOffset + duration;

    const startH = Math.floor(shiftStartHour + startOffset / 60);
    const startM = Math.floor(startOffset % 60);
    const endH = Math.floor(shiftStartHour + endOffset / 60);
    const endM = Math.floor(endOffset % 60);

    const timeStart = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    const timeEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    const truckId = `TRK-0${((i - 1) % 3) + 1}`;
    const recipient = recipients[(i - 1) % recipients.length];
    const street = `${100 + ((i * 37) % 2100)} ${streets[(i - 1) % streets.length]}, San Francisco, CA`;
    const packageType = tier.types[(i - 1) % tier.types.length];
    const weight = Number((1.5 + ((i * 1.37) % 20)).toFixed(2));

    const arrivalMin = startOffset + 15;
    const arrH = Math.floor(shiftStartHour + arrivalMin / 60);
    const arrM = Math.floor(arrivalMin % 60);

    // Vertical Last-Mile Friction Metric (D_f)
    // Commercial High-Rise (+12 to 15m) | Gated Villa Community (+6m) | Ground-Level Retail (+2m)
    const propertyType: PropertyType =
      i % 3 === 1
        ? "COMMERCIAL_HIGH_RISE"
        : i % 3 === 2
        ? "GATED_VILLA_COMMUNITY"
        : "GROUND_LEVEL_RETAIL";

    let floorLevel = 1;
    let securityCheckpoint = false;
    let avgElevatorDelay = 0;
    let propertyLabel = "Ground-Level Retail (+2m)";
    let accessNotes = "Street-level storefront counter delivery. Direct curb access.";

    if (propertyType === "COMMERCIAL_HIGH_RISE") {
      // High-rise towers (e.g. 18th floor like in problem description)
      floorLevel = 10 + ((i * 7) % 28); // e.g. 17th, 24th, 31st, 18th, 25th floor
      securityCheckpoint = true;
      avgElevatorDelay = Number((5.5 + ((i * 0.4) % 2.5)).toFixed(1)); // 5.5 - 7.5m
      propertyLabel = `Commercial High-Rise (${floorLevel}th Floor)`;
      accessNotes = `Security checkpoint badge verification required. Freight elevator bank (${avgElevatorDelay}m avg wait). Floor ${floorLevel}.`;
    } else if (propertyType === "GATED_VILLA_COMMUNITY") {
      floorLevel = 1 + (i % 2);
      securityCheckpoint = true;
      avgElevatorDelay = 0;
      propertyLabel = "Gated Villa Community (+6m)";
      accessNotes = "Gated residential community with security call-box code verification. 200m private access driveway.";
    }

    const dwellFriction = calculateDwellFriction(
      propertyType,
      floorLevel,
      securityCheckpoint,
      avgElevatorDelay
    );

    const buildingMetadata: BuildingMetadata = {
      property_type: propertyType,
      property_label: propertyLabel,
      floor_level: floorLevel,
      security_checkpoint: securityCheckpoint,
      avg_elevator_delay: avgElevatorDelay,
      dwell_friction_minutes: dwellFriction,
      access_notes: accessNotes,
    };

    // Cold-Chain & Perishability Decay Attributes
    let isPerishable = false;
    let perishableCategory: any = "STANDARD";
    let decayRate = 0.0;
    let spoilageThresholdMin = 9999.0;
    let optimalTempC = 21.0;
    let maxSafeTempC = 40.0;
    let cargoValUsd = 140.0;
    let pType = packageType;

    if (i % 4 === 0) {
      isPerishable = true;
      perishableCategory = "ICE_CREAM";
      pType = "Artisanal Gelato & Ice Cream Pints";
      decayRate = 0.085;
      spoilageThresholdMin = 25.0;
      optimalTempC = -18.0;
      maxSafeTempC = -4.0;
      cargoValUsd = 320.0;
    } else if (i % 4 === 1 && (tier.urgency === "CRITICAL" || tier.urgency === "HIGH")) {
      isPerishable = true;
      perishableCategory = "PHARMACEUTICALS";
      pType = "Cold-Chain Biologics & Vaccines (2-8°C)";
      decayRate = 0.065;
      spoilageThresholdMin = 40.0;
      optimalTempC = 4.0;
      maxSafeTempC = 8.0;
      cargoValUsd = 1850.0;
    } else if (i % 4 === 2) {
      isPerishable = true;
      perishableCategory = "SEAFOOD_DAIRY";
      pType = "Fresh Sushi-Grade Seafood & Artisan Dairy";
      decayRate = 0.052;
      spoilageThresholdMin = 35.0;
      optimalTempC = 2.0;
      maxSafeTempC = 7.0;
      cargoValUsd = 680.0;
    } else if (i % 7 === 3) {
      isPerishable = true;
      perishableCategory = "FRESH_FLOWERS";
      pType = "Exotic Floral Bouquets & Orchids";
      decayRate = 0.038;
      spoilageThresholdMin = 50.0;
      optimalTempC = 10.0;
      maxSafeTempC = 18.0;
      cargoValUsd = 240.0;
    }

    deliveries.push({
      delivery_id: deliveryId,
      recipient,
      address: street,
      latitude: lat,
      longitude: lng,
      elevation_meters: elevation,
      urgency: tier.urgency,
      priority_score: tier.priority_score,
      package_type: pType,
      weight_kg: weight,
      time_window_start: timeStart,
      time_window_end: timeEnd,
      window_start_minutes: startOffset,
      window_end_minutes: endOffset,
      window_duration_minutes: duration,
      assigned_truck_id: truckId,
      lifo_stack_index: i,
      original_sequence: i,
      optimized_sequence: i,
      estimated_arrival_time: `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`,
      estimated_arrival_minutes: arrivalMin,
      status: "pending",
      is_delayed: false,
      delay_minutes: 0,
      customer_notified: false,
      customer_phone: `+1 (415) 555-${String(1000 + i).padStart(4, "0")}`,
      customer_email: `logistics.${deliveryId.toLowerCase()}@customer-gateway.org`,
      // Vertical Last-Mile Friction Metric (D_f)
      property_type: propertyType,
      floor_level: floorLevel,
      security_checkpoint: securityCheckpoint,
      avg_elevator_delay: avgElevatorDelay,
      dwell_friction_minutes: dwellFriction,
      curb_drive_time_minutes: 6.0,
      total_delivery_effort_minutes: Number((6.0 + dwellFriction).toFixed(1)),
      building_metadata: buildingMetadata,
      // Cold-Chain Perishability Attributes
      is_perishable: isPerishable,
      perishable_category: perishableCategory,
      decay_rate: decayRate,
      spoilage_threshold_min: spoilageThresholdMin,
      current_cargo_temp_c: optimalTempC,
      ambient_temp_c: 31.0,
      idle_stall_minutes: 0.0,
      decay_score: isPerishable ? 6.5 : 0.0,
      spoilage_risk: "SAFE",
      exponential_weight_multiplier: 1.0,
      safe_runway_remaining_min: isPerishable ? spoilageThresholdMin : 9999.0,
      cargo_value_usd: cargoValUsd,
    });
  }

  return deliveries;
}

export async function seedDatabaseIfEmpty(targetDb: Db): Promise<void> {
  const count = await targetDb.collection("deliveries").countDocuments();
  if (count === 0) {
    console.log("[CargoFlow DB] Seeding initial fleet data (50 deliveries, 3 trucks, central depot)...");
    const deliveries = generateSeedDeliveries();
    await targetDb.collection("deliveries").insertMany(deliveries as any);
    await targetDb.collection("trucks").insertMany(INITIAL_TRUCKS as any);
    await targetDb.collection("fleet_config").updateOne(
      { config_key: "depot" },
      { $set: DEPOT },
      { upsert: true }
    );
    console.log("[CargoFlow DB] Seeding completed successfully!");
  }

  const productCount = await targetDb.collection("products").countDocuments();
  if (productCount === 0) {
    await targetDb.collection("products").insertMany(INITIAL_PRODUCTS as any);
    console.log("[CargoFlow DB] Seeded product catalog (6 items).");
  }

  const driverCount = await targetDb.collection("drivers").countDocuments();
  if (driverCount === 0) {
    await targetDb.collection("drivers").insertMany(INITIAL_DRIVERS as any);
    console.log("[CargoFlow DB] Seeded fleet drivers (3 drivers).");
  }

  const customerCount = await targetDb.collection("customers").countDocuments();
  if (customerCount === 0) {
    await targetDb.collection("customers").insertMany(INITIAL_CUSTOMERS as any);
    console.log("[CargoFlow DB] Seeded demo customers (3 profiles).");
  }

  const userCount = await targetDb.collection("users").countDocuments();
  if (userCount === 0) {
    const saltRounds = 10;
    const initialUsers: User[] = [
      {
        name: "Chief Fleet Operations Director",
        email: "admin@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Admin@CargoFlow2026!", saltRounds),
        role: "ADMIN",
        adminId: "ADM-01",
        phone: "+1 (415) 555-0100",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Marcus Vance",
        email: "driver01@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Driver01@2026!", saltRounds),
        role: "DRIVER",
        driverId: "DRV-01",
        assignedVehicleId: "TRK-01",
        phone: "+1 (415) 555-0111",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Elena Rostova",
        email: "driver02@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Driver02@2026!", saltRounds),
        role: "DRIVER",
        driverId: "DRV-02",
        assignedVehicleId: "TRK-02",
        phone: "+1 (415) 555-0122",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Darnell Washington",
        email: "driver03@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Driver03@2026!", saltRounds),
        role: "DRIVER",
        driverId: "DRV-03",
        assignedVehicleId: "TRK-03",
        phone: "+1 (415) 555-0133",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Kishore Kumar",
        email: "customer01@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Customer01@2026!", saltRounds),
        role: "CUSTOMER",
        customerId: "CUST-101",
        phone: "+91 98765 43210",
        address: "350 Mission St, San Francisco, CA",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Dr. Sarah Jenkins",
        email: "customer02@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Customer02@2026!", saltRounds),
        role: "CUSTOMER",
        customerId: "CUST-102",
        phone: "+1 (415) 555-0199",
        address: "505 Parnassus Ave, San Francisco, CA",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Marcus Thorne",
        email: "customer03@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Customer03@2026!", saltRounds),
        role: "CUSTOMER",
        customerId: "CUST-103",
        phone: "+1 (415) 555-0244",
        address: "1802 Market St, San Francisco, CA",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Disabled Account Test",
        email: "disabled@cargoflow.demo",
        passwordHash: bcrypt.hashSync("Disabled@2026!", saltRounds),
        role: "CUSTOMER",
        customerId: "CUST-DIS",
        phone: "+1 (415) 555-9999",
        address: "100 Blocked Lane, San Francisco, CA",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await targetDb.collection("users").insertMany(initialUsers as any);
    console.log("[CargoFlow DB] Seeded secure user accounts with bcrypt hashes (Admin, 3 Drivers, 3 Customers, 1 Disabled).");
  }
}

export async function getDb(): Promise<Db> {
  if (db && client) {
    return db;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    // 1. If explicit MONGO_URI is set, attempt to connect to it first
    const externalUri = process.env.MONGO_URI;
    if (externalUri) {
      try {
        const extClient = new MongoClient(externalUri, {
          serverSelectionTimeoutMS: 2000,
          connectTimeoutMS: 2000,
        });
        await extClient.connect();
        client = extClient;
        db = client.db(DB_NAME);
        await seedDatabaseIfEmpty(db);
        console.log(`[CargoFlow DB] Connected to external MongoDB URI: ${externalUri}`);
        return db;
      } catch (e) {
        console.warn("[CargoFlow DB] External Mongo connection failed, starting embedded instance:", e);
      }
    }

    // 2. Start embedded in-memory MongoDB daemon
    try {
      console.log("[CargoFlow DB] Initializing embedded MongoDB server (MongoMemoryServer)...");
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          port: 27017,
        },
      });
      const uri = mongodInstance.getUri();
      console.log(`[CargoFlow DB] Embedded MongoDB active at ${uri}`);

      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      await client.connect();
      db = client.db(DB_NAME);
      await seedDatabaseIfEmpty(db);
      console.log(`[CargoFlow DB] Embedded database ready!`);
      return db;
    } catch (err) {
      // Fallback: create random port if 27017 had conflict
      console.warn("[CargoFlow DB] Retrying embedded MongoDB with ephemeral port:", err);
      mongodInstance = await MongoMemoryServer.create();
      const uri = mongodInstance.getUri();
      process.env.MONGO_URI = uri;
      client = new MongoClient(uri);
      await client.connect();
      db = client.db(DB_NAME);
      await seedDatabaseIfEmpty(db);
      console.log(`[CargoFlow DB] Embedded database ready on ephemeral port at ${uri}`);
      return db;
    }
  })();

  return initPromise;
}

export async function isMongoAlive(): Promise<boolean> {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
