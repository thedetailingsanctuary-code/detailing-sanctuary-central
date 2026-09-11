import { NextResponse } from "next/server";
import { configured, env } from "@/lib/env";
import { buildAuthorizeUrl, pkcePair, randomToken } from "@/lib/auth/oauth";
import { OAUTH_COOKIE, signToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Step 1 of sign-in: send the browser to Microsoft with a one-time state + PKCE challenge. */
export async function GET() {
  if (env.demoMode) return NextResponse.redirect(new URL("/", env.appBaseUrl));
  if (!configured.microsoft) {
    return NextResponse.redirect(new URL("/login?error=not_configured", env.appBaseUrl));
  }

  const { verifier, challenge } = pkcePair();
  const state = randomToken();
  const nonce = randomToken();
  const pending = await signToken({ state, nonce, verifier }, "10m");

  const res = NextResponse.redirect(buildAuthorizeUrl({ state, nonce, challenge }));
  res.cookies.set(OAUTH_COOKIE, pending, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
