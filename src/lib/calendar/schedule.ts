import "server-only";
import { configured, env } from "@/lib/env";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { addDays, londonDateKey, londonMidnight } from "@/lib/time";
import { ReauthRequiredError } from "@/lib/auth/token-store";
import { fetchCalendarView } from "./graph";
import { toJob } from "./parse";
import { demoJobs } from "./demo";
import type { Job, Schedule, ScheduleSource } from "./types";

const CACHE_ROW = "primary";

function assemble(jobs: Job[], now: Date, source: ScheduleSource, fetchedAt: string): Schedule {
  const todayKey = londonDateKey(now);
  const tomorrowKey = addDays(todayKey, 1);
  const t0 = londonMidnight(todayKey).getTime();
  const t1 = londonMidnight(tomorrowKey).getTime();
  const t2 = londonMidnight(addDays(todayKey, 2)).getTime();
  const ms = (iso: string) => new Date(iso).getTime();

  const sorted = [...jobs].sort((a, b) => ms(a.start) - ms(b.start));
  const overlaps = (j: Job, from: number, to: number) => ms(j.start) < to && ms(j.end) > from;
  const today = sorted.filter((j) => overlaps(j, t0, t1));
  const tomorrow = sorted.filter((j) => overlaps(j, t1, t2) && ms(j.start) >= t1);

  const nowMs = now.getTime();
  const current = sorted.find((j) => !j.isAllDay && ms(j.start) <= nowMs && ms(j.end) > nowMs) ?? null;
  const next = sorted.find((j) => !j.isAllDay && ms(j.start) > nowMs) ?? null;

  return {
    generatedAt: now.toISOString(),
    fetchedAt,
    source,
    todayKey,
    tomorrowKey,
    today,
    tomorrow,
    current,
    next,
  };
}

async function writeCache(jobs: Job[], fetchedAt: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    await getSupabase().from("calendar_cache").upsert({ id: CACHE_ROW, payload: jobs, fetched_at: fetchedAt });
  } catch (e) {
    console.warn("[schedule] cache write failed", e);
  }
}

async function readCache(): Promise<{ jobs: Job[]; fetchedAt: string } | null> {
  if (!hasSupabase()) return null;
  try {
    const { data } = await getSupabase()
      .from("calendar_cache")
      .select("payload,fetched_at")
      .eq("id", CACHE_ROW)
      .maybeSingle();
    if (!data?.payload) return null;
    return { jobs: data.payload as Job[], fetchedAt: data.fetched_at as string };
  } catch {
    return null;
  }
}

/** Today + tomorrow from Outlook, with the last good copy as a fallback. */
export async function getSchedule(now: Date = new Date()): Promise<Schedule> {
  if (env.demoMode || !configured.microsoft) {
    return assemble(demoJobs(now), now, "demo", now.toISOString());
  }

  const todayKey = londonDateKey(now);
  const start = londonMidnight(todayKey);
  const end = londonMidnight(addDays(todayKey, 2));

  try {
    const events = await fetchCalendarView(start.toISOString(), end.toISOString());
    const jobs = events.filter((e) => !e.isCancelled).map(toJob);
    const fetchedAt = now.toISOString();
    await writeCache(jobs, fetchedAt);
    return assemble(jobs, now, "live", fetchedAt);
  } catch (e) {
    const needsReauth = e instanceof ReauthRequiredError;
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[schedule] live fetch failed, using cache:", message);
    const cached = await readCache();
    const base = cached
      ? assemble(cached.jobs, now, "cache", cached.fetchedAt)
      : assemble([], now, "cache", "");
    return { ...base, needsReauth, error: message };
  }
}
