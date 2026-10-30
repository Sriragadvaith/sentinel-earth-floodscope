export type EvidenceBadge = "OBSERVED" | "COMPUTED" | "ESTIMATED" | "UNAVAILABLE";

export type SusceptibilityClass = "low" | "moderate" | "high" | "very_high";

export interface ScenarioInputs {
  rainfallIntensityMmH: number; // 1 - 300 mm/h
  rainfallDurationH: number;    // 1 - 72 hours
  derivedTotalRainfallMm: number; // rainfallIntensityMmH * rainfallDurationH
  upstreamDischargeCusecs?: number;
  riverStageFt?: number | null; // null indicates unavailable
}

export interface DataSourceProvenance {
  name: string;
  vintage: string;
  resolution: string;
  license: string;
  evidenceBadge: EvidenceBadge;
}

export interface SusceptibilityZoneSummary {
  riskClass: SusceptibilityClass;
  label: string;
  color: string;
  pattern: string; // for color-blind accessibility
  areaKm2: number;
  percentage: number;
}

export interface ExposedAsset {
  id: string;
  name: string;
  category: "hospital" | "road" | "bridge" | "floodZone";
  type: string;
  susceptibilityClass: SusceptibilityClass;
  distanceToDrainageM: number;
  distanceToHighZoneM: number;
  sectorCode: string;
  beds?: number;
  lengthKm?: number;
  evidenceBadge: EvidenceBadge;
  exposureStatus: "Potentially Exposed" | "Monitored Buffer" | "Low Susceptibility";
  provenance: string;
}

export interface SectorExposureSummary {
  sectorCode: string;
  sectorName: string;
  totalAreaKm2: number;
  highRiskAreaKm2: number;
  percentageHighRisk: number;
  exposedHospitalsCount: number;
  exposedRoadsKm: number;
  evidenceBadge: EvidenceBadge;
}

export interface FactItem {
  id: string; // F1, F2, F3...
  topic: "Rainfall" | "Discharge" | "Healthcare" | "Arterials" | "Sectors" | "Terrain";
  statement: string;
  metricValue?: number | string;
  evidenceBadge: EvidenceBadge;
  source: string;
}

export interface PrecautionaryAction {
  id: string;
  priority: "IMMEDIATE" | "URGENT" | "PRECAUTIONARY" | "ADVISORY";
  action: string;
  targetSector?: string;
  factIds: string[]; // e.g. ["F1", "F4"]
  rationale: string;
}

export interface KeyFinding {
  title: string;
  description: string;
  factIds: string[];
}

export interface AIResponsePlan {
  planId: string;
  model: string;
  createdAt: string;
  scenarioSummary: string;
  keyFindings: KeyFinding[];
  precautionaryActions: PrecautionaryAction[];
  uncertainties: string[];
  limitationsNotice: string;
  groundingStatus: {
    isFullyGrounded: boolean;
    unverifiedStatements: string[];
    verifiedFactsCount: number;
  };
  evidenceBadge: EvidenceBadge;
}

export interface AnalysisResult {
  analysisId: string;
  algorithmVersion: string;
  inputHash: string;
  createdAtUtc: string;
  inputs: ScenarioInputs;
  dataSources: DataSourceProvenance[];
  susceptibilitySummary: SusceptibilityZoneSummary[];
  exposedAssets: ExposedAsset[];
  sectorSummaries: SectorExposureSummary[];
  factsDigest: FactItem[];
  aiPlan?: AIResponsePlan | null;
  limitations: string[];
  missingData: string[];
  status: "complete" | "limited" | "unavailable" | "error";
  statusMessage: string;
}
