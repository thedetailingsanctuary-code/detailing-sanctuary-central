import "server-only";
import { configured, env } from "@/lib/env";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { addMonths, londonMidnight, londonMonthKey, monthDayKeys } from "@/lib/time";
import { ReauthRequiredError } from "@/lib/auth/token-store";
import { fetchCalendarView } from "./graph";
import { toJob } from "./parse";
import { demoMonthJobs } from "./demo";
import type { Job, MonthDay, MonthView, ScheduleSource } from "./types";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Accepts "YYYY-MM"; anything odd falls back to the current month. */
export function normaliseMonthKey(raw: string | null | undefined, now: Date = new Date()): string {
  return raw && MONTH_RE.test(raw) ? raw : londonMonthKey(now);
}

function assemble(monthKey: string, jobs: Job[], now: Date, source: ScheduleSource, fetchedAt: string): MonthView {
  const ms = (iso: string) => new Date(iso).getTime();
  const sorted = [...jobs].sort((a, b) => ms(a.start) - ms(b.start));

  const days: MonthDay[] = monthDayKeys(monthKey).map((dateKey) => {
    const from = londonMidnight(dateKey).getTime();
    const to = from + 24 * 60 * 60 * 1000;
    // A job belongs to every day it touches, so an all-day or overrunning job shows on each.
    const dayJobs = sorted.filter((j) => ms(j.start) < to && Math.max(ms(j.end), ms(j.start) + 1) > from);
    const minutes = dayJobs.reduce(
      (sum, j) => (j.isAllDay ? sum : sum + Math.max(0, Math.min(ms(j.end), to) - Math.max(ms(j.start), from)) / 60000),
      0,
    );
    return { dateKey, jobs: dayJobs, minutes: Math.round(minutes) };
  });

  const bookedDays = days.filter((d) => d.jobs.length > 0).length;
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);

  return {
    monthKey,
    generatedAt: now.toISOString(),
    fetchedAt,
    source,
    days,
    totals: { jobs: sorted.length, bookedDays, hours: Math.round((totalMinutes / 60) * 10) / 10 },
  };
}

const cacheId = (monthKey: string) => `month-${monthKey}`;

async function writeCache(monthKey: string, jobs: Job[], fetchedAt: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    await getSupabase().from("calendar_cache").upsert({ id: cacheId(monthKey), payload: jobs, fetched_at: fetchedAt });
  } catch (e) {
    console.warn("[month] cache write failed", e);
  }
}

async function readCache(monthKey: string): Promise<{ jobs: Job[]; fetchedAt: string } | null> {
  if (!hasSupabase()) return null;
  try {
    const { data } = await getSupabase()
      .from("calendar_cache")
      .select("payload,fetched_at")
      .eq("id", cacheId(monthKey))
      .maybeSingle();
    if (!data?.payload) return null;
    return { jobs: data.payload as Job[], fetchedAt: data.fetched_at as string };
  } catch {
    return null;
  }
}

/** One whole month from Outlook, with the last good copy of that month as a fallback. */
export async function getMonth(monthKey: string, now: Date = new Date()): Promise<MonthView> {
  if (env.demoMode || !configured.microsoft) {
    return assemble(monthKey, demoMonthJobs(monthKey), now, "demo", now.toISOString());
  }

  const start = londonMidnight(`${monthKey}-01`);
  const end = londonMidnight(`${addMonths(monthKey, 1)}-01`);

  try {
    const events = await fetchCalendarView(start.toISOString(), end.toISOString());
    const jobs = events.filter((e) => !e.isCancelled).map(toJob);
    const fetchedAt = now.toISOString();
    await writeCache(monthKey, jobs, fetchedAt);
    return assemble(monthKey, jobs, now, "live", fetchedAt);
  } catch (e) {
    const needsReauth = e instanceof ReauthRequiredError;
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[month] live fetch failed, using cache:", message);
    const cached = await readCache(monthKey);
    const base = cached
      ? assemble(monthKey, cached.jobs, now, "cache", cached.fetchedAt)
      : assemble(monthKey, [], now, "cache", "");
    return { ...base, needsReauth, error: message };
  }
}
