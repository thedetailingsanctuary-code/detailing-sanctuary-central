import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { createPayment, getPaymentsSnapshot, type CreatePaymentInput } from "@/lib/payments/store";
import type { PaymentKind } from "@/lib/payments/types";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await getPaymentsSnapshot(), NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

const KINDS: PaymentKind[] = ["deposit", "balance", "full", "other"];

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Payments need Supabase" }, { status: 503 });

    const body = (await req.json().catch(() => ({}))) as Partial<CreatePaymentInput>;
    const customerName = body.customerName?.trim().slice(0, 120);
    const description = body.description?.trim().slice(0, 200);
    const amountPence = Number(body.amountPence);

    if (!customerName) return NextResponse.json({ error: "Who is it for?" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "What is it for?" }, { status: 400 });
    if (!Number.isFinite(amountPence) || amountPence < 100) {
      return NextResponse.json({ error: "Enter an amount of £1 or more" }, { status: 400 });
    }

    const payment = await createPayment({
      kind: KINDS.includes(body.kind as PaymentKind) ? (body.kind as PaymentKind) : "deposit",
      customerName,
      customerEmail: body.customerEmail?.trim() || null,
      customerPhone: body.customerPhone?.trim() || null,
      description,
      amountPence: Math.round(amountPence),
      dueOn: body.dueOn || null,
      jobId: body.jobId ?? null,
      quoteId: body.quoteId ?? null,
      planId: body.planId ?? null,
      note: body.note ?? null,
    });
    return NextResponse.json({ payment }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
