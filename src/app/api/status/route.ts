import { NextResponse } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { microsoftConnectionStatus, type MicrosoftStatus } from "@/lib/auth/token-store";
import { configured, env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export type StatusResponse = {
  demoMode: boolean;
  appBaseUrl: string;
  weatherProvider: string;
  configured: typeof configured;
  microsoft: MicrosoftStatus | null;
  activeDevices: number | null;
  lastAlert: { sentAt: string; title: string | null; reason: string } | null;
  settings: Awaited<ReturnType<typeof getSettings>>;
};

/** Never returns secrets - only whether each piece is set up and healthy. */
export async function GET() {
  try {
    await requireSession();
    let microsoft: MicrosoftStatus | null = null;
    let activeDevices: number | null = null;
    let lastAlert: StatusResponse["lastAlert"] = null;

    if (hasSupabase()) {
      const sb = getSupabase();
      if (configured.microsoft) microsoft = await microsoftConnectionStatus();
      const { count } = await sb.from("push_tokens").select("token", { count: "exact", head: true }).eq("active", true);
      activeDevices = count ?? 0;
      const { data } = await sb
        .from("alert_log")
        .select("sent_at,title,reason")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ sent_at: string; title: string | null; reason: string }>();
      if (data) lastAlert = { sentAt: data.sent_at, title: data.title, reason: data.reason };
    }

    const body: StatusResponse = {
      demoMode: env.demoMode,
      appBaseUrl: env.appBaseUrl,
      weatherProvider: env.weatherProvider,
      configured,
      microsoft,
      activeDevices,
      lastAlert,
      settings: await getSettings(),
    };
    return NextResponse.json(body, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
