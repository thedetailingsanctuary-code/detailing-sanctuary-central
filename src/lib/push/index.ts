import "server-only";
import { configured } from "@/lib/env";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { FcmProvider } from "./fcm";
import type { PushMessage, PushProvider } from "./types";

export type { PushMessage, PushProvider } from "./types";

export function getPushProvider(): PushProvider {
  if (!configured.push) {
    throw new Error("Push notifications are not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing)");
  }
  return new FcmProvider();
}

export type SendResult = { sent: number; total: number; skipped?: string };

/** Send to every active device token. Dead tokens are switched off automatically. */
export async function sendPushToAll(message: PushMessage): Promise<SendResult> {
  if (!configured.push) return { sent: 0, total: 0, skipped: "push-not-configured" };
  if (!hasSupabase()) return { sent: 0, total: 0, skipped: "supabase-not-configured" };
  const sb = getSupabase();
  const { data, error } = await sb.from("push_tokens").select("token").eq("active", true);
  if (error) throw new Error(`Could not load push tokens: ${error.message}`);
  const tokens = (data ?? []).map((r) => r.token as string);
  if (tokens.length === 0) return { sent: 0, total: 0, skipped: "no-active-tokens" };

  const result = await getPushProvider().send(tokens, message);
  if (result.invalidTokens.length) {
    await sb.from("push_tokens").update({ active: false }).in("token", result.invalidTokens);
  }
  return { sent: result.sent, total: tokens.length };
}
