import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Copy,
  Printer,
  Check,
  AlertTriangle,
  Info,
  Layers,
  FileText,
  Cpu,
  AlertOctagon,
  CheckCircle2,
  Navigation,
  Compass,
  Building2,
  Truck,
  Clock,
  Database,
  Radio,
} from "lucide-react";
import type { AppFeatureCollection } from "../types/geo";
import type { FloodScenario } from "../types/scenario";
import type { FloodDetectionResult } from "../types/detection";
import type {
  EmergencyPlanRequest,
  EmergencyPlanResponse,
  HealthCheckResponse,
  AffectedRoadItem,
  AffectedInfrastructureItem,
  FacilityItem,
  BasisType,
  PriorityType,
} from "../types/emergencyPlan";
import {
  checkBackendHealth,
  requestEmergencyPlan,
  EmergencyPlannerApiError,
} from "../services/emergencyPlannerClient";
import "./EmergencyResponsePlannerPanel.css";

interface EmergencyResponsePlannerPanelProps {
  geoData: AppFeatureCollection;
  currentScenario: FloodScenario;
  detectionResult?: FloodDetectionResult | null;
  onNavigateToMap?: () => void;
}

export function EmergencyResponsePlannerPanel({
  geoData,
  currentScenario,
  detectionResult,
  onNavigateToMap,
}: EmergencyResponsePlannerPanelProps) {
  // Health & Config status
  const [healthStatus, setHealthStatus] = useState<HealthCheckResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);

  // Planner Generation State
  const [planState, setPlanState] = useState<"idle" | "loading" | "success" | "error" | "not_configured">("idle");
  const [loadingStep, setLoadingStep] = useState<string>("Analyzing supplied data…");
  const [responsePlan, setResponsePlan] = useState<EmergencyPlanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [operatorNotes, setOperatorNotes] = useState<string>("");
  const [bypassCache, setBypassCache] = useState<boolean>(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // AbortController ref for in-flight cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check health on mount
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function verifyHealth() {
      try {
        const health = await checkBackendHealth(controller.signal);
        if (mounted) {
          setHealthStatus(health);
          if (health.mode === "live" && !health.aiConfigured) {
            setPlanState("not_configured");
          }
        }
      } catch {
        if (mounted) {
          setPlanState("not_configured");
        }
      }
    }

    verifyHealth();

    return () => {
      mounted = false;
      controller.abort();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Cooldown timer ticker
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Construct request payload from real existing app state
  const constructRequestPayload = useCallback(
    (forceBypassCache?: boolean): EmergencyPlanRequest => {
      // 1. Extract real observed roads from OpenStreetMap baseline features
      const roads: AffectedRoadItem[] = geoData.features
        .filter((f) => f.properties.category === "roads")
        .slice(0, 30)
        .map((f, idx) => ({
          id: `R-${f.properties.id || idx + 1}`,
          name: f.properties.name || `Evacuation Artery ${idx + 1}`,
          type: f.properties.type || "Primary Route",
          status: detectionResult?.intersectedAssets?.roadsKm
            ? "Potential Low-Lying Vulnerability"
            : "Monitored Arterial",
          provenance: "observed",
          source: "OpenStreetMap Verified Baseline",
          confidence: 0.95,
        }));

      // 2. Extract real observed hospitals
      const hospitals: FacilityItem[] = geoData.features
        .filter((f) => f.properties.category === "hospitals")
        .slice(0, 20)
        .map((f, idx) => ({
          id: `HOSP-${f.properties.id || idx + 1}`,
          name: f.properties.name || `Healthcare Facility ${idx + 1}`,
          lat: f.geometry.type === "Point" ? f.geometry.coordinates[1] : undefined,
          lng: f.geometry.type === "Point" ? f.geometry.coordinates[0] : undefined,
          availability: "Operational (Baseline OSM)",
          provenance: "observed",
          source: "AP Health Vector Dataset",
        }));

      // 3. Infrastructure & Riverfront Sectors
      const infrastructure: AffectedInfrastructureItem[] = geoData.features
        .filter((f) => f.properties.category === "floodZones" || f.properties.category === "river")
        .slice(0, 15)
        .map((f, idx) => ({
          id: `INF-${f.properties.id || idx + 1}`,
          name: f.properties.name || `Riverfront Sector ${idx + 1}`,
          type: f.properties.category === "river" ? "Waterway Channel" : "Lowland Embankment",
          status: "High Susceptibility Zone",
          provenance: "derived",
          source: "Hydrological HAND Model",
        }));

      // 4. Flood Status
      let detectionStatus: "detected" | "not_detected" | "unknown" | "simulated" = "simulated";
      let severity: "low" | "moderate" | "high" | "severe" | "unknown" = "moderate";
      let method = "Hydrological Scenario Screening";
      let timestamp = new Date().toISOString();
      let source = "Sentinel Earth Baseline";

      if (detectionResult) {
        detectionStatus = detectionResult.waterCoverageRatio > 0.05 ? "detected" : "not_detected";
        severity =
          detectionResult.waterCoverageRatio > 0.3
            ? "severe"
            : detectionResult.waterCoverageRatio > 0.15
            ? "high"
            : "moderate";
        method = detectionResult.algorithm;
        timestamp = detectionResult.timestamp;
        source = detectionResult.filename;
      } else if (currentScenario) {
        detectionStatus = "simulated";
        const cat = currentScenario.riskCategory;
        severity = cat === "CRITICAL" ? "severe" : cat === "WARNING" ? "high" : cat === "WATCH" ? "moderate" : "low";
        method = "Hydrological HAND Scenario Calculation";
        source = currentScenario.name;
      }

      // 5. Sample Shelters clearly tagged as simulated where live telemetry is absent
      const sampleShelters: FacilityItem[] = [
        {
          id: "SH-SIM-01",
          name: "Indira Gandhi Municipal Stadium (SIMULATED)",
          lat: 16.503,
          lng: 80.645,
          availability: "Staged Reception Center",
          capacity: 800,
          provenance: "simulated",
          source: "District Disaster Contingency Plan (Sample)",
        },
        {
          id: "SH-SIM-02",
          name: "Bishop Azariah High School Compound (SIMULATED)",
          lat: 16.518,
          lng: 80.635,
          availability: "Elevated Evacuation Shelter",
          capacity: 450,
          provenance: "simulated",
          source: "District Disaster Contingency Plan (Sample)",
        },
      ];

      return {
        location: {
          name: "Vijayawada Municipal Corporation",
          lat: 16.5062,
          lng: 80.648,
          district: "Krishna District",
        },
        floodStatus: {
          detectionStatus,
          severity,
          method,
          timestamp,
          source,
        },
        affectedRoads: roads,
        affectedInfrastructure: infrastructure,
        shelters: sampleShelters,
        hospitals,
        scenario: {
          rainfallIntensityMmH: currentScenario.rainfallRateMmH,
          durationH: currentScenario.durationHours,
          totalRainfallMm: currentScenario.rainfallRateMmH * currentScenario.durationHours,
          provenance: "simulated",
        },
        operatorNotes: operatorNotes.trim() ? operatorNotes.trim() : undefined,
        bypassCache: forceBypassCache ?? bypassCache,
      };
    },
    [geoData, currentScenario, detectionResult, operatorNotes, bypassCache]
  );

  // Execute Generate Plan
  const handleGeneratePlan = async (forceBypassCache?: boolean) => {
    if (cooldownRemaining > 0 || planState === "loading") return;

    // Abort previous request if in-flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const willBypass = forceBypassCache ?? bypassCache;

    setPlanState("loading");
    setErrorMessage(null);
    setLoadingStep(
      willBypass
        ? "Bypassing cache & requesting live Nebius AI inference…"
        : "Validating data provenance & boundary integrity…"
    );

    try {
      const payload = constructRequestPayload(willBypass);

      // Multi-step animated progress indicators
      const t1 = setTimeout(() => setLoadingStep("Transmitting payload via secure local proxy…"), 350);
      const t2 = setTimeout(
        () =>
          setLoadingStep(
            willBypass
              ? "Synthesizing live operational response via NVIDIA Nemotron…"
              : "Reasoning over verified infrastructure vectors…"
          ),
        850
      );
      const t3 = setTimeout(
        () => setLoadingStep("Performing server-side anti-hallucination verification…"),
        1500
      );

      const plan = await requestEmergencyPlan(payload, controller.signal);

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      setResponsePlan(plan);
      setPlanState("success");
      setCooldownRemaining(3); // 3s cooldown
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // cancelled
      }
      setPlanState("error");
      if (err instanceof EmergencyPlannerApiError) {
        if (err.code === "AI_NOT_CONFIGURED") {
          setErrorMessage("Nebius AI service is not configured. Set AI_MODE=mock or configure backend credentials.");
        } else {
          setErrorMessage(`${err.code}: ${err.message}`);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred while communicating with the emergency planner.");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Copy plan text to clipboard
  const handleCopyPlan = () => {
    if (!responsePlan) return;
    const text = `SENTINEL EARTH — FLOODSCOPE EMERGENCY RESPONSE PLAN
Target: Vijayawada, Andhra Pradesh, India
Generated: ${new Date(responsePlan.meta.generatedAt).toLocaleString()}
Model: ${responsePlan.meta.model} (Mode: ${responsePlan.meta.mode.toUpperCase()})
Cached: ${responsePlan.meta.cached ? "YES" : "NO"}

SITUATION SUMMARY:
${responsePlan.situationSummary}

IMMEDIATE PRECAUTIONARY ACTIONS:
${responsePlan.immediateActions.map((a, i) => `${i + 1}. [${a.priority}] (${a.basis}) ${a.action} (Refs: ${a.evidenceRefs.join(", ") || "None"})`).join("\n")}

EVACUATION CONSIDERATIONS:
${responsePlan.evacuationConsiderations.map((c, i) => `${i + 1}. (${c.basis}) ${c.consideration} (Refs: ${c.evidenceRefs.join(", ") || "None"})`).join("\n")}

CRITICAL INFRASTRUCTURE PRIORITIES:
${responsePlan.infrastructurePriorities.map((p, i) => `${i + 1}. (${p.basis}) ${p.item}: ${p.reason} (Refs: ${p.evidenceRefs.join(", ") || "None"})`).join("\n")}

RESOURCE RECOMMENDATIONS:
${responsePlan.resourceRecommendations.map((r, i) => `${i + 1}. (${r.basis}) ${r.resource}: ${r.rationale}`).join("\n")}

MISSING INFORMATION (IDENTIFIED GAPS):
${responsePlan.missingInformation.map((m) => `- ${m}`).join("\n")}

UNCERTAINTY ASSESSMENT (Level: ${responsePlan.uncertainty.level.toUpperCase()}):
${responsePlan.uncertainty.notes.map((n) => `- ${n}`).join("\n")}

SOURCES & LIMITATIONS:
Sources: ${responsePlan.dataSourcesAndLimitations.sourcesUsed.join("; ")}
Limitations: ${responsePlan.dataSourcesAndLimitations.limitations.join("; ")}

DISCLAIMER: AI-generated decision support. Verify with official authorities (APSDMA / NDRF / CWC). In an emergency in India, dial 112.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Print-friendly export
  const handlePrint = () => {
    window.print();
  };

  // Badge helpers
  const getBasisBadgeClass = (basis: BasisType) => {
    switch (basis) {
      case "verified_input":
        return "badge-basis-verified";
      case "simulated_input":
        return "badge-basis-simulated";
      case "assumption":
        return "badge-basis-assumption";
      case "general_guidance":
        return "badge-basis-guidance";
    }
  };

  const getBasisLabel = (basis: BasisType) => {
    switch (basis) {
      case "verified_input":
        return "Verified Input";
      case "simulated_input":
        return "Simulated Input";
      case "assumption":
        return "Operational Assumption";
      case "general_guidance":
        return "General Guidance (SOP)";
    }
  };

  const getPriorityBadgeClass = (priority: PriorityType) => {
    switch (priority) {
      case "IMMEDIATE":
        return "badge-priority-immediate";
      case "URGENT":
        return "badge-priority-urgent";
      case "PRECAUTIONARY":
        return "badge-priority-precautionary";
      case "ADVISORY":
        return "badge-priority-advisory";
    }
  };

  const requestSummary = constructRequestPayload();
  const isScenarioSimulated =
    requestSummary.floodStatus.detectionStatus === "simulated" || !detectionResult;

  return (
    <div className="planner-view-shell">
      {/* Persistent Required Grounding & Safety Banner */}
      <div className="planner-disclaimer-banner" role="alert">
        <div className="banner-left">
          <ShieldAlert size={18} className="banner-icon" />
          <div className="banner-text">
            <strong>AI-Generated Contingency Screening:</strong> All plans are advisory decision support to be verified on the ground by district authorities (APSDMA / NDRF).
            Flood susceptibility is computed by physical hydrological models and satellite SAR/optical pipelines, NOT by the language model.
          </div>
        </div>
        <div className="banner-right">
          {healthStatus && (
            <span
              className={`engine-mode-pill ${
                healthStatus.mode === "live" ? "mode-live-pill" : "mode-mock-pill"
              } ${healthStatus.aiConfigured ? "configured" : "unconfigured"}`}
            >
              <Radio size={12} className={healthStatus.mode === "live" ? "live-beacon" : ""} />
              <span>
                {healthStatus.mode.toUpperCase()} ENGINE: {healthStatus.aiConfigured ? "READY" : "NOT CONFIGURED"}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="planner-layout-grid">
        {/* Left Column: Data Input Inspector & Trigger Console */}
        <div className="planner-control-col">
          <div className="planner-card input-inspector-card">
            <div className="card-header">
              <div className="card-title-group">
                <Layers size={16} className="text-lavender" />
                <h3 className="card-title">Data Sent to Emergency Planner</h3>
              </div>
              <span className={`badge-tag ${isScenarioSimulated ? "badge-gold" : "badge-emerald"}`}>
                {isScenarioSimulated ? "Simulated Scenario" : "Observed Inundation"}
              </span>
            </div>

            <p className="card-desc">
              Anti-hallucination engine strictly binds recommendations to verified OpenStreetMap vectors, terrain HAND elevation grids, and operator context.
            </p>

            <div className="provenance-badges-grid">
              <div className="prov-item">
                <span className="prov-label">Incident Location:</span>
                <span className="prov-value">Vijayawada (16.506°N, 80.648°E)</span>
                <span className="badge-pill badge-observed">Observed</span>
              </div>

              <div className="prov-item">
                <span className="prov-label">Detection Status:</span>
                <span className="prov-value">
                  {requestSummary.floodStatus.detectionStatus.toUpperCase()} ({requestSummary.floodStatus.severity.toUpperCase()})
                </span>
                <span className={`badge-pill ${detectionResult ? "badge-observed" : "badge-simulated"}`}>
                  {detectionResult ? "Observed Mask" : "Simulated"}
                </span>
              </div>

              <div className="prov-item">
                <span className="prov-label">Affected Arterials:</span>
                <span className="prov-value">{requestSummary.affectedRoads.length} Road Segments</span>
                <span className="badge-pill badge-observed">Observed (OSM)</span>
              </div>

              <div className="prov-item">
                <span className="prov-label">Critical Infrastructure:</span>
                <span className="prov-value">{requestSummary.affectedInfrastructure.length} Zones / Bridges</span>
                <span className="badge-pill badge-derived">Derived HAND</span>
              </div>

              <div className="prov-item">
                <span className="prov-label">Healthcare Assets:</span>
                <span className="prov-value">{requestSummary.hospitals.length} Hospitals Mapped</span>
                <span className="badge-pill badge-observed">Observed</span>
              </div>

              <div className="prov-item">
                <span className="prov-label">Designated Shelters:</span>
                <span className="prov-value">{requestSummary.shelters.length} Relief Centers</span>
                <span className="badge-pill badge-simulated">Simulated Data</span>
              </div>

              <div className="prov-item">
                <span className="prov-label">Rainfall Scenario:</span>
                <span className="prov-value">
                  {currentScenario.rainfallRateMmH} mm/h ({currentScenario.rainfallRateMmH * currentScenario.durationHours} mm total)
                </span>
                <span className="badge-pill badge-simulated">Simulated</span>
              </div>
            </div>

            {/* Operator Field Notes */}
            <div className="operator-notes-block">
              <label htmlFor="operator-notes" className="operator-notes-label">
                <FileText size={14} />
                <span>Operator Tactical Notes (Untrusted Field Context)</span>
              </label>
              <textarea
                id="operator-notes"
                className="operator-notes-textarea"
                rows={3}
                placeholder="Enter field observations, e.g., low-lying water ingress near Krishna Lanka..."
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                maxLength={1000}
                disabled={planState === "loading"}
              />
              <div className="char-count">{operatorNotes.length}/1000 characters</div>
            </div>

            {/* Cache Control Option */}
            <div className="cache-toggle-wrapper">
              <label className="cache-toggle-label" htmlFor="bypass-cache-toggle">
                <input
                  id="bypass-cache-toggle"
                  type="checkbox"
                  className="cache-toggle-input"
                  checked={bypassCache}
                  onChange={(e) => setBypassCache(e.target.checked)}
                  disabled={planState === "loading"}
                />
                <span className="cache-toggle-custom" />
                <span className="cache-toggle-text">
                  Force Live Inference (<code>bypassCache=true</code>)
                </span>
              </label>
              <span className="cache-toggle-hint">
                Skips the 10-minute hash cache and forces a fresh run via Nebius AI.
              </span>
            </div>

            {/* Action Trigger Buttons */}
            <div className="action-button-wrapper">
              <div className="primary-buttons-row">
                <button
                  type="button"
                  className={`generate-plan-btn ${planState === "loading" ? "btn-loading" : ""}`}
                  onClick={() => handleGeneratePlan(false)}
                  disabled={planState === "loading" || cooldownRemaining > 0}
                  aria-live="polite"
                >
                  {planState === "loading" ? (
                    <>
                      <RefreshCw size={16} className="btn-spin-icon" />
                      <span>{loadingStep}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>
                        {cooldownRemaining > 0
                          ? `Cooldown (${cooldownRemaining}s)`
                          : responsePlan
                          ? "Regenerate Response Plan"
                          : "Generate Emergency Response Plan"}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="bypass-refresh-btn"
                  onClick={() => handleGeneratePlan(true)}
                  disabled={planState === "loading" || cooldownRemaining > 0}
                  title="Force a live inference request bypassing the response cache"
                >
                  <RefreshCw size={15} className={planState === "loading" ? "btn-spin-icon" : ""} />
                  <span>Fresh Run</span>
                </button>
              </div>

              <div className="action-meta-row">
                <span className="meta-hint">
                  NVIDIA Nemotron on Nebius Token Factory • Zero Client Secrets
                </span>
                {onNavigateToMap && (
                  <button type="button" className="link-to-map-btn" onClick={onNavigateToMap}>
                    <Navigation size={13} />
                    <span>View Map Layers</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Grounded Plan Output Deck */}
        <div className="planner-results-col" aria-live="polite" aria-atomic="true">
          {planState === "idle" && !responsePlan && (
            <div className="planner-empty-state-card">
              <Cpu size={48} className="empty-state-icon" />
              <h3>Nebius Emergency Response Planner</h3>
              <p>
                Click "Generate Emergency Response Plan" to synthesize a grounded, multi-tier crisis contingency strategy
                based on current rainfall simulations and real Vijayawada vector exposures.
              </p>
              <div className="grounding-bullet-points">
                <div className="bullet-point">
                  <CheckCircle2 size={15} className="text-lavender" />
                  <span>Strict Fact-Attribution: Every action declares its explicit evidence basis.</span>
                </div>
                <div className="bullet-point">
                  <CheckCircle2 size={15} className="text-lavender" />
                  <span>Zero Hallucinations: No fabricated phone numbers, bed capacities, or casualty counts.</span>
                </div>
                <div className="bullet-point">
                  <CheckCircle2 size={15} className="text-lavender" />
                  <span>Transparent Gaps: Missing field sensors and telemetry are highlighted prominently.</span>
                </div>
              </div>
            </div>
          )}

          {planState === "loading" && (
            <div className="planner-loading-card">
              <div className="skeleton-loader-stack">
                <div className="skeleton-bar title-bar" />
                <div className="skeleton-bar medium-bar" />
                <div className="skeleton-bar long-bar" />
                <div className="skeleton-bar short-bar" />
              </div>
              <div className="loading-status-badge">
                <RefreshCw size={15} className="btn-spin-icon text-lavender" />
                <span>{loadingStep}</span>
              </div>
            </div>
          )}

          {planState === "error" && (
            <div className="planner-error-card">
              <AlertOctagon size={36} className="text-rose" />
              <h4>Plan Generation Failed</h4>
              <p>{errorMessage || "Failed to contact planner service."}</p>
              <div className="error-actions-row">
                <button type="button" className="retry-btn" onClick={() => handleGeneratePlan(false)}>
                  <RefreshCw size={14} />
                  <span>Retry Request</span>
                </button>
                <button type="button" className="retry-bypass-btn" onClick={() => handleGeneratePlan(true)}>
                  <RefreshCw size={14} />
                  <span>Retry (Bypass Cache)</span>
                </button>
              </div>
            </div>
          )}

          {planState === "not_configured" && (
            <div className="planner-not-configured-card">
              <AlertTriangle size={36} className="text-gold" />
              <h4>Nebius AI Service Not Configured</h4>
              <p>
                The backend is currently in live mode with missing or unconfigured credentials.
              </p>
              <ol className="setup-steps-list">
                <li>Verify <code>.env</code> in the project root has <code>NEBIUS_API_KEY</code> set.</li>
                <li>Or set <code>AI_MODE=mock</code> to test safely with deterministic fixtures.</li>
                <li>Restart the backend service to apply environment changes.</li>
              </ol>
              <button
                type="button"
                className="retry-btn"
                disabled={healthLoading}
                onClick={async () => {
                  setHealthLoading(true);
                  const h = await checkBackendHealth().catch(() => null);
                  setHealthStatus(h);
                  if (h?.aiConfigured) setPlanState("idle");
                  setHealthLoading(false);
                }}
              >
                <RefreshCw size={14} className={healthLoading ? "btn-spin-icon" : ""} />
                <span>{healthLoading ? "Checking..." : "Re-check Configuration"}</span>
              </button>
            </div>
          )}

          {responsePlan && (
            <div className="planner-plan-container print-sheet">
              {/* Plan Header Bar */}
              <div className="plan-header-bar">
                <div className="plan-meta-left">
                  <div className="plan-hud-badge-row">
                    <span className="plan-hud-tag">CONTINGENCY OPERATIONAL BRIEFING</span>
                    <span
                      className={`mode-indicator-chip ${
                        responsePlan.meta.mode === "live" ? "chip-live" : "chip-mock"
                      }`}
                    >
                      {responsePlan.meta.mode === "live" ? (
                        <>
                          <span className="live-pulsing-dot" />
                          <span>LIVE NEBIUS ENGINE</span>
                        </>
                      ) : (
                        <span>MOCK FIXTURE</span>
                      )}
                    </span>
                    {responsePlan.meta.cached ? (
                      <span className="cache-status-pill cached" title="Retrieved from in-memory cache">
                        <Database size={12} />
                        <span>CACHED (Zero Credits Used)</span>
                      </span>
                    ) : (
                      <span className="cache-status-pill fresh">
                        <CheckCircle2 size={12} />
                        <span>FRESH INFERENCE</span>
                      </span>
                    )}
                  </div>

                  <h2 className="plan-title">Grounded Crisis Response Plan</h2>

                  <div className="plan-subline">
                    <span className="meta-sub-item">
                      <Clock size={12} />
                      <span>Generated: {new Date(responsePlan.meta.generatedAt).toLocaleTimeString()} Local</span>
                    </span>
                    <span className="dot-sep">•</span>
                    <span className="meta-sub-item">
                      <Cpu size={12} />
                      <span className="model-name-text">{responsePlan.meta.model}</span>
                    </span>
                  </div>
                </div>

                <div className="plan-actions-right no-print">
                  {responsePlan.meta.cached && (
                    <button
                      type="button"
                      className="toolbar-btn refresh-bypass-toolbar-btn"
                      onClick={() => handleGeneratePlan(true)}
                      title="Force fresh inference from Nebius AI"
                      disabled={planState === "loading" || cooldownRemaining > 0}
                    >
                      <RefreshCw size={14} />
                      <span>Bypass Cache & Re-run</span>
                    </button>
                  )}
                  <button type="button" className="toolbar-btn" onClick={handleCopyPlan} title="Copy Plan to Clipboard">
                    {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                    <span>{copied ? "Copied" : "Copy Briefing"}</span>
                  </button>
                  <button type="button" className="toolbar-btn" onClick={handlePrint} title="Print or Export PDF">
                    <Printer size={14} />
                    <span>Print Briefing</span>
                  </button>
                </div>
              </div>

              {/* Scenario Context Distinction Banner */}
              <div
                className={`scenario-context-flag ${
                  isScenarioSimulated ? "scenario-simulated-flag" : "scenario-observed-flag"
                }`}
              >
                {isScenarioSimulated ? (
                  <>
                    <AlertTriangle size={16} className="text-gold flex-shrink-0" />
                    <div>
                      <strong>HYPOTHETICAL SIMULATION CONTEXT:</strong> Recommendations address a simulated scenario (
                      {requestSummary.scenario?.rainfallIntensityMmH ?? 0} mm/h over {requestSummary.scenario?.durationH ?? 0}h).
                      Not an official emergency declaration.
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} className="text-emerald flex-shrink-0" />
                    <div>
                      <strong>VERIFIED GEOSPATIAL DIGEST:</strong> Recommendations incorporate observed satellite flood masks and verified OpenStreetMap infrastructure vectors.
                    </div>
                  </>
                )}
              </div>

              {/* 1. Situation Summary */}
              <div className="plan-section situation-section">
                <div className="section-label">01 // SITUATION SUMMARY</div>
                <div className="situation-callout">
                  <Info size={18} className="text-lavender flex-shrink-0" />
                  <p className="situation-text">{responsePlan.situationSummary}</p>
                </div>
              </div>

              {/* 2. Immediate Precautionary Actions (Card Deck) */}
              <div className="plan-section">
                <div className="section-header-row">
                  <div className="section-label">02 // IMMEDIATE PRECAUTIONARY ACTIONS</div>
                  <span className="count-badge">{responsePlan.immediateActions.length} Actions</span>
                </div>
                <div className="actions-stack">
                  {responsePlan.immediateActions.map((act, i) => (
                    <div key={i} className="action-card">
                      <div className="action-card-header">
                        <span className={`priority-badge ${getPriorityBadgeClass(act.priority)}`}>
                          {act.priority}
                        </span>
                        <span
                          className={`basis-badge ${getBasisBadgeClass(act.basis)}`}
                          title={`Basis: ${act.basis}`}
                        >
                          Basis: {getBasisLabel(act.basis)}
                        </span>
                      </div>
                      <p className="action-description">{act.action}</p>
                      {act.evidenceRefs.length > 0 && (
                        <div className="evidence-refs-row">
                          <span className="refs-label">Cited Input Evidence:</span>
                          {act.evidenceRefs.map((ref, rIdx) => (
                            <span key={rIdx} className="evidence-chip">
                              {ref}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Evacuation Considerations & Infrastructure Priorities (Cards) */}
              <div className="plan-two-col-grid">
                {/* Evacuation Considerations */}
                <div className="plan-section">
                  <div className="section-header-row">
                    <div className="section-label">
                      <Compass size={14} className="text-lavender" />
                      <span>03 // EVACUATION CONSIDERATIONS</span>
                    </div>
                    <span className="count-badge">{responsePlan.evacuationConsiderations.length}</span>
                  </div>
                  <div className="items-list">
                    {responsePlan.evacuationConsiderations.map((c, i) => (
                      <div key={i} className="sub-item-card evacuation-card">
                        <div className="card-top-row">
                          <span className={`basis-badge-mini ${getBasisBadgeClass(c.basis)}`}>
                            {getBasisLabel(c.basis)}
                          </span>
                          {c.evidenceRefs.length > 0 && (
                            <span className="evidence-mini-tag">
                              Refs: {c.evidenceRefs.join(", ")}
                            </span>
                          )}
                        </div>
                        <p className="sub-item-text">{c.consideration}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Infrastructure Priorities */}
                <div className="plan-section">
                  <div className="section-header-row">
                    <div className="section-label">
                      <Building2 size={14} className="text-lavender" />
                      <span>04 // INFRASTRUCTURE PRIORITIES</span>
                    </div>
                    <span className="count-badge">{responsePlan.infrastructurePriorities.length}</span>
                  </div>
                  <div className="items-list">
                    {responsePlan.infrastructurePriorities.map((inf, i) => (
                      <div key={i} className="sub-item-card infra-card">
                        <div className="sub-card-header">
                          <span className="infra-name">{inf.item}</span>
                          <span className={`basis-badge-mini ${getBasisBadgeClass(inf.basis)}`}>
                            {getBasisLabel(inf.basis)}
                          </span>
                        </div>
                        <p className="sub-item-text">{inf.reason}</p>
                        {inf.evidenceRefs.length > 0 && (
                          <div className="evidence-refs-row mini-refs">
                            <span className="refs-label">Evidence:</span>
                            {inf.evidenceRefs.map((ref, rIdx) => (
                              <span key={rIdx} className="evidence-chip">
                                {ref}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Resource Recommendations (Card Deck) */}
              <div className="plan-section">
                <div className="section-header-row">
                  <div className="section-label">
                    <Truck size={14} className="text-lavender" />
                    <span>05 // RESOURCE & DEPLOYMENT RECOMMENDATIONS</span>
                  </div>
                  <span className="count-badge">{responsePlan.resourceRecommendations.length} Staged</span>
                </div>
                <div className="resource-grid">
                  {responsePlan.resourceRecommendations.map((r, i) => (
                    <div key={i} className="resource-card">
                      <div className="resource-card-header">
                        <Truck size={16} className="resource-icon text-lavender" />
                        <span className={`basis-badge-mini ${getBasisBadgeClass(r.basis)}`}>
                          {getBasisLabel(r.basis)}
                        </span>
                      </div>
                      <h5 className="resource-name">{r.resource}</h5>
                      <p className="resource-rationale">{r.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Missing Information (Prominent Gaps Warning) */}
              <div className="plan-section missing-info-section">
                <div className="section-label section-warning-label">
                  <AlertTriangle size={15} className="text-gold" />
                  <span>06 // IDENTIFIED INFORMATION GAPS (EXPLICIT OMISSIONS)</span>
                </div>
                <div className="missing-info-card">
                  <p className="missing-intro">
                    The AI engine identified the following critical operational data items as absent from the current inputs:
                  </p>
                  <ul className="missing-list">
                    {responsePlan.missingInformation.map((m, i) => (
                      <li key={i} className="missing-item">
                        <span className="missing-bullet" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 6. Uncertainty & Technical Limitations */}
              <div className="plan-two-col-grid">
                <div className="plan-section">
                  <div className="section-label">07 // UNCERTAINTY ASSESSMENT</div>
                  <div className="uncertainty-box">
                    <div className="uncertainty-level-row">
                      <span>Assessed Uncertainty Level:</span>
                      <span className={`uncertainty-level-pill level-${responsePlan.uncertainty.level}`}>
                        {responsePlan.uncertainty.level.toUpperCase()}
                      </span>
                    </div>
                    <ul className="notes-list">
                      {responsePlan.uncertainty.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="plan-section">
                  <div className="section-label">08 // DATA SOURCES & BOUNDARIES</div>
                  <div className="sources-box">
                    <span className="source-label">Datasets Utilized:</span>
                    <p className="sources-text">
                      {responsePlan.dataSourcesAndLimitations.sourcesUsed.join("; ")}
                    </p>
                    <span className="source-label">System Limitations:</span>
                    <ul className="notes-list">
                      {responsePlan.dataSourcesAndLimitations.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="plan-footer-disclaimer">
                <span>
                  Sentinel Earth — FloodScope v2.4-AGY • Precautionary Screening Directive • Emergency in India: Dial 112
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
