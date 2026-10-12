"""
Phase 1: Data Generation (Python & MongoDB)

Why this script is written this way:
1. Reproducible Seed (seed=42): Ensures deterministic mock delivery generation so test runs,
   routing verification, and team debugging produce consistent results.
2. Centered Metro Coordinates (San Francisco Bay Area): Uses a defined distribution depot hub
   (lat: 37.7749, lng: -122.4194) with realistic Gaussian/uniform offsets, simulating dense
   urban delivery clusters.
3. Structured Urgency & Time Windows: Urgency is categorized into CRITICAL, HIGH, MEDIUM, LOW
   with assigned numeric weights and tight time windows (e.g. 30-90 min windows for CRITICAL),
   providing the mathematical foundation needed for Phase 3's LIFO Smart Shuffling algorithm.
4. LIFO Loading Stack Index: Generates initial physical load indices (1 to 50) inside the delivery
   vehicle. In real delivery vans, packages loaded last are accessible first (Last-In-First-Out),
   which creates conflicts when a high-urgency package is buried deep in the truck bed.
5. Pandas DataFrame Manipulation: Leverages Pandas for structured tabular validation, type casting,
   and clean dictionary conversion before bulk inserting into MongoDB.
6. MongoDB Clean Insertion & Indexing: Connects to MongoDB, cleans previous mock runs, bulk-inserts
   all 50 records into the 'deliveries' collection, and creates compound indices for fast retrieval.
"""

import sys
import datetime
import random
import numpy as np
import pandas as pd
from pymongo import MongoClient, ASCENDING

# Fix seed for deterministic mock generation
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# Operational constants for the simulated metro delivery zone (San Francisco Metro Hub)
DEPOT_COORDINATES = {"lat": 37.7749, "lng": -122.4194, "name": "Central Metro Hub #1"}
TOTAL_RECORDS = 50

# Urgency distribution with associated delivery window constraints (minutes from shift start at 08:00 AM)
URGENCY_TIERS = {
    "CRITICAL": {
        "weight": 0.16,  # ~8 packages
        "min_window_len": 45,
        "max_window_len": 90,
        "types": ["Emergency Medical", "Urgent Legal Documents", "Perishable Lab Specimen"],
        "priority_score": 100
    },
    "HIGH": {
        "weight": 0.28,  # ~14 packages
        "min_window_len": 60,
        "max_window_len": 120,
        "types": ["Express Corporate", "Refrigerated Goods", "High-Value Electronics"],
        "priority_score": 75
    },
    "MEDIUM": {
        "weight": 0.36,  # ~18 packages
        "min_window_len": 90,
        "max_window_len": 180,
        "types": ["Standard Retail", "Office Equipment", "Apparel & Home Goods"],
        "priority_score": 50
    },
    "LOW": {
        "weight": 0.20,  # ~10 packages
        "min_window_len": 120,
        "max_window_len": 300,
        "types": ["Bulk Non-Perishable", "Catalog Parcels", "Consolidated Freight"],
        "priority_score": 25
    }
}

RECIPIENTS = [
    "Apex Health Clinic", "St. Jude Medical Research", "Mission Bay BioLabs",
    "OmniTech Robotics", "Silicon Horizon Inc.", "CloudScale Systems",
    "Pioneer Legal Chambers", "Veritas Law Group", "Bayview Dental Center",
    "Golden Gate Grocers", "Artisan Bakery Depot", "GreenLeaf Farm Hub",
    "Pacific High School Labs", "Sunset Audio Visual", "Presidio Design Co.",
    "Valencia Books & Cafe", "SOMA Digital Print", "Marina Specialty Pharmacy",
    "Embarcadero Financial", "North Beach Hardware", "Dogpatch Maker Space",
    "Financial District Logistics", "Richmond Diagnostic Lab", "Beacon Hill Architects"
]

STREET_NAMES = [
    "Market St", "Mission St", "Howard St", "Folsom St", "Harrison St",
    "Valencia St", "Guerrero St", "Van Ness Ave", "Geary Blvd", "California St",
    "Montgomery St", "Sansome St", "Columbus Ave", "Lombard St", "Divisadero St"
]

