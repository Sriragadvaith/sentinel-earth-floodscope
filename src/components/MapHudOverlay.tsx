import { type DataSourceStatus } from "../types/geo";

interface MapHudOverlayProps {
  cursorCoords: { lng: number; lat: number } | null;
  mapMetrics: {
    zoom: number;
    pitch: number;
    bearing: number;
  };
  status: DataSourceStatus;
  activeLayersCount: number;
  totalFeatures: number;
  inspectedFeature: string | null;
}

export function MapHudOverlay({
  cursorCoords,
  mapMetrics,
  status,
  activeLayersCount,
  totalFeatures,
  inspectedFeature,
}: MapHudOverlayProps) {
  const formatCoord = (val: number | undefined, posSuffix: string, negSuffix: string) => {
    if (val === undefined || isNaN(val)) return "---.----°";
    const abs = Math.abs(val).toFixed(4);
    const suffix = val >= 0 ? posSuffix : negSuffix;
    return `${abs}° ${suffix}`;
  };

  return (
    <div className="map-cockpit-hud" aria-label="Geospatial Telemetry HUD">
      {/* Top Left: Live Coordinate & Camera Metrics Readout */}
      <div className="hud-metric-chip telemetry-coordinates">
        <span className="hud-corner corner-tl" />
        <span className="hud-corner corner-br" />

        <div className="telemetry-row">
          <span className="telemetry-label">CURSOR</span>
          <span className="telemetry-value tabular-num">
            {cursorCoords
              ? `${formatCoord(cursorCoords.lat, "N", "S")}  ${formatCoord(cursorCoords.lng, "E", "W")}`
              : "HOVER VIEWPORT"}
          </span>
        </div>

        <div className="telemetry-subgrid">
          <div className="sub-metric">
            <span className="sub-label">ZOOM</span>
            <span className="sub-val tabular-num">{mapMetrics.zoom.toFixed(1)}</span>
          </div>
          <div className="sub-metric">
            <span className="sub-label">PITCH</span>
            <span className="sub-val tabular-num">{Math.round(mapMetrics.pitch)}°</span>
          </div>
          <div className="sub-metric">
            <span className="sub-label">HEADING</span>
            <span className="sub-val tabular-num">
              {((Math.round(mapMetrics.bearing) % 360 + 360) % 360)}°
            </span>
          </div>
        </div>
      </div>

      {/* Top Center: Selected / Inspected Feature Badge */}
      {inspectedFeature && (
        <div className="hud-inspected-card" role="status">
          <span className="inspected-lead">INSPECTED TARGET //</span>
          <span className="inspected-target-name">{inspectedFeature}</span>
        </div>
      )}

      {/* Top Right: Real Data Freshness & Layer Status Chips */}
      <div className="hud-metric-chip telemetry-freshness">
        <span className="hud-corner corner-tr" />
        <span className="hud-corner corner-bl" />

        <div className="telemetry-row">
          <span className="telemetry-label">FEED STATUS</span>
          <span className={`status-pill pill-${status.source}`}>
            <span className="pulse-dot" />
            {status.source === "live-overpass"
              ? "LIVE OSM MIRROR"
              : status.source === "loading"
              ? "SYNCING"
              : status.source === "error"
              ? "FEED OFFLINE"
              : "VERIFIED BASELINE"}
          </span>
        </div>

        <div className="telemetry-subgrid">
          <div className="sub-metric">
            <span className="sub-label">TIMESTAMP</span>
            <span className="sub-val tabular-num">{status.timestamp || "Active"}</span>
          </div>
          <div className="sub-metric">
            <span className="sub-label">LAYERS</span>
            <span className="sub-val tabular-num">{activeLayersCount} Active</span>
          </div>
          <div className="sub-metric">
            <span className="sub-label">VECTORS</span>
            <span className="sub-val tabular-num">{totalFeatures}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
