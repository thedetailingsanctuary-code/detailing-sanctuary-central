import "server-only";
import { configured, env } from "@/lib/env";
import { sendPushToAll } from "@/lib/push";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { addDays, londonDateKey } from "@/lib/time";
import { demoPayments } from "./demo";
import type { PaymentProvider } from "./provider";
import { SquareProvider } from "./square";
import {
  DEFAULT_PAYMENT_SETTINGS,
  isOverdue,
  newReference,
  type Payment,
  type PaymentChannel,
  type PaymentKind,
  type PaymentSettings,
  type PaymentsSnapshot,
  type PaymentStatus,
} from "./types";

export function getPaymentProvider(): PaymentProvider {
  // Only Square today; the env var is the seam for adding another.
  if (env.paymentProvider !== "square") {
    throw new Error(`Unknown payment provider "${env.paymentProvider}"`);
  }
  return new SquareProvider();
}

type Row = {
  id: string;
  created_at: string;
  kind: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  description: string;
  job_id: string | null;
  quote_id: string | null;
  plan_id: string | null;
  amount_pence: number;
  currency: string;
  status: string;
  due_on: string | null;
  sent_at: string | null;
  paid_at: string | null;
  paid_amount_pence: number | null;
  channel: string | null;
  email_status: string | null;
  email_error: string | null;
  provider: string;
  provider_link_url: string | null;
  reference: string;
  chased_on: string | null;
  note: string | null;
};

function rowTo(r: Row): Payment {
  return {
    id: r.id,
    createdAt: r.created_at,
    kind: (r.kind as PaymentKind) || "deposit",
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    description: r.description,
    jobId: r.job_id,
    quoteId: r.quote_id,
    planId: r.plan_id,
    amountPence: Number(r.amount_pence),
    currency: r.currency,
    status: (r.status as PaymentStatus) || "draft",
    dueOn: r.due_on,
    sentAt: r.sent_at,
    paidAt: r.paid_at,
    paidAmountPence: r.paid_amount_pence == null ? null : Number(r.paid_amount_pence),
    channel: (r.channel as PaymentChannel) ?? null,
    emailStatus: r.email_status,
    emailError: r.email_error,
    provider: r.provider,
    providerLinkUrl: r.provider_link_url,
    reference: r.reference,
    chasedOn: r.chased_on,
    note: r.note,
  };
}

const SELECT =
  "id,created_at,kind,customer_name,customer_email,customer_phone,description,job_id,quote_id,plan_id,amount_pence,currency,status,due_on,sent_at,paid_at,paid_amount_pence,channel,email_status,email_error,provider,provider_link_url,reference,chased_on,note";

export async function getPaymentSettings(): Promise<PaymentSettings> {
  if (!hasSupabase()) return DEFAULT_PAYMENT_SETTINGS;
  const { data } = await getSupabase().from("app_settings").select("value").eq("key", "payments").maybeSingle();
  const v = (data?.value as Partial<PaymentSettings> | undefined) ?? {};
  return {
    chaseAfterDays: v.chaseAfterDays ?? DEFAULT_PAYMENT_SETTINGS.chaseAfterDays,
    remindUnpaid: v.remindUnpaid ?? DEFAULT_PAYMENT_SETTINGS.remindUnpaid,
    defaultKind: v.defaultKind ?? DEFAULT_PAYMENT_SETTINGS.defaultKind,
  };
}

export async function listPayments(limit = 200): Promise<Payment[]> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as Row[]).map(rowTo);
}

export async function getPayment(id: string): Promise<Payment | null> {
  const { data, error } = await getSupabase().from("payments").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowTo(data as Row) : null;
}

export async function getPaymentsSnapshot(today = londonDateKey(new Date())): Promise<PaymentsSnapshot> {
  const providerReady = configured.payments;
  if (!hasSupabase()) {
    const payments = demoPayments(today);
    return {
      payments,
      totals: summarise(payments, today),
      settings: DEFAULT_PAYMENT_SETTINGS,
      providerReady,
      providerName: env.paymentProvider,
      demo: true,
    };
  }
  const [payments, settings] = await Promise.all([listPayments(), getPaymentSettings()]);
  return {
    payments,
    totals: summarise(payments, today),
    settings,
    providerReady,
    providerName: env.paymentProvider,
    demo: false,
  };
}

