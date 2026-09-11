import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { exchangeCode, isAllowedUser, verifyIdToken } from "@/lib/auth/oauth";
import { OAUTH_COOKIE, SESSION_COOKIE, sessionCookieOptions, signSession, verifyToken } from "@/lib/auth/session";
import { saveTokens } from "@/lib/auth/token-store";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Pending = { state: string; nonce: string; verifier: string };

/** Step 2 of sign-in: Microsoft sends the browser back here with a code. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, env.appBaseUrl));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  };

  const oauthError = params.get("error");
  if (oauthError) return fail(oauthError === "access_denied" ? "cancelled" : "microsoft_error");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("missing_code");

  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  const pending = raw ? await verifyToken<Pending>(raw) : null;
  if (!pending || pending.state !== state) return fail("state_mismatch");

  if (!hasSupabase()) return fail("supabase_not_configured");

  try {
    const tokens = await exchangeCode(code, pending.verifier);
    if (!tokens.id_token) return fail("no_id_token");

    const identity = await verifyIdToken(tokens.id_token, pending.nonce);
    if (!isAllowedUser(identity)) {
      console.warn("[auth] rejected sign-in attempt for", identity.email || identity.oid);
      return fail("not_allowed");
    }

    await saveTokens(tokens, identity.email);

    const session = await signSession({ sub: identity.oid, email: identity.email, name: identity.name });
    const res = NextResponse.redirect(new URL("/", env.appBaseUrl));
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (e) {
    console.error("[auth] callback failed", e);
    return fail("exchange_failed");
  }
}
