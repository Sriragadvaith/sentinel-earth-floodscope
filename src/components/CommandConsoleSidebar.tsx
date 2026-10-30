import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Layers,
  MapPin,
  Sliders,
  ChevronRight,
  Droplet,
  Navigation,
  HeartPulse,
  AlertTriangle,
  Search,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Tent,
  Flame,
  Gauge,
  CloudRain,
} from "lucide-react";
import { GlassTooltip } from "./GlassTooltip";
import type { LayerConfig, LayerCategory, DataSourceStatus } from "../types/geo";
import { VIJAYAWADA_TACTICAL_SECTORS, type TacticalSector } from "../types/sector";
import type { FloodScenario } from "../types/scenario";
import { PRESET_SCENARIOS } from "../types/scenario";

interface CommandConsoleSidebarProps {
  layers: LayerConfig[];
  onToggleLayer: (layerId: LayerCategory) => void;
  onSetAllLayers: (visible: boolean) => void;
  onResetView: () => void;
  onFlyToLocation: (center: [number, number], zoom: number) => void;
  onRefreshData: () => void;
  status: DataSourceStatus;
  isLoading: boolean;
  totalFeatures: number;
  currentScenario: FloodScenario;
  onScenarioChange: (scenario: FloodScenario) => void;
  activeSectorId: string | null;
  onSelectSector: (sector: TacticalSector | null) => void;
}

const STORAGE_KEY = "sentinel_console_menu_v1";

