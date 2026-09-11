import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * Microsoft identity platform (Entra ID) - authorization code flow with PKCE.
 * One client, one set of scopes, used for both the interactive sign-in and the
 * background rain-check job. Phase 2 (writing bookings) only needs
 * "Calendars.ReadWrite" added to GRAPH_SCOPES and a fresh consent.
 * "Mail.Send" lets the quote builder email quotes from the signed-in mailbox.
 */
export const GRAPH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.Read",
  "Mail.Send",
];

const authority = () => `https://login.microsoftonline.com/${env.ms.tenantId}`;

export function redirectUri(): string {
  return `${env.appBaseUrl}/api/auth/callback`;
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function buildAuthorizeUrl(p: { state: string; nonce: string; challenge: string }): string {
  const u = new URL(`${authority()}/oauth2/v2.0/authorize`);
  u.searchParams.set("client_id", env.ms.clientId!);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_mode", "query");
  u.searchParams.set("scope", GRAPH_SCOPES.join(" "));
  u.searchParams.set("state", p.state);
  u.searchParams.set("nonce", p.nonce);
  u.searchParams.set("code_challenge", p.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("prompt", "select_account");
  if (env.ms.allowedEmail) u.searchParams.set("login_hint", env.ms.allowedEmail);
  return u.toString();
}

export type TokenResponse = {
  token_type: string;
  scope?: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
};

export class TokenError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.ms.clientId!,
    client_secret: env.ms.clientSecret!,
    ...params,
  });
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new TokenError(
      json.error_description ?? json.error ?? `Token request failed (${res.status})`,
      json.error ?? "unknown",
    );
  }
  return json;
}

export function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
    scope: GRAPH_SCOPES.join(" "),
  });
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: GRAPH_SCOPES.join(" "),
  });
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export type IdentityClaims = { oid: string; email: string; name: string; tid: string };

export async function verifyIdToken(idToken: string, nonce: string): Promise<IdentityClaims> {
  jwks ??= createRemoteJWKSet(new URL(`${authority()}/discovery/v2.0/keys`));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://login.microsoftonline.com/${env.ms.tenantId}/v2.0`,
    audience: env.ms.clientId,
  });
  if (payload.nonce !== nonce) throw new Error("ID token nonce mismatch");
  return {
    oid: String(payload.oid ?? payload.sub ?? ""),
    email: String(payload.preferred_username ?? payload.email ?? "").toLowerCase(),
    name: String(payload.name ?? ""),
    tid: String(payload.tid ?? ""),
  };
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Belt and braces on top of the single-tenant registration: only the allowed account may pass. */
export function isAllowedUser(u: IdentityClaims): boolean {
  if (
    env.ms.tenantId &&
    GUID_RE.test(env.ms.tenantId) &&
    u.tid &&
    u.tid.toLowerCase() !== env.ms.tenantId.toLowerCase()
  ) {
    return false;
  }
  if (env.ms.allowedOid) return u.oid === env.ms.allowedOid;
  return Boolean(env.ms.allowedEmail) && u.email === env.ms.allowedEmail;
}
