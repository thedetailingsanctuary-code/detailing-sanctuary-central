import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getMonth, normaliseMonthKey } from "@/lib/calendar/month";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const monthKey = normaliseMonthKey(req.nextUrl.searchParams.get("month"));
    return NextResponse.json(await getMonth(monthKey), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
