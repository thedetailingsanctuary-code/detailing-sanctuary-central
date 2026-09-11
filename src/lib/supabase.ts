import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { configured, env } from "./env";

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the service role key. Never exposed to the browser. */
export function getSupabase(): SupabaseClient {
  if (!configured.supabase) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
  }
  client ??= createClient(env.supabase.url!, env.supabase.serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function hasSupabase(): boolean {
  return configured.supabase;
}
