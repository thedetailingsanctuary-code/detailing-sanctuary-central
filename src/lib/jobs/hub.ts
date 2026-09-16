import "server-only";
import { configured, env } from "@/lib/env";
import { poundsToPence, type HubJob, type JobLine } from "./types";

/**
 * The hub's reply, typed as loosely as it really is. The hub is a separate
 * system on another host: what comes back is input to be checked, not an
 * object we already know the shape of.
 */
type HubReply = { ok?: unknown; count?: unknown; jobs?: unknown };

const TIMEOUT_MS = 15_000;

/** Trimmed text, or nothing. Empty strings from the hub become null, not "". */
function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Only a date Postgres will accept in a timestamptz column gets through. */
function isoOrNull(v: unknown): string | null {
  const t = text(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A money figure from the hub, in POUNDS, before conversion. Anything that is
 * not a real number counts as zero: a NaN slipping through would land in an
 * integer column as a broken amount and get invoiced.
 */
function poundsFrom(v: unknown): number {
  const n = typeof v === "number" ? v : Number(text(v) ?? NaN);
  return Number.isFinite(n) ? n : 0;
}

function readLines(v: unknown): JobLine[] {
  if (!Array.isArray(v)) return [];
  const out: JobLine[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const line = raw as Record<string, unknown>;
    const name = text(line.name);
    if (!name) continue;
    out.push({ name, pricePence: poundsToPence(poundsFrom(line.price)) });
  }
  return out;
}

/**
 * One KV record turned into a job. The hub works in whole pounds and DS Central
 * stores pence, so poundsToPence is applied here and only here - the multiply
 * happens once, at the pull, and never again at a call site.
 */
function readJob(raw: unknown): HubJob | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // reference is the primary key. Without one there is nothing to save the job
  // under, so it is dropped rather than stored beside a made-up reference.
  const reference = text(r.reference);
  if (!reference) return null;

  return {
    reference,
    bookingId: text(r.bookingId),
    secondBookingId: text(r.secondBookingId),
    startsAt: isoOrNull(r.start),
    secondStartsAt: isoOrNull(r.secondStart),
    // customer_name cannot be null in the table, and a job with no name is
    // still a job worth seeing, so it gets a placeholder instead of vanishing.
    customerName: text(r.customerName) ?? "Unknown customer",
    customerEmail: text(r.customerEmail),
    customerPhone: text(r.customerPhone),
    address: text(r.address),
    town: text(r.town),
    postcode: text(r.postcode),
    vehicle: text(r.vehicle),
    sizeLabel: text(r.sizeLabel),
    lines: readLines(r.lines),
    totalPence: poundsToPence(poundsFrom(r.total)),
    depositPence: poundsToPence(poundsFrom(r.deposit)),
    balancePence: poundsToPence(poundsFrom(r.balance)),
    atCustomer: typeof r.atCustomer === "boolean" ? r.atCustomer : null,
    notes: text(r.notes),
    // The hub has never heard of status. This is only the starting point for a
    // job nobody has seen yet - store.ts never writes it over a job already here.
    status: "booked",
    pulledAt: null,
  };
}

/**
 * Read the job list from the hub.
 *
 * The admin key travels in the query string, which means the URL is a secret.
 * It is never logged and never put in an error message: an error Patrick could
 * screenshot or paste into a chat would otherwise hand the key out. That is
 * also why a failed fetch is not re-thrown as-is - the message the runtime
 * gives can carry the URL with it.
 */
export async function fetchHubJobs(): Promise<HubJob[]> {
  if (!configured.hub) {
    throw new Error("The hub is not connected (HUB_BASE_URL / HUB_ADMIN_KEY missing)");
  }
  const base = env.hub.baseUrl!.replace(/\/+$/, "");
  const url = `${base}/api/jobs?key=${encodeURIComponent(env.hub.adminKey!)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error("Could not reach the hub. Check it is running and try again.");
  }

  if (!res.ok) {
    // The hub answers a bad key with 403 and its own { error } body. The body is
    // left out of ours on purpose: only the status code is safe to repeat.
    if (res.status === 401 || res.status === 403) {
      throw new Error("The hub would not accept the admin key. Check HUB_ADMIN_KEY matches the key set on the hub.");
    }
    throw new Error(`The hub could not give us the job list (error ${res.status}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await res.text()) as unknown;
  } catch {
    throw new Error("The hub sent back something that is not a job list.");
  }
  const reply = (parsed && typeof parsed === "object" ? parsed : {}) as HubReply;
  if (reply.ok !== true || !Array.isArray(reply.jobs)) {
    throw new Error("The hub sent back something that is not a job list.");
  }

  const jobs: HubJob[] = [];
  const seen = new Set<string>();
  for (const raw of reply.jobs) {
    const job = readJob(raw);
    if (!job) continue;
    // Two records under one reference would fight each other inside a single
    // upsert, so the newest wins - the hub sends newest first.
    if (seen.has(job.reference)) continue;
    seen.add(job.reference);
    jobs.push(job);
  }
  return jobs;
}
