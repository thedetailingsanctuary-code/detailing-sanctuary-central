import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { setJobStatus } from "@/lib/jobs/store";
import type { JobStatus } from "@/lib/jobs/types";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES: JobStatus[] = ["booked", "done", "invoiced", "paid"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ reference: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Jobs need Supabase" }, { status: 503 });
    const { reference } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { status?: string };

    // Anything else would sit in the status column for good and skew the job counts.
    const status = body.status as JobStatus;
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status must be booked, done, invoiced or paid" }, { status: 400 });
    }

    return NextResponse.json({ job: await setJobStatus(reference, status) }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
