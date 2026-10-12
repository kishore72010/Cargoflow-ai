"""
CargoFlow AI — AI & Routing Engine
File: /ai_engine/generate_data.py

Why this script is written this way:
1. Deterministic Seeding (seed=42): Guarantees identical baseline datasets across all development
   and test runs. Route rescheduling algorithms can only be objectively compared if initial conditions
   and coordinates are identical.
2. Centered Metro Depot (San Francisco Hub): Simulates realistic urban geography around Market St/SOMA
   (37.7749, -122.4194) with realistic geographic clusters.
3. Priority Urgency Categorization: Divides 50 parcels into CRITICAL, HIGH, MEDIUM, and LOW tiers
   with explicit SLA scores (100, 75, 50, 25) and constrained time windows (e.g. 45-90 min for CRITICAL).
4. Physical LIFO Cargo Index: Delivery vans are loaded back-to-front. An item loaded at index 1 is at
   the rear door (instant retrieval); index 50 is deep inside the truck bay (requires unloading obstacles).
5. Pandas Data Processing: Normalizes data types, computes start/end time offsets, and prepares clean
   dictionaries for bulk database ingestion.
6. MongoDB Storage: Stores the clean dataset in 'fleet_db.deliveries' and registers depot configuration
   in 'fleet_db.fleet_config'.
"""

import sys
import datetime
import random
import numpy as np
import pandas as pd
from pymongo import MongoClient, ASCENDING

RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

DEPOT_COORDINATES = {
    "lat": 37.7749,
    "lng": -122.4194,
    "name": "CargoFlow Central Metro Depot (SF Hub #1)"
}
TOTAL_DELIVERIES = 50

URGENCY_TIERS = {
    "CRITICAL": {
        "weight": 0.18,  # ~9 packages
        "min_window_len": 45,
        "max_window_len": 80,
        "types": ["Emergency Medical Supplies", "Urgent Legal Documents", "Perishable Bioreagents"],
        "priority_score": 100
    },
    "HIGH": {
        "weight": 0.28,  # ~14 packages
        "min_window_len": 60,
        "max_window_len": 120,
        "types": ["Refrigerated Goods", "Express High-Value Tech", "Cold-Chain Pharmaceuticals"],
        "priority_score": 75
    },
    "MEDIUM": {
        "weight": 0.34,  # ~17 packages
        "min_window_len": 90,
        "max_window_len": 180,
        "types": ["Retail Restock", "Commercial Office Hardware", "Apparel & Consumer Goods"],
        "priority_score": 50
    },
    "LOW": {
        "weight": 0.20,  # ~10 packages
        "min_window_len": 150,
        "max_window_len": 320,
        "types": ["Standard Catalog Parcels", "Dry Storage Materials", "Bulk Consolidated Cargo"],
        "priority_score": 25
    }
}

RECIPIENTS = [
    "Apex Medical Urgent Care", "St. Jude Clinical Labs", "Mission Bay BioPharma",
    "OmniTech Robotics R&D", "Silicon Horizon Systems", "CloudScale Datacenter",
    "Pioneer Legal Group", "Veritas Law Chambers", "Bayview Diagnostic Center",
    "Golden Gate Regional Grocers", "Artisan Bakery Hub", "GreenLeaf Organic Foods",
    "Pacific Science Academy", "Sunset Audio Visual Labs", "Presidio Architecture Co.",
    "Valencia Books & Print", "SOMA Digital Media", "Marina Specialty Pharmacy",
    "Embarcadero Financial Partners", "North Beach Hardware", "Dogpatch Maker Space",
    "Financial District Logistics", "Richmond Clinical Sciences", "Beacon Hill Engineering"
]

STREETS = [
    "Market St", "Mission St", "Howard St", "Folsom St", "Harrison St",
    "Valencia St", "Guerrero St", "Van Ness Ave", "Geary Blvd", "California St",
    "Montgomery St", "Sansome St", "Columbus Ave", "Lombard St", "The Embarcadero"
]

