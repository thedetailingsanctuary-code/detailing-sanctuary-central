import { NextResponse, type NextRequest } from "next/server";
import { configured, env } from "@/lib/env";
import { getPaymentProvider, markPaidByOrder } from "@/lib/payments/store";

export const dynamic = "force-dynamic";

/**
 * Square tells us here when a payment completes. Public by necessity, so every
 * request is checked against the webhook signature before anything is trusted.
 * If no signature key is configured the endpoint refuses everything and the
 * scheduled check polls Square instead.
 */
export async function POST(req: NextRequest) {
  if (!configured.paymentWebhook) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const provider = getPaymentProvider();
  const signature = req.headers.get("x-square-hmacsha256-signature");
  const notificationUrl = `${env.appBaseUrl}/api/payments/webhook`;

  if (!provider.verifyWebhook(raw, signature, notificationUrl)) {
    console.warn("[payments] rejected a webhook with a bad signature");
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const event = provider.parseWebhook(raw);
  if (!event?.orderId) return NextResponse.json({ ok: true, ignored: true });

  if (event.status === "paid") {
    const paid = await markPaidByOrder({
      orderId: event.orderId,
      paymentId: event.paymentId,
      paidPence: event.paidPence,
    });
    return NextResponse.json({ ok: true, matched: Boolean(paid) });
  }
  return NextResponse.json({ ok: true, status: event.status });
}
