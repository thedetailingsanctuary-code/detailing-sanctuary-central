/** Money spent on products, read from supplier emails. Shared by server and browser. */

export type PurchaseStatus = "pending" | "confirmed" | "dismissed";
export type PurchaseSource = "email" | "manual";

export type Purchase = {
  id: string;
  createdAt: string;
  supplier: string;
  orderRef: string | null;
  purchasedOn: string;
  totalPence: number;
  source: PurchaseSource;
  messageId: string | null;
  subject: string | null;
  status: PurchaseStatus;
  note: string | null;
};

export type SupplierRule = {
  name: string;
  /** Words that identify this supplier in the sender address or subject. */
  match: string[];
};

export type SpendSettings = {
  /** How far back to search the mailbox on each scan. */
  lookbackDays: number;
  suppliers: SupplierRule[];
  lastScanAt?: string | null;
};

export type MonthSpend = { monthKey: string; totalPence: number; count: number };
export type SupplierSpend = { supplier: string; totalPence: number; count: number };

export type SpendSnapshot = {
  /** Confirmed purchases, newest first. */
  purchases: Purchase[];
  /** Found in the mailbox but not yet confirmed. */
  pending: Purchase[];
  year: number;
  yearTotalPence: number;
  byMonth: MonthSpend[];
  bySupplier: SupplierSpend[];
  settings: SpendSettings;
  demo: boolean;
};

export const DEFAULT_SPEND_SETTINGS: SpendSettings = {
  lookbackDays: 45,
  suppliers: [
    { name: "Gold Label Car Care", match: ["goldlabel", "gold label"] },
    { name: "AutoBead", match: ["autobead", "auto bead"] },
    { name: "My Car Cleaning", match: ["mycarcleaning", "my car cleaning"] },
    { name: "Spotless Water", match: ["spotless water", "spotlesswater"] },
  ],
};

export function poundsLabel(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** £1,234 - no pence, for headline totals. */
export function poundsShort(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}
