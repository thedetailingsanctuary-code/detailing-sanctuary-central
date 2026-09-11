import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { createItem, type ItemInput } from "@/lib/stock/store";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Stock needs Supabase" }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as ItemInput & { levelPercent?: number };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Give the product a name" }, { status: 400 });
    const item = await createItem({ ...body, name });
    return NextResponse.json({ item }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
