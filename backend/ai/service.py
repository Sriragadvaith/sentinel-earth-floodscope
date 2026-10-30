"""
Sentinel Earth - FloodScope: AI Planner Orchestration Service
Handles abuse controls, request hashing cache, schema validation with single repair,
and strict server-side anti-hallucination post-validation.
"""

import os
import re
import json
import hashlib
import time
from datetime import datetime, timezone, date
from typing import Dict, Any, Optional, Set, Tuple
from collections import defaultdict
import backend.config as config

from backend.ai.schemas import (
    EmergencyPlanRequest,
    EmergencyPlanResponse,
    ResponseMeta,
    ImmediateAction,
    EvacuationConsideration,
    InfrastructurePriority,
)
from backend.ai.provider import AIProvider, NebiusProvider, MockProvider, AIProviderError
from backend.config import (
    AI_MODE,
    AI_DAILY_REQUEST_CAP,
    NEBIUS_MODEL,
    NEBIUS_API_KEY,
)
from backend.logger import app_logger

# ---------------------------------------------------------------------------
# In-Memory Cache (SHA-256 keyed, 10 min TTL)
# ---------------------------------------------------------------------------
CACHE_TTL_SECONDS = 600
_RESPONSE_CACHE: Dict[str, Tuple[float, EmergencyPlanResponse]] = {}

# ---------------------------------------------------------------------------
# Rate Limiting & Daily Request Counter
# ---------------------------------------------------------------------------
_DAILY_REQUEST_TRACKER = {
    "date": date.today().isoformat(),
    "count": 0,
}
_IP_REQUEST_HISTORY: Dict[str, list] = defaultdict(list)
IP_RATE_LIMIT_PER_MINUTE = 5

PHONE_PATTERN = re.compile(r"(\+?\d{1,4}[-.\s]?)?(\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4,6}")
URL_PATTERN = re.compile(r"(https?://\S+|www\.\S+)")

def check_and_increment_daily_cap():
    """Enforces AI_DAILY_REQUEST_CAP across all requests."""
    today = date.today().isoformat()
    if _DAILY_REQUEST_TRACKER["date"] != today:
        _DAILY_REQUEST_TRACKER["date"] = today
        _DAILY_REQUEST_TRACKER["count"] = 0

    if _DAILY_REQUEST_TRACKER["count"] >= AI_DAILY_REQUEST_CAP:
        app_logger.warning("Daily AI request cap reached")
        raise AIProviderError(
            code="RATE_LIMITED",
            message=f"Daily AI request quota reached ({AI_DAILY_REQUEST_CAP} requests/day). Limit resets at midnight UTC.",
            status_code=429,
        )
    _DAILY_REQUEST_TRACKER["count"] += 1

def check_ip_rate_limit(client_ip: str):
    """Enforces per-IP sliding window rate limit (e.g. 5 req/min)."""
    now = time.time()
    cutoff = now - 60.0
    history = _IP_REQUEST_HISTORY[client_ip]
    # Prune timestamps older than 60s
    _IP_REQUEST_HISTORY[client_ip] = [ts for ts in history if ts > cutoff]
    if len(_IP_REQUEST_HISTORY[client_ip]) >= IP_RATE_LIMIT_PER_MINUTE:
        raise AIProviderError(
            code="RATE_LIMITED",
            message=f"Rate limit exceeded ({IP_RATE_LIMIT_PER_MINUTE} req/min). Please wait before requesting another plan.",
            status_code=429,
        )
    _IP_REQUEST_HISTORY[client_ip].append(now)

def compute_request_hash(req: EmergencyPlanRequest) -> str:
    """Computes a deterministic SHA-256 hash of the normalized request JSON.
    Excludes bypassCache so that the cache key is identical regardless of the flag."""
    raw = req.model_dump_json(exclude_none=True, exclude={"bypassCache"})
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def summarize_provenance(req: EmergencyPlanRequest) -> Dict[str, int]:
    """Tallies data items by provenance tag."""
    tally = defaultdict(int)
    for r in req.affectedRoads:
        tally[r.provenance] += 1
    for inf in req.affectedInfrastructure:
        tally[inf.provenance] += 1
    for s in req.shelters:
        tally[s.provenance] += 1
    for h in req.hospitals:
        tally[h.provenance] += 1
    if req.scenario:
        tally["simulated"] += 1
    if req.operatorNotes:
        tally["user_entered"] += 1
    return dict(tally)

def collect_valid_input_tokens(req: EmergencyPlanRequest) -> Tuple[Set[str], Set[str]]:
    """Gathers known item IDs and names to verify citations and protect against phone/URL hallucinations."""
    valid_ids: Set[str] = {req.location.name.lower()}
    raw_input_text: Set[str] = {req.location.name}

    for item in req.affectedRoads + req.affectedInfrastructure + req.shelters + req.hospitals:
        valid_ids.add(item.id.lower())
        valid_ids.add(item.name.lower())
        raw_input_text.add(item.id)
        raw_input_text.add(item.name)

    if req.operatorNotes:
        raw_input_text.add(req.operatorNotes)

    return valid_ids, raw_input_text

