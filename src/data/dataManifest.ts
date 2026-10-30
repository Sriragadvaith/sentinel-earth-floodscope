export interface DatasetEntry {
  id: string;
  name: string;
  category: "elevation" | "waterways" | "infrastructure" | "transport" | "sectors" | "telemetry" | "soil";
  format: string;
  crs: string;
  resolution: string;
  extent: string;
  vintage: string;
  license: string;
  evidenceBadge: "OBSERVED" | "COMPUTED" | "ESTIMATED" | "UNAVAILABLE";
  isAvailable: boolean;
  knownGaps: string;
}

export interface CapabilityEntry {
  capability: string;
  status: "ACTIVE" | "BLOCKED" | "LIMITED";
  methodology: string;
  evidenceBadge: "OBSERVED" | "COMPUTED" | "ESTIMATED" | "UNAVAILABLE";
  prerequisites: string;
}

export const DATA_MANIFEST: DatasetEntry[] = [
  {
    id: "dem-srtm-30m",
    name: "SRTM 30m Topographic Elevation Grid",
    category: "elevation",
    format: "GeoTIFF / Numeric Grid",
    crs: "EPSG:4326 / EPSG:32644",
    resolution: "30m (1 arc-sec)",
    extent: "Vijayawada Urban Basin (16.44°N–16.58°N, 80.56°E–80.74°E)",
    vintage: "NASA SRTM v3.0",
    license: "Public Domain / Open Data",
    evidenceBadge: "COMPUTED",
    isAvailable: true,
    knownGaps: "Coarse vertical accuracy limits micro-drainage ditch mapping. Does not replace survey LiDAR.",
  },
  {
    id: "waterways-osm-baseline",
    name: "Krishna River Thalweg & Irrigation Canals",
    category: "waterways",
    format: "GeoJSON (MultiPolygon & LineString)",
    crs: "EPSG:4326",
    resolution: "1:5,000 equivalent",
    extent: "Krishna River, Ryves, Eluru, Bandar Canals",
    vintage: "2024 OpenStreetMap snapshot",
    license: "ODbL 1.0",
    evidenceBadge: "OBSERVED",
    isAvailable: true,
    knownGaps: "Channel bathymetry and culvert siltation parameters not surveyed.",
  },
  {
    id: "transport-evacuation-arteries",
    name: "Primary Evacuation Corridors & Bridges",
    category: "transport",
    format: "GeoJSON (LineString)",
    crs: "EPSG:4326",
    resolution: "Survey centerline",
    extent: "NH16, NH65, Kanaka Durga Varadhi, Prakasam Barrage",
    vintage: "2024 OpenStreetMap verified",
    license: "ODbL 1.0",
    evidenceBadge: "OBSERVED",
    isAvailable: true,
    knownGaps: "Bridge deck elevations above maximum water level are estimated from satellite benchmarks.",
  },
  {
    id: "facilities-critical-hospitals",
    name: "Critical Healthcare & Trauma Facilities",
    category: "infrastructure",
    format: "GeoJSON (Point & Polygon)",
    crs: "EPSG:4326",
    resolution: "Facility centroid & campus footprint",
    extent: "GGH Vijayawada, Andhra Hospitals, Manipal, Ayush",
    vintage: "2024 OSM verified baseline",
    license: "ODbL 1.0",
    evidenceBadge: "OBSERVED",
    isAvailable: true,
    knownGaps: "Internal plinth elevations and auxiliary generator flood protection heights not available.",
  },
  {
    id: "sectors-tactical-subdivisions",
    name: "Vijayawada Tactical Emergency Sectors (S-01 to S-06)",
    category: "sectors",
    format: "Vector / Polygon",
    crs: "EPSG:4326",
    resolution: "Sub-ward scale",
    extent: "Vijayawada Municipal Basin (37.86 km²)",
    vintage: "2024 Geo-calibrated baseline",
    license: "Open Data",
    evidenceBadge: "COMPUTED",
    isAvailable: true,
    knownGaps: "Navigation partitions based on geographical boundaries, not official gazetted ward boundaries.",
  },
  {
    id: "telemetry-cwc-gauge",
    name: "Real-Time River Gauge Stage Telemetry",
    category: "telemetry",
    format: "REST / Timeseries",
    crs: "N/A",
    resolution: "Hourly telemetry",
    extent: "Prakasam Barrage & Upstream CWC Gauges",
    vintage: "None configured",
    license: "Proprietary / Government",
    evidenceBadge: "UNAVAILABLE",
    isAvailable: false,
    knownGaps: "Live gauge API key and telemetry endpoint not configured in this environment.",
  },
  {
    id: "soil-landcover-hsg",
    name: "Hydrologic Soil Group & Urban Imperviousness",
    category: "soil",
    format: "Raster / Soil Map",
    crs: "EPSG:4326",
    resolution: "10m",
    extent: "Krishna District",
    vintage: "None configured",
    license: "Unavailable",
    evidenceBadge: "UNAVAILABLE",
    isAvailable: false,
    knownGaps: "Detailed soil classification unavailable; SCS-CN infiltration modeling skipped.",
  },
];

