import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { apiError, NO_STORE } from "@/lib/api";
import { env } from "@/lib/env";
import { runRainCheck } from "@/lib/rain/check";
import { runStockDeductions } from "@/lib/stock/consume";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Accepts either Vercel Cron (Authorization: Bearer CRON_SECRET, added automatically)
 * or any external scheduler sending the x-cron-secret header.
 */
function authorised(req: NextRequest): boolean {
  const secret = env.cronSecret;
  if (!secret) return env.demoMode; // local preview only
  const bearer = req.headers.get("authorization") ?? "";
  const header = req.headers.get("x-cron-secret") ?? "";
  return safeEqual(bearer, `Bearer ${secret}`) || safeEqual(header, secret);
}

async function handle(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json(
      { error: env.cronSecret ? "unauthorized" : "CRON_SECRET is not set" },
      { status: 401 },
    );
  }
  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    const result = await runRainCheck({ force });
    // Same 15-minute tick also takes finished jobs' chemicals off the shelf.
    let stock: Awaited<ReturnType<typeof runStockDeductions>> | { error: string };
    try {
      stock = await runStockDeductions();
    } catch (e) {
      stock = { error: e instanceof Error ? e.message : "stock deduction failed" };
    }
    return NextResponse.json({ ...result, stock }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
