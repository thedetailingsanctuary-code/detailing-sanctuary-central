import type { GraphEvent } from "./graph";
import type { Job } from "./types";

/**
 * Bookings arrive in Outlook via Wix Bookings -> Google Calendar sync and look like:
 *   Subject:  "Full Valet for Jane Smith +447700900000"
 *   Location: "12 Example Road, Wolverhampton WV3 0AA, UK"
 *   Body:     "Staff Member: Patrick / Client's phone number: ... / Client's email: ... / Job: Full Valet"
 * This parser is deliberately forgiving so manually typed events still work.
 */
export const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
const SUBJECT_RE = /^(.*?)\s+for\s+(.+?)(?:\s+(\+?\d[\d\s]{7,}\d))?\s*$/i;

export function parseSubject(subject: string): {
  service: string;
  customerName: string | null;
  phone: string | null;
} {
  const m = subject.match(SUBJECT_RE);
  if (!m) return { service: subject.trim(), customerName: null, phone: null };
  return {
    service: m[1].trim(),
    customerName: m[2].trim() || null,
    phone: m[3] ? m[3].replace(/\s+/g, "") : null,
  };
}

function field(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1] ? m[1].trim() : null;
}

type GraphAddress = NonNullable<NonNullable<GraphEvent["location"]>["address"]>;

function composeAddress(a?: GraphAddress): string | null {
  if (!a) return null;
  const parts = [a.street, a.city, a.postalCode, a.countryOrRegion].filter(
    (x): x is string => Boolean(x && x.trim()),
  );
  return parts.length ? parts.join(", ") : null;
}

function toIso(dt: { dateTime: string; timeZone: string }): string {
  const trimmed = dt.dateTime.replace(/(\.\d{3})\d+$/, "$1");
  const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(trimmed);
  const iso = hasZone || (dt.timeZone && dt.timeZone !== "UTC") ? trimmed : `${trimmed}Z`;
  return new Date(iso).toISOString();
}

function stripBoilerplate(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^staff member:/i.test(l))
    .filter((l) => !/^client'?s phone number:/i.test(l))
    .filter((l) => !/^client'?s email:/i.test(l))
    .filter((l) => !/^job:/i.test(l))
    .filter((l) => !/^synced from wix bookings/i.test(l));
  const out = lines.join("\n").trim();
  return out.length ? out : null;
}

export function toJob(ev: GraphEvent): Job {
  const subject = ev.subject?.trim() || "(No title)";
  const parsed = parseSubject(subject);
  const rawBody = ev.body?.content ?? ev.bodyPreview ?? "";
  const text = rawBody
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");

  const bodyPhone = field(text, /phone number:\s*([+\d][\d\s]{6,})/i);
  const email = field(text, /email:\s*([^\s<>]+@[^\s<>]+)/i);
  const jobField = field(text, /\bJob:\s*([^\n\r]+)/i);

  const address = ev.location?.displayName?.trim() || composeAddress(ev.location?.address) || null;
  const pc = address?.match(UK_POSTCODE_RE);
  const postcode = pc ? `${pc[1].toUpperCase()} ${pc[2].toUpperCase()}` : null;

  const lat = ev.location?.coordinates?.latitude;
  const lng = ev.location?.coordinates?.longitude;
  const coordinates =
    typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0) ? { lat, lng } : null;

  return {
    id: ev.id,
    service: jobField ?? parsed.service,
    customerName: parsed.customerName,
    phone: parsed.phone ?? (bodyPhone ? bodyPhone.replace(/\s+/g, "") : null),
    email,
    address,
    postcode,
    coordinates,
    start: toIso(ev.start),
    end: toIso(ev.end),
    isAllDay: Boolean(ev.isAllDay),
    webLink: ev.webLink ?? null,
    notes: stripBoilerplate(text),
    rawSubject: subject,
  };
}
