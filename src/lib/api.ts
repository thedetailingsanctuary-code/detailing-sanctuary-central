import "server-only";
import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";

export function apiError(e: unknown): NextResponse {
  if (e instanceof UnauthorizedError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  console.error("[api]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}

export const NO_STORE = { headers: { "cache-control": "no-store" } } as const;
