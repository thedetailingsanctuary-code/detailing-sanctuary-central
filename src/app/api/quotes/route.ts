import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { ReauthRequiredError } from "@/lib/auth/token-store";
import { GraphError } from "@/lib/calendar/graph";
import { configured, env } from "@/lib/env";
import { getPricing } from "@/lib/pricing";
import { quoteText, summariseQuote, type QuoteLine } from "@/lib/pricing-types";
import { BUSINESS, renderQuoteEmail } from "@/lib/quotes/email";
import { sendMail } from "@/lib/quotes/mail";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Body = {
  customer?: { name?: string; email?: string; phone?: string };
  vehicle?: string;
  note?: string;
  sizeId?: string;
  lines?: QuoteLine[];
  channel?: "email" | "whatsapp" | "text";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

/** UK mobile -> international digits for wa.me links. */
function waDigits(phone: string): string | null {
  const d = phone.replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) return d.slice(1);
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return `44${d.slice(1)}`;
  return d;
}

/** Builds, stores and (optionally) emails a quote. */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = ((await req.json().catch(() => null)) ?? {}) as Body;

    const name = clean(body.customer?.name, 80);
    const email = clean(body.customer?.email, 120).toLowerCase();
    const phone = clean(body.customer?.phone, 30);
    const vehicle = clean(body.vehicle, 80) || null;
    const note = clean(body.note, 600) || null;
    const channel = body.channel === "email" || body.channel === "whatsapp" ? body.channel : "text";
    const lines = Array.isArray(body.lines)
      ? body.lines
          .filter((l): l is QuoteLine => Boolean(l && typeof l.itemId === "string"))
          .slice(0, 30)
          .map((l) => ({ itemId: l.itemId, quantity: Math.min(20, Math.max(1, Number(l.quantity) || 1)), discountId: l.discountId ?? null }))
      : [];

    if (!name) return NextResponse.json({ error: "Please enter the customer's name." }, { status: 400 });
    if (lines.length === 0) return NextResponse.json({ error: "Add at least one service to the quote first." }, { status: 400 });
    if (channel === "email" && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
    }
    const digits = phone ? waDigits(phone) : null;
    if (channel === "whatsapp" && !digits) {
      return NextResponse.json({ error: "Enter a mobile number to send by WhatsApp." }, { status: 400 });
    }

    const data = await getPricing();
    const quote = summariseQuote(lines, data, clean(body.sizeId, 40) || data.meta.sizes[0]?.id || "standard");
    if (quote.oneOff.length + quote.plans.length === 0) {
      return NextResponse.json({ error: "None of those items are on the current price list." }, { status: 400 });
    }

    const greeting = `Hi ${name.split(/\s+/)[0]}, here is your quote from ${BUSINESS.name}${vehicle ? ` for the ${vehicle}` : ""}:`;
    const text = `${greeting}\n\n${quoteText(quote, data.meta, { website: BUSINESS.website, instagram: BUSINESS.instagram })}${
      note ? `\n\n${note}` : ""
    }\n\nTo book, reply here or call ${BUSINESS.phone}.\nPatrick, ${BUSINESS.name}`;

    let quoteId: string | null = null;
    if (hasSupabase()) {
      const { data: row, error } = await getSupabase()
        .from("quotes")
        .insert({
          customer_name: name,
          customer_email: email || null,
          customer_phone: phone || null,
          vehicle,
          size_id: quote.size.id,
          lines,
          total_min_pence: quote.minPence,
          total_max_pence: quote.maxPence,
          has_from: quote.hasFrom,
          has_quote: quote.hasQuote,
          deposit_pence: quote.depositPence,
          note,
          channel,
          text,
        })
        .select("id")
        .single<{ id: string }>();
      if (error) console.warn("[quotes] could not store quote:", error.message);
      else quoteId = row.id;
    }

    let emailSent = false;
    if (channel === "email") {
      if (env.demoMode || !configured.microsoft) {
        return NextResponse.json({ error: "Email needs the Microsoft sign-in, which is not set up on this copy of the app." }, { status: 503 });
      }
      try {
        const mail = renderQuoteEmail({ customerName: name, vehicle, note, quote, meta: data.meta });
        await sendMail({ to: email, toName: name, subject: mail.subject, html: mail.html });
        emailSent = true;
      } catch (e) {
        const message =
          e instanceof ReauthRequiredError
            ? "Microsoft sign-in needs renewing. Open the Today screen and sign in again, then resend."
            : e instanceof GraphError && (e.status === 403 || e.status === 401)
              ? "Microsoft has not granted email sending yet. Add the Mail.Send permission in Entra ID, grant consent, sign in again, then resend."
              : e instanceof Error
                ? `Email failed: ${e.message.slice(0, 200)}`
                : "Email failed.";
        if (quoteId && hasSupabase()) {
          await getSupabase().from("quotes").update({ email_status: "failed", email_error: message }).eq("id", quoteId);
        }
        return NextResponse.json({ error: message, quoteId, text }, { status: 502 });
      }
      if (quoteId && hasSupabase()) {
        await getSupabase().from("quotes").update({ email_status: "sent", sent_at: new Date().toISOString() }).eq("id", quoteId);
      }
    } else if (quoteId && hasSupabase()) {
      await getSupabase().from("quotes").update({ sent_at: new Date().toISOString() }).eq("id", quoteId);
    }

    const waUrl = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
    return NextResponse.json({ quoteId, text, waUrl, emailSent }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}
