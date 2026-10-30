import { useMemo } from "react";
import {
  X,
  MapPin,
  Mountain,
  Ruler,
  AlertTriangle,
  HeartPulse,
  Home,
  Shield,
  Activity,
  Navigation,
  Bot,
  Radio,
} from "lucide-react";
import type { AppGeoFeature } from "../../types/geo";
import {
  calculatePolygonArea,
  calculatePathDistance,
  haversineDistance,
  decimalToDms,
  estimateVijayawadaElevation,
  pointInPolygonGeometry,
  type LngLat,
} from "../../utils/gisMath";

interface FeatureInspectionDrawerProps {
  feature: AppGeoFeature | null;
  onClose: () => void;
  allFeatures: AppGeoFeature[];
  onSetRouteDestination: (feature: AppGeoFeature) => void;
  onSetBufferCenter: (coords: [number, number]) => void;
  onOpenCopilotWithFeature: (feature: AppGeoFeature) => void;
}

export function FeatureInspectionDrawer({
  feature,
  onClose,
  allFeatures,
  onSetRouteDestination,
  onSetBufferCenter,
  onOpenCopilotWithFeature,
}: FeatureInspectionDrawerProps) {
  const props = feature?.properties;
  const geom = feature?.geometry;

  // Extract center coordinates or first coordinate
  const centerCoord = useMemo<LngLat | null>(() => {
    if (!geom) return null;
    if (geom.type === "Point") {
      return geom.coordinates as LngLat;
    }
    if (geom.type === "LineString") {
      const coords = geom.coordinates as LngLat[];
      return coords[Math.floor(coords.length / 2)] || null;
    }
    if (geom.type === "Polygon") {
      const ring = (geom.coordinates as LngLat[][])[0];
      if (!ring || ring.length === 0) return null;
      let sumLng = 0;
      let sumLat = 0;
      for (const pt of ring) {
        sumLng += pt[0];
        sumLat += pt[1];
      }
      return [sumLng / ring.length, sumLat / ring.length];
    }
    return null;
  }, [geom]);

  // Compute Geometry metrics (Area or Length)
  const geomMetrics = useMemo(() => {
    if (!geom) return null;
    if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
      const area = calculatePolygonArea(geom as any);
      return { type: "polygon", area: area.formatted, rawSqKm: area.sqKilometers };
    }
    if (geom.type === "LineString" || geom.type === "MultiLineString") {
      const coords =
        geom.type === "LineString"
          ? (geom.coordinates as LngLat[])
          : ((geom.coordinates as LngLat[][])[0] as LngLat[]);
      const dist = calculatePathDistance(coords);
      return { type: "line", length: dist.formatted, rawMeters: dist.totalMeters };
    }
    return null;
  }, [geom]);

  // Compute Elevation & Terrain profile
  const elevationInfo = useMemo(() => {
    if (!centerCoord) return null;
    return estimateVijayawadaElevation(centerCoord[0], centerCoord[1]);
  }, [centerCoord]);

  // Find Nearest Verified Emergency Facilities
  const nearestFacilities = useMemo(() => {
    if (!centerCoord || !props) return [];

    const facilities = allFeatures.filter(
      (f) =>
        f.properties.id !== props.id &&
        (f.properties.category === "hospitals" ||
          f.properties.category === "shelters" ||
          f.properties.category === "emergencyServices")
    );

    const withDist = facilities
      .map((f) => {
        let fCoord: LngLat | null = null;
        if (f.geometry.type === "Point") fCoord = f.geometry.coordinates as LngLat;
        else if (f.geometry.type === "Polygon") fCoord = (f.geometry.coordinates as LngLat[][])[0][0];

        if (!fCoord) return null;
        const dist = haversineDistance(centerCoord, fCoord);
        return { feature: f, distanceMeters: dist };
      })
      .filter((item): item is { feature: AppGeoFeature; distanceMeters: number } => item !== null)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 4);

    return withDist;
  }, [centerCoord, allFeatures, props]);

  // Check Hazard Overlap
  const hazardOverlap = useMemo(() => {
    if (!centerCoord) return null;

    const floodPolygons = allFeatures.filter(
      (f) =>
        f.properties.category === "floodZones" &&
        (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
    );

    for (const hazard of floodPolygons) {
      if (pointInPolygonGeometry(centerCoord, hazard.geometry as any)) {
        return {
          insideHazard: true,
          hazardName: hazard.properties.name || "Mapped Inundation Zone",
          riskLevel: hazard.properties.riskLevel || "CRITICAL",
        };
      }
    }

    return { insideHazard: false, hazardName: null, riskLevel: null };
  }, [centerCoord, allFeatures]);

  if (!feature || !props) return null;

  const riskClass =
    props.riskLevel === "critical"
      ? "badge-critical"
      : props.riskLevel === "high"
      ? "badge-warning"
      : props.riskLevel === "moderate"
      ? "badge-watch"
      : "badge-normal";

  const provenance = props.provenance || (props.source === "osm-live" ? "LIVE" : "HISTORICAL");

  return (
    <aside className="feature-inspection-drawer" aria-label="Feature Properties Inspector">
      <div className="drawer-header">
        <div className="header-badge-row">
          <span className="category-pill">{props.category?.toUpperCase() || "FEATURE"}</span>
          <span className={`risk-pill ${riskClass}`}>{props.riskLevel?.toUpperCase() || "MONITORED"} RISK</span>
          <span className={`provenance-pill prov-${provenance.toLowerCase()}`}>{provenance}</span>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          aria-label="Close Inspection Drawer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="drawer-content">
        <h3 className="feature-title">{props.name || props.type || "Geospatial Object"}</h3>
        {props.name_te && <div className="feature-telugu">{props.name_te}</div>}
        <div className="feature-type-tag">{props.type || "Vector Infrastructure"}</div>

        {props.description && <p className="feature-desc">{props.description}</p>}

        {/* Hazard Intersect Warning */}
        {hazardOverlap?.insideHazard && (
          <div className="hazard-alert-banner">
            <AlertTriangle size={16} className="alert-icon" />
            <div>
              <strong>HAZARD CONFLICT IDENTIFIED</strong>
              <p>
                This feature lies within the active flood envelope of <em>{hazardOverlap.hazardName}</em> (
                {hazardOverlap.riskLevel?.toUpperCase()} RISK).
              </p>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="metrics-card-grid">
          {centerCoord && (
            <div className="metric-box">
              <span className="box-label">
                <MapPin size={13} /> COORDINATES
              </span>
              <span className="box-val tabular-num">
                {centerCoord[1].toFixed(5)}°N, {centerCoord[0].toFixed(5)}°E
              </span>
              <span className="box-subval">
                {decimalToDms(centerCoord[1], true)}, {decimalToDms(centerCoord[0], false)}
              </span>
            </div>
          )}

          {elevationInfo && (
            <div className="metric-box">
              <span className="box-label">
                <Mountain size={13} /> ESTIMATED ELEVATION
              </span>
              <span className="box-val tabular-num">{elevationInfo.elevationM} m MSL</span>
              <span className="box-subval">{elevationInfo.terrainType}</span>
            </div>
          )}

          {geomMetrics?.type === "polygon" && (
            <div className="metric-box">
              <span className="box-label">
                <Ruler size={13} /> COMPUTED POLYGON AREA
              </span>
              <span className="box-val highlight-val tabular-num">{geomMetrics.area}</span>
              <span className="box-subval">WGS84 Authalic Spherical Girard Metric</span>
            </div>
          )}

          {geomMetrics?.type === "line" && (
            <div className="metric-box">
              <span className="box-label">
                <Ruler size={13} /> COMPUTED ROUTE LENGTH
              </span>
              <span className="box-val highlight-val tabular-num">{geomMetrics.length}</span>
              <span className="box-subval">Cumulative Geodesic Polyline Length</span>
            </div>
          )}

          {props.capacity && (
            <div className="metric-box">
              <span className="box-label">
                <Home size={13} /> DESIGNATED CAPACITY
              </span>
              <span className="box-val tabular-num">{props.capacity.toLocaleString()} Persons</span>
              <span className="box-subval">Status: {props.shelterStatus?.toUpperCase() || "STAGED"}</span>
            </div>
          )}

          {props.beds && (
            <div className="metric-box">
              <span className="box-label">
                <HeartPulse size={13} /> HOSPITAL BEDS
              </span>
              <span className="box-val tabular-num">{props.beds} Beds</span>
              <span className="box-subval">{props.emergency === "yes" ? "24/7 Trauma Triage" : "General Healthcare"}</span>
            </div>
          )}

          {props.currentWaterLevelFt !== undefined && (
            <div className="metric-box">
              <span className="box-label">
                <Activity size={13} /> RIVER GAUGE TELEMETRY
              </span>
              <span className="box-val tabular-num">{props.currentWaterLevelFt.toFixed(1)} ft Level</span>
              <span className="box-subval">
                Warning: {props.warningLevelFt} ft · Danger: {props.dangerLevelFt} ft · Discharge: {props.dischargeCfs?.toLocaleString()} cfs
              </span>
            </div>
          )}

          {props.rainfallMm24h !== undefined && (
            <div className="metric-box">
              <span className="box-label">
                <Activity size={13} /> PRECIPITATION RECORD
              </span>
              <span className="box-val tabular-num">{props.rainfallMm24h} mm (24h)</span>
              <span className="box-subval">1-Hour Peak Intensity: {props.rainfallMm1h} mm/h</span>
            </div>
          )}
        </div>

        {/* Nearby Facilities Analysis */}
        {nearestFacilities.length > 0 && (
          <div className="nearest-facilities-block">
            <h4 className="section-title">Verified Nearby Facilities (Geodesic Proximity)</h4>
            <div className="facilities-list">
              {nearestFacilities.map(({ feature: f, distanceMeters }) => {
                const fProps = f.properties;
                const dKm = (distanceMeters / 1000).toFixed(2);
                const Icon =
                  fProps.category === "hospitals"
                    ? HeartPulse
                    : fProps.category === "shelters"
                    ? Home
                    : Shield;

                return (
                  <div key={fProps.id || fProps.name} className="facility-item">
                    <Icon size={14} className="facility-icon" />
                    <div className="facility-info">
                      <span className="facility-name">{fProps.name}</span>
                      <span className="facility-sub">{fProps.type || fProps.category}</span>
                    </div>
                    <span className="facility-dist tabular-num">{dKm} km</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="drawer-actions-stack">
          {centerCoord && (
            <button
              type="button"
              className="drawer-action-btn btn-buffer"
              onClick={() => onSetBufferCenter(centerCoord)}
            >
              <Radio size={14} />
              <span>Generate Hazard Buffer at Location</span>
            </button>
          )}

          <button
            type="button"
            className="drawer-action-btn btn-route"
            onClick={() => onSetRouteDestination(feature)}
          >
            <Navigation size={14} />
            <span>Calculate Disaster Route to Facility</span>
          </button>

          <button
            type="button"
            className="drawer-action-btn btn-copilot"
            onClick={() => onOpenCopilotWithFeature(feature)}
          >
            <Bot size={14} />
            <span>Analyze with AI Spatial Copilot</span>
          </button>
        </div>

        {/* Provenance Metadata Notice */}
        <div className="provenance-footer">
          <span>Source: {props.source || "OSM-APSDMA Baseline"}</span>
          <span>•</span>
          <span>Updated: {props.lastUpdatedIso ? new Date(props.lastUpdatedIso).toLocaleDateString() : "Active Dataset"}</span>
        </div>
      </div>
    </aside>
  );
}
