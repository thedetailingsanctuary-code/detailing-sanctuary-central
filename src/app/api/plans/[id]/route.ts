import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { deletePlan, updatePlan, type PlanInput } from "@/lib/plans/store";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Plans need Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as PlanInput;
    return NextResponse.json({ plan: await updatePlan(id, body) }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Plans need Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    await deletePlan(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
