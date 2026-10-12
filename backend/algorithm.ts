import { Delivery, Truck, RendezvousHub, PropertyType, BuildingMetadata } from "./types.js";

const EARTH_RADIUS_KM = 6371.0;
const AVERAGE_URBAN_SPEED_KMH = 26.0;
const SERVICE_TIME_PER_STOP_MIN = 6.0;

/**
 * Resolves the Vertical Last-Mile Dwell Friction Index (D_f) in minutes
 * Commercial High-Rise: +12 to 15 mins (floor transit, security checkpoint sign-in, elevator wait queue)
 * Gated Villa Community: +6 mins (intercom gate clearance, private driveway transit)
 * Ground-Level Retail: +2 mins (storefront curb park & direct counter handover)
 */
export function getStopDwellFriction(s: Partial<Delivery>): number {
  if (s.dwell_friction_minutes && s.dwell_friction_minutes > 0) {
    return s.dwell_friction_minutes;
  }
  const prop: PropertyType =
    s.property_type || s.building_metadata?.property_type || "GROUND_LEVEL_RETAIL";
  const floor = s.floor_level || s.building_metadata?.floor_level || 1;
  const security = s.security_checkpoint ?? s.building_metadata?.security_checkpoint ?? false;
  const elevatorWait = s.avg_elevator_delay ?? s.building_metadata?.avg_elevator_delay ?? 0;

  if (prop === "COMMERCIAL_HIGH_RISE") {
    const baseWalk = 2.5;
    const securityTime = security ? 3.5 : 1.0;
    const elevatorTime = elevatorWait > 0 ? elevatorWait : 6.0;
    const floorTransit = Math.min(3.5, Math.max(0.8, (floor - 1) * 0.18));
    return Number(Math.min(15.5, Math.max(12.0, baseWalk + securityTime + elevatorTime + floorTransit)).toFixed(1));
  } else if (prop === "GATED_VILLA_COMMUNITY") {
    const gateClearance = security ? 3.5 : 1.0;
    const drivewayWalk = 2.5;
    return Number((gateClearance + drivewayWalk).toFixed(1));
  } else {
    return 2.0;
  }
}

export const DEFAULT_RENDEZVOUS_HUBS: RendezvousHub[] = [
  {
    id: "HUB-SOMA-SHELL",
    name: "Shell Fuel Station & Rapid Pull-off (8th & Harrison)",
    type: "Arterial Fuel Station / Pull-off",
    latitude: 37.7735,
    longitude: -122.4068,
    description: "Wide dual-ingress commercial vehicle apron suitable for 2-minute pull-offs.",
  },
  {
    id: "HUB-CIVIC-10TH",
    name: "Market & 10th Commercial Staging Bay",
    type: "Urban Logistics Bay",
    latitude: 37.7758,
    longitude: -122.4172,
    description: "Dedicated city commercial delivery bay with ample loading space.",
  },
  {
    id: "HUB-CALTRAIN-4TH",
    name: "Caltrain 4th & King Logistics Turnaround",
    type: "Transit Interchange Bay",
    latitude: 37.7766,
    longitude: -122.3948,
    description: "Wide transit turnaround loop ideal for safe vehicle window alignment.",
  },
  {
    id: "HUB-POTRERO-16TH",
    name: "Potrero Freight Rest Pocket (16th & Potrero)",
    type: "Industrial Staging Pocket",
    latitude: 37.7654,
    longitude: -122.4072,
    description: "Light industrial loading dock pocket allowing quick handshakes without traffic obstruction.",
  },
  {
    id: "HUB-PRESIDIO-LOMBARD",
    name: "Lombard & Richardson Highway Pull-off",
    type: "Freeway Corridor Pull-off",
    latitude: 37.7998,
    longitude: -122.4468,
    description: "Northbound highway exit pull-off for express parcel handoffs.",
  },
];

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function urbanRoadDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Number((haversineDistanceKm(lat1, lon1, lat2, lon2) * 1.32).toFixed(3));
}

export function computeTravelTimeMinutes(distanceKm: number, trafficMultiplier: number = 1.0): number {
  const speed = AVERAGE_URBAN_SPEED_KMH / trafficMultiplier;
  const hours = distanceKm / speed;
  return Number((hours * 60.0).toFixed(2));
}

