import { useState, useEffect, useCallback, useMemo } from "react";
import type { AppFeatureCollection, LayerConfig, DataSourceStatus, LayerCategory } from "./types/geo";
import { PRESET_SCENARIOS, type FloodScenario } from "./types/scenario";
import type { TacticalSector } from "./types/sector";
import { VIJAYAWADA_BASELINE_DATA } from "./data/vijayawadaBaseline";
import { EXTENDED_LAYERS } from "./data/disasterResponseData";
import { fetchVijayawadaGeodata } from "./services/overpassService";
import { Header } from "./components/Header";
import { CommandConsoleSidebar } from "./components/CommandConsoleSidebar";
import { MapContainer } from "./components/MapContainer";
import { StatusBar } from "./components/StatusBar";
import { Terrain3DHero } from "./components/Terrain3DHero";
import { ScenarioControls } from "./components/ScenarioControls";
import { IntelligencePanels } from "./components/IntelligencePanels";
import { FutureModuleView } from "./components/FutureModules";
import { CommandPalette } from "./components/CommandPalette";
import { GatewayPage } from "./components/GatewayPage";
import { AnalysisDashboard } from "./components/AnalysisDashboard";
import { SatelliteAnalysisPanel } from "./components/SatelliteAnalysisPanel";
import { EmergencyResponsePlannerPanel } from "./components/EmergencyResponsePlannerPanel";
import { Ambient3DBackdrop } from "./components/Ambient3DBackdrop";
import { loadUserPreferences, saveUserPreferences, type UserPreferences } from "./types/options";
import type { FloodDetectionResult } from "./types/detection";
import { EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { panelSlideLeft, panelSlideRight, panelFadeUp, transitions } from "./utils/motionVariants";
import "./App.css";
import "./components/AnalysisDashboard.css";
import "./components/SatelliteAnalysisPanel.css";

const SKIP_INTRO_KEY = "sentinel_skip_intro_v1";

function getInitialRoute(): "gateway" | "dashboard" {
  if (typeof window === "undefined") return "gateway";
  const path = window.location.pathname;
  const hash = window.location.hash;
  if (path === "/app" || hash === "#app") return "dashboard";

  try {
    const skip = localStorage.getItem(SKIP_INTRO_KEY);
    if (skip === "true") return "dashboard";
  } catch {
    // fallback
  }
  return "gateway";
}

export default function App() {
  // Routing state (Section 3: "/" for Gateway, "/app" for Dashboard)
  const [currentRoute, setCurrentRoute] = useState<"gateway" | "dashboard">(getInitialRoute);
  const [skipIntro, setSkipIntro] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(SKIP_INTRO_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Focus mode state (Section 3: F key / Focus mode)
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  // Showcase mode state (B key: full-screen 3D ambient orbit showcase)
  const [showcaseMode, setShowcaseMode] = useState<boolean>(false);

  // Active Tactical Sector lock (Section 8G)
  const [activeSector, setActiveSector] = useState<TacticalSector | null>(null);

  const [geoData, setGeoData] = useState<AppFeatureCollection>(VIJAYAWADA_BASELINE_DATA);
  const [layers, setLayers] = useState<LayerConfig[]>(EXTENDED_LAYERS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Body scroll lock and Escape dismiss on mobile drawer open
  useEffect(() => {
    if (mobileMenuOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMobileMenuOpen(false);
      };
      window.addEventListener("keydown", handleEscape);
      return () => {
        document.body.style.overflow = original;
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [mobileMenuOpen]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("map");
  const [currentScenario, setCurrentScenario] = useState<FloodScenario>(PRESET_SCENARIOS[0]);
  const [flyToState, setFlyToState] = useState<{ center: [number, number]; zoom: number; trigger: number } | null>(null);
  const [detectionResult, setDetectionResult] = useState<FloodDetectionResult | null>(null);

  // User preferences with localStorage persistence
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(() => loadUserPreferences());

  const handleUpdatePrefs = useCallback((updated: Partial<UserPreferences>) => {
    setUserPrefs((prev) => {
      const next = { ...prev, ...updated };
      saveUserPreferences(next);
      return next;
    });
  }, []);

  const [status, setStatus] = useState<DataSourceStatus>({
    source: "verified-baseline",
    message: "Verified geospatial baseline active for Vijayawada, AP",
    timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
    totalFeatures: VIJAYAWADA_BASELINE_DATA.features.length,
  });

  // Navigation handlers
  const navigateToDashboard = useCallback(() => {
    setCurrentRoute("dashboard");
    if (typeof window !== "undefined" && window.history.pushState) {
      window.history.pushState({ route: "dashboard" }, "", "/app");
    }
  }, []);

  const navigateToGateway = useCallback(() => {
    setCurrentRoute("gateway");
    if (typeof window !== "undefined" && window.history.pushState) {
      window.history.pushState({ route: "gateway" }, "", "/");
    }
  }, []);

  const handleToggleSkipIntro = useCallback((skip: boolean) => {
    setSkipIntro(skip);
    try {
      localStorage.setItem(SKIP_INTRO_KEY, skip ? "true" : "false");
    } catch {
      // ignore
    }
  }, []);

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === "/app" || hash === "#app") {
        setCurrentRoute("dashboard");
      } else {
        setCurrentRoute("gateway");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Keyboard shortcut listener for Focus mode (F key) and Command Palette (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setShowcaseMode((prev) => !prev);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      } else if (e.key === "Escape") {
        if (showcaseMode) {
          setShowcaseMode(false);
        } else if (isFocusMode) {
          setIsFocusMode(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocusMode, showcaseMode]);

  // Calculate dynamic layer feature counts whenever geoData changes
  const computedLayers = useMemo(() => {
    const counts: Record<LayerCategory, number> = {
      river: 0,
      roads: 0,
      hospitals: 0,
      floodZones: 0,
      shelters: 0,
      emergencyServices: 0,
      riverGauges: 0,
      rainfallStations: 0,
    };

    for (const f of geoData.features) {
      const cat = f.properties.category;
      if (cat && cat in counts) {
        counts[cat]++;
      }
    }

    return layers.map((layer) => ({
      ...layer,
      count: counts[layer.id] || 0,
    }));
  }, [geoData, layers]);

  // Load and synchronize data from Overpass or verified baseline
  const synchronizeData = useCallback(async () => {
    setIsLoading(true);
    setStatus((prev) => ({
      ...prev,
      source: "loading",
      message: "Contacting OpenStreetMap Overpass vector feeds...",
    }));

    try {
      const result = await fetchVijayawadaGeodata((msg) => {
        setStatus((prev) => ({ ...prev, message: msg }));
      });

      setGeoData(result.data);
      setStatus(result.status);
    } catch {
      setStatus({
        source: "error",
        message: "Failed to connect to vector feeds. Baseline retained.",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        totalFeatures: geoData.features.length,
      });
    } finally {
      setIsLoading(false);
    }
  }, [geoData.features.length]);

  // Initial fetch on mount
  useEffect(() => {
    synchronizeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleLayer = useCallback((layerId: LayerCategory) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  }, []);

  const handleSetAllLayers = useCallback((visible: boolean) => {
    setLayers((prev) => prev.map((l) => ({ ...l, visible })));
  }, []);

  const handleResetView = useCallback(() => {
    setActiveSector(null);
    setFlyToState({
      center: [80.648, 16.506],
      zoom: 12.2,
      trigger: Date.now(),
    });
  }, []);

  const handleFlyToLocation = useCallback((center: [number, number], zoom: number) => {
    setActiveTab("map");
    setFlyToState({
      center,
      zoom,
      trigger: Date.now(),
    });
    setMobileMenuOpen(false);
  }, []);

  const handleToggleBasemap = useCallback(() => {
    handleUpdatePrefs({
      basemap: userPrefs.basemap === "dark" ? "liberty" : "dark",
    });
  }, [userPrefs.basemap, handleUpdatePrefs]);

  // Section 3: If on Gateway route, render isolated GatewayPage
  if (currentRoute === "gateway") {
    return (
      <GatewayPage
        onEnterDashboard={navigateToDashboard}
        status={status}
        skipIntro={skipIntro}
        onToggleSkipIntro={handleToggleSkipIntro}
      />
    );
  }

  return (
    <div className={`floodscope-app-shell ${isFocusMode ? "mode-focus-active" : ""} ${showcaseMode ? "showcase-active" : ""}`}>
      {/* Ambient Live 3D Background ("Sentinel Orbit" - Section 6) */}
      <Ambient3DBackdrop
        reducedMotion={userPrefs.reducedMotion}
        enabled={userPrefs.ambient3DBackdrop}
        showcaseMode={showcaseMode}
        onExitShowcase={() => setShowcaseMode(false)}
        intensity={userPrefs.backdropIntensity}
      />

      {/* Header bar (Hidden in Focus & Showcase Modes) */}
      {!isFocusMode && !showcaseMode && (
        <Header
          status={status}
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen((o) => !o)}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onReturnToGateway={navigateToGateway}
          isFocusMode={isFocusMode}
          onToggleFocusMode={() => setIsFocusMode((f) => !f)}
        />
      )}

      {/* Floating Exit Focus Mode Button (Shown only when in Focus Mode) */}
      {isFocusMode && (
        <button
          type="button"
          className="exit-focus-floating-pill"
          onClick={() => setIsFocusMode(false)}
          title="Exit Focus Mode (F or Esc)"
        >
          <EyeOff size={14} />
          <span>Exit Focus Mode</span>
          <kbd>F</kbd>
        </button>
      )}

      <main className="floodscope-body-layout" style={{ display: showcaseMode ? "none" : undefined }}>
        <AnimatePresence mode="wait">
          {activeTab === "map" ? (
            <motion.div
              key="map-dashboard-view"
              className="map-subgrid-layout"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transitions.cinematic}
              style={{ display: "contents" }}
            >
              {/* Mobile Scrim Backdrop */}
              {mobileMenuOpen && (
                <div
                  className="mobile-drawer-scrim"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-hidden="true"
                />
              )}

              {/* Command Console Left Rail */}
              {!isFocusMode && (
                <motion.div
                  className={`sidebar-wrapper ${mobileMenuOpen ? "drawer-open" : ""}`}
                  variants={panelSlideLeft}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <CommandConsoleSidebar
                    layers={computedLayers}
                    onToggleLayer={handleToggleLayer}
                    onSetAllLayers={handleSetAllLayers}
                    onResetView={handleResetView}
                    onFlyToLocation={handleFlyToLocation}
                    onRefreshData={synchronizeData}
                    status={status}
                    isLoading={isLoading}
                    totalFeatures={geoData.features.length}
                    currentScenario={currentScenario}
                    onScenarioChange={setCurrentScenario}
                    activeSectorId={activeSector?.id ?? null}
                    onSelectSector={setActiveSector}
                  />
                </motion.div>
              )}

              <motion.section
                className="map-view-section"
                variants={panelFadeUp}
                initial="hidden"
                animate="visible"
              >
                <MapContainer
                  geoData={geoData}
                  layers={computedLayers}
                  isLoading={isLoading}
                  onRefreshData={synchronizeData}
                  flyToState={flyToState}
                  status={status}
                  onToggleLayer={handleToggleLayer}
                  onResetView={handleResetView}
                  userPrefs={userPrefs}
                  onUpdatePrefs={handleUpdatePrefs}
                  detectionResult={detectionResult}
                  onTriggerShowcase={() => setShowcaseMode(true)}
                />
              </motion.section>

              {/* Right Telemetry Deck (Hidden in Focus Mode) */}
              {!isFocusMode && (
                <motion.div
                  className="intel-deck-wrapper"
                  variants={panelSlideRight}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <IntelligencePanels
                    scenario={currentScenario}
                    totalFeatures={geoData.features.length}
                    activeLayersCount={computedLayers.filter((l) => l.visible).length}
                  />
                </motion.div>
              )}
            </motion.div>
          ) : activeTab === "terrain3d" ? (
            <motion.section
              key="terrain3d-view"
              className="terrain-hero-section"
              variants={panelFadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Terrain3DHero
                onScrollToMap={() => setActiveTab("map")}
                onDeployScenario={(presetId) => {
                  const matched = PRESET_SCENARIOS.find((p) => p.id === presetId);
                  if (matched) setCurrentScenario(matched);
                  setActiveTab("rainfall");
                }}
              />
            </motion.section>
          ) : activeTab === "rainfall" ? (
            <motion.section
              key="rainfall-view"
              className="scenario-view-container"
              variants={panelFadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <ScenarioControls
                currentScenario={currentScenario}
                onScenarioChange={setCurrentScenario}
              />
            </motion.section>
          ) : activeTab === "detection" ? (
            <motion.section
              key="detection-view"
              className="satellite-view-container"
              variants={panelFadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ width: "100%", overflowY: "auto" }}
            >
              <SatelliteAnalysisPanel
                onDetectionComplete={(res) => setDetectionResult(res)}
                activeDetectionResult={detectionResult}
                onNavigateToMap={() => setActiveTab("map")}
                geoData={geoData}
              />
            </motion.section>
          ) : activeTab === "nemotron" ? (
            <motion.section
              key="nemotron-planner-view"
              className="planner-section-container"
              variants={panelFadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ width: "100%", overflowY: "auto" }}
            >
              <EmergencyResponsePlannerPanel
                geoData={geoData}
                currentScenario={currentScenario}
                detectionResult={detectionResult}
                onNavigateToMap={() => setActiveTab("map")}
              />
            </motion.section>
          ) : activeTab === "exposure" ? (
            <motion.section
              key="exposure-view"
              className="analysis-dashboard-section"
              variants={panelFadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ width: "100%", overflowY: "auto" }}
            >
              <AnalysisDashboard
                currentScenario={currentScenario}
                onScenarioChange={setCurrentScenario}
                geoData={geoData}
                onSwitchToMap={() => setActiveTab("map")}
              />
            </motion.section>
          ) : (
            <motion.section
              key="future-module-view"
              className="future-module-container"
              variants={panelFadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <FutureModuleView
                module={activeTab as "exposure" | "nemotron"}
                onReturnToMap={() => setActiveTab("map")}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {!isFocusMode && !showcaseMode && <StatusBar />}

      {/* Futuristic Command Palette (Section 5) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        layers={computedLayers}
        onToggleLayer={handleToggleLayer}
        onFlyToLocation={handleFlyToLocation}
        onResetView={handleResetView}
        onToggleBasemap={handleToggleBasemap}
        onToggle3DTilt={handleResetView}
        onSelectTab={setActiveTab}
      />
    </div>
  );
}
