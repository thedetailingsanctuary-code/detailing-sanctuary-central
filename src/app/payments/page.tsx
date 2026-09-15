import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { PaymentsHub } from "@/components/PaymentsHub";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default function PaymentsPage() {
  return (
    <AppShell title="Payments">
      <PaymentsHub />
    </AppShell>
  );
}
