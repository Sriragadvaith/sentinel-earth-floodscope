import { Radio, X, Sliders, AlertTriangle, HeartPulse, Home, Navigation, MapPin } from "lucide-react";
import type { BufferAnalysisState, AppGeoFeature } from "../../types/geo";

interface BufferAnalysisPanelProps {
  state: BufferAnalysisState;
  onChangeRadius: (radiusMeters: number) => void;
  onClear: () => void;
  onClose: () => void;
  onSelectFeature: (f: AppGeoFeature) => void;
}

export function BufferAnalysisPanel({
  state,
  onChangeRadius,
  onClear,
  onClose,
  onSelectFeature,
}: BufferAnalysisPanelProps) {
  const radiusKm = (state.radiusMeters / 1000).toFixed(2);
  const areaSqKm = (Math.PI * Math.pow(state.radiusMeters / 1000, 2)).toFixed(2);

  const presets = [250, 500, 1000, 2000, 3000, 5000];

  return (
    <div className="gis-floating-card buffer-panel" role="region" aria-label="Hazard Buffer Analysis">
      <div className="card-header-bar">
        <div className="title-block">
          <Radio size={16} className="title-icon" />
          <span className="card-title">Hazard Buffer Proximity Engine</span>
        </div>
        <button type="button" className="close-mini-btn" onClick={onClose} aria-label="Close Buffer Tool">
          <X size={14} />
        </button>
      </div>

      <div className="buffer-body">
        {/* Center Coordinate Status */}
        <div className="center-status-row">
          <MapPin size={14} className="pin-icon" />
          <div className="center-info">
            <span className="center-label">BUFFER ORIGIN</span>
            <span className="center-coords tabular-num">
              {state.center
                ? `${state.center[1].toFixed(5)}°N, ${state.center[0].toFixed(5)}°E`
                : "Click map to set buffer epicenter"}
            </span>
          </div>
        </div>

        {/* Radius Controller */}
        <div className="radius-control-block">
          <div className="radius-label-row">
            <span className="radius-label">
              <Sliders size={13} /> BUFFER RADIUS
            </span>
            <span className="radius-val tabular-num">
              {state.radiusMeters >= 1000 ? `${radiusKm} km` : `${state.radiusMeters} m`} ({areaSqKm} km²)
            </span>
          </div>

          <div className="radius-chips-row">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className={`radius-chip ${state.radiusMeters === p ? "active" : ""}`}
                onClick={() => onChangeRadius(p)}
              >
                {p >= 1000 ? `${p / 1000}km` : `${p}m`}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={100}
            max={5000}
            step={50}
            value={state.radiusMeters}
            onChange={(e) => onChangeRadius(Number(e.target.value))}
            className="radius-slider"
          />
        </div>

        {/* Enclosed Assets Summary */}
        <div className="enclosed-summary-grid">
          <div className="summary-card hazard-card">
            <AlertTriangle size={15} />
            <div className="summary-data">
              <span className="summary-val tabular-num">{state.criticalHazardsCount}</span>
              <span className="summary-title">Hazards Enclosed</span>
            </div>
          </div>

          <div className="summary-card facility-card">
            <HeartPulse size={15} />
            <div className="summary-data">
              <span className="summary-val tabular-num">{state.facilitiesCount}</span>
              <span className="summary-title">Facilities Found</span>
            </div>
          </div>
        </div>

        {/* Intersecting Assets List */}
        {state.intersectingFeatures.length > 0 && (
          <div className="intersecting-list-block">
            <span className="list-title">Enclosed Infrastructure & Zones ({state.intersectingFeatures.length})</span>
            <div className="intersecting-scroll">
              {state.intersectingFeatures.map((f, i) => {
                const p = f.properties;
                const Icon =
                  p.category === "hospitals"
                    ? HeartPulse
                    : p.category === "shelters"
                    ? Home
                    : p.category === "floodZones"
                    ? AlertTriangle
                    : Navigation;

                return (
                  <div
                    key={p.id || i}
                    className="intersecting-item"
                    onClick={() => onSelectFeature(f)}
                    title="Inspect feature"
                  >
                    <Icon size={13} className={`cat-icon cat-${p.category}`} />
                    <span className="item-name">{p.name || p.type}</span>
                    {p.riskLevel && (
                      <span className={`item-risk risk-${p.riskLevel}`}>
                        {p.riskLevel.toUpperCase()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="buffer-actions">
          <button
            type="button"
            className="panel-action-btn danger"
            disabled={!state.center}
            onClick={onClear}
          >
            Clear Buffer
          </button>
        </div>
      </div>
    </div>
  );
}
