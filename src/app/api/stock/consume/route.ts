import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { alertLowStock, consumeForJob } from "@/lib/stock/consume";
import { STOCK_SERVICES } from "@/lib/stock/services";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Deduct stock for a job by hand (or re-run one that was skipped, with a chosen job type). */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Stock needs Supabase" }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as { jobId?: string; title?: string; serviceKey?: string };
    const jobId = String(body.jobId ?? "").trim();
    const title = String(body.title ?? "").trim().slice(0, 200);
    const serviceKey = body.serviceKey && STOCK_SERVICES.some((s) => s.key === body.serviceKey) ? body.serviceKey : null;
    if (!jobId || !title) return NextResponse.json({ error: "Missing job" }, { status: 400 });
    const result = await consumeForJob({ jobId, title, serviceKey, force: Boolean(serviceKey) });
    const { notified } = await alertLowStock();
    return NextResponse.json({ result, lowNotified: notified }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
