import { NextResponse } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getSchedule } from "@/lib/calendar/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    const schedule = await getSchedule();
    return NextResponse.json(schedule, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
