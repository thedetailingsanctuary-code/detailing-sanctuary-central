import "server-only";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export type AppSettings = {
  homeBase: { label: string; postcode: string; lat: number; lng: number };
  businessHours: { start: string; end: string; days: number[] }; // days: 0 = Sunday
  rainAlert: {
    leadMinutes: number;
    thresholdMm: number;
    cooldownMinutes: number;
    /** If the next job starts within this many minutes, watch its location instead of home base. */
    upcomingJobWindowMinutes: number;
  };
};

/** Defaults; the app_settings table overrides these when present. */
export const DEFAULT_SETTINGS: AppSettings = {
  homeBase: { label: "Wolverhampton (WV3)", postcode: "WV3", lat: 52.579, lng: -2.1566 },
  businessHours: { start: "08:00", end: "18:00", days: [1, 2, 3, 4, 5, 6] },
  // 0.1 mm per 15 min is the smallest amount Open-Meteo reports, so any forecast rain triggers an alert.
  rainAlert: { leadMinutes: 30, thresholdMm: 0.1, cooldownMinutes: 90, upcomingJobWindowMinutes: 60 },
};

type Row = { key: string; value: unknown };

export async function getSettings(): Promise<AppSettings> {
  if (!hasSupabase()) return DEFAULT_SETTINGS;
  try {
    const { data } = await getSupabase().from("app_settings").select("key,value");
    const rows = (data ?? []) as Row[];
    const get = <T extends object>(key: string, fallback: T): T => {
      const row = rows.find((r) => r.key === key);
      return row && row.value && typeof row.value === "object"
        ? { ...fallback, ...(row.value as Partial<T>) }
        : fallback;
    };
    return {
      homeBase: get("home_base", DEFAULT_SETTINGS.homeBase),
      businessHours: get("business_hours", DEFAULT_SETTINGS.businessHours),
      rainAlert: get("rain_alert", DEFAULT_SETTINGS.rainAlert),
    };
  } catch (e) {
    console.warn("[settings] falling back to defaults", e);
    return DEFAULT_SETTINGS;
  }
}