function summarise(payments: Payment[], today: string): PaymentsSnapshot["totals"] {
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  let outstandingPence = 0;
  let paidThisMonthPence = 0;
  let paidThisYearPence = 0;
  let overdueCount = 0;

  for (const p of payments) {
    if (p.status === "draft" || p.status === "sent") {
      outstandingPence += p.amountPence;
      if (isOverdue(p, today)) overdueCount += 1;
    }
    if (p.status === "paid" && p.paidAt) {
      const paidKey = londonDateKey(new Date(p.paidAt));
      const amount = p.paidAmountPence ?? p.amountPence;
      if (paidKey.startsWith(year)) paidThisYearPence += amount;
      if (paidKey.startsWith(month)) paidThisMonthPence += amount;
    }
  }
  return { outstandingPence, paidThisMonthPence, paidThisYearPence, overdueCount };
}

export type CreatePaymentInput = {
  kind: PaymentKind;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  description: string;
  amountPence: number;
  dueOn?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  planId?: string | null;
  note?: string | null;
};

/** An unpaid, uncancelled balance already raised against this job, if there is one. */
export async function findOpenBalance(jobId: string): Promise<Payment | null> {
  const { data } = await getSupabase()
    .from("payments")
    .select(SELECT)
    .eq("job_id", jobId)
    .eq("kind", "balance")
    .in("status", ["draft", "sent"])
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0];
  return row ? rowTo(row as Row) : null;
}

/**
 * Create the request and, if Square is connected, its hosted payment page.
 * Without Square it is still saved so it can be chased and marked paid by hand.
 *
 * A balance for a job that already has one outstanding returns the existing
 * request rather than making a second. Two live Square links for one car is the
 * worst thing this code could do: the customer can pay both, Square is perfectly
 * happy to take both, and nothing downstream would notice the overcharge. It
 * also makes the create safely repeatable - a tap that times out after the row
 * was written comes back to the same request instead of raising another bill.
 */
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  if (!hasSupabase()) throw new Error("Payments need Supabase");

  if (input.kind === "balance" && input.jobId) {
    const open = await findOpenBalance(input.jobId);
    if (open) return open;
  }

  const reference = newReference();
  const currency = "GBP";

  let linkUrl: string | null = null;
  let linkId: string | null = null;
  let orderId: string | null = null;
  if (configured.payments) {
    const link = await getPaymentProvider().createLink({
      description: input.description,
      amountPence: input.amountPence,
      currency,
      reference,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
    });
    linkUrl = link.url;
    linkId = link.linkId;
    orderId = link.orderId;
  }

  const { data, error } = await getSupabase()
    .from("payments")
    .insert({
      kind: input.kind,
      customer_name: input.customerName,
      customer_email: input.customerEmail ?? null,
      customer_phone: input.customerPhone ?? null,
      description: input.description,
      job_id: input.jobId ?? null,
      quote_id: input.quoteId ?? null,
      plan_id: input.planId ?? null,
      amount_pence: Math.round(input.amountPence),
      currency,
      status: "draft",
      due_on: input.dueOn ?? addDays(londonDateKey(new Date()), 7),
      provider: env.paymentProvider,
      provider_link_id: linkId,
      provider_link_url: linkUrl,
      provider_order_id: orderId,
      reference,
      note: input.note ?? null,
    })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowTo(data as Row);
}

/** Mark paid by hand (cash, card reader, bank transfer) and retire the job with it. */
export async function markPaidByHand(id: string, paidAmountPence?: number): Promise<Payment> {
  const current = await getPayment(id);
  if (!current) throw new Error("That payment is not here any more");
  const paid = await updatePayment(id, {
    status: "paid",
    paidAt: new Date().toISOString(),
    paidAmountPence: paidAmountPence ?? current.amountPence,
  });
  await settleJobFor(paid);
  return paid;
}

