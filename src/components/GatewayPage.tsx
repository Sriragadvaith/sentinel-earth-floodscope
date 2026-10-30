import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowRight, Compass, Shield, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Terrain3DHero } from "./Terrain3DHero";
import type { DataSourceStatus } from "../types/geo";
import { transitions } from "../utils/motionVariants";

interface GatewayPageProps {
  onEnterDashboard: () => void;
  status: DataSourceStatus;
  skipIntro: boolean;
  onToggleSkipIntro: (skip: boolean) => void;
}

export function GatewayPage({
  onEnterDashboard,
  status,
  skipIntro,
  onToggleSkipIntro,
}: GatewayPageProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const enteredRef = useRef(false);

  const handleEnter = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    setIsTransitioning(true);

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Transition delay (850ms or fast for reduced motion)
    const delay = prefersReducedMotion ? 120 : 850;
    setTimeout(() => {
      onEnterDashboard();
    }, delay);
  }, [onEnterDashboard]);

  // Listen for Enter, Space, or single wheel scroll / touch swipe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEnter();
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      if (touchStartY - touchEndY > 50) {
        // Swiped up
        handleEnter();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 30) {
        handleEnter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [handleEnter]);

  return (
    <div className={`gateway-viewport ${isTransitioning ? "gateway-exiting" : ""}`}>
      {/* Cinematic subtle contour background pattern */}
      <div className="cinematic-contour-bg" aria-hidden="true" />

      {/* 3D Terrain Hero Canvas Stage */}
      <div className="gateway-3d-stage">
        <Terrain3DHero
          onScrollToMap={handleEnter}
          onDeployScenario={() => handleEnter()}
        />
      </div>

      {/* Cinematic Vignette Overlay */}
      <div className="gateway-vignette-overlay" aria-hidden="true" />

      {/* Gateway Foreground Interface with Staggered Motion */}
      <div className="gateway-content-shell">
        {/* Top Header Badge */}
        <motion.header
          className="gateway-top-bar"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitions.cinematic, delay: 0.1 }}
        >
          <div className="gateway-brand-chip">
            <span className="gateway-brand-icon">
              <Shield size={16} />
            </span>
            <span className="gateway-brand-name">SENTINEL EARTH // INTELLIGENCE</span>
          </div>

          <div className="gateway-status-pill">
            <span className="status-live-dot" />
            <span className="status-label-mono">
              {status.source === "live-overpass"
                ? "LIVE OSM FEED"
                : status.source === "loading"
                ? "INITIALIZING VECTORS"
                : "VERIFIED BASELINE ACTIVE"}
            </span>
          </div>
        </motion.header>

        {/* Center Hero Card with Liquid Silver sheen and Marigold Accent */}
        <motion.main
          className="gateway-center-card marigold-border-sheen"
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...transitions.cinematic, delay: 0.2 }}
        >
          <div className="gateway-cockpit-corners">
            <span className="hud-corner corner-tl" />
            <span className="hud-corner corner-tr" />
            <span className="hud-corner corner-bl" />
            <span className="hud-corner corner-br" />
          </div>

          <motion.div
            className="gateway-hero-kicker"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.cinematic, delay: 0.3 }}
          >
            <Compass size={14} className="kicker-icon" />
            <span>GEO-TACTICAL FLOOD COMMAND · VIJAYAWADA, AP</span>
          </motion.div>

          {/* Sentinel Earth Wordmark with subtle upward motion */}
          <motion.h1
            className="gateway-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.cinematic, delay: 0.4 }}
          >
            SENTINEL EARTH <span className="title-accent">—</span> FLOODSCOPE
          </motion.h1>

          <motion.p
            className="gateway-subtitle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.cinematic, delay: 0.5 }}
          >
            Geospatial flood intelligence and precision emergency planning for the Krishna River basin.
          </motion.p>

          <motion.div
            className="gateway-action-row"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.cinematic, delay: 0.6 }}
          >
            {/* Machined Liquid-Silver Primary Button with tactile micro-interactions */}
            <motion.button
              type="button"
              className="primary-machined-btn gateway-enter-btn silver-shimmer-sweep"
              onClick={handleEnter}
              disabled={isTransitioning}
              aria-label="Enter FloodScope Operational Dashboard"
              whileHover={{ scale: 1.025, y: -1 }}
              whileTap={{ scale: 0.975, y: 1 }}
              transition={{ duration: 0.15 }}
            >
              <span className="btn-sheen" />
              <span className="btn-text">
                {isTransitioning ? "Initializing Command Deck..." : "Enter FloodScope"}
              </span>
              <ArrowRight size={18} className="btn-arrow-icon" />
            </motion.button>
          </motion.div>

          <motion.div
            className="gateway-footer-hints"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...transitions.cinematic, delay: 0.7 }}
          >
            <span className="keyboard-entry-hint">
              Press <kbd>Enter</kbd> or <kbd>Space</kbd> to launch interface
            </span>

            <label className="skip-intro-checkbox-label">
              <input
                type="checkbox"
                checked={skipIntro}
                onChange={(e) => onToggleSkipIntro(e.target.checked)}
                className="sr-only"
              />
              <span className={`custom-checkbox ${skipIntro ? "checked" : ""}`}>
                {skipIntro && <Check size={12} />}
              </span>
              <span>Skip intro on next launch</span>
            </label>
          </motion.div>
        </motion.main>

        {/* Bottom Disclaimers */}
        <motion.footer
          className="gateway-bottom-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...transitions.cinematic, delay: 0.75 }}
        >
          <span className="gateway-disclaimer-text">
            Topographic relief derived from SRTM 30m digital elevation matrix. Illustrative relief object, not survey-calibrated flood forecast.
          </span>
          <span className="gateway-coords-readout tabular-num">
            16.5062° N · 80.6480° E · 18.2m MSL
          </span>
        </motion.footer>
      </div>

      {/* AnimatePresence for exit veil */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            className="gateway-exit-veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              inset: 0,
              background: "#241B1A", // Deep Espresso
              zIndex: 999,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
