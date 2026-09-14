"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-hooks";
import { stateLabel, type PlansSnapshot, type PlanWithState } from "@/lib/plans/types";

/** Nudge on the Today screen when plan visits are due or late. Hidden otherwise. */
export function PlanDueTile() {
  const [due, setDue] = useState<PlanWithState[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<PlansSnapshot>("/api/plans")
      .then((s) => {
        if (!cancelled) {
          setDue(s.plans.filter((p) => p.state === "overdue" || p.state === "due" || p.state === "soon"));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (due.length === 0) return null;
  const late = due.filter((p) => p.state === "overdue").length;

  return (
    <Link href="/plans" className={`card block p-3 text-sm ${late ? "border-danger/60" : "border-gold/50"}`}>
      <span className={`font-display uppercase ${late ? "text-danger" : "text-gold"}`}>
        {late > 0
          ? `${late} plan visit${late === 1 ? "" : "s"} overdue`
          : `${due.length} plan visit${due.length === 1 ? "" : "s"} coming up`}
      </span>
      <span className="mt-1 block truncate text-fg-dim">
        {due
          .slice(0, 3)
          .map((p) => `${p.customerName} - ${stateLabel(p).toLowerCase()}`)
          .join(", ")}
        {due.length > 3 ? ` and ${due.length - 3} more` : ""}
      </span>
    </Link>
  );
}
