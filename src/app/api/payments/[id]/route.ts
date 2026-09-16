import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { renderPaymentEmail } from "@/lib/payments/email";
import { deletePayment, getPayment, markPaidByHand, updatePayment } from "@/lib/payments/store";
import type { PaymentChannel } from "@/lib/payments/types";
import { sendMail } from "@/lib/quotes/mail";
import { hasSupabase } from "@/lib/supabase";
import { londonDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  /** "send" emails it, "chase" emails a reminder, "sent" records an outside send. */
  action?: "send" | "chase" | "sent" | "paid" | "cancel";
  channel?: PaymentChannel;
  paidAmountPence?: number;
  dueOn?: string | null;
  note?: string | null;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Payments need Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Body;

    const payment = await getPayment(id);
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    switch (body.action) {
      case "send":
      case "chase": {
        if (!payment.customerEmail) {
          return NextResponse.json({ error: "No email address for this customer" }, { status: 400 });
        }
        const { subject, html } = renderPaymentEmail(payment, body.action === "chase");
        try {
          await sendMail({ to: payment.customerEmail, toName: payment.customerName, subject, html });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Could not send";
          await updatePayment(id, { emailStatus: "failed", emailError: message.slice(0, 300) });
          return NextResponse.json({ error: message }, { status: 502 });
        }
        return NextResponse.json(
          {
            payment: await updatePayment(id, {
              status: "sent",
              channel: "email",
              sentAt: payment.sentAt ?? new Date().toISOString(),
              emailStatus: "sent",
              emailError: null,
              ...(body.action === "chase" ? { chasedOn: londonDateKey(new Date()) } : {}),
            }),
          },
          NO_STORE,
        );
      }

      case "sent":
        return NextResponse.json(
          {
            payment: await updatePayment(id, {
              status: "sent",
              channel: body.channel ?? "link",
              sentAt: payment.sentAt ?? new Date().toISOString(),
            }),
          },
          NO_STORE,
        );

      case "paid":
        return NextResponse.json({ payment: await markPaidByHand(id, body.paidAmountPence) }, NO_STORE);

      case "cancel":
        return NextResponse.json({ payment: await updatePayment(id, { status: "cancelled" }) }, NO_STORE);

      default:
        return NextResponse.json(
          { payment: await updatePayment(id, { dueOn: body.dueOn, note: body.note }) },
          NO_STORE,
        );
    }
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Payments need Supabase" }, { status: 503 });
    const { id } = await ctx.params;
    await deletePayment(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
