/**
 * Job types that stock usage is defined against. Deliberately separate from the
 * price list so renaming a price does not break the stock maths.
 */
export type StockService = { key: string; name: string; hint: string };

export const STOCK_SERVICES: StockService[] = [
  { key: "valeting-maintenance", name: "Maintenance wash", hint: "Plan visits and light washes" },
  { key: "valeting-full", name: "Full Valet", hint: "Inside and out" },
  { key: "valeting-deep", name: "Deep Clean", hint: "Full Valet plus interior deep clean and decon" },
  { key: "valeting-makeover", name: "Make Over", hint: "Deep clean plus gloss polish and wax" },
  { key: "sale-prep", name: "Car Sale Preparation", hint: "Exterior detail, interior, engine bay" },
  { key: "ceramic", name: "Ceramic coating job", hint: "Decon, Stage 1 polish and coating" },
  { key: "correction", name: "Paint correction", hint: "Stage 2 or multi-stage" },
  { key: "interior", name: "Interior only", hint: "Interior deep clean without exterior" },
  { key: "odour", name: "Odour / ozone job", hint: "Smell removal" },
  { key: "default", name: "Anything else", hint: "Used when a job name matches nothing above" },
];

export function stockServiceName(key: string): string {
  return STOCK_SERVICES.find((s) => s.key === key)?.name ?? key;
}

/** Built-in name matching for calendar job titles (lowercase substring). Editable in the app. */
export const DEFAULT_ALIASES: { match: string; serviceKey: string }[] = [
  { match: "stage 1/2", serviceKey: "ceramic" },
  { match: "ceramic", serviceKey: "ceramic" },
  { match: "coating", serviceKey: "ceramic" },
  { match: "stage 2", serviceKey: "correction" },
  { match: "correction", serviceKey: "correction" },
  { match: "make over", serviceKey: "valeting-makeover" },
  { match: "makeover", serviceKey: "valeting-makeover" },
  { match: "deep clean", serviceKey: "valeting-deep" },
  { match: "gold package", serviceKey: "valeting-deep" },
  { match: "full valet", serviceKey: "valeting-full" },
  { match: "silver package", serviceKey: "valeting-full" },
  { match: "maintenance", serviceKey: "valeting-maintenance" },
  { match: "sale", serviceKey: "sale-prep" },
  { match: "selling", serviceKey: "sale-prep" },
  { match: "smell", serviceKey: "odour" },
  { match: "odour", serviceKey: "odour" },
  { match: "odor", serviceKey: "odour" },
  { match: "interior", serviceKey: "interior" },
];

/** Longest matching alias wins, so "deep clean" beats "clean". */
export function matchService(title: string, aliases: { match: string; serviceKey: string }[]): string | null {
  const t = title.toLowerCase();
  const hits = aliases.filter((a) => a.match && t.includes(a.match.toLowerCase()));
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.match.length - a.match.length);
  return hits[0].serviceKey;
}
