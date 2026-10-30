"""
Sentinel Earth - FloodScope: Hydrological Susceptibility & AI Planner Configuration
Algorithm Version: 2.4.0-antigravity
"""

import os
from dotenv import load_dotenv

# Load root .env if present
load_dotenv()

ALGORITHM_VERSION = "2.4.0-antigravity"

# Versioned Susceptibility Weights (Sum = 1.0)
WEIGHTS = {
    "hand_elevation": 0.55,    # Height Above Nearest Drainage (Primary terrain control)
    "drainage_proximity": 0.30, # Proximity to Krishna thalweg & canals
    "slope_gradient": 0.15,    # Slope steepness (flat lowlands retain water)
}

# Base HAND (Height Above Nearest Drainage in meters MSL) Thresholds
BASE_HAND_THRESHOLDS = {
    "very_high": 3.0,   # Cells within 3m of channel bed
    "high": 6.5,        # Cells within 6.5m of channel bed
    "moderate": 12.0,   # Intermediate terraces
    "low": 28.0,        # Elevated upland terrain
}

def compute_rainfall_expansion(rainfall_intensity_mm_h: float, total_rainfall_mm: float) -> float:
    """
    Computes an ordinal buffer expansion in meters.
    Bounded between 0.0m (dry/low) and 4.8m (extreme 300mm/h cloudburst).
    """
    rate_factor = min(rainfall_intensity_mm_h / 150.0, 1.0) * 2.4
    volume_factor = min(total_rainfall_mm / 400.0, 1.0) * 2.4
    return round(rate_factor + volume_factor, 2)

DISCLAIMER_NOTICE = (
    "Experimental screening tool. Not an official warning or forecast. "
    "For official information consult IMD and the Andhra Pradesh State Disaster Management Authority. "
    "In an emergency in India, dial 112."
)

# ---------------------------------------------------------------------------
# Nebius AI & Emergency Planner Configuration (Mission 5)
# ---------------------------------------------------------------------------

NEBIUS_API_KEY = os.getenv("NEBIUS_API_KEY", "").strip()
NEBIUS_MODEL = os.getenv("NEBIUS_MODEL", "nvidia/nemotron-4-340b-instruct").strip()
NEBIUS_BASE_URL = os.getenv("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1/").strip()

# AI Mode: "mock" (default) | "live"
AI_MODE = os.getenv("AI_MODE", "mock").strip().lower()

# AI operational limits
AI_TIMEOUT_MS = int(os.getenv("AI_TIMEOUT_MS", "30000"))
AI_MAX_OUTPUT_TOKENS = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "1500"))
AI_DAILY_REQUEST_CAP = int(os.getenv("AI_DAILY_REQUEST_CAP", "50"))

# Server networking
PORT = int(os.getenv("PORT", "8000"))
CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "http://localhost:5173").strip()
