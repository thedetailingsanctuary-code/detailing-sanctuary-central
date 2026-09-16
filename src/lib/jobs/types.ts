/** Jobs pulled from the booking hub. Pure types and helpers - safe on the server and in the browser. */

export type JobStatus = "booked" | "done" | "invoiced" | "paid";

/** Priced in pence, like everything stored here. The hub sends pounds - see poundsToPence. */
export type JobLine = { name: string; pricePence: number };

export type HubJob = {
  reference: string;
  bookingId: string | null;
  secondBookingId: string | null;
  startsAt: string | null;
  secondStartsAt: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  address: string | null;
  town: string | null;
  postcode: string | null;
  vehicle: string | null;
  sizeLabel: string | null;
  lines: JobLine[];
  totalPence: number;
  depositPence: number;
  /** What is still owed, with the deposit already taken off. */
  balancePence: number;
  atCustomer: boolean | null;
  notes: string | null;
  status: JobStatus;
  pulledAt: string | null;
};

export type JobsSnapshot = {
  jobs: HubJob[];
  counts: { today: number; thisWeek: number; awaitingBalance: number };
  outstandingBalancePence: number;
  /** False until the hub address and admin key are in place. */
  hubReady: boolean;
  demo: boolean;
};

// Pounds-to-pence moved to @/lib/money so the payments screens share one
// converter and one parser with this one. Re-exported because the hub client
// and the jobs board both reach for it from here.
export { poundsToPence } from "@/lib/money";

/** Done or invoiced with money still owed - the jobs the balance chase is for. */
export function isAwaitingBalance(job: Pick<HubJob, "status" | "balancePence">): boolean {
  return (job.status === "done" || job.status === "invoiced") && job.balancePence > 0;
}

/**
 * £1,234.56. Same shape as money() in the payments module, repeated here on
 * purpose so the jobs board does not drag the payments module into the browser.
 */
export function jobMoney(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** One line for a list row, e.g. "Full Detail, Wheels Off". Falls back to the vehicle so a row is never blank. */
export function jobSummary(job: Pick<HubJob, "lines" | "vehicle" | "sizeLabel">): string {
  const names = job.lines.map((l) => l.name.trim()).filter(Boolean);
  if (names.length) return names.join(", ");
  return job.vehicle?.trim() || job.sizeLabel?.trim() || "Job";
}
