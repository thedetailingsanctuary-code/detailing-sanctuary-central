"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-hooks";
import { isOutstanding, isOverdue, moneyShort, type Payment, type PaymentsSnapshot } from "@/lib/payments/types";
import { londonDateKey } from "@/lib/time";

/** Nudge on the Today screen when money is owed. Hidden when everything is settled. */
export function PaymentDueTile() {
  const [outstanding, setOutstanding] = useState<Payment[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<PaymentsSnapshot>("/api/payments")
      .then((s) => {
        if (!cancelled) setOutstanding(s.payments.filter(isOutstanding));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (outstanding.length === 0) return null;
  const today = londonDateKey(new Date());
  const overdue = outstanding.filter((p) => isOverdue(p, today));
  const total = outstanding.reduce((sum, p) => sum + p.amountPence, 0);

  return (
    <Link href="/payments" className={`card block p-3 text-sm ${overdue.length ? "border-danger/60" : "border-gold/50"}`}>
      <span className={`font-display uppercase ${overdue.length ? "text-danger" : "text-gold"}`}>
        {moneyShort(total)} outstanding
        {overdue.length > 0 ? ` - ${overdue.length} overdue` : ""}
      </span>
      <span className="mt-1 block truncate text-fg-dim">
        {outstanding.slice(0, 3).map((p) => p.customerName).join(", ")}
        {outstanding.length > 3 ? ` and ${outstanding.length - 3} more` : ""}
      </span>
    </Link>
  );
}
