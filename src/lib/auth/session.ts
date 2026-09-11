import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "dsc_session";
export const OAUTH_COOKIE = "dsc_oauth";
const SESSION_DAYS = 30;

export type Session = { sub: string; email: string; name: string; demo?: boolean };

export class UnauthorizedError extends Error {}

function secretKey(): Uint8Array {
  if (!env.sessionSecret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(env.sessionSecret);
}

export async function signToken(payload: JWTPayload, expiresIn: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyToken<T extends JWTPayload = JWTPayload>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as T;
  } catch {
    return null;
  }
}

export function signSession(s: Session): Promise<string> {
  return signToken({ sub: s.sub, email: s.email, name: s.name }, `${SESSION_DAYS}d`);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function getSession(): Promise<Session | null> {
  if (env.demoMode) {
    return { sub: "demo", email: "demo@local", name: "Local preview", demo: true };
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.sub) return null;
  return { sub: String(payload.sub), email: String(payload.email ?? ""), name: String(payload.name ?? "") };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new UnauthorizedError("Not signed in");
  return s;
}
