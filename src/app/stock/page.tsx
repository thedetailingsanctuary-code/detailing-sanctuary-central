import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { StockPanel } from "@/components/StockPanel";

export const metadata: Metadata = { title: "Stock" };
export const dynamic = "force-dynamic";

export default function StockPage() {
  return (
    <AppShell title="Stock">
      <StockPanel />
    </AppShell>
  );
}
