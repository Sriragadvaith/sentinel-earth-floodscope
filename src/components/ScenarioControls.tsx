import { useState } from "react";
import { Sliders, CloudRain, ShieldCheck, Gauge, RotateCcw } from "lucide-react";
import { PRESET_SCENARIOS, type FloodScenario } from "../types/scenario";

interface ScenarioControlsProps {
  currentScenario: FloodScenario;
  onScenarioChange: (scenario: FloodScenario) => void;
}

export function ScenarioControls({ currentScenario, onScenarioChange }: ScenarioControlsProps) {
  const [activePresetId, setActivePresetId] = useState<string>(currentScenario.id);

  // Recalculate barrage water level and risk tier dynamically based on discharge & rainfall
  const handleDischargeChange = (discharge: number) => {
    setActivePresetId("custom");
    // Rating curve approximation for Prakasam Barrage (FRL 12.0 ft base)
    const barrageLevel = 11.0 + (discharge / 1110000) * 5.8 + (currentScenario.rainfallRateMmH / 200) * 0.9;
    const roundedLevel = Number(barrageLevel.toFixed(1));

    let risk: FloodScenario["riskCategory"] = "NORMAL";
    let affected: string[] = [];

    if (discharge >= 900000 || roundedLevel >= 15.5) {
      risk = "CRITICAL";
      affected = ["Krishna Lanka", "Ramalingeswara Nagar", "Bhavanipuram", "Tarapet", "Ranigarithota"];
    } else if (discharge >= 550000 || roundedLevel >= 14.0) {
      risk = "WARNING";
      affected = ["Krishna Lanka Bund", "Ajit Singh Nagar", "Vidyadharapuram"];
    } else if (discharge >= 350000 || roundedLevel >= 12.5) {
      risk = "WATCH";
      affected = ["Low-lying riverbank agricultural fields", "Padmavathi Ghat outer perimeter"];
    }

    onScenarioChange({
      ...currentScenario,
      id: "custom",
      name: "Custom Hydro-Meteorological Scenario",
      upstreamDischargeCusecs: discharge,
      barrageWaterLevelFt: roundedLevel,
      riskCategory: risk,
      affectedWardsApprox: affected,
    });
  };

  const handleRainfallChange = (rainfall: number) => {
    setActivePresetId("custom");
    const barrageLevel = 11.0 + (currentScenario.upstreamDischargeCusecs / 1110000) * 5.8 + (rainfall / 200) * 0.9;
    const roundedLevel = Number(barrageLevel.toFixed(1));

    let risk = currentScenario.riskCategory;
    if (rainfall >= 100 || roundedLevel >= 15.0) risk = "CRITICAL";
    else if (rainfall >= 60 || roundedLevel >= 13.5) risk = "WARNING";
    else if (rainfall >= 30) risk = "WATCH";

    onScenarioChange({
      ...currentScenario,
      id: "custom",
      name: "Custom Hydro-Meteorological Scenario",
      rainfallRateMmH: rainfall,
      barrageWaterLevelFt: roundedLevel,
      riskCategory: risk,
    });
  };

  const handleDurationChange = (hours: number) => {
    setActivePresetId("custom");
    onScenarioChange({
      ...currentScenario,
      id: "custom",
      durationHours: hours,
    });
  };

  const selectPreset = (preset: FloodScenario) => {
    setActivePresetId(preset.id);
    onScenarioChange(preset);
  };

  const getRiskBadgeClass = (risk: FloodScenario["riskCategory"]) => {
    switch (risk) {
      case "CRITICAL":
        return "badge-critical";
      case "WARNING":
        return "badge-warning";
      case "WATCH":
        return "badge-watch";
      default:
        return "badge-normal";
    }
  };

  return (
    <div className="scenario-controller-card">
      <div className="scenario-card-header">
        <div className="scenario-header-left">
          <Sliders className="header-icon gold-text" />
          <h3 className="scenario-title">Hydrological Inflow & Rainfall Simulation</h3>
        </div>
        <span className={`risk-tier-badge ${getRiskBadgeClass(currentScenario.riskCategory)}`}>
          {currentScenario.riskCategory} STAGE
        </span>
      </div>

      <p className="scenario-description">
        Model upstream reservoir releases from Nagarjuna Sagar / Srisailam combined with urban precipitation to assess Vijayawada flood plain exposure.
      </p>

      {/* Preset Scenario Selectors */}
      <div className="scenario-presets-row">
        {PRESET_SCENARIOS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-selector-btn ${activePresetId === preset.id ? "preset-selected" : ""}`}
            onClick={() => selectPreset(preset)}
          >
            <span className="preset-name">{preset.name}</span>
            <span className="preset-val-sub">
              {(preset.upstreamDischargeCusecs / 1000).toLocaleString()}k cfs · {preset.rainfallRateMmH} mm/h
            </span>
          </button>
        ))}
      </div>

      {/* Interactive Range Sliders */}
      <div className="sliders-cluster">
        {/* Upstream Discharge Slider */}
        <div className="slider-group">
          <div className="slider-label-row">
            <span className="slider-label">
              <Gauge className="slider-mini-icon gold-text" /> Upstream River Discharge (Prakasam Barrage)
            </span>
            <span className="slider-readout gold-text">
              {currentScenario.upstreamDischargeCusecs.toLocaleString()} cusecs
            </span>
          </div>
          <input
            type="range"
            min="50000"
            max="1250000"
            step="25000"
            value={currentScenario.upstreamDischargeCusecs}
            onChange={(e) => handleDischargeChange(Number(e.target.value))}
            className="styled-range-slider"
          />
          <div className="slider-markers">
            <span>50k (Base)</span>
            <span>397k (1st Warning)</span>
            <span>569k (2nd Warning)</span>
            <span>1.11M (2009 Record)</span>
          </div>
        </div>

        {/* Rainfall Intensity Slider */}
        <div className="slider-group">
          <div className="slider-label-row">
            <span className="slider-label">
              <CloudRain className="slider-mini-icon silver-text" /> Catchment Precipitation Intensity
            </span>
            <span className="slider-readout silver-text">
              {currentScenario.rainfallRateMmH} mm/h
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="180"
            step="5"
            value={currentScenario.rainfallRateMmH}
            onChange={(e) => handleRainfallChange(Number(e.target.value))}
            className="styled-range-slider"
          />
          <div className="slider-markers">
            <span>0 (Dry)</span>
            <span>35 (Moderate)</span>
            <span>75 (Heavy Downpour)</span>
            <span>150+ (Cloudburst)</span>
          </div>
        </div>

        {/* Duration Slider */}
        <div className="slider-group">
          <div className="slider-label-row">
            <span className="slider-label">Rainfall Duration</span>
            <span className="slider-readout">{currentScenario.durationHours} Hours</span>
          </div>
          <input
            type="range"
            min="1"
            max="48"
            step="1"
            value={currentScenario.durationHours}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            className="styled-range-slider"
          />
        </div>
      </div>

      {/* Calculated Hydro Telemetry Grid */}
      <div className="scenario-metrics-strip">
        <div className="metric-box">
          <span className="metric-k">Computed Water Level</span>
          <span className="metric-v gold-text">{currentScenario.barrageWaterLevelFt} ft</span>
          <span className="metric-hint">Prakasam FRL: 12.0 ft</span>
        </div>

        <div className="metric-box">
          <span className="metric-k">Barrage Gate Status</span>
          <span className="metric-v">
            {currentScenario.upstreamDischargeCusecs > 800000
              ? "70/70 Gates Full Open"
              : currentScenario.upstreamDischargeCusecs > 350000
              ? "52/70 Gates Open"
              : "Regulated Outflow (24 Gates)"}
          </span>
          <span className="metric-hint">70 Vent Scouring Sluices</span>
        </div>

        <div className="metric-box">
          <span className="metric-k">Exposed Wards (Estimated)</span>
          <span className="metric-v">
            {currentScenario.affectedWardsApprox.length > 0
              ? `${currentScenario.affectedWardsApprox.length} Sectors At Risk`
              : "Within Embankments"}
          </span>
          <span className="metric-hint">
            {currentScenario.affectedWardsApprox.length > 0
              ? currentScenario.affectedWardsApprox.slice(0, 2).join(", ")
              : "No urban overflow"}
          </span>
        </div>
      </div>

      {/* Grounding & Ethics Disclaimer */}
      <div className="scenario-grounding-footer">
        <div className="grounding-text">
          <ShieldCheck className="shield-mini" />
          <span>Hydrological simulation based on historical rating curves of Prakasam Barrage. Values represent scenario projections, not live sensor readings.</span>
        </div>
        <button
          type="button"
          className="reset-preset-btn"
          onClick={() => selectPreset(PRESET_SCENARIOS[0])}
          title="Reset to baseline inflow"
        >
          <RotateCcw className="reset-mini" /> Reset Baseline
        </button>
      </div>
    </div>
  );
}
