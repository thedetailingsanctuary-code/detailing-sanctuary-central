import "server-only";
import type { Job, Schedule } from "@/lib/calendar/types";
import { geocodeAddress } from "@/lib/geo/geocode";
import type { AppSettings } from "@/lib/settings";
import { minutesUntil, sameLondonDay } from "@/lib/time";
import { getWeatherProvider, type LatLng, type RainOutlook } from "@/lib/weather";

export type WatchKind = "current-job" | "upcoming-job" | "next-job" | "home-base";

export type WatchTarget = {
  kind: WatchKind;
  label: string;
  address: string | null;
  job: Job | null;
  location: LatLng;
  locationSource: string;
};

async function locate(job: Job): Promise<{ location: LatLng; source: string } | null> {
  if (job.coordinates) return { location: job.coordinates, source: "calendar" };
  if (!job.address) return null;
  const g = await geocodeAddress(job.address);
  return g ? { location: { lat: g.lat, lng: g.lng }, source: g.source } : null;
}

/**
 * Where should we look at the sky?
 *  - a job in progress -> that job
 *  - otherwise the next job today if it starts soon (cron) or at all (dashboard)
 *  - otherwise home base (Wolverhampton WV3)
 */
export async function resolveWatchTarget(
  schedule: Schedule,
  settings: AppSettings,
  now: Date = new Date(),
  opts: { preferNextJob?: boolean } = {},
): Promise<WatchTarget> {
  const candidates: Array<{ kind: WatchKind; job: Job }> = [];
  if (schedule.current) {
    candidates.push({ kind: "current-job", job: schedule.current });
  } else if (schedule.next && sameLondonDay(schedule.next.start, now)) {
    const mins = minutesUntil(schedule.next.start, now);
    if (mins <= settings.rainAlert.upcomingJobWindowMinutes) {
      candidates.push({ kind: "upcoming-job", job: schedule.next });
    } else if (opts.preferNextJob) {
      candidates.push({ kind: "next-job", job: schedule.next });
    }
  }

  for (const c of candidates) {
    const found = await locate(c.job);
    if (found) {
      return {
        kind: c.kind,
        label: c.job.postcode ?? c.job.address ?? c.job.service,
        address: c.job.address,
        job: c.job,
        location: found.location,
        locationSource: found.source,
      };
    }
  }

  return {
    kind: "home-base",
    label: settings.homeBase.label,
    address: settings.homeBase.postcode,
    job: null,
    location: { lat: settings.homeBase.lat, lng: settings.homeBase.lng },
    locationSource: "settings",
  };
}

export function getRainOutlookFor(
  target: WatchTarget,
  settings: AppSettings,
  now: Date = new Date(),
): Promise<RainOutlook> {
  return getWeatherProvider().getRainOutlook(target.location, {
    leadMinutes: settings.rainAlert.leadMinutes,
    thresholdMm: settings.rainAlert.thresholdMm,
    now,
  });
}
