import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { CreatedLink, CreateLinkArgs, PaymentProvider, RemoteStatus } from "./provider";

const BASE = {
  production: "https://connect.squareup.com",
  sandbox: "https://connect.squareupsandbox.com",
};

function baseUrl(): string {
  return env.square.environment === "sandbox" ? BASE.sandbox : BASE.production;
}

async function squareFetch<T>(path: string, init: RequestInit & { body?: string } = {}): Promise<T> {
  const token = env.square.accessToken;
  if (!token) throw new Error("Square is not connected (SQUARE_ACCESS_TOKEN missing)");

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json",
  };
  // Pinning is optional: with no header Square uses the version set on the
  // application itself, which is the safer default than guessing a date.
  if (env.square.apiVersion) headers["Square-Version"] = env.square.apiVersion;

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { errors?: { detail?: string; code?: string }[] };
      if (j.errors?.length) detail = j.errors.map((e) => e.detail ?? e.code).join("; ");
    } catch {
      /* keep the raw text */
    }
    throw new Error(`Square ${res.status}: ${detail}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

type PaymentLinkResponse = {
  payment_link: { id: string; url: string; long_url?: string; order_id?: string };
};

type OrderResponse = {
  order: { id: string; state?: string; total_money?: { amount?: number }; tenders?: { id: string }[] };
};

type WebhookBody = {
  type?: string;
  data?: {
    object?: {
      payment?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount_money?: { amount?: number };
      };
      order?: { id?: string; state?: string };
    };
  };
};

function statusFromPayment(raw: string | undefined): RemoteStatus {
  if (raw === "COMPLETED" || raw === "APPROVED") return "paid";
  if (raw === "CANCELED" || raw === "FAILED") return "cancelled";
  return "unpaid";
}

export class SquareProvider implements PaymentProvider {
  readonly name = "square";

  async createLink(args: CreateLinkArgs): Promise<CreatedLink> {
    if (!env.square.locationId) throw new Error("Square is not connected (SQUARE_LOCATION_ID missing)");

    const body = {
      idempotency_key: `${args.reference}-${Date.now()}`.slice(0, 45),
      quick_pay: {
        name: args.description.slice(0, 255),
        price_money: { amount: args.amountPence, currency: args.currency },
        location_id: env.square.locationId,
      },
      checkout_options: {
        ask_for_shipping_address: false,
        ...(env.appBaseUrl ? { redirect_url: `${env.appBaseUrl}/paid?ref=${encodeURIComponent(args.reference)}` } : {}),
      },
      pre_populated_data: {
        ...(args.customerEmail ? { buyer_email: args.customerEmail } : {}),
        ...(args.customerPhone ? { buyer_phone_number: args.customerPhone } : {}),
      },
      payment_note: `${args.reference} - ${args.customerName}`.slice(0, 500),
    };

    const r = await squareFetch<PaymentLinkResponse>("/v2/online-checkout/payment-links", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      linkId: r.payment_link.id,
      url: r.payment_link.long_url ?? r.payment_link.url,
      orderId: r.payment_link.order_id ?? null,
    };
  }

  async checkStatus(orderId: string): Promise<{ status: RemoteStatus; paidPence: number | null; paymentId: string | null }> {
    const r = await squareFetch<OrderResponse>(`/v2/orders/${encodeURIComponent(orderId)}`);
    const state = r.order?.state;
    if (state === "COMPLETED") {
      return {
        status: "paid",
        paidPence: r.order.total_money?.amount ?? null,
        paymentId: r.order.tenders?.[0]?.id ?? null,
      };
    }
    if (state === "CANCELED") return { status: "cancelled", paidPence: null, paymentId: null };
    return { status: state ? "unpaid" : "unknown", paidPence: null, paymentId: null };
  }

  /**
   * Square signs the notification URL plus the raw body with the webhook
   * signature key. Anything that does not match is thrown away.
   */
  verifyWebhook(rawBody: string, signature: string | null, notificationUrl: string): boolean {
    const key = env.square.webhookSignatureKey;
    if (!key || !signature) return false;
    const expected = createHmac("sha256", key).update(notificationUrl + rawBody).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: string) {
    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody) as WebhookBody;
    } catch {
      return null;
    }
    const payment = body.data?.object?.payment;
    if (payment) {
      return {
        orderId: payment.order_id ?? null,
        paymentId: payment.id ?? null,
        status: statusFromPayment(payment.status),
        paidPence: payment.amount_money?.amount ?? null,
      };
    }
    const order = body.data?.object?.order;
    if (order) {
      return {
        orderId: order.id ?? null,
        paymentId: null,
        status: order.state === "COMPLETED" ? ("paid" as const) : order.state === "CANCELED" ? ("cancelled" as const) : ("unpaid" as const),
        paidPence: null,
      };
    }
    return null;
  }
}