export function computeElevationFuelFactor(elev1: number = 15, elev2: number = 20, distanceKm: number = 1): number {
  if (distanceKm <= 0.001) return 1.0;
  const deltaElev = elev2 - elev1;
  const grade = (deltaElev / (distanceKm * 1000.0)) * 100.0;
  if (grade > 3.0) {
    return 1.0 + Math.min(1.2, (grade - 3.0) * 0.12);
  } else if (grade < -3.0) {
    return Math.max(0.85, 1.0 - Math.abs(grade) * 0.03);
  }
  return 1.0;
}

export function computeLifoPenalty(target: Delivery, remaining: Delivery[]): number {
  const targetIdx = target.lifo_stack_index || 1;
  let blockingCount = 0;
  for (const other of remaining) {
    if (other.delivery_id === target.delivery_id) continue;
    if ((other.lifo_stack_index || 1) < targetIdx) {
      blockingCount++;
    }
  }
  return Number((blockingCount * 1.5).toFixed(2));
}

export function calculateUrgencyPriorityWeight(stop: Delivery, currentTimeMinutes: number): number {
  const baseScores: Record<string, number> = {
    CRITICAL: 100.0,
    HIGH: 75.0,
    MEDIUM: 50.0,
    LOW: 25.0,
  };
  const base = baseScores[stop.urgency] || 50.0;
  const windowEnd = stop.window_end_minutes || 480;
  const timeToDeadline = windowEnd - currentTimeMinutes;

  let urgencyMultiplier = 1.0;
  if (timeToDeadline <= 0) {
    urgencyMultiplier = 3.5;
  } else if (timeToDeadline < 30) {
    urgencyMultiplier = 2.4;
  } else if (timeToDeadline < 60) {
    urgencyMultiplier = 1.6;
  }

  return Number((base * urgencyMultiplier).toFixed(2));
}

