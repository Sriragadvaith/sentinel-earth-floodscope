import {
  Search,
  Crosshair,
  Ruler,
  Hexagon,
  Radio,
  Navigation,
  Clock,
  Bot,
  RotateCcw,
} from "lucide-react";
import type { GisToolMode } from "../../types/geo";

interface GisToolbarProps {
  activeMode: GisToolMode;
  onSelectMode: (mode: GisToolMode) => void;
  onResetTools: () => void;
  hasActiveMeasurements: boolean;
  hasActiveRoute: boolean;
  hasActiveBuffer: boolean;
}

export function GisToolbar({
  activeMode,
  onSelectMode,
  onResetTools,
  hasActiveMeasurements,
  hasActiveRoute,
  hasActiveBuffer,
}: GisToolbarProps) {
  const tools: Array<{
    id: GisToolMode;
    label: string;
    icon: typeof Search;
    shortcut: string;
    indicator?: boolean;
  }> = [
    { id: "search", label: "Spatial Search", icon: Search, shortcut: "S" },
    { id: "inspect", label: "Feature & Elevation Inspector", icon: Crosshair, shortcut: "I" },
    {
      id: "measure",
      label: "Geodesic Distance Measurement",
      icon: Ruler,
      shortcut: "M",
      indicator: hasActiveMeasurements,
    },
    { id: "polygonArea", label: "Polygon Area Calculation", icon: Hexagon, shortcut: "A" },
    {
      id: "buffer",
      label: "Hazard Buffer Analysis",
      icon: Radio,
      shortcut: "B",
      indicator: hasActiveBuffer,
    },
    {
      id: "route",
      label: "Hazard-Aware Disaster Routing",
      icon: Navigation,
      shortcut: "R",
      indicator: hasActiveRoute,
    },
    { id: "temporal", label: "River Gauge & Flood Timeline", icon: Clock, shortcut: "T" },
    { id: "copilot", label: "AI Spatial Map Copilot", icon: Bot, shortcut: "C" },
  ];

  return (
    <div className="gis-floating-toolbar" role="toolbar" aria-label="Advanced GIS Toolkit">
      <div className="gis-toolbar-label">
        <span className="toolbar-pulse-dot" />
        <span className="toolbar-title">GIS TOOLS</span>
      </div>

      <div className="gis-toolbar-btn-group">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeMode === t.id;

          return (
            <button
              key={t.id}
              type="button"
              className={`gis-tool-btn ${isActive ? "active" : ""}`}
              onClick={() => onSelectMode(isActive ? "none" : t.id)}
              title={`${t.label} (Press ${t.shortcut})`}
              aria-pressed={isActive}
            >
              <Icon size={16} className="tool-icon" />
              <span className="tool-name">{t.label}</span>
              {t.indicator && <span className="active-dot" />}
              <kbd className="tool-kbd">{t.shortcut}</kbd>
            </button>
          );
        })}

        {(hasActiveMeasurements || hasActiveRoute || hasActiveBuffer || activeMode !== "none") && (
          <button
            type="button"
            className="gis-tool-btn btn-reset"
            onClick={onResetTools}
            title="Clear all active measurements, buffers, and routes"
          >
            <RotateCcw size={14} />
            <span className="tool-name">Clear Tools</span>
          </button>
        )}
      </div>
    </div>
  );
}
