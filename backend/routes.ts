import { Router, Request, Response } from "express";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { getDb, isMongoAlive, generateSeedDeliveries, INITIAL_TRUCKS, DEPOT, calculateDwellFriction, INITIAL_PRODUCTS, INITIAL_DRIVERS } from "./db.js";
import bcrypt from "bcryptjs";
import { authenticateUser, requireRole, generateToken, setAuthCookie, clearAuthCookie, COOKIE_NAME } from "./auth.js";
import { Delivery, Truck, CustomerNotification, Product, Order, Driver, User, AuthUser, UserRole } from "./types.js";
import {
  smartShuffleTruckStops,
  scanAllBatonPassCandidates,
  calculateBatonPassRelay,
  DEFAULT_RENDEZVOUS_HUBS,
} from "./algorithm.js";
import {
  isGeminiConfigured,
  generateFleetTacticalBriefing,
  analyzeBatonPassRelay,
  generateSmartCustomerNotification,
} from "./gemini.js";
import {
  broadcastTruckLocation,
  broadcastFleetUpdate,
  broadcastOrderStatus,
  broadcastNotification,
} from "./socket.js";

const execAsync = promisify(exec);
const router = Router();

// =========================================================================
// AUTHENTICATION & ACCESS CONTROL APIS
// =========================================================================

/**
 * POST /api/auth/register
 * Public customer self-registration. Strictly restricted to CUSTOMER role.
 */
router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, confirmPassword, address, property_type, floor_level } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Full Name is required." });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Password and Confirm Password do not match." });
    }
    if (!address || typeof address !== "string" || !address.trim()) {
      return res.status(400).json({ error: "Delivery address is required." });
    }

    const db = await getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existing = await db.collection("users").findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email address already exists. Please log in." });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const customerId = `CUST-${Math.floor(100 + Math.random() * 900)}`;

    const newUser: User = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "CUSTOMER", // FORCED ROLE: CUSTOMER (cannot select ADMIN or DRIVER)
      phone: phone.trim(),
      customerId,
      address: address.trim(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertRes = await db.collection("users").insertOne(newUser as any);

    // Also mirror into customers collection
    await db.collection("customers").insertOne({
      customer_id: customerId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      address: address.trim(),
      property_type: property_type || "COMMERCIAL_HIGH_RISE",
      floor_level: Number(floor_level) || 1,
      created_at: new Date(),
    });

    // Audit log
    await db.collection("audit_logs").insertOne({
      action: "CUSTOMER_REGISTERED",
      user_id: insertRes.insertedId.toString(),
      email: normalizedEmail,
      customerId,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "ACCOUNT CREATED SUCCESSFULLY",
      customerId,
    });
  } catch (error: any) {
    console.error("[Auth Register Error]:", error);
    res.status(500).json({ error: "Internal server error during registration." });
  }
});

