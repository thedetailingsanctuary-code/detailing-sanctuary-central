/** Price list types and quote maths. No server-only code here: used by the quote builder in the browser. */

export type ServiceKind = "package" | "coating" | "addon" | "correction" | "fleet" | "plan";

export type PricingItem = {
  id: string;
  serviceId: string;
  kind: ServiceKind;
  tier: string;
  detail: string | null;
  pricePence: number | null;
  /** Upper end of a price range such as headlight restoration £60-£165. */
  priceMaxPence: number | null;
  isFrom: boolean;
  isQuote: boolean;
  /** Coatings that sit on top of a detail (shown with a "+" on the website). */
  isAddon: boolean;
  unit: string | null;
  /** When set, the quote asks for a quantity in these units (hours, seats, vehicles). */
  quantityLabel: string | null;
  /** Plans: visits in one term. */
  visitsPerTerm: number | null;
  note: string | null;
  sortOrder: number;
};

export type PricingService = {
  id: string;
  name: string;
  kind: ServiceKind;
  note: string | null;
  items: PricingItem[];
};

export type VehicleSize = { id: string; name: string; steps: number };
export type PlanDiscount = { id: string; name: string; percent: number };

export type PricingMeta = {
  sizeStepPercent: number;
  sizes: VehicleSize[];
  deposit: { percent: number; minimumPence: number };
  planDiscounts: PlanDiscount[];
  termLabel: string;
  /** How long an emailed quote is honoured for. */
  quoteValidDays?: number;
};

export type PricingData = {
  currency: "GBP";
  source: "supabase" | "config";
  meta: PricingMeta;
  services: PricingService[];
};

export const DEFAULT_META: PricingMeta = {
  sizeStepPercent: 7,
  sizes: [
    { id: "standard", name: "Standard car", steps: 0 },
    { id: "large", name: "Large (SUV / estate)", steps: 1 },
    { id: "xl", name: "Extra large (van / 7-seater)", steps: 2 },
  ],
  deposit: { percent: 25, minimumPence: 2500 },
  planDiscounts: [
    { id: "payg", name: "Pay as you go", percent: 0 },
    { id: "contracted", name: "Contracted", percent: 5 },
    { id: "paid-in-full", name: "Paid in full", percent: 10 },
  ],
  termLabel: "four-month term",
  quoteValidDays: 30,
};

/** Kinds whose prices scale with vehicle size ("each size step adds 7%, rounded up"). */
export const SIZE_SCALED_KINDS: ServiceKind[] = ["package", "coating", "addon", "correction"];

export function formatGBP(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pounds);
}

/** Apply size steps: +stepPercent per step, compounding, rounded up to the next pound. */
export function applySize(pence: number, steps: number, stepPercent: number): number {
  if (!steps) return pence;
  const factor = Math.pow(1 + stepPercent / 100, steps);
  return Math.ceil((pence * factor) / 100) * 100;
}

export function applyDiscount(pence: number, percent: number): number {
  if (!percent) return pence;
  return Math.round(pence * (1 - percent / 100));
}

export type QuoteLine = { itemId: string; quantity: number; discountId: string | null };

export type PricedLine = {
  item: PricingItem;
  quantity: number;
  discount: PlanDiscount | null;
  /** Price for this line after size, quantity and discount. Null for quote-only items. */
  minPence: number | null;
  maxPence: number | null;
  /** Plans only: per-term total. */
  termPence: number | null;
  label: string;
};

export type QuoteSummary = {
  size: VehicleSize;
  oneOff: PricedLine[];
  plans: PricedLine[];
  minPence: number;
  maxPence: number;
  hasFrom: boolean;
  hasQuote: boolean;
  depositPence: number;
};

function priceLabel(min: number | null, max: number | null, isFrom: boolean, isQuote: boolean): string {
  if (isQuote || min == null) return "Quote";
  if (max != null && max > min) return `${formatGBP(min)}-${formatGBP(max)}`;
  return `${isFrom ? "from " : ""}${formatGBP(min)}`;
}

