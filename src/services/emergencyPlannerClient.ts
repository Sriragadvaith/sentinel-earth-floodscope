/**
 * Sentinel Earth - FloodScope: Typed Emergency Planner API Client
 * Calls local backend via Vite dev proxy (/api).
 * NEVER calls Nebius or external inference APIs directly from the browser.
 */

import type {
  EmergencyPlanRequest,
  EmergencyPlanResponse,
  HealthCheckResponse,
  ApiErrorEnvelope,
} from "../types/emergencyPlan";

export class EmergencyPlannerApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number = 500) {
    super(message);
    this.name = "EmergencyPlannerApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Checks backend health and AI configuration status without calling Nebius.
 */
export async function checkBackendHealth(signal?: AbortSignal): Promise<HealthCheckResponse> {
  try {
    const res = await fetch("/api/health", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      throw new EmergencyPlannerApiError("HEALTH_CHECK_FAILED", `Backend health returned status ${res.status}`, res.status);
    }

    const data = await res.json();
    return data as HealthCheckResponse;
  } catch (err: unknown) {
    if (err instanceof EmergencyPlannerApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new EmergencyPlannerApiError("BACKEND_UNAVAILABLE", "Could not reach local FloodScope backend server.", 503);
  }
}

/**
 * Generates an emergency plan via the local backend planner service.
 */
export async function requestEmergencyPlan(
  requestPayload: EmergencyPlanRequest,
  signal?: AbortSignal
): Promise<EmergencyPlanResponse> {
  let response: Response;
  try {
    response = await fetch("/api/emergency-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new EmergencyPlannerApiError("NETWORK_ERROR", "Failed to communicate with FloodScope planner service.", 503);
  }

  const rawJson = await response.json().catch(() => null);

  if (!response.ok) {
    const errorEnv = rawJson as ApiErrorEnvelope | null;
    const code = errorEnv?.error?.code || `HTTP_${response.status}`;
    const message = errorEnv?.error?.message || `Request failed with status ${response.status}`;
    throw new EmergencyPlannerApiError(code, message, response.status);
  }

  if (!rawJson || typeof rawJson !== "object") {
    throw new EmergencyPlannerApiError("INVALID_RESPONSE", "Received non-object response from planner backend.", 502);
  }

  const plan = rawJson as EmergencyPlanResponse;

  // Validate critical response fields
  if (!plan.situationSummary || !Array.isArray(plan.immediateActions) || !plan.meta) {
    throw new EmergencyPlannerApiError("INVALID_SCHEMA", "Response missing required emergency plan properties.", 502);
  }

  return plan;
}
