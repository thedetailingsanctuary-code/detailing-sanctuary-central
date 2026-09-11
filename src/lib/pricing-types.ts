export type PricingItem = {
  id: string;
  serviceId: string;
  tier: string;
  pricePence: number | null;
  isFrom: boolean;
  isQuote: boolean;
  unit: string | null;
  note: string | null;
  visitsPerYear: number | null;
  sortOrder: number;
};

export type PricingService = {
  id: string;
  name: string;
  note: string | null;
  items: PricingItem[];
};

export type PricingData = {
  currency: "GBP";
  source: "supabase" | "config";
  services: PricingService[];
};

export function formatGBP(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pounds);
}
