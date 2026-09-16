import "server-only";
import { configured } from "@/lib/env";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { addDays, londonDateKey, mondayFirstIndex } from "@/lib/time";
import { demoJobs } from "./demo";
import { fetchHubJobs } from "./hub";
import { isAwaitingBalance, type HubJob, type JobLine, type JobsSnapshot, type JobStatus } from "./types";

type JobRow = {
  reference: string;
  booking_id: string | null;
  second_booking_id: string | null;
  starts_at: string | null;
  second_starts_at: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  address: string | null;
  town: string | null;
  postcode: string | null;
  vehicle: string | null;
  size_label: string | null;
  lines: JobLine[] | null;
  total_pence: number;
  deposit_pence: number;
  balance_pence: number;
  at_customer: boolean | null;
  notes: string | null;
  status: string;
  pulled_at: string | null;
};

function rowToJob(r: JobRow): HubJob {
  return {
    reference: r.reference,
    bookingId: r.booking_id,
    secondBookingId: r.second_booking_id,
    startsAt: r.starts_at,
    secondStartsAt: r.second_starts_at,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    address: r.address,
    town: r.town,
    postcode: r.postcode,
    vehicle: r.vehicle,
    sizeLabel: r.size_label,
    lines: Array.isArray(r.lines) ? r.lines : [],
    totalPence: Number(r.total_pence),
    depositPence: Number(r.deposit_pence),
    balancePence: Number(r.balance_pence),
    atCustomer: r.at_customer,
    notes: r.notes,
    status: (r.status as JobStatus) || "booked",
    pulledAt: r.pulled_at,
  };
}

const SELECT =
  "reference,booking_id,second_booking_id,starts_at,second_starts_at,customer_name,customer_email,customer_phone,address,town,postcode,vehicle,size_label,lines,total_pence,deposit_pence,balance_pence,at_customer,notes,status,pulled_at";

export async function listJobs(limit = 300): Promise<HubJob[]> {
  const { data, error } = await getSupabase()
    .from("jobs")
    .select(SELECT)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as JobRow[]).map(rowToJob);
}

export async function getJob(reference: string): Promise<HubJob | null> {
  const { data, error } = await getSupabase().from("jobs").select(SELECT).eq("reference", reference).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToJob(data as JobRow) : null;
}

/** Every job pulled so far, with what is on today and what is still owed. */
export async function getJobsSnapshot(today = londonDateKey(new Date())): Promise<JobsSnapshot> {
  const hubReady = configured.hub;
  if (!hasSupabase()) {
    const jobs = demoJobs(today);
    return { jobs, ...summarise(jobs, today), hubReady, demo: true };
  }
  const jobs = await listJobs();
  return { jobs, ...summarise(jobs, today), hubReady, demo: false };
}

function summarise(jobs: HubJob[], today: string): Pick<JobsSnapshot, "counts" | "outstandingBalancePence"> {
  // Monday to Sunday, the way the week is drawn on the Calendar screen.
  const weekStart = addDays(today, -mondayFirstIndex(today));
  const weekEnd = addDays(weekStart, 6);

  let todayCount = 0;
  let thisWeek = 0;
  let awaitingBalance = 0;
  let outstandingBalancePence = 0;

  for (const job of jobs) {
    if (job.startsAt) {
      const day = londonDateKey(new Date(job.startsAt));
      if (day === today) todayCount += 1;
      if (day >= weekStart && day <= weekEnd) thisWeek += 1;
    }
    // The rule lives in types.ts so the board, the chase and this count cannot
    // drift apart. A job still only booked is not owing anything yet.
    if (isAwaitingBalance(job)) {
      awaitingBalance += 1;
      outstandingBalancePence += job.balancePence;
    }
  }

  return { counts: { today: todayCount, thisWeek, awaitingBalance }, outstandingBalancePence };
}

/**
 * Move a job along: booked -> done -> invoiced -> paid. This is the only place
 * in the app that writes status, which is what keeps a pull from touching it.
 */
export async function setJobStatus(reference: string, status: JobStatus): Promise<HubJob> {
  if (!hasSupabase()) throw new Error("Jobs need Supabase");
  const { data, error } = await getSupabase()
    .from("jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("reference", reference)
    .select(SELECT)
    .single<JobRow>();
  if (error) throw new Error(error.message);
  return rowToJob(data);
}

/**
 * The columns the hub owns, and nothing else.
 *
 * status is missing from this row on purpose. Do not add it - see pullFromHub.
 * created_at is left out too, so a job already here keeps the date it first
 * arrived rather than looking new after every pull.
 */
function hubOwnedRow(job: HubJob, pulledAt: string): Record<string, unknown> {
  return {
    reference: job.reference,
    booking_id: job.bookingId,
    second_booking_id: job.secondBookingId,
    starts_at: job.startsAt,
    second_starts_at: job.secondStartsAt,
    customer_name: job.customerName,
    customer_email: job.customerEmail,
    customer_phone: job.customerPhone,
    address: job.address,
    town: job.town,
    postcode: job.postcode,
    vehicle: job.vehicle,
    size_label: job.sizeLabel,
    lines: job.lines,
    total_pence: job.totalPence,
    deposit_pence: job.depositPence,
    balance_pence: job.balancePence,
    at_customer: job.atCustomer,
    notes: job.notes,
    source: "hub",
    updated_at: pulledAt,
    pulled_at: pulledAt,
  };
}

export type JobPullResult = { pulled: number; added: number; updated: number };

/**
 * Pull the job list from the hub and save it, keyed on reference.
 *
 * status is DS Central's own field. Patrick sets it as the work moves along and
 * the hub knows nothing about it, so the row sent up leaves status out
 * altogether: on a job that is new, Postgres fills in the 'booked' default, and
 * on a job already here the conflict only sets the columns that were actually
 * sent, so whatever status Patrick put there is left alone.
 *
 * Sending status with every pull would quietly un-invoice a job he had already
 * sent a balance for, and the first he would know about it is the customer
 * never being chased. That is why the row is built in one named function above
 * rather than spread out from the job object.
 */
export async function pullFromHub(): Promise<JobPullResult> {
  if (!hasSupabase()) throw new Error("Jobs need Supabase");

  const jobs = await fetchHubJobs();
  if (jobs.length === 0) return { pulled: 0, added: 0, updated: 0 };

  // Read first, only so the result can say what was new. The upsert below is
  // safe either way - nothing here decides whether status is written.
  const { data: existingRows, error: readError } = await getSupabase()
    .from("jobs")
    .select("reference")
    .in("reference", jobs.map((j) => j.reference));
  if (readError) throw new Error(readError.message);
  const existing = new Set((existingRows ?? []).map((r) => r.reference as string));

  const pulledAt = new Date().toISOString();
  const { error } = await getSupabase()
    .from("jobs")
    .upsert(jobs.map((j) => hubOwnedRow(j, pulledAt)), { onConflict: "reference" });
  if (error) throw new Error(error.message);

  const updated = jobs.filter((j) => existing.has(j.reference)).length;
  return { pulled: jobs.length, added: jobs.length - updated, updated };
}
