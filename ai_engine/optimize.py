"""
CargoFlow AI — AI & Routing Engine
File: /ai_engine/optimize.py

Execution Bridge:
Connects MongoDB state to the Python Smart Shuffling Routing Engine.
Reads truck and delivery records, executes multi-objective optimization,
updates MongoDB collections (deliveries, trucks, notifications), and
emits execution results as structured JSON to stdout.
"""

import sys
import json
import argparse
import datetime
from pymongo import MongoClient
from smart_shuffling import smart_shuffle_algorithm

def run_optimization(
    truck_id: str = None,
    traffic_delay_min: float = 0.0,
    fuel_weight: float = 0.35,
    lifo_strictness: float = 0.30,
    mongo_uri: str = "mongodb://127.0.0.1:27017/",
    db_name: str = "fleet_db"
):
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[db_name]
    deliveries_col = db["deliveries"]
    trucks_col = db["trucks"]
    notifications_col = db["notifications"]
    config_col = db["fleet_config"]

    depot_doc = config_col.find_one({"config_key": "depot"}) or {
        "latitude": 37.7749,
        "longitude": -122.4194
    }

    # Determine which trucks to optimize
    if truck_id and truck_id != "ALL":
        target_truck_ids = [truck_id]
    else:
        target_truck_ids = trucks_col.distinct("truck_id")

    results_by_truck = {}
    total_prevented_delays = 0
    all_notifications_created = []

    for t_id in target_truck_ids:
        truck_doc = trucks_col.find_one({"truck_id": t_id}) or {
            "truck_id": t_id,
            "latitude": depot_doc["latitude"],
            "longitude": depot_doc["longitude"]
        }

        # Query pending deliveries for this truck
        deliveries = list(deliveries_col.find(
            {"assigned_truck_id": t_id, "status": {"$ne": "delivered"}}
        ).sort("original_sequence", 1))

        if not deliveries:
            continue

        # Check if traffic delay is applied
        truck_delay = traffic_delay_min
        if truck_delay > 0:
            trucks_col.update_one(
                {"truck_id": t_id},
                {"$set": {"current_traffic_delay_min": truck_delay}}
            )

        # Run Smart Shuffling Algorithm
        shuffle_result = smart_shuffle_algorithm(
            stops=deliveries,
            truck_lat=truck_doc.get("latitude", depot_doc["latitude"]),
            truck_lng=truck_doc.get("longitude", depot_doc["longitude"]),
            start_time_minutes=60.0,  # 9:00 AM in simulation
            traffic_delay_minutes=truck_delay,
            fuel_weight=fuel_weight,
            lifo_strictness=lifo_strictness,
            depot_lat=depot_doc["latitude"],
            depot_lng=depot_doc["longitude"]
        )

        optimized_stops = shuffle_result["optimized_stops"]
        metrics = shuffle_result["metrics"]
        total_prevented_delays += metrics.get("prevented_delays_count", 0)

        # Update MongoDB deliveries with new sequence, ETAs, and delay flags
        for stop in optimized_stops:
            del_id = stop["delivery_id"]
            is_delayed = stop["is_delayed"]
            delay_minutes = stop["delay_minutes"]
            new_eta = stop["estimated_arrival_time"]

            deliveries_col.update_one(
                {"delivery_id": del_id},
                {
                    "$set": {
                        "optimized_sequence": stop["optimized_sequence"],
                        "estimated_arrival_time": new_eta,
                        "estimated_arrival_minutes": stop["estimated_arrival_minutes"],
                        "is_delayed": is_delayed,
                        "delay_minutes": delay_minutes,
                        "distance_from_prev_km": stop.get("distance_from_prev_km", 0.0),
                        "fuel_factor": stop.get("fuel_factor", 1.0),
                        "updated_at": datetime.datetime.utcnow()
                    }
                }
            )

            # Automated Customer Notification Trigger:
            # If a package ETA shifted past promised window, dispatch mock SMS / Email alert!
            if is_delayed and not stop.get("customer_notified", False):
                notif_doc = {
                    "delivery_id": del_id,
                    "truck_id": t_id,
                    "recipient": stop.get("recipient"),
                    "package_type": stop.get("package_type"),
                    "urgency": stop.get("urgency"),
                    "promised_window": f"{stop.get('time_window_start')} - {stop.get('time_window_end')}",
                    "revised_eta": new_eta,
                    "delay_minutes": delay_minutes,
                    "channel": "SMS_AND_EMAIL",
                    "recipient_phone": stop.get("customer_phone"),
                    "recipient_email": stop.get("customer_email"),
                    "message": (
                        f"CargoFlow Alert for {stop.get('recipient')}: Due to traffic congestion on corridor {t_id}, "
                        f"your package ({stop.get('package_type')}) ETA is revised to {new_eta} (+{int(delay_minutes)}m delay). "
                        f"Our automated priority dispatcher has rescheduled remaining stops to expedite delivery."
                    ),
                    "dispatched_at": datetime.datetime.utcnow()
                }
                notifications_col.insert_one(notif_doc)
                deliveries_col.update_one({"delivery_id": del_id}, {"$set": {"customer_notified": True}})
                del notif_doc["_id"]
                all_notifications_created.append(notif_doc)

        results_by_truck[t_id] = {
            "metrics": metrics,
            "stop_count": len(optimized_stops),
            "sequence_order": [s["delivery_id"] for s in optimized_stops]
        }

    output = {
        "status": "success",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "trucks_optimized": list(results_by_truck.keys()),
        "total_prevented_delays": total_prevented_delays,
        "results_by_truck": results_by_truck,
        "notifications_dispatched": len(all_notifications_created)
    }

    print(json.dumps(output))

def main():
    parser = argparse.ArgumentParser(description="CargoFlow AI Optimizer")
    parser.add_argument("--truck", type=str, default="ALL", help="Target truck ID or ALL")
    parser.add_argument("--traffic-delay", type=float, default=0.0, help="Traffic delay in minutes to simulate")
    parser.add_argument("--fuel-weight", type=float, default=0.35, help="Fuel efficiency weight (0.0 - 1.0)")
    parser.add_argument("--lifo-strictness", type=float, default=0.30, help="LIFO penalty strictness (0.0 - 1.0)")
    args = parser.parse_args()

    run_optimization(
        truck_id=args.truck,
        traffic_delay_min=args.traffic_delay,
        fuel_weight=args.fuel_weight,
        lifo_strictness=args.lifo_strictness
    )

if __name__ == "__main__":
    main()
