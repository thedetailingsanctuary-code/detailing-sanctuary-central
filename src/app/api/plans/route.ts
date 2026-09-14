import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { createPlan, getPlansSnapshot, type PlanInput } from "@/lib/plans/store";
import { cadenceFromPlanItemId } from "@/lib/plans/types";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await getPlansSnapshot(), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Plans need Supabase" }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as PlanInput;
    const customerName = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 120) : "";
    if (!customerName) return NextResponse.json({ error: "Give the customer a name" }, { status: 400 });
    const plan = await createPlan({
      ...body,
      customerName,
      planLabel: body.planLabel?.trim() || "Maintenance plan",
      cadence: body.cadence ?? cadenceFromPlanItemId(body.planItemId),
    });
    return NextResponse.json({ plan }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
