/** Chemical stock tracked as a percentage of the current bottle. Shared by server and browser. */

export type StockCategory =
  | "prewash"
  | "wash"
  | "decon"
  | "wheels"
  | "interior"
  | "glass"
  | "polish"
  | "coating"
  | "fragrance"
  | "other";

export const STOCK_CATEGORIES: { id: StockCategory; name: string }[] = [
  { id: "prewash", name: "Pre-wash & snow foam" },
  { id: "wash", name: "Shampoo & contact wash" },
  { id: "decon", name: "Decontamination" },
  { id: "wheels", name: "Wheels & tyres" },
  { id: "interior", name: "Interior & odour" },
  { id: "glass", name: "Glass" },
  { id: "polish", name: "Polish & compound" },
  { id: "coating", name: "Coatings & protection" },
  { id: "fragrance", name: "Fragrance" },
  { id: "other", name: "Other" },
];

export type StockItem = {
  id: string;
  name: string;
  brand: string | null;
  category: StockCategory;
  sizeLabel: string | null;
  levelPercent: number;
  minPercent: number;
  supplier: string | null;
  supplierUrl: string | null;
  lastCostPence: number | null;
  lastPurchasedOn: string | null;
  lastRestockedAt: string | null;
  lowAlertedAt: string | null;
  notes: string | null;
  sortOrder: number;
};

export type StockUsage = { serviceKey: string; itemId: string; percentPerJob: number };

export type StockAlias = { match: string; serviceKey: string };

export type StockEventKind = "job" | "adjust" | "restock" | "skipped";

export type StockEvent = {
  id: number;
  createdAt: string;
  itemId: string | null;
  itemName: string | null;
  kind: StockEventKind;
  deltaPercent: number;
  levelAfter: number | null;
  jobId: string | null;
  jobTitle: string | null;
  serviceKey: string | null;
  note: string | null;
};

export type StockSettings = {
  autoDeduct: boolean;
  /** Days before the same item is nagged about again. */
  alertRepeatDays: number;
  aliases: StockAlias[];
};

export const DEFAULT_STOCK_SETTINGS: StockSettings = {
  autoDeduct: true,
  alertRepeatDays: 7,
  aliases: [],
};

export type StockSnapshot = {
  items: StockItem[];
  usage: StockUsage[];
  settings: StockSettings;
  events: StockEvent[];
  low: StockItem[];
  /** Jobs the automatic deduction could not match to a job type. */
  unmatched: StockEvent[];
  demo: boolean;
};

export function isLow(item: StockItem): boolean {
  return item.levelPercent <= item.minPercent;
}

export function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}
