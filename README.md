# Sentinel Earth — FloodScope
### Vijayawada Flood-Intelligence & Grounded Crisis Response Platform

Sentinel Earth — FloodScope is a 3D geospatial intelligence platform and contingency response planning system engineered for Vijayawada, Andhra Pradesh, India. It combines satellite earth-observation analysis, hydrological HAND terrain models, and grounded, anti-hallucination AI contingency planning powered by NVIDIA Nemotron via Nebius Token Factory.

---

## 1. System Architecture

```
                                  [ BROWSER CLIENT ]
                     (React 19 + TypeScript + Vite + MapLibre GL)
                                          │
                                          │ Relative Requests (/api/*)
                                          ▼
                             [ VITE DEV / REVERSE PROXY ]
                                  (Port 5173 -> 8000)
                                          │
                                          │ Strictly Local Forwarding
                                          ▼
                        [ FASTAPI BACKEND SERVER (Python 3.13) ]
                     ┌─────────────────────────────────────────┐
                     │ • Security Middleware (100KB, Redaction)│
                     │ • IP Sliding Rate Limiter (5 req/min)   │
                     │ • Daily Cap Enforcement (50 req/day)    │
                     │ • SHA-256 In-Memory Cache (10 min TTL)  │
                     │ • Anti-Hallucination Prompt Grounding   │
                     │ • Server-Side Schema & PII Post-Validator│
                     └────────────────────┬────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
         [ AI_MODE == "mock" ]                       [ AI_MODE == "live" ]
                    │                                           │
                    ▼                                           ▼
          [ MockProvider ]                        [ NebiusProvider ]
  (Deterministic, Schema-Valid             (NVIDIA Nemotron LLM via
   Local Fixtures — Zero Cost)              Nebius Token Factory API)
                                            https://api.tokenfactory.nebius.com/v1/
                                            (Server-Side Bearer Token Auth)
```

---

## 2. Windows / PowerShell Setup & Quickstart

### Prerequisites
- **Node.js**: v18+ (tested on Node v20/v24)
- **Python**: v3.11+ (tested on Python 3.13)
- **PowerShell**: Windows PowerShell or PowerShell 7

### 1. Backend Setup & Startup
Navigate to the project root and activate or create your Python virtual environment:

```powershell
# In PowerShell (Project Root: C:\Users\ASUS\frontend)
# Install dependencies
python -m pip install fastapi uvicorn pydantic python-dotenv pytest httpx openai

# Configure environment (defaults to safe mock mode)
Copy-Item .env.example .env

# Start the FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**Expected Log Output:**
```
INFO:     Started server process [PID]
INFO:     Waiting for application startup.
INFO:     [STARTUP] Nebius AI Service Initialized - Mode: mock, Model: nvidia/nemotron-4-340b-instruct
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### 2. Frontend Development Server
In a separate PowerShell terminal:

```powershell
# Install frontend dependencies
npm install

# Start Vite dev server with proxy enabled
npm run dev
```

Open `http://localhost:5173` in your browser. All `/api` requests are proxied directly to `http://127.0.0.1:8000`.

---

## 3. Switching Between Mock Mode and Live Mode

The system defaults to **`AI_MODE=mock`** to prevent accidental token usage or billing charges during development and evaluation.

### Mock Mode (Default — 100% Free, Zero Live Calls)
In `.env`:
```ini
AI_MODE=mock
```
- Returns deterministic, schema-compliant response plans.
- Simulates realistic operational priorities without calling external APIs.
- Fully supports all unit tests and offline workflows.

### Live Mode (Requires Active Nebius Token Factory Account)
In `.env`:
```ini
AI_MODE=live
NEBIUS_API_KEY=your-actual-nebius-token-here
NEBIUS_MODEL=nvidia/nemotron-4-340b-instruct
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
```
Restart the backend service. If the server starts with `AI_MODE=live` but missing credentials, it starts in safe fallback mode (`aiConfigured: false`) without crashing.

---

## 4. How to Find the Correct Nebius Model ID

1. Log into your **Nebius Token Factory** console at [https://tokenfactory.nebius.com](https://tokenfactory.nebius.com).
2. Navigate to **Models** in the left navigation sidebar.
3. Select or search for the **NVIDIA Nemotron** model (e.g. `nvidia/nemotron-4-340b-instruct` or latest Nemotron checkpoint).
4. Copy the exact **Model Identifier** string into `NEBIUS_MODEL` in your `.env` file.
5. Create an API Key in the **API Keys** section and copy it to `NEBIUS_API_KEY` in `.env`.

---

## 5. Security & Grounding Hardening

- **Zero Client-Side Secrets:** No API keys, Authorization headers, or `tokenfactory.nebius.com` endpoints exist in frontend code or compiled bundles (`dist/`).
- **Automated Bundle Scans:** Run `npm run check:secrets` to scan production bundles for prohibited tokens or secrets.
- **Strict Reverse Proxy:** Frontend issues relative `/api/emergency-plan` requests; all upstream AI communications happen strictly server-side.
- **Redacting Logger:** Backend filters mask any API keys or bearer tokens using regex scrubbing before logging.
- **Abuse & Cost Controls:**
  - Max payload cap: 100 KB
  - Rate Limiting: 5 requests per minute per IP address
  - Daily Budget Cap: Configurable requests per day (`AI_DAILY_REQUEST_CAP=50`)
  - Response Caching: 10-minute TTL based on SHA-256 payload digest.
- **Anti-Hallucination Guardrails:**
  - Strict Pydantic models with `extra="forbid"`.
  - Every operational action requires an explicit basis tag (`verified_input`, `simulated_input`, `assumption`, or `general_guidance`) and valid evidence references.
  - Automatic redaction of phone numbers, emails, and external URLs to prevent fabricated emergency hotlines.
  - Explicit missing data / sensor gap disclosure.

---

## 6. Testing & Verification

### Run Backend Pytest Suite (17 Tests)
```powershell
python -m pytest backend/tests -v
```
All tests verify schemas, deterministic fixtures, rate limiters, caching, failure modes, prompt injection resilience, and redaction.

### Secret Hygiene Verification
```powershell
npm run check:secrets
```

### Live Smoke Test Script
To perform a controlled, single-request live test with your configured Nebius credentials:
```powershell
# Note: Requires explicit --confirm flag to execute
npm run smoke:live -- --confirm
```
*(Running without `--confirm` safely aborts with an instruction prompt).*

---

## 7. Operational Disclaimer & AI Limitations

> [!WARNING]
> **DECISION SUPPORT SYSTEM ONLY — NOT AN OFFICIAL EVACUATION DIRECTIVE**
>
> 1. Plans generated by Sentinel Earth — FloodScope are automated decision-support syntheses based on SRTM 30m terrain proxies, hydrological scenario simulations, and OpenStreetMap vector features.
> 2. Satellite candidate masks indicate surface water detection, which requires field ground-truthing.
> 3. FloodScope does NOT replace the Andhra Pradesh State Disaster Management Authority (APSDMA), National Disaster Response Force (NDRF), or Central Water Commission (CWC).
> 4. In an actual flood emergency in India, always follow official directives broadcast by municipal disaster control centers or dial **112**.