# Simulated elevation data for San Francisco neighborhoods (meters above sea level)
# Why: San Francisco has steep gradients (e.g. Nob Hill / Russian Hill) which consume more fuel.
NEIGHBORHOOD_ELEVATIONS = {
    "Downtown/SOMA": 12.0,
    "Mission": 18.0,
    "Potrero Hill": 85.0,
    "Nob Hill": 114.0,
    "Russian Hill": 90.0,
    "Marina/Embarcadero": 4.0,
    "Richmond/Sunset": 55.0
}

def generate_mock_deliveries(n=TOTAL_DELIVERIES) -> pd.DataFrame:
    records = []
    # Base shift start: 08:00 AM local delivery day
    shift_start = datetime.datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)

    tiers = list(URGENCY_TIERS.keys())
    weights = [URGENCY_TIERS[t]["weight"] for t in tiers]

    for i in range(1, n + 1):
        delivery_id = f"DEL-{1000 + i}"
        tier = np.random.choice(tiers, p=weights)
        info = URGENCY_TIERS[tier]

        # Coordinates clustered around San Francisco with realistic urban spread
        lat_offset = np.random.normal(loc=0.0, scale=0.024)
        lng_offset = np.random.normal(loc=0.0, scale=0.032)
        lat = round(DEPOT_COORDINATES["lat"] + lat_offset, 6)
        lng = round(DEPOT_COORDINATES["lng"] + lng_offset, 6)

        # Elevation approximation based on latitude/longitude quadrant
        if lat > 37.79 and lng < -122.41:
            elevation = round(float(np.random.uniform(70.0, 115.0)), 1) # Nob/Russian Hill
        elif lat < 37.76 and lng > -122.40:
            elevation = round(float(np.random.uniform(50.0, 85.0)), 1)  # Potrero Hill
        elif lng > -122.40:
            elevation = round(float(np.random.uniform(3.0, 15.0)), 1)   # Waterfront / SOMA
        else:
            elevation = round(float(np.random.uniform(15.0, 45.0)), 1)

        # Window calculation
        window_duration = random.randint(info["min_window_len"], info["max_window_len"])
        if tier == "CRITICAL":
            start_offset = random.randint(20, 80)
        elif tier == "HIGH":
            start_offset = random.randint(30, 150)
        elif tier == "MEDIUM":
            start_offset = random.randint(60, 240)
        else:
            start_offset = random.randint(90, 360)

        end_offset = start_offset + window_duration
        tw_start = shift_start + datetime.timedelta(minutes=start_offset)
        tw_end = shift_start + datetime.timedelta(minutes=end_offset)

        recipient = random.choice(RECIPIENTS)
        street = f"{random.randint(100, 2200)} {random.choice(STREETS)}, San Francisco, CA"
        package_type = random.choice(info["types"])
        weight_kg = round(float(random.uniform(0.75, 22.5)), 2)

        # 3 Delivery Vans operating in the zone:
        # TRK-01: North Corridor (Financial, North Beach, Marina)
        # TRK-02: Central Corridor (SOMA, Mission, Market)
        # TRK-03: South/East Corridor (Potrero, Mission Bay, Dogpatch)
        truck_id = f"TRK-0{(i % 3) + 1}"

        # LIFO stack position in van cargo bay (1 = rear door accessible, 50 = buried behind)
        lifo_stack_index = i

        # Property type and vertical last-mile friction tagging
        if i % 3 == 0:
            property_type = "COMMERCIAL_HIGH_RISE"
            floor_level = (i % 24) + 2
            security_checkpoint = True
            avg_elevator_delay = 5.5 + float((i % 4) * 1.5)
            # Commercial High-Rise (+12 to 15 mins)
            dwell_friction_minutes = round(min(15.5, max(12.0, 2.5 + 3.5 + avg_elevator_delay + ((floor_level - 1) * 0.15))), 1)
        elif i % 3 == 1:
            property_type = "GATED_VILLA_COMMUNITY"
            floor_level = 1 + (i % 2)
            security_checkpoint = True
            avg_elevator_delay = 0.0
            # Gated Villa Community (+6 mins)
            dwell_friction_minutes = 6.0
        else:
            property_type = "GROUND_LEVEL_RETAIL"
            floor_level = 1
            security_checkpoint = False
            avg_elevator_delay = 0.0
            # Ground-Level Retail (+2 mins)
            dwell_friction_minutes = 2.0

        building_metadata = {
            "property_type": property_type,
            "floor_level": floor_level,
            "security_checkpoint": security_checkpoint,
            "avg_elevator_delay": avg_elevator_delay
        }

        # Cold-Chain & Perishability Decay Curve Tagging
        # Specific parcels tagged with realistic degradation profiles
        if i % 4 == 0:
            is_perishable = True
            perishable_category = "ICE_CREAM"
            package_type = "Artisanal Gelato & Ice Cream Pints"
            decay_rate = 0.085
            spoilage_threshold_min = 25.0
            optimal_temp_c = -18.0
            max_safe_temp_c = -4.0
            cargo_val_usd = 320.0
        elif i % 4 == 1 and tier in ["CRITICAL", "HIGH"]:
            is_perishable = True
            perishable_category = "PHARMACEUTICALS"
            package_type = "Cold-Chain Biologics & Vaccines (2-8°C)"
            decay_rate = 0.065
            spoilage_threshold_min = 40.0
            optimal_temp_c = 4.0
            max_safe_temp_c = 8.0
            cargo_val_usd = 1850.0
        elif i % 4 == 2:
            is_perishable = True
            perishable_category = "SEAFOOD_DAIRY"
            package_type = "Fresh Sushi-Grade Seafood & Dairy"
            decay_rate = 0.052
            spoilage_threshold_min = 35.0
            optimal_temp_c = 2.0
            max_safe_temp_c = 7.0
            cargo_val_usd = 680.0
        elif i % 7 == 3:
            is_perishable = True
            perishable_category = "FRESH_FLOWERS"
            package_type = "Exotic Floral Bouquets & Orchids"
            decay_rate = 0.038
            spoilage_threshold_min = 50.0
            optimal_temp_c = 10.0
            max_safe_temp_c = 18.0
            cargo_val_usd = 240.0
        else:
            is_perishable = False
            perishable_category = "STANDARD"
            decay_rate = 0.0
            spoilage_threshold_min = 9999.0
            optimal_temp_c = 21.0
            max_safe_temp_c = 40.0
            cargo_val_usd = 150.0

        records.append({
            "delivery_id": delivery_id,
            "recipient": recipient,
            "address": street,
            "latitude": lat,
            "longitude": lng,
            "elevation_meters": elevation,
            "urgency": tier,
            "priority_score": info["priority_score"],
            "package_type": package_type,
            "weight_kg": weight_kg,
            "property_type": property_type,
            "floor_level": floor_level,
            "security_checkpoint": security_checkpoint,
            "avg_elevator_delay": avg_elevator_delay,
            "dwell_friction_minutes": dwell_friction_minutes,
            "building_metadata": building_metadata,
            # Cold-Chain Perishability attributes
            "is_perishable": is_perishable,
            "perishable_category": perishable_category,
            "decay_rate": decay_rate,
            "spoilage_threshold_min": spoilage_threshold_min,
            "current_cargo_temp_c": optimal_temp_c,
            "ambient_temp_c": 31.0,
            "idle_stall_minutes": 0.0,
            "decay_score": 5.0 if is_perishable else 0.0,
            "spoilage_risk": "SAFE",
            "exponential_weight_multiplier": 1.0,
            "safe_runway_remaining_min": spoilage_threshold_min if is_perishable else 9999.0,
            "cargo_value_usd": cargo_val_usd,
            "time_window_start": tw_start.strftime("%H:%M"),
            "time_window_end": tw_end.strftime("%H:%M"),
            "window_start_minutes": start_offset,
            "window_end_minutes": end_offset,
            "window_duration_minutes": window_duration,
            "assigned_truck_id": truck_id,
            "lifo_stack_index": lifo_stack_index,
            "original_sequence": i,
            "optimized_sequence": i,
            "estimated_arrival_time": (shift_start + datetime.timedelta(minutes=start_offset + 15)).strftime("%H:%M"),
            "estimated_arrival_minutes": start_offset + 15,
            "status": "pending",
            "is_delayed": False,
            "delay_minutes": 0,
            "customer_notified": False,
            "customer_phone": f"+1 (415) 555-{random.randint(1000, 9999)}",
            "customer_email": f"logistics.{delivery_id.lower()}@customer-gateway.org",
            "created_at": datetime.datetime.utcnow()
        })

    df = pd.DataFrame(records)
    return df

