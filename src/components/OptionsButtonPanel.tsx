import { useState, useEffect, useRef } from "react";
import { Sliders, X, RotateCcw, Compass, Droplet, Navigation, HeartPulse, AlertTriangle, ShieldCheck } from "lucide-react";
import type { LayerCategory, LayerConfig } from "../types/geo";
import type { UserPreferences } from "../types/options";
import { Portal } from "./Portal";

interface OptionsButtonPanelProps {
  layers: LayerConfig[];
  onToggleLayer: (layerId: LayerCategory) => void;
  is3DTilt: boolean;
  onToggle3DTilt: () => void;
  onResetView: () => void;
  basemapStyle: "dark" | "liberty";
  onToggleBasemap: () => void;
  userPrefs: UserPreferences;
  onUpdatePrefs: (updated: Partial<UserPreferences>) => void;
  onTriggerShowcase?: () => void;
}

export function OptionsButtonPanel({
  layers,
  onToggleLayer,
  is3DTilt,
  onToggle3DTilt,
  onResetView,
  basemapStyle,
  onToggleBasemap,
  userPrefs,
  onUpdatePrefs,
  onTriggerShowcase,
}: OptionsButtonPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ bottom: number; left: number }>({ bottom: 70, left: 24 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Position calculation relative to trigger button
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        setPanelPos({
          bottom: window.innerHeight - rect.top + 10,
          left: Math.max(16, rect.left),
        });
      }
    }
  }, [isOpen]);

  // Keyboard navigation & outside click dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!panelRef.current) return;
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const list = Array.from(focusable);
        const idx = list.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        if (e.key === "ArrowDown") {
          const next = idx < list.length - 1 ? list[idx + 1] : list[0];
          next.focus();
        } else {
          const prev = idx > 0 ? list[idx - 1] : list[list.length - 1];
          prev.focus();
        }
      } else if (e.key === "Home" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) {
          e.preventDefault();
          focusable[0].focus();
        }
      } else if (e.key === "End" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) {
          e.preventDefault();
          focusable[focusable.length - 1].focus();
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

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
      default:
        return ShieldCheck;
    }
  };

  return (
    <div className="options-anchor-container">
      {/* Precision Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        className={`options-trigger-pill glass-surface ${isOpen ? "active-open is-active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="sentinel-options-panel"
        aria-label="Geospatial Options & Layers"
      >
        <span className="button-sheen-sweep" />
        <div className="options-icon-wrapper">
          {isOpen ? (
            <X className="options-mini-icon morph-x" size={17} strokeWidth={1.75} />
          ) : (
            <Sliders className="options-mini-icon" size={17} strokeWidth={1.75} />
          )}
          {isOpen && <span className="marigold-active-dot" />}
        </div>
        <span className="options-pill-label">Options</span>
      </button>

      {/* Floating Popover rendered through Portal into document.body */}
      {isOpen && (
        <Portal>
          <div
            ref={panelRef}
            id="sentinel-options-panel"
            className="options-glass-panel glass-surface--floating"
            role="dialog"
            aria-modal="true"
            aria-label="Map Options and Preferences"
            style={{
              position: "fixed",
              bottom: `${panelPos.bottom}px`,
              left: `${panelPos.left}px`,
              zIndex: "var(--z-dropdown)",
            }}
          >
            {/* Mobile Drag Handle */}
            <div className="mobile-sheet-drag-handle" aria-hidden="true" />

            {/* Header */}
            <div className="options-panel-header">
              <div className="options-title-block">
                <span className="options-hud-tag">CONFIG // ENGINE</span>
                <h3 className="options-panel-title">Operational Controls</h3>
              </div>
              <button
                type="button"
                className="options-close-icon-btn glass-icon-btn"
                onClick={() => {
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                aria-label="Close options"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>

            <div className="options-panel-scrollable">
              {/* 1. LAYERS */}
              <div className="options-section">
                <div className="options-section-label">LAYERS // VECTORS</div>
                <div className="options-layer-switches">
                  {layers.map((lyr) => {
                    const Icon = getLayerIcon(lyr.id);
                    return (
                      <div key={lyr.id} className="option-layer-row">
                        <div className="option-layer-meta">
                          <span className="layer-dot-indicator" style={{ backgroundColor: lyr.color }} />
                          <Icon size={14} strokeWidth={1.75} className="layer-type-icon" />
                          <div className="layer-row-text">
                            <span className="layer-row-label">{lyr.label}</span>
                            <span className="layer-row-count">{lyr.count} features</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={lyr.visible}
                          className={`sentinel-switch ${lyr.visible ? "switch-on" : "switch-off"}`}
                          onClick={() => onToggleLayer(lyr.id)}
                          aria-label={`Toggle ${lyr.label}`}
                        >
                          <span className="switch-thumb" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. MAP VIEW */}
              <div className="options-section">
                <div className="options-section-label">MAP VIEW // PROJECTION</div>
                <div className="segmented-view-control" role="group" aria-label="Map Projection">
                  <button
                    type="button"
                    className={`segment-btn ${!is3DTilt ? "selected is-active" : ""}`}
                    onClick={() => {
                      if (is3DTilt) onToggle3DTilt();
                    }}
                    aria-pressed={!is3DTilt}
                  >
                    2D Flat (Nadir)
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${is3DTilt ? "selected is-active" : ""}`}
                    onClick={() => {
                      if (!is3DTilt) onToggle3DTilt();
                    }}
                    aria-pressed={is3DTilt}
                  >
                    <Compass size={13} strokeWidth={1.75} className="segment-mini-icon" />
                    3D Tilt (55°)
                  </button>
                </div>

                <div className="options-btn-row">
                  <button type="button" className="action-pill-reset glass-btn-secondary" onClick={onResetView}>
                    <RotateCcw size={13} strokeWidth={1.75} />
                    <span>Reset Center & Bearing</span>
                  </button>
                </div>
              </div>

              {/* 3. TERRAIN EXAGGERATION */}
              <div className="options-section">
                <div className="options-section-label-row">
                  <span className="options-section-label">TERRAIN // RELIEF EXAGGERATION</span>
                  <span className="options-numeric-readout">{userPrefs.terrainExaggeration.toFixed(1)}x</span>
                </div>
                <div className="slider-wrapper">
                  <input
                    type="range"
                    min="1.0"
                    max="4.0"
                    step="0.1"
                    className="sentinel-range-slider"
                    value={userPrefs.terrainExaggeration}
                    onChange={(e) => onUpdatePrefs({ terrainExaggeration: parseFloat(e.target.value) })}
                    aria-label="Terrain Relief Exaggeration"
                  />
                  <div className="slider-ticks">
                    <span>1.0x (True)</span>
                    <span>2.5x (Optimal)</span>
                    <span>4.0x (High)</span>
                  </div>
                </div>
                <span className="options-footnote">
                  Visual scaling applied to SRTM 30m digital elevation matrix.
                </span>
              </div>

              {/* 4. DISPLAY & ACCESSIBILITY */}
              <div className="options-section">
                <div className="options-section-label">DISPLAY // ACCESSIBILITY</div>

                <div className="option-toggle-row">
                  <div className="option-toggle-info">
                    <span className="option-row-title">Basemap Cartography</span>
                    <span className="option-row-desc">{basemapStyle === "dark" ? "Dark Tactical" : "Liberty Detailed"}</span>
                  </div>
                  <button
                    type="button"
                    className="carto-toggle-btn glass-btn-secondary"
                    onClick={onToggleBasemap}
                    title="Switch basemap cartography"
                  >
                    {basemapStyle === "dark" ? "Switch to Liberty" : "Switch to Dark"}
                  </button>
                </div>

                <div className="option-toggle-row">
                  <div className="option-toggle-info">
                    <span className="option-row-title">Ambient 3D Backdrop</span>
                    <span className="option-row-desc">Sentinel orbit decorative globe & floating forms</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={userPrefs.ambient3DBackdrop}
                    className={`sentinel-switch ${userPrefs.ambient3DBackdrop ? "switch-on" : "switch-off"}`}
                    onClick={() => onUpdatePrefs({ ambient3DBackdrop: !userPrefs.ambient3DBackdrop })}
                    aria-label="Toggle ambient 3D backdrop"
                  >
                    <span className="switch-thumb" />
                  </button>
                </div>

                {userPrefs.ambient3DBackdrop && (
                  <div className="option-toggle-row intensity-row">
                    <div className="option-toggle-info">
                      <span className="option-row-title">Backdrop Density</span>
                      <span className="option-row-desc">Visibility and shader glow intensity</span>
                    </div>
                    <div className="intensity-pill-selector" role="radiogroup" aria-label="Backdrop Density">
                      {(["low", "medium", "high"] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          role="radio"
                          aria-checked={userPrefs.backdropIntensity === lvl}
                          className={`intensity-pill-btn ${userPrefs.backdropIntensity === lvl ? "active-pill is-active" : ""}`}
                          onClick={() => onUpdatePrefs({ backdropIntensity: lvl })}
                        >
                          {lvl.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {onTriggerShowcase && userPrefs.ambient3DBackdrop && (
                  <div className="option-toggle-row showcase-row">
                    <div className="option-toggle-info">
                      <span className="option-row-title">Full Showcase Mode</span>
                      <span className="option-row-desc">Inspect 3D orbit globe full-screen at 60 FPS</span>
                    </div>
                    <button
                      type="button"
                      className="showcase-launch-btn glass-btn-secondary"
                      onClick={() => {
                        setIsOpen(false);
                        onTriggerShowcase();
                      }}
                      title="Launch full-screen 3D showcase (Shortcut: B)"
                    >
                      <span>Inspect [B]</span>
                    </button>
                  </div>
                )}

                <div className="option-toggle-row">
                  <div className="option-toggle-info">
                    <span className="option-row-title">Reduced Motion Mode</span>
                    <span className="option-row-desc">Halts particle drift and camera sweeps</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={userPrefs.reducedMotion}
                    className={`sentinel-switch ${userPrefs.reducedMotion ? "switch-on" : "switch-off"}`}
                    onClick={() => onUpdatePrefs({ reducedMotion: !userPrefs.reducedMotion })}
                    aria-label="Toggle reduced motion"
                  >
                    <span className="switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            <div className="options-panel-footer">
              <span className="pref-sync-text">Preferences saved locally</span>
              <span className="engine-ver">v2.4-AGY</span>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
