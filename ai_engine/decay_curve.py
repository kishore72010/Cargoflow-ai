"""
CargoFlow AI — Cold-Chain & Perishability Decay Curve Engine
File: /ai_engine/decay_curve.py

The Problem:
Food, flowers, ice cream, and pharmaceuticals don't just have a delivery deadline;
they have a physical degradation rate. If a delivery vehicle is stuck in high heat
with the engine idling, the internal cargo temperature rises rapidly.

The Innovation:
Dynamic decay score calculation for temperature-sensitive goods using Pandas and NumPy.
If ambient temperature increases or traffic stalls the vehicle past a safe thermal threshold,
the system automatically evaluates decay curves and exponentially escalates the sorting weight,
reshuffling the route to deliver them before irreversible spoilage occurs.

Mathematical Model:
1. Effective Thermal Stress:
   tau_eff = idle_stall_minutes * ((max(20.0, ambient_temp_c) / 22.0) ** 1.35) + elapsed_transit_minutes * 0.25

2. Physical Container Temperature Ingress:
   current_cargo_temp = optimal_temp + min(24.0, (effective_stress * thermal_conductivity))

3. Exponential Perishability Degradation (Decay Score 0 - 100%):
   Decay_Score = 100.0 * (1.0 - exp(-decay_rate * tau_eff))

4. Exponential Sorting Weight Elevation:
   stress_delta = max(0.0, Decay_Score - safe_limit)
   weight_multiplier = exp(alpha * (stress_delta / 15.0))
   priority_boost = base_priority * weight_multiplier

5. Spoilage Risk Classification:
   - Decay_Score < 45%: "SAFE"
   - 45% <= Decay_Score < 75%: "AMBER_WARNING" (warning badge emitted)
   - Decay_Score >= 75%: "RED_CRITICAL" (spoilage imminent, emergency reshuffle)
"""

import sys
import json
import math
import argparse
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from pymongo import MongoClient

# Perishable Goods Profiles
PERISHABLE_PROFILES = {
    "ICE_CREAM": {
        "label": "Artisanal Ice Cream / Frozen Confections",
        "optimal_temp_c": -18.0,
        "max_safe_temp_c": -4.0,
        "decay_rate": 0.085,             # Rapid melting above thermal threshold
        "spoilage_threshold_min": 25.0,  # 25 minutes of idle heat
        "thermal_conductivity": 0.38,
        "default_loss_usd": 320.0
    },
    "PHARMACEUTICALS": {
        "label": "Biologics, Vaccines & Insulin (Cold-Chain)",
        "optimal_temp_c": 4.0,
        "max_safe_temp_c": 8.0,
        "decay_rate": 0.065,             # Protein denaturation
        "spoilage_threshold_min": 40.0,  # 40 minutes of idle heat
        "thermal_conductivity": 0.26,
        "default_loss_usd": 1850.0
    },
    "SEAFOOD_DAIRY": {
        "label": "Sushi-Grade Seafood & Fresh Dairy",
        "optimal_temp_c": 2.0,
        "max_safe_temp_c": 7.0,
        "decay_rate": 0.052,             # Histamine & bacterial progression
        "spoilage_threshold_min": 35.0,  # 35 minutes of idle heat
        "thermal_conductivity": 0.29,
        "default_loss_usd": 680.0
    },
    "FRESH_FLOWERS": {
        "label": "Exotic Cut Florals & Orchids",
        "optimal_temp_c": 10.0,
        "max_safe_temp_c": 18.0,
        "decay_rate": 0.038,             # Ethylene gas and dehydration wilting
        "spoilage_threshold_min": 50.0,  # 50 minutes of idle heat
        "thermal_conductivity": 0.22,
        "default_loss_usd": 240.0
    },
    "STANDARD": {
        "label": "Ambient Non-Perishable Cargo",
        "optimal_temp_c": 21.0,
        "max_safe_temp_c": 40.0,
        "decay_rate": 0.0,
        "spoilage_threshold_min": 9999.0,
        "thermal_conductivity": 0.05,
        "default_loss_usd": 0.0
    }
}

