import type { FeatureCollection, Feature, Geometry } from "geojson";

export type LayerCategory =
  | "roads"
  | "river"
  | "hospitals"
  | "floodZones"
  | "shelters"
  | "emergencyServices"
  | "riverGauges"
  | "rainfallStations";

export type DataProvenance = "LIVE" | "HISTORICAL" | "SIMULATED" | "UNAVAILABLE";

export interface GeoFeatureProperties {
  id?: string | number;
  name?: string;
  name_te?: string; // Telugu name
  category: LayerCategory;
  type?: string;
  highway?: string;
  waterway?: string;
  natural?: string;
  amenity?: string;
  emergency?: string;
  operator?: string;
  beds?: number | string;
  capacity?: number;
  riskLevel?: "low" | "moderate" | "high" | "critical";
  elevationApproxM?: number;
  description?: string;
  source?: "osm-live" | "osm-verified-baseline" | "cwc-apwrd" | "imd-aws" | "ap-disaster-mgmt";
  provenance?: DataProvenance;
  status?: string;

  // River gauge attributes
  currentWaterLevelFt?: number;
  warningLevelFt?: number;
  dangerLevelFt?: number;
  dischargeCfs?: number;
  historicalPeak2009Ft?: number;

  // Rainfall station attributes
  rainfallMm1h?: number;
  rainfallMm24h?: number;
  rainfallStatus?: "normal" | "moderate" | "heavy" | "very_heavy" | "extreme";

  // Shelter attributes
  shelterStatus?: "ready" | "staged" | "activated" | "full";
  managingAgency?: string;

  // Emergency service attributes
  serviceType?: "fire_station" | "police_control" | "sdrf_ndrf_base" | "boat_rescue_staging";
  unitsAvailable?: number;

  lastUpdatedIso?: string;
  [key: string]: unknown;
}

export type AppGeoFeature = Feature<Geometry, GeoFeatureProperties>;
export type AppFeatureCollection = FeatureCollection<Geometry, GeoFeatureProperties>;

export interface LayerConfig {
  id: LayerCategory;
  label: string;
  description: string;
  color: string;
  secondaryColor?: string;
  count: number;
  visible: boolean;
  geometryTypes: string[];
}

export interface DataSourceStatus {
  source: "live-overpass" | "verified-baseline" | "loading" | "error";
  message: string;
  timestamp: string;
  totalFeatures: number;
  httpStatus?: number;
}

export type GisToolMode =
  | "none"
  | "search"
  | "inspect"
  | "measure"
  | "polygonArea"
  | "buffer"
  | "route"
  | "copilot"
  | "temporal";

export interface MeasurementState {
  points: [number, number][]; // [lng, lat]
  totalMeters: number;
  formatted: string;
  isActive: boolean;
  segments?: Array<{ from: [number, number]; to: [number, number]; distanceMeters: number }>;
}

export interface BufferAnalysisState {
  center: [number, number] | null;
  radiusMeters: number;
  intersectingFeatures: AppGeoFeature[];
  criticalHazardsCount: number;
  facilitiesCount: number;
  roadsKm: number;
  isActive: boolean;
  enclosedFeaturesCount?: number;
  enclosedFeatures?: AppGeoFeature[];
  polygonGeometry?: Geometry;
}

export interface RouteHazardConflict {
  hazardName: string;
  riskLevel: string;
  distanceMeters: number;
}

export interface RouteState {
  origin: [number, number] | null;
  originName?: string;
  destination: [number, number] | null;
  destinationName?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  coordinates?: [number, number][];
  provider?: string;
  timestamp?: string;
  hasConflict?: boolean;
  conflicts?: RouteHazardConflict[];
  hazardConflicts?: RouteHazardConflict[];
  isLoading?: boolean;
  isCalculating?: boolean;
  error?: string | null;
}
