import { Ruler, Trash2, Undo2, X, MapPin } from "lucide-react";
import type { MeasurementState } from "../../types/geo";
import { haversineDistance } from "../../utils/gisMath";

interface MeasurementPanelProps {
  state: MeasurementState;
  onClear: () => void;
  onUndo: () => void;
  onClose: () => void;
}

export function MeasurementPanel({ state, onClear, onUndo, onClose }: MeasurementPanelProps) {
  return (
    <div className="gis-floating-card measurement-panel" role="region" aria-label="Distance Measurement Tool">
      <div className="card-header-bar">
        <div className="title-block">
          <Ruler size={16} className="title-icon" />
          <span className="card-title">Geodesic Distance Measurement</span>
        </div>
        <button type="button" className="close-mini-btn" onClick={onClose} aria-label="Close Measurement Panel">
          <X size={14} />
        </button>
      </div>

      <div className="measurement-body">
        <div className="measurement-readout">
          <span className="readout-label">CUMULATIVE DISTANCE</span>
          <span className="readout-val tabular-num">{state.formatted}</span>
          <span className="readout-sub">
            {state.points.length === 0
              ? "Click anywhere on the map to place the first origin point."
              : state.points.length === 1
              ? "Click another location to calculate distance."
              : `${state.points.length} waypoints along WGS84 geodesic`}
          </span>
        </div>

        {state.points.length > 1 && (
          <div className="segments-list">
            <span className="segments-title">Segment Breakdown</span>
            {state.points.map((pt, idx) => {
              if (idx === 0) return null;
              const prev = state.points[idx - 1];
              const segDist = haversineDistance(prev, pt);
              const segFormatted =
                segDist >= 1000 ? `${(segDist / 1000).toFixed(2)} km` : `${Math.round(segDist)} m`;

              return (
                <div key={idx} className="segment-row">
                  <span className="segment-leg">
                    <MapPin size={11} /> Point {idx} → Point {idx + 1}
                  </span>
                  <span className="segment-val tabular-num">{segFormatted}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="measurement-actions">
          <button
            type="button"
            className="panel-action-btn"
            disabled={state.points.length === 0}
            onClick={onUndo}
            title="Remove last waypoint"
          >
            <Undo2 size={13} />
            <span>Undo Point</span>
          </button>
          <button
            type="button"
            className="panel-action-btn danger"
            disabled={state.points.length === 0}
            onClick={onClear}
            title="Clear all points"
          >
            <Trash2 size={13} />
            <span>Clear Route</span>
          </button>
        </div>
      </div>
    </div>
  );
}
