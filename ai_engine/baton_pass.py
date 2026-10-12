"""
CargoFlow AI — AI & Routing Engine
File: /ai_engine/baton_pass.py

"The Baton Pass" (Dynamic Multi-Vehicle Relay)
=============================================================================
The Problem:
When a vehicle carrying a time-sensitive package (e.g., critical medicine,
bioreagents, or urgent legal tech) gets trapped in gridlock, conventional dispatchers
treat vehicles as isolated islands. The package inevitably misses its SLA window.

The Innovation:
The Python AI engine calculates an optimal rendezvous point (such as a highway
exit, fuel station, or logistics bay) where two company vehicles intersect.
Vehicle A hands the urgent parcel through the window to Vehicle B, which is
traveling on a clear corridor, preserving the guaranteed arrival window.

Vector Spatio-Temporal Model:
1. Trajectory Vectors:
   - Carrier Truck A: P_A(t) with congested velocity vector V_A (severely degraded in traffic)
   - Relay Truck B: P_B(t) with clear velocity vector V_B (free-flow urban arterial speed)
2. Rendezvous Hub R_k:
   - Arrival time t_A = Road_Dist(P_A, R_k) / V_A
   - Arrival time t_B = Road_Dist(P_B, R_k) / V_B
   - Synchronization Overlap Window: Delta_t = |t_A - t_B|
   - Handshake window valid if Delta_t <= 18.0 mins (low curb idle time)
3. Handoff Protocol:
   - Synchronized Handshake Arrival: t_sync = max(t_A, t_B)
   - Window-to-Window Custody Transfer: +2.0 minutes
   - Post-Handoff Sprint to Destination via Truck B: t_dest = Road_Dist(R_k, Dest) / V_B
   - Minutes Saved = Status_Quo_Arrival - (t_sync + 2.0 + t_dest)
=============================================================================
"""

import math
from typing import List, Dict, Any, Optional

# Earth radius in kilometers for spherical geodesics
EARTH_RADIUS_KM = 6371.0
AVERAGE_URBAN_SPEED_KMH = 26.0
SERVICE_TIME_PER_STOP_MIN = 6.0

DEFAULT_RENDEZVOUS_HUBS: List[Dict[str, Any]] = [
    {
        "hub_id": "HUB-SOMA-SHELL",
        "name": "Shell Fuel Station & Rapid Pull-off (8th & Harrison)",
        "type": "Arterial Fuel Station / Pull-off",
        "address": "798 Harrison St, San Francisco, CA",
        "latitude": 37.7735,
        "longitude": -122.4068,
        "elevation_meters": 18
    },
    {
        "hub_id": "HUB-CIVIC-10TH",
        "name": "Market & 10th Commercial Staging Bay",
        "type": "Urban Logistics Bay",
        "address": "1390 Market St, San Francisco, CA",
        "latitude": 37.7758,
        "longitude": -122.4172,
        "elevation_meters": 15
    },
    {
        "hub_id": "HUB-CALTRAIN-4TH",
        "name": "Caltrain 4th & King Logistics Turnaround",
        "type": "Transit Interchange Bay",
        "address": "700 4th St, San Francisco, CA",
        "latitude": 37.7766,
        "longitude": -122.3948,
        "elevation_meters": 5
    },
    {
        "hub_id": "HUB-POTRERO-16TH",
        "name": "Potrero Freight Rest Pocket (16th & Potrero)",
        "type": "Industrial Staging Pocket",
        "address": "2200 16th St, San Francisco, CA",
        "latitude": 37.7654,
        "longitude": -122.4072,
        "elevation_meters": 22
    },
    {
        "hub_id": "HUB-PRESIDIO-LOMBARD",
        "name": "Lombard & Richardson Highway Pull-off",
        "type": "Freeway Corridor Pull-off",
        "address": "2100 Lombard St, San Francisco, CA",
        "latitude": 37.7998,
        "longitude": -122.4468,
        "elevation_meters": 28
    }
]

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # 1.32 tortuosity factor for realistic SF grid blocks
    return round(haversine_km(lat1, lon1, lat2, lon2) * 1.32, 3)

def generate_trajectory_points(p1: List[float], p2: List[float], steps: int = 4) -> List[List[float]]:
    """
    Generates realistic intermediate polyline points with slight urban road curvatures.
    """
    lat1, lon1 = p1
    lat2, lon2 = p2
    points = [p1]
    for i in range(1, steps):
        factor = i / steps
        curvature = 0.00035 * math.sin(factor * math.pi)
        lat = round(lat1 + (lat2 - lat1) * factor + curvature, 6)
        lon = round(lon1 + (lon2 - lon1) * factor - curvature, 6)
        points.append([lat, lon])
    points.append(p2)
    return points

