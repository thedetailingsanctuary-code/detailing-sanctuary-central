import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { addVisit, removeVisit, syncPlanVisits } from "@/lib/plans/store";
import { hasSupabase } from "@/lib/supabase";
import { londonDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Record a visit by hand, or re-scan the calendar for missed ones (?sync=1). */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Plans need Supabase" }, { status: 503 });
    if (req.nextUrl.searchParams.get("sync") === "1") {
      return NextResponse.json(await syncPlanVisits(), NO_STORE);
    }
    const body = (await req.json().catch(() => ({}))) as { planId?: string; visitOn?: string; note?: string };
    if (!body.planId) return NextResponse.json({ error: "Which plan?" }, { status: 400 });
    const visit = await addVisit({
      planId: body.planId,
      visitOn: body.visitOn || londonDateKey(new Date()),
      source: "manual",
      note: body.note ?? null,
    });
    return NextResponse.json({ visit }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Plans need Supabase" }, { status: 503 });
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isFinite(id)) return NextResponse.json({ error: "Which visit?" }, { status: 400 });
    await removeVisit(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
