/**
 * Sentinel Earth - FloodScope: Mission 5 Emergency Response Planner Types
 * Strictly matches backend Pydantic schemas for /api/emergency-plan.
 */

export type ProvenanceType = "observed" | "derived" | "simulated" | "user_entered";
export type BasisType = "verified_input" | "simulated_input" | "assumption" | "general_guidance";
export type DetectionStatusType = "detected" | "not_detected" | "unknown" | "simulated";
export type SeverityType = "low" | "moderate" | "high" | "severe" | "unknown";
export type PriorityType = "IMMEDIATE" | "URGENT" | "PRECAUTIONARY" | "ADVISORY";
export type UncertaintyLevelType = "low" | "medium" | "high";

export interface LocationInput {
  name: string;
  lat: number;
  lng: number;
  district?: string;
}

export interface FloodStatusInput {
  detectionStatus: DetectionStatusType;
  severity: SeverityType;
  method: string;
  timestamp?: string;
  source?: string;
}

export interface AffectedRoadItem {
  id: string;
  name: string;
  type: string;
  status: string;
  provenance: ProvenanceType;
  source?: string;
  timestamp?: string;
  confidence?: number;
}

export interface AffectedInfrastructureItem {
  id: string;
  name: string;
  type: string;
  status: string;
  provenance: ProvenanceType;
  source?: string;
  timestamp?: string;
  confidence?: number;
}

export interface FacilityItem {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  availability?: string;
  capacity?: number;
  provenance: ProvenanceType;
  source?: string;
  timestamp?: string;
}

export interface ScenarioContext {
  rainfallIntensityMmH: number;
  durationH: number;
  totalRainfallMm: number;
  provenance: "simulated";
}

export interface EmergencyPlanRequest {
  location: LocationInput;
  floodStatus: FloodStatusInput;
  affectedRoads: AffectedRoadItem[];
  affectedInfrastructure: AffectedInfrastructureItem[];
  shelters: FacilityItem[];
  hospitals: FacilityItem[];
  scenario?: ScenarioContext;
  operatorNotes?: string;
  bypassCache?: boolean;
}

export interface ImmediateAction {
  action: string;
  priority: PriorityType;
  basis: BasisType;
  evidenceRefs: string[];
}

export interface EvacuationConsideration {
  consideration: string;
  basis: BasisType;
  evidenceRefs: string[];
}

export interface InfrastructurePriority {
  item: string;
  reason: string;
  basis: BasisType;
  evidenceRefs: string[];
}

export interface ResourceRecommendation {
  resource: string;
  rationale: string;
  basis: BasisType;
}

export interface UncertaintyInfo {
  level: UncertaintyLevelType;
  notes: string[];
}

export interface DataSourcesAndLimitations {
  sourcesUsed: string[];
  limitations: string[];
}

export interface ResponseMeta {
  model: string;
  mode: "live" | "mock";
  generatedAt: string;
  inputProvenanceSummary: Record<string, number>;
  cached?: boolean;
}

export interface EmergencyPlanResponse {
  situationSummary: string;
  immediateActions: ImmediateAction[];
  evacuationConsiderations: EvacuationConsideration[];
  infrastructurePriorities: InfrastructurePriority[];
  resourceRecommendations: ResourceRecommendation[];
  missingInformation: string[];
  uncertainty: UncertaintyInfo;
  dataSourcesAndLimitations: DataSourcesAndLimitations;
  meta: ResponseMeta;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthCheckResponse {
  status: "healthy";
  mode: "live" | "mock";
  aiConfigured: boolean;
  version: string;
  time: string;
}
