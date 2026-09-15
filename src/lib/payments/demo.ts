import { addDays } from "@/lib/time";
import type { Payment } from "./types";

/** Sample payment requests for local preview only (no real customer data). */
export function demoPayments(today: string): Payment[] {
  const mk = (p: Partial<Payment> & Pick<Payment, "id" | "customerName" | "description" | "amountPence" | "status">): Payment => ({
    createdAt: `${today}T09:00:00.000Z`,
    kind: "deposit",
    customerEmail: null,
    customerPhone: "+447700900001",
    jobId: null,
    quoteId: null,
    planId: null,
    currency: "GBP",
    dueOn: addDays(today, 5),
    sentAt: `${today}T09:05:00.000Z`,
    paidAt: null,
    paidAmountPence: null,
    channel: "email",
    emailStatus: "sent",
    emailError: null,
    provider: "square",
    providerLinkUrl: "https://square.link/u/example",
    reference: "DS-XXXXX",
    chasedOn: null,
    note: null,
    ...p,
  });

  return [
    mk({
      id: "demo-pay-1",
      customerName: "Sample Customer A",
      description: "Deposit - Full Valet (large)",
      amountPence: 3500,
      status: "sent",
      reference: "DS-7K4Q2",
      dueOn: addDays(today, -2),
      sentAt: `${addDays(today, -6)}T09:05:00.000Z`,
    }),
    mk({
      id: "demo-pay-2",
      customerName: "Sample Customer B",
      description: "Balance - Stage 1/2 + Ceramic Coating",
      amountPence: 48000,
      status: "sent",
      kind: "balance",
      reference: "DS-M3PL9",
    }),
    mk({
      id: "demo-pay-3",
      customerName: "Sample Customer C",
      description: "Deposit - Deep Clean Service",
      amountPence: 2500,
      status: "paid",
      reference: "DS-B8TZ4",
      paidAt: `${addDays(today, -1)}T14:22:00.000Z`,
      paidAmountPence: 2500,
    }),
  ];
}
