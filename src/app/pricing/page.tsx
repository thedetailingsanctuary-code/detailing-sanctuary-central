import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { InstagramIcon, PricingCalculator } from "@/components/PricingCalculator";
import { INSTAGRAM_URL } from "@/components/QuickLinks";
import { getPricing } from "@/lib/pricing";

export const metadata: Metadata = { title: "Quote" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const data = await getPricing();
  return (
    <AppShell
      title="Quote"
      action={
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener"
          className="flex h-11 w-11 items-center justify-center rounded-full text-gold"
          aria-label="Open Instagram"
          title="Show Instagram"
        >
          <InstagramIcon size={24} />
        </a>
      }
    >
      <PricingCalculator data={data} />
    </AppShell>
  );
}