def evaluate_package_decay(
    item: Dict[str, Any],
    ambient_temp_c: float = 31.5,
    idle_stall_minutes: float = 0.0,
    elapsed_transit_minutes: float = 15.0
) -> Dict[str, Any]:
    """
    Evaluates physical decay metrics for an individual delivery item.
    """
    is_perishable = item.get("is_perishable", False)
    category = item.get("perishable_category", "STANDARD")
    profile = PERISHABLE_PROFILES.get(category, PERISHABLE_PROFILES["STANDARD"])

    if not is_perishable or category == "STANDARD":
        return {
            "is_perishable": False,
            "category": "STANDARD",
            "category_label": profile["label"],
            "optimal_temp_c": profile["optimal_temp_c"],
            "max_safe_temp_c": profile["max_safe_temp_c"],
            "decay_rate": 0.0,
            "spoilage_threshold_min": 9999.0,
            "idle_stall_minutes": idle_stall_minutes,
            "ambient_temp_c": round(ambient_temp_c, 1),
            "current_cargo_temp_c": 21.0,
            "decay_score": 0.0,
            "spoilage_risk": "SAFE",
            "exponential_weight_multiplier": 1.0,
            "safe_runway_remaining_min": 9999.0,
            "estimated_loss_value_usd": 0.0
        }

    decay_rate = item.get("decay_rate") or profile["decay_rate"]
    spoilage_thresh = item.get("spoilage_threshold_min") or profile["spoilage_threshold_min"]
    thermal_k = profile["thermal_conductivity"]

    # Effective thermal exposure
    heat_ratio = (max(20.0, ambient_temp_c) / 22.0) ** 1.35
    effective_stress = (idle_stall_minutes * heat_ratio) + (elapsed_transit_minutes * 0.22)

    # Current cargo temperature modeled inside insulated container
    optimal_t = profile["optimal_temp_c"]
    max_safe_t = profile["max_safe_temp_c"]
    temp_rise = min(26.0, effective_stress * thermal_k)
    current_cargo_temp = round(optimal_t + temp_rise, 1)

    # Exponential decay calculation: S_decay = 100 * (1 - e^(-lambda * tau))
    raw_decay = 100.0 * (1.0 - math.exp(-decay_rate * max(0.0, effective_stress)))
    decay_score = round(min(100.0, max(0.0, raw_decay)), 1)

    # Risk badge categorization
    if decay_score >= 75.0 or current_cargo_temp >= (max_safe_t + 6.0):
        spoilage_risk = "RED_CRITICAL"
    elif decay_score >= 45.0 or current_cargo_temp >= max_safe_t:
        spoilage_risk = "AMBER_WARNING"
    else:
        spoilage_risk = "SAFE"

    # Exponential sorting weight elevation when idle time exceeds safe limits
    # If decay score exceeds 40% (safe zone), weight surges exponentially
    stress_delta = max(0.0, decay_score - 40.0)
    # Exponential factor: e^(0.85 * (stress / 15)) -> doubles every ~12% decay
    exponential_mult = round(float(math.exp(0.85 * (stress_delta / 15.0))), 2)

    # Calculate remaining safe thermal runway in minutes
    safe_runway = max(0.0, round(spoilage_thresh - (idle_stall_minutes * heat_ratio), 1))

    cargo_val = item.get("cargo_value_usd") or profile["default_loss_usd"]

    return {
        "is_perishable": True,
        "category": category,
        "category_label": profile["label"],
        "optimal_temp_c": optimal_t,
        "max_safe_temp_c": max_safe_t,
        "decay_rate": decay_rate,
        "spoilage_threshold_min": spoilage_thresh,
        "idle_stall_minutes": round(idle_stall_minutes, 1),
        "ambient_temp_c": round(ambient_temp_c, 1),
        "current_cargo_temp_c": current_cargo_temp,
        "decay_score": decay_score,
        "spoilage_risk": spoilage_risk,
        "exponential_weight_multiplier": exponential_mult,
        "safe_runway_remaining_min": safe_runway,
        "estimated_loss_value_usd": cargo_val
    }

