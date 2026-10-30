import { useState, useEffect } from "react";
import type { DataSourceStatus } from "../types/geo";
import { ShieldIcon, MenuIcon, CloseIcon } from "./Icons";
import { Search, Maximize2, Minimize2, Eye, EyeOff, Home } from "lucide-react";
import { motion } from "motion/react";
import { GlassTooltip } from "./GlassTooltip";

interface HeaderProps {
  status: DataSourceStatus;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenCommandPalette: () => void;
  onReturnToGateway: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}

export function Header({
  status,
  mobileMenuOpen,
  onToggleMobileMenu,
  activeTab,
  onSelectTab,
  onOpenCommandPalette,
  onReturnToGateway,
  isFocusMode,
  onToggleFocusMode,
}: HeaderProps) {
  const isLive = status.source === "live-overpass";
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // ignore if user denies or unsupported
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          // ignore
        });
      }
    }
  };

  return (
    <header className="command-header glass-surface" role="banner">
      <div className="header-brand-row">
        <div className="brand-lockup">
          {/* Gateway Return Button */}
          <GlassTooltip text="Return to 3D Gateway intro" position="bottom">
            <button
              type="button"
              className="gateway-return-btn glass-btn-secondary"
              onClick={onReturnToGateway}
              aria-label="Return to 3D Gateway"
            >
              <Home size={15} strokeWidth={1.75} />
              <span className="gateway-btn-text">Gateway</span>
            </button>
          </GlassTooltip>

          <div className="brand-emblem" aria-hidden="true">
            <ShieldIcon className="brand-icon-svg" />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">Sentinel Earth FloodScope</h1>
            <p className="brand-subtitle">
              Geospatial Intelligence & Emergency Command · Vijayawada, AP
            </p>
          </div>
        </div>

        <div className="header-meta">
          {/* Command Palette Trigger */}
          <GlassTooltip text="Open Command Palette (Ctrl+K / Cmd+K)" position="bottom">
            <button
              type="button"
              className="command-palette-trigger-btn glass-btn-secondary"
              onClick={onOpenCommandPalette}
              aria-haspopup="dialog"
            >
              <Search size={14} strokeWidth={1.75} className="trigger-search-icon" />
              <span className="trigger-label">Search / Jump</span>
              <kbd className="trigger-kbd">⌘K</kbd>
            </button>
          </GlassTooltip>

          {/* Focus Mode Toggle */}
          <GlassTooltip text={isFocusMode ? "Exit Focus Mode (F)" : "Enter Focus Mode (F)"} position="bottom">
            <button
              type="button"
              className={`console-icon-tool-btn glass-icon-btn ${isFocusMode ? "tool-active is-active" : ""}`}
              onClick={onToggleFocusMode}
              aria-label="Toggle Focus Mode"
            >
              {isFocusMode ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
              <span className="tool-shortcut-badge">F</span>
            </button>
          </GlassTooltip>

          {/* Fullscreen API Toggle */}
          <GlassTooltip text={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen"} position="bottom">
            <button
              type="button"
              className={`console-icon-tool-btn glass-icon-btn ${isFullscreen ? "tool-active is-active" : ""}`}
              onClick={toggleFullscreen}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={15} strokeWidth={1.75} /> : <Maximize2 size={15} strokeWidth={1.75} />}
            </button>
          </GlassTooltip>

          <div className="system-status-indicator" title={status.message}>
            <span
              className={`status-pulse-dot ${
                isLive ? "status-live" : "status-baseline"
              }`}
            />
            <span className="status-label">
              {status.source === "loading"
                ? "SYNCING DATA"
                : isLive
                ? "LIVE OSM SYNC"
                : "VERIFIED BASELINE"}
            </span>
          </div>

          <div className="coordinates-badge" aria-label="Geographic Coordinates">
            16.5062° N, 80.6480° E
          </div>

          <button
            type="button"
            className="mobile-nav-toggle glass-icon-btn"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close menu" : "Open layer controls"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <nav className="command-tabs" aria-label="Platform Modules" role="tablist">
        {[
          { id: "map", label: "Tactical Map (Vijayawada)" },
          { id: "terrain3d", label: "3D Terrain Simulation", badge: "Interactive 3D" },
          { id: "rainfall", label: "Rainfall & Inflow Scenarios" },
          { id: "detection", label: "Satellite Flood Detection", badge: "SAR & Optical" },
          { id: "exposure", label: "Intelligence & Exposure", badge: "Engine Active" },
          { id: "nemotron", label: "Nebius AI Emergency Planner", badge: "Grounded AI" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={`tab-item glass-nav-item ${isActive ? "tab-active is-active" : ""}`}
              onClick={() => onSelectTab(tab.id)}
              style={{ position: "relative" }}
            >
              <span>{tab.label}</span>
              {tab.badge && <span className="badge-tag badge-gold">{tab.badge}</span>}
              {isActive && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="active-tab-motion-indicator"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    borderRadius: "2px",
                    background: "var(--lavender-200)",
                    boxShadow: "0 0 10px rgba(216, 204, 240, 0.6)",
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
