"""
Sentinel Earth - FloodScope: FastAPI Geospatial Analysis & Nebius AI Server
Mission 5: Grounded Emergency Planning Engine & Security Safeguards
"""

import os
import json
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Request, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from backend.models import ScenarioInputs, AnalysisResult, AIResponsePlan
from backend.analysis.orchestrator import execute_analysis, ANALYSIS_CACHE
from backend.analysis.flood_detector import process_satellite_imagery
from backend.analysis.routing import RouteRequest, RouteResponse, compute_route
from backend.ai.planner import generate_ai_response_plan
import backend.config as config
from backend.config import (
    ALGORITHM_VERSION,
    DISCLAIMER_NOTICE,
    CLIENT_ORIGIN,
    AI_MODE,
    NEBIUS_API_KEY,
    NEBIUS_MODEL,
)
from backend.logger import app_logger
from backend.ai.schemas import (
    EmergencyPlanRequest,
    EmergencyPlanResponse,
    HealthResponse,
)
from backend.ai.service import planner_service
from backend.ai.provider import AIProviderError

app = FastAPI(
    title="Sentinel Earth — FloodScope Intelligence Engine",
    description="Transparent flood-susceptibility screening, asset exposure joins, and grounded Nebius AI response planning for Vijayawada, AP.",
    version=ALGORITHM_VERSION,
)

# ---------------------------------------------------------------------------
# Security Middleware: CORS, 100 KB Request Body Limit, Content-Type Validation
# ---------------------------------------------------------------------------

allowed_origins = [
    CLIENT_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MAX_BODY_SIZE = 100 * 1024  # 100 KB body limit

@app.middleware("http")
async def security_and_limit_middleware(request: Request, call_next):
    # Enforce 100 KB body limit and content-type on /api/emergency-plan
    if request.url.path == "/api/emergency-plan" and request.method == "POST":
        content_type = request.headers.get("content-type", "")
        if "application/json" not in content_type:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"code": "INVALID_REQUEST", "message": "Content-Type must be application/json."}},
            )

        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"code": "INVALID_REQUEST", "message": f"Payload exceeds {MAX_BODY_SIZE // 1024} KB limit."}},
            )

        # Inspect actual body stream size
        body = await request.body()
        if len(body) > MAX_BODY_SIZE:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"code": "INVALID_REQUEST", "message": f"Payload exceeds {MAX_BODY_SIZE // 1024} KB limit."}},
            )

    response = await call_next(request)
    return response

# ---------------------------------------------------------------------------
# Standardized Error Envelope Handlers
# ---------------------------------------------------------------------------

@app.exception_handler(AIProviderError)
async def ai_provider_exception_handler(request: Request, exc: AIProviderError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    app_logger.warning(f"Request validation failed: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": {"code": "INVALID_REQUEST", "message": "Invalid request payload format or parameters."}},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = "INVALID_REQUEST" if exc.status_code == 400 else "ERROR"
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": str(exc.detail)}},
    )

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse)
def get_health():
    """
    Engine health check and configuration status.
    Never calls Nebius. Never reveals key presence beyond a boolean.
    """
    mode = config.AI_MODE
    key = config.NEBIUS_API_KEY
    is_configured = bool(key and len(key) >= 6) if mode == "live" else True

    return {
        "status": "healthy",
        "mode": mode,
        "aiConfigured": is_configured,
        "version": ALGORITHM_VERSION,
        "time": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/api/emergency-plan", response_model=EmergencyPlanResponse)
async def create_emergency_plan(
    req: EmergencyPlanRequest,
    request: Request,
    x_simulate_error: Optional[str] = Header(None, alias="X-Simulate-Error"),
):
    """
    Generates a strictly grounded, anti-hallucination crisis contingency response plan
    using Nebius AI (or deterministic test mock).
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    plan = planner_service.generate_plan(
        req=req,
        client_ip=client_ip,
        simulation_mode=x_simulate_error,
    )
    return plan

@app.post("/api/route", response_model=RouteResponse)
def get_disaster_route(req: RouteRequest):
    """
    Calculates driving route between origin and destination with real-time
    spatial intersection analysis against Vijayawada flood hazard polygons.
    """
    try:
        route_data = compute_route(req)
        return route_data
    except Exception as e:
        app_logger.error(f"Routing calculation failure: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route calculation error: {str(e)}"
        )

# ---------------------------------------------------------------------------
# Existing Routes (Missions 3 & 4 compatibility preserved)
# ---------------------------------------------------------------------------

@app.post("/api/analyze", response_model=AnalysisResult)
def analyze_scenario(inputs: ScenarioInputs):
    try:
        result = execute_analysis(inputs)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis calculation error: {str(e)}",
        )

@app.post("/api/response-plan", response_model=AIResponsePlan)
def create_response_plan(analysis: AnalysisResult):
    try:
        plan = generate_ai_response_plan(analysis)
        if analysis.input_hash in ANALYSIS_CACHE:
            ANALYSIS_CACHE[analysis.input_hash].ai_plan = plan
        return plan
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Response Planner error: {str(e)}",
        )

@app.post("/api/detect-flood")
async def detect_flood_from_satellite(
    file: UploadFile = File(...),
    sensor_type: str = Form("optical"),
    min_lon: Optional[float] = Form(None),
    min_lat: Optional[float] = Form(None),
    max_lon: Optional[float] = Form(None),
    max_lat: Optional[float] = Form(None),
    pre_file: Optional[UploadFile] = File(None),
):
    try:
        image_bytes = await file.read()
        pre_bytes = await pre_file.read() if pre_file else None
        
        custom_bbox = None
        if all(coord is not None for coord in [min_lon, min_lat, max_lon, max_lat]):
            custom_bbox = [min_lon, min_lat, max_lon, max_lat]
            
        result = process_satellite_imagery(
            image_bytes=image_bytes,
            filename=file.filename or "uploaded_image.tif",
            sensor_type=sensor_type,
            custom_bbox=custom_bbox,
            pre_event_bytes=pre_bytes,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Satellite analysis failure: {str(e)}",
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
