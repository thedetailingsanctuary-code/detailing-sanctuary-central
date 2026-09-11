import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { changeLevel, deactivateItem, updateItem, type ItemInput } from "@/lib/stock/store";
import type { StockEventKind } from "@/lib/stock/types";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Body = ItemInput & {
  level?: { kind: Extract<StockEventKind, "adjust" | "restock">; toPercent?: number; deltaPercent?: number; note?: string };
};

/** Edit product details and/or move its level. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Stock needs Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const { level, ...fields } = body;
    let item = Object.keys(fields).length ? await updateItem(id, fields) : null;
    if (level) {
      item = await changeLevel(id, {
        kind: level.kind === "restock" ? "restock" : "adjust",
        toPercent: level.kind === "restock" ? (level.toPercent ?? 100) : level.toPercent,
        deltaPercent: level.deltaPercent,
        note: level.note,
      });
    }
    return NextResponse.json({ item }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Stock needs Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    await deactivateItem(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
