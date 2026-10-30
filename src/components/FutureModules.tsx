interface FutureModuleProps {
  module: "rainfall" | "terrain" | "exposure" | "nemotron";
  onReturnToMap: () => void;
}

export function FutureModuleView({ module, onReturnToMap }: FutureModuleProps) {
  const content = {
    rainfall: {
      title: "Module 2: Rainfall Scenario & Catchment Inflow Modeling",
      description:
        "Hydrological simulation engine designed to ingest IMD precipitation grids and Krishna basin upstream reservoir discharge data (Srisailam & Nagarjuna Sagar releases towards Prakasam Barrage).",
      specs: [
        { label: "Scenario Presets", val: "Historical 2009 Flood (1.1M cusecs), 2024 Cyclone Inundation, 100-Year Cloudburst" },
        { label: "Upstream Discharge Rate", val: "Configurable cusecs gauge input at Prakasam Barrage" },
        { label: "Precipitation Resolution", val: "0.25° IMD Gridded Rainfall Matrix" },
        { label: "Status", val: "Pipeline architecture staged; waiting for hydrological integration" },
      ],
    },
    terrain: {
      title: "Module 3: Terrain-Based Elevation & Flow Accumulation Risk",
      description:
        "Copernicus DEM (30m) & SRTM digital elevation modeling of Vijayawada topography, identifying low-lying micro-catchments, Budameru diversion basins, and natural drainage depressions.",
      specs: [
        { label: "Elevation Source", val: "Copernicus GLO-30 Digital Elevation Model" },
        { label: "Hydrological Indices", val: "Topographic Wetness Index (TWI) & Slope Gradient" },
        { label: "Drainage Channels", val: "Budameru Rivulet, Ryves, Eluru, and Bandar Canal networks" },
        { label: "Status", val: "DEM ingestion pipeline defined for subsequent module release" },
      ],
    },
    exposure: {
      title: "Module 4: Critical Infrastructure Exposure & Evacuation Analysis",
      description:
        "Intersection analysis between estimated flood water contours and critical urban infrastructure, calculating facility access risk, road cut-off probabilities, and vulnerable population density.",
      specs: [
        { label: "Target Sectors", val: "Hospitals, Electrical Sub-stations, Evacuation Transit Hubs (PNBS)" },
        { label: "Vulnerability Index", val: "Proximity to Krishna riverbank and embankment elevation differential" },
        { label: "Routing Engine", val: "Safe-passage graph routing avoiding inundated arterial links" },
        { label: "Status", val: "Graph topology staged; exposure matrix ready for risk overlay" },
      ],
    },
    nemotron: {
      title: "Module 5: NVIDIA Nemotron-Powered Emergency Operations Assistant",
      description:
        "Synthesizing live geospatial telemetry, water level alerts, and infrastructure vulnerability through NVIDIA Nemotron models hosted on Nebius Token Factory for incident command teams.",
      specs: [
        { label: "Inference Engine", val: "NVIDIA Nemotron LLM via Nebius Token Factory OpenAI-compatible API" },
        { label: "Operational Role", val: "Emergency resource allocation briefings, evacuation priority synthesis" },
        { label: "Security & Guardrails", val: "No fabricated claims; strict boundary grounding in verified telemetry" },
        { label: "Status", val: "API client abstraction ready for deployment in separate backend service" },
      ],
    },
  }[module];

  return (
    <div className="future-module-card">
      <div className="module-header-row">
        <h2>{content.title}</h2>
        <button type="button" className="action-button action-reset" onClick={onReturnToMap}>
          Back to Live Map
        </button>
      </div>

      <p className="module-desc">{content.description}</p>

      <div className="specs-list">
        {content.specs.map((s) => (
          <div key={s.label} className="spec-item">
            <span className="spec-label">{s.label}:</span>
            <span className="spec-val">{s.val}</span>
          </div>
        ))}
      </div>

      <div className="module-notice-banner">
        <strong>ARCHITECTURAL NOTE:</strong> In adherence to hackathon safety and verification guidelines, Sentinel Earth FloodScope does not synthesize fake real-time warnings or fabricated stream gauges. This module will integrate with calibrated hydrological data in the subsequent backend sprint.
      </div>
    </div>
  );
}
