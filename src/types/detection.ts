import type { FeatureCollection, Geometry } from "geojson";

export type SensorType = "optical" | "sar" | "multispectral";

export interface SatelliteMetadata {
  filename: string;
  filesizeBytes: number;
  width: number;
  height: number;
  sensorType: SensorType;
  acquisitionDate?: string;
  sourceProvider: string;
  minLon?: number;
  minLat?: number;
  maxLon?: number;
  maxLat?: number;
  isGeoreferenced: boolean;
}

export interface DetectedFloodFeatureProperties {
  id: string;
  confidence: "HIGH" | "MODERATE" | "LOW";
  pixelArea: number;
  estimatedAreaKm2?: number;
  classification: "Candidate Inundation" | "Water Surface";
  evidenceBadge: "COMPUTED";
  [key: string]: unknown;
}

export interface FloodDetectionResult {
  status: "success" | "error";
  algorithm: string;
  filename: string;
  sensorType: string;
  imageDimensions: {
    width: number;
    height: number;
    channels: number;
  };
  isGeoreferenced: boolean;
  georeferenceBbox: [number, number, number, number] | null;
  processingTimeMs: number;
  waterPixelCount: number;
  waterCoverageRatio: number;
  estimatedInundationAreaKm2: number | null;
  featuresCount: number;
  maskDataUri: string;
  geoJson: FeatureCollection<Geometry, DetectedFloodFeatureProperties>;
  uncertaintyNotes: string[];
  evidenceBadge: "COMPUTED";
  timestamp: string;
  intersectedAssets?: {
    hospitals: string[];
    roadsKm: number;
  };
}
