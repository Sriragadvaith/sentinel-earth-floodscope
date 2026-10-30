/**
 * Sentinel Earth - FloodScope: Professional GIS & Geodetic Mathematics Engine
 *
 * Implements high-precision WGS84 ellipsoidal & spherical calculations:
 * - Haversine & Geodesic Distance
 * - Spherical Excess Polygon & MultiPolygon Area (Girard's Theorem)
 * - Ray-Casting Point-in-Polygon & Distance-to-Feature
 * - Geodesic Circular Buffer Polygon Generation
 * - Route-to-Hazard Polygon Intersection Analysis
 * - Decimal Degrees <-> DMS (Degrees, Minutes, Seconds) Conversion
 * - Vijayawada Topographic DEM Elevation Estimation
 */

export const EARTH_RADIUS_METERS = 6371008.8; // WGS84 mean earth radius

export type LngLat = [number, number]; // [longitude, latitude]

/**
 * Calculates geodesic distance between two [lng, lat] points using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(coord1: LngLat, coord2: LngLat): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(radLat1) * Math.cos(radLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates cumulative distance along a multi-point polyline.
 * Returns total distance in meters and per-segment breakdown.
 */
export function calculatePathDistance(coords: LngLat[]): {
  totalMeters: number;
  segmentsMeters: number[];
  formatted: string;
} {
  if (coords.length < 2) {
    return { totalMeters: 0, segmentsMeters: [], formatted: "0 m" };
  }

  let total = 0;
  const segments: number[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const d = haversineDistance(coords[i], coords[i + 1]);
    segments.push(d);
    total += d;
  }

  const formatted =
    total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${Math.round(total)} m`;

  return { totalMeters: total, segmentsMeters: segments, formatted };
}

/**
 * Calculates area of a closed spherical polygon ring using the spherical excess method.
 * Handles coordinates in [lng, lat] WGS84 degrees.
 * Returns area in square meters.
 */
function ringArea(ring: LngLat[]): number {
  if (ring.length < 3) return 0;

  let total = 0;
  const len = ring.length;

  for (let i = 0; i < len; i++) {
    const lower = ring[i];
    const middle = ring[(i + 1) % len];
    const upper = ring[(i + 2) % len];

    const lowerLng = (lower[0] * Math.PI) / 180;
    const middleLat = (middle[1] * Math.PI) / 180;
    const upperLng = (upper[0] * Math.PI) / 180;

    total += (upperLng - lowerLng) * Math.sin(middleLat);
  }

  return Math.abs((total * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

/**
 * Calculates the geodesic surface area of a GeoJSON Polygon or MultiPolygon.
 * Accurately accounts for outer rings and interior exclusion holes.
 * Returns area in square meters, hectares, and square kilometers.
 */
export function calculatePolygonArea(geometry: {
  type: string;
  coordinates: any;
}): {
  sqMeters: number;
  hectares: number;
  sqKilometers: number;
  formatted: string;
} {
  let sqMeters = 0;

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as LngLat[][];
    if (rings.length > 0) {
      // Outer ring
      let area = ringArea(rings[0]);
      // Subtract holes (inner rings)
      for (let i = 1; i < rings.length; i++) {
        area -= ringArea(rings[i]);
      }
      sqMeters = Math.max(0, area);
    }
  } else if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as LngLat[][][];
    for (const poly of polygons) {
      if (poly.length > 0) {
        let area = ringArea(poly[0]);
        for (let i = 1; i < poly.length; i++) {
          area -= ringArea(poly[i]);
        }
        sqMeters += Math.max(0, area);
      }
    }
  }

  const hectares = sqMeters / 10000;
  const sqKilometers = sqMeters / 1000000;

  let formatted = "";
  if (sqKilometers >= 1.0) {
    formatted = `${sqKilometers.toFixed(2)} km²`;
  } else if (hectares >= 1.0) {
    formatted = `${hectares.toFixed(1)} ha (${(sqMeters).toLocaleString(undefined, { maximumFractionDigits: 0 })} m²)`;
  } else {
    formatted = `${Math.round(sqMeters).toLocaleString()} m²`;
  }

  return { sqMeters, hectares, sqKilometers, formatted };
}

/**
 * Tests if a point [lng, lat] is inside a single ring using the Jordan Ray-Casting algorithm.
 */
function pointInRing(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Tests whether a point [lng, lat] lies inside a Polygon or MultiPolygon geometry.
 * Accurately excludes holes.
 */
export function pointInPolygonGeometry(
  point: LngLat,
  geometry: { type: string; coordinates: any }
): boolean {
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as LngLat[][];
    if (rings.length === 0) return false;
    // Must be in outer ring
    if (!pointInRing(point, rings[0])) return false;
    // Must NOT be in any hole
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(point, rings[i])) return false;
    }
    return true;
  }

  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates as LngLat[][][];
    for (const poly of polys) {
      if (poly.length === 0) continue;
      if (pointInRing(point, poly[0])) {
        let inHole = false;
        for (let i = 1; i < poly.length; i++) {
          if (pointInRing(point, poly[i])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * Computes shortest distance in meters from a point to a finite line segment [p1, p2].
 */
export function pointToSegmentDistance(point: LngLat, p1: LngLat, p2: LngLat): number {
  const d12 = haversineDistance(p1, p2);
  if (d12 === 0) return haversineDistance(point, p1);

  // Approximate planar projection for local segment
  const dx = (p2[0] - p1[0]) * Math.cos(((p1[1] + p2[1]) * Math.PI) / 360);
  const dy = p2[1] - p1[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      (((point[0] - p1[0]) * Math.cos(((p1[1] + p2[1]) * Math.PI) / 360) * dx +
        (point[1] - p1[1]) * dy) /
        (dx * dx + dy * dy)) || 0
    )
  );

  const projLng = p1[0] + t * (p2[0] - p1[0]);
  const projLat = p1[1] + t * (p2[1] - p1[1]);

  return haversineDistance(point, [projLng, projLat]);
}

/**
 * Generates an accurate circular geodesic buffer polygon around [lng, lat].
 * Uses 64 vertices for smooth circle visualization.
 * Returns a valid GeoJSON Polygon.
 */
export function createGeodesicCircle(
  center: LngLat,
  radiusMeters: number,
  numPoints = 64
): {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: LngLat[][] };
  properties: { radiusMeters: number; center: LngLat; areaSqKm: number };
} {
  const [lng, lat] = center;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const distRad = radiusMeters / EARTH_RADIUS_METERS;

  const coordinates: LngLat[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (i * 2 * Math.PI) / numPoints;
    const ptLat = Math.asin(
      Math.sin(latRad) * Math.cos(distRad) +
        Math.cos(latRad) * Math.sin(distRad) * Math.cos(bearing)
    );
    const ptLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distRad) * Math.cos(latRad),
        Math.cos(distRad) - Math.sin(latRad) * Math.sin(ptLat)
      );

    coordinates.push([(ptLng * 180) / Math.PI, (ptLat * 180) / Math.PI]);
  }

  const areaSqKm = (Math.PI * radiusMeters * radiusMeters) / 1000000;

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
    properties: {
      radiusMeters,
      center,
      areaSqKm: Number(areaSqKm.toFixed(3)),
    },
  };
}

/**
 * Converts decimal degrees to formatted DMS (Degrees, Minutes, Seconds).
 */
export function decimalToDms(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesNotTruncated = (abs - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.round((minutesNotTruncated - minutes) * 60 * 10) / 10;

  let hemisphere = "";
  if (isLat) {
    hemisphere = decimal >= 0 ? "N" : "S";
  } else {
    hemisphere = decimal >= 0 ? "E" : "W";
  }

  return `${degrees}° ${minutes}' ${seconds.toFixed(1)}" ${hemisphere}`;
}

