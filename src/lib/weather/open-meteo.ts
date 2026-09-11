import { summarizeOutlook } from "./summarize";
import type { LatLng, RainOutlook, RainOutlookOptions, RainSlot, WeatherProvider } from "./types";

type OpenMeteoResponse = {
  current?: {
    time: string;
    temperature_2m?: number;
    weather_code?: number;
    precipitation?: number;
    is_day?: number;
  };
  minutely_15?: {
    time: string[];
    precipitation: number[];
    weather_code?: number[];
  };
};

/** Free, keyless, 15-minute precipitation for the UK. */
export class OpenMeteoProvider implements WeatherProvider {
  readonly name = "open-meteo";

  async getRainOutlook(location: LatLng, opts: RainOutlookOptions): Promise<RainOutlook> {
    const now = opts.now ?? new Date();
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.searchParams.set("latitude", location.lat.toFixed(4));
    u.searchParams.set("longitude", location.lng.toFixed(4));
    u.searchParams.set("current", "temperature_2m,weather_code,precipitation,is_day");
    u.searchParams.set("minutely_15", "precipitation,weather_code");
    u.searchParams.set("forecast_minutely_15", "12"); // next 3 hours
    u.searchParams.set("past_minutely_15", "1"); // include the slot in progress
    u.searchParams.set("timezone", "UTC");
    u.searchParams.set("timeformat", "iso8601");

    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const data = (await res.json()) as OpenMeteoResponse;

    const times = data.minutely_15?.time ?? [];
    const slots: RainSlot[] = times.map((t, i) => {
      const start = new Date(`${t}Z`);
      return {
        start: start.toISOString(),
        end: new Date(start.getTime() + 15 * 60000).toISOString(),
        precipitationMm: Number(data.minutely_15?.precipitation?.[i] ?? 0),
        weatherCode: data.minutely_15?.weather_code?.[i] ?? null,
      };
    });

    const current = data.current
      ? {
          temperatureC: data.current.temperature_2m ?? null,
          weatherCode: data.current.weather_code ?? null,
          precipitationMm: data.current.precipitation ?? null,
          isDay: data.current.is_day == null ? null : data.current.is_day === 1,
        }
      : null;

    return summarizeOutlook({
      provider: this.name,
      location,
      current,
      slots,
      leadMinutes: opts.leadMinutes,
      thresholdMm: opts.thresholdMm,
      now,
    });
  }
}
