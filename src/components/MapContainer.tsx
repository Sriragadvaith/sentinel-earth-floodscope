import { useEffect, useRef, useState, useCallback } from "react";
import { Compass, RotateCcw, Layers } from "lucide-react";
import {
  Map,
  NavigationControl,
  ScaleControl,
  AttributionControl,
  Popup,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type ErrorEvent as MapLibreErrorEvent,
  type GeoJSONSource,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  AppFeatureCollection,
  LayerConfig,
  DataSourceStatus,
  LayerCategory,
  AppGeoFeature,
  GisToolMode,
  MeasurementState,
  BufferAnalysisState,
  RouteState,
} from "../types/geo";
import type { UserPreferences } from "../types/options";
import type { FloodDetectionResult } from "../types/detection";
import type { FloodHistoricalEpoch } from "../data/disasterResponseData";
import {
  createGeodesicCircle,
  haversineDistance,
  calculatePathDistance,
  estimateVijayawadaElevation,
  type LngLat,
} from "../utils/gisMath";
import { calculateDisasterRoute } from "../services/disasterRoutingClient";

import { RefreshIcon } from "./Icons";
import { MapHudOverlay } from "./MapHudOverlay";
import { OptionsButtonPanel } from "./OptionsButtonPanel";

// Advanced GIS Toolkit Components
import { GisToolbar } from "./GisToolkit/GisToolbar";
import { FeatureInspectionDrawer } from "./GisToolkit/FeatureInspectionDrawer";
import { SpatialSearchModal } from "./GisToolkit/SpatialSearchModal";
import { MeasurementPanel } from "./GisToolkit/MeasurementPanel";
import { BufferAnalysisPanel } from "./GisToolkit/BufferAnalysisPanel";
import { DisasterRoutingPanel } from "./GisToolkit/DisasterRoutingPanel";
import { TemporalTimelineBar } from "./GisToolkit/TemporalTimelineBar";
import { AiMapCopilotModal } from "./GisToolkit/AiMapCopilotModal";
import { MapLegend } from "./GisToolkit/MapLegend";
import "./GisToolkit/GisToolkit.css";

// Configure MapLibre GL JS v6 WebWorker URL for Vite
setWorkerUrl(workerUrl);

const BASEMAP_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  liberty: "https://tiles.openfreemap.org/styles/liberty",
} as const;

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

interface MapContainerProps {
  geoData: AppFeatureCollection;
  layers: LayerConfig[];
  isLoading: boolean;
  onRefreshData: () => void;
  flyToState: { center: [number, number]; zoom: number; trigger: number } | null;
  status: DataSourceStatus;
  onToggleLayer: (layerId: LayerCategory) => void;
  onResetView: () => void;
  userPrefs: UserPreferences;
  onUpdatePrefs: (updated: Partial<UserPreferences>) => void;
  detectionResult?: FloodDetectionResult | null;
  onTriggerShowcase?: () => void;
}

