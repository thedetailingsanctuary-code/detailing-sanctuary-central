/** Money in, money out. Client-safe: no server imports. */

/**
 * The single place pounds become pence. Everything here is stored in pence and
 * the booking hub works in whole pounds, so the multiply by 100 happens here
 * and nowhere else - converting inline at each call site is how a figure gets
 * converted twice and a £509 job is invoiced at £50,900.
 *
 * Rounded because 0.1 * 100 is 10.000000000000002 in floating point, and a
 * fractional penny is rejected by the integer columns.
 */
export function poundsToPence(pounds: number | string | null | undefined): number {
  const n = typeof pounds === "string" ? Number(pounds) : pounds;
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** A grouped amount: 1,200 or 1,200.50 - commas only ever every three digits. */
const GROUPED = /^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/;
/** A plain amount: 382 or 382.50. */
const PLAIN = /^\d{1,7}(?:\.\d{1,2})?$/;

/**
 * Read a typed amount in pounds, or null if it is not one.
 *
 * This refuses rather than guesses, which is the whole point. The old version
 * stripped out everything that was not a digit or a dot and parsed what was
 * left, so "382,50" - a comma is what some phone keypads give you, and an easy
 * typo besides - quietly became 38250, and Patrick sent a customer a card link
 * for £38,250 while the box on screen still read "382,50". The mirror case,
 * "1.200,00" turning into £1.20 on a £1,200 job, is just as bad in the other
 * direction.
 *
 * So: a leading pound sign and spaces are tidied away, thousands separators are
 * allowed only where a thousands separator can legally go, and anything else -
 * including a comma used as a decimal point, or three decimal places - comes
 * back null for the caller to reject out loud.
 */
export function parsePounds(raw: string): number | null {
  const cleaned = raw.trim().replace(/^£/, "").replace(/\s/g, "");
  if (!cleaned) return null;
  if (!PLAIN.test(cleaned) && !GROUPED.test(cleaned)) return null;
  const n = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** What to tell someone who typed something we would not accept. */
export const AMOUNT_HINT = "Enter an amount like 382.50";

/** £1,234.56 */
export function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
