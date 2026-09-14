/** Pulling an order total out of a supplier email. Deliberately cautious: anything
 *  it finds is saved as "pending" for a human to confirm, never counted on its own. */
import type { SupplierRule } from "./types";

export type ParsedOrder = {
  supplier: string;
  orderRef: string | null;
  totalPence: number | null;
};

/** Money written as £1,234.56 or 1234.56. */
const AMOUNT = "£?\\s*([0-9][0-9,]*(?:\\.[0-9]{2})?)";

/**
 * Totals, most trustworthy first. "Grand total" and "order total" beat a bare
 * "total", which in turn beats "amount paid" - a subtotal never wins.
 */
const TOTAL_PATTERNS: RegExp[] = [
  new RegExp(`grand\\s*total\\D{0,20}${AMOUNT}`, "i"),
  new RegExp(`order\\s*total\\D{0,20}${AMOUNT}`, "i"),
  new RegExp(`total\\s*(?:to\\s*pay|paid|due|cost|charged)\\D{0,20}${AMOUNT}`, "i"),
  new RegExp(`(?<!sub)total\\D{0,20}${AMOUNT}`, "i"),
  new RegExp(`amount\\s*(?:paid|due|charged)\\D{0,20}${AMOUNT}`, "i"),
];

const ORDER_REF = /(?:order|invoice)\s*(?:no\.?|number|ref(?:erence)?|#)?\s*[:#]?\s*([A-Z]{0,4}\d{4,12})/i;

export function toPence(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function findTotalPence(text: string): number | null {
  for (const re of TOTAL_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const pence = toPence(m[1]);
      // A four-figure order is possible but a six-figure one is a parse error.
      if (pence && pence <= 5_000_00) return pence;
    }
  }
  return null;
}

export function findOrderRef(text: string): string | null {
  const m = ORDER_REF.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** Which supplier does this email belong to, if any? */
export function matchSupplier(haystack: string, suppliers: SupplierRule[]): string | null {
  const lower = haystack.toLowerCase();
  for (const s of suppliers) {
    if (s.match.some((term) => lower.includes(term.toLowerCase()))) return s.name;
    if (lower.includes(s.name.toLowerCase())) return s.name;
  }
  return null;
}

/** Look at one email and decide whether it is an order worth recording. */
export function parseOrderEmail(
  args: { from: string; subject: string; body: string },
  suppliers: SupplierRule[],
): ParsedOrder | null {
  const supplier = matchSupplier(`${args.from} ${args.subject}`, suppliers);
  if (!supplier) return null;

  // Skip the noise: marketing, abandoned baskets, delivery chasers with no total.
  if (/\b(unsubscribe now|newsletter|sale ends|abandoned)\b/i.test(args.subject)) return null;

  const text = `${args.subject}\n${args.body}`;
  return {
    supplier,
    orderRef: findOrderRef(text),
    totalPence: findTotalPence(text),
  };
}
