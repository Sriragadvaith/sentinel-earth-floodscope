import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Database,
  FileText,
  Hospital,
  Loader,
  MapPin,
  Navigation,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";
import type { FloodScenario } from "../types/scenario";
import type { AppFeatureCollection } from "../types/geo";
import type { AnalysisResult, EvidenceBadge, SusceptibilityClass } from "../types/analysis";
import { PRESET_SCENARIOS } from "../types/scenario";
import { runFloodSusceptibilityAnalysis } from "../services/floodAnalysis";
import { generateResponsePlan } from "../services/nemotronService";

interface AnalysisDashboardProps {
  currentScenario: FloodScenario;
  onScenarioChange: (s: FloodScenario) => void;
  geoData: AppFeatureCollection;
  onSwitchToMap: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EvidenceTag({ badge }: { badge: EvidenceBadge }) {
  const cls =
    badge === "OBSERVED"
      ? "ev-observed"
      : badge === "COMPUTED"
      ? "ev-computed"
      : badge === "ESTIMATED"
      ? "ev-estimated"
      : "ev-unavailable";
  return <span className={`evidence-tag ${cls}`}>{badge}</span>;
}

function SusceptibilityBadge({ cls }: { cls: SusceptibilityClass }) {
  const label = cls === "very_high" ? "VERY HIGH" : cls.toUpperCase();
  return <span className={`susceptibility-badge susc-${cls}`}>{label}</span>;
}

function RiskBadge({ risk }: { risk: FloodScenario["riskCategory"] }) {
  return (
    <span className={`risk-tier-badge badge-${risk.toLowerCase()}`}>
      {risk} STAGE
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function AnalysisDashboard({
  currentScenario,
  onScenarioChange,
  geoData,
  onSwitchToMap,
}: AnalysisDashboardProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

  // Run analysis
  const handleRunAnalysis = useCallback(() => {
    setIsRunning(true);
    setAnalysis(null);
    // Use requestAnimationFrame to let the UI update before heavy computation
    requestAnimationFrame(() => {
      const result = runFloodSusceptibilityAnalysis(currentScenario, geoData);
      setAnalysis(result);
      setIsRunning(false);
      setActiveSection("overview");
    });
  }, [currentScenario, geoData]);

  // Generate AI plan
  const handleGenerateAIPlan = useCallback(async () => {
    if (!analysis) return;
    setIsGeneratingAI(true);
    setAiProgress("Preparing analysis context...");

    try {
      const plan = await generateResponsePlan(analysis, setAiProgress);
      setAnalysis((prev) =>
        prev ? { ...prev, aiPlan: plan } : prev
      );
      setActiveSection("aiplan");
    } catch (err) {
      console.error("AI plan generation failed:", err);
      setAiProgress("Error generating plan. See console for details.");
    } finally {
      setIsGeneratingAI(false);
    }
  }, [analysis]);

  const toggleSector = (code: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // Quick preset selector
  const selectPreset = (preset: FloodScenario) => {
    onScenarioChange(preset);
  };

  return (
    <div className="analysis-dashboard">
      {/* Header */}
      <div className="analysis-header">
        <div className="analysis-header-left">
          <Activity className="analysis-header-icon" />
          <div>
            <h2 className="analysis-main-title">FloodScope Intelligence Engine</h2>
            <p className="analysis-subtitle">
              Transparent Flood-Susceptibility Analysis & Emergency Planning
            </p>
          </div>
        </div>
        <div className="analysis-header-right">
          <RiskBadge risk={currentScenario.riskCategory} />
          <button type="button" className="action-button action-reset" onClick={onSwitchToMap}>
            <MapPin size={14} /> Live Map
          </button>
        </div>
      </div>

      {/* Scenario Quick Selector */}
      <div className="analysis-scenario-bar">
        <div className="scenario-bar-label">
          <CloudRain size={14} className="gold-text" />
          <span>Active Scenario:</span>
          <strong className="gold-text">{currentScenario.name}</strong>
        </div>
        <div className="scenario-quick-pills">
          {PRESET_SCENARIOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`scenario-quick-pill ${currentScenario.id === p.id ? "pill-active" : ""}`}
              onClick={() => selectPreset(p)}
            >
              {p.name.length > 25 ? p.name.slice(0, 22) + "…" : p.name}
            </button>
          ))}
        </div>
        <div className="scenario-bar-metrics">
          <span className="metric-chip">
            <Waves size={12} /> {currentScenario.rainfallRateMmH} mm/h
          </span>
          <span className="metric-chip">
            <Zap size={12} /> {(currentScenario.upstreamDischargeCusecs / 1000).toFixed(0)}k cfs
          </span>
          <span className="metric-chip">
            {currentScenario.durationHours}h
          </span>
        </div>
      </div>

      {/* Run Analysis Button with Ripple & Shimmer */}
      <div className="analysis-run-bar">
        <motion.button
          type="button"
          className="run-analysis-btn marigold-border-sheen"
          onClick={handleRunAnalysis}
          disabled={isRunning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isRunning ? (
            <>
              <Loader size={16} className="spin-icon" /> Computing Susceptibility...
            </>
          ) : (
            <>
              <Play size={16} /> Run Flood Susceptibility Analysis
            </>
          )}
        </motion.button>
        {analysis && (
          <span className="run-meta">
            Last run: {new Date(analysis.createdAtUtc).toLocaleTimeString("en-IN", { hour12: false })} ·{" "}
            {analysis.exposedAssets.length} assets evaluated
          </span>
        )}
      </div>

      {/* Results */}
      {analysis && (
        <>
          {/* Tab Navigation */}
          <nav className="analysis-tabs">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "exposure", label: "Exposure", icon: AlertTriangle },
              { id: "sectors", label: "Sectors", icon: MapPin },
              { id: "facts", label: "Facts", icon: FileText },
              { id: "data", label: "Data Sources", icon: Database },
              { id: "aiplan", label: "AI Response Plan", icon: Sparkles },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`analysis-tab ${activeSection === tab.id ? "tab-active" : ""}`}
                onClick={() => setActiveSection(tab.id)}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
                {tab.id === "aiplan" && analysis.aiPlan && (
                  <span className="tab-dot" />
                )}
              </button>
            ))}
          </nav>

          {/* Tab Content with Smooth AnimatePresence */}
          <div className="analysis-content">
            <AnimatePresence mode="wait">
              {/* ---- OVERVIEW ---- */}
              {activeSection === "overview" && (
                <motion.div
                  key="tab-overview"
                  className="tab-panel panel-overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                <div className="overview-grid">
                  {/* Susceptibility Zones */}
                  <div className="overview-card card-zones">
                    <h3 className="card-title">
                      <Shield size={16} /> Susceptibility Zone Breakdown
                    </h3>
                    <div className="zone-bars">
                      {analysis.susceptibilitySummary.map((z) => (
                        <div key={z.riskClass} className="zone-bar-row">
                          <div className="zone-bar-label">
                            <span
                              className="zone-color-dot"
                              style={{ background: z.color }}
                            />
                            <span>{z.label}</span>
                          </div>
                          <div className="zone-bar-track">
                            <div
                              className="zone-bar-fill"
                              style={{
                                width: `${Math.max(2, z.percentage)}%`,
                                background: z.color,
                              }}
                            />
                          </div>
                          <div className="zone-bar-values">
                            <span>{z.percentage}%</span>
                            <span className="zone-area">{z.areaKm2} km²</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="zone-evidence-row">
                      <EvidenceTag badge="COMPUTED" />
                      <span className="zone-method-note">
                        HAND-proxy drainage proximity (SRTM 30m)
                      </span>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="overview-card card-metrics">
                    <h3 className="card-title">
                      <Zap size={16} /> Scenario Metrics
                    </h3>
                    <div className="metrics-grid">
                      <div className="metric-block">
                        <span className="metric-label">Total Rainfall</span>
                        <span className="metric-value gold-text">
                          {analysis.inputs.derivedTotalRainfallMm} mm
                        </span>
                        <span className="metric-sub">
                          {analysis.inputs.rainfallIntensityMmH} mm/h × {analysis.inputs.rainfallDurationH}h
                        </span>
                      </div>
                      <div className="metric-block">
                        <span className="metric-label">Upstream Discharge</span>
                        <span className="metric-value silver-text">
                          {((analysis.inputs.upstreamDischargeCusecs || 0) / 1000).toFixed(0)}k cusecs
                        </span>
                        <span className="metric-sub">Prakasam Barrage</span>
                      </div>
                      <div className="metric-block">
                        <span className="metric-label">Barrage Stage</span>
                        <span className="metric-value">
                          {analysis.inputs.riverStageFt} ft
                        </span>
                        <span className="metric-sub">FRL: 12.0 ft</span>
                      </div>
                      <div className="metric-block">
                        <span className="metric-label">Assets Evaluated</span>
                        <span className="metric-value">
                          {analysis.exposedAssets.length}
                        </span>
                        <span className="metric-sub">across {analysis.sectorSummaries.length} sectors</span>
                      </div>
                    </div>
                    <p className="metric-disclaimer">
                      <EvidenceTag badge="COMPUTED" /> Hypothetical scenario — not live observations.
                    </p>
                  </div>

                  {/* Quick Status */}
                  <div className="overview-card card-status">
                    <h3 className="card-title">
                      <ShieldAlert size={16} /> Analysis Status
                    </h3>
                    <p className="status-message">{analysis.statusMessage}</p>
                    <div className="status-details">
                      <span>Algorithm: {analysis.algorithmVersion}</span>
                      <span>Status: <strong className="gold-text">{analysis.status.toUpperCase()}</strong></span>
                    </div>
                    {analysis.missingData.length > 0 && (
                      <div className="missing-data-box">
                        <h4>
                          <AlertTriangle size={13} /> Missing Data ({analysis.missingData.length})
                        </h4>
                        <ul>
                          {analysis.missingData.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ---- EXPOSURE ---- */}
            {activeSection === "exposure" && (
              <motion.div
                key="tab-exposure"
                className="tab-panel panel-exposure"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="exposure-header">
                  <h3>
                    <AlertTriangle size={16} /> Infrastructure Exposure Analysis
                  </h3>
                  <span className="exposure-count">
                    {analysis.exposedAssets.length} assets evaluated
                  </span>
                </div>

                {/* Hospitals */}
                <div className="exposure-section">
                  <h4 className="exposure-section-title">
                    <Hospital size={14} className="rose-text" /> Healthcare Facilities
                  </h4>
                  <div className="exposure-table-wrap">
                    <table className="exposure-table">
                      <thead>
                        <tr>
                          <th>Facility</th>
                          <th>Susceptibility</th>
                          <th>Drainage Dist.</th>
                          <th>Sector</th>
                          <th>Beds</th>
                          <th>Status</th>
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.exposedAssets
                          .filter((a) => a.category === "hospital")
                          .sort((a, b) => {
                            const order: Record<SusceptibilityClass, number> = { very_high: 0, high: 1, moderate: 2, low: 3 };
                            return order[a.susceptibilityClass] - order[b.susceptibilityClass];
                          })
                          .map((asset) => (
                            <tr key={asset.id} className={`row-${asset.susceptibilityClass}`}>
                              <td className="asset-name-cell">
                                <span>{asset.name}</span>
                              </td>
                              <td><SusceptibilityBadge cls={asset.susceptibilityClass} /></td>
                              <td>{asset.distanceToDrainageM}m</td>
                              <td>{asset.sectorCode}</td>
                              <td>{asset.beds || "—"}</td>
                              <td className="status-cell">{asset.exposureStatus}</td>
                              <td><EvidenceTag badge={asset.evidenceBadge} /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Roads & Bridges */}
                <div className="exposure-section">
                  <h4 className="exposure-section-title">
                    <Navigation size={14} className="gold-text" /> Evacuation Arteries & Bridges
                  </h4>
                  <div className="exposure-table-wrap">
                    <table className="exposure-table">
                      <thead>
                        <tr>
                          <th>Arterial / Bridge</th>
                          <th>Susceptibility</th>
                          <th>Drainage Dist.</th>
                          <th>Length</th>
                          <th>Sector</th>
                          <th>Status</th>
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.exposedAssets
                          .filter((a) => a.category === "road" || a.category === "bridge")
                          .sort((a, b) => {
                            const order: Record<SusceptibilityClass, number> = { very_high: 0, high: 1, moderate: 2, low: 3 };
                            return order[a.susceptibilityClass] - order[b.susceptibilityClass];
                          })
                          .map((asset) => (
                            <tr key={asset.id} className={`row-${asset.susceptibilityClass}`}>
                              <td className="asset-name-cell">
                                <span>{asset.name}</span>
                                {asset.category === "bridge" && (
                                  <span className="bridge-badge">BRIDGE</span>
                                )}
                              </td>
                              <td><SusceptibilityBadge cls={asset.susceptibilityClass} /></td>
                              <td>{asset.distanceToDrainageM}m</td>
                              <td>{asset.lengthKm ? `${asset.lengthKm} km` : "—"}</td>
                              <td>{asset.sectorCode}</td>
                              <td className="status-cell">{asset.exposureStatus}</td>
                              <td><EvidenceTag badge={asset.evidenceBadge} /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ---- SECTORS ---- */}
            {activeSection === "sectors" && (
              <motion.div
                key="tab-sectors"
                className="tab-panel panel-sectors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <h3 className="section-title">
                  <MapPin size={16} /> Tactical Sector Exposure Summaries
                </h3>
                <div className="sector-cards">
                  {analysis.sectorSummaries.map((sector) => (
                    <div
                      key={sector.sectorCode}
                      className={`sector-card ${sector.percentageHighRisk > 40 ? "sector-critical" : ""}`}
                    >
                      <button
                        type="button"
                        className="sector-card-header"
                        onClick={() => toggleSector(sector.sectorCode)}
                      >
                        <div className="sector-header-left">
                          <span className="sector-code">{sector.sectorCode}</span>
                          <span className="sector-name">{sector.sectorName}</span>
                        </div>
                        <div className="sector-header-right">
                          <span className={`sector-risk-pct ${sector.percentageHighRisk > 40 ? "pct-high" : ""}`}>
                            {sector.percentageHighRisk}% high-risk
                          </span>
                          {expandedSectors.has(sector.sectorCode) ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </div>
                      </button>
                      {expandedSectors.has(sector.sectorCode) && (
                        <div className="sector-card-body">
                          <div className="sector-stats-row">
                            <div className="sector-stat">
                              <span className="stat-label">Area</span>
                              <span className="stat-value">{sector.totalAreaKm2} km²</span>
                            </div>
                            <div className="sector-stat">
                              <span className="stat-label">High-Risk Area</span>
                              <span className="stat-value gold-text">{sector.highRiskAreaKm2} km²</span>
                            </div>
                            <div className="sector-stat">
                              <span className="stat-label">Exposed Hospitals</span>
                              <span className="stat-value rose-text">{sector.exposedHospitalsCount}</span>
                            </div>
                            <div className="sector-stat">
                              <span className="stat-label">Exposed Roads</span>
                              <span className="stat-value">{sector.exposedRoadsKm} km</span>
                            </div>
                          </div>
                          <EvidenceTag badge={sector.evidenceBadge} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ---- FACTS ---- */}
            {activeSection === "facts" && (
              <motion.div
                key="tab-facts"
                className="tab-panel panel-facts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <h3 className="section-title">
                  <FileText size={16} /> Verified Facts Digest
                </h3>
                <p className="facts-intro">
                  Every value shown carries an evidence label. These facts serve as the grounding
                  source for the AI Response Plan.
                </p>
                <div className="facts-list">
                  {analysis.factsDigest.map((fact) => (
                    <div key={fact.id} className="fact-card">
                      <div className="fact-header">
                        <span className="fact-id">{fact.id}</span>
                        <span className="fact-topic">{fact.topic}</span>
                        <EvidenceTag badge={fact.evidenceBadge} />
                      </div>
                      <p className="fact-statement">{fact.statement}</p>
                      {fact.metricValue !== undefined && (
                        <span className="fact-metric">{String(fact.metricValue)}</span>
                      )}
                      <span className="fact-source">Source: {fact.source}</span>
                    </div>
                  ))}
                </div>

                {/* Limitations */}
                <div className="limitations-section">
                  <h4>
                    <ShieldCheck size={14} /> Analysis Limitations & Caveats
                  </h4>
                  <ul>
                    {analysis.limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {/* ---- DATA SOURCES ---- */}
            {activeSection === "data" && (
              <motion.div
                key="tab-data"
                className="tab-panel panel-data"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <h3 className="section-title">
                  <Database size={16} /> Data Source Provenance
                </h3>
                <div className="data-source-cards">
                  {analysis.dataSources.map((ds) => (
                    <div key={ds.name} className="data-source-card">
                      <div className="ds-header">
                        <span className="ds-name">{ds.name}</span>
                        <EvidenceTag badge={ds.evidenceBadge} />
                      </div>
                      <div className="ds-details">
                        <span>Vintage: {ds.vintage}</span>
                        <span>Resolution: {ds.resolution}</span>
                        <span>License: {ds.license}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ---- AI RESPONSE PLAN ---- */}
            {activeSection === "aiplan" && (
              <motion.div
                key="tab-aiplan"
                className="tab-panel panel-aiplan"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {!analysis.aiPlan && !isGeneratingAI && (
                  <div className="ai-empty-state">
                    <Sparkles size={32} className="gold-text" />
                    <h3>Generate AI Emergency Response Plan</h3>
                    <p>
                      Use NVIDIA Nemotron (via Nebius Token Factory) to synthesize the analysis
                      results into a grounded, fact-cited precautionary action plan.
                    </p>
                    <p className="ai-disclaimer">
                      All AI outputs are labelled <EvidenceTag badge="ESTIMATED" /> and must cite
                      specific Fact IDs. No fabricated data will be generated.
                    </p>
                    <button
                      type="button"
                      className="run-analysis-btn ai-generate-btn"
                      onClick={handleGenerateAIPlan}
                    >
                      <Sparkles size={16} /> Generate Response Plan
                    </button>
                  </div>
                )}

                {isGeneratingAI && (
                  <div className="ai-loading">
                    <Loader size={24} className="spin-icon gold-text" />
                    <span>{aiProgress || "Processing..."}</span>
                  </div>
                )}

                {analysis.aiPlan && (
                  <div className="ai-plan-content">
                    {/* Plan Header */}
                    <div className="ai-plan-header">
                      <div className="ai-plan-header-left">
                        <Sparkles size={18} className="gold-text" />
                        <div>
                          <h3>Emergency Response Plan</h3>
                          <span className="ai-plan-meta">
                            Model: {analysis.aiPlan.model} ·{" "}
                            {new Date(analysis.aiPlan.createdAt).toLocaleTimeString("en-IN", { hour12: false })}
                          </span>
                        </div>
                      </div>
                      <div className="ai-plan-header-right">
                        <EvidenceTag badge="ESTIMATED" />
                        {!analysis.aiPlan.groundingStatus.isFullyGrounded && (
                          <span className="grounding-warning">
                            <AlertTriangle size={12} /> {analysis.aiPlan.groundingStatus.unverifiedStatements.length} ungrounded
                          </span>
                        )}
                        <button
                          type="button"
                          className="action-button action-reset"
                          onClick={handleGenerateAIPlan}
                          disabled={isGeneratingAI}
                        >
                          <RotateCcw size={13} /> Regenerate
                        </button>
                      </div>
                    </div>

                    {/* Key Findings */}
                    <div className="ai-section">
                      <h4>Key Findings</h4>
                      <div className="findings-list">
                        {analysis.aiPlan.keyFindings.map((finding, i) => (
                          <div key={i} className="finding-card">
                            <h5>{finding.title}</h5>
                            <p>{finding.description}</p>
                            <div className="finding-facts">
                              {finding.factIds.map((fid) => (
                                <span key={fid} className="fact-ref">{fid}</span>
                              ))}
                              {finding.factIds.length === 0 && (
                                <span className="fact-ref ungrounded">UNGROUNDED</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Precautionary Actions */}
                    <div className="ai-section">
                      <h4>Precautionary Actions</h4>
                      <div className="actions-list">
                        {analysis.aiPlan.precautionaryActions.map((action) => (
                          <div key={action.id} className={`action-card priority-${action.priority.toLowerCase()}`}>
                            <div className="action-header">
                              <span className={`priority-badge pri-${action.priority.toLowerCase()}`}>
                                {action.priority}
                              </span>
                              <span className="action-id">{action.id}</span>
                              {action.targetSector && (
                                <span className="action-sector">{action.targetSector}</span>
                              )}
                            </div>
                            <p className="action-text">{action.action}</p>
                            <p className="action-rationale">{action.rationale}</p>
                            <div className="action-facts">
                              {action.factIds.map((fid) => (
                                <span key={fid} className="fact-ref">{fid}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Uncertainties */}
                    {analysis.aiPlan.uncertainties.length > 0 && (
                      <div className="ai-section">
                        <h4>
                          <AlertTriangle size={14} /> Uncertainties & Caveats
                        </h4>
                        <ul className="uncertainties-list">
                          {analysis.aiPlan.uncertainties.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Limitations Notice */}
                    <div className="ai-limitations-notice">
                      <ShieldCheck size={14} />
                      <p>{analysis.aiPlan.limitationsNotice}</p>
                    </div>

                    {/* Grounding Status */}
                    <div className="grounding-status-bar">
                      <span>
                        Grounding: {analysis.aiPlan.groundingStatus.verifiedFactsCount} facts verified
                      </span>
                      <span>
                        {analysis.aiPlan.groundingStatus.isFullyGrounded
                          ? "✓ Fully grounded"
                          : `⚠ ${analysis.aiPlan.groundingStatus.unverifiedStatements.length} ungrounded statement(s)`}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Empty State (no analysis run yet) */}
      {!analysis && !isRunning && (
        <div className="analysis-empty-state">
          <Activity size={48} className="empty-icon" />
          <h3>Select a Scenario & Run Analysis</h3>
          <p>
            Choose a preset scenario or adjust parameters, then click{" "}
            <strong>"Run Flood Susceptibility Analysis"</strong> to compute terrain-based
            susceptibility zones, infrastructure exposure, and sector summaries.
          </p>
          <div className="empty-badges">
            <EvidenceTag badge="OBSERVED" />
            <EvidenceTag badge="COMPUTED" />
            <EvidenceTag badge="ESTIMATED" />
            <EvidenceTag badge="UNAVAILABLE" />
          </div>
          <p className="empty-sub">
            Every value will carry one of these evidence labels per the Truthfulness Contract.
          </p>
        </div>
      )}
    </div>
  );
}
