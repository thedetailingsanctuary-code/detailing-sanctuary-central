import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { STOCK_SERVICES } from "@/lib/stock/services";
import { saveStockSettings } from "@/lib/stock/store";
import type { StockAlias } from "@/lib/stock/types";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Update automatic deduction, nag interval and job-name matching rules. */
export async function PUT(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Stock needs Supabase" }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as { autoDeduct?: boolean; alertRepeatDays?: number; aliases?: StockAlias[] };
    const patch: Record<string, unknown> = {};
    if (typeof body.autoDeduct === "boolean") patch.autoDeduct = body.autoDeduct;
    if (Number.isFinite(body.alertRepeatDays)) patch.alertRepeatDays = Math.max(1, Math.min(60, Number(body.alertRepeatDays)));
    if (Array.isArray(body.aliases)) {
      patch.aliases = body.aliases
        .filter((a) => a && typeof a.match === "string" && STOCK_SERVICES.some((s) => s.key === a.serviceKey))
        .map((a) => ({ match: a.match.trim().toLowerCase().slice(0, 60), serviceKey: a.serviceKey }))
        .filter((a) => a.match.length > 0)
        .slice(0, 100);
    }
    const settings = await saveStockSettings(patch);
    return NextResponse.json({ settings }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
