export interface FloodScenario {
  id: string;
  name: string;
  description: string;
  rainfallRateMmH: number; // mm/hour
  upstreamDischargeCusecs: number; // cusecs at Prakasam Barrage
  durationHours: number;
  barrageWaterLevelFt: number; // Normal full reservoir level: 12.0 ft, 1st warning: 12.5 ft, 2nd warning: 14.5 ft
  riskCategory: "NORMAL" | "WATCH" | "WARNING" | "CRITICAL";
  affectedWardsApprox: string[];
}

export const PRESET_SCENARIOS: FloodScenario[] = [
  {
    id: "monsoon-baseline",
    name: "Baseline Monsoon Inflow",
    description: "Standard seasonal inflow with regulated gate operations at Prakasam Barrage.",
    rainfallRateMmH: 15,
    upstreamDischargeCusecs: 120000,
    durationHours: 12,
    barrageWaterLevelFt: 11.8,
    riskCategory: "NORMAL",
    affectedWardsApprox: [],
  },
  {
    id: "cyclone-michaung",
    name: "Severe Depressive Rainfall (Michaung Pattern)",
    description: "High urban precipitation combined with swollen Budameru and local canal discharge.",
    rainfallRateMmH: 65,
    upstreamDischargeCusecs: 450000,
    durationHours: 24,
    barrageWaterLevelFt: 13.2,
    riskCategory: "WARNING",
    affectedWardsApprox: ["Ajit Singh Nagar", "Bhavanipuram Lowlands", "Vidyadharapuram"],
  },
  {
    id: "historical-2009",
    name: "Historical 2009 Super Flood Peak",
    description: "Highest recorded discharge in Krishna River history (1.11M cusecs) exceeding all barrage warning thresholds.",
    rainfallRateMmH: 110,
    upstreamDischargeCusecs: 1110000,
    durationHours: 36,
    barrageWaterLevelFt: 16.8,
    riskCategory: "CRITICAL",
    affectedWardsApprox: ["Krishna Lanka", "Ramalingeswara Nagar", "Bhavanipuram", "Tarapet", "Ranigarithota"],
  },
  {
    id: "cloudburst-stress",
    name: "Extreme Cloudburst Urban Stress",
    description: "Localized intense torrential cloudburst over Vijayawada metropolitan bowl.",
    rainfallRateMmH: 140,
    upstreamDischargeCusecs: 780000,
    durationHours: 6,
    barrageWaterLevelFt: 15.1,
    riskCategory: "CRITICAL",
    affectedWardsApprox: ["One Town Commercial Basin", "Governorpet", "Satyanarayanapuram"],
  },
];
