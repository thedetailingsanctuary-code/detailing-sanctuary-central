"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Job, Schedule } from "@/lib/calendar/types";
import { errorMessage, fetchJson, safeParse, UnauthorizedFetch, useLocalStorageValue, writeLocal } from "@/lib/client-hooks";
import { formatDayLabel, formatTime, londonDateKey } from "@/lib/time";
import { HeroJobCard, JobRow } from "./JobCard";
import { WeatherTile } from "./WeatherTile";

const KEY = "dsc_schedule_v1";

function derive(schedule: Schedule, nowMs: number): { current: Job | null; next: Job | null } {
  const all = [...schedule.today, ...schedule.tomorrow].filter((j) => !j.isAllDay);
  const ms = (iso: string) => new Date(iso).getTime();
  const current = all.find((j) => ms(j.start) <= nowMs && ms(j.end) > nowMs) ?? null;
  const next = all.find((j) => ms(j.start) > nowMs) ?? null;
  return { current, next };
}

export function ScheduleView() {
  const router = useRouter();
  const cachedRaw = useLocalStorageValue(KEY);
  const cached = useMemo(() => safeParse<Schedule>(cachedRaw), [cachedRaw]);
  const [fresh, setFresh] = useState<Schedule | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(
    () =>
      fetchJson<Schedule>("/api/schedule")
        .then((schedule) => {
          setFresh(schedule);
          setFailed(null);
          setNowMs(Date.now());
          writeLocal(KEY, schedule);
        })
        .catch((e: unknown) => {
          if (e instanceof UnauthorizedFetch) router.replace("/login");
          else setFailed(errorMessage(e, "Could not refresh"));
        })
        .finally(() => setLoading(false)),
    [router],
  );

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(tick);
    };
  }, [load]);

  const schedule = fresh ?? cached;
  const todayKey = londonDateKey(new Date(nowMs));
  const stale = schedule ? schedule.todayKey !== todayKey : false;
  const derived = useMemo(
    () => (schedule ? derive(schedule, nowMs) : { current: null, next: null }),
    [schedule, nowMs],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl uppercase tracking-wide">{formatDayLabel(todayKey)}</h1>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="btn btn-ghost min-h-10 px-3 text-xs"
          disabled={loading}
        >
          {loading ? "Updating..." : "Refresh"}
        </button>
      </div>

      {schedule?.needsReauth && (
        <a href="/api/auth/login" className="card block border-warn/60 p-3 text-sm">
          <span className="font-display uppercase text-warn">Microsoft sign-in needs renewing</span>
          <br />
          Tap here to sign in again. Rain alerts and the schedule are paused until you do.
        </a>
      )}

      {schedule && (failed || stale || schedule.source === "cache") && (
        <div className="card border-warn/40 p-3 text-xs text-fg-dim">
          {stale
            ? `Showing the last copy from ${formatDayLabel(schedule.todayKey)} - could not reach the calendar yet.`
            : failed
              ? `Offline or signal is poor - showing the last copy from ${formatTime(schedule.fetchedAt || schedule.generatedAt)}.`
              : `Calendar unreachable - showing the last good copy${schedule.fetchedAt ? ` from ${formatTime(schedule.fetchedAt)}` : ""}.`}
        </div>
      )}

      {schedule?.source === "demo" && <div className="pill border-gold/40 text-gold">Local preview - sample bookings</div>}

      {!schedule && (
        <section className="card p-6 text-center text-fg-muted">{failed ?? "Loading your schedule..."}</section>
      )}

      {schedule && derived.current && <HeroJobCard job={derived.current} status="now" now={nowMs} />}
      {schedule && !derived.current && derived.next && <HeroJobCard job={derived.next} status="next" now={nowMs} />}
      {schedule && !derived.current && !derived.next && (
        <section className="card-gold p-5 text-center">
          <div className="font-display text-2xl uppercase">Nothing else booked</div>
          <p className="mt-1 text-sm text-fg-dim">No more jobs today or tomorrow.</p>
        </section>
      )}

      <WeatherTile />

      {schedule && (
        <>
          <DayList title="Today" jobs={schedule.today} nowMs={nowMs} />
          <DayList title={`Tomorrow - ${formatDayLabel(schedule.tomorrowKey)}`} jobs={schedule.tomorrow} nowMs={nowMs} />
        </>
      )}
    </div>
  );
}

function DayList({ title, jobs, nowMs }: { title: string; jobs: Job[]; nowMs: number }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">{title}</h2>
      {jobs.length === 0 ? (
        <p className="card p-4 text-sm text-fg-muted">No jobs booked.</p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <JobRow key={j.id} job={j} muted={new Date(j.end).getTime() < nowMs} />
          ))}
        </ul>
      )}
    </section>
  );
}