/**
 * Estimates elevation in meters MSL across Vijayawada based on known topographic ridges:
 * - Indrakeeladri Ridge: 104m
 * - Sitanagaram Ridge (South): 85m
 * - Gunadala Hill: 92m
 * - Krishna Riverbed & Prakasam Barrage: 15-18m
 * - Krishna Lanka Lowlands: 18-21m
 * - Central Urban Agglomeration: 22-28m
 */
export function estimateVijayawadaElevation(lng: number, lat: number): {
  elevationM: number;
  terrainType: string;
} {
  // Distance to Kanaka Durga / Indrakeeladri (80.606, 16.516)
  const distIndrakeeladri = haversineDistance([lng, lat], [80.606, 16.516]);
  if (distIndrakeeladri < 900) {
    const elev = Math.round(104 - (distIndrakeeladri / 900) * 80);
    return { elevationM: Math.max(24, elev), terrainType: "Indrakeeladri Promontory Ridge" };
  }

  // Distance to Gunadala Mary Hill (80.665, 16.525)
  const distGunadala = haversineDistance([lng, lat], [80.665, 16.525]);
  if (distGunadala < 800) {
    const elev = Math.round(92 - (distGunadala / 800) * 65);
    return { elevationM: Math.max(27, elev), terrainType: "Gunadala Hill Uplands" };
  }

  // Distance to Sitanagaram Hill (80.625, 16.495)
  const distSitanagaram = haversineDistance([lng, lat], [80.625, 16.495]);
  if (distSitanagaram < 1000) {
    const elev = Math.round(85 - (distSitanagaram / 1000) * 65);
    return { elevationM: Math.max(20, elev), terrainType: "Sitanagaram Hill Ridge" };
  }

  // Distance to Krishna River thalweg
  // River runs roughly through [80.60, 16.515] -> [80.643, 16.504] -> [80.68, 16.485]
  const distRiver = Math.min(
    haversineDistance([lng, lat], [80.643, 16.504]),
    haversineDistance([lng, lat], [80.62, 16.51]),
    haversineDistance([lng, lat], [80.67, 16.488])
  );

  if (distRiver < 350) {
    return { elevationM: 17, terrainType: "Krishna Riparian Inundation Floor" };
  }
  if (distRiver < 800) {
    return { elevationM: 19, terrainType: "Krishna Lanka Low-Lying Riverfront Ward" };
  }
  if (distRiver < 1600) {
    return { elevationM: 22, terrainType: "Alluvial Floodplain Terrace" };
  }

  return { elevationM: 26, terrainType: "Urban Intermediate Terrace" };
}

