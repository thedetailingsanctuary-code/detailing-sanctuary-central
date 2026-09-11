import "server-only";
import config from "../../config/pricing.json";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { DEFAULT_META, type PricingData, type PricingItem, type PricingMeta, type PricingService, type ServiceKind } from "./pricing-types";

type ConfigItem = {
  id: string;
  tier: string;
  detail?: string;
  price_pence?: number;
  price_max_pence?: number;
  is_from?: boolean;
  is_quote?: boolean;
  is_addon?: boolean;
  unit?: string;
  quantity_label?: string;
  visits_per_term?: number;
  note?: string;
};
type ConfigService = { id: string; name: string; kind: ServiceKind; note?: string; items: ConfigItem[] };

function configMeta(): PricingMeta {
  const m = (config as { meta?: Partial<PricingMeta> }).meta ?? {};
  return { ...DEFAULT_META, ...m };
}

/** The JSON file is the seed and the safety net; Supabase is the live source once set up. */
export function pricingFromConfig(): PricingData {
  const services = (config.services as ConfigService[]).map<PricingService>((s, si) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    note: s.note ?? null,
    items: s.items.map<PricingItem>((it, ii) => ({
      id: it.id,
      serviceId: s.id,
      kind: s.kind,
      tier: it.tier,
      detail: it.detail ?? null,
      pricePence: it.price_pence ?? null,
      priceMaxPence: it.price_max_pence ?? null,
      isFrom: Boolean(it.is_from),
      isQuote: Boolean(it.is_quote),
      isAddon: Boolean(it.is_addon),
      unit: it.unit ?? null,
      quantityLabel: it.quantity_label ?? null,
      visitsPerTerm: it.visits_per_term ?? null,
      note: it.note ?? null,
      sortOrder: si * 100 + ii,
    })),
  }));
  return { currency: "GBP", source: "config", meta: configMeta(), services };
}

type Row = {
  id: string;
  service_id: string;
  service_name: string;
  service_kind: string | null;
  service_note: string | null;
  tier: string;
  detail: string | null;
  price_pence: number | null;
  price_max_pence: number | null;
  is_from: boolean;
  is_quote: boolean;
  is_addon: boolean | null;
  unit: string | null;
  quantity_label: string | null;
  visits_per_term: number | null;
  note: string | null;
  sort_order: number;
};

const KINDS: ServiceKind[] = ["package", "coating", "addon", "correction", "fleet", "plan"];

export async function getPricing(): Promise<PricingData> {
  if (!hasSupabase()) return pricingFromConfig();
  try {
    const sb = getSupabase();
    const [{ data, error }, metaRow] = await Promise.all([
      sb.from("pricing_items").select("*").eq("active", true).order("sort_order"),
      sb.from("app_settings").select("value").eq("key", "pricing").maybeSingle(),
    ]);
    if (error || !data || data.length === 0) return pricingFromConfig();

    const meta: PricingMeta = {
      ...configMeta(),
      ...((metaRow.data?.value as Partial<PricingMeta> | undefined) ?? {}),
    };

    const byService = new Map<string, PricingService>();
    for (const r of data as Row[]) {
      const kind = (KINDS.includes(r.service_kind as ServiceKind) ? r.service_kind : "package") as ServiceKind;
      let svc = byService.get(r.service_id);
      if (!svc) {
        svc = { id: r.service_id, name: r.service_name, kind, note: r.service_note, items: [] };
        byService.set(r.service_id, svc);
      }
      svc.items.push({
        id: r.id,
        serviceId: r.service_id,
        kind,
        tier: r.tier,
        detail: r.detail,
        pricePence: r.price_pence,
        priceMaxPence: r.price_max_pence,
        isFrom: r.is_from,
        isQuote: r.is_quote,
        isAddon: Boolean(r.is_addon),
        unit: r.unit,
        quantityLabel: r.quantity_label,
        visitsPerTerm: r.visits_per_term,
        note: r.note,
        sortOrder: r.sort_order,
      });
    }
    return { currency: "GBP", source: "supabase", meta, services: [...byService.values()] };
  } catch (e) {
    console.warn("[pricing] falling back to config", e);
    return pricingFromConfig();
  }
}