export const CAPABILITY_MATRIX: CapabilityEntry[] = [
  {
    capability: "Terrain Height Above Nearest Drainage (HAND)",
    status: "ACTIVE",
    methodology: "Normalized elevation relative to mapped Krishna River thalweg drainage network",
    evidenceBadge: "ESTIMATED",
    prerequisites: "SRTM 30m DEM + OSM Waterways",
  },
  {
    capability: "Drainage Proximity Modeling",
    status: "ACTIVE",
    methodology: "Euclidean distance matrix to primary river channel and canal lines",
    evidenceBadge: "COMPUTED",
    prerequisites: "OSM Waterways geometry",
  },
  {
    capability: "Hypothetical Scenario Sensitivity Shift",
    status: "ACTIVE",
    methodology: "Monotonic ordinal shift expanding elevation susceptibility bands by rainfall intensity",
    evidenceBadge: "ESTIMATED",
    prerequisites: "Rainfall rate (mm/h) & Duration (hours)",
  },
  {
    capability: "Critical Healthcare Facility Exposure Join",
    status: "ACTIVE",
    methodology: "Spatial intersection and distance-to-high-risk computation for hospital centroids",
    evidenceBadge: "COMPUTED",
    prerequisites: "Hospital coordinates + Susceptibility raster/polygons",
  },
  {
    capability: "Evacuation Artery & Bridge Exposure Join",
    status: "ACTIVE",
    methodology: "Line segment clipping calculating exposed length (km) in High/Very High zones",
    evidenceBadge: "COMPUTED",
    prerequisites: "Road network + Susceptibility zones",
  },
  {
    capability: "Tactical Sector Aggregation (S-01 to S-06)",
    status: "ACTIVE",
    methodology: "Asset counts, exposed length, and class area computation per sector",
    evidenceBadge: "COMPUTED",
    prerequisites: "Sector boundaries + Exposed assets",
  },
  {
    capability: "Live Gauge Stage & Automated Depth Prediction",
    status: "BLOCKED",
    methodology: "Hydrodynamic 2D river flood modeling (requires live telemetry & bathymetry)",
    evidenceBadge: "UNAVAILABLE",
    prerequisites: "CWC / APSDMA real-time stage telemetry (missing)",
  },
  {
    capability: "SCS-CN Infiltration & Runoff Volume",
    status: "BLOCKED",
    methodology: "USDA Curve Number method based on hydrologic soil groups and land cover",
    evidenceBadge: "UNAVAILABLE",
    prerequisites: "Soil survey & 10m LULC raster (missing)",
  },
  {
    capability: "Grounded AI Response Planning (NVIDIA Nemotron)",
    status: "ACTIVE",
    methodology: "Nebius Token Factory with strict Fact-ID citation and backend grounding check",
    evidenceBadge: "ESTIMATED",
    prerequisites: "Backend server configuration & environment variables",
  },
];
