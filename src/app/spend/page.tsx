import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SpendPanel } from "@/components/SpendPanel";

export const metadata: Metadata = { title: "Spend" };
export const dynamic = "force-dynamic";

export default function SpendPage() {
  return (
    <AppShell title="Spend">
      <SpendPanel />
    </AppShell>
  );
}