def push_to_mongodb(df: pd.DataFrame, mongo_uri="mongodb://127.0.0.1:27017/", db_name="fleet_db"):
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[db_name]
    deliveries_col = db["deliveries"]

    # Drop old test records to ensure clean baseline state
    deliveries_col.drop()

    records = df.to_dict(orient="records")
    result = deliveries_col.insert_many(records)

    # Establish fast query indexes
    deliveries_col.create_index([("delivery_id", ASCENDING)], unique=True)
    deliveries_col.create_index([("assigned_truck_id", ASCENDING)])
    deliveries_col.create_index([("urgency", ASCENDING)])
    deliveries_col.create_index([("status", ASCENDING)])

    # Setup fleet trucks metadata
    trucks_col = db["trucks"]
    trucks_col.drop()
    
    trucks = [
        {
            "truck_id": "TRK-01",
            "name": "Alpha Van 01 (North Zone)",
            "driver": "Marcus Vance",
            "latitude": 37.7780,
            "longitude": -122.4160,
            "status": "in_transit",
            "current_traffic_delay_min": 0,
            "fuel_level_pct": 86,
            "capacity_kg": 500,
            "current_load_kg": round(float(df[df['assigned_truck_id'] == 'TRK-01']['weight_kg'].sum()), 1),
            "total_packages": int((df['assigned_truck_id'] == 'TRK-01').sum())
        },
        {
            "truck_id": "TRK-02",
            "name": "Beta Van 02 (Central Zone)",
            "driver": "Elena Rostova",
            "latitude": 37.7710,
            "longitude": -122.4210,
            "status": "in_transit",
            "current_traffic_delay_min": 0,
            "fuel_level_pct": 92,
            "capacity_kg": 500,
            "current_load_kg": round(float(df[df['assigned_truck_id'] == 'TRK-02']['weight_kg'].sum()), 1),
            "total_packages": int((df['assigned_truck_id'] == 'TRK-02').sum())
        },
        {
            "truck_id": "TRK-03",
            "name": "Gamma Van 03 (South-East Hub)",
            "driver": "Darnell Washington",
            "latitude": 37.7650,
            "longitude": -122.4080,
            "status": "in_transit",
            "current_traffic_delay_min": 0,
            "fuel_level_pct": 78,
            "capacity_kg": 500,
            "current_load_kg": round(float(df[df['assigned_truck_id'] == 'TRK-03']['weight_kg'].sum()), 1),
            "total_packages": int((df['assigned_truck_id'] == 'TRK-03').sum())
        }
    ]
    trucks_col.insert_many(trucks)

    # Initialize depot config
    db["fleet_config"].replace_one(
        {"config_key": "depot"},
        {
            "config_key": "depot",
            "name": DEPOT_COORDINATES["name"],
            "latitude": DEPOT_COORDINATES["lat"],
            "longitude": DEPOT_COORDINATES["lng"],
            "total_packages": len(records),
            "active_trucks": 3,
            "updated_at": datetime.datetime.utcnow()
        },
        upsert=True
    )

    # Clear notification log on fresh generation
    db["notifications"].drop()

    return len(result.inserted_ids)

def main():
    print("[CargoFlow AI] Generating 50 mock deliveries with Pandas & MongoDB...")
    df = generate_mock_deliveries()
    count = push_to_mongodb(df)
    print(f"[CargoFlow AI] Successfully seeded {count} deliveries and 3 fleet trucks into MongoDB.")

if __name__ == "__main__":
    main()
