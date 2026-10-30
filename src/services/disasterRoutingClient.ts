/**
 * Sentinel Earth - FloodScope: Typed Disaster Routing Client
 * Communicates with backend /api/route endpoint with client-side geodesic fallback.
 */

import type { RouteState, RouteHazardConflict } from "../types/geo";
import { haversineDistance, evaluateRouteHazards, type LngLat } from "../utils/gisMath";

export interface DisasterRouteRequest {
  origin: [number, number];
  destination: [number, number];
  originName?: string;
  destinationName?: string;
  avoidHazard?: boolean;
}

export interface BackendRouteResponse {
  origin: [number, number];
  destination: [number, number];
  originName: string;
  destinationName: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  provider: string;
  timestamp: string;
  hasConflict: boolean;
  hazardConflicts: RouteHazardConflict[];
}

export async function calculateDisasterRoute(
  req: DisasterRouteRequest,
  signal?: AbortSignal
): Promise<Partial<RouteState>> {
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        origin: req.origin,
        destination: req.destination,
        originName: req.originName || "Selected Incident Point",
        destinationName: req.destinationName || "Destination Facility",
        avoidHazard: req.avoidHazard ?? true,
      }),
      signal,
    });

    if (res.ok) {
      const data: BackendRouteResponse = await res.json();
      return {
        origin: data.origin,
        originName: data.originName,
        destination: data.destination,
        destinationName: data.destinationName,
        coordinates: data.coordinates,
        distanceMeters: data.distanceMeters,
        durationSeconds: data.durationSeconds,
        hazardConflicts: data.hazardConflicts || [],
        isCalculating: false,
        error: null,
      };
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    console.warn("Disaster routing endpoint unreachable, engaging client-side geodesic fallback:", err);
  }

  // Client-side geodesic fallback
  const p1 = req.origin;
  const p2 = req.destination;
  const steps = 25;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    coords.push([p1[0] + f * (p2[0] - p1[0]), p1[1] + f * (p2[1] - p1[1])]);
  }

  const directDist = haversineDistance(p1 as LngLat, p2 as LngLat);
  const roadFactor = 1.35; // Urban circuity factor
  const estimatedDist = Math.round(directDist * roadFactor);
  const avgSpeedMps = 8.33; // 30 km/h in flood conditions
  const estimatedDuration = Math.round(estimatedDist / avgSpeedMps);

  // Check against known Vijayawada flood zones
  const knownHazards = [
    {
      name: "Krishna Lanka Low-Lying Riverfront Ward",
      riskLevel: "CRITICAL",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.642, 16.502],
            [80.665, 16.492],
            [80.685, 16.482],
            [80.678, 16.475],
            [80.655, 16.484],
            [80.638, 16.495],
            [80.642, 16.502],
          ],
        ],
      },
    },
    {
      name: "Ramalingeswara Nagar Flood Fringe",
      riskLevel: "HIGH",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.688, 16.482],
            [80.708, 16.474],
            [80.715, 16.482],
            [80.695, 16.49],
            [80.688, 16.482],
          ],
        ],
      },
    },
  ];

  const hazardEval = evaluateRouteHazards(coords as LngLat[], knownHazards);

  return {
    origin: req.origin,
    originName: req.originName || "Origin",
    destination: req.destination,
    destinationName: req.destinationName || "Destination",
    coordinates: coords,
    distanceMeters: estimatedDist,
    durationSeconds: estimatedDuration,
    hazardConflicts: hazardEval.conflicts,
    isCalculating: false,
    error: null,
  };
}
