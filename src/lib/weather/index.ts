import { OpenMeteoProvider } from "./open-meteo";
import type { WeatherProvider } from "./types";

export * from "./types";
export { weatherCodeLabel } from "./summarize";

/** Pick the weather backend by name. Add new providers here (e.g. "accuweather"). */
export function getWeatherProvider(
  name: string = process.env.WEATHER_PROVIDER ?? "open-meteo",
): WeatherProvider {
  switch (name) {
    case "open-meteo":
      return new OpenMeteoProvider();
    default:
      throw new Error(
        `Unknown WEATHER_PROVIDER "${name}". Implement it in src/lib/weather and register it in index.ts.`,
      );
  }
}
