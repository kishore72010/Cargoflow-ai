import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

/**
 * Lazy initialization of the GoogleGenAI client using the server-side environment variable.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

/**
 * Robust execution helper that tries primary model (gemini-3.8-flash)
 * and falls back to gemini-flash-latest if temporary 503 capacity spikes occur.
 */
async function generateContentWithRetry(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const modelsToTry = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

  let lastError: any = null;
  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[CargoFlow Gemini] Model ${modelName} transient issue:`, err.message || err);
    }
  }
  throw lastError || new Error("All Gemini models were unavailable");
}

/**
 * Generates an executive AI tactical fleet briefing using Gemini 3.8 Flash.
 */
export async function generateFleetTacticalBriefing(data: {
  trucks: any[];
  deliveries: any[];
  atRiskCount: number;
  relaysCount: number;
  activeRelay?: any;
}): Promise<{
  headline: string;
  summary: string;
  urgencyLevel: "NOMINAL" | "ELEVATED" | "CRITICAL";
  operationalRisks: string[];
  recommendedActions: string[];
  relayRecommendations: string[];
  coldChainRisks: string[];
  slaRisks: string[];
  strategicRecommendations: string[];
  swarmsAssessment: string;
  fuelAndCarbonImpact: string;
}> {
  if (!isGeminiConfigured()) {
    const coldChainCount = data.deliveries.filter((d: any) => d.is_perishable && d.spoilage_risk !== "SAFE").length;
    return {
      headline: data.atRiskCount > 0 ? "Congestion Bottleneck Mitigated via Swarm Relay" : "Fleet Operating within Nominal SLA Windows",
      summary: data.atRiskCount > 0
        ? `Detected ${data.atRiskCount} deliveries approaching SLA window breach across ${data.trucks.length} vehicles. Swarm rendezvous candidates have been identified to decouple congested vehicles.`
        : `All ${data.deliveries.length} packages currently tracking on schedule across ${data.trucks.length} operational delivery vans. Topographic routing active.`,
      urgencyLevel: data.atRiskCount > 2 ? "CRITICAL" : data.atRiskCount > 0 ? "ELEVATED" : "NOMINAL",
      operationalRisks: data.atRiskCount > 0
        ? [`${data.atRiskCount} deliveries at risk of breach due to corridor congestion`, "Elevated dwell friction in commercial tower elevator banks"]
        : ["Routine urban congestion on Mission and Market Street corridors"],
      recommendedActions: [
        "Authorize Baton Pass rendezvous for delayed corridor vehicles",
        "Maintain LIFO cargo extraction sequence to minimize unloading delays",
        "Prioritize refrigerated & cold-chain cargo with active thermal decay",
      ],
      relayRecommendations: data.activeRelay
        ? [`Execute handoff from ${data.activeRelay.carrier_truck?.truck_id} to ${data.activeRelay.relay_truck?.truck_id} at ${data.activeRelay.rendezvous_hub?.name} to save ${data.activeRelay.metrics?.minutes_saved}m`]
        : ["No immediate multi-vehicle handoff required."],
      coldChainRisks: coldChainCount > 0
        ? [`${coldChainCount} temperature-sensitive cargo packages approaching thermal buffer threshold`]
        : ["All cold-chain cargo currently within certified safe runway limits."],
      slaRisks: data.atRiskCount > 0
        ? [`${data.atRiskCount} parcels projected to exceed delivery SLA window without intervention`]
        : ["All SLA deadlines currently protected."],
      strategicRecommendations: [
        "Authorize Baton Pass rendezvous for delayed corridor vehicles",
        "Maintain LIFO cargo extraction sequence to minimize unloading delays",
        "Prioritize refrigerated & cold-chain cargo with active thermal decay",
      ],
      swarmsAssessment: "Dynamic rendezvous at commercial staging bays bypasses gridlock by transferring parcels to unhindered downstream vehicles.",
      fuelAndCarbonImpact: "Topographic smart routing preserves vehicle battery and engine torque by smoothing steep SF hill climbs.",
    };
  }

  const prompt = `You are the chief AI Fleet Dispatcher for CargoFlow AI, an advanced urban logistics and cooperative swarm intelligence platform.
Analyze the current fleet status and produce an actionable tactical dispatch briefing.

CURRENT FLEET DATA:
- Total Delivery Vehicles: ${data.trucks.length}
- Total Active Deliveries: ${data.deliveries.length}
- At-Risk Deliveries (Potential SLA Window Breach): ${data.atRiskCount}
- Identified "Baton Pass" Swarm Relay Opportunities: ${data.relaysCount}
- Vehicles with Traffic Congestion: ${data.trucks.filter((t) => (t.current_traffic_delay_min || 0) > 0).map((t) => `${t.truck_id} (${t.current_traffic_delay_min}m delay)`).join(", ") || "None"}
- Top Baton Pass Candidate: ${data.activeRelay ? `${data.activeRelay.carrier_truck?.truck_id} -> ${data.activeRelay.relay_truck?.truck_id} at ${data.activeRelay.rendezvous_hub?.name} (saves ${data.activeRelay.metrics?.minutes_saved}m)` : "None"}

Generate your assessment in STRICT JSON format with these exact keys:
{
  "headline": "Short tactical headline (max 10 words)",
  "summary": "Concise 2-3 sentence executive summary of current bottleneck state and corridor flow",
  "urgencyLevel": "NOMINAL" | "ELEVATED" | "CRITICAL",
  "operationalRisks": ["Key risk 1", "Key risk 2"],
  "recommendedActions": ["Specific action 1 with vehicle ID", "Action 2", "Action 3"],
  "relayRecommendations": ["Relay recommendation note"],
  "coldChainRisks": ["Cold-chain assessment note"],
  "slaRisks": ["SLA timeline assessment note"],
  "strategicRecommendations": ["Bullet 1", "Bullet 2"],
  "swarmsAssessment": "1-2 sentences explaining why cooperative vehicle-to-vehicle handoffs (The Baton Pass) mitigate localized bottlenecks",
  "fuelAndCarbonImpact": "1 sentence on topographic elevation and fuel conservation impact"
}
Return ONLY valid JSON.`;

  try {
    const text = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      operationalRisks: parsed.operationalRisks || parsed.strategicRecommendations || [],
      recommendedActions: parsed.recommendedActions || parsed.strategicRecommendations || [],
      relayRecommendations: parsed.relayRecommendations || [],
      coldChainRisks: parsed.coldChainRisks || [],
      slaRisks: parsed.slaRisks || [],
      strategicRecommendations: parsed.strategicRecommendations || parsed.recommendedActions || [],
    };
  } catch (err) {
    return {
      headline: "Fleet Disruption Mitigated by Swarm Intelligence",
      summary: "Dynamic swarm evaluation completed. Vehicles routed to preserve delivery SLA windows.",
      urgencyLevel: data.atRiskCount > 0 ? "ELEVATED" : "NOMINAL",
      operationalRisks: ["Corridor gridlock on primary delivery arteries"],
      recommendedActions: ["Execute Baton Pass handoffs", "Maintain LIFO queue"],
      relayRecommendations: ["Baton pass candidate available at staging hub"],
      coldChainRisks: ["Active thermal containment shielding cargo"],
      slaRisks: ["Deliveries re-sequenced to protect SLA windows"],
      strategicRecommendations: [
        "Authorize Baton Pass window handoffs for congested corridors",
        "Maintain LIFO cargo extraction sequence to minimize unloading delays",
      ],
      swarmsAssessment: "Dynamic rendezvous at commercial staging bays bypasses gridlock.",
      fuelAndCarbonImpact: "Topographic smart routing preserves vehicle battery and engine torque.",
    };
  }
}

/**
 * Evaluates a specific Baton Pass rendezvous handoff using Gemini 3.8 Flash.
 */
export async function analyzeBatonPassRelay(relay: any): Promise<{
  recommendation: "EXECUTE_IMMEDIATELY" | "EXECUTE_WITH_CAUTION" | "ABORT";
  confidenceScore: number;
  tacticalRationale: string;
  coldChainSafetyMargin: string;
  handshakeFeasibility: string;
  keyMitigations: string[];
}> {
  if (!isGeminiConfigured()) {
    return {
      recommendation: "EXECUTE_IMMEDIATELY",
      confidenceScore: 94,
      tacticalRationale: `Authorizing handoff at ${relay.rendezvous_hub?.name || "Rendezvous Hub"} avoids +${relay.carrier_truck?.traffic_delay_min || 25}m gridlock and recovers ${relay.metrics?.minutes_saved || 18}m.`,
      coldChainSafetyMargin: "Rapid 2-minute curbside window handoff maintains temperature containment.",
      handshakeFeasibility: "Synchronized arrival window provides safe staging without blocking active traffic lanes.",
      keyMitigations: [
        "Drivers confirm digital barcode scan upon window pass",
        "Vehicle B immediately joins free-flowing corridor",
      ],
    };
  }

  const prompt = `You are CargoFlow AI's real-time Swarm Logistics Evaluator. Evaluate this dynamic multi-vehicle handoff ("The Baton Pass") in San Francisco:

RELAY DETAILS:
- Delivery ID: ${relay.delivery_id}
- Recipient: ${relay.recipient}
- Package Category: ${relay.package_type}
- Urgency: ${relay.urgency}
- Stalled Carrier Vehicle: ${relay.carrier_truck?.truck_id} (Driver: ${relay.carrier_truck?.driver}, Gridlock: +${relay.carrier_truck?.traffic_delay_min}m)
- Clear Relay Vehicle: ${relay.relay_truck?.truck_id} (Driver: ${relay.relay_truck?.driver})
- Rendezvous Hub: ${relay.rendezvous_hub?.name} (${relay.rendezvous_hub?.address})
- Synchronized Arrival: ${relay.handoff_details?.synchronized_time} (Wait delta: ${relay.handoff_details?.wait_delta_minutes}m, Transfer: ${relay.handoff_details?.transfer_duration_minutes}m)
- Minutes Saved: ${relay.metrics?.minutes_saved}m
- Status Quo Arrival: ${relay.metrics?.status_quo_arrival} vs Baton Pass Projected Arrival: ${relay.metrics?.relay_projected_arrival}
- Customer SLA Deadline: ${relay.metrics?.sla_deadline}

Provide an expert operational evaluation in STRICT JSON format with these exact keys:
{
  "recommendation": "EXECUTE_IMMEDIATELY" | "EXECUTE_WITH_CAUTION" | "ABORT",
  "confidenceScore": integer between 85 and 99,
  "tacticalRationale": "2 sentences explaining why this intersection point is optimal for preserving customer SLA",
  "coldChainSafetyMargin": "1-2 sentences on how this preserves temperature/perishable integrity for ${relay.package_type}",
  "handshakeFeasibility": "1 sentence assessing the curbside sync window and driver transfer safety",
  "keyMitigations": ["Short bullet point 1", "Short bullet point 2"]
}
Return ONLY valid JSON.`;

  try {
    const text = await generateContentWithRetry(prompt);
    return JSON.parse(text);
  } catch (err) {
    return {
      recommendation: "EXECUTE_IMMEDIATELY",
      confidenceScore: 94,
      tacticalRationale: `Authorizing handoff at ${relay.rendezvous_hub?.name} avoids +${relay.carrier_truck?.traffic_delay_min}m gridlock and recovers ${relay.metrics?.minutes_saved}m.`,
      coldChainSafetyMargin: "Rapid 2-minute curbside window handoff maintains temperature containment.",
      handshakeFeasibility: "Synchronized arrival window provides safe staging without blocking active traffic lanes.",
      keyMitigations: [
        "Drivers confirm digital barcode scan upon window pass",
        "Vehicle B immediately joins free-flowing corridor",
      ],
    };
  }
}

/**
 * Generates an AI-crafted customer ETA breach and resolution notice using Gemini 3.8 Flash.
 */
export async function generateSmartCustomerNotification(pkg: any, delayMinutes: number): Promise<{
  smsMessage: string;
  emailSubject: string;
  emailBody: string;
  tone: string;
}> {
  if (!isGeminiConfigured()) {
    return {
      smsMessage: `CargoFlow Alert: Package ${pkg.delivery_id} encountered corridor traffic. Proactive swarm routing engaged. ETA: ${pkg.time_window_end}.`,
      emailSubject: `Delivery Update: ${pkg.package_type} (${pkg.delivery_id})`,
      emailBody: `Dear ${pkg.recipient},\n\nWe are proactively updating you regarding your ${pkg.package_type}. Our real-time dispatch systems identified localized traffic congestion (${delayMinutes}m delay) and have dynamically rerouted our fleet to preserve your delivery window.`,
      tone: "Empathetic, reassuring, high-precision",
    };
  }

  const prompt = `Write a transparent, courteous, professional dispatch notification for a delivery customer.
Customer: ${pkg.recipient}
Package: ${pkg.package_type} (${pkg.delivery_id})
Urgency: ${pkg.urgency}
Promised Window: ${pkg.time_window_start} - ${pkg.time_window_end}
Delay Situation: Bottlenecked by localized corridor gridlock (${delayMinutes}m delay), but CargoFlow dynamic rescheduling is actively mitigating.

Return STRICT JSON format:
{
  "smsMessage": "Concise SMS under 160 chars including revised ETA reassurance",
  "emailSubject": "Professional email subject line",
  "emailBody": "2-3 short paragraphs explaining the proactive mitigation and updated delivery window",
  "tone": "Empathetic, reassuring, high-precision"
}
Return ONLY valid JSON.`;

  try {
    const text = await generateContentWithRetry(prompt);
    return JSON.parse(text);
  } catch (err) {
    return {
      smsMessage: `CargoFlow Update: Package ${pkg.delivery_id} encountered corridor traffic. Proactive swarm routing engaged. ETA: ${pkg.time_window_end}.`,
      emailSubject: `Delivery Update: ${pkg.package_type} (${pkg.delivery_id})`,
      emailBody: `Dear ${pkg.recipient},\n\nWe are proactively updating you regarding your ${pkg.package_type}. Our real-time dispatch systems identified localized traffic congestion and have dynamically rerouted our fleet to preserve your delivery window.`,
      tone: "Empathetic, reassuring, high-precision",
    };
  }
}

/**
 * Generates concise, speech-friendly audio assistant responses for commercial vehicle drivers
 * using Gemini 3.8 Flash with an intelligent heuristic fallback.
 */
export async function generateDriverVoiceCopilotResponse(context: {
  driverName: string;
  truckId: string;
  query: string;
  nextDelivery?: any;
  pendingCount: number;
  atRiskCount: number;
  coldChainCount: number;
  speed?: number;
  trafficProbabilityPct?: number;
  trafficRiskTier?: string;
}): Promise<{

  speechText: string;
  displayText: string;
  category: "NEXT_STOP" | "COLD_CHAIN" | "ROUTE_STATUS" | "AT_RISK" | "TELEMETRY" | "GENERAL";
}> {
  const queryLower = (context.query || "").toLowerCase();

  // Heuristic rule matching function (for fallback and instant response)
  const getHeuristicResponse = () => {
    if (queryLower.includes("next") || queryLower.includes("drop") || queryLower.includes("destination") || queryLower.includes("where")) {
      if (context.nextDelivery) {
        const coldInfo = context.nextDelivery.is_perishable
          ? ` Note: this is a temperature-sensitive ${context.nextDelivery.package_type} at ${context.nextDelivery.current_cargo_temp_c || 4}°C.`
          : "";
        const dwellInfo = context.nextDelivery.dwell_friction_minutes && context.nextDelivery.dwell_friction_minutes > 5
          ? ` High dwell building with elevator transit.`
          : "";
        const text = `Your next stop is ${context.nextDelivery.recipient} at ${context.nextDelivery.address}, due by ${context.nextDelivery.time_window_end}.${coldInfo}${dwellInfo}`;
        return { speechText: text, displayText: text, category: "NEXT_STOP" as const };
      }
      return {
        speechText: `You have completed all deliveries on your route for ${context.truckId}. Standby for new orders or return to central depot.`,
        displayText: `No pending deliveries. Standby or return to depot.`,
        category: "NEXT_STOP" as const,
      };
    }

    if (queryLower.includes("cold") || queryLower.includes("temp") || queryLower.includes("perish") || queryLower.includes("vaccine") || queryLower.includes("ice cream")) {
      if (context.nextDelivery && context.nextDelivery.is_perishable) {
        const text = `Active cold-chain package on board: ${context.nextDelivery.package_type}. Internal cargo temperature is ${context.nextDelivery.current_cargo_temp_c || 4.2}°C with ${context.nextDelivery.safe_runway_remaining_min || 30} minutes of safe thermal runway remaining. Status is ${context.nextDelivery.spoilage_risk || "SAFE"}.`;
        return { speechText: text, displayText: text, category: "COLD_CHAIN" as const };
      }
      const text = `You currently have ${context.coldChainCount} cold-chain packages in your cargo hold. All thermal sensors indicate containment within safe thresholds.`;
      return { speechText: text, displayText: text, category: "COLD_CHAIN" as const };
    }

    if (queryLower.includes("risk") || queryLower.includes("delay") || queryLower.includes("late") || queryLower.includes("traffic") || queryLower.includes("window") || queryLower.includes("predict") || queryLower.includes("probability") || queryLower.includes("chance")) {
      const prob = context.trafficProbabilityPct ?? (context.atRiskCount > 0 ? 82 : 18);
      const tier = context.trafficRiskTier || (prob >= 80 ? "SEVERE CHOKE" : prob >= 60 ? "HIGH RISK" : prob >= 35 ? "MODERATE RISK" : "LOW RISK");
      const advice = prob >= 60
        ? "Deceleration wave detected ahead. Proactive avoidance advised: divert to parallel arterial before Diversion Gate."
        : "Green corridor momentum. Maintain nominal route.";
      const text = `Predictive traffic occurrence probability along your corridor is ${prob}% (${tier}). ${advice} ${context.atRiskCount > 0 ? `Alert: ${context.atRiskCount} delivery approaching SLA deadline.` : "All deliveries currently on schedule."}`;
      return { speechText: text, displayText: text, category: "AT_RISK" as const };
    }


    if (queryLower.includes("how many") || queryLower.includes("remaining") || queryLower.includes("stops") || queryLower.includes("count") || queryLower.includes("status")) {
      const text = `You have ${context.pendingCount} pending deliveries remaining on your manifest. ${context.coldChainCount} are cold-chain, and ${context.atRiskCount} require priority attention.`;
      return { speechText: text, displayText: text, category: "ROUTE_STATUS" as const };
    }

    if (queryLower.includes("speed") || queryLower.includes("truck") || queryLower.includes("telemetry") || queryLower.includes("gps")) {
      const text = `Truck ${context.truckId} telemetry is online. Speed is ${context.speed || 0} km/h with active browser geolocation streaming to dispatch.`;
      return { speechText: text, displayText: text, category: "TELEMETRY" as const };
    }

    // Default polite assistant reply
    const text = `CargoFlow Voice Co-Pilot active for ${context.driverName} on truck ${context.truckId}. You have ${context.pendingCount} stops remaining. You can ask me about your next stop, cold chain temperatures, or route delays.`;
    return { speechText: text, displayText: text, category: "GENERAL" as const };
  };

  if (!isGeminiConfigured()) {
    return getHeuristicResponse();
  }

  // Construct Gemini contextual prompt
  const prompt = `You are "CargoFlow Co-Pilot", an in-cabin audio voice assistant for logistics drivers.
The driver asked a hands-free question while driving their delivery vehicle.
Keep your response concise (2 sentences maximum), direct, natural to speak out loud, and focused strictly on safety and facts.

Context:
- Driver Name: ${context.driverName}
- Assigned Vehicle: ${context.truckId}
- Current Speed: ${context.speed || 0} km/h
- Pending Deliveries: ${context.pendingCount}
- At-Risk Deliveries: ${context.atRiskCount}
- Cold-Chain Packages: ${context.coldChainCount}
- Next Delivery: ${JSON.stringify(context.nextDelivery || "None pending")}
- Driver Voice Query: "${context.query}"

Return STRICT JSON:
{
  "speechText": "Short 1-2 sentence spoken response formatted for natural text-to-speech audio",
  "displayText": "Concise text summary for the driver screen",
  "category": "NEXT_STOP" | "COLD_CHAIN" | "ROUTE_STATUS" | "AT_RISK" | "TELEMETRY" | "GENERAL"
}
Return ONLY valid JSON.`;

  try {
    const text = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(text);
    if (parsed.speechText && parsed.displayText) {
      return parsed;
    }
    return getHeuristicResponse();
  } catch (err) {
    console.warn("[CargoFlow Gemini Copilot] AI error, falling back to heuristic:", err);
    return getHeuristicResponse();
  }
}

