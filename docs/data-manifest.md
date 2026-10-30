# Sentinel Earth — FloodScope: Geospatial Data Manifest

**Target Area:** Vijayawada Urban Basin, Andhra Pradesh, India  
**Bounding Box:** `16.440°N – 16.580°N`, `80.560°E – 80.740°E`  
**Coordinate Reference System:** EPSG:4326 (WGS 84), metric projection EPSG:32644 (UTM Zone 44N)  
**Truthfulness Classification:** Strict Evidence Badging (`OBSERVED`, `COMPUTED`, `ESTIMATED`, `UNAVAILABLE`)  

---

## 1. Verified Available Datasets

| Dataset | Identifier / File | Format | Spatial Resolution | Extent | Vintage | License | Status | Known Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Topographic Relief / DEM** | SRTM 30m / Calibrated Matrix | Raster / Grid | 30m (1 arc-sec) | Vijayawada Basin | 2000 (NASA/USGS v3.0) | Public Domain / Open Data | `COMPUTED` (Indices) | Coarse vertical accuracy ($\pm 5\text{–}10\text{m}$) limits micro-relief ditch mapping. |
| **Waterways (Main Channel & Thalweg)** | `vijayawadaBaseline.ts` (`river`) | GeoJSON MultiPolygon & LineString | 1:5,000 equivalent | Krishna River gorge & Bhavani Island | 2024 OSM snapshot | ODbL 1.0 | `OBSERVED` | River bathymetry / channel bed depth not surveyed in public datasets. |
| **Irrigation & Drainage Canals** | `vijayawadaBaseline.ts` (`river`) | GeoJSON LineString | Survey scale | Ryves, Eluru, Bandar, Krishna Thalweg | 2024 OSM snapshot | ODbL 1.0 | `OBSERVED` | Culvert dimensions and siltation status not mapped. |
| **Evacuation Arteries & Bridges** | `vijayawadaBaseline.ts` (`roads`) | GeoJSON LineString | Centerline geometry | NH16, NH65, Kanaka Durga Varadhi, Prakasam Barrage | 2024 OSM snapshot | ODbL 1.0 | `OBSERVED` | Road deck elevations above surrounding terrain are estimated. |
| **Critical Healthcare Facilities** | `vijayawadaBaseline.ts` (`hospitals`) | GeoJSON Point & Polygon | Facility centroid & campus bounds | GGH Vijayawada, Andhra Hospitals, Manipal, etc. | 2024 OSM verified | ODbL 1.0 | `OBSERVED` | Internal flood barrier heights and generator placements unavailable. |
| **Tactical Administrative Sectors** | `sector.ts` (`S-01` to `S-06`) | GeoJSON / Vector Polygons | Sub-ward boundaries | Vijayawada Urban Basin ($37.86\text{ km}^2$) | 2024 baseline | Open Data | `COMPUTED` | Navigation partitions calibrated to local geographic landmarks. |
| **Historical Flood Benchmarks** | `scenario.ts` | Structured Parameters | Gauged peak values | Prakasam Barrage (2009, 2023) | Historic Records | Public Records (CWC/APSDMA) | `OBSERVED` (Inputs) | Historical benchmarks are fixed reference scenarios, not live forecasts. |

---

## 2. Missing & Unavailable Datasets

| Dataset Category | Expected Requirement | Status | Impact on FloodScope Capabilities | Required Remedy |
| :--- | :--- | :--- | :--- | :--- |
| **Live Telemetry & Gauge Stage** | CWC / APSDMA river stage telemetry | `UNAVAILABLE` | Live real-time barrage crest prediction blocked. | River-level scenario marked "Unavailable: no gauge telemetry configured". |
| **Soil Texture & Hydrologic Soil Group** | USDA/ICAR HSG classification (A, B, C, D) | `UNAVAILABLE` | SCS Curve Number (SCS-CN) runoff coefficient estimation skipped. | Runoff modeling skipped with transparent documentation. |
| **High-Resolution Land Cover (LULC)** | 10m Sentinel-2 / ESA WorldCover | `UNAVAILABLE` | Surface infiltration capacity modeling skipped. | Susceptibility relies strictly on topographic indices (HAND + Slope). |
| **Micro-Elevation LIDAR** | 1m DTM with stormwater drains | `UNAVAILABLE` | Street-level localized ponding predictions blocked. | Results labeled strictly as "Flood Susceptibility Screening", never flood depth. |

---

## 3. Capability Matrix

| Analysis Capability | Implementation Status | Methodology / Algorithm | Evidence Badge |
| :--- | :--- | :--- | :--- |
| **Terrain Susceptibility** | **ACTIVE** | Height Above Nearest Drainage (HAND) + Slope Gradient ($0\text{–}30^\circ$) | `ESTIMATED` (Experimental) |
| **Proximity to Drainage** | **ACTIVE** | Euclidean distance to mapped Krishna thalweg and canal channels | `COMPUTED` |
| **Scenario Sensitivity** | **ACTIVE** | Monotonic ordinal threshold shift driven by hypothetical rainfall ($1\text{–}300\text{ mm/h}$) | `ESTIMATED` |
| **Hospital Exposure Join** | **ACTIVE** | Spatial point-in-zone & distance to High/Very High susceptibility zones | `COMPUTED` |
| **Road Arterial Exposure** | **ACTIVE** | Spatial line intersection calculating exposed length in km per risk class | `COMPUTED` |
| **Sector Summaries** | **ACTIVE** | Asset aggregation (hospitals, roads, area) across S-01 through S-06 | `COMPUTED` |
| **Live Forecast / Depth Prediction** | **BLOCKED** | Missing validated hydrodynamic 2D model (HEC-RAS / TUFLOW) and live telemetry | `UNAVAILABLE` |
| **SCS-CN Runoff Modeling** | **BLOCKED** | Missing verified soil series and urban imperviousness rasters | `UNAVAILABLE` |
| **Grounded AI Response Planning** | **ACTIVE** | NVIDIA Nemotron via Nebius Token Factory with Fact-ID verification | `ESTIMATED` (AI-Assisted) |
