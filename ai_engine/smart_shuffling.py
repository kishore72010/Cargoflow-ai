"""
CargoFlow AI — AI & Routing Engine
File: /ai_engine/smart_shuffling.py

The Core Concept & "Why":
Conventional routing engines (Dijkstra, TSP, Google Maps, OpenRouteService) solve
strictly for minimum distance or travel time. In high-stakes logistics, this causes
catastrophic delivery failures:
1. A Critical medical parcel buried at stop #9 will miss its 30-minute SLA window even if
   the truck drove the shortest physical route.
2. In a physical delivery van, parcels are loaded Last-In-First-Out (LIFO). Accessing a package
   buried deep at the front of the truck bed forces the driver to unpack and reshuffle boxes
   on the curb, introducing 10-15 minutes of unmodeled physical delay.
3. Heavy urban topography (e.g. San Francisco's 15% street inclines) burns up to 3x more fuel
   when climbing with a fully loaded vehicle than taking a flatter arterial boulevard.
4. When sudden traffic delays occur mid-route, continuing on the initial sequence cascades delays
   downstream. The Smart Shuffler performs dynamic mid-route rescheduling, shifting priorities
   and isolating at-risk packages for fleet manager reassignment.

This module implements:
- Haversine + Urban Manhattan Grid Distance Matrix
- Topographic Elevation & Fuel-Efficiency Cost Matrix
- Physical Cargo Hold LIFO Access Penalty Function
- Non-Linear SLA Time-Window Urgency Scoring
- Multi-Objective Dynamic Smart Shuffling Algorithm
"""

import math
from typing import List, Dict, Any, Tuple

# Earth radius in kilometers for Haversine calculations
EARTH_RADIUS_KM = 6371.0
AVERAGE_URBAN_SPEED_KMH = 26.0  # Realistic city speed including traffic lights
SERVICE_TIME_PER_STOP_MIN = 6.0  # Parking, walking to door, scanning parcel, signature

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two geographic coordinates.
    Why: Provides an accurate spherical baseline before applying urban street grid factor.
    """
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def compute_urban_road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Applies an Urban Grid Tortuosity Factor (1.32x Haversine).
    Why: City streets (especially grid blocks and one-ways) are not straight lines.
    A 1.32 factor closely approximates true driving road distance in urban matrices.
    """
    straight_line = haversine_distance_km(lat1, lon1, lat2, lon2)
    return round(straight_line * 1.32, 3)

def compute_travel_time_minutes(distance_km: float, traffic_multiplier: float = 1.0) -> float:
    """
    Calculates driving time in minutes with traffic congestion multiplier.
    Why: Allows dynamic injection of traffic delays on congested road corridors.
    """
    speed = AVERAGE_URBAN_SPEED_KMH / traffic_multiplier
    hours = distance_km / speed
    return round(hours * 60.0, 2)

def compute_elevation_fuel_factor(elev1_m: float, elev2_m: float, distance_km: float) -> float:
    """
    Computes topographic fuel penalty factor.
    Why: Climbing steep hills with a loaded commercial truck exponentially increases
    fuel consumption and stop-and-go engine wear. Descending or flat routes have a factor of 1.0.
    """
    delta_elevation = elev2_m - elev1_m
    if distance_km <= 0.001:
        return 1.0
    grade = (delta_elevation / (distance_km * 1000.0)) * 100.0  # Incline percentage (%)
    if grade > 3.0:
        # Steep climb: up to 2.2x fuel burn penalty
        return 1.0 + min(1.2, (grade - 3.0) * 0.12)
    elif grade < -3.0:
        # Downhill decline: fuel conservation factor
        return max(0.85, 1.0 - abs(grade) * 0.03)
    return 1.0

