import {
  Navigation,
  X,
  MapPin,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { RouteState } from "../../types/geo";

interface DisasterRoutingPanelProps {
  state: RouteState;
  onPickOriginOnMap: () => void;
  onPickDestinationOnMap: () => void;
  onSwapPoints: () => void;
  onCalculateRoute: () => void;
  onClearRoute: () => void;
  onClose: () => void;
}

export function DisasterRoutingPanel({
  state,
  onPickOriginOnMap,
  onPickDestinationOnMap,
  onSwapPoints,
  onCalculateRoute,
  onClearRoute,
  onClose,
}: DisasterRoutingPanelProps) {
  const distKm = state.distanceMeters ? (state.distanceMeters / 1000).toFixed(2) : null;
  const durationMin = state.durationSeconds ? Math.round(state.durationSeconds / 60) : null;

  return (
    <div className="gis-floating-card routing-panel" role="region" aria-label="Disaster Evacuation Routing">
      <div className="card-header-bar">
        <div className="title-block">
          <Navigation size={16} className="title-icon" />
          <span className="card-title">Hazard-Aware Disaster Routing</span>
        </div>
        <button type="button" className="close-mini-btn" onClick={onClose} aria-label="Close Routing Panel">
          <X size={14} />
        </button>
      </div>

      <div className="routing-body">
        {/* Origin / Destination Selectors */}
        <div className="routing-points-block">
          <div className="point-selector origin-selector">
            <span className="point-badge origin-badge">A</span>
            <div className="point-details">
              <span className="point-label">ORIGIN / INCIDENT</span>
              <span className="point-text">
                {state.origin
                  ? state.originName || `${state.origin[1].toFixed(4)}°N, ${state.origin[0].toFixed(4)}°E`
                  : "Click 'Set Origin' or click on map"}
              </span>
            </div>
            <button
              type="button"
              className="set-point-btn"
              onClick={onPickOriginOnMap}
              title="Pick origin on map"
            >
              <MapPin size={13} />
              <span>Pick</span>
            </button>
          </div>

          <div className="swap-row">
            <button
              type="button"
              className="swap-btn"
              onClick={onSwapPoints}
              title="Swap origin and destination"
              disabled={!state.origin && !state.destination}
            >
              <ArrowUpDown size={14} />
            </button>
          </div>

          <div className="point-selector dest-selector">
            <span className="point-badge dest-badge">B</span>
            <div className="point-details">
              <span className="point-label">DESTINATION FACILITY / SHELTER</span>
              <span className="point-text">
                {state.destination
                  ? state.destinationName || `${state.destination[1].toFixed(4)}°N, ${state.destination[0].toFixed(4)}°E`
                  : "Click 'Set Destination' or select facility"}
              </span>
            </div>
            <button
              type="button"
              className="set-point-btn"
              onClick={onPickDestinationOnMap}
              title="Pick destination on map"
            >
              <MapPin size={13} />
              <span>Pick</span>
            </button>
          </div>
        </div>

        {/* Calculate Action */}
        <button
          type="button"
          className="calculate-route-btn"
          disabled={!state.origin || !state.destination || state.isLoading}
          onClick={onCalculateRoute}
        >
          {state.isLoading ? (
            <>
              <Loader2 size={16} className="spin-icon" />
              <span>Analyzing Road Viability & Hazard Overlays…</span>
            </>
          ) : (
            <>
              <Navigation size={16} />
              <span>Calculate Evacuation Route</span>
            </>
          )}
        </button>

        {/* Error notification */}
        {state.error && (
          <div className="route-error-banner">
            <AlertTriangle size={15} />
            <span>{state.error}</span>
          </div>
        )}

        {/* Route Metrics Readout */}
        {state.coordinates && distKm && (
          <div className="route-results-container">
            <div className="route-metrics-row">
              <div className="metric-cell">
                <span className="m-label">ESTIMATED TRANSIT DISTANCE</span>
                <span className="m-val tabular-num">{distKm} km</span>
              </div>
              <div className="metric-cell">
                <span className="m-label">
                  <Clock size={12} /> ESTIMATED TRAVEL TIME
                </span>
                <span className="m-val tabular-num">{durationMin} min</span>
              </div>
            </div>

            {/* Hazard Intersect Conflict Status */}
            {state.hasConflict ? (
              <div className="hazard-warning-box">
                <div className="warning-header">
                  <ShieldAlert size={16} className="danger-icon" />
                  <strong>HAZARD CONFLICT DETECTED ALONG ROUTE</strong>
                </div>
                <p>
                  This trajectory passes through or within proximity of active flood inundation zones.
                  Extreme caution is advised:
                </p>
                <div className="conflicts-tags-list">
                  {state.conflicts?.map((c, i) => (
                    <div key={i} className="conflict-tag-item">
                      <span className="c-name">{c.hazardName}</span>
                      <span className="c-risk">({c.riskLevel} RISK · {c.distanceMeters}m from road)</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="hazard-clear-box">
                <CheckCircle2 size={16} className="success-icon" />
                <span>Route is currently clear of mapped high-risk flood polygons.</span>
              </div>
            )}

            <div className="provider-meta">
              <span>Routing Provider: {state.provider || "OSRM OpenStreetMap Driving Engine"}</span>
              <span>•</span>
              <span>Status: {state.timestamp ? "Verified" : "Live Analysis"}</span>
            </div>

            <button type="button" className="panel-action-btn danger" onClick={onClearRoute}>
              Clear Route Overlay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
