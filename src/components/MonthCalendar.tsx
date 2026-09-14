"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MonthDay, MonthView } from "@/lib/calendar/types";
import { errorMessage, fetchJson, safeParse, UnauthorizedFetch, useLocalStorageValue, writeLocal } from "@/lib/client-hooks";
import {
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  formatTime,
  londonDateKey,
  londonMonthKey,
  mondayFirstIndex,
  monthKeyOf,
} from "@/lib/time";
import { JobRow } from "./JobCard";

const KEY_PREFIX = "dsc_month_v1_";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendar() {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(() => londonMonthKey());
  const [todayKey, setTodayKey] = useState(() => londonDateKey(new Date()));
  const [selected, setSelected] = useState<string | null>(() => londonDateKey(new Date()));
  const [fresh, setFresh] = useState<MonthView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const storageKey = `${KEY_PREFIX}${monthKey}`;
  const cachedRaw = useLocalStorageValue(storageKey);
  const cached = useMemo(() => safeParse<MonthView>(cachedRaw), [cachedRaw]);
  const month = fresh && fresh.monthKey === monthKey ? fresh : cached;

  const load = useCallback(
    (key: string) =>
      fetchJson<MonthView>(`/api/calendar?month=${key}`)
        .then((view) => {
          setFresh(view);
          setFailed(null);
          setTodayKey(londonDateKey(new Date()));
          writeLocal(`${KEY_PREFIX}${view.monthKey}`, view);
        })
        .catch((e: unknown) => {
          if (e instanceof UnauthorizedFetch) router.replace("/login");
          else setFailed(errorMessage(e, "Could not load the calendar"));
        })
        .finally(() => setLoading(false)),
    [router],
  );

  useEffect(() => {
    load(monthKey);
  }, [load, monthKey]);

  const go = useCallback(
    (delta: number) => {
      const next = addMonths(monthKey, delta);
      setFailed(null);
      setLoading(true);
      setMonthKey(next);
      setSelected((s) => (s && monthKeyOf(s) === next ? s : null));
    },
    [monthKey],
  );

  const jumpToToday = useCallback(() => {
    const key = londonDateKey(new Date());
    const nextMonth = monthKeyOf(key);
    setTodayKey(key);
    setSelected(key);
    if (nextMonth !== monthKey) setLoading(true);
    setMonthKey(nextMonth);
  }, [monthKey]);

  const byDate = useMemo(() => {
    const map = new Map<string, MonthDay>();
    for (const d of month?.days ?? []) map.set(d.dateKey, d);
    return map;
  }, [month]);

  const bookedDays = useMemo(() => (month?.days ?? []).filter((d) => d.jobs.length > 0), [month]);
  const selectedDay = selected ? byDate.get(selected) : undefined;
  const isCurrentMonth = monthKey === monthKeyOf(todayKey);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <ArrowButton direction="prev" onClick={() => go(-1)} />
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate font-display text-xl uppercase tracking-wide">{formatMonthLabel(monthKey)}</h1>
          <p className="text-[0.7rem] uppercase tracking-wider text-fg-muted">
            {loading && !month
              ? "Loading..."
              : month
                ? `${month.totals.jobs} ${month.totals.jobs === 1 ? "job" : "jobs"} - ${month.totals.bookedDays} ${
                    month.totals.bookedDays === 1 ? "day" : "days"
                  } - ${month.totals.hours} h`
                : "No data yet"}
          </p>
        </div>
        <ArrowButton direction="next" onClick={() => go(1)} />
      </header>

      {month?.needsReauth && (
        <a href="/api/auth/login" className="card block border-warn/60 p-3 text-sm">
          <span className="font-display uppercase text-warn">Microsoft sign-in needs renewing</span>
          <br />
          Tap here to sign in again - the calendar cannot refresh until you do.
        </a>
      )}

      {month && (failed || month.source === "cache") && (
        <div className="card border-warn/40 p-3 text-xs text-fg-dim">
          Offline or the calendar is unreachable - showing the last copy
          {month.fetchedAt ? ` from ${formatTime(month.fetchedAt)}` : ""}.
        </div>
      )}

      {!month && failed && <div className="card border-danger/40 p-4 text-sm text-fg-dim">{failed}</div>}

      {month?.source === "demo" && <div className="pill border-gold/40 text-gold">Local preview - sample bookings</div>}

      <MonthGrid
        monthKey={monthKey}
        byDate={byDate}
        todayKey={todayKey}
        selected={selected}
        onSelect={(k) => setSelected((s) => (s === k ? null : k))}
        onSwipe={go}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">{loading ? "Updating..." : "Tap a day to see the jobs"}</span>
        <div className="flex gap-2">
          {selected && (
            <button type="button" onClick={() => setSelected(null)} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-3 font-display text-[0.7rem] uppercase tracking-wider text-fg-dim active:scale-95">
              Whole month
            </button>
          )}
          {(!isCurrentMonth || selected !== todayKey) && (
            <button type="button" onClick={jumpToToday} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-3 font-display text-[0.7rem] uppercase tracking-wider text-fg-dim active:scale-95 border-gold/50 text-gold">
              Today
            </button>
          )}
        </div>
      </div>

      {selectedDay ? (
        <section>
          <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">
            {formatDayLabel(selectedDay.dateKey)}
          </h2>
          {selectedDay.jobs.length === 0 ? (
            <p className="card p-4 text-sm text-fg-muted">Nothing booked - a free day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedDay.jobs.map((j) => (
                <JobRow key={j.id} job={j} muted={selectedDay.dateKey < todayKey} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Everything booked this month</h2>
          {bookedDays.length === 0 ? (
            <p className="card p-4 text-sm text-fg-muted">
              {month ? "Nothing booked this month yet." : "Loading the month..."}
            </p>
          ) : (
            bookedDays.map((day) => (
              <div key={day.dateKey}>
                <button
                  type="button"
                  onClick={() => setSelected(day.dateKey)}
                  className="mb-2 flex w-full items-baseline justify-between text-left"
                >
                  <span className={`font-display text-sm uppercase tracking-wider ${day.dateKey === todayKey ? "text-gold" : ""}`}>
                    {formatDayLabel(day.dateKey)}
                  </span>
                  <span className="text-[0.7rem] uppercase tracking-wider text-fg-muted">
                    {day.jobs.length} {day.jobs.length === 1 ? "job" : "jobs"}
                  </span>
                </button>
                <ul className="space-y-2">
                  {day.jobs.map((j) => (
                    <JobRow key={`${day.dateKey}-${j.id}`} job={j} muted={day.dateKey < todayKey} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}

function MonthGrid({
  monthKey,
  byDate,
  todayKey,
  selected,
  onSelect,
  onSwipe,
}: {
  monthKey: string;
  byDate: Map<string, MonthDay>;
  todayKey: string;
  selected: string | null;
  onSelect: (dateKey: string) => void;
  onSwipe: (delta: number) => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const days = useMemo(() => [...byDate.keys()], [byDate]);
  const lead = days.length ? mondayFirstIndex(days[0]) : mondayFirstIndex(`${monthKey}-01`);

  return (
    <section
      className="card p-2"
      aria-label={`${formatMonthLabel(monthKey)} calendar`}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center font-display text-[0.62rem] uppercase tracking-wider text-fg-muted">
            {w.slice(0, 2)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((dateKey) => {
          const day = byDate.get(dateKey);
          const count = day?.jobs.length ?? 0;
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selected;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelect(dateKey)}
              aria-pressed={isSelected}
              aria-label={`${formatDayLabel(dateKey)} - ${count === 0 ? "nothing booked" : `${count} ${count === 1 ? "job" : "jobs"}`}`}
              className={`flex aspect-square min-h-11 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors ${
                isSelected
                  ? "border-gold bg-gold font-semibold text-ink"
                  : count > 0
                    ? "border-gold/30 bg-surface-2"
                    : "border-transparent bg-surface-1 text-fg-muted"
              } ${isToday && !isSelected ? "border-gold/80 text-gold" : ""}`}
            >
              <span className="font-display leading-none">{Number(dateKey.slice(-2))}</span>
              <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                {count > 3 ? (
                  <span className={`text-[0.55rem] leading-none ${isSelected ? "text-ink" : "text-gold"}`}>{count}</span>
                ) : (
                  Array.from({ length: count }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1 w-1 rounded-full ${isSelected ? "bg-ink" : "bg-gold"}`}
                    />
                  ))
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ArrowButton({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong text-fg active:scale-95"
      aria-label={direction === "prev" ? "Previous month" : "Next month"}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
        <path d={direction === "prev" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}
