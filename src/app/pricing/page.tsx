import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { PricingCalculator } from "@/components/PricingCalculator";
import { getPricing } from "@/lib/pricing";

export const metadata: Metadata = { title: "Prices" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const data = await getPricing();
  return (
    <AppShell title="Prices">
      <PricingCalculator data={data} />
    </AppShell>
  );
}
