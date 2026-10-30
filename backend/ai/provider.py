"""
Sentinel Earth - FloodScope: AI Provider Interface & Implementations
Supports NebiusProvider (Live NVIDIA Nemotron) and MockProvider (Deterministic Fixtures).
"""

import abc
import json
import time
from typing import Dict, Any, Optional
from backend.ai.prompt import SYSTEM_PROMPT, build_user_prompt
from backend.ai.schemas import EmergencyPlanRequest
from backend.config import (
    NEBIUS_API_KEY,
    NEBIUS_MODEL,
    NEBIUS_BASE_URL,
    AI_TIMEOUT_MS,
    AI_MAX_OUTPUT_TOKENS,
)
from backend.logger import app_logger

class AIProviderError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code

class AIProvider(abc.ABC):
    @abc.abstractmethod
    def generate_plan(self, req: EmergencyPlanRequest, simulation_mode: Optional[str] = None) -> str:
        """Generates raw response string from model or mock."""
        pass

    @abc.abstractmethod
    def repair_plan(self, broken_json: str, error_message: str) -> str:
        """Single repair attempt on malformed or schema-violating output."""
        pass

class NebiusProvider(AIProvider):
    """Live provider calling NVIDIA Nemotron on Nebius Token Factory via OpenAI SDK."""

    def __init__(self):
        if not NEBIUS_API_KEY or len(NEBIUS_API_KEY) < 6:
            raise AIProviderError(
                code="AI_NOT_CONFIGURED",
                message="Nebius AI service is not configured. Missing or invalid API key.",
                status_code=503,
            )
        try:
            from openai import OpenAI
            self.client = OpenAI(
                base_url=NEBIUS_BASE_URL,
                api_key=NEBIUS_API_KEY,
                timeout=AI_TIMEOUT_MS / 1000.0,
                max_retries=0,  # Retries on paid API must be deliberate, not automatic
            )
            self.model = NEBIUS_MODEL
        except Exception as e:
            app_logger.error(f"Failed to initialize OpenAI client for Nebius: {e}")
            raise AIProviderError(
                code="AI_NOT_CONFIGURED",
                message="Could not initialize Nebius provider client.",
                status_code=503,
            )

    def generate_plan(self, req: EmergencyPlanRequest, simulation_mode: Optional[str] = None) -> str:
        import openai
        user_prompt = build_user_prompt(req)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=AI_MAX_OUTPUT_TOKENS,
                response_format={"type": "json_object"} if ("nemotron" in self.model.lower() or "llama" in self.model.lower()) else None,
            )
            content = response.choices[0].message.content or "{}"
            return content
        except openai.APITimeoutError as te:
            app_logger.error(f"Nebius API call timed out after {AI_TIMEOUT_MS}ms")
            raise AIProviderError(code="AI_TIMEOUT", message="AI reasoning service timed out. Please retry.", status_code=504)
        except openai.AuthenticationError as ae:
            app_logger.error(f"Nebius authentication failure: {ae}")
            raise AIProviderError(code="AI_UPSTREAM_ERROR", message="Upstream authentication error. Check credentials.", status_code=502)
        except openai.RateLimitError as rle:
            app_logger.error(f"Nebius rate limit exceeded: {rle}")
            raise AIProviderError(code="RATE_LIMITED", message="Upstream Nebius rate limit exceeded. Please retry shortly.", status_code=429)
        except openai.APIError as apie:
            app_logger.error(f"Nebius upstream API error: {apie}")
            raise AIProviderError(code="AI_UPSTREAM_ERROR", message="Upstream inference provider returned an error.", status_code=502)
        except Exception as e:
            app_logger.error(f"Unexpected error communicating with Nebius: {e}")
            raise AIProviderError(code="AI_UPSTREAM_ERROR", message="Failed to communicate with AI provider.", status_code=502)

    def repair_plan(self, broken_json: str, error_message: str) -> str:
        import openai
        repair_prompt = f"""The previous response failed schema validation with error:
{error_message}

Broken Output:
{broken_json[:1500]}

Please output ONLY a valid, corrected JSON object adhering to the schema.
"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": repair_prompt},
                ],
                temperature=0.1,
                max_tokens=AI_MAX_OUTPUT_TOKENS,
                response_format={"type": "json_object"} if ("nemotron" in self.model.lower() or "llama" in self.model.lower()) else None,
            )
            return response.choices[0].message.content or "{}"
        except Exception as e:
            app_logger.error(f"Repair attempt failed: {e}")
            raise AIProviderError(code="AI_BAD_OUTPUT", message="Model output failed validation and could not be repaired.", status_code=502)

class MockProvider(AIProvider):
    """Deterministic, schema-valid mock provider for development and testing without network or credits."""

    def __init__(self, model_name: str = "mock-nemotron-v1"):
        self.model = model_name

    def generate_plan(self, req: EmergencyPlanRequest, simulation_mode: Optional[str] = None) -> str:
        # Check simulation modes for testing error paths
        mode = simulation_mode.lower() if simulation_mode else ""
        if mode == "timeout":
            raise AIProviderError(code="AI_TIMEOUT", message="Simulated request timeout.", status_code=504)
        elif mode == "malformed_json":
            return "{ 'unquoted_key': invalid json syntax ..."
        elif mode == "schema_violation":
            return json.dumps({"incomplete": "missing mandatory schema fields"})
        elif mode == "upstream_401":
            raise AIProviderError(code="AI_UPSTREAM_ERROR", message="Simulated upstream 401 Unauthorized.", status_code=502)
        elif mode == "upstream_429":
            raise AIProviderError(code="RATE_LIMITED", message="Simulated upstream 429 Rate Limit.", status_code=429)
        elif mode == "upstream_500":
            raise AIProviderError(code="AI_UPSTREAM_ERROR", message="Simulated upstream 500 Server Error.", status_code=502)

        # Generate deterministic fixture matching input
        loc_name = req.location.name
        is_simulated = req.scenario is not None or req.floodStatus.detectionStatus == "simulated"

        status_text = (
            f"Simulated flood scenario for {loc_name} with hypothetical rainfall "
            f"({req.scenario.rainfallIntensityMmH if req.scenario else 0} mm/h)."
            if is_simulated
            else f"Observed flood screening for {loc_name} with severity tier: {req.floodStatus.severity.upper()}."
        )

        immediate_actions = []
        if req.affectedRoads:
            road = req.affectedRoads[0]
            immediate_actions.append({
                "action": f"Establish precautionary traffic redirection around {road.name} due to flood proximity.",
                "priority": "URGENT",
                "basis": "verified_input" if road.provenance == "observed" else "simulated_input",
                "evidenceRefs": [road.id],
            })
        else:
            immediate_actions.append({
                "action": "Monitor primary arterial bridges and low-lying underpasses along Krishna thalweg.",
                "priority": "PRECAUTIONARY",
                "basis": "general_guidance",
                "evidenceRefs": [],
            })

        evac_considerations = []
        if req.shelters:
            shelter = req.shelters[0]
            evac_considerations.append({
                "consideration": f"Designate {shelter.name} as primary reception point for evacuated residents.",
                "basis": "verified_input" if shelter.provenance == "observed" else "simulated_input",
                "evidenceRefs": [shelter.id],
            })
        else:
            evac_considerations.append({
                "consideration": "Identify elevated staging shelters outside the immediate riverine contour.",
                "basis": "assumption",
                "evidenceRefs": [],
            })

        infra_priorities = []
        if req.hospitals:
            hosp = req.hospitals[0]
            infra_priorities.append({
                "item": hosp.name,
                "reason": "Ensure uninterrupted utility and ambulance corridor access.",
                "basis": "verified_input" if hosp.provenance == "observed" else "simulated_input",
                "evidenceRefs": [hosp.id],
            })
        elif req.affectedRoads:
            infra_priorities.append({
                "item": req.affectedRoads[0].name,
                "reason": "Vital evacuation corridor requiring barrier placement and drainage clearing.",
                "basis": "verified_input" if req.affectedRoads[0].provenance == "observed" else "simulated_input",
                "evidenceRefs": [req.affectedRoads[0].id],
            })
        else:
            infra_priorities.append({
                "item": "Prakasam Barrage & Flood Regulator",
                "reason": "Critical discharge node monitoring for Krishna river gate management.",
                "basis": "general_guidance",
                "evidenceRefs": [],
            })

        resource_recs = [
            {
                "resource": "High-clearance evacuation rescue vehicles and dewatering pumps",
                "rationale": "Mitigate local inundation and support rapid asset extraction.",
                "basis": "general_guidance",
            }
        ]

        missing_info = []
        if not req.hospitals:
            missing_info.append("Live hospital telemetry and emergency bed availability are not provided.")
        if not req.shelters:
            missing_info.append("Designated shelter capacity and occupancy data are absent.")
        if not req.affectedRoads:
            missing_info.append("Real-time road closure vector status is not reported.")

        # Test phone number injection verification if requested
        if mode == "invented_phone":
            immediate_actions.append({
                "action": "Call emergency coordinator at +91 98765 43210 immediately.",
                "priority": "IMMEDIATE",
                "basis": "assumption",
                "evidenceRefs": [],
            })

        output_dict = {
            "situationSummary": status_text,
            "immediateActions": immediate_actions,
            "evacuationConsiderations": evac_considerations,
            "infrastructurePriorities": infra_priorities,
            "resourceRecommendations": resource_recs,
            "missingInformation": missing_info if missing_info else ["No direct gauge telemetry upstream of barrage."],
            "uncertainty": {
                "level": "low" if not is_simulated else "medium",
                "notes": [
                    "Analysis is based on static elevation and hydrological proximity models.",
                    "Live field verification by APSDMA / NDRF incident command is required.",
                ],
            },
            "dataSourcesAndLimitations": {
                "sourcesUsed": [
                    "OpenStreetMap verified vector baseline",
                    req.floodStatus.method,
                ],
                "limitations": [
                    "Decision support advisory only. Not an official disaster declaration.",
                    "No direct live river stage telemetry available.",
                ],
            },
        }

        return json.dumps(output_dict)

    def repair_plan(self, broken_json: str, error_message: str) -> str:
        # Mock repair succeeds by returning standard valid fixture
        return self.generate_plan(EmergencyPlanRequest(
            location={"name": "Vijayawada Central", "lat": 16.5062, "lng": 80.6480},
            floodStatus={"detectionStatus": "detected", "severity": "moderate", "method": "Repaired Mock Test"},
        ))
