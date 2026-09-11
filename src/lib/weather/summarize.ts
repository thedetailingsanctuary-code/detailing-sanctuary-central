import type { CurrentConditions, LatLng, RainOutlook, RainSlot } from "./types";

/** WMO weather interpretation codes -> short labels. */
export function weatherCodeLabel(code: number | null | undefined): string {
  if (code == null) return "Unknown";
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
}

export function summarizeOutlook(args: {
  provider: string;
  location: LatLng;
  current: CurrentConditions | null;
  slots: RainSlot[];
  leadMinutes: number;
  thresholdMm: number;
  now: Date;
}): RainOutlook {
  const { provider, location, current, leadMinutes, thresholdMm, now } = args;
  const nowMs = now.getTime();
  const slots = args.slots
    .filter((s) => new Date(s.end).getTime() > nowMs)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const hourSlots = slots.filter((s) => new Date(s.start).getTime() < nowMs + 60 * 60000);
  const nextHourTotalMm = Number(hourSlots.reduce((acc, s) => acc + (s.precipitationMm || 0), 0).toFixed(2));

  const firstWet = slots.find((s) => s.precipitationMm >= thresholdMm);
  const rainStartsAt = firstWet ? firstWet.start : null;
  const minutesUntilRain = firstWet
    ? Math.max(0, Math.round((new Date(firstWet.start).getTime() - nowMs) / 60000))
    : null;
  const rainWithinLead = minutesUntilRain != null && minutesUntilRain <= leadMinutes;

  const conditionLabel = weatherCodeLabel(current?.weatherCode ?? slots[0]?.weatherCode ?? null);
  const horizonMin = slots.length
    ? Math.round((new Date(slots[slots.length - 1].end).getTime() - nowMs) / 60000)
    : 0;

  let summary: string;
  if (firstWet && minutesUntilRain === 0) {
    summary = `Rain now (${firstWet.precipitationMm.toFixed(1)} mm in the next 15 min)`;
  } else if (minutesUntilRain != null) {
    summary = `Rain expected in about ${minutesUntilRain} min`;
  } else if (horizonMin >= 90) {
    summary = "Dry for the next couple of hours";
  } else if (horizonMin >= 60) {
    summary = "Dry for the next hour";
  } else {
    summary = "No rain in the short-range forecast";
  }

  return {
    provider,
    checkedAt: now.toISOString(),
    location,
    current,
    slots,
    leadMinutes,
    thresholdMm,
    rainStartsAt,
    minutesUntilRain,
    rainWithinLead,
    nextHourTotalMm,
    conditionLabel,
    summary,
  };
}