def compute_lifo_penalty(target_stop: Dict[str, Any], remaining_stops: List[Dict[str, Any]]) -> float:
    """
    Computes physical cargo hold accessibility penalty.
    Why: Parcels are packed inside the van in a physical stack (LIFO).
    If target_stop has a high stack index (buried deep in the bay) while parcels with
    a lower stack index (blocking the door) are still inside the truck, the driver
    must physically unpack blocking cargo on the sidewalk.
    Returns: Penalty score based on number of obstructing packages.
    """
    target_idx = target_stop.get("lifo_stack_index", 1)
    blocking_count = 0
    for other in remaining_stops:
        if other["delivery_id"] == target_stop["delivery_id"]:
            continue
        # If another remaining package is closer to the door than target, it's an obstruction
        if other.get("lifo_stack_index", 1) < target_idx:
            blocking_count += 1
    # 1.5 penalty points per obstructing parcel
    return round(blocking_count * 1.5, 2)

def calculate_urgency_priority_weight(stop: Dict[str, Any], current_time_minutes: float) -> float:
    """
    Computes dynamic urgency score taking into account package tier and time-to-deadline.
    Why: A 'HIGH' parcel due in 10 minutes is more urgent than a 'CRITICAL' parcel due in 3 hours.
    This creates an adaptive priority function rather than a static sort.
    """
    base_scores = {
        "CRITICAL": 100.0,
        "HIGH": 75.0,
        "MEDIUM": 50.0,
        "LOW": 25.0
    }
    urgency = stop.get("urgency", "MEDIUM")
    base = base_scores.get(urgency, 50.0)

    window_end = stop.get("window_end_minutes", 480)
    time_to_deadline = window_end - current_time_minutes

    # Deadline pressure multiplier
    if time_to_deadline <= 0:
        # Already late! High penalty urgency to prevent further breach
        urgency_multiplier = 3.5
    elif time_to_deadline < 30:
        # Critical window: within 30 minutes of SLA failure
        urgency_multiplier = 2.4
    elif time_to_deadline < 60:
        urgency_multiplier = 1.6
    else:
        urgency_multiplier = 1.0

    return round(base * urgency_multiplier, 2)

def calculate_dwell_friction(delivery: Dict[str, Any]) -> float:
    """
    Vertical Last-Mile Friction Metric (D_f) in minutes
    Commercial High-Rise: +12 to 15 mins (floor transit, security checkpoint sign-in, elevator wait queue)
    Gated Villa Community: +6 mins (intercom gate clearance, private driveway transit)
    Ground-Level Retail: +2 mins (storefront curb park & direct counter handover)
    """
    if "dwell_friction_minutes" in delivery and delivery["dwell_friction_minutes"]:
        return float(delivery["dwell_friction_minutes"])

    bldg = delivery.get("building_metadata") or {}
    prop = delivery.get("property_type") or bldg.get("property_type", "GROUND_LEVEL_RETAIL")
    floor = delivery.get("floor_level") or bldg.get("floor_level", 1)
    security = delivery.get("security_checkpoint", bldg.get("security_checkpoint", False))
    elevator_delay = delivery.get("avg_elevator_delay", bldg.get("avg_elevator_delay", 0.0))

    if prop == "COMMERCIAL_HIGH_RISE":
        base_walk = 2.5
        sec_time = 3.5 if security else 1.0
        elev_time = elevator_delay if elevator_delay > 0 else 6.0
        floor_transit = min(3.5, max(0.8, (floor - 1) * 0.18))
        return round(min(15.5, max(12.0, base_walk + sec_time + elev_time + floor_transit)), 1)
    elif prop == "GATED_VILLA_COMMUNITY":
        gate_time = 3.5 if security else 1.0
        return round(gate_time + 2.5, 1)
    else:
        return 2.0

