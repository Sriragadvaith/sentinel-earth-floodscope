from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

EvidenceBadge = Literal["OBSERVED", "COMPUTED", "ESTIMATED", "UNAVAILABLE"]
SusceptibilityClass = Literal["low", "moderate", "high", "very_high"]
AnalysisStatus = Literal["complete", "limited", "unavailable", "error"]

class ScenarioInputs(BaseModel):
    rainfall_intensity_mm_h: float = Field(..., ge=1.0, le=300.0, description="Hypothetical rainfall rate in mm/hour")
    rainfall_duration_h: float = Field(..., ge=1.0, le=72.0, description="Hypothetical duration in hours")
    upstream_discharge_cusecs: Optional[float] = Field(default=120000.0, ge=0.0, le=2000000.0)
    river_stage_ft: Optional[float] = Field(default=None, description="Unavailable: no live gauge telemetry configured")

class DataSourceProvenance(BaseModel):
    name: str
    vintage: str
    resolution: str
    license: str
    evidence_badge: EvidenceBadge

class SusceptibilityZoneSummary(BaseModel):
    risk_class: SusceptibilityClass
    label: str
    color: str
    pattern: str
    area_km2: float
    percentage: float

class ExposedAsset(BaseModel):
    id: str
    name: str
    category: Literal["hospital", "road", "bridge", "floodZone"]
    type: str
    susceptibility_class: SusceptibilityClass
    distance_to_drainage_m: float
    distance_to_high_zone_m: float
    sector_code: str
    beds: Optional[int] = None
    length_km: Optional[float] = None
    evidence_badge: EvidenceBadge
    exposure_status: str
    provenance: str

class SectorExposureSummary(BaseModel):
    sector_code: str
    sector_name: str
    total_area_km2: float
    high_risk_area_km2: float
    percentage_high_risk: float
    exposed_hospitals_count: int
    exposed_roads_km: float
    evidence_badge: EvidenceBadge

class FactItem(BaseModel):
    id: str  # F1, F2, F3...
    topic: str
    statement: str
    metric_value: Optional[Any] = None
    evidence_badge: EvidenceBadge
    source: str

class PrecautionaryAction(BaseModel):
    id: str
    priority: Literal["IMMEDIATE", "URGENT", "PRECAUTIONARY", "ADVISORY"]
    action: str
    target_sector: Optional[str] = None
    fact_ids: List[str]
    rationale: str

class KeyFinding(BaseModel):
    title: str
    description: str
    fact_ids: List[str]

class GroundingStatus(BaseModel):
    is_fully_grounded: bool
    unverified_statements: List[str]
    verified_facts_count: int

class AIResponsePlan(BaseModel):
    plan_id: str
    model: str
    created_at: str
    scenario_summary: str
    key_findings: List[KeyFinding]
    precautionary_actions: List[PrecautionaryAction]
    uncertainties: List[str]
    limitations_notice: str
    grounding_status: GroundingStatus
    evidence_badge: EvidenceBadge = "ESTIMATED"

class AnalysisResult(BaseModel):
    analysis_id: str
    algorithm_version: str
    input_hash: str
    created_at_utc: str
    inputs: ScenarioInputs
    derived_total_rainfall_mm: float
    data_sources: List[DataSourceProvenance]
    susceptibility_summary: List[SusceptibilityZoneSummary]
    exposed_assets: List[ExposedAsset]
    sector_summaries: List[SectorExposureSummary]
    facts_digest: List[FactItem]
    ai_plan: Optional[AIResponsePlan] = None
    limitations: List[str]
    missing_data: List[str]
    status: AnalysisStatus
    status_message: str