def minutes_to_clock(minutes_from_8am: float) -> str:
    """Converts simulation minutes (where 0 min = 08:00 AM) to a clean 24h/12h clock string."""
    total_mins = int(round(minutes_from_8am))
    hrs = (8 + total_mins // 60) % 24
    mins = total_mins % 60
    return f"{hrs:02d}:{mins:02d}"

def calculate_baton_pass_relay(
    delivery: Dict[str, Any],
    carrier_truck: Dict[str, Any],
    candidate_trucks: List[Dict[str, Any]],
    current_sim_time_minutes: float = 75.0,
    hubs: List[Dict[str, Any]] = DEFAULT_RENDEZVOUS_HUBS
) -> Optional[Dict[str, Any]]:
    """
    Calculates the single highest-scoring Baton Pass relay for a given delivery.
    """
    carrier_delay = float(carrier_truck.get("current_traffic_delay_min", 0.0))
    # If carrier is delayed or delivery is flagged delayed, speed is degraded down to 8-12 km/h
    effective_carrier_speed = max(8.0, AVERAGE_URBAN_SPEED_KMH / (1.0 + carrier_delay / 20.0))

    carrier_lat = carrier_truck["latitude"]
    carrier_lng = carrier_truck["longitude"]

    dest_lat = delivery["latitude"]
    dest_lng = delivery["longitude"]

    # Status-quo ETA if carrier truck stays alone through the traffic jam:
    dist_carrier_to_dest = road_distance_km(carrier_lat, carrier_lng, dest_lat, dest_lng)
    status_quo_drive_time = (dist_carrier_to_dest / effective_carrier_speed) * 60.0
    status_quo_arrival_min = current_sim_time_minutes + status_quo_drive_time + carrier_delay + SERVICE_TIME_PER_STOP_MIN

    window_end_min = delivery.get("window_end_minutes", 150.0)

    best_relay = None
    best_score = -999.0

    for candidate in candidate_trucks:
        candidate_id = candidate["truck_id"]
        if candidate_id == carrier_truck["truck_id"]:
            continue

        cand_delay = float(candidate.get("current_traffic_delay_min", 0.0))
        # Clear corridor vehicle speed
        cand_speed = max(18.0, AVERAGE_URBAN_SPEED_KMH / (1.0 + cand_delay / 35.0))
        cand_lat = candidate["latitude"]
        cand_lng = candidate["longitude"]

        for hub in hubs:
            hub_lat = hub["latitude"]
            hub_lng = hub["longitude"]

            # Carrier Leg to Hub
            dist_carrier_to_hub = road_distance_km(carrier_lat, carrier_lng, hub_lat, hub_lng)
            time_carrier_to_hub = (dist_carrier_to_hub / effective_carrier_speed) * 60.0
            carrier_hub_arrival_min = current_sim_time_minutes + time_carrier_to_hub

            # Relay Leg to Hub
            dist_relay_to_hub = road_distance_km(cand_lat, cand_lng, hub_lat, hub_lng)
            time_relay_to_hub = (dist_relay_to_hub / cand_speed) * 60.0
            relay_hub_arrival_min = current_sim_time_minutes + time_relay_to_hub

            # Time Window Overlap
            wait_delta = abs(carrier_hub_arrival_min - relay_hub_arrival_min)
            if wait_delta > 18.0:
                # Discard: wait on the curb would be excessive
                continue

            # Handshake happens when both arrive
            sync_arrival_min = max(carrier_hub_arrival_min, relay_hub_arrival_min)
            transfer_duration = 2.0  # 2 minute physical custody exchange
            departure_min = sync_arrival_min + transfer_duration

            # Post-Handoff Sprint to Delivery Destination via Relay Truck
            dist_hub_to_dest = road_distance_km(hub_lat, hub_lng, dest_lat, dest_lng)
            time_hub_to_dest = (dist_hub_to_dest / cand_speed) * 60.0 + SERVICE_TIME_PER_STOP_MIN
            relay_projected_arrival_min = departure_min + time_hub_to_dest

            minutes_saved = status_quo_arrival_min - relay_projected_arrival_min

            # We need positive savings or an SLA rescue
            sla_preserved = (relay_projected_arrival_min <= window_end_min) and (status_quo_arrival_min > window_end_min)

            if minutes_saved < 10.0 and not sla_preserved:
                continue

            # Multi-objective score: weight time saved against driver wait time and detour km
            urgency = delivery.get("urgency", "MEDIUM")
            urgency_mult = 1.6 if urgency == "CRITICAL" else (1.3 if urgency == "HIGH" else 1.0)
            score = (minutes_saved * 2.5 * urgency_mult) - (wait_delta * 1.4) - (dist_relay_to_hub * 0.8)

            if score > best_score:
                best_score = score
                efficiency_gain_pct = round((minutes_saved / max(1.0, status_quo_drive_time + carrier_delay)) * 100.0, 1)

                best_relay = {
                    "delivery_id": delivery["delivery_id"],
                    "recipient": delivery["recipient"],
                    "package_type": delivery["package_type"],
                    "urgency": urgency,
                    "rendezvous_hub": hub,
                    "carrier_truck": {
                        "truck_id": carrier_truck["truck_id"],
                        "name": carrier_truck.get("name", carrier_truck["truck_id"]),
                        "driver": carrier_truck.get("driver", "Primary Driver"),
                        "current_lat": carrier_lat,
                        "current_lng": carrier_lng,
                        "distance_to_hub_km": dist_carrier_to_hub,
                        "travel_time_min": round(time_carrier_to_hub, 1),
                        "hub_arrival_time": minutes_to_clock(carrier_hub_arrival_min),
                        "traffic_delay_min": carrier_delay,
                        "trajectory_path": generate_trajectory_points([carrier_lat, carrier_lng], [hub_lat, hub_lng], 4)
                    },
                    "relay_truck": {
                        "truck_id": candidate["truck_id"],
                        "name": candidate.get("name", candidate["truck_id"]),
                        "driver": candidate.get("driver", "Swarm Partner"),
                        "current_lat": cand_lat,
                        "current_lng": cand_lng,
                        "distance_to_hub_km": dist_relay_to_hub,
                        "travel_time_min": round(time_relay_to_hub, 1),
                        "hub_arrival_time": minutes_to_clock(relay_hub_arrival_min),
                        "traffic_delay_min": cand_delay,
                        "trajectory_path": generate_trajectory_points([cand_lat, cand_lng], [hub_lat, hub_lng], 4)
                    },
                    "handoff_details": {
                        "synchronized_time": minutes_to_clock(sync_arrival_min),
                        "departure_time": minutes_to_clock(departure_min),
                        "wait_delta_minutes": round(wait_delta, 1),
                        "transfer_duration_minutes": transfer_duration,
                        "handshake_protocol": "Window-to-Window Verified QR Scan & Barcode Handoff"
                    },
                    "post_handoff_leg": {
                        "destination_lat": dest_lat,
                        "destination_lng": dest_lng,
                        "destination_address": delivery.get("address", "San Francisco Delivery Point"),
                        "distance_km": dist_hub_to_dest,
                        "travel_time_min": round(time_hub_to_dest, 1),
                        "trajectory_path": generate_trajectory_points([hub_lat, hub_lng], [dest_lat, dest_lng], 4)
                    },
                    "metrics": {
                        "status_quo_arrival": minutes_to_clock(status_quo_arrival_min),
                        "relay_projected_arrival": minutes_to_clock(relay_projected_arrival_min),
                        "sla_deadline": delivery.get("time_window_end", minutes_to_clock(window_end_min)),
                        "minutes_saved": round(minutes_saved, 1),
                        "sla_preserved": sla_preserved or (relay_projected_arrival_min <= window_end_min),
                        "efficiency_gain_pct": efficiency_gain_pct
                    }
                }

    return best_relay

def scan_all_baton_pass_candidates(
    deliveries: List[Dict[str, Any]],
    trucks: List[Dict[str, Any]],
    hubs: List[Dict[str, Any]] = DEFAULT_RENDEZVOUS_HUBS
) -> List[Dict[str, Any]]:
    """
    Scans the active fleet for high-impact Baton Pass opportunities.
    Ranks viable relays across all delayed or critical shipments.
    """
    truck_map = {t["truck_id"]: t for t in trucks}
    viable_relays = []

    # Sort deliveries: Delayed or Critical first
    sorted_delivs = sorted(
        deliveries,
        key=lambda d: (
            1 if d.get("is_delayed") else 0,
            2 if d.get("urgency") == "CRITICAL" else (1 if d.get("urgency") == "HIGH" else 0)
        ),
        reverse=True
    )

    for deliv in sorted_delivs:
        if deliv.get("status") == "delivered":
            continue

        carrier_id = deliv.get("assigned_truck_id")
        carrier = truck_map.get(carrier_id)
        if not carrier:
            continue

        # If truck has delay or delivery is critical/delayed, test relay
        is_high_risk = deliv.get("is_delayed", False) or carrier.get("current_traffic_delay_min", 0.0) > 0 or deliv.get("urgency") in ["CRITICAL", "HIGH"]
        if not is_high_risk:
            continue

        relay = calculate_baton_pass_relay(
            delivery=deliv,
            carrier_truck=carrier,
            candidate_trucks=trucks,
            current_sim_time_minutes=75.0,
            hubs=hubs
        )
        if relay:
            viable_relays.append(relay)

    # Sort by minutes saved descending
    viable_relays.sort(key=lambda r: r["metrics"]["minutes_saved"], reverse=True)
    return viable_relays