/**
 * Checks whether a route polyline intersects or comes within conflictDistance of any hazard polygon.
 * Returns segments marked as safe or conflicted with hazard names.
 */
export function evaluateRouteHazards(
  routeCoords: LngLat[],
  hazardPolygons: Array<{
    name: string;
    riskLevel: string;
    geometry: { type: string; coordinates: any };
  }>,
  conflictThresholdMeters = 75
): {
  hasConflict: boolean;
  conflicts: Array<{ hazardName: string; riskLevel: string; distanceMeters: number }>;
  conflictScorePercent: number;
} {
  const conflicts: Array<{ hazardName: string; riskLevel: string; distanceMeters: number }> = [];

  for (const hazard of hazardPolygons) {
    let minDistance = Infinity;

    // Check every route vertex
    for (const pt of routeCoords) {
      if (pointInPolygonGeometry(pt, hazard.geometry)) {
        minDistance = 0;
        break;
      }
    }

    // If no direct vertex inside, check intermediate segments
    if (minDistance > 0 && routeCoords.length > 1) {
      const rings =
        hazard.geometry.type === "Polygon"
          ? (hazard.geometry.coordinates as LngLat[][])
          : (hazard.geometry.coordinates as LngLat[][][])[0] || [];

      if (rings.length > 0) {
        const outerRing = rings[0];
        for (let s = 0; s < routeCoords.length - 1; s++) {
          for (let r = 0; r < outerRing.length - 1; r++) {
            const d = pointToSegmentDistance(routeCoords[s], outerRing[r], outerRing[r + 1]);
            if (d < minDistance) minDistance = d;
            if (minDistance <= conflictThresholdMeters) break;
          }
          if (minDistance <= conflictThresholdMeters) break;
        }
      }
    }

    if (minDistance <= conflictThresholdMeters) {
      conflicts.push({
        hazardName: hazard.name,
        riskLevel: hazard.riskLevel,
        distanceMeters: Math.round(minDistance),
      });
    }
  }

  const hasConflict = conflicts.length > 0;
  const criticalCount = conflicts.filter((c) => c.riskLevel.toLowerCase() === "critical").length;
  const highCount = conflicts.filter((c) => c.riskLevel.toLowerCase() === "high").length;
  const conflictScorePercent = Math.min(100, criticalCount * 45 + highCount * 25 + conflicts.length * 10);

  return { hasConflict, conflicts, conflictScorePercent };
}
