"""
Sentinel Earth - FloodScope: Nebius Emergency Planner Schemas
Strict Pydantic models for validated /api/emergency-plan requests and responses.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

ProvenanceType = Literal["observed", "derived", "simulated", "user_entered"]
BasisType = Literal["verified_input", "simulated_input", "assumption", "general_guidance"]
DetectionStatusType = Literal["detected", "not_detected", "unknown", "simulated"]
SeverityType = Literal["low", "moderate", "high", "severe", "unknown"]
PriorityType = Literal["IMMEDIATE", "URGENT", "PRECAUTIONARY", "ADVISORY"]
UncertaintyLevelType = Literal["low", "medium", "high"]

# ---------------------------------------------------------------------------
# Request Schemas (Strict, Extra Forbid, Bounded Arrays & String Lengths)
# ---------------------------------------------------------------------------

class LocationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., max_length=100)
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    district: Optional[str] = Field(default=None, max_length=100)

class FloodStatusInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    detectionStatus: DetectionStatusType
    severity: SeverityType
    method: str = Field(..., max_length=200)
    timestamp: Optional[str] = Field(default=None, max_length=50)
    source: Optional[str] = Field(default=None, max_length=100)

class AffectedRoadItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    type: str = Field(..., max_length=50)
    status: str = Field(..., max_length=50)
    provenance: ProvenanceType
    source: Optional[str] = Field(default=None, max_length=100)
    timestamp: Optional[str] = Field(default=None, max_length=50)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)

class AffectedInfrastructureItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    type: str = Field(..., max_length=50)
    status: str = Field(..., max_length=50)
    provenance: ProvenanceType
    source: Optional[str] = Field(default=None, max_length=100)
    timestamp: Optional[str] = Field(default=None, max_length=50)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)

class FacilityItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    availability: Optional[str] = Field(default=None, max_length=50)
    capacity: Optional[int] = Field(default=None, ge=0)
    provenance: ProvenanceType
    source: Optional[str] = Field(default=None, max_length=100)
    timestamp: Optional[str] = Field(default=None, max_length=50)

class ScenarioContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rainfallIntensityMmH: float = Field(..., ge=0.0, le=500.0)
    durationH: float = Field(..., ge=0.0, le=168.0)
    totalRainfallMm: float = Field(..., ge=0.0, le=2000.0)
    provenance: Literal["simulated"] = "simulated"

class EmergencyPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    location: LocationInput
    floodStatus: FloodStatusInput
    affectedRoads: List[AffectedRoadItem] = Field(default_factory=list, max_length=50)
    affectedInfrastructure: List[AffectedInfrastructureItem] = Field(default_factory=list, max_length=50)
    shelters: List[FacilityItem] = Field(default_factory=list, max_length=30)
    hospitals: List[FacilityItem] = Field(default_factory=list, max_length=30)
    scenario: Optional[ScenarioContext] = None
    operatorNotes: Optional[str] = Field(default=None, max_length=1000)
    bypassCache: bool = Field(default=False, description="When true, skip cache lookup and do not reuse a cached response for this request.")

# ---------------------------------------------------------------------------
# Response Schemas (Zod-compatible, Typed, Grounded)
# ---------------------------------------------------------------------------

class ImmediateAction(BaseModel):
    action: str
    priority: PriorityType
    basis: BasisType
    evidenceRefs: List[str] = Field(default_factory=list)

class EvacuationConsideration(BaseModel):
    consideration: str
    basis: BasisType
    evidenceRefs: List[str] = Field(default_factory=list)

class InfrastructurePriority(BaseModel):
    item: str
    reason: str
    basis: BasisType
    evidenceRefs: List[str] = Field(default_factory=list)

class ResourceRecommendation(BaseModel):
    resource: str
    rationale: str
    basis: BasisType

class UncertaintyInfo(BaseModel):
    level: UncertaintyLevelType
    notes: List[str]

class DataSourcesAndLimitations(BaseModel):
    sourcesUsed: List[str]
    limitations: List[str]

class ResponseMeta(BaseModel):
    model: str
    mode: Literal["live", "mock"]
    generatedAt: str
    inputProvenanceSummary: Dict[str, int]
    cached: bool = False

class EmergencyPlanResponse(BaseModel):
    situationSummary: str
    immediateActions: List[ImmediateAction]
    evacuationConsiderations: List[EvacuationConsideration]
    infrastructurePriorities: List[InfrastructurePriority]
    resourceRecommendations: List[ResourceRecommendation]
    missingInformation: List[str]
    uncertainty: UncertaintyInfo
    dataSourcesAndLimitations: DataSourcesAndLimitations
    meta: ResponseMeta

class HealthResponse(BaseModel):
    status: Literal["healthy"] = "healthy"
    mode: Literal["live", "mock"]
    aiConfigured: bool
    version: str
    time: str
