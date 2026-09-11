import "server-only";
import config from "../../config/pricing.json";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import type { PricingData, PricingItem, PricingService } from "./pricing-types";

type ConfigItem = {
  id: string;
  tier: string;
  price_pence?: number;
  is_from?: boolean;
  is_quote?: boolean;
  unit?: string;
  note?: string;
  visits_per_year?: number;
};
type ConfigService = { id: string; name: string; note?: string; items: ConfigItem[] };

/** The JSON file is the seed and the safety net; Supabase is the live source of truth once set up. */
export function pricingFromConfig(): PricingData {
  const services = (config.services as ConfigService[]).map<PricingService>((s, si) => ({
    id: s.id,
    name: s.name,
    note: s.note ?? null,
    items: s.items.map<PricingItem>((it, ii) => ({
      id: it.id,
      serviceId: s.id,
      tier: it.tier,
      pricePence: it.price_pence ?? null,
      isFrom: Boolean(it.is_from),
      isQuote: Boolean(it.is_quote),
      unit: it.unit ?? null,
      note: it.note ?? null,
      visitsPerYear: it.visits_per_year ?? null,
      sortOrder: si * 100 + ii,
    })),
  }));
  return { currency: "GBP", source: "config", services };
}

type Row = {
  id: string;
  service_id: string;
  service_name: string;
  service_note: string | null;
  tier: string;
  price_pence: number | null;
  is_from: boolean;
  is_quote: boolean;
  unit: string | null;
  note: string | null;
  visits_per_year: number | null;
  sort_order: number;
};

export async function getPricing(): Promise<PricingData> {
  if (!hasSupabase()) return pricingFromConfig();
  try {
    const { data, error } = await getSupabase().from("pricing_items").select("*").eq("active", true).order("sort_order");
    if (error || !data || data.length === 0) return pricingFromConfig();
    const byService = new Map<string, PricingService>();
    for (const r of data as Row[]) {
      let svc = byService.get(r.service_id);
      if (!svc) {
        svc = { id: r.service_id, name: r.service_name, note: r.service_note, items: [] };
        byService.set(r.service_id, svc);
      }
      svc.items.push({
        id: r.id,
        serviceId: r.service_id,
        tier: r.tier,
        pricePence: r.price_pence,
        isFrom: r.is_from,
        isQuote: r.is_quote,
        unit: r.unit,
        note: r.note,
        visitsPerYear: r.visits_per_year,
        sortOrder: r.sort_order,
      });
    }
    return { currency: "GBP", source: "supabase", services: [...byService.values()] };
  } catch (e) {
    console.warn("[pricing] falling back to config", e);
    return pricingFromConfig();
  }
}
