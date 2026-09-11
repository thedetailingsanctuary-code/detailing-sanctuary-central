import { NextResponse } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getPricing } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await getPricing(), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
