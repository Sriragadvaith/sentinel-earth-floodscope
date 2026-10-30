import type { LayerConfig, DataSourceStatus } from "../types/geo";
import {
  LayersIcon,
  RefreshIcon,
  CrosshairIcon,
  WaterIcon,
  RoadIcon,
  HospitalIcon,
  FloodZoneIcon,
  AlertCircleIcon,
} from "./Icons";

interface SidebarProps {
  layers: LayerConfig[];
  onToggleLayer: (id: LayerConfig["id"]) => void;
  onResetView: () => void;
  onFlyToLocation: (center: [number, number], zoom: number) => void;
  onRefreshData: () => void;
  status: DataSourceStatus;
  isLoading: boolean;
  totalFeatures: number;
}

const QUICK_TARGETS = [
  { name: "Prakasam Barrage", coords: [80.6432, 16.5042] as [number, number], zoom: 14 },
  { name: "Kanaka Durga Varadhi", coords: [80.6480, 16.4980] as [number, number], zoom: 14.2 },
  { name: "New GGH Hospital", coords: [80.6748, 16.5165] as [number, number], zoom: 15 },
  { name: "Krishna Lanka Embankment", coords: [80.6650, 16.4950] as [number, number], zoom: 14.5 },
  { name: "Benz Circle Transit Hub", coords: [80.6620, 16.5080] as [number, number], zoom: 14.8 },
];

export function Sidebar({
  layers,
  onToggleLayer,
  onResetView,
  onFlyToLocation,
  onRefreshData,
  status,
  isLoading,
  totalFeatures,
}: SidebarProps) {
  const getLayerIcon = (id: string) => {
    switch (id) {
      case "river":
        return <WaterIcon style={{ color: "#38bdf8" }} />;
      case "roads":
        return <RoadIcon style={{ color: "#fbbf24" }} />;
      case "hospitals":
        return <HospitalIcon style={{ color: "#f43f5e" }} />;
      case "floodZones":
        return <FloodZoneIcon style={{ color: "#a855f7" }} />;
      default:
        return <LayersIcon />;
    }
  };

  return (
    <aside className="command-sidebar">
      <div className="sidebar-section">
        <div className="section-header">
          <LayersIcon className="section-icon" />
          <h2 className="section-title">Geospatial Layers</h2>
        </div>
        <p className="section-description">
          Toggle real-time vector infrastructure, waterways, and critical facilities.
        </p>

        <div className="layer-stack">
          {layers.map((layer) => (
            <label
              key={layer.id}
              className={`layer-item ${layer.visible ? "layer-active" : "layer-muted"}`}
            >
              <div className="layer-item-lead">
                <span className="layer-glyph">{getLayerIcon(layer.id)}</span>
                <div className="layer-item-info">
                  <div className="layer-item-title-row">
                    <span className="layer-label-text">{layer.label}</span>
                    <span className="layer-count-badge" title="Active features in dataset">
                      {layer.count}
                    </span>
                  </div>
                  <span className="layer-geom-types">
                    {layer.geometryTypes.join(" · ")}
                  </span>
                </div>
              </div>

              <input
                type="checkbox"
                className="layer-checkbox"
                checked={layer.visible}
                onChange={() => onToggleLayer(layer.id)}
                aria-label={`Toggle ${layer.label}`}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <CrosshairIcon className="section-icon" />
          <h2 className="section-title">Tactical Sectors</h2>
        </div>
        <p className="section-description">
          Quickly focus camera on high-vulnerability riverfronts & logistics centers.
        </p>

        <div className="targets-grid">
          {QUICK_TARGETS.map((target) => (
            <button
              key={target.name}
              type="button"
              className="target-button"
              onClick={() => onFlyToLocation(target.coords, target.zoom)}
            >
              <span className="target-name">{target.name}</span>
              <span className="target-arrow">→</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <AlertCircleIcon className="section-icon" />
          <h2 className="section-title">Data Source & Health</h2>
        </div>

        <div className="status-card">
          <div className="status-row">
            <span className="status-row-key">Mode:</span>
            <span className={`status-row-val ${status.source === "live-overpass" ? "val-live" : "val-baseline"}`}>
              {status.source === "live-overpass" ? "Live OpenStreetMap" : "Verified Baseline"}
            </span>
          </div>

          <div className="status-row">
            <span className="status-row-key">Total Features:</span>
            <span className="status-row-val">{totalFeatures}</span>
          </div>

          <div className="status-row">
            <span className="status-row-key">Last Sync:</span>
            <span className="status-row-val">{status.timestamp}</span>
          </div>

          <p className="status-detail-text">{status.message}</p>

          <div className="sidebar-actions">
            <button
              type="button"
              className="action-button action-refresh"
              onClick={onRefreshData}
              disabled={isLoading}
              title="Query OpenStreetMap Overpass mirrors"
            >
              <RefreshIcon className={isLoading ? "spin-icon" : ""} />
              {isLoading ? "Syncing..." : "Sync OSM Overpass"}
            </button>

            <button
              type="button"
              className="action-button action-reset"
              onClick={onResetView}
              title="Reset view to Vijayawada overview"
            >
              Reset View
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
