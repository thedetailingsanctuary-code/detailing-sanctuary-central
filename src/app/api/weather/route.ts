import { NextResponse } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getSchedule } from "@/lib/calendar/schedule";
import { getRainOutlookFor, resolveWatchTarget } from "@/lib/rain/watch";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Weather where the work is: current job, else the next job today, else home base. */
export async function GET() {
  try {
    await requireSession();
    const now = new Date();
    const [schedule, settings] = await Promise.all([getSchedule(now), getSettings()]);
    const target = await resolveWatchTarget(schedule, settings, now, { preferNextJob: true });
    const outlook = await getRainOutlookFor(target, settings, now);
    return NextResponse.json(
      {
        target: {
          kind: target.kind,
          label: target.label,
          address: target.address,
          jobId: target.job?.id ?? null,
          customerName: target.job?.customerName ?? null,
          service: target.job?.service ?? null,
          locationSource: target.locationSource,
        },
        outlook,
        settings: { rainAlert: settings.rainAlert, businessHours: settings.businessHours },
      },
      NO_STORE,
    );
  } catch (e) {
    return apiError(e);
  }
}
