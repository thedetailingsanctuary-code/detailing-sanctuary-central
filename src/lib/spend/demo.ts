import type { Purchase } from "./types";

/** Sample orders for local preview only. */
export function demoPurchases(year: number): Purchase[] {
  const rows: [string, string, number, string][] = [
    ["Gold Label Car Care", "GL78078", 14250, "03"],
    ["Gold Label Car Care", "GL77765", 9880, "04"],
    ["AutoBead", "AB4471", 6420, "05"],
    ["Gold Label Car Care", "GL77057", 17310, "06"],
    ["My Car Cleaning", "MC20551", 4495, "06"],
    ["Spotless Water", null as unknown as string, 3600, "07"],
    ["Gold Label Car Care", "GL73462", 12640, "08"],
    ["AutoBead", "AB4680", 5215, "09"],
  ];
  return rows.map(([supplier, orderRef, totalPence, month], i) => ({
    id: `demo-spend-${i}`,
    createdAt: `${year}-${month}-12T10:00:00.000Z`,
    supplier,
    orderRef: orderRef ?? null,
    purchasedOn: `${year}-${month}-12`,
    totalPence,
    source: "email" as const,
    messageId: null,
    subject: `Your order ${orderRef ?? ""} is confirmed`.trim(),
    status: "confirmed" as const,
    note: null,
  }));
}