def smart_shuffle_algorithm(
    stops: List[Dict[str, Any]],
    truck_lat: float,
    truck_lng: float,
    start_time_minutes: float = 60.0, # 9:00 AM (60 min after 8 AM shift)
    traffic_delay_minutes: float = 0.0,
    fuel_weight: float = 0.35,
    lifo_strictness: float = 0.30,
    depot_lat: float = 37.7749,
    depot_lng: float = -122.4194,
    dwell_friction_weight: float = 1.0
) -> Dict[str, Any]:
    """
    The Core Smart Shuffling Engine with Vertical Last-Mile Friction Metric (D_f).
    
    Why this algorithm is structured this way:
    1. Evaluates candidate stops using Total Delivery Effort = Curb Drive Time + D_f Vertical Dwell.
    2. Accounts for high-rise security checkpoints (+12 to 15m), gated villas (+6m), and ground retail (+2m).
    3. Prevents cascading SLA breaches caused by unexpected vertical delays before urgent stops.
    4. Balances physical LIFO cargo accessibility and topographic fuel penalties.
    """
    if not stops:
        return {
            "optimized_stops": [],
            "metrics": {
                "total_distance_km": 0.0,
                "total_duration_minutes": 0.0,
                "total_curb_drive_minutes": 0.0,
                "total_dwell_friction_minutes": 0.0,
                "at_risk_count": 0,
                "fuel_efficiency_score": 100.0,
                "dwell_friction_weight": dwell_friction_weight
            }
        }

    # Track baseline naive sequence metrics (original physical order) for comparison
    naive_duration = 0.0
    naive_distance = 0.0
    curr_lat, curr_lng = truck_lat, truck_lng
    sim_t = start_time_minutes + traffic_delay_minutes
    naive_late_count = 0
    total_naive_dwell = 0.0

    for s in stops:
        dist = compute_urban_road_distance_km(curr_lat, curr_lng, s["latitude"], s["longitude"])
        tt = compute_travel_time_minutes(dist)
        dwell = calculate_dwell_friction(s)
        total_naive_dwell += dwell
        sim_t += tt + dwell
        naive_duration += tt + dwell
        naive_distance += dist
        if sim_t > s["window_end_minutes"]:
            naive_late_count += 1
        curr_lat, curr_lng = s["latitude"], s["longitude"]

    # Now execute the Smart Shuffling Priority Routing Optimization
    remaining = [dict(s) for s in stops]
    optimized_sequence = []
    
    current_lat = truck_lat
    current_lng = truck_lng
    current_elevation = 15.0 # Baseline urban elevation
    current_time = start_time_minutes + traffic_delay_minutes
    
    total_opt_distance = 0.0
    total_opt_duration = 0.0
    total_drive_time = 0.0
    total_opt_dwell = 0.0
    total_fuel_penalty_accum = 0.0
    step = 1

    while remaining:
        best_candidate = None
        best_candidate_idx = -1
        lowest_cost = float("inf")
        best_travel_time = 0.0
        best_distance = 0.0
        best_fuel_factor = 1.0
        best_dwell = 2.0

        for idx, candidate in enumerate(remaining):
            dist_km = compute_urban_road_distance_km(
                current_lat, current_lng,
                candidate["latitude"], candidate["longitude"]
            )
            travel_time = compute_travel_time_minutes(dist_km)
            cand_elevation = candidate.get("elevation_meters", 20.0)
            fuel_factor = compute_elevation_fuel_factor(current_elevation, cand_elevation, dist_km)

            # LIFO Cargo bay obstruction penalty
            lifo_penalty = compute_lifo_penalty(candidate, remaining)

            # Dynamic Urgency score
            urgency_score = calculate_urgency_priority_weight(candidate, current_time)

            # Vertical Last-Mile Friction Metric (D_f)
            dwell_friction = calculate_dwell_friction(candidate)
            total_delivery_effort = travel_time + (dwell_friction * dwell_friction_weight)

            # Arrival time projection
            projected_arrival = current_time + travel_time
            projected_completion = projected_arrival + dwell_friction
            deadline = candidate.get("window_end_minutes", 480)
            
            # Severe lateness penalty if arrival breaches SLA deadline
            if projected_arrival > deadline:
                lateness_minutes = projected_arrival - deadline
                late_penalty = 130.0 + (lateness_minutes * 4.5)
            else:
                # Reward for comfortably meeting the window
                slack = deadline - projected_arrival
                late_penalty = -min(30.0, slack * 0.35)

            # Cascading Dwell Protection: Check if high-rise dwell breaks subsequent urgent deadlines
            cascade_risk = 0.0
            if dwell_friction > 8.0:
                for other in remaining:
                    if other.get("delivery_id") == candidate.get("delivery_id"):
                        continue
                    if other.get("urgency") in ["CRITICAL", "HIGH"]:
                        other_deadline = other.get("window_end_minutes", 480)
                        if projected_completion + 12.0 > other_deadline:
                            cascade_risk += 30.0 * (2.0 if other.get("urgency") == "CRITICAL" else 1.0)

            # Cold-Chain & Perishability Dynamic Decay Curve
            # If ambient heat is high or vehicle idles in traffic, sorting weight surges exponentially
            perish_weight_mult = 1.0
            perish_bonus = 0.0
            if candidate.get("is_perishable"):
                d_rate = candidate.get("decay_rate", 0.065)
                amb_t = candidate.get("ambient_temp_c", 31.5)
                idle_t = traffic_delay_minutes + candidate.get("idle_stall_minutes", 0.0)
                heat_factor = (max(20.0, amb_t) / 22.0) ** 1.35
                cum_exposure = (idle_t * heat_factor) + (travel_time * 0.28)
                cand_decay = 100.0 * (1.0 - math.exp(-d_rate * max(0.0, cum_exposure)))
                cand_decay = min(100.0, max(0.0, cand_decay))
                
                # If idle exposure exceeds safe limits (decay > 40%), sorting weight increases exponentially
                stress_excess = max(0.0, cand_decay - 40.0)
                perish_weight_mult = round(float(math.exp(0.85 * (stress_excess / 15.0))), 2)
                # Powerful negative cost pull (pulls stop forward in route before spoilage occurs)
                perish_bonus = urgency_score * (perish_weight_mult - 1.0) * 2.2

            # Normalized Composite Routing Cost
            # Total delivery effort replaces curb-to-curb drive time in the cost function
            distance_cost = dist_km * 3.8
            effort_cost = total_delivery_effort * 2.2 * dwell_friction_weight
            fuel_cost = (dist_km * fuel_factor * 5.0) * fuel_weight
            lifo_cost = (lifo_penalty * 3.2) * lifo_strictness
            urgency_reduction = urgency_score * 0.9

            composite_cost = (
                distance_cost +
                effort_cost +
                fuel_cost +
                lifo_cost +
                late_penalty +
                cascade_risk -
                urgency_reduction -
                perish_bonus
            )

            if composite_cost < lowest_cost:
                lowest_cost = composite_cost
                best_candidate = candidate
                best_candidate_idx = idx
                best_travel_time = travel_time
                best_distance = dist_km
                best_fuel_factor = fuel_factor
                best_dwell = dwell_friction

        # Select the winning candidate stop
        chosen = remaining.pop(best_candidate_idx)
        arrival_minutes = current_time + best_travel_time
        departure_minutes = arrival_minutes + best_dwell
        
        # Check deadline breach
        is_delayed = arrival_minutes > chosen.get("window_end_minutes", 480)
        delay_minutes = max(0, round(arrival_minutes - chosen.get("window_end_minutes", 480), 1))

        # Format simulated clock times (HH:MM based on 8:00 AM shift start)
        shift_base = 8 * 60 # 480 minutes from midnight
        arr_hour = int((shift_base + arrival_minutes) // 60) % 24
        arr_min = int((shift_base + arrival_minutes) % 60)
        eta_formatted = f"{arr_hour:02d}:{arr_min:02d}"

        chosen["optimized_sequence"] = step
        chosen["estimated_arrival_minutes"] = round(arrival_minutes, 1)
        chosen["estimated_arrival_time"] = eta_formatted
        chosen["is_delayed"] = is_delayed
        chosen["delay_minutes"] = delay_minutes
        chosen["distance_from_prev_km"] = best_distance
        chosen["travel_time_from_prev_min"] = best_travel_time
        chosen["fuel_factor"] = round(best_fuel_factor, 2)
        chosen["curb_drive_time_minutes"] = round(best_travel_time, 1)
        chosen["dwell_friction_minutes"] = round(best_dwell, 1)
        chosen["total_delivery_effort_minutes"] = round(best_travel_time + best_dwell, 1)

        # Cold-Chain & Perishability Decay Evaluation
        if chosen.get("is_perishable"):
            d_rate = chosen.get("decay_rate", 0.065)
            amb_t = chosen.get("ambient_temp_c", 31.5)
            idle_t = traffic_delay_minutes + chosen.get("idle_stall_minutes", 0.0)
            heat_factor = (max(20.0, amb_t) / 22.0) ** 1.35
            cum_exposure = (idle_t * heat_factor) + (arrival_minutes * 0.25)
            calc_decay = min(100.0, max(0.0, 100.0 * (1.0 - math.exp(-d_rate * max(0.0, cum_exposure)))))
            chosen["decay_score"] = round(calc_decay, 1)
            
            if calc_decay >= 75.0:
                chosen["spoilage_risk"] = "RED_CRITICAL"
            elif calc_decay >= 45.0:
                chosen["spoilage_risk"] = "AMBER_WARNING"
            else:
                chosen["spoilage_risk"] = "SAFE"
            
            stress_excess = max(0.0, calc_decay - 40.0)
            chosen["exponential_weight_multiplier"] = round(float(math.exp(0.85 * (stress_excess / 15.0))), 2)
            spoil_lim = chosen.get("spoilage_threshold_min", 35.0)
            chosen["safe_runway_remaining_min"] = max(0.0, round(spoil_lim - (idle_t * heat_factor), 1))
            
            # Simulated current cargo temperature
            opt_t = -18.0 if chosen.get("perishable_category") == "ICE_CREAM" else 4.0
            chosen["current_cargo_temp_c"] = round(opt_t + min(22.0, cum_exposure * 0.3), 1)

        optimized_sequence.append(chosen)

        # Advance simulation state
        current_lat = chosen["latitude"]
        current_lng = chosen["longitude"]
        current_elevation = chosen.get("elevation_meters", 20.0)
        current_time = departure_minutes
        total_opt_distance += best_distance
        total_drive_time += best_travel_time
        total_opt_dwell += best_dwell
        total_opt_duration += best_travel_time + best_dwell
        total_fuel_penalty_accum += (best_fuel_factor - 1.0) * best_distance
        step += 1

    # Return truck to depot distance
    depot_return_dist = compute_urban_road_distance_km(current_lat, current_lng, depot_lat, depot_lng)
    total_opt_distance += depot_return_dist
    total_opt_duration += compute_travel_time_minutes(depot_return_dist)

    # Post-optimization analysis
    opt_late_count = sum(1 for s in optimized_sequence if s["is_delayed"])
    prevented_late_count = max(0, naive_late_count - opt_late_count)
    
    # Fuel efficiency score (0 - 100)
    # Higher is better: 100 means zero hill climb penalties, lower means heavy uphill stop-and-go
    base_fuel_index = max(40.0, 100.0 - (total_fuel_penalty_accum * 6.5))

    return {
        "optimized_stops": optimized_sequence,
        "metrics": {
            "total_distance_km": round(total_opt_distance, 2),
            "total_duration_minutes": round(total_opt_duration, 1),
            "total_curb_drive_minutes": round(total_drive_time, 1),
            "total_dwell_friction_minutes": round(total_opt_dwell, 1),
            "avg_dwell_friction_minutes": round(total_opt_dwell / max(1, len(optimized_sequence)), 1),
            "at_risk_count": opt_late_count,
            "prevented_delays_count": prevented_late_count,
            "naive_late_count": naive_late_count,
            "fuel_efficiency_score": round(base_fuel_index, 1),
            "traffic_delay_applied_min": traffic_delay_minutes,
            "shuffled_count": len(optimized_sequence),
            "dwell_friction_weight": dwell_friction_weight
        }
    }
