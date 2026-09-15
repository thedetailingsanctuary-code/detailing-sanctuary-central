/** Payment requests. Pure types and helpers - safe on the server and in the browser. */
import { londonDateKey } from "@/lib/time";

export type PaymentKind = "deposit" | "balance" | "full" | "other";
export type PaymentStatus = "draft" | "sent" | "paid" | "cancelled" | "refunded" | "failed";
export type PaymentChannel = "email" | "whatsapp" | "link";

export const PAYMENT_KINDS: { id: PaymentKind; label: string }[] = [
  { id: "deposit", label: "Deposit" },
  { id: "balance", label: "Balance" },
  { id: "full", label: "Full amount" },
  { id: "other", label: "Other" },
];

export type Payment = {
  id: string;
  createdAt: string;
  kind: PaymentKind;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  description: string;
  jobId: string | null;
  quoteId: string | null;
  planId: string | null;
  amountPence: number;
  currency: string;
  status: PaymentStatus;
  dueOn: string | null;
  sentAt: string | null;
  paidAt: string | null;
  paidAmountPence: number | null;
  channel: PaymentChannel | null;
  emailStatus: string | null;
  emailError: string | null;
  provider: string;
  providerLinkUrl: string | null;
  reference: string;
  chasedOn: string | null;
  note: string | null;
};

export type PaymentSettings = {
  /** Days after sending before it counts as needing a chase. */
  chaseAfterDays: number;
  remindUnpaid: boolean;
  defaultKind: PaymentKind;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  chaseAfterDays: 3,
  remindUnpaid: true,
  defaultKind: "deposit",
};

export type PaymentsSnapshot = {
  payments: Payment[];
  totals: {
    outstandingPence: number;
    paidThisMonthPence: number;
    paidThisYearPence: number;
    overdueCount: number;
  };
  settings: PaymentSettings;
  /** False until the Square keys are in place. */
  providerReady: boolean;
  providerName: string;
  demo: boolean;
};

export function isOutstanding(p: Payment): boolean {
  return p.status === "draft" || p.status === "sent";
}

/** Sent, unpaid, and past the date it was due. */
export function isOverdue(p: Payment, today = londonDateKey(new Date())): boolean {
  return p.status === "sent" && Boolean(p.dueOn) && p.dueOn! < today;
}

export function statusLabel(p: Payment, today = londonDateKey(new Date())): string {
  switch (p.status) {
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    case "failed":
      return "Failed";
    case "draft":
      return "Not sent";
    default:
      return isOverdue(p, today) ? "Overdue" : "Waiting";
  }
}

export function money(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyShort(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

/** A short human reference like DS-7K4Q2. Shown to the customer on the payment page. */
export function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 - easier to read out
  let out = "";
  for (let i = 0; i < 5; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `DS-${out}`;
}

/** The WhatsApp message for a payment request. */
export function whatsappText(p: Payment, businessName = "Detailing Sanctuary"): string {
  const first = p.customerName.trim().split(/\s+/)[0] || p.customerName;
  return [
    `Hi ${first}, thanks for booking with ${businessName}.`,
    "",
    `${p.description}`,
    `${p.kind === "deposit" ? "Deposit" : p.kind === "balance" ? "Balance" : "Amount"} due: ${money(p.amountPence)}`,
    p.dueOn ? `Please pay by ${p.dueOn}.` : "",
    "",
    p.providerLinkUrl ? `Pay securely here: ${p.providerLinkUrl}` : "",
    "",
    `Reference: ${p.reference}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function whatsappHref(p: Payment): string | null {
  if (!p.customerPhone) return null;
  const digits = p.customerPhone.replace(/[^0-9]/g, "").replace(/^0/, "44");
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappText(p))}`;
}
