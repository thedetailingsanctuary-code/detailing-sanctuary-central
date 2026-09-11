export type LatLng = { lat: number; lng: number };

export type RainSlot = {
  start: string; // ISO
  end: string; // ISO
  precipitationMm: number;
  weatherCode: number | null; // WMO code when available
};

export type CurrentConditions = {
  temperatureC: number | null;
  weatherCode: number | null;
  precipitationMm: number | null;
  isDay: boolean | null;
};

export type RainOutlook = {
  provider: string;
  checkedAt: string;
  location: LatLng;
  current: CurrentConditions | null;
  /** Short-range slots (15 min each) from now onwards, at least one hour. */
  slots: RainSlot[];
  leadMinutes: number;
  thresholdMm: number;
  rainStartsAt: string | null;
  minutesUntilRain: number | null;
  rainWithinLead: boolean;
  nextHourTotalMm: number;
  conditionLabel: string;
  summary: string;
};

export type RainOutlookOptions = { leadMinutes: number; thresholdMm: number; now?: Date };

/**
 * Anything that can tell us whether rain is coming at a point. Open-Meteo today,
 * AccuWeather MinuteCast (or anything else) later: implement this interface,
 * register it in ./index.ts, set WEATHER_PROVIDER, done. The UI never sees the raw API shape.
 */
export interface WeatherProvider {
  readonly name: string;
  getRainOutlook(location: LatLng, opts: RainOutlookOptions): Promise<RainOutlook>;
}
