import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { deletePurchase, updatePurchase, type PurchaseInput } from "@/lib/spend/store";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Spend needs Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as PurchaseInput;
    return NextResponse.json({ purchase: await updatePurchase(id, body) }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Spend needs Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    await deletePurchase(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