export function smartShuffleTruckStops(
  stops: Delivery[],
  truckLat: number,
  truckLng: number,
  startTimeMinutes: number = 60.0,
  trafficDelayMinutes: number = 0.0,
  fuelWeight: number = 0.35,
  lifoStrictness: number = 0.30,
  depotLat: number = 37.7749,
  depotLng: number = -122.4194,
  dwellFrictionWeight: number = 1.0
) {
  if (!stops || stops.length === 0) {
    return {
      optimized_stops: [],
      metrics: {
        total_distance_km: 0,
        total_duration_minutes: 0,
        total_curb_drive_minutes: 0,
        total_dwell_friction_minutes: 0,
        avg_dwell_friction_minutes: 0,
        at_risk_count: 0,
        prevented_delays_count: 0,
        naive_late_count: 0,
        fuel_efficiency_score: 100,
        traffic_delay_applied_min: trafficDelayMinutes,
        shuffled_count: 0,
        dwell_friction_weight: dwellFrictionWeight,
      },
    };
  }

  // Naive sequence metrics
  // Standard GPS assumes arriving at the delivery pin equals completion, ignoring
  // vertical last-mile delays. In reality, unexpected dwell (e.g. 15m in a high-rise)
  // cascades into delays for every subsequent drop.
  let naiveDuration = 0.0;
  let currLat = truckLat;
  let currLng = truckLng;
  let simT = startTimeMinutes + trafficDelayMinutes;
  let naiveLateCount = 0;
  let totalNaiveDwell = 0.0;

  for (const s of stops) {
    const dist = urbanRoadDistanceKm(currLat, currLng, s.latitude, s.longitude);
    const tt = computeTravelTimeMinutes(dist);
    const dwell = getStopDwellFriction(s);
    totalNaiveDwell += dwell;
    simT += tt + dwell;
    naiveDuration += tt + dwell;
    if (simT > (s.window_end_minutes || 480)) {
      naiveLateCount++;
    }
    currLat = s.latitude;
    currLng = s.longitude;
  }

  const remaining = [...stops];
  const optimizedSequence: Delivery[] = [];
  let currentLat = truckLat;
  let currentLng = truckLng;
  let currentElev = 15.0;
  let currentTime = startTimeMinutes + trafficDelayMinutes;
  let totalOptDistance = 0.0;
  let totalOptDuration = 0.0;
  let totalDriveTime = 0.0;
  let totalOptDwell = 0.0;
  let totalFuelPenalty = 0.0;
  let step = 1;

  while (remaining.length > 0) {
    let bestIdx = -1;
    let lowestCost = Infinity;
    let bestTravelTime = 0;
    let bestDist = 0;
    let bestFuelFactor = 1.0;
    let bestDwell = 2.0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const distKm = urbanRoadDistanceKm(currentLat, currentLng, candidate.latitude, candidate.longitude);
      const travelTime = computeTravelTimeMinutes(distKm);
      const candElev = candidate.elevation_meters || 20.0;
      const fuelFactor = computeElevationFuelFactor(currentElev, candElev, distKm);
      const lifoPenalty = computeLifoPenalty(candidate, remaining);
      const urgencyScore = calculateUrgencyPriorityWeight(candidate, currentTime);

      // Vertical Last-Mile Friction Metric (D_f)
      const dwellFriction = getStopDwellFriction(candidate);
      const totalDeliveryEffort = travelTime + dwellFriction * dwellFrictionWeight;

      const projectedArrival = currentTime + travelTime;
      const projectedCompletion = projectedArrival + dwellFriction;
      const deadline = candidate.window_end_minutes || 480;

      let latePenalty = 0;
      if (projectedArrival > deadline) {
        const lateness = projectedArrival - deadline;
        latePenalty = 130.0 + lateness * 4.5;
      } else {
        const slack = deadline - projectedArrival;
        latePenalty = -Math.min(30.0, slack * 0.35);
      }

      // Cascading Dwell Protection:
      // A 15-minute high-rise drop right before an urgent stop can cause the subsequent window to collapse!
      let cascadeRiskPenalty = 0;
      if (dwellFriction > 8.0) {
        for (const other of remaining) {
          if (other.delivery_id === candidate.delivery_id) continue;
          if (other.urgency === "CRITICAL" || other.urgency === "HIGH") {
            const otherDeadline = other.window_end_minutes || 480;
            if (projectedCompletion + 12.0 > otherDeadline) {
              cascadeRiskPenalty += 30.0 * (other.urgency === "CRITICAL" ? 2.0 : 1.0);
            }
          }
        }
      }

      // Cold-Chain & Perishability Dynamic Decay Curve
      // Evaluates thermal stress, ambient heat, and engine idle stall
      // Elevates sorting weight exponentially to prevent spoilage
      let perishWeightMultiplier = 1.0;
      let perishUrgencyBonus = 0;
      if (candidate.is_perishable) {
        const dRate = candidate.decay_rate || 0.065;
        const ambT = candidate.ambient_temp_c || 31.5;
        const idleT = trafficDelayMinutes + (candidate.idle_stall_minutes || 0);
        const heatRatio = Math.pow(Math.max(20.0, ambT) / 22.0, 1.35);
        const cumExposure = idleT * heatRatio + travelTime * 0.28;
        const calcDecay = Math.min(100.0, Math.max(0.0, 100.0 * (1.0 - Math.exp(-dRate * Math.max(0, cumExposure)))));

        const stressExcess = Math.max(0.0, calcDecay - 40.0);
        perishWeightMultiplier = Math.exp(0.85 * (stressExcess / 15.0));
        perishUrgencyBonus = urgencyScore * (perishWeightMultiplier - 1.0) * 2.2;
      }

      // Total delivery effort replaces curb-to-curb drive time in the cost function
      const distanceCost = distKm * 3.8;
      const effortCost = totalDeliveryEffort * 2.2 * dwellFrictionWeight;
      const fuelCost = distKm * fuelFactor * 5.0 * fuelWeight;
      const lifoCost = lifoPenalty * 3.2 * lifoStrictness;
      const urgencyReduction = urgencyScore * 0.9;

      const compositeCost =
        distanceCost +
        effortCost +
        fuelCost +
        lifoCost +
        latePenalty +
        cascadeRiskPenalty -
        urgencyReduction -
        perishUrgencyBonus;

      if (compositeCost < lowestCost) {
        lowestCost = compositeCost;
        bestIdx = i;
        bestTravelTime = travelTime;
        bestDist = distKm;
        bestFuelFactor = fuelFactor;
        bestDwell = dwellFriction;
      }
    }

    const chosen = { ...remaining.splice(bestIdx, 1)[0] };
    const arrivalMinutes = currentTime + bestTravelTime;
    const departureMinutes = arrivalMinutes + bestDwell;

    const deadline = chosen.window_end_minutes || 480;
    const isDelayed = arrivalMinutes > deadline;
    const delayMinutes = Math.max(0, Number((arrivalMinutes - deadline).toFixed(1)));

    const shiftBaseMinutes = 8 * 60; // 08:00 AM
    const arrHour = Math.floor((shiftBaseMinutes + arrivalMinutes) / 60) % 24;
    const arrMin = Math.floor((shiftBaseMinutes + arrivalMinutes) % 60);
    const etaFormatted = `${String(arrHour).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}`;

    chosen.optimized_sequence = step;
    chosen.estimated_arrival_minutes = Number(arrivalMinutes.toFixed(1));
    chosen.estimated_arrival_time = etaFormatted;
    chosen.is_delayed = isDelayed;
    chosen.delay_minutes = delayMinutes;
    chosen.distance_from_prev_km = bestDist;
    chosen.fuel_factor = Number(bestFuelFactor.toFixed(2));
    chosen.curb_drive_time_minutes = Number(bestTravelTime.toFixed(1));
    chosen.dwell_friction_minutes = Number(bestDwell.toFixed(1));
    chosen.total_delivery_effort_minutes = Number((bestTravelTime + bestDwell).toFixed(1));

    // Cold-Chain Decay Evaluation for Chosen Stop
    if (chosen.is_perishable) {
      const dRate = chosen.decay_rate || 0.065;
      const ambT = chosen.ambient_temp_c || 31.5;
      const idleT = trafficDelayMinutes + (chosen.idle_stall_minutes || 0);
      const heatFactor = Math.pow(Math.max(20.0, ambT) / 22.0, 1.35);
      const cumExposure = idleT * heatFactor + arrivalMinutes * 0.25;
      const calcDecay = Math.min(100.0, Math.max(0.0, 100.0 * (1.0 - Math.exp(-dRate * Math.max(0, cumExposure)))));
      chosen.decay_score = Number(calcDecay.toFixed(1));

      if (calcDecay >= 75.0) {
        chosen.spoilage_risk = "RED_CRITICAL";
      } else if (calcDecay >= 45.0) {
        chosen.spoilage_risk = "AMBER_WARNING";
      } else {
        chosen.spoilage_risk = "SAFE";
      }

      const stressExcess = Math.max(0.0, calcDecay - 40.0);
      chosen.exponential_weight_multiplier = Number(Math.exp(0.85 * (stressExcess / 15.0)).toFixed(2));
      const spoilLim = chosen.spoilage_threshold_min || 35.0;
      chosen.safe_runway_remaining_min = Math.max(0, Number((spoilLim - idleT * heatFactor).toFixed(1)));
      const optT = chosen.perishable_category === "ICE_CREAM" ? -18.0 : 4.0;
      chosen.current_cargo_temp_c = Number((optT + Math.min(22.0, cumExposure * 0.3)).toFixed(1));
    }

    optimizedSequence.push(chosen);

    currentLat = chosen.latitude;
    currentLng = chosen.longitude;
    currentElev = chosen.elevation_meters || 20.0;
    currentTime = departureMinutes;
    totalOptDistance += bestDist;
    totalDriveTime += bestTravelTime;
    totalOptDwell += bestDwell;
    totalOptDuration += bestTravelTime + bestDwell;
    totalFuelPenalty += (bestFuelFactor - 1.0) * bestDist;
    step++;
  }

  // Return to depot
  const depotDist = urbanRoadDistanceKm(currentLat, currentLng, depotLat, depotLng);
  totalOptDistance += depotDist;
  totalOptDuration += computeTravelTimeMinutes(depotDist);

  const optLateCount = optimizedSequence.filter((s) => s.is_delayed).length;
  const preventedDelays = Math.max(0, naiveLateCount - optLateCount);
  const fuelScore = Math.max(40.0, Number((100.0 - totalFuelPenalty * 6.5).toFixed(1)));

  return {
    optimized_stops: optimizedSequence,
    metrics: {
      total_distance_km: Number(totalOptDistance.toFixed(2)),
      total_duration_minutes: Number(totalOptDuration.toFixed(1)),
      total_curb_drive_minutes: Number(totalDriveTime.toFixed(1)),
      total_dwell_friction_minutes: Number(totalOptDwell.toFixed(1)),
      avg_dwell_friction_minutes: Number((totalOptDwell / Math.max(1, optimizedSequence.length)).toFixed(1)),
      at_risk_count: optLateCount,
      prevented_delays_count: preventedDelays,
      naive_late_count: naiveLateCount,
      fuel_efficiency_score: fuelScore,
      traffic_delay_applied_min: trafficDelayMinutes,
      shuffled_count: optimizedSequence.length,
      dwell_friction_weight: dwellFrictionWeight,
    },
  };
}

