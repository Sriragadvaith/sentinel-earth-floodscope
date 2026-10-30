#!/usr/bin/env python3
"""
Standalone Smoke-Test Script for Nebius AI Emergency Response Planner.
Sends a single minimal valid request to /api/emergency-plan.

OPERATING SAFETY:
- Requires the explicit '--confirm' flag to execute.
- Never prints or logs API keys or bearer tokens.
- Intended for user execution only after verifying Nebius billing/credits.
"""

import sys
import json
import time
from datetime import datetime, timezone

try:
    import urllib.request
    import urllib.error
except ImportError:
    pass

BACKEND_URL = "http://127.0.0.1:8000/api/emergency-plan"

MINIMAL_PAYLOAD = {
    "location": {
        "name": "Vijayawada Municipal Corporation",
        "lat": 16.5062,
        "lng": 80.648,
        "district": "Krishna District",
    },
    "floodStatus": {
        "detectionStatus": "detected",
        "severity": "moderate",
        "method": "Hydrological Baseline Screening",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "Sentinel Earth Baseline",
    },
    "affectedRoads": [
        {
            "id": "R-1",
            "name": "MG Road",
            "type": "Primary Arterial",
            "status": "Potential Lowland Water Ingress",
            "provenance": "observed",
            "source": "OpenStreetMap",
            "confidence": 0.95,
        }
    ],
    "affectedInfrastructure": [
        {
            "id": "INF-1",
            "name": "Prakasam Barrage Inflow Sector",
            "type": "Hydrological Barrier",
            "status": "Monitored",
            "provenance": "derived",
            "source": "HAND Model",
        }
    ],
    "shelters": [
        {
            "id": "SH-1",
            "name": "Indira Gandhi Stadium Shelter",
            "availability": "Available",
            "capacity": 500,
            "provenance": "simulated",
            "source": "Sample Contingency",
        }
    ],
    "hospitals": [
        {
            "id": "HOSP-1",
            "name": "Old Government General Hospital",
            "availability": "Operational",
            "provenance": "observed",
            "source": "AP Health Dataset",
        }
    ],
    "scenario": {
        "rainfallIntensityMmH": 35.0,
        "durationH": 6,
        "totalRainfallMm": 210.0,
        "provenance": "simulated",
    },
    "operatorNotes": "Smoke test validation pulse.",
}


def main():
    if "--confirm" not in sys.argv:
        print("\n" + "=" * 70)
        print("  [!] LIVE REQUEST CONFIRMATION REQUIRED")
        print("=" * 70)
        print("This script will send a request to the backend /api/emergency-plan.")
        print("If AI_MODE=live, this will consume paid Nebius Token Factory credits.")
        print("\nTo confirm and proceed, re-run with the --confirm flag:")
        print("    npm run smoke:live -- --confirm")
        print("  or")
        print("    python scripts/smoke_test_nebius.py --confirm\n")
        sys.exit(1)

    print("[*] Initiating smoke test to local backend (/api/emergency-plan)...")
    req_data = json.dumps(MINIMAL_PAYLOAD).encode("utf-8")
    req = urllib.request.Request(
        BACKEND_URL,
        data=req_data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "FloodScope-SmokeTest/1.0",
        },
        method="POST",
    )

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            elapsed_sec = time.time() - t0
            status_code = resp.status
            body = resp.read().decode("utf-8")
            data = json.loads(body)

            print("\n" + "=" * 70)
            print("  [OK] NEBIUS EMERGENCY PLANNER SMOKE TEST SUCCESSFUL")
            print("=" * 70)
            print(f"HTTP Status:       {status_code} OK")
            print(f"Wall Clock Time:   {elapsed_sec:.2f}s")

            meta = data.get("meta", {})
            print(f"Engine Mode:       {meta.get('mode', 'unknown')}")
            print(f"Model ID:          {meta.get('model', 'unknown')}")
            print(f"Server Latency:    {meta.get('latencyMs', 'unknown')} ms")
            print(f"Cached Result:     {meta.get('cached', False)}")
            print(f"Grounding Status:  {meta.get('groundingCheck', 'unknown')}")

            actions = data.get("immediateActions", [])
            print(f"Immediate Actions: {len(actions)} actions generated")
            for idx, a in enumerate(actions[:3], start=1):
                print(f"  {idx}. [{a.get('priority')}] ({a.get('basis')}) {a.get('action')}")
            if len(actions) > 3:
                print(f"  ... and {len(actions) - 3} more")

            gaps = data.get("missingInformation", [])
            print(f"Data Gaps Noted:   {len(gaps)} items")
            uncertainty = data.get("uncertainty", {})
            print(f"Uncertainty Level: {uncertainty.get('level', 'unknown').upper()}")
            print("=" * 70 + "\n")
            sys.exit(0)

    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"\n[ERROR] HTTP Error {e.code}: {e.reason}")
        try:
            err_json = json.loads(err_body)
            print(f"Error Code: {err_json.get('error', {}).get('code')}")
            print(f"Message:    {err_json.get('error', {}).get('message')}")
        except Exception:
            print(f"Response:   {err_body[:200]}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"\n[ERROR] Connection Failed: Could not reach {BACKEND_URL}")
        print(f"Reason: {e.reason}")
        print("Ensure the FastAPI backend is running: python -m uvicorn backend.main:app --reload --port 8000")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected Failure: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
