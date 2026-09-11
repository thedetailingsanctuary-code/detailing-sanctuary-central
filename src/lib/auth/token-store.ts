import "server-only";
import { env } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";
import { decrypt, encrypt } from "./crypto";
import { refreshTokens, TokenError, type TokenResponse } from "./oauth";

/**
 * Stores the Microsoft refresh token (encrypted) so the background rain-check
 * can read the calendar without a manual sign-in each time.
 */
type TokenRow = {
  id: string;
  account_email: string | null;
  refresh_token_enc: string | null;
  access_token_enc: string | null;
  access_expires_at: string | null;
  needs_reauth: boolean;
  updated_at: string;
};

const ROW_ID = "primary";

export class ReauthRequiredError extends Error {}

export async function saveTokens(t: TokenResponse, accountEmail: string): Promise<void> {
  const secret = env.sessionSecret!;
  const sb = getSupabase();
  const existing = await sb.from("ms_tokens").select("refresh_token_enc").eq("id", ROW_ID).maybeSingle();
  const refreshEnc = t.refresh_token
    ? encrypt(t.refresh_token, secret)
    : (existing.data?.refresh_token_enc ?? null);
  const { error } = await sb.from("ms_tokens").upsert({
    id: ROW_ID,
    account_email: accountEmail,
    refresh_token_enc: refreshEnc,
    access_token_enc: encrypt(t.access_token, secret),
    access_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    needs_reauth: false,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save Microsoft tokens: ${error.message}`);
}

export async function getGraphAccessToken(): Promise<string> {
  const secret = env.sessionSecret;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const sb = getSupabase();
  const { data, error } = await sb.from("ms_tokens").select("*").eq("id", ROW_ID).maybeSingle<TokenRow>();
  if (error) throw new Error(`Could not read Microsoft tokens: ${error.message}`);
  if (!data?.refresh_token_enc) {
    throw new ReauthRequiredError("Microsoft account is not connected yet - sign in once from the app.");
  }
  if (data.needs_reauth) {
    throw new ReauthRequiredError("Microsoft sign-in has expired - open the app and sign in again.");
  }

  const msLeft = data.access_expires_at ? new Date(data.access_expires_at).getTime() - Date.now() : 0;
  if (data.access_token_enc && msLeft > 5 * 60 * 1000) {
    return decrypt(data.access_token_enc, secret);
  }

  try {
    const fresh = await refreshTokens(decrypt(data.refresh_token_enc, secret));
    await saveTokens(fresh, data.account_email ?? "");
    return fresh.access_token;
  } catch (e) {
    if (
      e instanceof TokenError &&
      ["invalid_grant", "interaction_required", "consent_required"].includes(e.code)
    ) {
      await sb
        .from("ms_tokens")
        .update({ needs_reauth: true, updated_at: new Date().toISOString() })
        .eq("id", ROW_ID);
      throw new ReauthRequiredError(`Microsoft sign-in needs renewing (${e.code}).`);
    }
    throw e;
  }
}

export type MicrosoftStatus = {
  connected: boolean;
  needsReauth: boolean;
  email: string | null;
  updatedAt: string | null;
};

export async function microsoftConnectionStatus(): Promise<MicrosoftStatus> {
  const { data } = await getSupabase()
    .from("ms_tokens")
    .select("account_email,needs_reauth,refresh_token_enc,updated_at")
    .eq("id", ROW_ID)
    .maybeSingle<TokenRow>();
  return {
    connected: Boolean(data?.refresh_token_enc),
    needsReauth: Boolean(data?.needs_reauth),
    email: data?.account_email ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}
