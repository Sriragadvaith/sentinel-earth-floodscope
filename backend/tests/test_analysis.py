"""
Automated Geospatial & Truthfulness Verification Tests
"""

import pytest
from backend.models import ScenarioInputs, AnalysisResult
from backend.config import compute_rainfall_expansion
from backend.analysis.core import classify_cell, run_deterministic_analysis
from backend.analysis.orchestrator import execute_analysis, compute_input_hash
from backend.ai.planner import verify_grounding

def test_monotonicity_increasing_rainfall():
    """
    Critical Truthfulness Rule: Higher rainfall must expand susceptibility envelopes.
    Increasing rainfall intensity must NEVER lower any cell's susceptibility class.
    """
    hand_val = 5.2 # Intermediate terrace
    dist_drain = 120.0

    exp_low = compute_rainfall_expansion(rainfall_intensity_mm_h=10.0, total_rainfall_mm=60.0)
    exp_med = compute_rainfall_expansion(rainfall_intensity_mm_h=50.0, total_rainfall_mm=200.0)
    exp_extreme = compute_rainfall_expansion(rainfall_intensity_mm_h=180.0, total_rainfall_mm=720.0)

    assert exp_low <= exp_med <= exp_extreme

    class_low = classify_cell(hand_val, dist_drain, exp_low)
    class_med = classify_cell(hand_val, dist_drain, exp_med)
    class_extreme = classify_cell(hand_val, dist_drain, exp_extreme)

    rank = {"low": 1, "moderate": 2, "high": 3, "very_high": 4}
    assert rank[class_low] <= rank[class_med] <= rank[class_extreme]

def test_reproducibility_same_input_same_hash():
    """
    Reproducibility Contract: Identical scenario inputs must yield identical SHA-256 hashes
    and identical deterministic exposure numbers.
    """
    inp1 = ScenarioInputs(rainfall_intensity_mm_h=75.0, rainfall_duration_h=12.0, upstream_discharge_cusecs=450000.0)
    inp2 = ScenarioInputs(rainfall_intensity_mm_h=75.0, rainfall_duration_h=12.0, upstream_discharge_cusecs=450000.0)

    hash1 = compute_input_hash(inp1)
    hash2 = compute_input_hash(inp2)
    assert hash1 == hash2

    res1 = execute_analysis(inp1)
    res2 = execute_analysis(inp2)
    assert res1.analysis_id == res2.analysis_id
    assert res1.derived_total_rainfall_mm == 900.0
    assert len(res1.exposed_assets) == len(res2.exposed_assets)

def test_input_validation_bounds():
    """
    Validates that inputs enforce physical bounds (e.g. 1 to 300 mm/h).
    """
    with pytest.raises(Exception):
        ScenarioInputs(rainfall_intensity_mm_h=-10.0, rainfall_duration_h=12.0)

    with pytest.raises(Exception):
        ScenarioInputs(rainfall_intensity_mm_h=500.0, rainfall_duration_h=12.0)

def test_hospital_exposure_joins():
    """
    Verifies that hospital exposure spatial joins assign valid distance and classification.
    """
    inp = ScenarioInputs(rainfall_intensity_mm_h=110.0, rainfall_duration_h=24.0, upstream_discharge_cusecs=1110000.0)
    result = execute_analysis(inp)

    hospitals = [a for a in result.exposed_assets if a.category == "hospital"]
    assert len(hospitals) == 10

    # Manipal Hospital is in Krishna Lanka riverfront (S-03)
    manipal = next(h for h in hospitals if "Manipal" in h.name)
    assert manipal.sector_code == "S-03"
    assert manipal.susceptibility_class in ["high", "very_high"]
    assert manipal.distance_to_drainage_m == 310.0

def test_grounding_verification_flags_unsupported_facts():
    """
    Verifies that backend grounding checker catches hallucinations or unsupported Fact IDs.
    """
    valid_facts = {"F1", "F2", "F3", "F4", "F5"}
    corpus = "Rainfall is 900mm. 10 hospitals mapped. Manipal Hospital 350 beds."

    valid_plan = {
        "key_findings": [
            {"title": "Rainfall Peak", "description": "Rainfall total is 900mm.", "fact_ids": ["F1", "F3"]}
        ],
        "precautionary_actions": [
            {"action": "Check Manipal Hospital access", "fact_ids": ["F4", "F5"]}
        ]
    }
    is_grounded, unverified, count = verify_grounding(valid_plan, valid_facts, corpus)
    assert is_grounded is True
    assert len(unverified) == 0

    # Tampered plan with hallucinated fact ID F99
    tampered_plan = {
        "key_findings": [
            {"title": "Unsubstantiated Claim", "description": "Fake evacuation.", "fact_ids": ["F99"]}
        ]
    }
    is_grounded2, unverified2, _ = verify_grounding(tampered_plan, valid_facts, corpus)
    assert is_grounded2 is False
    assert any("F99" in u for u in unverified2)

def test_disaster_routing_hazard_intersection():
    """
    Validates disaster routing calculation and spatial hazard intersection.
    Routes passing near Krishna Lanka flood zone must trigger conflict warnings.
    """
    from backend.analysis.routing import RouteRequest, compute_route

    # Origin at Vijayawada center, destination in Krishna Lanka lowlands
    req = RouteRequest(
        origin=[80.648, 16.506],
        destination=[80.642, 16.502],
        originName="Vijayawada Municipal HQ",
        destinationName="Krishna Lanka Flood Ward"
    )
    result = compute_route(req)

    assert result["distanceMeters"] > 0
    assert result["durationSeconds"] > 0
    assert len(result["coordinates"]) >= 2
    assert "OSRM" in result["provider"] or "Geodesic" in result["provider"]
    assert result["hasConflict"] is True
    assert len(result["conflicts"]) >= 1
    assert any("Krishna Lanka" in c["hazardName"] for c in result["conflicts"])