def generate_mock_deliveries(n=TOTAL_RECORDS) -> pd.DataFrame:
    """
    Generates 50 realistic delivery records using Pandas.
    """
    records = []
    shift_start = datetime.datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)

    # Probability weights for each urgency tier
    tiers = list(URGENCY_TIERS.keys())
    tier_weights = [URGENCY_TIERS[t]["weight"] for t in tiers]

    for i in range(1, n + 1):
        delivery_id = f"DEL-{1000 + i}"
        tier = np.random.choice(tiers, p=tier_weights)
        tier_info = URGENCY_TIERS[tier]

        # Coordinates: Clustered around San Francisco Metro Hub (within ~7 km radius)
        # Why: Realistic urban deliveries cluster around road networks with slight spread
        lat_offset = np.random.normal(loc=0.0, scale=0.025)
        lng_offset = np.random.normal(loc=0.0, scale=0.035)
        lat = round(DEPOT_COORDINATES["lat"] + lat_offset, 6)
        lng = round(DEPOT_COORDINATES["lng"] + lng_offset, 6)

        # Time Windows: Earliest delivery starts at 8:00 AM.
        # Critical items are due earlier with tighter windows.
        window_duration = random.randint(tier_info["min_window_len"], tier_info["max_window_len"])
        
        if tier == "CRITICAL":
            start_offset_minutes = random.randint(15, 90)
        elif tier == "HIGH":
            start_offset_minutes = random.randint(30, 180)
        elif tier == "MEDIUM":
            start_offset_minutes = random.randint(60, 300)
        else:
            start_offset_minutes = random.randint(90, 420)

        end_offset_minutes = start_offset_minutes + window_duration
        
        tw_start = shift_start + datetime.timedelta(minutes=start_offset_minutes)
        tw_end = shift_start + datetime.timedelta(minutes=end_offset_minutes)

        package_type = random.choice(tier_info["types"])
        recipient = random.choice(RECIPIENTS)
        street_num = random.randint(100, 2400)
        address = f"{street_num} {random.choice(STREET_NAMES)}, San Francisco, CA"

        weight_kg = round(random.uniform(0.5, 24.5), 2)
        
        # Initial physical truck assignment (3 simulated delivery vans)
        # Fleet Route: TRK-01 (North), TRK-02 (Central), TRK-03 (South)
        truck_assignment = f"TRK-0{(i % 3) + 1}"
        
        # LIFO stack index (physical position in cargo hold from rear door: 1 = right at door, 50 = buried at front)
        lifo_stack_index = i

        records.append({
            "delivery_id": delivery_id,
            "recipient": recipient,
            "address": address,
            "latitude": lat,
            "longitude": lng,
            "urgency": tier,
            "priority_score": tier_info["priority_score"],
            "package_type": package_type,
            "weight_kg": weight_kg,
            "time_window_start": tw_start.strftime("%H:%M"),
            "time_window_end": tw_end.strftime("%H:%M"),
            "window_start_minutes": start_offset_minutes,
            "window_end_minutes": end_offset_minutes,
            "window_duration_minutes": window_duration,
            "assigned_truck_id": truck_assignment,
            "lifo_stack_index": lifo_stack_index,
            "status": "pending",
            "is_delayed": False,
            "created_at": datetime.datetime.utcnow()
        })

    df = pd.DataFrame(records)
    return df

def push_to_mongodb(df: pd.DataFrame, mongo_uri="mongodb://127.0.0.1:27017/", db_name="fleet_db"):
    """
    Inserts generated Pandas records into MongoDB.
    Why: MongoDB provides flexible document modeling for mid-route schema updates,
    coordinates arrays, and subdocument status logs without rigid migrations.
    """
    print(f"\n[1/3] Connecting to MongoDB instance at {mongo_uri}...")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[db_name]
    deliveries_col = db["deliveries"]

    # Clean existing mock dataset for idempotent test runs
    previous_count = deliveries_col.count_documents({})
    if previous_count > 0:
        print(f"       Found {previous_count} existing records. Resetting collection for clean test...")
        deliveries_col.drop()

    # Convert Pandas DataFrame to dictionary records for MongoDB
    records = df.to_dict(orient="records")

    print(f"[2/3] Inserting {len(records)} delivery documents into '{db_name}.deliveries'...")
    insert_result = deliveries_col.insert_many(records)
    print(f"       Successfully inserted {len(insert_result.inserted_ids)} documents.")

    # Create helpful query indices for fast backend lookups
    print("[3/3] Creating collection indices on delivery_id, urgency, status, and assigned_truck_id...")
    deliveries_col.create_index([("delivery_id", ASCENDING)], unique=True)
    deliveries_col.create_index([("urgency", ASCENDING)])
    deliveries_col.create_index([("status", ASCENDING)])
    deliveries_col.create_index([("assigned_truck_id", ASCENDING)])
    
    # Store depot metadata in a separate system settings collection
    db["fleet_config"].replace_one(
        {"config_key": "depot"},
        {
            "config_key": "depot",
            "name": DEPOT_COORDINATES["name"],
            "latitude": DEPOT_COORDINATES["lat"],
            "longitude": DEPOT_COORDINATES["lng"],
            "total_packages": len(records),
            "updated_at": datetime.datetime.utcnow()
        },
        upsert=True
    )
    print("       Depot configuration registered.")

    return len(insert_result.inserted_ids)

def main():
    print("=================================================================")
    print("  PHASE 1: SMART SHUFFLING MOCK DATA GENERATION (Pandas & Mongo)  ")
    print("=================================================================")
    
    # 1. Generate realistic dataset using Pandas
    df = generate_mock_deliveries(TOTAL_RECORDS)
    
    print(f"\n✓ Generated {len(df)} deliveries across 4 urgency tiers:")
    urgency_summary = df["urgency"].value_counts()
    for tier, count in urgency_summary.items():
        print(f"   • {tier:8s}: {count:2d} packages ({count/len(df)*100:.1f}%)")

    print("\n--- Sample Generated Records (First 5 Rows) ---")
    preview_cols = ["delivery_id", "recipient", "urgency", "time_window_start", "time_window_end", "assigned_truck_id", "lifo_stack_index"]
    print(df[preview_cols].head(5).to_string(index=False))

    # 2. Push to MongoDB
    try:
        inserted_count = push_to_mongodb(df)
        print("\n=================================================================")
        print(f"  PHASE 1 COMPLETE: {inserted_count} records safely populated in MongoDB!  ")
        print("=================================================================\n")
    except Exception as e:
        print(f"\n[ERROR] Failed to push to MongoDB: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
