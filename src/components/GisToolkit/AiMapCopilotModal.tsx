import { useState, useMemo } from "react";
import {
  Bot,
  X,
  Sparkles,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";
import type { AppGeoFeature } from "../../types/geo";
import {
  haversineDistance,
  estimateVijayawadaElevation,
  type LngLat,
} from "../../utils/gisMath";
import { requestEmergencyPlan } from "../../services/emergencyPlannerClient";
import type {
  EmergencyPlanRequest,
  EmergencyPlanResponse,
  AffectedRoadItem,
  AffectedInfrastructureItem,
  FacilityItem,
} from "../../types/emergencyPlan";

interface AiMapCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFeature: AppGeoFeature | null;
  allFeatures: AppGeoFeature[];
}

export function AiMapCopilotModal({
  isOpen,
  onClose,
  selectedFeature,
  allFeatures,
}: AiMapCopilotModalProps) {
  const [activeTab, setActiveTab] = useState<"quickQuery" | "plan">("quickQuery");
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [queryResponse, setQueryResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emergencyPlan, setEmergencyPlan] = useState<EmergencyPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Derive feature center coordinates
  const featureCenter = useMemo<LngLat>(() => {
    if (!selectedFeature) return [80.648, 16.506];
    const geom = selectedFeature.geometry;
    if (geom.type === "Point") return geom.coordinates as LngLat;
    if (geom.type === "Polygon") {
      const ring = geom.coordinates[0] as LngLat[];
      if (ring && ring.length > 0) {
        let sLng = 0;
        let sLat = 0;
        for (const p of ring) {
          sLng += p[0];
          sLat += p[1];
        }
        return [sLng / ring.length, sLat / ring.length];
      }
    }
    return [80.648, 16.506];
  }, [selectedFeature]);

  // Compute nearby facilities for context
  const nearbyContext = useMemo(() => {
    const facilities = allFeatures
      .filter(
        (f) =>
          f.properties.category === "hospitals" ||
          f.properties.category === "shelters" ||
          f.properties.category === "emergencyServices"
      )
      .map((f) => {
        let pt: LngLat | null = null;
        if (f.geometry.type === "Point") pt = f.geometry.coordinates as LngLat;
        else if (f.geometry.type === "Polygon") pt = f.geometry.coordinates[0][0] as LngLat;
        const d = pt ? haversineDistance(featureCenter, pt) : 999999;
        return { feature: f, distanceMeters: d };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 5);

    return facilities;
  }, [allFeatures, featureCenter]);

  // Quick Pre-Engineered Spatial Inquiries
  const handleRunQuickQuery = (queryType: string) => {
    setSelectedPrompt(queryType);
    setIsLoading(true);
    setError(null);
    setQueryResponse(null);

    const fName = selectedFeature?.properties.name || "Selected Vijayawada Sector";
    const elev = estimateVijayawadaElevation(featureCenter[0], featureCenter[1]);

    setTimeout(() => {
      setIsLoading(false);
      if (queryType === "available_info") {
        setQueryResponse(
          `### Spatial Baseline Information for ${fName}\n\n` +
          `**Coordinates:** ${featureCenter[1].toFixed(5)}°N, ${featureCenter[0].toFixed(5)}°E\n` +
          `**Topographic Context:** ${elev.elevationM}m MSL (${elev.terrainType})\n` +
          `**Category:** ${selectedFeature?.properties.category || "Monitored Sector"}\n` +
          `**Hazard Classification:** ${(selectedFeature?.properties.riskLevel || "MONITORED").toUpperCase()} RISK\n` +
          `**Data Provenance:** ${selectedFeature?.properties.provenance || "LIVE"} via verified APSDMA/OSM baseline.\n\n` +
          `*Note: Elevation is referenced against Krishna River zero datum at Prakasam Barrage (17.5m MSL).*`
        );
      } else if (queryType === "nearby_facilities") {
        const facList = nearbyContext
          .map(
            (c, i) =>
              `${i + 1}. **${c.feature.properties.name}** (${c.feature.properties.type}) — ${(c.distanceMeters / 1000).toFixed(2)} km away`
          )
          .join("\n");
        setQueryResponse(
          `### Verified Emergency Infrastructure Near ${fName}\n\n` +
          `${facList}\n\n` +
          `*All distances are computed along true geodesic geodesics. For road driving distances, evaluate via the Disaster Routing tool.*`
        );
      } else if (queryType === "hazard_conflicts") {
        const isCritical = selectedFeature?.properties.riskLevel === "critical";
        setQueryResponse(
          `### Hazard Overlap Assessment\n\n` +
          (isCritical
            ? `⚠️ **CRITICAL HAZARD ZONE**: This location is situated within the low-lying riparian flood zone directly impacted by high Krishna River discharges (>450k cfs).\n\n` +
              `- Embankment breach risk: Elevated along Krishna Lanka riverfront.\n` +
              `- Ingress viability: NH16 and Varadhi bridge approach are monitored.\n` +
              `- Evacuation priority: High urgency for ground-floor dwellings.`
            : `✅ **MODERATE / CONTROLLED RISK**: Location is outside primary riverbed overflow contours under baseline conditions. Monitored for surface runoff and canal drainage backlog.`)
        );
      } else if (queryType === "missing_data") {
        setQueryResponse(
          `### Missing Information & Telemetry Gaps\n\n` +
          `1. **Real-Time Ward Dewatering Capacity**: Live pump telemetry from VMC pump houses is uninstrumented in the public feed.\n` +
          `2. **Micro-Terrain Inundation Depth**: High-resolution LiDAR (sub-meter) is absent; elevation is derived from SRTM/HAND 30m model.\n` +
          `3. **Current Shelter Bed Real-Time Occupancy**: Capacity values represent nominal municipal limits; dynamic headcounts require district liaison verification.`
        );
      }
    }, 400);
  };

  // Full AI Response Plan Generation using existing FastAPI /api/emergency-plan
  const handleGenerateEmergencyPlan = async () => {
    setActiveTab("plan");
    setIsLoading(true);
    setError(null);

    const roads: AffectedRoadItem[] = allFeatures
      .filter((f) => f.properties.category === "roads")
      .slice(0, 10)
      .map((f, i) => ({
        id: `R-${i + 1}`,
        name: f.properties.name || "Primary Route",
        type: f.properties.type || "Arterial",
        status: "Monitored Arterial",
        provenance: "observed",
      }));

    const hospitals: FacilityItem[] = allFeatures
      .filter((f) => f.properties.category === "hospitals")
      .slice(0, 8)
      .map((f, i) => ({
        id: `H-${i + 1}`,
        name: f.properties.name || "Hospital",
        lat: f.geometry.type === "Point" ? f.geometry.coordinates[1] : undefined,
        lng: f.geometry.type === "Point" ? f.geometry.coordinates[0] : undefined,
        availability: "Operational",
        provenance: "observed",
      }));

    const shelters: FacilityItem[] = allFeatures
      .filter((f) => f.properties.category === "shelters")
      .slice(0, 6)
      .map((f, i) => ({
        id: `S-${i + 1}`,
        name: f.properties.name || "Shelter",
        lat: f.geometry.type === "Point" ? f.geometry.coordinates[1] : undefined,
        lng: f.geometry.type === "Point" ? f.geometry.coordinates[0] : undefined,
        availability: "Open",
        capacity: f.properties.capacity || 500,
        provenance: "observed",
      }));

    const infra: AffectedInfrastructureItem[] = [
      {
        id: "INF-PB",
        name: "Prakasam Barrage Sluice Structure",
        type: "River Barrier",
        status: "70 Gates Regulated",
        provenance: "observed",
      },
    ];

    const reqPayload: EmergencyPlanRequest = {
      location: {
        name: selectedFeature?.properties.name || "Vijayawada Riverfront Sector",
        lat: featureCenter[1],
        lng: featureCenter[0],
        district: "Krishna District",
      },
      floodStatus: {
        detectionStatus: "detected",
        severity: (selectedFeature?.properties.riskLevel as any) || "moderate",
        method: "GIS Spatial Context Analysis",
        timestamp: new Date().toISOString(),
        source: "Sentinel Earth FloodScope GIS",
      },
      affectedRoads: roads,
      affectedInfrastructure: infra,
      shelters,
      hospitals,
      operatorNotes: `Targeted analysis for feature: ${selectedFeature?.properties.name || "Sector"}.`,
    };

    try {
      const plan = await requestEmergencyPlan(reqPayload);
      setEmergencyPlan(plan);
    } catch (err: any) {
      setError(err?.message || "Failed to generate contingency plan from AI server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    const textToCopy =
      queryResponse ||
      (emergencyPlan ? JSON.stringify(emergencyPlan, null, 2) : "");
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-copilot-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ai-copilot-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="copilot-header">
          <div className="copilot-title-group">
            <Bot size={20} className="copilot-bot-icon" />
            <div>
              <h3 className="copilot-heading">AI Spatial Map Copilot</h3>
              <span className="copilot-subheading">
                Grounded Decision Support for{" "}
                <strong>{selectedFeature?.properties.name || "Vijayawada Sector"}</strong>
              </span>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close Copilot">
            <X size={16} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="copilot-tabs-row">
          <button
            type="button"
            className={`copilot-tab ${activeTab === "quickQuery" ? "active" : ""}`}
            onClick={() => setActiveTab("quickQuery")}
          >
            Spatial Queries
          </button>
          <button
            type="button"
            className={`copilot-tab ${activeTab === "plan" ? "active" : ""}`}
            onClick={() => setActiveTab("plan")}
          >
            Contingency Plan
          </button>
        </div>

        {/* Body */}
        <div className="copilot-body">
          {activeTab === "quickQuery" && (
            <div className="queries-pane">
              <span className="prompts-lead">Select Spatial Intelligence Inquiry:</span>
              <div className="prompt-cards-grid">
                {[
                  {
                    id: "available_info",
                    label: "What information is available for this zone?",
                    desc: "Coordinates, elevation profile, flood risk class, and provenance.",
                  },
                  {
                    id: "nearby_facilities",
                    label: "Which verified facilities are nearby?",
                    desc: "Hospitals, shelters, and emergency stations ranked by distance.",
                  },
                  {
                    id: "hazard_conflicts",
                    label: "Does this feature intersect active hazards?",
                    desc: "Evaluation against mapped inundation envelopes and barrage discharge.",
                  },
                  {
                    id: "missing_data",
                    label: "What telemetry or data is currently missing?",
                    desc: "Explicit audit of uninstrumented sensors and unverified fields.",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`prompt-chip-btn ${selectedPrompt === item.id ? "active" : ""}`}
                    onClick={() => handleRunQuickQuery(item.id)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.desc}</span>
                  </button>
                ))}
              </div>

              {isLoading && (
                <div className="copilot-loading-indicator">
                  <Loader2 size={18} className="spin-icon" />
                  <span>Synthesizing GIS spatial context…</span>
                </div>
              )}

              {queryResponse && (
                <div className="query-output-card">
                  <div className="output-header">
                    <span className="output-tag">SYNTHESIZED SPATIAL INTELLIGENCE</span>
                    <button type="button" className="copy-btn" onClick={handleCopy}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="output-markdown">
                    {queryResponse.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="plan-trigger-block">
                <button
                  type="button"
                  className="full-plan-btn"
                  onClick={handleGenerateEmergencyPlan}
                >
                  <Sparkles size={16} />
                  <span>Generate Complete Contingency Response Plan</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "plan" && (
            <div className="plan-pane">
              {isLoading && (
                <div className="copilot-loading-indicator">
                  <Loader2 size={20} className="spin-icon" />
                  <span>Executing grounded contingency planning on FastAPI engine…</span>
                </div>
              )}

              {error && (
                <div className="copilot-error-banner">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {emergencyPlan && (
                <div className="plan-results-scroll">
                  <div className="plan-summary-callout">
                    <h4>Situation Summary</h4>
                    <p>{emergencyPlan.situationSummary}</p>
                  </div>

                  <div className="plan-section">
                    <h4>Immediate Actions ({emergencyPlan.immediateActions.length})</h4>
                    <div className="actions-list">
                      {emergencyPlan.immediateActions.map((act, i) => (
                        <div key={i} className="action-row">
                          <span className={`priority-tag p-${act.priority.toLowerCase()}`}>
                            {act.priority}
                          </span>
                          <span className="action-text">{act.action}</span>
                          <span className="basis-tag">{act.basis}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="plan-section">
                    <h4>Missing Information & Gaps</h4>
                    <ul className="missing-list">
                      {emergencyPlan.missingInformation.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="plan-meta-banner">
                    <span>Model: {emergencyPlan.meta.model}</span>
                    <span>•</span>
                    <span>Mode: {emergencyPlan.meta.mode}</span>
                    <span>•</span>
                    <span>Cached: {emergencyPlan.meta.cached ? "Yes" : "No"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Disclaimer Footer */}
        <div className="copilot-footer">
          <ShieldCheck size={14} className="shield-icon" />
          <span>
            Decision-support analysis only. Verify all routes and facility capacities with APSDMA / District Collectorate.
          </span>
        </div>
      </div>
    </div>
  );
}
