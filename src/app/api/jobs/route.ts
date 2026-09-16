import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getJobsSnapshot, pullFromHub } from "@/lib/jobs/store";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
/** The pull calls the hub over the network, so give it room like the spend scan. */
export const maxDuration = 60;

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await getJobsSnapshot(), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

/** ?pull=1 copies jobs down from the hub. Nothing else posts here yet. */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Jobs need Supabase" }, { status: 503 });
    if (req.nextUrl.searchParams.get("pull") !== "1") {
      return NextResponse.json({ error: "Add ?pull=1 to pull jobs from the hub" }, { status: 400 });
    }
    return NextResponse.json(await pullFromHub(), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
