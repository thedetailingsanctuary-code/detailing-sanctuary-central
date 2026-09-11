import { NextResponse } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getStockSnapshot } from "@/lib/stock/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await getStockSnapshot(), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
