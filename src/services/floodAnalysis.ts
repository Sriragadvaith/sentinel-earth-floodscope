/**
 * FloodScope Intelligence Engine — Deterministic Flood-Susceptibility Analysis
 *
 * Computes terrain-based susceptibility classes, infrastructure exposure joins,
 * and sector-level aggregations from scenario inputs and existing geodata.
 *
 * METHODOLOGY:
 * 1. HAND-proxy: Height Above Nearest Drainage approximated from baseline
 *    elevation metadata and distance to Krishna River / canal features.
 * 2. Rainfall-intensity sensitivity: Monotonic ordinal shift that expands
 *    susceptibility bands as scenario rainfall increases.
 * 3. Exposure join: Spatial intersection of hospitals, roads, and bridges
 *    against susceptibility zones.
 * 4. Sector aggregation: Per-sector summaries of exposed assets and area.
 *
 * Every output carries an EvidenceBadge per the Truthfulness Contract.
 */

import type { AppFeatureCollection, AppGeoFeature } from "../types/geo";
import type {
  AnalysisResult,
  ScenarioInputs,
  SusceptibilityZoneSummary,
  ExposedAsset,
  SectorExposureSummary,
  FactItem,
  DataSourceProvenance,
  SusceptibilityClass,
} from "../types/analysis";
import type { FloodScenario } from "../types/scenario";
import { VIJAYAWADA_TACTICAL_SECTORS } from "../types/sector";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Vijayawada urban basin total area (km²) */
const BASIN_AREA_KM2 = 37.86;

/** Krishna River thalweg reference coordinates for distance computation */
const KRISHNA_THALWEG: [number, number][] = [
  [80.565, 16.528],
  [80.59, 16.522],
  [80.615, 16.515],
  [80.635, 16.509],
  [80.6432, 16.5042],
  [80.66, 16.495],
  [80.68, 16.485],
  [80.705, 16.475],
  [80.73, 16.465],
];

/** Canal network approximate centrelines */
const CANAL_LINES: [number, number][][] = [
  // Eluru Canal
  [
    [80.618, 16.525],
    [80.625, 16.54],
    [80.638, 16.555],
    [80.65, 16.565],
  ],
  // Ryves Canal
  [
    [80.643, 16.504],
    [80.652, 16.51],
    [80.66, 16.52],
    [80.668, 16.525],
  ],
  // Bandar Canal
  [
    [80.643, 16.504],
    [80.655, 16.498],
    [80.67, 16.49],
    [80.685, 16.485],
  ],
];

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Haversine distance in meters between two [lon, lat] points */
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const sin2 = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

/** Minimum distance from a point to a polyline (meters) */
function distToPolyline(pt: [number, number], line: [number, number][]): number {
  let minD = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = distToSegment(pt, line[i], line[i + 1]);
    if (d < minD) minD = d;
  }
  return minD;
}

/** Approximate point-to-segment distance */
function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const ab = haversineM(a, b);
  if (ab < 1) return haversineM(p, a);
  const ap = haversineM(a, p);
  const bp = haversineM(b, p);
  // project
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
  const proj: [number, number] = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return Math.min(haversineM(p, proj), ap, bp);
}

/** Minimum distance from a point to the drainage network (Krishna + canals) */
function distanceToDrainage(pt: [number, number]): number {
  let minD = distToPolyline(pt, KRISHNA_THALWEG);
  for (const canal of CANAL_LINES) {
    const d = distToPolyline(pt, canal);
    if (d < minD) minD = d;
  }
  return minD;
}

/** Get centroid of a feature */
function featureCentroid(f: AppGeoFeature): [number, number] {
  const g = f.geometry;
  if (g.type === "Point") return g.coordinates as [number, number];
  if (g.type === "LineString") {
    const coords = g.coordinates;
    const mid = coords[Math.floor(coords.length / 2)];
    return [mid[0], mid[1]];
  }
  if (g.type === "Polygon") {
    const ring = g.coordinates[0];
    let sx = 0, sy = 0;
    for (const c of ring) { sx += c[0]; sy += c[1]; }
    return [sx / ring.length, sy / ring.length];
  }
  if (g.type === "MultiPolygon") {
    const ring = g.coordinates[0][0];
    let sx = 0, sy = 0;
    for (const c of ring) { sx += c[0]; sy += c[1]; }
    return [sx / ring.length, sy / ring.length];
  }
  if (g.type === "MultiLineString") {
    const coords = g.coordinates[0];
    const mid = coords[Math.floor(coords.length / 2)];
    return [mid[0], mid[1]];
  }
  return [80.648, 16.506];
}

