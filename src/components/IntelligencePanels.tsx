import { Shield, Waves, Hospital, Navigation, AlertCircle } from "lucide-react";
import type { FloodScenario } from "../types/scenario";

interface IntelligencePanelsProps {
  scenario: FloodScenario;
  totalFeatures: number;
  activeLayersCount: number;
}

export function IntelligencePanels({
  scenario,
  totalFeatures,
  activeLayersCount,
}: IntelligencePanelsProps) {
  // Assess transport infrastructure accessibility based on scenario discharge
  const roadAccessibilityPct =
    scenario.upstreamDischargeCusecs > 1000000
      ? 64
      : scenario.upstreamDischargeCusecs > 550000
      ? 82
      : 98;

  // Assess hospital facility access status
  const hospitalVulnerability =
    scenario.upstreamDischargeCusecs > 900000
      ? "2 Campuses In Flood Fringe"
      : scenario.upstreamDischargeCusecs > 450000
      ? "All Campuses Accessible (Watch Stage)"
      : "100% Operational & Secure";

  return (
    <aside className="intelligence-deck">
      <div className="intel-deck-header">
        <Shield className="intel-icon gold-text" />
        <h2 className="intel-deck-title">Geospatial Telemetry & Impact</h2>
      </div>

      <div className="intel-cards-stack">
        {/* River Hydrological Stage Card */}
        <div className="intel-card">
          <div className="intel-card-top">
            <span className="intel-k">
              <Waves className="card-mini-icon cyan-text" /> Prakasam Barrage Basin
            </span>
            <span className={`intel-status-pill pill-${scenario.riskCategory.toLowerCase()}`}>
              {scenario.riskCategory}
            </span>
          </div>
          <div className="intel-num-row">
            <span className="intel-big-num gold-text">{scenario.barrageWaterLevelFt}</span>
            <span className="intel-unit">ft MSL</span>
          </div>
          <div className="intel-progress-bar">
            <div
              className={`intel-progress-fill fill-${scenario.riskCategory.toLowerCase()}`}
              style={{
                width: `${Math.min(100, Math.max(10, ((scenario.barrageWaterLevelFt - 10) / 8) * 100))}%`,
              }}
            />
          </div>
          <div className="intel-sub-row">
            <span>Discharge: {(scenario.upstreamDischargeCusecs / 1000).toLocaleString()}k cfs</span>
            <span>Warning: 12.5 ft</span>
          </div>
        </div>

        {/* Transport Arteries Access Index */}
        <div className="intel-card">
          <div className="intel-card-top">
            <span className="intel-k">
              <Navigation className="card-mini-icon silver-text" /> Arterial Road Mobility
            </span>
            <span className="intel-tag">{roadAccessibilityPct}% Clear</span>
          </div>
          <div className="intel-num-row">
            <span className="intel-big-num silver-text">{roadAccessibilityPct}%</span>
            <span className="intel-unit">Passage Index</span>
          </div>
          <p className="intel-card-detail">
            {scenario.upstreamDischargeCusecs > 800000
              ? "Krishna Lanka Bund Road & low-level Barrage ramps flagged for inundation."
              : "NH16, Kanaka Durga Varadhi, and Inner Ring Road maintain clear passage."}
          </p>
        </div>

        {/* Critical Healthcare Readiness */}
        <div className="intel-card">
          <div className="intel-card-top">
            <span className="intel-k">
              <Hospital className="card-mini-icon rose-text" /> Emergency Healthcare
            </span>
            <span className="intel-tag">Level-1 Triage</span>
          </div>
          <div className="intel-num-row">
            <span className="intel-big-num">3,840</span>
            <span className="intel-unit">Total Beds</span>
          </div>
          <p className="intel-card-detail">{hospitalVulnerability}</p>
        </div>

        {/* Vector Features Loaded */}
        <div className="intel-card card-dim">
          <div className="intel-card-top">
            <span className="intel-k">
              <AlertCircle className="card-mini-icon" /> Active Spatial Matrix
            </span>
            <span className="intel-tag">{activeLayersCount} Overlays Active</span>
          </div>
          <div className="intel-sub-row mt-1">
            <span>Indexed Geometries: {totalFeatures}</span>
            <span>Vijayawada Datum</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
