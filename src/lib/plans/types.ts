/** Maintenance plans. Pure types and date maths - safe on the server and in the browser. */
import { addDays, londonDateKey } from "@/lib/time";

export type Cadence = "weekly" | "fortnightly" | "monthly";
export type PlanStatus = "active" | "paused" | "ended";
export type VisitSource = "calendar" | "manual";

/** How due a plan is right now. Drives the colour on the screen. */
export type PlanState = "overdue" | "due" | "soon" | "ok" | "paused" | "ended";

export type Plan = {
  id: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  vehicle: string | null;
  planItemId: string | null;
  planLabel: string;
  cadence: Cadence;
  pricePence: number;
  discountId: string;
  startedOn: string;
  termVisits: number | null;
  status: PlanStatus;
  matchTerms: string[];
  notes: string | null;
  dueAlertedOn: string | null;
};

export type PlanVisit = {
  id: number;
  planId: string;
  visitOn: string;
  jobId: string | null;
  jobTitle: string | null;
  source: VisitSource;
  note: string | null;
};

export type PlanWithState = Plan & {
  visits: PlanVisit[];
  visitCount: number;
  lastVisitOn: string | null;
  nextDueOn: string | null;
  /** Negative means it is already late. Null when paused or ended. */
  daysUntilDue: number | null;
  state: PlanState;
  /** Visits done out of the term, when a term length is set. */
  termProgress: { done: number; of: number } | null;
};

export type PlanSettings = {
  /** How many days before a visit is due to send the reminder. */
  remindDaysAhead: number;
  alertOverdue: boolean;
};

export type PlansSnapshot = {
  plans: PlanWithState[];
  counts: { active: number; overdue: number; dueSoon: number };
  settings: PlanSettings;
  demo: boolean;
};

export const DEFAULT_PLAN_SETTINGS: PlanSettings = { remindDaysAhead: 2, alertOverdue: true };

export const CADENCES: { id: Cadence; label: string; short: string }[] = [
  { id: "weekly", label: "Every week", short: "Weekly" },
  { id: "fortnightly", label: "Every 2 weeks", short: "Fortnightly" },
  { id: "monthly", label: "Every month", short: "Monthly" },
];

export function cadenceLabel(c: Cadence): string {
  return CADENCES.find((x) => x.id === c)?.short ?? c;
}

/** Work out the cadence from a plan id in the price list, e.g. "plan-ext-2weekly". */
export function cadenceFromPlanItemId(id: string | null | undefined): Cadence {
  if (!id) return "fortnightly";
  if (id.endsWith("-weekly") && !id.endsWith("2weekly")) return "weekly";
  if (id.endsWith("2weekly")) return "fortnightly";
  if (id.endsWith("monthly")) return "monthly";
  return "fortnightly";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The same day of the next month, clamped to the end of short months. */
function addOneMonth(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const lastDayOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m, Math.min(d, lastDayOfNext)));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The next visit date after this one. */
export function advance(dateKey: string, cadence: Cadence): string {
  if (cadence === "weekly") return addDays(dateKey, 7);
  if (cadence === "fortnightly") return addDays(dateKey, 14);
  return addOneMonth(dateKey);
}

/** Whole days between two "YYYY-MM-DD" dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Where a plan stands today: when the next visit is due and how urgent it is.
 * The next one is due a cadence after the last visit, or on the start date if
 * nothing has happened yet. Long gaps are not "caught up" - it is always the
 * next date on or after today so an old plan does not report months of arrears.
 */
export function planState(
  plan: Plan,
  visits: PlanVisit[],
  settings: PlanSettings = DEFAULT_PLAN_SETTINGS,
  today: string = londonDateKey(new Date()),
): PlanWithState {
  const sorted = [...visits].sort((a, b) => (a.visitOn < b.visitOn ? 1 : -1));
  const lastVisitOn = sorted[0]?.visitOn ?? null;
  const base: Omit<PlanWithState, "nextDueOn" | "daysUntilDue" | "state"> = {
    ...plan,
    visits: sorted,
    visitCount: sorted.length,
    lastVisitOn,
    termProgress: plan.termVisits ? { done: sorted.length, of: plan.termVisits } : null,
  };

  if (plan.status !== "active") {
    return { ...base, nextDueOn: null, daysUntilDue: null, state: plan.status === "paused" ? "paused" : "ended" };
  }

  const nextDueOn = lastVisitOn ? advance(lastVisitOn, plan.cadence) : plan.startedOn;
  const daysUntilDue = daysBetween(today, nextDueOn);

  let state: PlanState;
  if (daysUntilDue < 0) state = "overdue";
  else if (daysUntilDue === 0) state = "due";
  else if (daysUntilDue <= settings.remindDaysAhead) state = "soon";
  else state = "ok";

  return { ...base, nextDueOn, daysUntilDue, state };
}

export function stateLabel(p: PlanWithState): string {
  switch (p.state) {
    case "overdue":
      return `${Math.abs(p.daysUntilDue ?? 0)} ${Math.abs(p.daysUntilDue ?? 0) === 1 ? "day" : "days"} late`;
    case "due":
      return "Due today";
    case "soon":
      return `Due in ${p.daysUntilDue} ${p.daysUntilDue === 1 ? "day" : "days"}`;
    case "paused":
      return "Paused";
    case "ended":
      return "Ended";
    default:
      return `Due in ${p.daysUntilDue} days`;
  }
}

/**
 * Words that mark a calendar booking as this customer's visit. The postcode is
 * deliberately not one of them - two customers on the same street would then
 * tick off each other's visits.
 */
export function matchKeys(plan: Pick<Plan, "customerName" | "matchTerms">): string[] {
  return [plan.customerName, ...plan.matchTerms]
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length >= 3);
}
