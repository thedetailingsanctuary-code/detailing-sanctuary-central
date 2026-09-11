"use client";
import { useEffect, useMemo, useState } from "react";
import { errorMessage, fetchJson, safeParse, useLocalStorageValue, writeLocal } from "@/lib/client-hooks";
import { formatTime } from "@/lib/time";
import type { RainOutlook } from "@/lib/weather/types";

type WeatherResponse = {
  target: { kind: string; label: string; address: string | null; customerName: string | null; service: string | null };
  outlook: RainOutlook;
};

const KEY = "dsc_weather_v1";
const REFRESH_MS = 10 * 60 * 1000;

function kindLabel(kind: string): string {
  switch (kind) {
    case "current-job":
      return "at the current job";
    case "upcoming-job":
    case "next-job":
      return "at the next job";
    default:
      return "at home base";
  }
}

export function WeatherTile() {
  const cachedRaw = useLocalStorageValue(KEY);
  const cached = useMemo(() => safeParse<WeatherResponse>(cachedRaw), [cachedRaw]);
  const [fresh, setFresh] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () =>
      fetchJson<WeatherResponse>("/api/weather")
        .then((json) => {
          if (cancelled) return;
          setFresh(json);
          setError(null);
          writeLocal(KEY, json);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(errorMessage(e, "Weather unavailable"));
        });
    run();
    const timer = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const data = fresh ?? cached;

  if (!data) {
    return (
      <section className="card p-4 text-sm text-fg-muted" aria-busy={!error}>
        {error ? `Weather unavailable right now (${error}). It will retry automatically.` : "Checking the sky..."}
      </section>
    );
  }

  const { outlook, target } = data;
  const wet = outlook.rainWithinLead;
  const later = !wet && outlook.minutesUntilRain != null;
  const tone = wet ? "text-rain" : later ? "text-warn" : "text-ok";
  const border = wet ? "border-rain/60" : later ? "border-warn/40" : "border-line";
  const headline = wet
    ? outlook.minutesUntilRain === 0
      ? "Rain now"
      : `Rain in ${outlook.minutesUntilRain} min`
    : later
      ? `Rain in ~${outlook.minutesUntilRain} min`
      : "Dry";

  const maxMm = Math.max(0.5, ...outlook.slots.map((s) => s.precipitationMm));

  return (
    <section className={`card ${border} p-4`} aria-label="Weather">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-3xl leading-none">
            {outlook.current?.temperatureC != null ? `${Math.round(outlook.current.temperatureC)}°` : "--"}
            <span className="ml-2 text-base uppercase tracking-wider text-fg-dim">{outlook.conditionLabel}</span>
          </div>
          <div className="mt-1 text-xs text-fg-muted">
            {target.label} ({kindLabel(target.kind)})
          </div>
        </div>
        <div className="text-right">
          <div className={`font-display text-2xl uppercase leading-none ${tone}`}>{headline}</div>
          <div className="mt-1 text-xs text-fg-muted">{outlook.summary}</div>
        </div>
      </div>

      <div className="mt-3 flex h-8 items-end gap-0.5" aria-hidden>
        {outlook.slots.slice(0, 12).map((s) => {
          const h = Math.max(2, Math.round((s.precipitationMm / maxMm) * 32));
          const wetSlot = s.precipitationMm >= outlook.thresholdMm;
          return (
            <div
              key={s.start}
              title={`${formatTime(s.start)}: ${s.precipitationMm.toFixed(1)} mm`}
              className={`flex-1 rounded-sm ${wetSlot ? "bg-rain" : "bg-surface-3"}`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.65rem] uppercase tracking-wider text-fg-muted">
        <span>now</span>
        <span>+3 h</span>
        <span>{outlook.nextHourTotalMm.toFixed(1)} mm next hour</span>
      </div>
      <div className="mt-2 text-[0.65rem] text-fg-muted">
        Checked {formatTime(outlook.checkedAt)} via {outlook.provider}
        {error ? ` - refresh failed (${error})` : ""}
      </div>
    </section>
  );
}