export function MapContainer({
  geoData,
  layers,
  isLoading,
  onRefreshData,
  flyToState,
  status,
  onToggleLayer,
  onResetView,
  userPrefs,
  onUpdatePrefs,
  detectionResult,
  onTriggerShowcase,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const mapLoadedRef = useRef(false);
  const activePopupRef = useRef<Popup | null>(null);

  const [basemapStyle, setBasemapStyle] = useState<"dark" | "liberty">(userPrefs.basemap);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(() =>
    isWebGLAvailable() ? null : "WebGL is disabled or unsupported in this browser environment."
  );
  const [inspectedFeature, setInspectedFeature] = useState<string | null>(null);
  const [is3DView, setIs3DView] = useState(true);

  // Live HUD metrics
  const [cursorCoords, setCursorCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [mapMetrics, setMapMetrics] = useState({
    zoom: 12.2,
    pitch: 25,
    bearing: -5,
  });

  // -------------------------------------------------------------
  // ADVANCED GIS TOOLKIT STATE
  // -------------------------------------------------------------
  const [activeGisMode, setActiveGisMode] = useState<GisToolMode>("none");
  const [selectedFeature, setSelectedFeature] = useState<AppGeoFeature | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [currentEpochId, setCurrentEpochId] = useState<string>("current-baseline");
  const [routePickingMode, setRoutePickingMode] = useState<"none" | "origin" | "destination">("none");

  // Measurement State
  const [measurementState, setMeasurementState] = useState<MeasurementState>({
    points: [],
    totalMeters: 0,
    formatted: "0.00 m",
    isActive: false,
    segments: [],
  });

  // Buffer Analysis State
  const [bufferState, setBufferState] = useState<BufferAnalysisState>({
    center: null,
    radiusMeters: 1000,
    intersectingFeatures: [],
    criticalHazardsCount: 0,
    facilitiesCount: 0,
    roadsKm: 0,
    isActive: false,
    enclosedFeaturesCount: 0,
    enclosedFeatures: [],
  });

  // Disaster Routing State
  const [routeState, setRouteState] = useState<RouteState>({
    origin: null,
    originName: undefined,
    destination: null,
    destinationName: undefined,
    coordinates: [],
    distanceMeters: 0,
    durationSeconds: 0,
    isLoading: false,
    isCalculating: false,
    error: null,
    hazardConflicts: [],
  });

  // Keep latest references for event callbacks
  const geoDataRef = useRef(geoData);
  const layersRef = useRef(layers);
  const activeGisModeRef = useRef(activeGisMode);
  const routePickingModeRef = useRef(routePickingMode);
  const bufferRadiusRef = useRef(bufferState.radiusMeters);

  useEffect(() => {
    geoDataRef.current = geoData;
  }, [geoData]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    activeGisModeRef.current = activeGisMode;
  }, [activeGisMode]);

  useEffect(() => {
    routePickingModeRef.current = routePickingMode;
  }, [routePickingMode]);

  useEffect(() => {
    bufferRadiusRef.current = bufferState.radiusMeters;
  }, [bufferState.radiusMeters]);

  // Recalculate Buffer Enclosures
  const updateBufferForCenter = useCallback(
    (center: [number, number], radiusMeters: number) => {
      const circleFeature = createGeodesicCircle(center, radiusMeters);
      const enclosed: AppGeoFeature[] = [];

      for (const feat of geoDataRef.current.features) {
        if (feat.geometry.type === "Point" && "coordinates" in feat.geometry) {
          const coords = feat.geometry.coordinates as [number, number];
          const dist = haversineDistance(center as LngLat, coords as LngLat);
          if (dist <= radiusMeters) {
            enclosed.push(feat);
          }
        } else if (feat.geometry.type === "Polygon" && "coordinates" in feat.geometry) {
          const ring = (feat.geometry.coordinates as [number, number][][])[0];
          let hits = false;
          for (const vertex of ring) {
            if (haversineDistance(center as LngLat, vertex as LngLat) <= radiusMeters) {
              hits = true;
              break;
            }
          }
          if (hits) enclosed.push(feat);
        }
      }

      setBufferState({
        center,
        radiusMeters,
        intersectingFeatures: enclosed,
        criticalHazardsCount: enclosed.filter((f) => f.properties.category === "floodZones").length,
        facilitiesCount: enclosed.filter(
          (f) =>
            f.properties.category === "hospitals" ||
            f.properties.category === "shelters" ||
            f.properties.category === "emergencyServices"
        ).length,
        roadsKm: 0,
        isActive: true,
        enclosedFeaturesCount: enclosed.length,
        enclosedFeatures: enclosed,
        polygonGeometry: circleFeature.geometry,
      });
    },
    []
  );

  // -------------------------------------------------------------
  // LAYER ATTACH & STYLING HELPER
  // -------------------------------------------------------------
  const attachLayers = useCallback((map: Map, data: AppFeatureCollection, currentLayers: LayerConfig[]) => {
    const sourceId = "vijayawada-geodata";
    const existingSource = map.getSource(sourceId) as GeoJSONSource | undefined;

    if (existingSource) {
      existingSource.setData(data);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data,
      });

      // 1. Water polygons (Krishna Riverbed, Bhavani Island, reservoirs)
      map.addLayer({
        id: "layer-river-fill",
        type: "fill",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "river"],
          ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
        ],
        paint: {
          "fill-color": "#0284c7",
          "fill-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "layer-river-outline",
        type: "line",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "river"],
          ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
        ],
        paint: {
          "line-color": "#38bdf8",
          "line-width": 1.5,
          "line-opacity": 0.85,
        },
      });

      // 2. River & canal lines (Krishna thalweg, Eluru Canal, Ryves Canal, Bandar Canal)
      map.addLayer({
        id: "layer-river-lines",
        type: "line",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "river"],
          ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "MultiLineString"]],
        ],
        paint: {
          "line-color": "#38bdf8",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 2,
            14, 4.5,
            17, 7,
          ],
          "line-opacity": 0.95,
        },
      });

      // 3. Flood zones (Low lying vulnerable wards like Krishna Lanka)
      map.addLayer({
        id: "layer-flood-fill",
        type: "fill",
        source: sourceId,
        filter: ["==", ["get", "category"], "floodZones"],
        paint: {
          "fill-color": "#9333ea",
          "fill-opacity": 0.28,
        },
      });

      map.addLayer({
        id: "layer-flood-outline",
        type: "line",
        source: sourceId,
        filter: ["==", ["get", "category"], "floodZones"],
        paint: {
          "line-color": "#c084fc",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });

      // 4. Roads (Major Highways, Bridges & Arterials)
      map.addLayer({
        id: "layer-roads-arterial",
        type: "line",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "roads"],
          ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "MultiLineString"]],
        ],
        paint: {
          "line-color": "#fbbf24",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 1.8,
            14, 3.5,
            17, 6,
          ],
          "line-opacity": 0.92,
        },
      });

      // 5. Hospital footprints (Polygon campuses/facilities)
      map.addLayer({
        id: "layer-hospitals-fill",
        type: "fill",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "hospitals"],
          ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
        ],
        paint: {
          "fill-color": "#f43f5e",
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "layer-hospitals-outline",
        type: "line",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "hospitals"],
          ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
        ],
        paint: {
          "line-color": "#fda4af",
          "line-width": 1.5,
        },
      });

      // 6. Hospital markers (Points)
      map.addLayer({
        id: "layer-hospitals-circles",
        type: "circle",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "hospitals"],
          ["==", ["geometry-type"], "Point"],
        ],
        paint: {
          "circle-color": "#f43f5e",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 5,
            14, 8,
            17, 12,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 7. Verified Shelters & Relief Camps (Points)
      map.addLayer({
        id: "layer-shelters-circles",
        type: "circle",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "shelters"],
          ["==", ["geometry-type"], "Point"],
        ],
        paint: {
          "circle-color": "#34d399",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 5,
            14, 8,
            17, 12,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 8. Fire, Police & Emergency Services (Points)
      map.addLayer({
        id: "layer-emergencyservices-circles",
        type: "circle",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "emergencyServices"],
          ["==", ["geometry-type"], "Point"],
        ],
        paint: {
          "circle-color": "#f97316",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 5,
            14, 8,
            17, 12,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 9. River Gauges & Barrage Telemetry (Points)
      map.addLayer({
        id: "layer-rivergauges-circles",
        type: "circle",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "riverGauges"],
          ["==", ["geometry-type"], "Point"],
        ],
        paint: {
          "circle-color": "#06b6d4",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 6,
            14, 9,
            17, 13,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 10. Rainfall Stations & AWS (Points)
      map.addLayer({
        id: "layer-rainfallstations-circles",
        type: "circle",
        source: sourceId,
        filter: [
          "all",
          ["==", ["get", "category"], "rainfallStations"],
          ["==", ["geometry-type"], "Point"],
        ],
        paint: {
          "circle-color": "#a855f7",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 5,
            14, 8,
            17, 12,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // -------------------------------------------------------------
      // GIS DEDICATED OVERLAY SOURCES & LAYERS
      // -------------------------------------------------------------

      // A. Selection Highlight
      map.addSource("source-gis-selection", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "layer-gis-selection-fill",
        type: "fill",
        source: "source-gis-selection",
        paint: {
          "fill-color": "#d8ccf0",
          "fill-opacity": 0.28,
        },
      });

      map.addLayer({
        id: "layer-gis-selection-line",
        type: "line",
        source: "source-gis-selection",
        paint: {
          "line-color": "#d8ccf0",
          "line-width": 3.5,
        },
      });

      map.addLayer({
        id: "layer-gis-selection-point",
        type: "circle",
        source: "source-gis-selection",
        paint: {
          "circle-color": "#d8ccf0",
          "circle-radius": 12,
          "circle-stroke-color": "#241b1a",
          "circle-stroke-width": 3,
        },
      });

      // B. Measurement Overlay
      map.addSource("source-gis-measure", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "layer-gis-measure-line",
        type: "line",
        source: "source-gis-measure",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#d8ccf0",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });

      map.addLayer({
        id: "layer-gis-measure-points",
        type: "circle",
        source: "source-gis-measure",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#ffffff",
          "circle-radius": 6,
          "circle-stroke-color": "#6f5147",
          "circle-stroke-width": 2,
        },
      });

      // C. Buffer Analysis Overlay
      map.addSource("source-gis-buffer", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "layer-gis-buffer-fill",
        type: "fill",
        source: "source-gis-buffer",
        paint: {
          "fill-color": "#f43f5e",
          "fill-opacity": 0.16,
        },
      });

      map.addLayer({
        id: "layer-gis-buffer-line",
        type: "line",
        source: "source-gis-buffer",
        paint: {
          "line-color": "#f43f5e",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });

      map.addLayer({
        id: "layer-gis-buffer-center",
        type: "circle",
        source: "source-gis-buffer",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#f43f5e",
          "circle-radius": 6,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // D. Disaster Routing Overlay
      map.addSource("source-gis-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "layer-gis-route-casing",
        type: "line",
        source: "source-gis-route",
        paint: {
          "line-color": "#241b1a",
          "line-width": 8,
        },
      });

      map.addLayer({
        id: "layer-gis-route-line",
        type: "line",
        source: "source-gis-route",
        paint: {
          "line-color": "#38bdf8",
          "line-width": 4.5,
        },
      });

      map.addLayer({
        id: "layer-gis-route-points",
        type: "circle",
        source: "source-gis-route",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#fbbf24",
          "circle-radius": 7,
          "circle-stroke-color": "#241b1a",
          "circle-stroke-width": 2,
        },
      });

      // -------------------------------------------------------------
      // Interactive Feature Inspection & Mouse Handlers
      // -------------------------------------------------------------
      const interactiveLayers = [
        "layer-river-lines",
        "layer-river-fill",
        "layer-flood-fill",
        "layer-roads-arterial",
        "layer-hospitals-circles",
        "layer-hospitals-fill",
        "layer-shelters-circles",
        "layer-emergencyservices-circles",
        "layer-rivergauges-circles",
        "layer-rainfallstations-circles",
      ];

      for (const lyr of interactiveLayers) {
        map.on("mouseenter", lyr, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", lyr, () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", lyr, (e: MapLayerMouseEvent) => {
          if (
            activeGisModeRef.current === "measure" ||
            routePickingModeRef.current !== "none"
          ) {
            return;
          }

          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties || {};
          const name = props.name || props.type || "Geospatial Feature";
          setInspectedFeature(name);

          // Find full feature in geoData
          const matched =
            geoDataRef.current.features.find(
              (f) =>
                f.properties.name === props.name ||
                (f.properties.id && f.properties.id === props.id)
            ) || (feature as unknown as AppGeoFeature);

          setSelectedFeature(matched);
        });
      }
    }

    // Apply visibility toggles
    for (const layer of currentLayers) {
      const isVisible = layer.visible ? "visible" : "none";
      if (layer.id === "river") {
        if (map.getLayer("layer-river-fill")) map.setLayoutProperty("layer-river-fill", "visibility", isVisible);
        if (map.getLayer("layer-river-outline")) map.setLayoutProperty("layer-river-outline", "visibility", isVisible);
        if (map.getLayer("layer-river-lines")) map.setLayoutProperty("layer-river-lines", "visibility", isVisible);
      } else if (layer.id === "roads") {
        if (map.getLayer("layer-roads-arterial")) map.setLayoutProperty("layer-roads-arterial", "visibility", isVisible);
      } else if (layer.id === "hospitals") {
        if (map.getLayer("layer-hospitals-fill")) map.setLayoutProperty("layer-hospitals-fill", "visibility", isVisible);
        if (map.getLayer("layer-hospitals-outline")) map.setLayoutProperty("layer-hospitals-outline", "visibility", isVisible);
        if (map.getLayer("layer-hospitals-circles")) map.setLayoutProperty("layer-hospitals-circles", "visibility", isVisible);
      } else if (layer.id === "floodZones") {
        if (map.getLayer("layer-flood-fill")) map.setLayoutProperty("layer-flood-fill", "visibility", isVisible);
        if (map.getLayer("layer-flood-outline")) map.setLayoutProperty("layer-flood-outline", "visibility", isVisible);
      } else if (layer.id === "shelters") {
        if (map.getLayer("layer-shelters-circles")) map.setLayoutProperty("layer-shelters-circles", "visibility", isVisible);
      } else if (layer.id === "emergencyServices") {
        if (map.getLayer("layer-emergencyservices-circles")) map.setLayoutProperty("layer-emergencyservices-circles", "visibility", isVisible);
      } else if (layer.id === "riverGauges") {
        if (map.getLayer("layer-rivergauges-circles")) map.setLayoutProperty("layer-rivergauges-circles", "visibility", isVisible);
      } else if (layer.id === "rainfallStations") {
        if (map.getLayer("layer-rainfallstations-circles")) map.setLayoutProperty("layer-rainfallstations-circles", "visibility", isVisible);
      }
    }
  }, []);

  // -------------------------------------------------------------
  // UPDATE SELECTION HIGHLIGHT LAYER
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource("source-gis-selection") as GeoJSONSource | undefined;
    if (!src) return;

    if (selectedFeature) {
      src.setData({
        type: "FeatureCollection",
        features: [selectedFeature as any],
      });
    } else {
      src.setData({ type: "FeatureCollection", features: [] });
    }
  }, [selectedFeature, mapLoaded]);

  // -------------------------------------------------------------
  // UPDATE MEASUREMENT LAYER
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource("source-gis-measure") as GeoJSONSource | undefined;
    if (!src) return;

    const feats: any[] = [];
    if (measurementState.points.length > 1) {
      feats.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: measurementState.points,
        },
        properties: {},
      });
    }
    for (const pt of measurementState.points) {
      feats.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: pt,
        },
        properties: {},
      });
    }

    src.setData({
      type: "FeatureCollection",
      features: feats,
    });
  }, [measurementState, mapLoaded]);

  // -------------------------------------------------------------
  // UPDATE BUFFER LAYER
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource("source-gis-buffer") as GeoJSONSource | undefined;
    if (!src) return;

    if (bufferState.polygonGeometry) {
      src.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: bufferState.polygonGeometry,
            properties: {},
          },
          ...(bufferState.center
            ? [
                {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: bufferState.center,
                  },
                  properties: {},
                },
              ]
            : []),
        ] as any,
      });
    } else {
      src.setData({ type: "FeatureCollection", features: [] });
    }
  }, [bufferState, mapLoaded]);

  // -------------------------------------------------------------
  // UPDATE ROUTE LAYER
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource("source-gis-route") as GeoJSONSource | undefined;
    if (!src) return;

    const feats: any[] = [];
    if (routeState.coordinates && routeState.coordinates.length > 1) {
      feats.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: routeState.coordinates,
        },
        properties: {},
      });
    }
    if (routeState.origin) {
      feats.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: routeState.origin,
        },
        properties: { role: "origin", name: routeState.originName || "Origin" },
      });
    }
    if (routeState.destination) {
      feats.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: routeState.destination,
        },
        properties: { role: "destination", name: routeState.destinationName || "Destination" },
      });
    }

    src.setData({
      type: "FeatureCollection",
      features: feats,
    });
  }, [routeState, mapLoaded]);

  // Synchronize basemap style from userPrefs
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    if (basemapStyle !== userPrefs.basemap) {
      queueMicrotask(() => {
        setBasemapStyle(userPrefs.basemap);
      });
      mapRef.current.setStyle(BASEMAP_STYLES[userPrefs.basemap]);
      mapRef.current.once("style.load", () => {
        attachLayers(mapRef.current!, geoDataRef.current, layersRef.current);
      });
    }
  }, [userPrefs.basemap, mapLoaded, basemapStyle, attachLayers]);

  const toggle3DPerspective = () => {
    if (!mapRef.current) return;
    const next = !is3DView;
    setIs3DView(next);
    mapRef.current.easeTo({
      pitch: next ? 55 : 0,
      bearing: next ? -15 : 0,
      duration: userPrefs.reducedMotion ? 0 : 1000,
    });
  };

  const resetNorth = () => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      bearing: 0,
      pitch: is3DView ? 55 : 0,
      duration: userPrefs.reducedMotion ? 0 : 800,
    });
  };

  const toggleBasemap = () => {
    const next = basemapStyle === "dark" ? "liberty" : "dark";
    onUpdatePrefs({ basemap: next });
    setBasemapStyle(next);

    if (!mapRef.current) return;
    const map = mapRef.current;
    map.setStyle(BASEMAP_STYLES[next]);
    map.once("style.load", () => {
      attachLayers(map, geoDataRef.current, layersRef.current);
    });
  };

  // -------------------------------------------------------------
  // INITIALIZE MAPLIBRE GL JS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    if (!isWebGLAvailable()) return;

    let map: Map;

    try {
      map = new Map({
        container: containerRef.current,
        style: BASEMAP_STYLES[basemapStyle],
        center: [80.648, 16.506], // Vijayawada center coordinates
        zoom: 12.2,
        pitch: 25,
        bearing: -5,
        attributionControl: false,
      });

      mapRef.current = map;

      // Add Standard Navigation & Scale Controls
      map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");
      map.addControl(
        new AttributionControl({
          compact: true,
          customAttribution: "OpenStreetMap · OpenFreeMap · APSDMA",
        }),
        "bottom-right"
      );

      // Track cursor coordinates for Cockpit HUD
      map.on("mousemove", (e) => {
        setCursorCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      });

      map.on("mouseout", () => {
        setCursorCoords(null);
      });

      // Track Camera Metrics for Cockpit HUD
      const handleCameraMetrics = () => {
        setMapMetrics({
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        });
      };

      map.on("move", handleCameraMetrics);
      map.on("zoom", handleCameraMetrics);
      map.on("pitch", handleCameraMetrics);
      map.on("rotate", handleCameraMetrics);

      // Canvas Click Handler for GIS Tools
      map.on("click", (e) => {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        // 1. Route Picking Mode
        if (routePickingModeRef.current === "origin") {
          setRouteState((prev) => ({
            ...prev,
            origin: coords,
            originName: `Pin (${coords[1].toFixed(4)}°, ${coords[0].toFixed(4)}°)`,
          }));
          setRoutePickingMode("none");
          return;
        }

        if (routePickingModeRef.current === "destination") {
          setRouteState((prev) => ({
            ...prev,
            destination: coords,
            destinationName: `Pin (${coords[1].toFixed(4)}°, ${coords[0].toFixed(4)}°)`,
          }));
          setRoutePickingMode("none");
          return;
        }

        // 2. Measurement Tool Click
        if (activeGisModeRef.current === "measure") {
          setMeasurementState((prev) => {
            const nextPts = [...prev.points, coords];
            const pathResult = calculatePathDistance(nextPts as LngLat[]);
            const dist = pathResult.totalMeters;
            const formatted = pathResult.formatted;

            const segments: Array<{ from: [number, number]; to: [number, number]; distanceMeters: number }> = [];
            for (let i = 0; i < nextPts.length - 1; i++) {
              const segD = haversineDistance(nextPts[i] as LngLat, nextPts[i + 1] as LngLat);
              segments.push({ from: nextPts[i], to: nextPts[i + 1], distanceMeters: segD });
            }

            return {
              points: nextPts,
              totalMeters: dist,
              formatted,
              isActive: true,
              segments,
            };
          });
          return;
        }

        // 3. Buffer Analysis Tool Click
        if (activeGisModeRef.current === "buffer") {
          updateBufferForCenter(coords, bufferRadiusRef.current);
          return;
        }

        // 4. Feature / Elevation Inspector Click on ground
        if (activeGisModeRef.current === "inspect") {
          const elevData = estimateVijayawadaElevation(coords[0], coords[1]);
          const adHocFeature: AppGeoFeature = {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: coords,
            },
            properties: {
              name: `Ground Inspection Point (${elevData.terrainType})`,
              category: "river",
              type: "Topographic Coordinate Point",
              elevationApproxM: elevData.elevationM,
              description: `Topographic inspection point in Vijayawada basin at approx ${elevData.elevationM}m elevation above MSL (${elevData.terrainType}).`,
              provenance: "SIMULATED",
            },
          };
          setSelectedFeature(adHocFeature);
        }
      });

      map.on("load", () => {
        mapLoadedRef.current = true;
        setMapLoaded(true);
        setMapError(null);
        map.resize();
        attachLayers(map, geoDataRef.current, layersRef.current);
        handleCameraMetrics();
      });

      map.on("error", (e: MapLibreErrorEvent) => {
        console.warn("MapLibre event error:", e);
        if (e.error && !mapLoadedRef.current) {
          setMapError(`Map error: ${e.error.message || "Failed to load basemap style or tiles."}`);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Map initialization exception:", err);
      queueMicrotask(() => {
        setMapError(`Failed to initialize MapLibre GL JS: ${msg}`);
      });
      return;
    }

    // ResizeObserver ensures canvas updates if parent flex or viewport changes size
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Resize on sidebar expand/collapse transitionend
    const handleSidebarResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };
    window.addEventListener("sidebar-resized", handleSidebarResize);

    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("sidebar-resized", handleSidebarResize);
      resizeObserver.disconnect();
      const popup = activePopupRef.current;
      popup?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [attachLayers, basemapStyle, updateBufferForCenter]);

  // Update GeoJSON source when geoData changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    attachLayers(map, geoData, layers);
  }, [geoData, mapLoaded, attachLayers, layers]);

  // Handle Layer Visibility Toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    for (const layer of layers) {
      const isVisible = layer.visible ? "visible" : "none";

      if (layer.id === "river") {
        if (map.getLayer("layer-river-fill")) map.setLayoutProperty("layer-river-fill", "visibility", isVisible);
        if (map.getLayer("layer-river-outline")) map.setLayoutProperty("layer-river-outline", "visibility", isVisible);
        if (map.getLayer("layer-river-lines")) map.setLayoutProperty("layer-river-lines", "visibility", isVisible);
      } else if (layer.id === "roads") {
        if (map.getLayer("layer-roads-arterial")) map.setLayoutProperty("layer-roads-arterial", "visibility", isVisible);
      } else if (layer.id === "hospitals") {
        if (map.getLayer("layer-hospitals-fill")) map.setLayoutProperty("layer-hospitals-fill", "visibility", isVisible);
        if (map.getLayer("layer-hospitals-outline")) map.setLayoutProperty("layer-hospitals-outline", "visibility", isVisible);
        if (map.getLayer("layer-hospitals-circles")) map.setLayoutProperty("layer-hospitals-circles", "visibility", isVisible);
      } else if (layer.id === "floodZones") {
        if (map.getLayer("layer-flood-fill")) map.setLayoutProperty("layer-flood-fill", "visibility", isVisible);
        if (map.getLayer("layer-flood-outline")) map.setLayoutProperty("layer-flood-outline", "visibility", isVisible);
      } else if (layer.id === "shelters") {
        if (map.getLayer("layer-shelters-circles")) map.setLayoutProperty("layer-shelters-circles", "visibility", isVisible);
      } else if (layer.id === "emergencyServices") {
        if (map.getLayer("layer-emergencyservices-circles")) map.setLayoutProperty("layer-emergencyservices-circles", "visibility", isVisible);
      } else if (layer.id === "riverGauges") {
        if (map.getLayer("layer-rivergauges-circles")) map.setLayoutProperty("layer-rivergauges-circles", "visibility", isVisible);
      } else if (layer.id === "rainfallStations") {
        if (map.getLayer("layer-rainfallstations-circles")) map.setLayoutProperty("layer-rainfallstations-circles", "visibility", isVisible);
      }
    }
  }, [layers, mapLoaded]);

  // Handle Dynamic Flood Detection Overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = "satellite-flood-detection";
    const fillLayerId = "layer-satellite-detection-fill";
    const lineLayerId = "layer-satellite-detection-outline";

    if (detectionResult && detectionResult.isGeoreferenced && detectionResult.geoJson.features.length > 0) {
      const existingSource = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(detectionResult.geoJson as any);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: detectionResult.geoJson as any,
        });

        map.addLayer({
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "#f2b735", // Marigold candidate flood inundation
            "fill-opacity": 0.55,
          },
        });

        map.addLayer({
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#ffffff",
            "line-width": 2,
            "line-dasharray": [2, 1],
          },
        });
      }
    } else {
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }, [detectionResult, mapLoaded]);

  // Handle Fly-To actions from sidebar
  useEffect(() => {
    if (!flyToState || !mapRef.current) return;
    mapRef.current.flyTo({
      center: flyToState.center,
      zoom: flyToState.zoom,
      speed: 1.2,
      curve: 1.4,
      essential: true,
    });
  }, [flyToState]);

  // -------------------------------------------------------------
  // GIS TOOLBAR ACTION HANDLERS
  // -------------------------------------------------------------
  const handleSelectGisMode = useCallback((mode: GisToolMode) => {
    setActiveGisMode(mode);
    setRoutePickingMode("none");

    if (mode === "search") {
      setIsSearchOpen(true);
    } else if (mode === "copilot") {
      setIsCopilotOpen(true);
    }
  }, []);

  const handleResetAllGisTools = useCallback(() => {
    setActiveGisMode("none");
    setSelectedFeature(null);
    setIsSearchOpen(false);
    setIsCopilotOpen(false);
    setRoutePickingMode("none");
    setMeasurementState({
      points: [],
      totalMeters: 0,
      formatted: "0.00 m",
      isActive: false,
      segments: [],
    });
    setBufferState({
      center: null,
      radiusMeters: 1000,
      intersectingFeatures: [],
      criticalHazardsCount: 0,
      facilitiesCount: 0,
      roadsKm: 0,
      isActive: false,
      enclosedFeaturesCount: 0,
      enclosedFeatures: [],
    });
    setRouteState({
      origin: null,
      originName: undefined,
      destination: null,
      destinationName: undefined,
      coordinates: [],
      distanceMeters: 0,
      durationSeconds: 0,
      isLoading: false,
      isCalculating: false,
      error: null,
      hazardConflicts: [],
    });
  }, []);

  // Keyboard Shortcuts for GIS Tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "s":
          e.preventDefault();
          setIsSearchOpen((prev) => !prev);
          break;
        case "i":
          e.preventDefault();
          setActiveGisMode((prev) => (prev === "inspect" ? "none" : "inspect"));
          break;
        case "m":
          e.preventDefault();
          setActiveGisMode((prev) => (prev === "measure" ? "none" : "measure"));
          break;
        case "a":
          e.preventDefault();
          setActiveGisMode((prev) => (prev === "polygonArea" ? "none" : "polygonArea"));
          break;
        case "b":
          e.preventDefault();
          setActiveGisMode((prev) => (prev === "buffer" ? "none" : "buffer"));
          break;
        case "r":
          e.preventDefault();
          setActiveGisMode((prev) => (prev === "route" ? "none" : "route"));
          break;
        case "t":
          e.preventDefault();
          setActiveGisMode((prev) => (prev === "temporal" ? "none" : "temporal"));
          break;
        case "c":
          e.preventDefault();
          setIsCopilotOpen((prev) => !prev);
          break;
        case "escape":
          setIsSearchOpen(false);
          setIsCopilotOpen(false);
          setRoutePickingMode("none");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Routing Execution
  const handleCalculateRoute = useCallback(async () => {
    if (!routeState.origin || !routeState.destination) return;

    setRouteState((prev) => ({ ...prev, isLoading: true, isCalculating: true, error: null }));
    try {
      const res = await calculateDisasterRoute({
        origin: routeState.origin,
        destination: routeState.destination,
        originName: routeState.originName,
        destinationName: routeState.destinationName,
      });

      setRouteState((prev) => ({
        ...prev,
        ...res,
        isLoading: false,
        isCalculating: false,
      }));

      // Auto zoom to fit route
      if (mapRef.current && res.coordinates && res.coordinates.length > 0) {
        let minLng = Infinity,
          maxLng = -Infinity,
          minLat = Infinity,
          maxLat = -Infinity;
        for (const [lng, lat] of res.coordinates) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 80, duration: 1000 }
        );
      }
    } catch {
      setRouteState((prev) => ({
        ...prev,
        isLoading: false,
        isCalculating: false,
        error: "Route calculation failed. Check network or parameters.",
      }));
    }
  }, [routeState.origin, routeState.destination, routeState.originName, routeState.destinationName]);

  // Epoch selection handler
  const handleSelectEpoch = useCallback((epoch: FloodHistoricalEpoch) => {
    setCurrentEpochId(epoch.id);
    if (!mapRef.current) return;

    // Camera fly to key feature based on epoch
    if (epoch.id === "historical-2009" || epoch.id === "current-baseline") {
      mapRef.current.flyTo({
        center: [80.6053, 16.5074], // Prakasam Barrage
        zoom: 13.5,
        pitch: 45,
        bearing: 10,
        speed: 1.0,
      });
    } else if (epoch.id === "historical-2024") {
      mapRef.current.flyTo({
        center: [80.627, 16.495], // Krishna Lanka
        zoom: 13.8,
        pitch: 50,
        bearing: -15,
        speed: 1.0,
      });
    } else {
      mapRef.current.flyTo({
        center: [80.648, 16.506],
        zoom: 12.8,
        pitch: 35,
        bearing: 0,
        speed: 1.0,
      });
    }
  }, []);

  return (
    <div className="map-view-frame">
      {/* Top Status & Fast View Controls */}
      <div className="map-header-status-strip">
        <div className="strip-left">
          <span className="strip-dot" />
          <span className="strip-title">VIJAYAWADA URBAN FLOODSCOPE BASIN</span>
        </div>
        <div className="strip-right">
          <button
            type="button"
            className="perspective-pill"
            onClick={toggleBasemap}
            title="Toggle between Dark Tactical and Detailed Liberty basemaps"
          >
            <Layers className="pill-mini-icon" />
            <span>{basemapStyle === "dark" ? "Dark Tactical" : "Liberty Basemap"}</span>
          </button>
          <button
            type="button"
            className={`perspective-pill ${is3DView ? "pill-3d" : "pill-2d"}`}
            onClick={toggle3DPerspective}
            title="Toggle between 3D Isometric (55°) and 2D Top-Down View"
          >
            <Compass className="pill-mini-icon" />
            <span>{is3DView ? "3D Tilt (55°)" : "2D Top-Down"}</span>
          </button>
          <button
            type="button"
            className="perspective-pill"
            onClick={resetNorth}
            title="Reset Map Orientation to True North"
          >
            <RotateCcw className="pill-mini-icon" />
            <span>North</span>
          </button>
        </div>
      </div>

      {/* Futuristic Cockpit HUD Overlay */}
      <MapHudOverlay
        cursorCoords={cursorCoords}
        mapMetrics={mapMetrics}
        status={status}
        activeLayersCount={layers.filter((l) => l.visible).length}
        totalFeatures={geoData.features.length}
        inspectedFeature={inspectedFeature}
      />

      {/* Advanced GIS Floating Toolbar */}
      <GisToolbar
        activeMode={activeGisMode}
        onSelectMode={handleSelectGisMode}
        onResetTools={handleResetAllGisTools}
        hasActiveMeasurements={measurementState.points.length > 0}
        hasActiveRoute={!!routeState.coordinates && routeState.coordinates.length > 0}
        hasActiveBuffer={bufferState.center !== null}
      />

      {/* Picking Mode Banner */}
      {routePickingMode !== "none" && (
        <div className="gis-picking-banner" role="status">
          <span className="picking-dot" />
          <span>Click anywhere on the map to place the <strong>{routePickingMode.toUpperCase()}</strong> pin.</span>
          <button type="button" className="btn-cancel-pick" onClick={() => setRoutePickingMode("none")}>
            Cancel
          </button>
        </div>
      )}

      {/* Measurement Panel */}
      {activeGisMode === "measure" && (
        <MeasurementPanel
          state={measurementState}
          onClear={() =>
            setMeasurementState({
              points: [],
              totalMeters: 0,
              formatted: "0.00 m",
              isActive: false,
              segments: [],
            })
          }
          onUndo={() => {
            setMeasurementState((prev) => {
              const nextPts = prev.points.slice(0, -1);
              const pathResult = calculatePathDistance(nextPts as LngLat[]);
              const dist = pathResult.totalMeters;
              const formatted = pathResult.formatted;
              return {
                points: nextPts,
                totalMeters: dist,
                formatted,
                isActive: nextPts.length > 0,
                segments: (prev.segments || []).slice(0, -1),
              };
            });
          }}
          onClose={() => setActiveGisMode("none")}
        />
      )}

      {/* Buffer Analysis Panel */}
      {activeGisMode === "buffer" && (
        <BufferAnalysisPanel
          state={bufferState}
          onChangeRadius={(r) => {
            if (bufferState.center) {
              updateBufferForCenter(bufferState.center, r);
            } else {
              setBufferState((prev) => ({ ...prev, radiusMeters: r }));
            }
          }}
          onClear={() =>
            setBufferState({
              center: null,
              radiusMeters: 1000,
              intersectingFeatures: [],
              criticalHazardsCount: 0,
              facilitiesCount: 0,
              roadsKm: 0,
              isActive: false,
              enclosedFeaturesCount: 0,
              enclosedFeatures: [],
            })
          }
          onClose={() => setActiveGisMode("none")}
          onSelectFeature={(feat) => setSelectedFeature(feat)}
        />
      )}

      {/* Disaster Routing Panel */}
      {activeGisMode === "route" && (
        <DisasterRoutingPanel
          state={routeState}
          onPickOriginOnMap={() => setRoutePickingMode("origin")}
          onPickDestinationOnMap={() => setRoutePickingMode("destination")}
          onSwapPoints={() => {
            setRouteState((prev) => ({
              ...prev,
              origin: prev.destination,
              originName: prev.destinationName,
              destination: prev.origin,
              destinationName: prev.originName,
            }));
          }}
          onCalculateRoute={handleCalculateRoute}
          onClearRoute={() =>
            setRouteState({
              origin: null,
              originName: undefined,
              destination: null,
              destinationName: undefined,
              coordinates: [],
              distanceMeters: 0,
              durationSeconds: 0,
              isLoading: false,
              isCalculating: false,
              error: null,
              hazardConflicts: [],
            })
          }
          onClose={() => setActiveGisMode("none")}
        />
      )}

      {/* Temporal Flood Timeline Dock */}
      {activeGisMode === "temporal" && (
        <TemporalTimelineBar
          currentEpochId={currentEpochId}
          onSelectEpoch={handleSelectEpoch}
          onClose={() => setActiveGisMode("none")}
        />
      )}

      {/* Feature & Topographic Inspection Drawer */}
      <FeatureInspectionDrawer
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        allFeatures={geoData.features}
        onSetRouteDestination={(feat) => {
          if (feat.geometry.type === "Point" && "coordinates" in feat.geometry) {
            const coords = feat.geometry.coordinates as [number, number];
            setRouteState((prev) => ({
              ...prev,
              destination: coords,
              destinationName: feat.properties.name || "Facility",
            }));
            setActiveGisMode("route");
          }
        }}
        onSetBufferCenter={(coords) => {
          setActiveGisMode("buffer");
          updateBufferForCenter(coords, bufferState.radiusMeters);
        }}
        onOpenCopilotWithFeature={() => {
          setIsCopilotOpen(true);
        }}
      />

      {/* Spatial Fuzzy Search Modal */}
      <SpatialSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        features={geoData.features}
        onSelectFeature={(f) => {
          setSelectedFeature(f);
          setIsSearchOpen(false);
          if (mapRef.current) {
            let center: [number, number] = [80.648, 16.506];
            if (f.geometry.type === "Point" && "coordinates" in f.geometry) {
              center = f.geometry.coordinates as [number, number];
            } else if (f.geometry.type === "Polygon" && "coordinates" in f.geometry) {
              center = (f.geometry.coordinates as [number, number][][])[0][0];
            } else if (f.geometry.type === "LineString" && "coordinates" in f.geometry) {
              center = (f.geometry.coordinates as [number, number][])[0];
            }
            mapRef.current.flyTo({
              center,
              zoom: 14.5,
              essential: true,
            });
          }
        }}
      />

      {/* In-Map AI Copilot Modal */}
      <AiMapCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        selectedFeature={selectedFeature}
        allFeatures={geoData.features}
      />

      {/* Dynamic Collapsible Map Legend */}
      <MapLegend layers={layers} />

      {/* MapLibre Canvas Container */}
      <div
        className="map-canvas-container"
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: "650px", position: "relative" }}
      />

      {/* Floating Options Button & Panel */}
      <OptionsButtonPanel
        layers={layers}
        onToggleLayer={onToggleLayer}
        is3DTilt={is3DView}
        onToggle3DTilt={toggle3DPerspective}
        onResetView={onResetView}
        basemapStyle={basemapStyle}
        onToggleBasemap={toggleBasemap}
        userPrefs={userPrefs}
        onUpdatePrefs={onUpdatePrefs}
        onTriggerShowcase={onTriggerShowcase}
      />

      {/* Visible Map Loading State */}
      {(!mapLoaded || isLoading) && !mapError && (
        <div className="map-overlay-loading" aria-live="polite">
          <div className="radar-sweep" />
          <span className="loading-badge">
            {!mapLoaded ? "Initializing OpenFreeMap Basemap & Worker..." : "Synchronizing Geospatial Feeds..."}
          </span>
        </div>
      )}

      {/* Explicit Map Error State */}
      {mapError && (
        <div className="map-overlay-error" role="alert">
          <div className="error-dialog-card">
            <h4>Map Rendering Alert</h4>
            <p>{mapError}</p>
            <button
              type="button"
              className="action-button action-refresh"
              onClick={() => window.location.reload()}
            >
              <RefreshIcon /> Reload Map Engine
            </button>
          </div>
        </div>
      )}

      {/* Empty Data State */}
      {geoData.features.length === 0 && mapLoaded && !isLoading && !mapError && (
        <div className="map-overlay-empty">
          <h3>No geographic features found</h3>
          <p>The vector query returned 0 features for this viewport bounding box.</p>
          <button type="button" className="action-button action-refresh" onClick={onRefreshData}>
            <RefreshIcon /> Reload Baseline
          </button>
        </div>
      )}
    </div>
  );
}