def post_validate_plan(
    plan_dict: Dict[str, Any],
    req: EmergencyPlanRequest,
) -> Dict[str, Any]:
    """
    Server-side post-validation:
    1. Redact phone numbers and URLs not present in the input.
    2. Validate evidenceRefs: downgrade unevidenced claims to 'assumption'.
    3. Ensure missingInformation is populated when assets are absent.
    """
    valid_ids, input_text_corpus = collect_valid_input_tokens(req)
    input_combined = " ".join(input_text_corpus)

    # 1. Redact phone numbers not in input
    def _sanitize_string(val: str) -> str:
        if not isinstance(val, str):
            return val
        # Check phone numbers
        for match in PHONE_PATTERN.finditer(val):
            ph = match.group(0).strip()
            if len(re.sub(r"\D", "", ph)) >= 7 and ph not in input_combined:
                val = val.replace(ph, "[PHONE NUMBER REDACTED]")
        # Check URLs
        for match in URL_PATTERN.finditer(val):
            url = match.group(0).strip()
            if url not in input_combined:
                val = val.replace(url, "[URL REDACTED]")
        return val

    # Recursively sanitize all text in plan_dict
    def _walk_sanitize(obj: Any) -> Any:
        if isinstance(obj, str):
            return _sanitize_string(obj)
        elif isinstance(obj, list):
            return [_walk_sanitize(x) for x in obj]
        elif isinstance(obj, dict):
            return {k: _walk_sanitize(v) for k, v in obj.items()}
        return obj

    plan_dict = _walk_sanitize(plan_dict)

    # 2. Check evidenceRefs and downgrade unevidenced citations
    def _audit_evidence(items: list):
        for item in items:
            if not isinstance(item, dict):
                continue
            refs = item.get("evidenceRefs", [])
            valid_refs = []
            for ref in refs:
                if ref.lower() in valid_ids:
                    valid_refs.append(ref)
                else:
                    # Invalid ref cited
                    item["basis"] = "assumption"
            item["evidenceRefs"] = valid_refs
            # If item claims verified_input but has no valid evidenceRefs, downgrade
            if item.get("basis") == "verified_input" and not valid_refs:
                item["basis"] = "assumption"

    _audit_evidence(plan_dict.get("immediateActions", []))
    _audit_evidence(plan_dict.get("evacuationConsiderations", []))
    _audit_evidence(plan_dict.get("infrastructurePriorities", []))

    # 3. Ensure missingInformation is non-empty whenever hospitals, shelters, or roads are absent
    missing = plan_dict.get("missingInformation", [])
    if not isinstance(missing, list):
        missing = []

    if not req.hospitals and not any("hospital" in m.lower() for m in missing):
        missing.append("Hospital status and emergency bed capacity telemetry are absent.")
    if not req.shelters and not any("shelter" in m.lower() for m in missing):
        missing.append("Designated shelter facility capacity and occupancy data are not provided.")
    if not req.affectedRoads and not any("road" in m.lower() for m in missing):
        missing.append("Real-time road closure vector data is unavailable.")

    if not missing:
        missing.append("Direct Krishna river gauge telemetry is unavailable.")

    plan_dict["missingInformation"] = missing

    # 4. Backfill empty recommendation arrays with general-guidance defaults
    #    so the response is always actionable, even with sparse input.
    if not plan_dict.get("immediateActions"):
        plan_dict["immediateActions"] = [
            {
                "action": "Activate district-level Emergency Operations Centre monitoring and establish communication check-in with NDRF units.",
                "priority": "PRECAUTIONARY",
                "basis": "general_guidance",
                "evidenceRefs": [],
            }
        ]

    if not plan_dict.get("evacuationConsiderations"):
        plan_dict["evacuationConsiderations"] = [
            {
                "consideration": "Identify low-lying wards and settlements below the nearest drainage elevation and pre-position evacuation transport at elevated staging points.",
                "basis": "general_guidance",
                "evidenceRefs": [],
            }
        ]

    if not plan_dict.get("infrastructurePriorities"):
        plan_dict["infrastructurePriorities"] = [
            {
                "item": "Prakasam Barrage & arterial underpasses",
                "reason": "Monitor barrage discharge gate status and inspect arterial road underpasses for drainage blockage during flood conditions.",
                "basis": "general_guidance",
                "evidenceRefs": [],
            }
        ]

    if not plan_dict.get("resourceRecommendations"):
        plan_dict["resourceRecommendations"] = [
            {
                "resource": "High-clearance rescue vehicles and portable dewatering pumps",
                "rationale": "Standard flood-response staging for rapid inundation mitigation and personnel extraction.",
                "basis": "general_guidance",
            }
        ]

    return plan_dict

