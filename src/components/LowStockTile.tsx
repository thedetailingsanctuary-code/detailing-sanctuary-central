"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-hooks";
import type { StockSnapshot } from "@/lib/stock/types";

/** Small nudge on the Today screen when chemicals are running low. Hidden otherwise. */
export function LowStockTile() {
  const [low, setLow] = useState<StockSnapshot["low"]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<StockSnapshot>("/api/stock")
      .then((s) => {
        if (!cancelled) setLow(s.low);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (low.length === 0) return null;
  return (
    <Link href="/stock" className="card block border-danger/60 p-3 text-sm">
      <span className="font-display uppercase text-danger">Running low on {low.length} chemical{low.length === 1 ? "" : "s"}</span>
      <span className="mt-1 block truncate text-fg-dim">{low.map((i) => i.name).join(", ")}</span>
    </Link>
  );
}