/**
 * POST /api/auth/login
 * Unified secure login for CUSTOMER, ADMIN, and DRIVER.
 */
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password, expectedRole } = req.body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const db = await getDb();
    const queryEmail = email.toLowerCase().trim();
    const queryId = email.trim().toUpperCase();

    // Support logging in by email or by driver ID / customer ID
    const user = await db.collection<User>("users").findOne({
      $or: [
        { email: queryEmail },
        { driverId: queryId },
        { customerId: queryId },
        { adminId: queryId },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: "Account is disabled. Please contact fleet dispatch administration." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Role enforcement if specific portal requested
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        error: `ACCESS DENIED: User role '${user.role}' cannot log into the ${expectedRole} portal.`,
      });
    }

    const authUser: AuthUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
      isActive: user.isActive ?? true,
      driverId: user.driverId,
      assignedVehicleId: user.assignedVehicleId,
      customerId: user.customerId,
      address: user.address,
      adminId: user.adminId,
    };

    const token = generateToken(authUser);
    setAuthCookie(res, token);

    // Audit log
    await db.collection("audit_logs").insertOne({
      action: "USER_LOGIN",
      user_id: authUser.id,
      role: authUser.role,
      email: authUser.email,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: `Welcome, ${authUser.name}`,
      token,
      user: authUser,
    });
  } catch (error: any) {
    console.error("[Auth Login Error]:", error);
    res.status(500).json({ error: "Internal server error during authentication." });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user.
 */
router.get("/auth/me", authenticateUser, async (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Clears HttpOnly cookie session.
 */
router.post("/auth/logout", async (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

/**
 * POST /api/auth/forgot-password
 * Prototype notification that external SMTP is unconfigured.
 */
router.post("/auth/forgot-password", (req: Request, res: Response) => {
  res.status(200).json({
    success: false,
    message: "Password reset email service is not configured in this prototype. Please contact system administrator.",
  });
});


/**
 * GET /api/system-status
 * Health check reporting MongoDB and AI engine state.
 */
router.get("/system-status", async (req: Request, res: Response) => {
  try {
    const mongoConnected = await isMongoAlive();
    const db = await getDb();
    
    const deliveryCount = await db.collection("deliveries").countDocuments();
    const truckCount = await db.collection("trucks").countDocuments();
    const notificationCount = await db.collection("notifications").countDocuments();
    const orderCount = await db.collection("orders").countDocuments();
    const productCount = await db.collection("products").countDocuments();
    const depotConfig = await db.collection("config").findOne({ config_key: "depot" });
    const deliveries = await db.collection<Delivery>("deliveries").find().toArray();
    const orders = await db.collection<Order>("orders").find().toArray();
    const activeDeliveries = deliveries.filter((d) => d.status !== "delivered").length;
    const inTransitCount = deliveries.filter((d) => d.status === "in_transit" || d.status === "pending").length;
    const atRiskCount = deliveries.filter((d) => d.is_delayed).length;
    const deliveredCount = deliveries.filter((d) => d.status === "delivered").length;
    const coldChainRiskCount = deliveries.filter(
      (d) => d.is_perishable && (d.spoilage_risk === "RED_CRITICAL" || d.spoilage_risk === "AMBER_WARNING")
    ).length;

    const trucks = await db.collection<Truck>("trucks").find().toArray();
    const liveGpsCount = trucks.filter((t) => t.tracking_mode === "LIVE" && t.tracking_active).length;
    const simulatedCount = trucks.length - liveGpsCount;
    const availableTrucksCount = trucks.filter((t) => (t.current_load_kg || 0) < (t.capacity_kg || 500) * 0.9).length;

    res.json({
      status: "online",
      mongoConnected,
      geminiConfigured: isGeminiConfigured(),
      socketStatus: "online",
      database: "fleet_db",
      counts: {
        deliveries: deliveryCount,
        trucks: truckCount,
        notifications: notificationCount,
        orders: orderCount,
        products: productCount,
        active_deliveries: activeDeliveries,
        in_transit: inTransitCount,
        at_risk: atRiskCount,
        delivered: deliveredCount,
        available_trucks: availableTrucksCount,
        cold_chain_risks: coldChainRiskCount,
      },
      gps: {
        live_count: liveGpsCount,
        simulated_count: simulatedCount,
      },
      depot: depotConfig || {
        latitude: 37.7749,
        longitude: -122.4194,
        name: "CargoFlow Central Metro Depot",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, mongoConnected: false });
  }
});

/**
 * GET /api/deliveries
 * Retrieves deliveries with optional filtering by truck_id, urgency, status, or delay risk.
 */
router.get("/deliveries", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { truck_id, urgency, at_risk } = req.query;

    const query: Record<string, any> = {};
    if (truck_id && truck_id !== "ALL") {
      query.assigned_truck_id = truck_id;
    }
    if (urgency && urgency !== "ALL") {
      query.urgency = urgency;
    }
    if (at_risk === "true") {
      query.is_delayed = true;
    }

    const deliveries = await db
      .collection<Delivery>("deliveries")
      .find(query)
      .sort({ assigned_truck_id: 1, optimized_sequence: 1 })
      .toArray();

    res.json({
      count: deliveries.length,
      deliveries,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trucks
 * Retrieves all trucks with current load, status, and attached ordered deliveries.
 */
router.get("/trucks", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const trucks = await db.collection<Truck>("trucks").find().toArray();
    const allDeliveries = await db
      .collection<Delivery>("deliveries")
      .find()
      .sort({ optimized_sequence: 1 })
      .toArray();

    // Group deliveries by truck
    const enrichedTrucks = trucks.map((truck) => {
      const truckDeliveries = allDeliveries.filter(
        (d) => d.assigned_truck_id === truck.truck_id
      );
      const delayedCount = truckDeliveries.filter((d) => d.is_delayed).length;
      return {
        ...truck,
        assigned_deliveries: truckDeliveries,
        at_risk_count: delayedCount,
        total_packages: truckDeliveries.length,
        current_load_kg: Number(
          truckDeliveries.reduce((sum, d) => sum + d.weight_kg, 0).toFixed(1)
        ),
      };
    });

    res.json({
      count: enrichedTrucks.length,
      trucks: enrichedTrucks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Optimization helper that executes the Smart Shuffling algorithm and updates MongoDB directly
async function runSmartOptimization(
  truckId: string = "ALL",
  trafficDelay: number = 0,
  fuelWeight: number = 0.35,
  lifoStrictness: number = 0.30,
  dwellFrictionWeight: number = 1.0
) {
  const db = await getDb();
  const deliveriesCol = db.collection<Delivery>("deliveries");
  const trucksCol = db.collection<Truck>("trucks");
  const notificationsCol = db.collection("notifications");

  let targetTruckIds: string[] = [];
  if (truckId === "ALL" || !truckId) {
    const trucks = await trucksCol.find().toArray();
    targetTruckIds = trucks.map((t) => t.truck_id);
  } else {
    targetTruckIds = [truckId];
  }

  const depotConfig = await db.collection("fleet_config").findOne({ config_key: "depot" });
  const depotLat = depotConfig?.latitude || 37.7749;
  const depotLng = depotConfig?.longitude || -122.4194;

  const resultsByTruck: Record<string, any> = {};
  let totalPreventedDelays = 0;
  const allNotificationsCreated: any[] = [];

  for (const tId of targetTruckIds) {
    const truckDoc = await trucksCol.findOne({ truck_id: tId });
    if (!truckDoc) continue;

    const deliveries = await deliveriesCol
      .find({ assigned_truck_id: tId })
      .sort({ lifo_stack_index: 1 })
      .toArray();

    if (deliveries.length === 0) continue;

    const truckDelay = trafficDelay;
    if (truckDelay > 0) {
      await trucksCol.updateOne(
        { truck_id: tId },
        { $set: { current_traffic_delay_min: truckDelay } }
      );
    }

    const shuffleResult = smartShuffleTruckStops(
      deliveries,
      truckDoc.latitude || depotLat,
      truckDoc.longitude || depotLng,
      60.0,
      truckDelay,
      fuelWeight,
      lifoStrictness,
      depotLat,
      depotLng,
      dwellFrictionWeight
    );

    const optimizedStops = shuffleResult.optimized_stops;
    const metrics = shuffleResult.metrics;
    totalPreventedDelays += metrics.prevented_delays_count;

    for (const stop of optimizedStops) {
      await deliveriesCol.updateOne(
        { delivery_id: stop.delivery_id },
        {
          $set: {
            optimized_sequence: stop.optimized_sequence,
            estimated_arrival_time: stop.estimated_arrival_time,
            estimated_arrival_minutes: stop.estimated_arrival_minutes,
            is_delayed: stop.is_delayed,
            delay_minutes: stop.delay_minutes,
            distance_from_prev_km: stop.distance_from_prev_km || 0,
            fuel_factor: stop.fuel_factor || 1.0,
            curb_drive_time_minutes: stop.curb_drive_time_minutes || 0,
            dwell_friction_minutes: stop.dwell_friction_minutes || 2.0,
            total_delivery_effort_minutes: stop.total_delivery_effort_minutes || 0,
            updated_at: new Date(),
          },
        }
      );

      if (stop.is_delayed && !stop.customer_notified) {
        const notifDoc = {
          delivery_id: stop.delivery_id,
          truck_id: tId,
          recipient: stop.recipient,
          package_type: stop.package_type,
          urgency: stop.urgency,
          promised_window: `${stop.time_window_start} - ${stop.time_window_end}`,
          revised_eta: stop.estimated_arrival_time,
          delay_minutes: stop.delay_minutes,
          channel: "SMS_AND_EMAIL",
          recipient_phone: stop.customer_phone,
          recipient_email: stop.customer_email,
          message: `CargoFlow Alert for ${stop.recipient}: Due to traffic congestion on corridor ${tId}, your package (${stop.package_type}) ETA is revised to ${stop.estimated_arrival_time} (+${Math.round(stop.delay_minutes)}m delay). Our automated priority dispatcher has rescheduled remaining stops to expedite delivery.`,
          dispatched_at: new Date(),
        };
        await notificationsCol.insertOne(notifDoc);
        await deliveriesCol.updateOne(
          { delivery_id: stop.delivery_id },
          { $set: { customer_notified: true } }
        );
        allNotificationsCreated.push(notifDoc);
      }
    }

    resultsByTruck[tId] = {
      metrics,
      stop_count: optimizedStops.length,
      sequence_order: optimizedStops.map((s) => s.delivery_id),
    };
  }

  return {
    status: "success",
    timestamp: new Date().toISOString(),
    trucks_optimized: Object.keys(resultsByTruck),
    total_prevented_delays: totalPreventedDelays,
    results_by_truck: resultsByTruck,
    notifications_dispatched: allNotificationsCreated.length,
  };
}

/**
 * POST /api/optimize
 * Triggers the Smart Shuffling Algorithm.
 * Reorders the delivery sequence based on urgency, strict time windows,
 * physical LIFO cargo constraints, topographic fuel-efficiency, and Vertical Last-Mile Dwell Friction (D_f).
 */
router.post("/optimize", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const {
      truck_id = "ALL",
      traffic_delay = 0,
      fuel_weight = 0.35,
      lifo_strictness = 0.30,
      dwell_friction_weight = 1.0,
    } = req.body;

    const result = await runSmartOptimization(
      truck_id,
      Number(traffic_delay),
      Number(fuel_weight),
      Number(lifo_strictness),
      Number(dwell_friction_weight)
    );
    res.json(result);
  } catch (error: any) {
    console.error("[CargoFlow API] Optimization execution failed:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vertical-friction/summary
 * Returns comprehensive analytics on the Vertical Last-Mile Dwell Friction Index (D_f).
 * Compares pure curb-to-curb drive time against vertical dwell efforts (high-rises, gated communities, ground retail).
 */
router.get("/vertical-friction/summary", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const deliveries = await db.collection<Delivery>("deliveries").find().toArray();

    const highRiseList = deliveries.filter((d) => d.property_type === "COMMERCIAL_HIGH_RISE");
    const gatedVillaList = deliveries.filter((d) => d.property_type === "GATED_VILLA_COMMUNITY");
    const groundRetailList = deliveries.filter((d) => d.property_type === "GROUND_LEVEL_RETAIL");

    const totalDwellMinutes = deliveries.reduce((acc, d) => acc + (d.dwell_friction_minutes || 2.0), 0);
    const totalCurbDriveMinutes = deliveries.reduce((acc, d) => acc + (d.curb_drive_time_minutes || 5.0), 0);
    const totalEffortMinutes = totalDwellMinutes + totalCurbDriveMinutes;

    const avgElevatorWait =
      highRiseList.length > 0
        ? Number(
            (
              highRiseList.reduce((acc, d) => acc + (d.avg_elevator_delay || 0), 0) /
              highRiseList.length
            ).toFixed(1)
          )
        : 0;

    const avgFloorHighRise =
      highRiseList.length > 0
        ? Number(
            (
              highRiseList.reduce((acc, d) => acc + (d.floor_level || 1), 0) /
              highRiseList.length
            ).toFixed(1)
          )
        : 1;

    // Top high-friction delivery stops (e.g. 18th floor high-rise with security checkpoints)
    const topFrictionStops = [...deliveries]
      .sort((a, b) => (b.dwell_friction_minutes || 0) - (a.dwell_friction_minutes || 0))
      .slice(0, 6)
      .map((d) => ({
        delivery_id: d.delivery_id,
        recipient: d.recipient,
        address: d.address,
        property_type: d.property_type,
        floor_level: d.floor_level,
        security_checkpoint: d.security_checkpoint,
        avg_elevator_delay: d.avg_elevator_delay,
        dwell_friction_minutes: d.dwell_friction_minutes,
        curb_drive_time_minutes: d.curb_drive_time_minutes,
        total_delivery_effort_minutes: d.total_delivery_effort_minutes,
        urgency: d.urgency,
        assigned_truck_id: d.assigned_truck_id,
      }));

    res.json({
      total_deliveries: deliveries.length,
      metrics: {
        total_dwell_friction_minutes: Number(totalDwellMinutes.toFixed(1)),
        total_dwell_friction_hours: Number((totalDwellMinutes / 60).toFixed(1)),
        total_curb_drive_minutes: Number(totalCurbDriveMinutes.toFixed(1)),
        total_curb_drive_hours: Number((totalCurbDriveMinutes / 60).toFixed(1)),
        total_effort_minutes: Number(totalEffortMinutes.toFixed(1)),
        vertical_friction_pct_of_shift: Number(((totalDwellMinutes / totalEffortMinutes) * 100).toFixed(1)),
        avg_dwell_per_stop_minutes: Number((totalDwellMinutes / deliveries.length).toFixed(1)),
      },
      property_breakdown: {
        commercial_high_rise: {
          count: highRiseList.length,
          avg_floor: avgFloorHighRise,
          avg_elevator_delay_min: avgElevatorWait,
          security_checkpoints_count: highRiseList.filter((d) => d.security_checkpoint).length,
          avg_dwell_minutes:
            highRiseList.length > 0
              ? Number(
                  (
                    highRiseList.reduce((acc, d) => acc + (d.dwell_friction_minutes || 0), 0) /
                    highRiseList.length
                  ).toFixed(1)
                )
              : 14.2,
          typical_range: "+12 to 15 mins",
        },
        gated_villa_community: {
          count: gatedVillaList.length,
          security_gates_count: gatedVillaList.filter((d) => d.security_checkpoint).length,
          avg_dwell_minutes:
            gatedVillaList.length > 0
              ? Number(
                  (
                    gatedVillaList.reduce((acc, d) => acc + (d.dwell_friction_minutes || 0), 0) /
                    gatedVillaList.length
                  ).toFixed(1)
                )
              : 6.0,
          typical_range: "+6 mins",
        },
        ground_level_retail: {
          count: groundRetailList.length,
          avg_dwell_minutes:
            groundRetailList.length > 0
              ? Number(
                  (
                    groundRetailList.reduce((acc, d) => acc + (d.dwell_friction_minutes || 0), 0) /
                    groundRetailList.length
                  ).toFixed(1)
                )
              : 2.0,
          typical_range: "+2 mins",
        },
      },
      top_friction_stops: topFrictionStops,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/simulate-traffic
 * Simulates severe traffic congestion on a specific truck corridor (e.g. +35 mins).
 * Triggers dynamic route rescheduling and checks for SLA window breaches.
 */
router.post("/simulate-traffic", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { truck_id = "TRK-01", delay_minutes = 35 } = req.body;
    const db = await getDb();

    // Mark truck with active traffic congestion
    await db
      .collection("trucks")
      .updateOne(
        { truck_id },
        { $set: { current_traffic_delay_min: Number(delay_minutes), status: "delayed" } }
      );

    // Run dynamic re-scheduling
    const result = await runSmartOptimization(truck_id, Number(delay_minutes), 0.40, 0.30);

    // Broadcast traffic simulation event
    broadcastFleetUpdate({
      type: "TRAFFIC_SIMULATION",
      payload: { truck_id, delay_minutes: Number(delay_minutes) },
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: `Simulated ${delay_minutes}m traffic congestion on ${truck_id}. Dynamic rescheduling triggered.`,
      optimization_result: result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reassign
 * Reassigns an at-risk package to an idle or nearby truck.
 * Why: When a truck is bottlenecked by traffic, fleet managers can transfer urgent
 * packages to an adjacent delivery van to save the SLA.
 */
router.post("/reassign", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { delivery_id, target_truck_id } = req.body;
    if (!delivery_id || !target_truck_id) {
      return res.status(400).json({ error: "delivery_id and target_truck_id are required" });
    }

    const db = await getDb();
    const pkg = await db.collection<Delivery>("deliveries").findOne({ delivery_id });
    if (!pkg) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    const oldTruckId = pkg.assigned_truck_id;

    // Update assignment in MongoDB
    await db.collection("deliveries").updateOne(
      { delivery_id },
      {
        $set: {
          assigned_truck_id: target_truck_id,
          is_delayed: false,
          delay_minutes: 0,
        },
      }
    );

    // Create an audit notification record for the transfer
    await db.collection("notifications").insertOne({
      delivery_id,
      truck_id: target_truck_id,
      recipient: pkg.recipient,
      package_type: pkg.package_type,
      urgency: pkg.urgency,
      promised_window: `${pkg.time_window_start} - ${pkg.time_window_end}`,
      revised_eta: "Transferred to " + target_truck_id,
      delay_minutes: 0,
      channel: "SMS_AND_EMAIL",
      recipient_phone: pkg.customer_phone || "+1 (415) 555-0199",
      recipient_email: pkg.customer_email || "customer@notify.org",
      message: `Fleet Dispatcher Reassignment: Package ${delivery_id} (${pkg.package_type}) transferred from ${oldTruckId} to ${target_truck_id} to maintain SLA on-time delivery.`,
      dispatched_at: new Date(),
    });

    // Re-optimize both old and new trucks
    await runSmartOptimization(oldTruckId);
    await runSmartOptimization(target_truck_id);

    res.json({
      success: true,
      message: `Package ${delivery_id} successfully reassigned from ${oldTruckId} to ${target_truck_id}. Routes recalculated.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications
 * Returns customer ETA breach notifications (mock SMS / Email).
 */
router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const notifications = await db
      .collection<CustomerNotification>("notifications")
      .find()
      .sort({ dispatched_at: -1 })
      .limit(40)
      .toArray();

    res.json({
      count: notifications.length,
      notifications,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reset-data
 * Resets database with 50 fresh deliveries and 3 fleet trucks, then runs initial optimization.
 */
router.post("/reset-data", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.collection("deliveries").deleteMany({});
    await db.collection("trucks").deleteMany({});
    await db.collection("notifications").deleteMany({});
    await db.collection("baton_relays").deleteMany({});
    await db.collection("orders").deleteMany({});

    const freshDeliveries = generateSeedDeliveries();
    await db.collection("deliveries").insertMany(freshDeliveries as any);
    await db.collection("trucks").insertMany(INITIAL_TRUCKS as any);
    await db.collection("fleet_config").updateOne(
      { config_key: "depot" },
      { $set: DEPOT },
      { upsert: true }
    );

    // Ensure products and drivers are seeded
    const productCount = await db.collection("products").countDocuments();
    if (productCount === 0) {
      await db.collection("products").insertMany(INITIAL_PRODUCTS as any);
    }
    const driverCount = await db.collection("drivers").countDocuments();
    if (driverCount === 0) {
      await db.collection("drivers").insertMany(INITIAL_DRIVERS as any);
    }

    // Initial baseline optimization
    const optResult = await runSmartOptimization("ALL");

    // Broadcast reset event via Socket.IO
    broadcastFleetUpdate({
      type: "RESET",
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Database reset to fresh baseline (50 deliveries, 3 trucks, seed products & drivers).",
      optimization: optResult,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/baton-pass/scan
 * Scans fleet for multi-vehicle relay opportunities ("The Baton Pass")
 * Calculates spatio-temporal intersection coordinates and time-window overlaps.
 */
router.get("/baton-pass/scan", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const deliveries = await db.collection<Delivery>("deliveries").find().toArray();
    const trucks = await db.collection<Truck>("trucks").find().toArray();

    const relays = scanAllBatonPassCandidates(deliveries, trucks, DEFAULT_RENDEZVOUS_HUBS);

    res.json({
      status: "success",
      timestamp: new Date().toISOString(),
      total_viable_relays: relays.length,
      available_hubs: DEFAULT_RENDEZVOUS_HUBS,
      relays,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/baton-pass/calculate/:delivery_id
 * Calculates viable rendezvous hubs and trajectory intersection for a specific delivery.
 */
router.get("/baton-pass/calculate/:delivery_id", async (req: Request, res: Response) => {
  try {
    const deliveryId = req.params.delivery_id;
    const db = await getDb();
    const deliv = await db.collection<Delivery>("deliveries").findOne({ delivery_id: deliveryId });
    if (!deliv) {
      return res.status(404).json({ status: "error", message: `Delivery ${deliveryId} not found` });
    }

    const carrierId = deliv.assigned_truck_id;
    const carrier = await db.collection<Truck>("trucks").findOne({ truck_id: carrierId });
    const trucks = await db.collection<Truck>("trucks").find().toArray();

    if (!carrier) {
      return res.status(404).json({ status: "error", message: `Carrier truck ${carrierId} not found` });
    }

    const relay = calculateBatonPassRelay(deliv, carrier, trucks, 85.0, DEFAULT_RENDEZVOUS_HUBS);

    if (!relay) {
      return res.json({ status: "not_viable", message: "No viable rendezvous window found with candidate trucks" });
    }

    res.json({ status: "success", relay });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/baton-pass/execute
 * Executes a Baton Pass: transfers parcel to relay truck, sets rendezvous waypoint,
 * recalculates route vectors for both vehicles, and logs transfer alert.
 */
router.post("/baton-pass/execute", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { delivery_id, target_truck_id, hub_id } = req.body;
    if (!delivery_id || !target_truck_id) {
      return res.status(400).json({ error: "delivery_id and target_truck_id are required" });
    }

    const db = await getDb();
    const deliv = await db.collection<Delivery>("deliveries").findOne({ delivery_id });
    if (!deliv) {
      return res.status(404).json({ status: "error", message: `Delivery ${delivery_id} not found` });
    }

    const originTruckId = deliv.assigned_truck_id;
    const targetTruck = await db.collection<Truck>("trucks").findOne({ truck_id: target_truck_id });

    if (!targetTruck) {
      return res.status(404).json({ status: "error", message: `Relay truck ${target_truck_id} not found` });
    }

    const hubInfo = DEFAULT_RENDEZVOUS_HUBS.find((h) => h.id === hub_id) || DEFAULT_RENDEZVOUS_HUBS[0];

    const batonRecord = {
      delivery_id,
      origin_truck_id: originTruckId,
      relay_truck_id: target_truck_id,
      rendezvous_hub: hubInfo,
      executed_at: new Date().toISOString(),
      custody_state: "HANDOFF_SCHEDULED",
      barcode_token: `RELAY-BP-${delivery_id.slice(-4)}-TO-${target_truck_id}`,
    };

    await db.collection("deliveries").updateOne(
      { delivery_id },
      {
        $set: {
          assigned_truck_id: target_truck_id,
          is_delayed: false,
          baton_pass: batonRecord,
          updated_at: new Date(),
        },
      }
    );

    await db.collection("baton_relays").insertOne({
      ...batonRecord,
      recipient: deliv.recipient,
      package_type: deliv.package_type,
      urgency: deliv.urgency,
      created_at: new Date(),
    });

    const notifDoc = {
      delivery_id,
      truck_id: target_truck_id,
      recipient: deliv.recipient,
      package_type: deliv.package_type,
      urgency: deliv.urgency,
      promised_window: `${deliv.time_window_start} - ${deliv.time_window_end}`,
      revised_eta: "ON_SCHEDULE (Relayed)",
      delay_minutes: 0.0,
      channel: "SMS_AND_EMAIL",
      recipient_phone: deliv.customer_phone,
      recipient_email: deliv.customer_email,
      message: `CargoFlow Dynamic Relay: 'Baton Pass' executed at ${hubInfo.name}. Package ${delivery_id} transferred from ${originTruckId} to ${target_truck_id}. Guaranteed delivery window preserved.`,
      dispatched_at: new Date(),
    };
    await db.collection("notifications").insertOne(notifDoc);

    // Re-run optimization on all trucks
    await runSmartOptimization("ALL");

    // Broadcast relay event via Socket.IO
    broadcastFleetUpdate({
      type: "BATON_PASS",
      payload: batonRecord,
      timestamp: new Date().toISOString(),
    });
    broadcastOrderStatus({
      orderId: deliv.order_id || deliv.delivery_id,
      deliveryId: deliv.delivery_id,
      status: "IN_TRANSIT",
      assignedTruckId: target_truck_id,
      timestamp: new Date().toISOString(),
    });
    broadcastNotification(notifDoc);

    res.json({
      status: "success",
      message: `Baton Pass successfully executed. ${delivery_id} handed from ${originTruckId} to ${target_truck_id} at ${hubInfo.name}.`,
      baton_record: batonRecord,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/status
 * Returns current Gemini AI status and active model information.
 */
router.get("/ai/status", (req: Request, res: Response) => {
  res.json({
    configured: isGeminiConfigured(),
    model: "gemini-3.8-flash",
    capabilities: [
      "tactical_fleet_briefing",
      "baton_pass_swarm_evaluation",
      "smart_customer_notifications",
    ],
  });
});

/**
 * POST /api/ai/briefing
 * Generates an executive tactical briefing on fleet conditions using Gemini 3.8 Flash.
 */
const handleAiBriefing = async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const trucks = await db.collection<Truck>("trucks").find().toArray();
    const deliveries = await db.collection<Delivery>("deliveries").find().toArray();
    const atRiskCount = deliveries.filter((d) => d.is_delayed).length;

    // Scan for active Baton Pass relays
    const relays = scanAllBatonPassCandidates(deliveries, trucks, DEFAULT_RENDEZVOUS_HUBS);
    const relaysCount = relays.length;
    const topRelay = relays[0] || null;

    const briefing = await generateFleetTacticalBriefing({
      trucks,
      deliveries,
      atRiskCount,
      relaysCount,
      activeRelay: topRelay,
    });

    res.json({
      success: true,
      briefing,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CargoFlow AI API] Briefing error:", error);
    res.status(500).json({ error: error.message });
  }
};
router.post("/ai/briefing", authenticateUser, requireRole("ADMIN"), handleAiBriefing);
router.get("/ai/briefing", authenticateUser, requireRole("ADMIN"), handleAiBriefing);

/**
 * POST /api/ai/analyze-relay
 * Deep Gemini analysis of a Baton Pass multi-vehicle rendezvous opportunity.
 */
router.post("/ai/analyze-relay", async (req: Request, res: Response) => {
  try {
    const { relay } = req.body;
    if (!relay) {
      return res.status(400).json({ error: "relay object is required" });
    }

    const analysis = await analyzeBatonPassRelay(relay);
    res.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error("[CargoFlow AI API] Relay analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/compose-notification
 * Generates a tailored customer notification using Gemini 3.8 Flash.
 */
router.post("/ai/compose-notification", async (req: Request, res: Response) => {
  try {
    const { delivery_id, delay_minutes = 25 } = req.body;
    if (!delivery_id) {
      return res.status(400).json({ error: "delivery_id is required" });
    }

    const db = await getDb();
    const pkg = await db.collection("deliveries").findOne({ delivery_id });
    if (!pkg) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    const notification = await generateSmartCustomerNotification(pkg, delay_minutes);
    res.json({
      success: true,
      notification,
    });
  } catch (error: any) {
    console.error("[CargoFlow AI API] Notification error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cold-chain/status
 * Fleet-wide perishable inventory status, decay curves, and amber/red risk metrics.
 */
router.get("/cold-chain/status", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const deliveries = await db
      .collection<Delivery>("deliveries")
      .find({ is_perishable: true })
      .sort({ decay_score: -1 })
      .toArray();

    const redCritical = deliveries.filter((d) => d.spoilage_risk === "RED_CRITICAL");
    const amberWarning = deliveries.filter((d) => d.spoilage_risk === "AMBER_WARNING");
    const safe = deliveries.filter((d) => d.spoilage_risk === "SAFE" || !d.spoilage_risk);

    const totalAtRiskValue = [...redCritical, ...amberWarning].reduce(
      (sum, d) => sum + (d.cargo_value_usd || 450),
      0
    );

    const categoryBreakdown = {
      ICE_CREAM: deliveries.filter((d) => d.perishable_category === "ICE_CREAM").length,
      PHARMACEUTICALS: deliveries.filter((d) => d.perishable_category === "PHARMACEUTICALS").length,
      SEAFOOD_DAIRY: deliveries.filter((d) => d.perishable_category === "SEAFOOD_DAIRY").length,
      FRESH_FLOWERS: deliveries.filter((d) => d.perishable_category === "FRESH_FLOWERS").length,
    };

    const avgDecayScore =
      deliveries.length > 0
        ? Number((deliveries.reduce((sum, d) => sum + (d.decay_score || 0), 0) / deliveries.length).toFixed(1))
        : 0;

    res.json({
      total_perishable_count: deliveries.length,
      red_critical_count: redCritical.length,
      amber_warning_count: amberWarning.length,
      safe_count: safe.length,
      avg_decay_score: avgDecayScore,
      at_risk_cargo_value_usd: totalAtRiskValue,
      category_breakdown: categoryBreakdown,
      deliveries: deliveries,
    });
  } catch (error: any) {
    console.error("[CargoFlow Cold-Chain] Status query error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cold-chain/simulate-heat-stall
 * Simulates engine idling in heavy traffic under high ambient temperature.
 * 1. Invokes Python/Pandas decay curve engine to evaluate effective thermal stress.
 * 2. Emits AMBER or RED warning badges to dashboard.
 * 3. Automatically triggers dynamic smart reshuffling to deliver sensitive items before spoilage occurs.
 */
router.post("/cold-chain/simulate-heat-stall", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const {
      ambient_temp_c = 34.0,
      idle_stall_minutes = 28.0,
      truck_id = "ALL",
      auto_reshuffle = true,
    } = req.body;

    const db = await getDb();

    // 1. Run Python Pandas decay curve calculation CLI
    let pythonOutput = "";
    try {
      const pyCmd = `python3 ai_engine/decay_curve.py --ambient-temp ${ambient_temp_c} --idle-stall ${idle_stall_minutes} --sync-db`;
      const { stdout } = await execAsync(pyCmd, { timeout: 8000 });
      pythonOutput = stdout;
    } catch (pyErr: any) {
      console.warn("[CargoFlow Cold-Chain] Python CLI warning (falling back to TS engine):", pyErr.message);
    }

    // 2. Fallback / guarantee database synchronization for all perishable goods
    const heatRatio = Math.pow(Math.max(20.0, ambient_temp_c) / 22.0, 1.35);
    const perishableDeliveries = await db.collection<Delivery>("deliveries").find({ is_perishable: true }).toArray();

    for (const item of perishableDeliveries) {
      const dRate = item.decay_rate || 0.065;
      const totalExposure = (idle_stall_minutes * heatRatio) + ((item.curb_drive_time_minutes || 10.0) * 0.25);
      const decayScore = Math.min(100.0, Math.max(0.0, 100.0 * (1.0 - Math.exp(-dRate * totalExposure))));
      
      let badge: "SAFE" | "AMBER_WARNING" | "RED_CRITICAL" = "SAFE";
      if (decayScore >= 75.0) badge = "RED_CRITICAL";
      else if (decayScore >= 45.0) badge = "AMBER_WARNING";

      const stressExcess = Math.max(0.0, decayScore - 40.0);
      const expMultiplier = Math.exp(0.85 * (stressExcess / 15.0));
      const spoilThresh = item.spoilage_threshold_min || 35.0;
      const runwayRemaining = Math.max(0, spoilThresh - (idle_stall_minutes * heatRatio));
      const optT = item.perishable_category === "ICE_CREAM" ? -18.0 : 4.0;
      const curTemp = optT + Math.min(22.0, totalExposure * 0.3);

      await db.collection("deliveries").updateOne(
        { delivery_id: item.delivery_id },
        {
          $set: {
            ambient_temp_c,
            idle_stall_minutes,
            decay_score: Number(decayScore.toFixed(1)),
            spoilage_risk: badge,
            exponential_weight_multiplier: Number(expMultiplier.toFixed(2)),
            safe_runway_remaining_min: Number(runwayRemaining.toFixed(1)),
            current_cargo_temp_c: Number(curTemp.toFixed(1)),
          },
        }
      );

      // If AMBER or RED warning, create real-time notification
      if (badge === "RED_CRITICAL" || badge === "AMBER_WARNING") {
        await db.collection("notifications").insertOne({
          delivery_id: item.delivery_id,
          truck_id: item.assigned_truck_id,
          recipient: item.recipient,
          package_type: item.package_type,
          urgency: item.urgency,
          promised_window: `${item.time_window_start} - ${item.time_window_end}`,
          revised_eta: `PRIORITY SURGE (Thermal Stress: ${decayScore.toFixed(1)}%)`,
          delay_minutes: 0,
          channel: "SMS_AND_EMAIL",
          recipient_phone: item.customer_phone,
          recipient_email: item.customer_email,
          message: `[THERMAL DECAY ALERT] ${badge}: ${item.package_type} cargo temp reached ${curTemp.toFixed(1)}°C (ambient: ${ambient_temp_c}°C, idle stall: ${idle_stall_minutes}m). Exponential routing priority elevated by ${expMultiplier.toFixed(2)}x. Reshuffling route to deliver before spoilage.`,
          dispatched_at: new Date(),
        });
      }
    }

    // 3. Dynamic route reshuffling: if auto_reshuffle is true, run smart optimization
    let optimizationSummary: any = null;
    if (auto_reshuffle) {
      optimizationSummary = await runSmartOptimization(truck_id, idle_stall_minutes, 0.40, 0.35);
    }

    // Refresh updated perishable items
    const updatedPerishables = await db
      .collection<Delivery>("deliveries")
      .find({ is_perishable: true })
      .sort({ decay_score: -1 })
      .toArray();

    res.json({
      success: true,
      message: `Thermal decay simulation applied: ${ambient_temp_c}°C ambient, ${idle_stall_minutes}m idle stall. ${auto_reshuffle ? "Fleet routes automatically reshuffled." : "Routes unchanged."}`,
      ambient_temp_c,
      idle_stall_minutes,
      perishables_count: updatedPerishables.length,
      red_critical_count: updatedPerishables.filter((d) => d.spoilage_risk === "RED_CRITICAL").length,
      amber_warning_count: updatedPerishables.filter((d) => d.spoilage_risk === "AMBER_WARNING").length,
      safe_count: updatedPerishables.filter((d) => d.spoilage_risk === "SAFE").length,
      optimization: optimizationSummary,
      deliveries: updatedPerishables,
    });
  } catch (error: any) {
    console.error("[CargoFlow Cold-Chain] Simulation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// CUSTOMER PRODUCT CATALOG & ORDER MANAGEMENT
// =========================================================================

/**
 * GET /api/products
 * Retrieves available items in the demo catalog.
 */
router.get("/products", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const products = await db.collection<Product>("products").find().toArray();
    res.json({ count: products.length, products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/customers
 * Retrieves all registered customers (Admin view only).
 */
router.get("/customers", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const customers = await db.collection("customers").find().sort({ created_at: -1 }).toArray();
    res.json({ count: customers.length, customers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/customers/register
 * Customer registration.
 */
router.post("/customers/register", async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone = "+1 (415) 555-0100",
      address = "350 Mission St, San Francisco, CA",
      property_type = "COMMERCIAL_HIGH_RISE",
      floor_level = 1,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }

    const db = await getDb();
    const existing = await db.collection("customers").findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(200).json({ success: true, customer: existing, message: "Welcome back!" });
    }

    const customerId = `CUST-${Math.floor(100 + Math.random() * 900)}`;
    const newCustomer = {
      customer_id: customerId,
      name,
      email: email.toLowerCase(),
      phone,
      address,
      property_type,
      floor_level: Number(floor_level) || 1,
      created_at: new Date(),
    };

    await db.collection("customers").insertOne(newCustomer);
    res.status(201).json({ success: true, customer: newCustomer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/customers/login
 * Log in via email or customer_id.
 */
router.post("/customers/login", async (req: Request, res: Response) => {
  try {
    const { email, customer_id } = req.body;
    const db = await getDb();
    const query: Record<string, any> = {};

    if (customer_id) {
      query.customer_id = customer_id;
    } else if (email) {
      query.email = email.toLowerCase();
    } else {
      return res.status(400).json({ error: "Email or customer ID required." });
    }

    let customer = await db.collection("customers").findOne(query);
    if (!customer) {
      // Auto-create demo customer if logging in for the first time
      const customerId = `CUST-${Math.floor(100 + Math.random() * 900)}`;
      const name = email ? email.split("@")[0] : "Customer";
      const newCustomer = {
        customer_id: customerId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: email ? email.toLowerCase() : `${customerId.toLowerCase()}@client.org`,
        phone: "+1 (415) 555-0199",
        address: "350 Mission St, San Francisco, CA",
        property_type: "COMMERCIAL_HIGH_RISE",
        floor_level: 12,
        created_at: new Date(),
      };
      const insertRes = await db.collection("customers").insertOne(newCustomer as any);
      customer = { ...newCustomer, _id: insertRes.insertedId } as any;
    }

    res.json({ success: true, customer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders
 * Retrieves customer orders with data isolation: Customer can ONLY view their own orders!
 */
router.get("/orders", authenticateUser, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { customer_id, status, search } = req.query;
    const query: Record<string, any> = {};

    // Strict Customer & Driver Data Isolation
    if (req.user!.role === "CUSTOMER") {
      const activeCustId = req.user!.customerId || req.user!.id;
      query.$or = [
        { customer_id: activeCustId },
        { customer_email: req.user!.email.toLowerCase() },
      ];
    } else if (req.user!.role === "DRIVER") {
      query.assigned_truck_id = req.user!.assignedVehicleId || "NONE";
    } else {
      // ADMIN: can view all or filter by customer_id
      if (customer_id && customer_id !== "ALL") {
        query.customer_id = customer_id;
      }
    }

    if (status && status !== "ALL") {
      query.status = status;
    }
    if (search && typeof search === "string" && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      const searchConditions = [
        { order_id: regex },
        { customer_name: regex },
        { assigned_truck_id: regex },
        { delivery_id: regex },
        { "items.name": regex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const orders = await db.collection<Order>("orders").find(query).sort({ created_at: -1 }).toArray();
    res.json({ count: orders.length, orders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/orders/:orderId/assign
 * Admin manually assigns or reassigns an order to a target truck.
 */
router.patch("/orders/:orderId/assign", authenticateUser, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { target_truck_id } = req.body;
    if (!target_truck_id) {
      return res.status(400).json({ error: "target_truck_id is required." });
    }

    const db = await getDb();
    const order = await db.collection<Order>("orders").findOne({
      $or: [{ order_id: orderId }, { delivery_id: orderId }],
    });
    if (!order) {
      return res.status(404).json({ error: `Order ${orderId} not found.` });
    }

    const oldTruckId = order.assigned_truck_id;
    await db.collection("orders").updateOne(
      { order_id: order.order_id },
      {
        $set: {
          assigned_truck_id: target_truck_id,
          status: "REASSIGNED",
          updated_at: new Date(),
        },
      }
    );

    await db.collection("deliveries").updateOne(
      { delivery_id: order.delivery_id },
      {
        $set: {
          assigned_truck_id: target_truck_id,
          updated_at: new Date(),
        },
      }
    );

    // Create simulated dispatch notification
    await db.collection("notifications").insertOne({
      delivery_id: order.delivery_id,
      truck_id: target_truck_id,
      recipient: order.customer_name,
      package_type: order.items.map((i) => i.name).join(", "),
      urgency: order.priority,
      promised_window: "Reassigned Dispatch",
      revised_eta: order.estimated_arrival || "Updated shortly",
      delay_minutes: 0,
      channel: "SMS_AND_EMAIL",
      recipient_phone: order.customer_phone,
      recipient_email: order.customer_email,
      message: `[DISPATCH NOTIFICATION] Your order #${order.order_id} has been transferred from ${oldTruckId} to ${target_truck_id}. Live tracking has been updated.`,
      dispatched_at: new Date(),
    });

    // Re-optimize routes for both affected vehicles
    await runSmartOptimization(oldTruckId);
    await runSmartOptimization(target_truck_id);

    broadcastFleetUpdate({
      type: "OPTIMIZATION",
      payload: { order_id: order.order_id, target_truck_id },
      timestamp: new Date().toISOString(),
    });

    broadcastOrderStatus({
      orderId: order.order_id,
      deliveryId: order.delivery_id,
      status: "REASSIGNED",
      assignedTruckId: target_truck_id,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Order #${order.order_id} reassigned to ${target_truck_id}. Routes recalculated.`,
      order: { ...order, assigned_truck_id: target_truck_id, status: "REASSIGNED" },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders/:orderId
 * Retrieves a single order by ID. Customer can ONLY view their own order.
 */
router.get("/orders/:orderId", authenticateUser, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const db = await getDb();
    const order = await db.collection<Order>("orders").findOne({ order_id: orderId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Customer Isolation Check
    if (req.user!.role === "CUSTOMER") {
      const userCustId = req.user!.customerId || req.user!.id;
      const userEmail = req.user!.email?.toLowerCase();
      if (order.customer_id !== userCustId && order.customer_email?.toLowerCase() !== userEmail) {
        return res.status(403).json({
          authenticated: true,
          accessDenied: true,
          error: "ACCESS DENIED: You are not authorized to view another customer's order. Data isolation strictly enforced.",
        });
      }
    }

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders/:orderId/tracking
 * Dedicated customer-only tracking endpoint with strict data isolation.
 * Returns only the customer's order and assigned vehicle's location and status.
 */
router.get("/orders/:orderId/tracking", authenticateUser, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const db = await getDb();

    // Check order by order_id or delivery_id
    const order = await db.collection<Order>("orders").findOne({
      $or: [{ order_id: orderId }, { delivery_id: orderId }],
    });

    let targetDeliveryId = order?.delivery_id || orderId;
    const delivery = await db.collection<Delivery>("deliveries").findOne({ delivery_id: targetDeliveryId });

    if (!delivery && !order) {
      return res.status(404).json({ error: "Order or delivery not found" });
    }

    // Customer Isolation Check: Customer A cannot track Customer B's delivery!
    if (req.user!.role === "CUSTOMER") {
      const userCustId = req.user!.customerId || req.user!.id;
      const userEmail = req.user!.email?.toLowerCase();
      const isOwner =
        (order && (order.customer_id === userCustId || order.customer_email?.toLowerCase() === userEmail)) ||
        (delivery && (delivery.customer_email?.toLowerCase() === userEmail || delivery.recipient === req.user!.name));

      if (!isOwner) {
        return res.status(403).json({
          authenticated: true,
          accessDenied: true,
          error: "ACCESS DENIED: You are not authorized to track this delivery. Customer isolation strictly enforced.",
        });
      }
    }

    const assignedTruckId = order?.assigned_truck_id || delivery?.assigned_truck_id;
    const truck = assignedTruckId
      ? await db.collection<Truck>("trucks").findOne({ truck_id: assignedTruckId })
      : null;

    res.json({
      order_id: order?.order_id || delivery?.delivery_id,
      delivery_id: delivery?.delivery_id || order?.delivery_id,
      customer_name: order?.customer_name || delivery?.recipient,
      delivery_address: order?.delivery_address || delivery?.address,
      status: delivery?.status?.toUpperCase() || order?.status || "IN_TRANSIT",
      items: order?.items || [{ name: delivery?.package_type, quantity: 1, price_usd: delivery?.cargo_value_usd || 100 }],
      total_amount_usd: order?.total_amount_usd || delivery?.cargo_value_usd || 100,
      delivery_fee_usd: order?.delivery_fee_usd || 40,
      delivery_otp: order?.delivery_otp || delivery?.delivery_otp || "391820",
      destination: {
        latitude: delivery?.latitude || order?.latitude,
        longitude: delivery?.longitude || order?.longitude,
      },
      property_type: delivery?.property_type || order?.property_type,
      floor_level: delivery?.floor_level || order?.floor_level,
      estimated_arrival: delivery?.estimated_arrival_time || order?.estimated_arrival,
      time_window: delivery ? `${delivery.time_window_start} - ${delivery.time_window_end}` : undefined,
      assigned_truck: truck
        ? {
            truck_id: truck.truck_id,
            name: truck.name,
            driver: truck.driver,
            latitude: truck.latitude,
            longitude: truck.longitude,
            speed_kmh: truck.speed_kmh || 0,
            tracking_mode: truck.tracking_mode || "SIMULATED",
            tracking_active: Boolean(truck.tracking_active),
            last_location_at: truck.last_location_at,
          }
        : null,
      baton_pass: delivery?.baton_pass || null,
      is_perishable: delivery?.is_perishable,
      cargo_temp_c: delivery?.current_cargo_temp_c,
      spoilage_risk: delivery?.spoilage_risk,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orders
 * Customer places an order -> Stock Validation & Deduction -> Creates Order & Delivery -> Assigns Vehicle -> Runs Smart Shuffling.
 */
router.post("/orders", authenticateUser, requireRole("CUSTOMER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const isCustomer = req.user!.role === "CUSTOMER";
    const customer_id = isCustomer ? (req.user!.customerId || req.user!.id) : (req.body.customer_id || "CUST-" + Math.floor(100 + Math.random() * 900));
    const customer_name = isCustomer ? req.user!.name : (req.body.customer_name || "Valued Customer");
    const customer_email = isCustomer ? req.user!.email : (req.body.customer_email || "customer@client.org");
    const customer_phone = isCustomer ? (req.user!.phone || req.body.customer_phone || "+1 (415) 555-0199") : (req.body.customer_phone || "+1 (415) 555-0199");
    const {
      items,
      delivery_address,
      latitude,
      longitude,
      property_type = "COMMERCIAL_HIGH_RISE",
      floor_level = 1,
      access_notes = "",
      priority = "HIGH",
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one product item is required." });
    }
    if (!delivery_address) {
      return res.status(400).json({ error: "Delivery address is required." });
    }

    const db = await getDb();
    const productsCol = db.collection<Product>("products");
    const ordersCol = db.collection<Order>("orders");
    const deliveriesCol = db.collection<Delivery>("deliveries");
    const trucksCol = db.collection<Truck>("trucks");

    // Stock verification
    for (const item of items) {
      const prod = await productsCol.findOne({ product_id: item.product_id });
      if (!prod) {
        return res.status(400).json({ error: `Product ${item.product_id} not found.` });
      }
      const qty = Number(item.quantity) || 1;
      const availableStock = prod.stock ?? 25;
      if (availableStock < qty) {
        return res.status(400).json({
          error: `Insufficient stock for "${prod.name}". Requested: ${qty}, Available: ${availableStock}.`,
        });
      }
    }

    const orderItems: any[] = [];
    let subtotalAmount = 0;
    let totalWeight = 0;
    let coldChainRequired = false;
    let optimalTemp = 21.0;

    for (const item of items) {
      const prod = await productsCol.findOne({ product_id: item.product_id });
      if (prod) {
        const qty = Number(item.quantity) || 1;
        orderItems.push({
          product_id: prod.product_id,
          name: prod.name,
          quantity: qty,
          price_usd: prod.price_usd,
          weight_kg: prod.weight_kg * qty,
          is_cold_chain: prod.is_cold_chain,
        });
        subtotalAmount += prod.price_usd * qty;
        totalWeight += prod.weight_kg * qty;
        if (prod.is_cold_chain) {
          coldChainRequired = true;
          if (prod.optimal_temp_c !== undefined && prod.optimal_temp_c < optimalTemp) {
            optimalTemp = prod.optimal_temp_c;
          }
        }

        // Deduct stock in MongoDB
        await productsCol.updateOne(
          { product_id: prod.product_id },
          { $inc: { stock: -qty } }
        );
      }
    }

    const deliveryFee = 40; // Flat delivery fee
    const totalAmount = subtotalAmount + deliveryFee;

    // Coordinates fallback if not supplied (San Francisco area)
    const destLat = latitude ? Number(latitude) : Number((37.7749 + (Math.random() - 0.5) * 0.04).toFixed(6));
    const destLng = longitude ? Number(longitude) : Number((-122.4194 + (Math.random() - 0.5) * 0.05).toFixed(6));

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `CF-${randomSuffix}`;
    const deliveryId = `DEL-${randomSuffix}`;
    const deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));

    // Choose truck with lowest load
    const trucks = await trucksCol.find().toArray();
    let chosenTruck = trucks[0];
    let minLoad = chosenTruck?.current_load_kg || 0;
    for (const t of trucks) {
      if ((t.current_load_kg || 0) < minLoad) {
        minLoad = t.current_load_kg || 0;
        chosenTruck = t;
      }
    }
    const assignedTruckId = chosenTruck?.truck_id || "TRK-01";

    const floor = Number(floor_level) || 1;
    const isSecurity = property_type !== "GROUND_LEVEL_RETAIL";
    const elevatorWait = property_type === "COMMERCIAL_HIGH_RISE" ? 6.0 : 0;
    const dwellFriction = calculateDwellFriction(property_type, floor, isSecurity, elevatorWait);

    const now = new Date();
    const startH = now.getHours();
    const startM = now.getMinutes();
    const endH = (startH + 2) % 24;
    const timeStart = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    const timeEnd = `${String(endH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;

    // Upsert customer profile
    await db.collection("customers").updateOne(
      { customer_id },
      {
        $set: {
          customer_id,
          name: customer_name,
          email: customer_email.toLowerCase(),
          phone: customer_phone,
          address: delivery_address,
          property_type,
          floor_level: floor,
        },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );

    const newOrder: Order = {
      order_id: orderId,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      items: orderItems,
      total_amount_usd: totalAmount,
      delivery_fee_usd: deliveryFee,
      delivery_address,
      latitude: destLat,
      longitude: destLng,
      property_type,
      floor_level: floor,
      access_notes,
      priority,
      delivery_otp: deliveryOtp,
      status: "CONFIRMED",
      delivery_id: deliveryId,
      assigned_truck_id: assignedTruckId,
      estimated_arrival: `${String((startH + 1) % 24).padStart(2, "0")}:15`,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const newDelivery: Delivery = {
      delivery_id: deliveryId,
      order_id: orderId,
      delivery_otp: deliveryOtp,
      recipient: customer_name,
      address: delivery_address,
      latitude: destLat,
      longitude: destLng,
      elevation_meters: 25.0,
      urgency: priority,
      priority_score: priority === "CRITICAL" ? 100 : priority === "HIGH" ? 75 : 50,
      package_type: orderItems.map((i) => i.name).join(", "),
      weight_kg: Number(totalWeight.toFixed(1)),
      time_window_start: timeStart,
      time_window_end: timeEnd,
      window_start_minutes: 30,
      window_end_minutes: 150,
      window_duration_minutes: 120,
      assigned_truck_id: assignedTruckId,
      lifo_stack_index: (chosenTruck?.total_packages || 0) + 1,
      original_sequence: (chosenTruck?.total_packages || 0) + 1,
      optimized_sequence: (chosenTruck?.total_packages || 0) + 1,
      estimated_arrival_time: `${String((startH + 1) % 24).padStart(2, "0")}:15`,
      estimated_arrival_minutes: 45,
      status: "pending",
      is_delayed: false,
      delay_minutes: 0,
      customer_notified: false,
      customer_phone,
      customer_email,
      property_type,
      floor_level: floor,
      security_checkpoint: isSecurity,
      avg_elevator_delay: elevatorWait,
      dwell_friction_minutes: dwellFriction,
      curb_drive_time_minutes: 6.0,
      total_delivery_effort_minutes: Number((6.0 + dwellFriction).toFixed(1)),
      building_metadata: {
        property_type,
        property_label: property_type.replace(/_/g, " "),
        floor_level: floor,
        security_checkpoint: isSecurity,
        avg_elevator_delay: elevatorWait,
        dwell_friction_minutes: dwellFriction,
        access_notes,
      },
      is_perishable: coldChainRequired,
      perishable_category: coldChainRequired ? "PHARMACEUTICALS" : "STANDARD",
      current_cargo_temp_c: optimalTemp,
      optimal_temp_c: optimalTemp,
      ambient_temp_c: 31.0,
      safe_runway_remaining_min: coldChainRequired ? 45.0 : 9999.0,
      spoilage_risk: "SAFE",
      cargo_value_usd: totalAmount,
    };

    await ordersCol.insertOne(newOrder as any);
    await deliveriesCol.insertOne(newDelivery as any);

    // Update truck load
    await trucksCol.updateOne(
      { truck_id: assignedTruckId },
      {
        $inc: {
          current_load_kg: Number(totalWeight.toFixed(1)),
          total_packages: 1,
        },
      }
    );

    // Run Smart Shuffling
    await runSmartOptimization(assignedTruckId);

    // Create notification
    const notifDoc = {
      delivery_id: deliveryId,
      truck_id: assignedTruckId,
      recipient: newOrder.customer_name,
      package_type: newDelivery.package_type,
      urgency: priority,
      promised_window: `${timeStart} - ${timeEnd}`,
      revised_eta: newDelivery.estimated_arrival_time,
      delay_minutes: 0,
      channel: "SMS_AND_EMAIL",
      recipient_phone: newOrder.customer_phone,
      recipient_email: newOrder.customer_email,
      message: `CargoFlow: Order ${orderId} placed! Assigned to ${assignedTruckId}. Estimated arrival: ${newDelivery.estimated_arrival_time}. Delivery OTP: ${deliveryOtp}. (SIMULATED)`,
      dispatched_at: new Date(),
    };
    await db.collection("notifications").insertOne(notifDoc);

    // Socket.IO Broadcasts
    broadcastOrderStatus({
      orderId,
      deliveryId,
      status: "ASSIGNED",
      assignedTruckId,
      estimatedArrival: newDelivery.estimated_arrival_time,
      timestamp: new Date().toISOString(),
    });
    broadcastFleetUpdate({
      type: "ORDER_CREATED",
      payload: { orderId, deliveryId, assignedTruckId },
      timestamp: new Date().toISOString(),
    });
    broadcastNotification(notifDoc);

    res.status(201).json({
      success: true,
      message: `Order ${orderId} successfully placed and assigned to ${assignedTruckId}.`,
      order: newOrder,
      delivery: newDelivery,
    });
  } catch (error: any) {
    console.error("[CargoFlow Orders] Order placement error:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// DRIVER GPS TELEMETRY & LIVE TRACKING APIS
// =========================================================================

/**
 * GET /api/drivers
 * Retrieves registered driver roster.
 */
router.get("/drivers", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const drivers = await db.collection<Driver>("drivers").find().toArray();
    res.json({ count: drivers.length, drivers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trucks/:truckId/location
 * Real-time GPS ingest from driver's phone.
 * Enforces that Driver A can ONLY update Driver A's assigned truck!
 */
router.post("/trucks/:truckId/location", authenticateUser, requireRole("DRIVER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { truckId } = req.params;

    // Server-enforced vehicle match: Driver can ONLY update their assigned truck
    if (req.user!.role === "DRIVER") {
      if (req.user!.assignedVehicleId !== truckId) {
        return res.status(403).json({
          authenticated: true,
          accessDenied: true,
          error: `ACCESS DENIED: Driver '${req.user!.driverId}' is only authorized to update their assigned truck '${req.user!.assignedVehicleId}'. Cannot update '${truckId}'.`,
        });
      }
    }

    const {
      latitude,
      longitude,
      speed = 0,
      heading = 0,
      accuracy = 5,
      timestamp = new Date().toISOString(),
      driver_id,
    } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ error: "Invalid latitude. Must be between -90 and 90." });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Invalid longitude. Must be between -180 and 180." });
    }

    const db = await getDb();
    const trucksCol = db.collection<Truck>("trucks");

    const truck = await trucksCol.findOne({ truck_id: truckId });
    if (!truck) {
      return res.status(404).json({ error: `Truck ${truckId} not found.` });
    }

    const lastLocationAt = new Date(timestamp);
    await trucksCol.updateOne(
      { truck_id: truckId },
      {
        $set: {
          latitude: lat,
          longitude: lng,
          speed_kmh: Number(speed) || 0,
          heading_deg: Number(heading) || 0,
          gps_accuracy_m: Number(accuracy) || 5,
          last_location_at: lastLocationAt,
          tracking_mode: "LIVE",
          tracking_active: true,
        },
      }
    );

    // Broadcast live location to Socket.IO
    broadcastTruckLocation({
      truckId,
      latitude: lat,
      longitude: lng,
      speed: Number(speed) || 0,
      heading: Number(heading) || 0,
      accuracy: Number(accuracy) || 5,
      trackingMode: "LIVE",
      trackingActive: true,
      timestamp: lastLocationAt.toISOString(),
    });

    res.json({
      success: true,
      truckId,
      trackingMode: "LIVE",
      latitude: lat,
      longitude: lng,
      lastLocationAt: lastLocationAt.toISOString(),
    });
  } catch (error: any) {
    console.error("[CargoFlow Telemetry] Location update error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trucks/:truckId/tracking/start
 * Driver starts live GPS tracking.
 */
router.post("/trucks/:truckId/tracking/start", authenticateUser, requireRole("DRIVER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { truckId } = req.params;
    if (req.user!.role === "DRIVER" && req.user!.assignedVehicleId !== truckId) {
      return res.status(403).json({
        authenticated: true,
        accessDenied: true,
        error: `ACCESS DENIED: Driver is not authorized to control truck ${truckId}.`,
      });
    }

    const db = await getDb();
    await db.collection("trucks").updateOne(
      { truck_id: truckId },
      {
        $set: {
          tracking_mode: "LIVE",
          tracking_active: true,
          last_location_at: new Date(),
        },
      }
    );

    broadcastFleetUpdate({
      type: "OPTIMIZATION",
      payload: { truckId, trackingMode: "LIVE", trackingActive: true },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, truckId, tracking_mode: "LIVE", tracking_active: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trucks/:truckId/tracking/stop
 * Driver stops live GPS tracking.
 */
router.post("/trucks/:truckId/tracking/stop", authenticateUser, requireRole("DRIVER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { truckId } = req.params;
    if (req.user!.role === "DRIVER" && req.user!.assignedVehicleId !== truckId) {
      return res.status(403).json({
        authenticated: true,
        accessDenied: true,
        error: `ACCESS DENIED: Driver is not authorized to control truck ${truckId}.`,
      });
    }

    const { fallback_to_simulation = false } = req.body;
    const db = await getDb();
    const updateData: any = {
      tracking_active: false,
    };
    if (fallback_to_simulation) {
      updateData.tracking_mode = "SIMULATED";
    }

    await db.collection("trucks").updateOne({ truck_id: truckId }, { $set: updateData });

    broadcastFleetUpdate({
      type: "OPTIMIZATION",
      payload: { truckId, trackingActive: false, trackingMode: updateData.tracking_mode || "LIVE" },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, truckId, tracking_active: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/deliveries/:deliveryId/mark-arrived
 * Driver indicates arrival at customer destination.
 */
router.post("/deliveries/:deliveryId/mark-arrived", authenticateUser, requireRole("DRIVER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const db = await getDb();
    await db.collection("deliveries").updateOne({ delivery_id: deliveryId }, { $set: { status: "arrived" } });
    const deliv = await db.collection<Delivery>("deliveries").findOne({ delivery_id: deliveryId });
    if (deliv?.order_id) {
      await db.collection("orders").updateOne({ order_id: deliv.order_id }, { $set: { status: "ARRIVED" } });
    }

    broadcastOrderStatus({
      orderId: deliv?.order_id || deliveryId,
      deliveryId,
      status: "ARRIVED",
      assignedTruckId: deliv?.assigned_truck_id || "",
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: `Delivery ${deliveryId} marked as ARRIVED.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/deliveries/:deliveryId/confirm-otp
 * Verifies delivery OTP provided by customer to driver, completing delivery.
 */
router.post("/deliveries/:deliveryId/confirm-otp", authenticateUser, requireRole("DRIVER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const { otp, driver_id } = req.body;

    if (!otp) {
      return res.status(400).json({ error: "Delivery OTP is required." });
    }

    const db = await getDb();
    const deliveriesCol = db.collection<Delivery>("deliveries");
    const ordersCol = db.collection<Order>("orders");
    const trucksCol = db.collection<Truck>("trucks");

    const delivery = await deliveriesCol.findOne({ delivery_id: deliveryId });
    if (!delivery) {
      return res.status(404).json({ error: `Delivery ${deliveryId} not found.` });
    }

    if (driver_id) {
      const truck = await trucksCol.findOne({ truck_id: delivery.assigned_truck_id });
      if (truck && truck.driver_id && truck.driver_id !== driver_id) {
        return res.status(403).json({ error: "Unauthorized: Driver is not assigned to this vehicle." });
      }
    }

    const expectedOtp = delivery.delivery_otp || (delivery as any).otp;
    if (expectedOtp && String(otp).trim() !== String(expectedOtp).trim()) {
      return res.status(400).json({
        success: false,
        error: "Invalid delivery OTP. Please verify with the recipient.",
      });
    }

    const deliveredAt = new Date();
    await deliveriesCol.updateOne(
      { delivery_id: deliveryId },
      {
        $set: {
          status: "delivered",
          delivered_at: deliveredAt,
          is_delayed: false,
        },
      }
    );

    if (delivery.order_id) {
      await ordersCol.updateOne(
        { order_id: delivery.order_id },
        {
          $set: {
            status: "DELIVERED",
            delivered_at: deliveredAt,
            updated_at: deliveredAt,
          },
        }
      );
    }

    // Adjust truck capacity
    await trucksCol.updateOne(
      { truck_id: delivery.assigned_truck_id },
      {
        $inc: {
          current_load_kg: -Math.min(delivery.weight_kg, 100),
          total_packages: -1,
        },
      }
    );

    const completionNotif = {
      delivery_id: deliveryId,
      truck_id: delivery.assigned_truck_id,
      recipient: delivery.recipient,
      package_type: delivery.package_type,
      urgency: delivery.urgency,
      promised_window: `${delivery.time_window_start} - ${delivery.time_window_end}`,
      revised_eta: "DELIVERED",
      delay_minutes: 0,
      channel: "SMS_AND_EMAIL",
      recipient_phone: delivery.customer_phone,
      recipient_email: delivery.customer_email,
      message: `CargoFlow: Delivery ${deliveryId} successfully completed! OTP verified by driver. Thank you for using CargoFlow AI. (SIMULATED)`,
      dispatched_at: deliveredAt,
    };
    await db.collection("notifications").insertOne(completionNotif);

    broadcastOrderStatus({
      orderId: delivery.order_id || deliveryId,
      deliveryId,
      status: "DELIVERED",
      assignedTruckId: delivery.assigned_truck_id,
      otpVerified: true,
      timestamp: deliveredAt.toISOString(),
    });
    broadcastFleetUpdate({
      type: "DELIVERY_CONFIRMED",
      payload: { deliveryId, orderId: delivery.order_id, deliveredAt },
      timestamp: deliveredAt.toISOString(),
    });
    broadcastNotification(completionNotif);

    res.json({
      success: true,
      message: `Delivery ${deliveryId} confirmed and marked DELIVERED via OTP verification.`,
      delivered_at: deliveredAt.toISOString(),
    });
  } catch (error: any) {
    console.error("[CargoFlow OTP] Confirmation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// DEMO SCENARIOS API
// =========================================================================

/**
 * POST /api/demo/scenario
 * Deterministic scenario runner for live demonstrations:
 * NORMAL | HEAVY_TRAFFIC | COLD_CHAIN_EMERGENCY | HIGH_RISE_DWELL | MULTI_GRIDLOCK
 */
router.post("/demo/scenario", async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const db = await getDb();

    if (scenario === "NORMAL") {
      await db.collection("trucks").updateMany({}, { $set: { current_traffic_delay_min: 0, status: "in_transit" } });
      await db.collection("deliveries").updateMany({}, { $set: { is_delayed: false, delay_minutes: 0 } });
      const opt = await runSmartOptimization("ALL", 0);
      broadcastFleetUpdate({ type: "TRAFFIC_SIMULATION", payload: { scenario: "NORMAL" }, timestamp: new Date().toISOString() });
      return res.json({ success: true, scenario: "NORMAL", message: "Normal operations restored across all corridors.", optimization: opt });
    }

    if (scenario === "HEAVY_TRAFFIC") {
      await db.collection("trucks").updateOne({ truck_id: "TRK-01" }, { $set: { current_traffic_delay_min: 35, status: "delayed" } });
      const opt = await runSmartOptimization("TRK-01", 35, 0.4, 0.3);
      broadcastFleetUpdate({ type: "TRAFFIC_SIMULATION", payload: { scenario: "HEAVY_TRAFFIC", truckId: "TRK-01", delay: 35 }, timestamp: new Date().toISOString() });
      return res.json({
        success: true,
        scenario: "HEAVY_TRAFFIC",
        message: "Simulated +35m heavy corridor gridlock on TRK-01. Dynamic rescheduling triggered.",
        optimization: opt,
      });
    }

    if (scenario === "COLD_CHAIN_EMERGENCY") {
      await db.collection("deliveries").updateMany(
        { is_perishable: true },
        {
          $inc: { current_cargo_temp_c: 4.5, idle_stall_minutes: 25 },
          $set: { ambient_temp_c: 38.0, spoilage_risk: "AMBER_WARNING", decay_score: 55 },
        }
      );
      const opt = await runSmartOptimization("ALL", 15, 0.5, 0.2);
      broadcastFleetUpdate({ type: "TRAFFIC_SIMULATION", payload: { scenario: "COLD_CHAIN_EMERGENCY" }, timestamp: new Date().toISOString() });
      return res.json({
        success: true,
        scenario: "COLD_CHAIN_EMERGENCY",
        message: "Ambient heatwave emergency (38°C) injected. Cold-chain priority multiplier engaged.",
        optimization: opt,
      });
    }

    if (scenario === "HIGH_RISE_DWELL") {
      await db.collection("deliveries").updateMany(
        { property_type: "COMMERCIAL_HIGH_RISE" },
        { $inc: { dwell_friction_minutes: 5.0, total_delivery_effort_minutes: 5.0 } }
      );
      const opt = await runSmartOptimization("ALL", 0, 0.35, 0.3, 1.5);
      broadcastFleetUpdate({ type: "TRAFFIC_SIMULATION", payload: { scenario: "HIGH_RISE_DWELL" }, timestamp: new Date().toISOString() });
      return res.json({
        success: true,
        scenario: "HIGH_RISE_DWELL",
        message: "Commercial elevator bottleneck injected. Dwell Friction ($D_f$) re-sequenced late tower deliveries.",
        optimization: opt,
      });
    }

    if (scenario === "MULTI_GRIDLOCK") {
      await db.collection("trucks").updateOne({ truck_id: "TRK-01" }, { $set: { current_traffic_delay_min: 40, status: "delayed" } });
      await db.collection("trucks").updateOne({ truck_id: "TRK-03" }, { $set: { current_traffic_delay_min: 30, status: "delayed" } });
      const opt = await runSmartOptimization("ALL", 25);
      broadcastFleetUpdate({ type: "TRAFFIC_SIMULATION", payload: { scenario: "MULTI_GRIDLOCK" }, timestamp: new Date().toISOString() });
      return res.json({
        success: true,
        scenario: "MULTI_GRIDLOCK",
        message: "Multi-vehicle gridlock active across North and South zones. Swarm relay rendezvous candidates available.",
        optimization: opt,
      });
    }

    res.status(400).json({ error: "Invalid scenario name." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
