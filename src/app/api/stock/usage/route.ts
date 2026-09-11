import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { STOCK_SERVICES } from "@/lib/stock/services";
import { setUsage } from "@/lib/stock/store";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Set how much of one product a job type uses (0 removes it). */
export async function PUT(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Stock needs Supabase" }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as { serviceKey?: string; itemId?: string; percentPerJob?: number };
    const serviceKey = String(body.serviceKey ?? "");
    const itemId = String(body.itemId ?? "");
    const pct = Number(body.percentPerJob);
    if (!STOCK_SERVICES.some((s) => s.key === serviceKey)) return NextResponse.json({ error: "Unknown job type" }, { status: 400 });
    if (!itemId || !Number.isFinite(pct) || pct < 0 || pct > 100) return NextResponse.json({ error: "Bad values" }, { status: 400 });
    await setUsage(serviceKey, itemId, pct);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