export function CommandConsoleSidebar({
  layers,
  onToggleLayer,
  onSetAllLayers,
  onResetView,
  onFlyToLocation,
  onRefreshData,
  status,
  isLoading,
  totalFeatures,
  currentScenario,
  onScenarioChange,
  activeSectorId,
  onSelectSector,
}: CommandConsoleSidebarProps) {
  // Read menu state from localStorage
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).isExpanded ?? true;
    } catch {
      // fallback
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<"layers" | "sectors" | "scenario">(() => {
    if (typeof window === "undefined") return "layers";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).activeTab || "layers";
    } catch {
      // fallback
    }
    return "layers";
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isExpanded, activeTab }));
    } catch {
      // ignore
    }
  }, [isExpanded, activeTab]);

  // Synchronize dynamic --sidebar-w CSS variable
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-w", isExpanded ? "350px" : "68px");
    }
  }, [isExpanded]);

  // Sector filter & sort state
  const [sectorSearch, setSectorSearch] = useState("");
  const [sectorSort, setSectorSort] = useState<"code" | "area" | "features">("code");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [soloLayerId, setSoloLayerId] = useState<string | null>(null);

  // Layer Opacities
  const [layerOpacities, setLayerOpacities] = useState<Record<string, number>>({
    river: 100,
    roads: 100,
    hospitals: 100,
    floodZones: 80,
    shelters: 100,
    emergencyServices: 100,
    riverGauges: 100,
    rainfallStations: 100,
  });

  // Active layers count
  const activeCount = layers.filter((l) => l.visible).length;

  const getLayerIcon = (id: LayerCategory) => {
    switch (id) {
      case "river":
        return Droplet;
      case "roads":
        return Navigation;
      case "hospitals":
        return HeartPulse;
      case "floodZones":
        return AlertTriangle;
      case "shelters":
        return Tent;
      case "emergencyServices":
        return Flame;
      case "riverGauges":
        return Gauge;
      case "rainfallStations":
        return CloudRain;
      default:
        return Layers;
    }
  };

  // Solo layer logic
  const handleSoloLayer = (layerId: LayerCategory) => {
    if (soloLayerId === layerId) {
      // Un-solo
      setSoloLayerId(null);
      onSetAllLayers(true);
    } else {
      setSoloLayerId(layerId);
      for (const lyr of layers) {
        if (lyr.id === layerId) {
          if (!lyr.visible) onToggleLayer(lyr.id);
        } else {
          if (lyr.visible) onToggleLayer(lyr.id);
        }
      }
    }
  };

  // Filtered & sorted sectors
  const filteredSectors = useMemo(() => {
    const q = sectorSearch.toLowerCase().trim();
    let result = VIJAYAWADA_TACTICAL_SECTORS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );

    if (sectorSort === "area") {
      result = [...result].sort((a, b) => b.areaKm2 - a.areaKm2);
    } else if (sectorSort === "features") {
      result = [...result].sort(
        (a, b) => b.hospitalsCount + b.arterialsCount - (a.hospitalsCount + a.arterialsCount)
      );
    } else {
      result = [...result].sort((a, b) => a.code.localeCompare(b.code));
    }
    return result;
  }, [sectorSearch, sectorSort]);

  return (
    <aside
      className={`command-console-rail glass-surface--sidebar ${isExpanded ? "rail-expanded" : "rail-collapsed"}`}
      aria-label="Geospatial Command Console"
      onTransitionEnd={(e) => {
        if (e.propertyName === "width") {
          window.dispatchEvent(new Event("sidebar-resized"));
        }
      }}
    >
      {/* Rail Left Sticky Icon Strip (Always visible) */}
      <div className="rail-icon-strip">
        <GlassTooltip text={isExpanded ? "Collapse Command Rail" : "Expand Command Rail"} position="right">
          <button
            type="button"
            className="rail-toggle-btn glass-icon-btn"
            onClick={() => setIsExpanded((prev: boolean) => !prev)}
            aria-label={isExpanded ? "Collapse Command Rail" : "Expand Command Rail"}
            aria-expanded={isExpanded}
          >
            <ChevronRight size={18} strokeWidth={1.75} className={`expand-chevron ${isExpanded ? "rotated" : ""}`} />
          </button>
        </GlassTooltip>

        <div className="rail-nav-icons" role="tablist">
          <GlassTooltip text="Geospatial Vector Layers" position="right">
            <button
              type="button"
              role="tab"
              aria-selected={isExpanded && activeTab === "layers"}
              aria-current={isExpanded && activeTab === "layers" ? "page" : undefined}
              className={`rail-icon-btn glass-icon-btn has-indicator ${activeTab === "layers" ? "active is-active" : ""}`}
              onClick={() => {
                setActiveTab("layers");
                if (!isExpanded) setIsExpanded(true);
              }}
              aria-label="Geospatial Vector Layers"
            >
              <Layers size={19} strokeWidth={1.75} />
              <span className="rail-mini-badge">{activeCount}</span>
            </button>
          </GlassTooltip>

          <GlassTooltip text="Tactical Sectors" position="right">
            <button
              type="button"
              role="tab"
              aria-selected={isExpanded && activeTab === "sectors"}
              aria-current={isExpanded && activeTab === "sectors" ? "page" : undefined}
              className={`rail-icon-btn glass-icon-btn has-indicator ${activeTab === "sectors" ? "active is-active" : ""}`}
              onClick={() => {
                setActiveTab("sectors");
                if (!isExpanded) setIsExpanded(true);
              }}
              aria-label="Tactical Sectors"
            >
              <MapPin size={19} strokeWidth={1.75} />
              <span className="rail-mini-badge">6</span>
            </button>
          </GlassTooltip>

          <GlassTooltip text="Hydrological Scenario Engine" position="right">
            <button
              type="button"
              role="tab"
              aria-selected={isExpanded && activeTab === "scenario"}
              aria-current={isExpanded && activeTab === "scenario" ? "page" : undefined}
              className={`rail-icon-btn glass-icon-btn has-indicator ${activeTab === "scenario" ? "active is-active" : ""}`}
              onClick={() => {
                setActiveTab("scenario");
                if (!isExpanded) setIsExpanded(true);
              }}
              aria-label="Hydrological Scenario Engine"
            >
              <Sliders size={19} strokeWidth={1.75} />
            </button>
          </GlassTooltip>
        </div>
      </div>

      {/* Expanded Console Glass Drawer (Section 8G) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="rail-drawer-content"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
          {/* Top Tab Strip with Sliding Silver Underline */}
          <div className="console-tab-strip" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "layers"}
              className={`console-tab-btn ${activeTab === "layers" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("layers")}
            >
              <span className="tab-idx-mono">01</span>
              <span>LAYERS</span>
              {activeTab === "layers" && <span className="tab-marigold-dot" />}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "sectors"}
              className={`console-tab-btn ${activeTab === "sectors" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("sectors")}
            >
              <span className="tab-idx-mono">02</span>
              <span>SECTORS</span>
              {activeTab === "sectors" && <span className="tab-marigold-dot" />}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "scenario"}
              className={`console-tab-btn ${activeTab === "scenario" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("scenario")}
            >
              <span className="tab-idx-mono">03</span>
              <span>SCENARIO</span>
              {activeTab === "scenario" && <span className="tab-marigold-dot" />}
            </button>
          </div>

          <div className="console-panel-body">
            {/* MODULE 01: GEOSPATIAL LAYERS */}
            {activeTab === "layers" && (
              <div className="console-module-view">
                <div className="module-instrument-header">
                  <div className="instrument-title-row">
                    <span className="instrument-idx">01 //</span>
                    <h3 className="instrument-title">GEOSPATIAL LAYERS</h3>
                  </div>
                  <span className="instrument-readout tabular-num">
                    {activeCount} / {layers.length} ACTIVE
                  </span>
                </div>

                <div className="group-level-actions">
                  <button
                    type="button"
                    className="group-action-pill"
                    onClick={() => onSetAllLayers(true)}
                  >
                    All On
                  </button>
                  <button
                    type="button"
                    className="group-action-pill"
                    onClick={() => onSetAllLayers(false)}
                  >
                    All Off
                  </button>
                  <button
                    type="button"
                    className="group-action-pill"
                    onClick={() => {
                      setSoloLayerId(null);
                      onSetAllLayers(true);
                    }}
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="console-layers-list">
                  {layers.map((lyr) => {
                    const Icon = getLayerIcon(lyr.id);
                    const isExpandedRow = expandedRow === lyr.id;
                    const isSolo = soloLayerId === lyr.id;

                    return (
                      <div
                        key={lyr.id}
                        className={`console-layer-card ${lyr.visible ? "active-layer" : "inactive-layer"}`}
                      >
                        <div className="layer-primary-row">
                          <div className="layer-swatch-badge" style={{ backgroundColor: lyr.color }} />
                          <div className="layer-info-block">
                            <div className="layer-title-line">
                              <Icon size={14} className="layer-icon-tiny" />
                              <span className="layer-name-label">{lyr.label}</span>
                            </div>
                            <span className="layer-meta-line tabular-num">
                              {lyr.count} features · {lyr.geometryTypes.join(", ")}
                            </span>
                          </div>

                          <div className="layer-card-actions">
                            <button
                              type="button"
                              className={`action-btn-expand ${isExpandedRow ? "expanded" : ""}`}
                              onClick={() => setExpandedRow(isExpandedRow ? null : lyr.id)}
                              title="Layer adjustments (opacity & solo)"
                            >
                              <SlidersHorizontal size={13} />
                            </button>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={lyr.visible}
                              className={`sentinel-switch ${lyr.visible ? "switch-on" : "switch-off"}`}
                              onClick={() => onToggleLayer(lyr.id)}
                            >
                              <span className="switch-thumb" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Opacity & Solo Strip */}
                        {isExpandedRow && (
                          <div className="layer-expansion-strip">
                            <div className="opacity-control-row">
                              <span className="opacity-label">OPACITY</span>
                              <input
                                type="range"
                                min="10"
                                max="100"
                                value={layerOpacities[lyr.id] ?? 100}
                                onChange={(e) =>
                                  setLayerOpacities((prev) => ({
                                    ...prev,
                                    [lyr.id]: parseInt(e.target.value, 10),
                                  }))
                                }
                                className="layer-opacity-slider"
                              />
                              <span className="opacity-val tabular-num">
                                {layerOpacities[lyr.id] ?? 100}%
                              </span>
                            </div>

                            <button
                              type="button"
                              className={`solo-pill-btn ${isSolo ? "solo-active" : ""}`}
                              onClick={() => handleSoloLayer(lyr.id)}
                            >
                              {isSolo ? <EyeOff size={12} /> : <Eye size={12} />}
                              <span>{isSolo ? "Solo Active (Click to Show All)" : "Solo Layer"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="layer-feed-status-card">
                  <div className="feed-status-header">
                    <span className="feed-title">DATA FEED STATUS</span>
                    <button
                      type="button"
                      className="feed-refresh-btn"
                      onClick={onRefreshData}
                      disabled={isLoading}
                      title="Resync vector layers"
                    >
                      <RefreshCw size={12} className={isLoading ? "spinning" : ""} />
                    </button>
                  </div>
                  <p className="feed-meta-desc">{status.message}</p>
                  <span className="feed-time-readout tabular-num">
                    {totalFeatures} Verified Features · Synced: {status.timestamp}
                  </span>
                </div>
              </div>
            )}

            {/* MODULE 02: TACTICAL SECTORS */}
            {activeTab === "sectors" && (
              <div className="console-module-view">
                <div className="module-instrument-header">
                  <div className="instrument-title-row">
                    <span className="instrument-idx">02 //</span>
                    <h3 className="instrument-title">TACTICAL SECTORS</h3>
                  </div>
                  <span className="instrument-readout tabular-num">
                    {filteredSectors.length} SUBDIVISIONS
                  </span>
                </div>

                {/* Filter and Sort Row */}
                <div className="sector-toolbar">
                  <div className="sector-search-box">
                    <Search size={13} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Filter sector name or code..."
                      value={sectorSearch}
                      onChange={(e) => setSectorSearch(e.target.value)}
                      className="sector-search-input"
                    />
                  </div>

                  <select
                    className="sector-sort-select"
                    value={sectorSort}
                    onChange={(e) => setSectorSort(e.target.value as "code" | "area" | "features")}
                    aria-label="Sort sectors"
                  >
                    <option value="code">Code (S-01 to S-06)</option>
                    <option value="area">Area (km²)</option>
                    <option value="features">Feature Count</option>
                  </select>
                </div>

                {activeSectorId && (
                  <div className="active-sector-reticle-bar">
                    <span>SECTOR LOCKED</span>
                    <button
                      type="button"
                      className="clear-sector-btn"
                      onClick={() => {
                        onSelectSector(null);
                        onResetView();
                      }}
                    >
                      Clear Sector
                    </button>
                  </div>
                )}

                <div className="sectors-cards-list">
                  {filteredSectors.map((sector) => {
                    const isSelected = activeSectorId === sector.id;

                    return (
                      <div
                        key={sector.id}
                        className={`sector-card ${isSelected ? "sector-active-card control-pulse-active" : ""}`}
                        onClick={() => {
                          onSelectSector(sector);
                          onFlyToLocation(sector.centroid, sector.zoom);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            onSelectSector(sector);
                            onFlyToLocation(sector.centroid, sector.zoom);
                          }
                        }}
                      >
                        <div className="sector-card-top">
                          <span className="sector-code-badge">{sector.code}</span>
                          <span className="sector-category-tag">{sector.category}</span>
                        </div>

                        <div className="sector-card-body">
                          <div className="sector-outline-box">
                            <svg viewBox="0 0 40 40" className="sector-mini-svg">
                              <path
                                d={sector.svgThumbnailPath}
                                fill={isSelected ? "rgba(242, 183, 53, 0.2)" : "rgba(198, 200, 208, 0.1)"}
                                stroke={isSelected ? "#F2B735" : "#C6C8D0"}
                                strokeWidth="1.5"
                              />
                            </svg>
                          </div>

                          <div className="sector-meta-details">
                            <h4 className="sector-name-heading">{sector.name}</h4>
                            <span className="sector-centroid tabular-num">
                              {sector.centroid[1].toFixed(4)}°N, {sector.centroid[0].toFixed(4)}°E
                            </span>
                            <div className="sector-stats-chips">
                              <span className="sector-stat-chip tabular-num">{sector.areaKm2} km²</span>
                              <span className="sector-stat-chip tabular-num">
                                {sector.hospitalsCount} Hosp
                              </span>
                              <span className="sector-stat-chip tabular-num">
                                {sector.arterialsCount} Roads
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="sector-card-footer">
                          <span className="sector-honest-disclaimer">
                            No flood analysis loaded
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODULE 03: SCENARIO */}
            {activeTab === "scenario" && (
              <div className="console-module-view">
                <div className="module-instrument-header">
                  <div className="instrument-title-row">
                    <span className="instrument-idx">03 //</span>
                    <h3 className="instrument-title">HYDROLOGICAL SCENARIO</h3>
                  </div>
                  <span className="instrument-readout">BENCHMARK INPUTS</span>
                </div>

                <div className="scenario-presets-grid">
                  {PRESET_SCENARIOS.map((p) => {
                    const isSelected = currentScenario.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`preset-card-btn ${isSelected ? "selected-preset control-pulse-active" : ""}`}
                        onClick={() => onScenarioChange(p)}
                      >
                        <div className="preset-top-line">
                          <span className="preset-name">{p.name}</span>
                          {isSelected && <CheckCircle2 size={13} className="preset-check-icon" />}
                        </div>
                        <span className="preset-discharge tabular-num">
                          {p.upstreamDischargeCusecs.toLocaleString()} cusecs
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="scenario-sliders-box">
                  <div className="scenario-slider-row">
                    <div className="slider-header-line">
                      <span>KRISHNA DISCHARGE</span>
                      <span className="slider-val-readout tabular-num">
                        {currentScenario.upstreamDischargeCusecs.toLocaleString()} cusecs
                      </span>
                    </div>
                    <input
                      type="range"
                      min="20000"
                      max="1200000"
                      step="10000"
                      value={currentScenario.upstreamDischargeCusecs}
                      onChange={(e) =>
                        onScenarioChange({
                          ...currentScenario,
                          upstreamDischargeCusecs: parseInt(e.target.value, 10),
                        })
                      }
                      className="sentinel-range-slider"
                    />
                  </div>

                  <div className="scenario-slider-row">
                    <div className="slider-header-line">
                      <span>HOURLY RAINFALL INTENSITY</span>
                      <span className="slider-val-readout tabular-num">
                        {currentScenario.rainfallRateMmH} mm/h
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      step="5"
                      value={currentScenario.rainfallRateMmH}
                      onChange={(e) =>
                        onScenarioChange({
                          ...currentScenario,
                          rainfallRateMmH: parseInt(e.target.value, 10),
                        })
                      }
                      className="sentinel-range-slider"
                    />
                  </div>
                </div>

                <div className="scenario-disclaimer-card">
                  <span className="scenario-disclaimer-title">SIMULATION ENGINE INPUTS</span>
                  <p className="scenario-disclaimer-text">
                    Historical benchmark parameters for emergency planning analysis. Not a live automated forecast.
                  </p>
                </div>
              </div>
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