class EmergencyPlannerService:
    def __init__(self):
        self._provider: Optional[AIProvider] = None

    @property
    def mode(self):
        return config.AI_MODE

    def get_provider(self) -> AIProvider:
        key = os.getenv("NEBIUS_API_KEY") or config.NEBIUS_API_KEY
        if self.mode == "live":
            # Live mode requires explicit key configured
            if not key or len(key) < 6:
                raise AIProviderError(
                    code="AI_NOT_CONFIGURED",
                    message="Nebius AI service is not configured. Missing NEBIUS_API_KEY.",
                    status_code=503,
                )
            if self._provider is None or not isinstance(self._provider, NebiusProvider):
                self._provider = NebiusProvider()
        else:
            if self._provider is None or not isinstance(self._provider, MockProvider):
                self._provider = MockProvider()

        return self._provider

    def generate_plan(
        self,
        req: EmergencyPlanRequest,
        client_ip: str = "127.0.0.1",
        simulation_mode: Optional[str] = None,
    ) -> EmergencyPlanResponse:
        """Full pipeline: caching -> limits -> inference -> repair -> post-validation."""

        # 1. Rate Limiting
        check_ip_rate_limit(client_ip)

        # 2. Check Cache (skip when bypassCache is set)
        req_hash = compute_request_hash(req)
        now = time.time()
        if not req.bypassCache and req_hash in _RESPONSE_CACHE:
            cached_time, cached_plan = _RESPONSE_CACHE[req_hash]
            if now - cached_time < CACHE_TTL_SECONDS:
                app_logger.info(f"Cache hit for request hash {req_hash[:10]}...")
                # Return copy with cached=True
                resp_copy = cached_plan.model_copy(deep=True)
                resp_copy.meta.cached = True
                return resp_copy

        # 3. Daily Cap Check
        check_and_increment_daily_cap()

        # 4. Get Provider & Call Inference
        provider = self.get_provider()
        raw_output = provider.generate_plan(req, simulation_mode=simulation_mode)

        # 5. Clean & Parse JSON
        def _parse(raw: str) -> Dict[str, Any]:
            cleaned = raw.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())

        plan_dict = None
        try:
            plan_dict = _parse(raw_output)
        except Exception as parse_err:
            app_logger.warning(f"Raw model output not valid JSON ({parse_err}). Initiating single repair attempt...")
            repaired_raw = provider.repair_plan(raw_output, str(parse_err))
            try:
                plan_dict = _parse(repaired_raw)
            except Exception as final_err:
                app_logger.error(f"Repaired model output still unparseable: {final_err}")
                raise AIProviderError(
                    code="AI_BAD_OUTPUT",
                    message="AI model produced invalid JSON that could not be repaired.",
                    status_code=502,
                )

        # 6. Post-Validation and Hallucination Redaction
        sanitized_dict = post_validate_plan(plan_dict, req)

        # 7. Construct and Validate Final Pydantic Schema
        provenance_summary = summarize_provenance(req)
        meta_info = ResponseMeta(
            model=NEBIUS_MODEL if self.mode == "live" else "mock-nemotron-4-340b",
            mode="live" if self.mode == "live" else "mock",
            generatedAt=datetime.now(timezone.utc).isoformat(),
            inputProvenanceSummary=provenance_summary,
            cached=False,
        )

        try:
            response_obj = EmergencyPlanResponse(
                situationSummary=sanitized_dict.get("situationSummary", "Operational situation briefing."),
                immediateActions=[ImmediateAction(**a) for a in sanitized_dict.get("immediateActions", [])],
                evacuationConsiderations=[EvacuationConsideration(**c) for c in sanitized_dict.get("evacuationConsiderations", [])],
                infrastructurePriorities=[InfrastructurePriority(**p) for p in sanitized_dict.get("infrastructurePriorities", [])],
                resourceRecommendations=sanitized_dict.get("resourceRecommendations", []),
                missingInformation=sanitized_dict.get("missingInformation", []),
                uncertainty=sanitized_dict.get("uncertainty", {"level": "medium", "notes": ["Advisory model screening."]}),
                dataSourcesAndLimitations=sanitized_dict.get("dataSourcesAndLimitations", {
                    "sourcesUsed": ["Verified baseline"],
                    "limitations": ["Field verification required."],
                }),
                meta=meta_info,
            )
        except Exception as val_err:
            app_logger.error(f"Schema validation error on sanitized plan: {val_err}")
            raise AIProviderError(
                code="AI_BAD_OUTPUT",
                message=f"Model response did not adhere to required emergency plan schema: {val_err}",
                status_code=502,
            )

        # 8. Save to cache
        _RESPONSE_CACHE[req_hash] = (now, response_obj)
        return response_obj

planner_service = EmergencyPlannerService()