export function generateTrajectoryPoints(
  p1: [number, number],
  p2: [number, number],
  steps: number = 4
): [number, number][] {
  const [lat1, lon1] = p1;
  const [lat2, lon2] = p2;
  const points: [number, number][] = [p1];
  for (let i = 1; i < steps; i++) {
    const factor = i / steps;
    const curvature = 0.00035 * Math.sin(factor * Math.PI);
    const lat = Number((lat1 + (lat2 - lat1) * factor + curvature).toFixed(6));
    const lon = Number((lon1 + (lon2 - lon1) * factor - curvature).toFixed(6));
    points.push([lat, lon]);
  }
  points.push(p2);
  return points;
}

export function minutesToClock(minutesFrom8am: number): string {
  const totalMins = Math.round(minutesFrom8am);
  const hrs = (8 + Math.floor(totalMins / 60)) % 24;
  const mins = totalMins % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function calculateBatonPassRelay(
  delivery: Delivery,
  carrierTruck: Truck,
  candidateTrucks: Truck[],
  currentSimTimeMinutes: number = 75.0,
  hubs: RendezvousHub[] = DEFAULT_RENDEZVOUS_HUBS
) {
  const carrierDelay = carrierTruck.current_traffic_delay_min || 0;
  const effectiveCarrierSpeed = Math.max(8.0, AVERAGE_URBAN_SPEED_KMH / (1.0 + carrierDelay / 20.0));

  const carrierLat = carrierTruck.latitude;
  const carrierLng = carrierTruck.longitude;
  const destLat = delivery.latitude;
  const destLng = delivery.longitude;

  const distCarrierToDest = urbanRoadDistanceKm(carrierLat, carrierLng, destLat, destLng);
  const statusQuoDriveTime = (distCarrierToDest / effectiveCarrierSpeed) * 60.0;
  const statusQuoArrivalMin = currentSimTimeMinutes + statusQuoDriveTime + carrierDelay + SERVICE_TIME_PER_STOP_MIN;
  const windowEndMin = delivery.window_end_minutes || 150.0;

  let bestRelay: any = null;
  let bestScore = -999.0;

  for (const candidate of candidateTrucks) {
    if (candidate.truck_id === carrierTruck.truck_id) continue;

    const candDelay = candidate.current_traffic_delay_min || 0;
    const candSpeed = Math.max(18.0, AVERAGE_URBAN_SPEED_KMH / (1.0 + candDelay / 35.0));
    const candLat = candidate.latitude;
    const candLng = candidate.longitude;

    for (const hub of hubs) {
      const hubLat = hub.latitude;
      const hubLng = hub.longitude;

      const distCarrierToHub = urbanRoadDistanceKm(carrierLat, carrierLng, hubLat, hubLng);
      const timeCarrierToHub = (distCarrierToHub / effectiveCarrierSpeed) * 60.0;
      const carrierHubArrivalMin = currentSimTimeMinutes + timeCarrierToHub;

      const distRelayToHub = urbanRoadDistanceKm(candLat, candLng, hubLat, hubLng);
      const timeRelayToHub = (distRelayToHub / candSpeed) * 60.0;
      const relayHubArrivalMin = currentSimTimeMinutes + timeRelayToHub;

      const waitDelta = Math.abs(carrierHubArrivalMin - relayHubArrivalMin);
      if (waitDelta > 18.0) continue;

      const syncArrivalMin = Math.max(carrierHubArrivalMin, relayHubArrivalMin);
      const transferDuration = 2.0;
      const departureMin = syncArrivalMin + transferDuration;

      const distHubToDest = urbanRoadDistanceKm(hubLat, hubLng, destLat, destLng);
      const timeHubToDest = (distHubToDest / candSpeed) * 60.0 + SERVICE_TIME_PER_STOP_MIN;
      const relayProjectedArrivalMin = departureMin + timeHubToDest;

      const minutesSaved = statusQuoArrivalMin - relayProjectedArrivalMin;
      const slaPreserved = relayProjectedArrivalMin <= windowEndMin && statusQuoArrivalMin > windowEndMin;

      if (minutesSaved < 8.0 && !slaPreserved) continue;

      const urgencyMult = delivery.urgency === "CRITICAL" ? 1.6 : delivery.urgency === "HIGH" ? 1.3 : 1.0;
      const score = minutesSaved * 2.5 * urgencyMult - waitDelta * 1.4 - distRelayToHub * 0.8;

      if (score > bestScore) {
        bestScore = score;
        const efficiencyGainPct = Number(
          ((minutesSaved / Math.max(1.0, statusQuoDriveTime + carrierDelay)) * 100.0).toFixed(1)
        );

        bestRelay = {
          delivery_id: delivery.delivery_id,
          recipient: delivery.recipient,
          package_type: delivery.package_type,
          urgency: delivery.urgency,
          rendezvous_hub: hub,
          carrier_truck: {
            truck_id: carrierTruck.truck_id,
            name: carrierTruck.name || carrierTruck.truck_id,
            driver: carrierTruck.driver || "Primary Driver",
            current_lat: carrierLat,
            current_lng: carrierLng,
            distance_to_hub_km: distCarrierToHub,
            travel_time_min: Number(timeCarrierToHub.toFixed(1)),
            hub_arrival_time: minutesToClock(carrierHubArrivalMin),
            traffic_delay_min: carrierDelay,
            trajectory_path: generateTrajectoryPoints([carrierLat, carrierLng], [hubLat, hubLng], 4),
          },
          relay_truck: {
            truck_id: candidate.truck_id,
            name: candidate.name || candidate.truck_id,
            driver: candidate.driver || "Swarm Partner",
            current_lat: candLat,
            current_lng: candLng,
            distance_to_hub_km: distRelayToHub,
            travel_time_min: Number(timeRelayToHub.toFixed(1)),
            hub_arrival_time: minutesToClock(relayHubArrivalMin),
            traffic_delay_min: candDelay,
            trajectory_path: generateTrajectoryPoints([candLat, candLng], [hubLat, hubLng], 4),
          },
          handoff_details: {
            synchronized_time: minutesToClock(syncArrivalMin),
            departure_time: minutesToClock(departureMin),
            wait_delta_minutes: Number(waitDelta.toFixed(1)),
            transfer_duration_minutes: transferDuration,
            handshake_protocol: "Window-to-Window Verified QR Scan & Barcode Handoff",
          },
          post_handoff_leg: {
            destination_lat: destLat,
            destination_lng: destLng,
            destination_address: delivery.address || "San Francisco Delivery Point",
            distance_km: distHubToDest,
            travel_time_min: Number(timeHubToDest.toFixed(1)),
            trajectory_path: generateTrajectoryPoints([hubLat, hubLng], [destLat, destLng], 4),
          },
          metrics: {
            status_quo_arrival: minutesToClock(statusQuoArrivalMin),
            relay_projected_arrival: minutesToClock(relayProjectedArrivalMin),
            sla_deadline: delivery.time_window_end || minutesToClock(windowEndMin),
            minutes_saved: Number(minutesSaved.toFixed(1)),
            sla_preserved: slaPreserved || relayProjectedArrivalMin <= windowEndMin,
            efficiency_gain_pct: efficiencyGainPct,
          },
        };
      }
    }
  }

  return bestRelay;
}

export function scanAllBatonPassCandidates(
  deliveries: Delivery[],
  trucks: Truck[],
  hubs: RendezvousHub[] = DEFAULT_RENDEZVOUS_HUBS
) {
  const truckMap = new Map<string, Truck>();
  for (const t of trucks) {
    truckMap.set(t.truck_id, t);
  }

  const viableRelays: any[] = [];
  const sorted = [...deliveries].sort((a, b) => {
    const aRisk = a.is_delayed ? 2 : a.urgency === "CRITICAL" ? 1 : 0;
    const bRisk = b.is_delayed ? 2 : b.urgency === "CRITICAL" ? 1 : 0;
    return bRisk - aRisk;
  });

  for (const deliv of sorted) {
    if (deliv.status === "delivered") continue;
    const carrier = truckMap.get(deliv.assigned_truck_id);
    if (!carrier) continue;

    const isHighRisk =
      deliv.is_delayed ||
      (carrier.current_traffic_delay_min || 0) > 0 ||
      deliv.urgency === "CRITICAL" ||
      deliv.urgency === "HIGH";

    if (!isHighRisk) continue;

    const relay = calculateBatonPassRelay(deliv, carrier, trucks, 75.0, hubs);
    if (relay) {
      viableRelays.push(relay);
    }
  }

  viableRelays.sort((a, b) => b.metrics.minutes_saved - a.metrics.minutes_saved);
  return viableRelays;
}
