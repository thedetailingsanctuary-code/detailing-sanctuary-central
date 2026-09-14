import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { PlansPanel } from "@/components/PlansPanel";

export const metadata: Metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

export default function PlansPage() {
  return (
    <AppShell title="Plans">
      <PlansPanel />
    </AppShell>
  );
}
