import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { createPurchase, getSpendSnapshot, scanSupplierEmails } from "@/lib/spend/store";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();
    return NextResponse.json(await getSpendSnapshot(year), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

/** ?scan=1 reads supplier emails; otherwise adds a purchase by hand. */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Spend needs Supabase" }, { status: 503 });
    if (req.nextUrl.searchParams.get("scan") === "1") {
      return NextResponse.json(await scanSupplierEmails(), NO_STORE);
    }
    const body = (await req.json().catch(() => ({}))) as { supplier?: string; totalPence?: number; purchasedOn?: string; note?: string };
    const supplier = body.supplier?.trim();
    if (!supplier) return NextResponse.json({ error: "Which supplier?" }, { status: 400 });
    if (!Number.isFinite(body.totalPence) || (body.totalPence ?? 0) <= 0) {
      return NextResponse.json({ error: "How much was it?" }, { status: 400 });
    }
    const purchase = await createPurchase({
      supplier,
      totalPence: body.totalPence!,
      purchasedOn: body.purchasedOn,
      note: body.note ?? null,
    });
    return NextResponse.json({ purchase }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
