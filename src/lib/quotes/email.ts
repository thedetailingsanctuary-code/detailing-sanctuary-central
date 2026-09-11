import "server-only";
import { formatGBP, totalLabel, type PricingMeta, type QuoteSummary } from "@/lib/pricing-types";

export const BUSINESS = {
  name: "Detailing Sanctuary",
  phone: "01902 288198",
  phoneHref: "tel:01902288198",
  email: "Detailmycar@detailingsanctuary.co.uk",
  website: "https://detailingsanctuary.co.uk",
  instagram: "https://www.instagram.com/thedetailingsanctuary",
  instagramHandle: "@thedetailingsanctuary",
};

const GOLD = "#b8860b";
const INK = "#1a1a1d";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/** Branded, email-client-safe HTML for a quote (tables and inline styles, light background). */
export function renderQuoteEmail(args: {
  customerName: string;
  vehicle: string | null;
  note: string | null;
  quote: QuoteSummary;
  meta: PricingMeta;
}): { subject: string; html: string } {
  const { customerName, vehicle, note, quote, meta } = args;
  const total = totalLabel(quote);
  const validDays = meta.quoteValidDays ?? 30;
  const subject = `Your ${BUSINESS.name} quote${vehicle ? ` - ${vehicle}` : ""}`;

  const rows = quote.oneOff
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e4da;font-size:15px;color:${INK};">
          ${esc(l.item.tier)}${l.item.quantityLabel && l.quantity > 1 ? ` &times; ${l.quantity}` : ""}
          ${l.item.detail ? `<div style="font-size:12px;color:#6b6b72;margin-top:2px;">${esc(l.item.detail)}</div>` : ""}
        </td>
        <td align="right" style="padding:10px 0 10px 16px;border-bottom:1px solid #e8e4da;font-size:15px;font-weight:bold;white-space:nowrap;color:${INK};">${esc(l.label)}</td>
      </tr>`,
    )
    .join("");

  const plans = quote.plans
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e4da;font-size:15px;color:${INK};">
          ${esc(l.item.tier)}
          <div style="font-size:12px;color:#6b6b72;margin-top:2px;">${esc(l.discount?.name ?? "Pay as you go")}${l.item.visitsPerTerm ? `, ${l.item.visitsPerTerm} visits per ${esc(meta.termLabel)}` : ""}</div>
        </td>
        <td align="right" style="padding:10px 0 10px 16px;border-bottom:1px solid #e8e4da;font-size:15px;font-weight:bold;white-space:nowrap;color:${INK};">
          ${l.minPence != null ? `${formatGBP(l.minPence)} / visit` : "-"}
          ${l.termPence != null ? `<div style="font-size:12px;font-weight:normal;color:#6b6b72;">${formatGBP(l.termPence)} per term</div>` : ""}
        </td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f2ec;font-family:Arial,Helvetica,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#08080a;padding:22px 28px;">
    <div style="font-size:22px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-transform:uppercase;">Detailing <span style="color:#f0b429;">Sanctuary</span></div>
    <div style="font-size:12px;letter-spacing:2px;color:#9a9aa3;text-transform:uppercase;margin-top:4px;">Your quote</div>
  </td></tr>
  <tr><td style="padding:26px 28px 8px 28px;">
    <p style="margin:0 0 14px 0;font-size:16px;">Hi ${esc(firstName(customerName))},</p>
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.5;">Thanks for getting in touch. Here is the quote we talked about${vehicle ? ` for your <strong>${esc(vehicle)}</strong>` : ""}, priced for a ${esc(quote.size.name.toLowerCase())}.</p>
    ${note ? `<p style="margin:0 0 18px 0;font-size:15px;line-height:1.5;background:#faf6ea;border-left:3px solid ${GOLD};padding:10px 14px;">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
  </td></tr>
  ${
    quote.oneOff.length
      ? `<tr><td style="padding:0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
      <tr>
        <td style="padding:14px 0 0 0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b6b72;">Total</td>
        <td align="right" style="padding:14px 0 0 16px;font-size:24px;font-weight:bold;color:${GOLD};white-space:nowrap;">${esc(total)}</td>
      </tr>
    </table>
  </td></tr>`
      : ""
  }
  ${
    quote.plans.length
      ? `<tr><td style="padding:22px 28px 0 28px;">
    <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b6b72;margin-bottom:6px;">Ongoing maintenance plan</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${plans}</table>
  </td></tr>`
      : ""
  }
  <tr><td style="padding:22px 28px 0 28px;font-size:13px;line-height:1.6;color:#6b6b72;">
    ${quote.depositPence > 0 ? `A ${meta.deposit.percent}% deposit (${formatGBP(quote.depositPence)}) secures your booking and comes off the final bill.<br>` : ""}
    ${quote.hasFrom ? "Starting prices assume a car in reasonable condition; heavy soiling, pet hair or neglected paint can add time.<br>" : ""}
    ${quote.hasQuote ? "Items marked as a quote are confirmed once we have seen the vehicle.<br>" : ""}
    No call-out charge within 30 miles. This quote is valid for ${validDays} days.
  </td></tr>
  <tr><td style="padding:24px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#f0b429;border-radius:8px;">
        <a href="${BUSINESS.phoneHref}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:bold;color:#08080a;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Call ${BUSINESS.phone}</a>
      </td>
      <td style="width:10px;"></td>
      <td style="border:1px solid #d9d4c7;border-radius:8px;">
        <a href="${BUSINESS.website}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:bold;color:${INK};text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Website</a>
      </td>
    </tr></table>
    <p style="margin:18px 0 0 0;font-size:14px;line-height:1.6;">To book, just reply to this email or give me a call. Happy to answer any questions.</p>
    <p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;">Patrick<br><strong>${BUSINESS.name}</strong><br>
      <a href="mailto:${BUSINESS.email}" style="color:${GOLD};text-decoration:none;">${BUSINESS.email}</a><br>
      <a href="${BUSINESS.instagram}" style="color:${GOLD};text-decoration:none;">Instagram ${BUSINESS.instagramHandle}</a></p>
  </td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0 auto;font-size:11px;color:#9a9aa3;text-align:center;">Mobile car detailing and valeting across Wolverhampton and the West Midlands.</p>
</td></tr></table>
</body></html>`;

  return { subject, html };
}
