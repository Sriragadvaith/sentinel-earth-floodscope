/**
 * NVIDIA Nemotron AI Response Planning Service
 *
 * Generates grounded emergency-response plans using NVIDIA Nemotron LLM
 * via Nebius Token Factory (OpenAI-compatible API).
 *
 * TRUTHFULNESS:
 * - Every AI output is labelled ESTIMATED
 * - The prompt includes a strict Fact-ID citation requirement
 * - Ungrounded statements are flagged in post-processing
 * - The service NEVER fabricates observations, depths, or damage counts
 */

import type {
  AnalysisResult,
  AIResponsePlan,
  KeyFinding,
  PrecautionaryAction,
} from "../types/analysis";

// ---------------------------------------------------------------------------
// Configuration - Proxied via Local Backend (/api/response-plan)
// NEVER call Nebius directly from client code to prevent key leaks
// ---------------------------------------------------------------------------

const BACKEND_PLAN_URL = "/api/response-plan";

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

export async function generateResponsePlan(
  analysis: AnalysisResult,
  onProgress?: (msg: string) => void,
): Promise<AIResponsePlan> {
  onProgress?.("Connecting to local Nebius AI reasoning planner...");

  try {
    const response = await fetch(BACKEND_PLAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analysis),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.warn("Planner backend error:", response.status, errText);
      onProgress?.(`Backend returned ${response.status} — using calibrated deterministic response plan.`);
      return generateLocalPlan(analysis);
    }

    onProgress?.("Processing grounded plan...");
    const plan = await response.json();
    return plan as AIResponsePlan;
  } catch (err) {
    console.warn("Backend request failed, falling back to local plan:", err);
    onProgress?.("Backend unreachable — using calibrated deterministic response plan.");
    return generateLocalPlan(analysis);
  }
}

// ---------------------------------------------------------------------------
// Local fallback plan (no API key needed)
// ---------------------------------------------------------------------------

function generateLocalPlan(analysis: AnalysisResult): AIResponsePlan {
  const facts = analysis.factsDigest;
  const exposedHospitals = analysis.exposedAssets.filter(
    (a) => a.category === "hospital" && (a.susceptibilityClass === "very_high" || a.susceptibilityClass === "high")
  );
  const exposedRoads = analysis.exposedAssets.filter(
    (a) => (a.category === "road" || a.category === "bridge") && (a.susceptibilityClass === "very_high" || a.susceptibilityClass === "high")
  );
  const criticalSectors = analysis.sectorSummaries.filter((s) => s.percentageHighRisk > 40);

  const keyFindings: KeyFinding[] = [
    {
      title: "Scenario Precipitation Load",
      description: `This hypothetical scenario models ${analysis.inputs.derivedTotalRainfallMm} mm total precipitation at ${analysis.inputs.rainfallIntensityMmH} mm/h intensity over ${analysis.inputs.rainfallDurationH} hours. Combined with ${((analysis.inputs.upstreamDischargeCusecs || 0) / 1000).toFixed(0)}k cusecs upstream discharge.`,
      factIds: ["F1", "F2"],
    },
    {
      title: "Healthcare Infrastructure Exposure",
      description: exposedHospitals.length > 0
        ? `${exposedHospitals.length} healthcare facility(s) fall within High or Very High susceptibility zones: ${exposedHospitals.map((h) => h.name).join(", ")}.`
        : "No healthcare facilities currently classified in High/Very High susceptibility zones under this scenario.",
      factIds: ["F3"],
    },
    {
      title: "Evacuation Route Susceptibility",
      description: exposedRoads.length > 0
        ? `${exposedRoads.reduce((s, r) => s + (r.lengthKm || 0), 0).toFixed(1)} km of evacuation arterials in elevated susceptibility zones, potentially affecting access to ${exposedRoads.map((r) => r.name).slice(0, 3).join(", ")}.`
        : "All mapped evacuation arterials remain in Low/Moderate susceptibility zones.",
      factIds: ["F4"],
    },
  ];

  const precautionaryActions: PrecautionaryAction[] = [];

  if (analysis.inputs.rainfallIntensityMmH > 80 || (analysis.inputs.upstreamDischargeCusecs || 0) > 700000) {
    precautionaryActions.push({
      id: "A1",
      priority: "IMMEDIATE",
      action: "If this scenario were to occur, activate Prakasam Barrage flood control protocol and alert downstream riverfront wards.",
      targetSector: "S-01",
      factIds: ["F1", "F2"],
      rationale: "Scenario discharge exceeds 2nd warning level threshold for Prakasam Barrage based on historical rating curves.",
    });
  }

  if (exposedHospitals.length > 0) {
    precautionaryActions.push({
      id: "A2",
      priority: "URGENT",
      action: `Assess flood preparedness of ${exposedHospitals.length} potentially exposed healthcare facility(s): ${exposedHospitals.map((h) => h.name).slice(0, 3).join(", ")}.`,
      factIds: ["F3"],
      rationale: "Facilities in High/Very High susceptibility zones may face access disruption if this hypothetical scenario materializes.",
    });
  }

  if (exposedRoads.length > 0) {
    precautionaryActions.push({
      id: "A3",
      priority: "PRECAUTIONARY",
      action: `Pre-identify alternative evacuation routes bypassing ${exposedRoads.length} potentially exposed road segment(s).`,
      factIds: ["F4"],
      rationale: "Road segments near drainage channels face higher susceptibility to waterlogging under heavy precipitation.",
    });
  }

  if (criticalSectors.length > 0) {
    precautionaryActions.push({
      id: "A4",
      priority: "ADVISORY",
      action: `Monitor ${criticalSectors.length} tactical sector(s) with >40% high-risk asset exposure: ${criticalSectors.map((s) => `${s.sectorCode} (${s.sectorName})`).join(", ")}.`,
      factIds: ["F5"],
      rationale: "Concentrated exposure in these sectors suggests prioritization for resource pre-positioning.",
    });
  }

  precautionaryActions.push({
    id: `A${precautionaryActions.length + 1}`,
    priority: "ADVISORY",
    action: "Verify all analysis outputs against official APSDMA / CWC flood bulletins before taking action.",
    factIds: ["F6"],
    rationale: "This analysis uses SRTM 30m terrain proxies and is not a substitute for calibrated hydrodynamic flood modeling or official forecasts.",
  });

  return {
    planId: `plan-local-${Date.now()}`,
    model: "FloodScope-LocalEngine-v1.0",
    createdAt: new Date().toISOString(),
    scenarioSummary: `${analysis.inputs.rainfallIntensityMmH} mm/h × ${analysis.inputs.rainfallDurationH}h, ${((analysis.inputs.upstreamDischargeCusecs || 0) / 1000).toFixed(0)}k cusecs`,
    keyFindings,
    precautionaryActions,
    uncertainties: [
      "Terrain susceptibility is based on SRTM 30m elevation — actual flood behaviour depends on bathymetry, culverts, and pump operations.",
      "No live gauge telemetry available — scenario is entirely hypothetical.",
      "Urban storm-drain capacity and soil infiltration characteristics are unknown.",
    ],
    limitationsNotice:
      "This is a locally generated hypothetical response plan. It does not use AI inference and represents a deterministic summary of the susceptibility analysis. All recommendations are precautionary and should be verified against official flood management guidance from APSDMA and CWC.",
    groundingStatus: {
      isFullyGrounded: true,
      unverifiedStatements: [],
      verifiedFactsCount: facts.length,
    },
    evidenceBadge: "ESTIMATED",
  };
}
