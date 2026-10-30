import type { Point, LineString, Polygon, Position } from "geojson";
import type { AppGeoFeature, AppFeatureCollection, LayerCategory, GeoFeatureProperties } from "../types/geo";

/**
 * Calculates simple polygon centroid [longitude, latitude] for label/popup placement.
 */
export function calculatePolygonCentroid(coordinates: Position[]): Position {
  if (!coordinates || coordinates.length === 0) return [80.648, 16.506];
  let sumLon = 0;
  let sumLat = 0;
  const count = coordinates.length;

  for (let i = 0; i < count; i++) {
    sumLon += coordinates[i][0];
    sumLat += coordinates[i][1];
  }

  return [Number((sumLon / count).toFixed(6)), Number((sumLat / count).toFixed(6))];
}

/**
 * Determines whether an OSM way is a closed loop polygon or a linear path.
 */
export function isClosedRing(coords: Position[]): boolean {
  if (coords.length < 4) return false;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6;
}

/**
 * Converts raw Overpass API response elements into properly typed GeoJSON features,
 * honoring genuine Point, LineString, and Polygon geometry distinctions.
 */
export function parseOverpassElements(elements: unknown[]): AppGeoFeature[] {
  if (!Array.isArray(elements)) return [];

  const features: AppGeoFeature[] = [];

  for (const item of elements as Record<string, unknown>[]) {
    const tags = (item.tags as Record<string, string>) ?? {};

    // Determine category
    let category: LayerCategory | null = null;
    if (tags.highway) {
      category = "roads";
    } else if (tags.waterway || tags.natural === "water" || tags.water) {
      category = "river";
    } else if (tags.amenity === "hospital" || tags.amenity === "clinic" || tags.healthcare === "hospital") {
      category = "hospitals";
    }

    if (!category) continue;

    const baseProps: GeoFeatureProperties = {
      id: String(item.id ?? Math.random()),
      name: tags.name ?? tags["name:en"] ?? tags.ref,
      name_te: tags["name:te"],
      category,
      highway: tags.highway,
      waterway: tags.waterway,
      natural: tags.natural,
      amenity: tags.amenity,
      emergency: tags.emergency,
      operator: tags.operator,
      beds: tags["capacity:beds"] ?? tags.beds,
      type: tags.highway ?? tags.waterway ?? tags.amenity ?? "Geospatial Feature",
      source: "osm-live",
      ...tags,
    };

    // Case 1: Point node
    if (item.type === "node" && typeof item.lon === "number" && typeof item.lat === "number") {
      const pointGeom: Point = {
        type: "Point",
        coordinates: [item.lon, item.lat],
      };
      features.push({
        type: "Feature",
        geometry: pointGeom,
        properties: baseProps,
      });
      continue;
    }

    // Case 2: Way with geometry list
    const rawGeom = (item.geometry as { lat: number; lon: number }[]) ?? [];
    if (!rawGeom.length) continue;

    const coords: Position[] = rawGeom.map((p) => [p.lon, p.lat]);

    // Check if this should be a Polygon
    const isPolygonTag =
      tags.building ||
      tags.amenity === "hospital" ||
      tags.natural === "water" ||
      tags.landuse ||
      tags.leisure ||
      tags.area === "yes";

    if (isPolygonTag && isClosedRing(coords)) {
      const polyGeom: Polygon = {
        type: "Polygon",
        coordinates: [coords],
      };
      features.push({
        type: "Feature",
        geometry: polyGeom,
        properties: {
          ...baseProps,
          type: tags.building ? "Building Footprint" : baseProps.type,
        },
      });

      // If it's a hospital polygon, ALSO add its centroid Point so point marker layer displays it!
      if (category === "hospitals") {
        const centroid = calculatePolygonCentroid(coords);
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: centroid,
          },
          properties: {
            ...baseProps,
            id: `${baseProps.id}-centroid`,
          },
        });
      }
    } else {
      // Linear feature
      const lineGeom: LineString = {
        type: "LineString",
        coordinates: coords,
      };
      features.push({
        type: "Feature",
        geometry: lineGeom,
        properties: baseProps,
      });
    }
  }

  return features;
}

/**
 * Combines live features and baseline features with deduplication.
 */
export function mergeFeatureCollections(
  baseline: AppFeatureCollection,
  liveFeatures: AppGeoFeature[]
): AppFeatureCollection {
  if (!liveFeatures || liveFeatures.length === 0) {
    return baseline;
  }

  // Combine features, ensuring verified baseline critical features remain present
  const liveNames = new Set(
    liveFeatures
      .map((f) => f.properties.name?.toLowerCase().trim())
      .filter(Boolean)
  );

  const merged = [...liveFeatures];

  for (const baseFeature of baseline.features) {
    const baseName = baseFeature.properties.name?.toLowerCase().trim();
    // Keep baseline feature if not already covered or if it's flood zones/water bodies
    if (!baseName || !liveNames.has(baseName) || baseFeature.properties.category === "floodZones") {
      merged.push(baseFeature);
    }
  }

  return {
    type: "FeatureCollection",
    features: merged,
  };
}
