import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Save (or refresh) this device's FCM token so the rain-check can reach it. */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) {
      return NextResponse.json({ error: "Supabase is not configured; tokens cannot be stored" }, { status: 503 });
    }
    const body = (await req.json().catch(() => null)) as { token?: string; userAgent?: string } | null;
    const token = body?.token?.trim();
    if (!token || token.length < 20) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const { error } = await getSupabase().from("push_tokens").upsert({
      token,
      platform: "web",
      user_agent: (body?.userAgent ?? "").slice(0, 400),
      active: true,
      last_seen_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
