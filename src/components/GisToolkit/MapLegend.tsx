import { useState } from "react";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";
import type { LayerConfig } from "../../types/geo";

interface MapLegendProps {
  layers: LayerConfig[];
}

export function MapLegend({ layers }: MapLegendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="gis-map-legend" role="region" aria-label="Map Layer Legend">
      <button
        type="button"
        className="legend-header-toggle"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <div className="legend-title-group">
          <Layers size={14} className="legend-icon" />
          <span>MAP LEGEND</span>
        </div>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {isExpanded && (
        <div className="legend-body">
          <div className="legend-layers-list">
            {layers.map((l) => (
              <div key={l.id} className="legend-item">
                <span
                  className="legend-swatch"
                  style={{
                    backgroundColor: l.color,
                    borderColor: l.secondaryColor || l.color,
                  }}
                />
                <span className="legend-label">{l.label}</span>
                <span className="legend-count tabular-num">{l.count}</span>
              </div>
            ))}
          </div>

          <div className="legend-divider" />

          {/* Risk Level Swatches */}
          <div className="legend-risk-scale">
            <span className="risk-scale-title">Hazard Severity Index</span>
            <div className="risk-scale-row">
              <span className="scale-pill pill-critical">CRITICAL</span>
              <span className="scale-pill pill-high">HIGH</span>
              <span className="scale-pill pill-moderate">MODERATE</span>
              <span className="scale-pill pill-low">LOW</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