export async function updatePayment(
  id: string,
  patch: Partial<{
    status: PaymentStatus;
    channel: PaymentChannel;
    sentAt: string | null;
    paidAt: string | null;
    paidAmountPence: number | null;
    dueOn: string | null;
    emailStatus: string | null;
    emailError: string | null;
    chasedOn: string | null;
    note: string | null;
    providerPaymentId: string | null;
  }>,
): Promise<Payment> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.channel !== undefined) row.channel = patch.channel;
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt;
  if (patch.paidAt !== undefined) row.paid_at = patch.paidAt;
  if (patch.paidAmountPence !== undefined) row.paid_amount_pence = patch.paidAmountPence;
  if (patch.dueOn !== undefined) row.due_on = patch.dueOn;
  if (patch.emailStatus !== undefined) row.email_status = patch.emailStatus;
  if (patch.emailError !== undefined) row.email_error = patch.emailError;
  if (patch.chasedOn !== undefined) row.chased_on = patch.chasedOn;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.providerPaymentId !== undefined) row.provider_payment_id = patch.providerPaymentId;

  const { data, error } = await getSupabase().from("payments").update(row).eq("id", id).select(SELECT).single();
  if (error) throw new Error(error.message);
  return rowTo(data as Row);
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await getSupabase().from("payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * A paid balance retires the job it belongs to.
 *
 * Without this a job stays "invoiced" with its balance still counted, so it
 * keeps showing up under Awaiting balance and keeps offering a Send balance
 * button for money already in the bank. A pull from the hub cannot undo it:
 * status is Central's own column and hubOwnedRow leaves it alone.
 *
 * Never allowed to throw - the payment itself is already recorded, and losing
 * that to a jobs-table hiccup would be far worse than a status left behind.
 */
async function settleJobFor(payment: Payment): Promise<void> {
  if (!payment.jobId) return;
  if (payment.kind !== "balance" && payment.kind !== "full") return;
  try {
    const { setJobStatus } = await import("@/lib/jobs/store");
    await setJobStatus(payment.jobId, "paid");
  } catch (e) {
    console.warn("[payments] could not mark job paid", payment.jobId, e);
  }
}

/** Mark paid from a webhook or a status poll, and tell the phone. */
export async function markPaidByOrder(args: {
  orderId: string;
  paymentId: string | null;
  paidPence: number | null;
}): Promise<Payment | null> {
  const { data } = await getSupabase().from("payments").select(SELECT).eq("provider_order_id", args.orderId).maybeSingle();
  if (!data) return null;
  const existing = rowTo(data as Row);
  if (existing.status === "paid") return existing;

  const paid = await updatePayment(existing.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
    paidAmountPence: args.paidPence ?? existing.amountPence,
    providerPaymentId: args.paymentId,
  });

  await settleJobFor(paid);

  await sendPushToAll({
    title: `Paid: ${paid.customerName}`,
    body: `${(paid.paidAmountPence ?? paid.amountPence) / 100} GBP received - ${paid.description}`,
    url: "/payments",
    tag: `paid-${paid.id}`,
  }).catch(() => undefined);

  return paid;
}

export type PaymentRunResult = {
  ran: boolean;
  reason?: string;
  reconciled: number;
  chased: string[];
};

/**
 * Called by the scheduled check. Catches up on anything Square was not able to
 * tell us about (no webhook, or one that failed), then nudges once about
 * requests that have gone quiet.
 */
export async function runPaymentChecks(now = new Date()): Promise<PaymentRunResult> {
  if (!hasSupabase()) return { ran: false, reason: "supabase-not-configured", reconciled: 0, chased: [] };
  const today = londonDateKey(now);
  const settings = await getPaymentSettings();

  let reconciled = 0;
  if (configured.payments) {
    const { data } = await getSupabase()
      .from("payments")
      .select("id,provider_order_id")
      .in("status", ["draft", "sent"])
      .not("provider_order_id", "is", null)
      .limit(25);
    const provider = getPaymentProvider();
    for (const row of (data ?? []) as { id: string; provider_order_id: string }[]) {
      try {
        const r = await provider.checkStatus(row.provider_order_id);
        if (r.status === "paid") {
          await markPaidByOrder({ orderId: row.provider_order_id, paymentId: r.paymentId, paidPence: r.paidPence });
          reconciled += 1;
        } else if (r.status === "cancelled") {
          await updatePayment(row.id, { status: "cancelled" });
        }
      } catch (e) {
        console.warn("[payments] status check failed", row.id, e);
      }
    }
  }

  const chased: string[] = [];
  if (settings.remindUnpaid) {
    const payments = await listPayments();
    const due = payments.filter(
      (p) =>
        p.status === "sent" &&
        p.chasedOn !== today &&
        p.sentAt &&
        (now.getTime() - new Date(p.sentAt).getTime()) / 86400000 >= settings.chaseAfterDays,
    );
    if (due.length > 0) {
      const total = due.reduce((sum, p) => sum + p.amountPence, 0);
      const r = await sendPushToAll({
        title: `${due.length} payment${due.length === 1 ? "" : "s"} still unpaid`,
        body: `${due.map((p) => p.customerName).slice(0, 4).join(", ")} - ${total / 100} GBP outstanding`,
        url: "/payments",
        tag: "payments-unpaid",
      });
      if (r.sent > 0 || r.skipped === "no-active-tokens") {
        await getSupabase()
          .from("payments")
          .update({ chased_on: today })
          .in("id", due.map((p) => p.id));
      }
      chased.push(...due.map((p) => p.customerName));
    }
  }

  return { ran: true, reconciled, chased };
}
