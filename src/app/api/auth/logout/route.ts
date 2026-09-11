import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function signOut() {
  const res = NextResponse.redirect(new URL("/login", env.appBaseUrl), { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function POST() {
  return signOut();
}

export async function GET() {
  return signOut();
}