/** Approximate LineString length in km */
function lineStringLengthKm(coords: number[][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineM([coords[i][0], coords[i][1]], [coords[i + 1][0], coords[i + 1][1]]);
  }
  return total / 1000;
}

// ---------------------------------------------------------------------------
// Susceptibility classification
// ---------------------------------------------------------------------------

interface ClassThresholds {
  veryHigh: number; // distance < this → very_high
  high: number;
  moderate: number;
  // above moderate → low
}

/**
 * Compute distance-to-drainage thresholds that shift with rainfall intensity.
 * Higher rainfall → wider susceptibility bands (more area classified higher).
 */
function computeThresholds(rainfallMmH: number, durationH: number): ClassThresholds {
  const totalMm = rainfallMmH * durationH;

  // Base thresholds (metres from drainage)
  let veryHigh = 300;
  let high = 800;
  let moderate = 1800;

  // Rainfall sensitivity expansion
  if (totalMm > 500) {
    veryHigh = 600;
    high = 1400;
    moderate = 3000;
  } else if (totalMm > 200) {
    veryHigh = 450;
    high = 1100;
    moderate = 2400;
  } else if (totalMm > 80) {
    veryHigh = 380;
    high = 950;
    moderate = 2100;
  }

  // Intensity boost
  if (rainfallMmH > 100) {
    veryHigh *= 1.3;
    high *= 1.2;
    moderate *= 1.15;
  } else if (rainfallMmH > 60) {
    veryHigh *= 1.15;
    high *= 1.1;
    moderate *= 1.05;
  }

  return { veryHigh, high, moderate };
}

function classifyPoint(distM: number, elevM: number | undefined, thresholds: ClassThresholds): SusceptibilityClass {
  // Elevation bonus: higher ground reduces susceptibility
  let effectiveDist = distM;
  if (elevM !== undefined) {
    // Krishna river bed ≈ 18m MSL. Each metre above adds effective distance
    const elevAboveRiver = Math.max(0, elevM - 18);
    effectiveDist += elevAboveRiver * 50; // 50m effective distance per metre elevation
  }

  if (effectiveDist < thresholds.veryHigh) return "very_high";
  if (effectiveDist < thresholds.high) return "high";
  if (effectiveDist < thresholds.moderate) return "moderate";
  return "low";
}

// ---------------------------------------------------------------------------
// Sector assignment
// ---------------------------------------------------------------------------