def process_deliveries_dataframe(
    deliveries: List[Dict[str, Any]],
    ambient_temp_c: float = 31.5,
    idle_stall_minutes: float = 0.0
) -> Dict[str, Any]:
    """
    Leverages Pandas to vectorize cold-chain decay curve analytics across the entire fleet.
    """
    if not deliveries:
        return {
            "deliveries": [],
            "summary": {
                "total_deliveries": 0,
                "perishable_count": 0,
                "amber_warning_count": 0,
                "red_critical_count": 0,
                "total_cargo_value_at_risk_usd": 0.0,
                "avg_decay_score": 0.0,
                "max_decay_score": 0.0,
                "ambient_temp_c": ambient_temp_c,
                "idle_stall_minutes": idle_stall_minutes
            }
        }

    df = pd.DataFrame(deliveries)

    # Add cold chain metadata if missing
    if "is_perishable" not in df.columns:
        df["is_perishable"] = False
    if "perishable_category" not in df.columns:
        df["perishable_category"] = "STANDARD"

    evaluations = [
        evaluate_package_decay(
            row.to_dict(),
            ambient_temp_c=ambient_temp_c,
            idle_stall_minutes=idle_stall_minutes
        )
        for _, row in df.iterrows()
    ]

    eval_df = pd.DataFrame(evaluations)

    # Attach computed values back to main dataframe
    df["current_cargo_temp_c"] = eval_df["current_cargo_temp_c"]
    df["ambient_temp_c"] = eval_df["ambient_temp_c"]
    df["idle_stall_minutes"] = eval_df["idle_stall_minutes"]
    df["decay_score"] = eval_df["decay_score"]
    df["spoilage_risk"] = eval_df["spoilage_risk"]
    df["exponential_weight_multiplier"] = eval_df["exponential_weight_multiplier"]
    df["safe_runway_remaining_min"] = eval_df["safe_runway_remaining_min"]
    df["cold_chain_metadata"] = evaluations

    # Elevate priority score dynamically using exponential multiplier
    base_priority = df["priority_score"].astype(float)
    df["effective_priority_score"] = np.round(
        base_priority * df["exponential_weight_multiplier"], 1
    )

    perishables_mask = df["is_perishable"] == True
    perishables_df = df[perishables_mask]

    amber_count = int((df["spoilage_risk"] == "AMBER_WARNING").sum())
    red_count = int((df["spoilage_risk"] == "RED_CRITICAL").sum())
    perishable_count = int(perishables_mask.sum())

    total_value_at_risk = float(
        eval_df[eval_df["spoilage_risk"].isin(["AMBER_WARNING", "RED_CRITICAL"])]["estimated_loss_value_usd"].sum()
    )

    avg_decay = float(perishables_df["decay_score"].mean()) if not perishables_df.empty else 0.0
    max_decay = float(perishables_df["decay_score"].max()) if not perishables_df.empty else 0.0

    summary = {
        "total_deliveries": len(df),
        "perishable_count": perishable_count,
        "amber_warning_count": amber_count,
        "red_critical_count": red_count,
        "total_cargo_value_at_risk_usd": round(total_value_at_risk, 2),
        "avg_decay_score": round(avg_decay, 1),
        "max_decay_score": round(max_decay, 1),
        "ambient_temp_c": round(ambient_temp_c, 1),
        "idle_stall_minutes": round(idle_stall_minutes, 1),
        "perishable_categories_breakdown": {
            "ice_cream": int((df["perishable_category"] == "ICE_CREAM").sum()),
            "pharmaceuticals": int((df["perishable_category"] == "PHARMACEUTICALS").sum()),
            "seafood_dairy": int((df["perishable_category"] == "SEAFOOD_DAIRY").sum()),
            "fresh_flowers": int((df["perishable_category"] == "FRESH_FLOWERS").sum()),
        }
    }

    # Convert dataframe back to serializable dicts
    result_records = df.to_dict(orient="records")

    # Clean non-serializable values (NaN, etc.)
    for rec in result_records:
        for k, v in rec.items():
            if isinstance(v, float) and math.isnan(v):
                rec[k] = None

    return {
        "deliveries": result_records,
        "summary": summary
    }

def main():
    parser = argparse.ArgumentParser(description="CargoFlow AI Cold-Chain Decay Curve Engine")
    parser.add_argument("--ambient-temp", type=float, default=32.0, help="Ambient temperature in Celsius")
    parser.add_argument("--idle-stall", type=float, default=25.0, help="Engine idle / traffic stall in minutes")
    parser.add_argument("--mongo-uri", type=str, default="mongodb://127.0.0.1:27017/", help="MongoDB URI")
    parser.add_argument("--db-name", type=str, default="fleet_db", help="Database name")
    parser.add_argument("--sync-db", action="store_true", help="Sync evaluated decay scores to MongoDB")
    args = parser.parse_args()

    client = MongoClient(args.mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[args.db_name]
    deliveries = list(db["deliveries"].find())

    processed = process_deliveries_dataframe(
        deliveries,
        ambient_temp_c=args.ambient_temp,
        idle_stall_minutes=args.idle_stall
    )

    if args.sync_db:
        for d in processed["deliveries"]:
            db["deliveries"].update_one(
                {"delivery_id": d["delivery_id"]},
                {
                    "$set": {
                        "current_cargo_temp_c": d.get("current_cargo_temp_c"),
                        "ambient_temp_c": d.get("ambient_temp_c"),
                        "idle_stall_minutes": d.get("idle_stall_minutes"),
                        "decay_score": d.get("decay_score"),
                        "spoilage_risk": d.get("spoilage_risk"),
                        "exponential_weight_multiplier": d.get("exponential_weight_multiplier"),
                        "safe_runway_remaining_min": d.get("safe_runway_remaining_min"),
                        "cold_chain_metadata": d.get("cold_chain_metadata")
                    }
                }
            )

    print(json.dumps(processed["summary"], indent=2))

if __name__ == "__main__":
    main()
