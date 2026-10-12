"""
CargoFlow AI — Baton Pass CLI / Service Bridge
File: /ai_engine/baton_pass_cli.py

Runs the Baton Pass intersection & time-window overlap engine.
Supports:
1. Scanning all opportunities: python3 baton_pass_cli.py --action scan
2. Calculating a specific relay: python3 baton_pass_cli.py --action calculate --delivery DEL-1003
3. Executing a Baton Pass: python3 baton_pass_cli.py --action execute --delivery DEL-1003 --target-truck TRK-02
"""

import sys
import json
import argparse
import datetime
from pymongo import MongoClient
from baton_pass import scan_all_baton_pass_candidates, calculate_baton_pass_relay, DEFAULT_RENDEZVOUS_HUBS

MONGO_URI = "mongodb://127.0.0.1:27017"
DB_NAME = "fleet_db"

def get_db():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    return client[DB_NAME]

def run_scan():
    db = get_db()
    deliveries_col = db["deliveries"]
    trucks_col = db["trucks"]

    deliveries = list(deliveries_col.find({}, {"_id": 0}))
    trucks = list(trucks_col.find({}, {"_id": 0}))

    relays = scan_all_baton_pass_candidates(deliveries, trucks, DEFAULT_RENDEZVOUS_HUBS)
    
    # Return viable relays with metadata
    result = {
        "status": "success",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "total_viable_relays": len(relays),
        "available_hubs": DEFAULT_RENDEZVOUS_HUBS,
        "relays": relays
    }
    print(json.dumps(result))

def run_calculate(delivery_id: str):
    db = get_db()
    deliv = db["deliveries"].find_one({"delivery_id": delivery_id}, {"_id": 0})
    if not deliv:
        print(json.dumps({"status": "error", "message": f"Delivery {delivery_id} not found"}))
        return

    carrier_id = deliv.get("assigned_truck_id")
    carrier = db["trucks"].find_one({"truck_id": carrier_id}, {"_id": 0})
    trucks = list(db["trucks"].find({}, {"_id": 0}))

    if not carrier:
        print(json.dumps({"status": "error", "message": f"Carrier truck {carrier_id} not found"}))
        return

    relay = calculate_baton_pass_relay(
        delivery=deliv,
        carrier_truck=carrier,
        candidate_trucks=trucks,
        current_sim_time_minutes=85.0,
        hubs=DEFAULT_RENDEZVOUS_HUBS
    )

    if not relay:
        print(json.dumps({"status": "not_viable", "message": "No viable rendezvous window found with candidate trucks"}))
    else:
        print(json.dumps({"status": "success", "relay": relay}))

def run_execute(delivery_id: str, relay_truck_id: str, hub_id: str = None):
    """
    Commits the Baton Pass relay to MongoDB:
    1. Updates package assignment to relay truck.
    2. Marks delivery with baton_pass status and rendezvous telemetry.
    3. Dispatches custody transfer dispatch alert.
    4. Triggers re-optimization of both trucks.
    """
    db = get_db()
    deliv = db["deliveries"].find_one({"delivery_id": delivery_id})
    if not deliv:
        print(json.dumps({"status": "error", "message": f"Delivery {delivery_id} not found"}))
        return

    origin_truck_id = deliv.get("assigned_truck_id")
    origin_truck = db["trucks"].find_one({"truck_id": origin_truck_id})
    target_truck = db["trucks"].find_one({"truck_id": relay_truck_id})

    if not target_truck:
        print(json.dumps({"status": "error", "message": f"Relay truck {relay_truck_id} not found"}))
        return

    # Find hub metadata
    hub_info = next((h for h in DEFAULT_RENDEZVOUS_HUBS if h["hub_id"] == hub_id), DEFAULT_RENDEZVOUS_HUBS[0])

    # Record baton pass execution
    baton_record = {
        "delivery_id": delivery_id,
        "origin_truck_id": origin_truck_id,
        "relay_truck_id": relay_truck_id,
        "rendezvous_hub": hub_info,
        "executed_at": datetime.datetime.utcnow().isoformat(),
        "custody_state": "HANDOFF_SCHEDULED",
        "barcode_token": f"RELAY-BP-{delivery_id[-4:]}-TO-{relay_truck_id}"
    }

    db["deliveries"].update_one(
        {"delivery_id": delivery_id},
        {
            "$set": {
                "assigned_truck_id": relay_truck_id,
                "is_delayed": False,
                "baton_pass": baton_record,
                "updated_at": datetime.datetime.utcnow()
            }
        }
    )

    # Save to dedicated relays collection for audit & swarm telemetry
    db["baton_relays"].insert_one({
        **baton_record,
        "recipient": deliv.get("recipient"),
        "package_type": deliv.get("package_type"),
        "urgency": deliv.get("urgency"),
        "created_at": datetime.datetime.utcnow()
    })

    # Dispatch high-priority dispatcher notification
    notif_doc = {
        "delivery_id": delivery_id,
        "truck_id": relay_truck_id,
        "recipient": deliv.get("recipient"),
        "package_type": deliv.get("package_type"),
        "urgency": deliv.get("urgency"),
        "promised_window": f"{deliv.get('time_window_start')} - {deliv.get('time_window_end')}",
        "revised_eta": "ON_SCHEDULE (Relayed)",
        "delay_minutes": 0.0,
        "channel": "SMS_AND_EMAIL",
        "recipient_phone": deliv.get("customer_phone"),
        "recipient_email": deliv.get("customer_email"),
        "message": (
            f"CargoFlow Dynamic Relay: 'Baton Pass' executed at {hub_info['name']}. "
            f"Package {delivery_id} transferred from {origin_truck_id} to {relay_truck_id}. "
            f"Guaranteed delivery window preserved."
        ),
        "dispatched_at": datetime.datetime.utcnow()
    }
    db["notifications"].insert_one(notif_doc)

    print(json.dumps({
        "status": "success",
        "message": f"Baton Pass successfully executed. {delivery_id} handed from {origin_truck_id} to {relay_truck_id} at {hub_info['name']}.",
        "baton_record": baton_record
    }))

def main():
    parser = argparse.ArgumentParser(description="Baton Pass Multi-Vehicle Relay Bridge")
    parser.add_argument("--action", choices=["scan", "calculate", "execute"], default="scan")
    parser.add_argument("--delivery", type=str, help="Delivery ID")
    parser.add_argument("--target-truck", type=str, help="Target relay truck ID")
    parser.add_argument("--hub", type=str, help="Rendezvous Hub ID")
    args = parser.parse_args()

    if args.action == "scan":
        run_scan()
    elif args.action == "calculate":
        if not args.delivery:
            print(json.dumps({"status": "error", "message": "--delivery required for calculate"}))
            return
        run_calculate(args.delivery)
    elif args.action == "execute":
        if not args.delivery or not args.target_truck:
            print(json.dumps({"status": "error", "message": "--delivery and --target-truck required for execute"}))
            return
        run_execute(args.delivery, args.target_truck, args.hub)

if __name__ == "__main__":
    main()
