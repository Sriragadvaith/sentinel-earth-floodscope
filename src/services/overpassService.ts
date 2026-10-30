import type { AppFeatureCollection, DataSourceStatus } from "../types/geo";
import { VIJAYAWADA_BASELINE_DATA } from "../data/vijayawadaBaseline";
import { parseOverpassElements, mergeFeatureCollections } from "./geoProcessing";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

// Vijayawada bounding box [minLat, minLon, maxLat, maxLon]
const VIJAYAWADA_BBOX = "16.44,80.56,16.58,80.74";

export const OVERPASS_QUERY = `
  [out:json][timeout:15];
  (
    way["highway"~"^(trunk|primary|secondary|tertiary)$"](${VIJAYAWADA_BBOX});
    nwr["waterway"~"^(river|canal|stream|drain)$"](${VIJAYAWADA_BBOX});
    nwr["natural"="water"](${VIJAYAWADA_BBOX});
    nwr["amenity"="hospital"](${VIJAYAWADA_BBOX});
    nwr["amenity"="clinic"](${VIJAYAWADA_BBOX});
  );
  out geom;
`;

export interface FetchResult {
  data: AppFeatureCollection;
  status: DataSourceStatus;
}

export async function fetchVijayawadaGeodata(
  onProgress?: (msg: string) => void
): Promise<FetchResult> {
  const timestamp = new Date().toLocaleTimeString("en-IN", { hour12: false });

  // Try each mirror with a strict timeout
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    const mirrorName = new URL(endpoint).hostname;
    onProgress?.(`Querying OpenStreetMap via ${mirrorName}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: OVERPASS_QUERY }).toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const rawJson = await response.json();
        const liveFeatures = parseOverpassElements(rawJson.elements);

        if (liveFeatures.length > 0) {
          const merged = mergeFeatureCollections(VIJAYAWADA_BASELINE_DATA, liveFeatures);
          return {
            data: merged,
            status: {
              source: "live-overpass",
              message: `Live OSM data synchronized (${liveFeatures.length} live features parsed via ${mirrorName})`,
              timestamp,
              totalFeatures: merged.features.length,
              httpStatus: response.status,
            },
          };
        }
      }
    } catch {
      clearTimeout(timeoutId);
      // continue to next mirror
    }
  }

  // Graceful fallback to verified baseline with transparent notification
  return {
    data: VIJAYAWADA_BASELINE_DATA,
    status: {
      source: "verified-baseline",
      message: "Using verified Vijayawada baseline dataset (Public OSM Overpass mirrors unreachable/rate-limited)",
      timestamp,
      totalFeatures: VIJAYAWADA_BASELINE_DATA.features.length,
    },
  };
}