function assignSector(pt: [number, number]): string {
  let bestSector = "S-01";
  let bestDist = Infinity;
  for (const sector of VIJAYAWADA_TACTICAL_SECTORS) {
    const d = haversineM(pt, sector.centroid);
    if (d < bestDist) {
      bestDist = d;
      bestSector = sector.code;
    }
  }
  return bestSector;
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

export function runFloodSusceptibilityAnalysis(
  scenario: FloodScenario,
  geoData: AppFeatureCollection,
): AnalysisResult {
  const startTime = performance.now();

  const inputs: ScenarioInputs = {
    rainfallIntensityMmH: scenario.rainfallRateMmH,
    rainfallDurationH: scenario.durationHours,
    derivedTotalRainfallMm: scenario.rainfallRateMmH * scenario.durationHours,
    upstreamDischargeCusecs: scenario.upstreamDischargeCusecs,
    riverStageFt: scenario.barrageWaterLevelFt,
  };

  const thresholds = computeThresholds(inputs.rainfallIntensityMmH, inputs.rainfallDurationH);

  // ----- Classify each feature -----
  const exposedAssets: ExposedAsset[] = [];
  const sectorAccum: Record<string, {
    highArea: number;
    totalExposedHospitals: number;
    exposedRoadsKm: number;
  }> = {};

  // Initialize sector accumulators
  for (const s of VIJAYAWADA_TACTICAL_SECTORS) {
    sectorAccum[s.code] = { highArea: 0, totalExposedHospitals: 0, exposedRoadsKm: 0 };
  }

  // Zone area tracking (approximate based on classified features)
  const zoneCounts = { low: 0, moderate: 0, high: 0, very_high: 0 };

  for (const feature of geoData.features) {
    const cat = feature.properties.category;
    if (!cat) continue;

    const centroid = featureCentroid(feature);
    const distM = distanceToDrainage(centroid);
    const elevM = typeof feature.properties.elevationApproxM === "number" ? feature.properties.elevationApproxM : undefined;
    const riskClass = classifyPoint(distM, elevM, thresholds);
    const sector = assignSector(centroid);

    zoneCounts[riskClass]++;

    if (cat === "hospitals") {
      const distToHighZone = Math.max(0, distM - thresholds.high);
      const exposureStatus =
        riskClass === "very_high" || riskClass === "high"
          ? "Potentially Exposed"
          : riskClass === "moderate"
          ? "Monitored Buffer"
          : "Low Susceptibility";

      exposedAssets.push({
        id: String(feature.properties.id || `hospital-${exposedAssets.length}`),
        name: feature.properties.name || "Healthcare Facility",
        category: "hospital",
        type: feature.properties.type || "Hospital",
        susceptibilityClass: riskClass,
        distanceToDrainageM: Math.round(distM),
        distanceToHighZoneM: Math.round(distToHighZone),
        sectorCode: sector,
        beds: typeof feature.properties.beds === "number"
          ? feature.properties.beds
          : typeof feature.properties.beds === "string"
          ? parseInt(feature.properties.beds) || undefined
          : undefined,
        evidenceBadge: "COMPUTED",
        exposureStatus,
        provenance: "SRTM-30m DEM proxy + OSM drainage network",
      });

      if (riskClass === "very_high" || riskClass === "high") {
        if (sectorAccum[sector]) sectorAccum[sector].totalExposedHospitals++;
      }
    }

    if (cat === "roads") {
      const geom = feature.geometry;
      let lengthKm = 0;
      if (geom.type === "LineString") {
        lengthKm = lineStringLengthKm(geom.coordinates);
      } else if (geom.type === "MultiLineString") {
        for (const line of geom.coordinates) {
          lengthKm += lineStringLengthKm(line);
        }
      }

      const exposureStatus =
        riskClass === "very_high" || riskClass === "high"
          ? "Potentially Exposed"
          : riskClass === "moderate"
          ? "Monitored Buffer"
          : "Low Susceptibility";

      // Determine if it's a bridge
      const isBridge = !!(feature.properties.name && /bridge|varadhi|barrage/i.test(feature.properties.name));

      exposedAssets.push({
        id: String(feature.properties.id || `road-${exposedAssets.length}`),
        name: feature.properties.name || "Road Segment",
        category: isBridge ? "bridge" : "road",
        type: feature.properties.highway || "road",
        susceptibilityClass: riskClass,
        distanceToDrainageM: Math.round(distM),
        distanceToHighZoneM: Math.max(0, Math.round(distM - thresholds.high)),
        sectorCode: sector,
        lengthKm: Number(lengthKm.toFixed(2)),
        evidenceBadge: "COMPUTED",
        exposureStatus,
        provenance: "SRTM-30m DEM proxy + OSM road network",
      });

      if ((riskClass === "very_high" || riskClass === "high") && sectorAccum[sector]) {
        sectorAccum[sector].exposedRoadsKm += lengthKm;
      }
    }

    if (cat === "floodZones") {
      exposedAssets.push({
        id: String(feature.properties.id || `zone-${exposedAssets.length}`),
        name: feature.properties.name || "Flood Zone",
        category: "floodZone",
        type: "Vulnerable Sector",
        susceptibilityClass: riskClass,
        distanceToDrainageM: Math.round(distM),
        distanceToHighZoneM: 0,
        sectorCode: sector,
        evidenceBadge: "COMPUTED",
        exposureStatus: "Potentially Exposed",
        provenance: "Historical flood extent + SRTM-30m DEM proxy",
      });
    }
  }

  // ----- Susceptibility zone summaries -----
  const totalClassified = Object.values(zoneCounts).reduce((a, b) => a + b, 0);

  const susceptibilitySummary: SusceptibilityZoneSummary[] = [
    {
      riskClass: "very_high",
      label: "Very High Susceptibility",
      color: "#dc2626",
      pattern: "cross-hatch",
      areaKm2: Number(((zoneCounts.very_high / (totalClassified || 1)) * BASIN_AREA_KM2).toFixed(2)),
      percentage: Number(((zoneCounts.very_high / (totalClassified || 1)) * 100).toFixed(1)),
    },
    {
      riskClass: "high",
      label: "High Susceptibility",
      color: "#f97316",
      pattern: "diagonal",
      areaKm2: Number(((zoneCounts.high / (totalClassified || 1)) * BASIN_AREA_KM2).toFixed(2)),
      percentage: Number(((zoneCounts.high / (totalClassified || 1)) * 100).toFixed(1)),
    },
    {
      riskClass: "moderate",
      label: "Moderate Susceptibility",
      color: "#f2b735",
      pattern: "dots",
      areaKm2: Number(((zoneCounts.moderate / (totalClassified || 1)) * BASIN_AREA_KM2).toFixed(2)),
      percentage: Number(((zoneCounts.moderate / (totalClassified || 1)) * 100).toFixed(1)),
    },
    {
      riskClass: "low",
      label: "Low Susceptibility",
      color: "#22c55e",
      pattern: "none",
      areaKm2: Number(((zoneCounts.low / (totalClassified || 1)) * BASIN_AREA_KM2).toFixed(2)),
      percentage: Number(((zoneCounts.low / (totalClassified || 1)) * 100).toFixed(1)),
    },
  ];

  // ----- Sector summaries -----
  const sectorSummaries: SectorExposureSummary[] = VIJAYAWADA_TACTICAL_SECTORS.map((s) => {
    const acc = sectorAccum[s.code] || { highArea: 0, totalExposedHospitals: 0, exposedRoadsKm: 0 };
    const assetsInSector = exposedAssets.filter((a) => a.sectorCode === s.code);
    const highRiskAssets = assetsInSector.filter(
      (a) => a.susceptibilityClass === "very_high" || a.susceptibilityClass === "high"
    );
    const percentHigh = assetsInSector.length > 0 ? (highRiskAssets.length / assetsInSector.length) * 100 : 0;

    return {
      sectorCode: s.code,
      sectorName: s.name,
      totalAreaKm2: s.areaKm2,
      highRiskAreaKm2: Number((s.areaKm2 * (percentHigh / 100)).toFixed(2)),
      percentageHighRisk: Number(percentHigh.toFixed(1)),
      exposedHospitalsCount: acc.totalExposedHospitals,
      exposedRoadsKm: Number(acc.exposedRoadsKm.toFixed(2)),
      evidenceBadge: "COMPUTED",
    };
  });

  // ----- Facts digest -----
  const totalExposedHospitals = exposedAssets.filter(
    (a) => a.category === "hospital" && (a.susceptibilityClass === "very_high" || a.susceptibilityClass === "high")
  ).length;
  const totalExposedRoadsKm = exposedAssets
    .filter((a) => (a.category === "road" || a.category === "bridge") && (a.susceptibilityClass === "very_high" || a.susceptibilityClass === "high"))
    .reduce((sum, a) => sum + (a.lengthKm || 0), 0);
  const criticalSectors = sectorSummaries.filter((s) => s.percentageHighRisk > 40);

  const factsDigest: FactItem[] = [
    {
      id: "F1",
      topic: "Rainfall",
      statement: `Hypothetical scenario: ${inputs.rainfallIntensityMmH} mm/h × ${inputs.rainfallDurationH}h = ${inputs.derivedTotalRainfallMm} mm total precipitation.`,
      metricValue: `${inputs.derivedTotalRainfallMm} mm`,
      evidenceBadge: "COMPUTED",
      source: "User-entered scenario parameters",
    },
    {
      id: "F2",
      topic: "Discharge",
      statement: `Hypothetical upstream discharge: ${(inputs.upstreamDischargeCusecs || 0).toLocaleString()} cusecs at Prakasam Barrage.`,
      metricValue: `${((inputs.upstreamDischargeCusecs || 0) / 1000).toFixed(0)}k cusecs`,
      evidenceBadge: "COMPUTED",
      source: "User-entered scenario parameters",
    },
    {
      id: "F3",
      topic: "Healthcare",
      statement: `${totalExposedHospitals} healthcare facility(s) in High or Very High susceptibility zones under this scenario.`,
      metricValue: totalExposedHospitals,
      evidenceBadge: "COMPUTED",
      source: "Drainage proximity analysis × OSM hospital locations",
    },
    {
      id: "F4",
      topic: "Arterials",
      statement: `${totalExposedRoadsKm.toFixed(1)} km of evacuation arterials in High/Very High susceptibility zones.`,
      metricValue: `${totalExposedRoadsKm.toFixed(1)} km`,
      evidenceBadge: "COMPUTED",
      source: "Drainage proximity analysis × OSM road network",
    },
    {
      id: "F5",
      topic: "Sectors",
      statement: `${criticalSectors.length} tactical sector(s) have >40% assets in elevated susceptibility classes.`,
      metricValue: criticalSectors.length,
      evidenceBadge: "COMPUTED",
      source: "Sector aggregation of exposure analysis results",
    },
    {
      id: "F6",
      topic: "Terrain",
      statement: `Susceptibility derived from SRTM 30m DEM proxy and drainage proximity (HAND approximation). Not hydrodynamic simulation.`,
      evidenceBadge: "ESTIMATED",
      source: "Methodology disclosure",
    },
  ];

  // ----- Data source provenance -----
  const dataSources: DataSourceProvenance[] = [
    {
      name: "SRTM 30m Digital Elevation Model",
      vintage: "NASA SRTM v3.0",
      resolution: "30m (1 arc-sec)",
      license: "Public Domain",
      evidenceBadge: "COMPUTED",
    },
    {
      name: "OpenStreetMap Waterways & Infrastructure",
      vintage: "2024 snapshot",
      resolution: "1:5,000 equivalent",
      license: "ODbL 1.0",
      evidenceBadge: "OBSERVED",
    },
    {
      name: "Vijayawada Tactical Sectors (S-01 to S-06)",
      vintage: "2024 geo-calibrated",
      resolution: "Sub-ward scale",
      license: "Open Data",
      evidenceBadge: "COMPUTED",
    },
  ];

  // ----- Limitations -----
  const limitations = [
    "Susceptibility is based on drainage proximity and approximate elevation, not hydrodynamic 2D flood modeling.",
    "SRTM 30m vertical accuracy (±5m) limits micro-drainage mapping in flat urban terrain.",
    "Channel bathymetry, culvert capacity, and pump-station operations are not modeled.",
    "Building plinth elevations and underground infrastructure not accounted for.",
    "Results represent flood susceptibility (terrain disposition), not predicted inundation depth.",
  ];

  const missingData = [
    "Live CWC / APSDMA river gauge telemetry (stage, discharge)",
    "Hydrologic Soil Group classification (SCS-CN infiltration modeling unavailable)",
    "High-resolution LiDAR DEM (sub-metre vertical accuracy)",
    "Real-time rainfall radar / IMD AWS precipitation grid",
    "Urban storm-water drain network capacity data",
  ];

  const elapsed = performance.now() - startTime;

  return {
    analysisId: `analysis-${Date.now()}`,
    algorithmVersion: "FloodScope-HAND-Proxy-v1.0",
    inputHash: `${inputs.rainfallIntensityMmH}-${inputs.rainfallDurationH}-${inputs.upstreamDischargeCusecs}`,
    createdAtUtc: new Date().toISOString(),
    inputs,
    dataSources,
    susceptibilitySummary,
    exposedAssets,
    sectorSummaries,
    factsDigest,
    aiPlan: null,
    limitations,
    missingData,
    status: "complete",
    statusMessage: `Analysis completed in ${elapsed.toFixed(0)}ms. ${exposedAssets.length} assets evaluated across ${sectorSummaries.length} sectors.`,
  };
}
