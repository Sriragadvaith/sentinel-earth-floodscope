export interface TacticalSector {
  id: string;
  code: string;
  name: string;
  category: "Riverfront" | "Upland" | "Urban Core" | "Commercial Spine" | "Industrial";
  centroid: [number, number]; // [lon, lat]
  zoom: number;
  areaKm2: number;
  hospitalsCount: number;
  arterialsCount: number;
  canalsCount: number;
  svgThumbnailPath: string; // SVG path data for outline
  description: string;
}

export const VIJAYAWADA_TACTICAL_SECTORS: TacticalSector[] = [
  {
    id: "sector-prakasam-onetown",
    code: "S-01",
    name: "Prakasam Barrage & One Town",
    category: "Riverfront",
    centroid: [80.605, 16.5075],
    zoom: 14.8,
    areaKm2: 4.82,
    hospitalsCount: 2,
    arterialsCount: 3,
    canalsCount: 2,
    svgThumbnailPath: "M 4 24 L 14 12 L 28 10 L 36 18 L 32 30 L 16 32 Z",
    description: "Primary Krishna outflow barrage control zone and historical riverfront trade node.",
  },
  {
    id: "sector-indrakeeladri",
    code: "S-02",
    name: "Indrakeeladri & Bhavanipuram",
    category: "Upland",
    centroid: [80.612, 16.5165],
    zoom: 15.0,
    areaKm2: 6.15,
    hospitalsCount: 1,
    arterialsCount: 2,
    canalsCount: 1,
    svgThumbnailPath: "M 10 32 L 6 18 L 18 6 L 34 8 L 32 24 L 20 30 Z",
    description: "Elevated Eastern Ghats spur promontory and Kanaka Durga temple sanctuary sector.",
  },
  {
    id: "sector-krishna-lanka",
    code: "S-03",
    name: "Krishna Lanka Riverfront",
    category: "Riverfront",
    centroid: [80.638, 16.5015],
    zoom: 14.6,
    areaKm2: 5.34,
    hospitalsCount: 2,
    arterialsCount: 2,
    canalsCount: 1,
    svgThumbnailPath: "M 6 12 L 22 8 L 36 16 L 34 28 L 18 32 L 8 24 Z",
    description: "Low-lying floodplain sector bordering Krishna thalweg, historically vulnerable to high reservoir discharges.",
  },
  {
    id: "sector-governorpet",
    code: "S-04",
    name: "Governorpet & MG Road Spine",
    category: "Urban Core",
    centroid: [80.6385, 16.5175],
    zoom: 14.8,
    areaKm2: 5.92,
    hospitalsCount: 3,
    arterialsCount: 4,
    canalsCount: 2,
    svgThumbnailPath: "M 8 10 L 30 6 L 34 26 L 16 34 L 6 22 Z",
    description: "High-density administrative and commercial spine including Government General Hospital (GGH).",
  },
  {
    id: "sector-ramalingeswara",
    code: "S-05",
    name: "Ramalingeswara Nagar & Canal Basin",
    category: "Commercial Spine",
    centroid: [80.655, 16.498],
    zoom: 14.5,
    areaKm2: 7.18,
    hospitalsCount: 1,
    arterialsCount: 2,
    canalsCount: 3,
    svgThumbnailPath: "M 12 6 L 32 10 L 36 30 L 14 34 L 4 20 Z",
    description: "Lowland canal confluence zone intersecting Bandar Canal and Ryves Canal discharge trunks.",
  },
  {
    id: "sector-autonagar",
    code: "S-06",
    name: "Auto Nagar & Eastern Ring Basin",
    category: "Industrial",
    centroid: [80.675, 16.505],
    zoom: 14.2,
    areaKm2: 8.45,
    hospitalsCount: 1,
    arterialsCount: 3,
    canalsCount: 1,
    svgThumbnailPath: "M 6 8 L 28 6 L 36 22 L 28 34 L 8 30 Z",
    description: "Eastern logistical and transit hub flanked by NH16 corridor and Eluru canal drainages.",
  },
];
