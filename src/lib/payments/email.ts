import "server-only";
import { BUSINESS } from "@/lib/quotes/email";
import { money, type Payment } from "./types";

const GOLD = "#b8860b";
const INK = "#1a1a1d";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function kindWord(p: Payment): string {
  if (p.kind === "deposit") return "deposit";
  if (p.kind === "balance") return "balance";
  return "amount";
}

/** Branded, email-client-safe HTML asking for a payment. Matches the quote email. */
export function renderPaymentEmail(p: Payment, chase = false): { subject: string; html: string } {
  const subject = chase
    ? `Reminder: ${kindWord(p)} for your ${BUSINESS.name} booking (${p.reference})`
    : `Your ${BUSINESS.name} ${kindWord(p)} - ${money(p.amountPence)} (${p.reference})`;

  const opener = chase
    ? `Just a gentle nudge about the ${kindWord(p)} below - it is still showing as unpaid.`
    : `Thanks for booking with ${esc(BUSINESS.name)}. Here is the ${kindWord(p)} to secure it.`;

  const button = p.providerLinkUrl
    ? `<tr><td align="center" style="padding:24px 0 8px">
         <a href="${esc(p.providerLinkUrl)}"
            style="background:${GOLD};color:#ffffff;text-decoration:none;display:inline-block;
                   padding:14px 32px;border-radius:8px;font-weight:bold;font-size:17px">
           Pay ${esc(money(p.amountPence))} securely
         </a>
       </td></tr>
       <tr><td align="center" style="color:#6b7280;font-size:12px;padding-bottom:8px">
         Card, Apple Pay or Google Pay. Payment is handled by Square - we never see your card details.
       </td></tr>`
    : `<tr><td align="center" style="padding:20px 0;color:#6b7280;font-size:14px">
         Please give us a ring on ${esc(BUSINESS.phone)} to settle the ${esc(kindWord(p))}.
       </td></tr>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr><td style="background:${INK};padding:20px 24px">
        <span style="color:#ffffff;font-size:20px;letter-spacing:1px;text-transform:uppercase">
          Detailing <span style="color:${GOLD}">Sanctuary</span>
        </span>
      </td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 12px;font-size:16px">Hi ${esc(firstName(p.customerName))},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5">${opener}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 4px">
          <tr><td style="padding:12px 16px;font-size:14px;color:#4b5563">${esc(p.description)}</td>
              <td align="right" style="padding:12px 16px;font-size:18px;font-weight:bold">${esc(money(p.amountPence))}</td></tr>
          ${p.dueOn ? `<tr><td colspan="2" style="padding:0 16px 12px;font-size:13px;color:#6b7280">Please pay by ${esc(p.dueOn)}.</td></tr>` : ""}
        </table>

        ${button}

        <p style="margin:16px 0 0;font-size:13px;color:#6b7280">
          Your reference is <strong>${esc(p.reference)}</strong> - quote it if you get in touch.
        </p>
      </td></tr>
      <tr><td style="background:#fafafa;border-top:1px solid #e5e7eb;padding:16px 24px;font-size:13px;color:#4b5563">
        ${esc(BUSINESS.name)} &middot;
        <a href="${esc(BUSINESS.phoneHref)}" style="color:${GOLD};text-decoration:none">${esc(BUSINESS.phone)}</a> &middot;
        <a href="mailto:${esc(BUSINESS.email)}" style="color:${GOLD};text-decoration:none">${esc(BUSINESS.email)}</a><br>
        <a href="${esc(BUSINESS.website)}" style="color:${GOLD};text-decoration:none">${esc(BUSINESS.website)}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, html };
}
