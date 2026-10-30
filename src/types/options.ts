export interface UserPreferences {
  reducedMotion: boolean;
  basemap: "dark" | "liberty";
  terrainExaggeration: number;
  units: "metric" | "imperial";
  ambient3DBackdrop: boolean;
  backdropIntensity: "low" | "medium" | "high";
}

const STORAGE_KEY = "sentinel_floodscope_prefs_v1";

export function loadUserPreferences(): UserPreferences {
  const systemPrefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const defaults: UserPreferences = {
    reducedMotion: systemPrefersReduced,
    basemap: "dark",
    terrainExaggeration: 2.5,
    units: "metric",
    ambient3DBackdrop: true,
    backdropIntensity: "high",
  };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      reducedMotion: typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : defaults.reducedMotion,
      basemap: parsed.basemap === "liberty" ? "liberty" : "dark",
      terrainExaggeration: typeof parsed.terrainExaggeration === "number" ? parsed.terrainExaggeration : 2.5,
      units: parsed.units === "imperial" ? "imperial" : "metric",
      ambient3DBackdrop: typeof parsed.ambient3DBackdrop === "boolean" ? parsed.ambient3DBackdrop : true,
      backdropIntensity: parsed.backdropIntensity === "low" || parsed.backdropIntensity === "medium" || parsed.backdropIntensity === "high"
        ? parsed.backdropIntensity
        : "high",
    };
  } catch {
    return defaults;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Graceful fallback if localStorage is disabled/full
  }
}
