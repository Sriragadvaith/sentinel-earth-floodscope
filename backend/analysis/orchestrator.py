"""
Analysis Orchestrator: Input Validation, Provenance Assembly & Result Caching
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Optional
from backend.models import (
    ScenarioInputs,
    AnalysisResult,
    DataSourceProvenance,
)
from backend.analysis.core import run_deterministic_analysis
from backend.config import ALGORITHM_VERSION

# In-memory cache indexed by input hash for instant reproducible repeats
ANALYSIS_CACHE: Dict[str, AnalysisResult] = {}

DATA_PROVENANCE_METADATA = [
    DataSourceProvenance(
        name="NASA SRTM 30m Digital Elevation Model (v3.0)",
        vintage="2000 (USGS / NASA open data)",
        resolution="30m grid (1 arc-second)",
        license="Public Domain / Open Data",
        evidence_badge="COMPUTED",
    ),
    DataSourceProvenance(
        name="OpenStreetMap Waterway & Canal Network",
        vintage="2024 Verified Baseline",
        resolution="1:5,000 cartographic scale",
        license="ODbL 1.0",
        evidence_badge="OBSERVED",
    ),
    DataSourceProvenance(
        name="OpenStreetMap Transport & Healthcare Infrastructure",
        vintage="2024 Verified Baseline",
        resolution="Facility & highway survey centerlines",
        license="ODbL 1.0",
        evidence_badge="OBSERVED",
    ),
    DataSourceProvenance(
        name="CWC Prakasam Barrage Historic Flood Discharges",
        vintage="Historic Flood Records (2009, 2023)",
        resolution="Gauged peak outflow benchmarks",
        license="Public Records",
        evidence_badge="OBSERVED",
    ),
    DataSourceProvenance(
        name="APSDMA Real-Time Automated River Gauge Telemetry",
        vintage="None configured",
        resolution="N/A",
        license="Government / Proprietary",
        evidence_badge="UNAVAILABLE",
    ),
]

def compute_input_hash(inputs: ScenarioInputs) -> str:
    """
    Computes a deterministic SHA-256 hash from sorted scenario parameters.
    """
    payload = {
        "rainfall_intensity_mm_h": round(inputs.rainfall_intensity_mm_h, 2),
        "rainfall_duration_h": round(inputs.rainfall_duration_h, 2),
        "upstream_discharge_cusecs": round(inputs.upstream_discharge_cusecs or 0.0, 0),
        "algorithm_version": ALGORITHM_VERSION,
    }
    raw = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]

def execute_analysis(inputs: ScenarioInputs) -> AnalysisResult:
    """
    Validates, executes, and caches analysis results.
    """
    input_hash = compute_input_hash(inputs)
    if input_hash in ANALYSIS_CACHE:
        return ANALYSIS_CACHE[input_hash]

    derived_total_rainfall = round(inputs.rainfall_intensity_mm_h * inputs.rainfall_duration_h, 1)

    (
        susceptibility_zones,
        exposed_assets,
        sector_summaries,
        facts_digest,
        limitations,
        missing_data,
    ) = run_deterministic_analysis(inputs)

    result = AnalysisResult(
        analysis_id=f"FS-{input_hash}",
        algorithm_version=ALGORITHM_VERSION,
        input_hash=input_hash,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        inputs=inputs,
        derived_total_rainfall_mm=derived_total_rainfall,
        data_sources=DATA_PROVENANCE_METADATA,
        susceptibility_summary=susceptibility_zones,
        exposed_assets=exposed_assets,
        sector_summaries=sector_summaries,
        facts_digest=facts_digest,
        ai_plan=None,
        limitations=limitations,
        missing_data=missing_data,
        status="complete",
        status_message="Deterministic flood-susceptibility screening calculation complete.",
    )

    ANALYSIS_CACHE[input_hash] = result
    return result
