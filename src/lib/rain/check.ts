import "server-only";
import { getSchedule } from "@/lib/calendar/schedule";
import { sendPushToAll } from "@/lib/push";
import { getSettings, type AppSettings } from "@/lib/settings";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { londonMinutesOfDay, londonParts, parseHHMM } from "@/lib/time";
import { getRainOutlookFor, resolveWatchTarget } from "./watch";

export function withinBusinessHours(now: Date, hours: AppSettings["businessHours"]): boolean {
  const p = londonParts(now);
  if (!hours.days.includes(p.weekday)) return false;
  const mins = londonMinutesOfDay(now);
  return mins >= parseHHMM(hours.start) && mins < parseHHMM(hours.end);
}

async function recentlyAlerted(locationKey: string, reason: string, cooldownMinutes: number, now: Date): Promise<boolean> {
  if (!hasSupabase()) return false;
  const since = new Date(now.getTime() - cooldownMinutes * 60000).toISOString();
  const { data } = await getSupabase()
    .from("alert_log")
    .select("id")
    .eq("location_key", locationKey)
    .eq("reason", reason)
    .gte("sent_at", since)
    .limit(1);
  return Boolean(data && data.length > 0);
}

type AlertEntry = {
  location_key: string;
  reason: string;
  job_id: string | null;
  title: string;
  body: string;
  sent_at: string;
  payload: unknown;
};

async function logAlert(entry: AlertEntry): Promise<void> {
  if (!hasSupabase()) return;
  try {
    await getSupabase().from("alert_log").insert(entry);
  } catch (e) {
    console.warn("[rain] alert log failed", e);
  }
}

export type RainCheckResult = {
  ran: boolean;
  reason?: string;
  londonTime: string;
  target?: {
    kind: string;
    label: string;
    address: string | null;
    jobId: string | null;
    customer: string | null;
    locationSource: string;
  };
  outlook?: {
    summary: string;
    rainWithinLead: boolean;
    minutesUntilRain: number | null;
    nextHourTotalMm: number;
    provider: string;
  };
  alert?: { sent: boolean; reason: string; devices?: number };
  schedule?: { source: string; needsReauth: boolean; error?: string };
};

/** One pass of the rain watch. Called by the cron every 15 minutes in business hours. */
export async function runRainCheck(opts: { force?: boolean; now?: Date } = {}): Promise<RainCheckResult> {
  const now = opts.now ?? new Date();
  const p = londonParts(now);
  const londonTime = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const settings = await getSettings();

  if (!opts.force && !withinBusinessHours(now, settings.businessHours)) {
    return { ran: false, reason: "outside-business-hours", londonTime };
  }

  const schedule = await getSchedule(now);
  const target = await resolveWatchTarget(schedule, settings, now);
  const outlook = await getRainOutlookFor(target, settings, now);

  const result: RainCheckResult = {
    ran: true,
    londonTime,
    target: {
      kind: target.kind,
      label: target.label,
      address: target.address,
      jobId: target.job?.id ?? null,
      customer: target.job?.customerName ?? null,
      locationSource: target.locationSource,
    },
    outlook: {
      summary: outlook.summary,
      rainWithinLead: outlook.rainWithinLead,
      minutesUntilRain: outlook.minutesUntilRain,
      nextHourTotalMm: outlook.nextHourTotalMm,
      provider: outlook.provider,
    },
    schedule: { source: schedule.source, needsReauth: Boolean(schedule.needsReauth), error: schedule.error },
  };

  if (schedule.needsReauth) {
    const key = "microsoft-reauth";
    if (opts.force || !(await recentlyAlerted(key, "reauth", 12 * 60, now))) {
      const title = "Rain alerts paused";
      const body = "Microsoft sign-in has expired. Open DS Central and sign in again to resume calendar checks.";
      const r = await sendPushToAll({ title, body, url: "/login", tag: "reauth" });
      await logAlert({
        location_key: key,
        reason: "reauth",
        job_id: null,
        title,
        body,
        sent_at: now.toISOString(),
        payload: { devices: r },
      });
    }
  }

  if (!outlook.rainWithinLead) {
    result.alert = { sent: false, reason: "no-rain-within-lead" };
    return result;
  }

  const locationKey = `${target.location.lat.toFixed(3)},${target.location.lng.toFixed(3)}`;
  if (!opts.force && (await recentlyAlerted(locationKey, "rain", settings.rainAlert.cooldownMinutes, now))) {
    result.alert = { sent: false, reason: "cooldown" };
    return result;
  }

  const where =
    target.kind === "home-base"
      ? `Home base (${target.label})`
      : `${target.job?.customerName ?? target.job?.service ?? "the job"} - ${target.label}`;
  const title =
    outlook.minutesUntilRain === 0 ? "Rain starting now" : `Rain in about ${outlook.minutesUntilRain} min`;
  const body = `${where}. ${outlook.summary}. Around ${outlook.nextHourTotalMm.toFixed(1)} mm in the next hour.`;

  const r = await sendPushToAll({ title, body, url: "/", tag: "rain-alert" });
  await logAlert({
    location_key: locationKey,
    reason: "rain",
    job_id: target.job?.id ?? null,
    title,
    body,
    sent_at: now.toISOString(),
    payload: { target: result.target, outlook: result.outlook, devices: r },
  });
  result.alert = {
    sent: r.sent > 0,
    reason: r.sent > 0 ? "sent" : (r.skipped ?? "no-devices"),
    devices: r.sent,
  };
  return result;
}