/** Price one item for display or for a quote line. */
export function priceItem(
  item: PricingItem,
  meta: PricingMeta,
  size: VehicleSize,
  quantity = 1,
  discount: PlanDiscount | null = null,
): { minPence: number | null; maxPence: number | null; termPence: number | null; label: string } {
  if (item.isQuote || item.pricePence == null) {
    return { minPence: null, maxPence: null, termPence: null, label: "Quote" };
  }
  const scaled = SIZE_SCALED_KINDS.includes(item.kind);
  const qty = item.quantityLabel ? Math.max(1, quantity) : 1;
  let min = scaled ? applySize(item.pricePence, size.steps, meta.sizeStepPercent) : item.pricePence;
  let max = item.priceMaxPence != null ? (scaled ? applySize(item.priceMaxPence, size.steps, meta.sizeStepPercent) : item.priceMaxPence) : null;
  if (discount) {
    min = applyDiscount(min, discount.percent);
    if (max != null) max = applyDiscount(max, discount.percent);
  }
  min *= qty;
  if (max != null) max *= qty;
  const termPence = item.kind === "plan" && item.visitsPerTerm ? min * item.visitsPerTerm : null;
  return { minPence: min, maxPence: max, termPence, label: priceLabel(min, max, item.isFrom, item.isQuote) };
}

export function summariseQuote(lines: QuoteLine[], data: PricingData, sizeId: string): QuoteSummary {
  const meta = data.meta;
  const size = meta.sizes.find((s) => s.id === sizeId) ?? meta.sizes[0] ?? DEFAULT_META.sizes[0];
  const byId = new Map<string, PricingItem>();
  for (const s of data.services) for (const it of s.items) byId.set(it.id, it);

  const oneOff: PricedLine[] = [];
  const plans: PricedLine[] = [];
  let minPence = 0;
  let maxPence = 0;
  let hasFrom = false;
  let hasQuote = false;

  for (const line of lines) {
    const item = byId.get(line.itemId);
    if (!item) continue;
    const discount = item.kind === "plan" ? (meta.planDiscounts.find((d) => d.id === line.discountId) ?? meta.planDiscounts[0] ?? null) : null;
    const priced = priceItem(item, meta, size, line.quantity, discount);
    const pl: PricedLine = { item, quantity: line.quantity, discount, ...priced };
    if (item.kind === "plan") {
      plans.push(pl);
      continue;
    }
    oneOff.push(pl);
    if (pl.minPence == null) {
      hasQuote = true;
      continue;
    }
    minPence += pl.minPence;
    maxPence += pl.maxPence ?? pl.minPence;
    if (item.isFrom) hasFrom = true;
  }

  const depositPence = minPence > 0 ? Math.max(meta.deposit.minimumPence, Math.ceil((minPence * meta.deposit.percent) / 100 / 100) * 100) : 0;
  return { size, oneOff, plans, minPence, maxPence, hasFrom, hasQuote, depositPence };
}

export function totalLabel(q: QuoteSummary): string {
  if (q.oneOff.length === 0) return "";
  if (q.minPence === 0 && q.hasQuote) return "Quote on inspection";
  const range = q.maxPence > q.minPence ? `${formatGBP(q.minPence)}-${formatGBP(q.maxPence)}` : formatGBP(q.minPence);
  return `${q.hasFrom ? "from " : ""}${range}${q.hasQuote ? " + quote" : ""}`;
}

/** Plain-text version of the quote for WhatsApp / SMS / email. */
export function quoteText(q: QuoteSummary, meta: PricingMeta, links: { website: string; instagram: string }): string {
  const out: string[] = [];
  out.push(`Detailing Sanctuary quote - ${q.size.name}`);
  out.push("");
  for (const l of q.oneOff) {
    const qty = l.item.quantityLabel && l.quantity > 1 ? ` x${l.quantity}` : "";
    out.push(`- ${l.item.tier}${qty}: ${l.label}`);
  }
  if (q.oneOff.length) out.push(`Total: ${totalLabel(q)}`);
  if (q.plans.length) {
    if (q.oneOff.length) out.push("");
    for (const l of q.plans) {
      const perVisit = l.minPence != null ? formatGBP(l.minPence) : "-";
      const term = l.termPence != null ? ` (${formatGBP(l.termPence)} per ${meta.termLabel}, ${l.item.visitsPerTerm} visits)` : "";
      out.push(`- ${l.item.tier}, ${l.discount?.name.toLowerCase() ?? "pay as you go"}: ${perVisit} per visit${term}`);
    }
  }
  out.push("");
  if (q.depositPence > 0) {
    out.push(`A ${meta.deposit.percent}% deposit (${formatGBP(q.depositPence)}) secures the booking and comes off the final bill.`);
  }
  out.push("Prices are for the vehicle size shown; condition can move the price. No call-out charge within 30 miles.");
  out.push(links.website);
  out.push(links.instagram);
  return out.join("\n");
}
