import "server-only";
import { fetchCalendarView } from "@/lib/calendar/graph";
import { toJob } from "@/lib/calendar/parse";
import { configured, env } from "@/lib/env";
import { sendPushToAll } from "@/lib/push";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { londonDateKey } from "@/lib/time";
import { demoPlans } from "./demo";
import {
  DEFAULT_PLAN_SETTINGS,
  matchKeys,
  planState,
  type Cadence,
  type Plan,
  type PlanSettings,
  type PlansSnapshot,
  type PlanStatus,
  type PlanVisit,
  type PlanWithState,
  type VisitSource,
} from "./types";

type PlanRow = {
  id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  vehicle: string | null;
  plan_item_id: string | null;
  plan_label: string;
  cadence: string;
  price_pence: number;
  discount_id: string;
  started_on: string;
  term_visits: number | null;
  status: string;
  match_terms: string[] | null;
  notes: string | null;
  due_alerted_on: string | null;
};

type VisitRow = {
  id: number;
  plan_id: string;
  visit_on: string;
  job_id: string | null;
  job_title: string | null;
  source: string;
  note: string | null;
};

function rowToPlan(r: PlanRow): Plan {
  return {
    id: r.id,
    customerName: r.customer_name,
    phone: r.phone,
    email: r.email,
    address: r.address,
    postcode: r.postcode,
    vehicle: r.vehicle,
    planItemId: r.plan_item_id,
    planLabel: r.plan_label,
    cadence: (r.cadence as Cadence) || "fortnightly",
    pricePence: Number(r.price_pence),
    discountId: r.discount_id,
    startedOn: r.started_on,
    termVisits: r.term_visits,
    status: (r.status as PlanStatus) || "active",
    matchTerms: r.match_terms ?? [],
    notes: r.notes,
    dueAlertedOn: r.due_alerted_on,
  };
}

function rowToVisit(r: VisitRow): PlanVisit {
  return {
    id: r.id,
    planId: r.plan_id,
    visitOn: r.visit_on,
    jobId: r.job_id,
    jobTitle: r.job_title,
    source: (r.source as VisitSource) || "calendar",
    note: r.note,
  };
}

export async function getPlanSettings(): Promise<PlanSettings> {
  if (!hasSupabase()) return DEFAULT_PLAN_SETTINGS;
  const { data } = await getSupabase().from("app_settings").select("value").eq("key", "plans").maybeSingle();
  const v = (data?.value as Partial<PlanSettings> | undefined) ?? {};
  return {
    remindDaysAhead: v.remindDaysAhead ?? DEFAULT_PLAN_SETTINGS.remindDaysAhead,
    alertOverdue: v.alertOverdue ?? DEFAULT_PLAN_SETTINGS.alertOverdue,
  };
}

export async function savePlanSettings(patch: Partial<PlanSettings>): Promise<PlanSettings> {
  const next = { ...(await getPlanSettings()), ...patch };
  await getSupabase().from("app_settings").upsert({ key: "plans", value: next, updated_at: new Date().toISOString() });
  return next;
}

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await getSupabase().from("plans").select("*").order("customer_name");
  if (error) throw new Error(error.message);
  return (data as PlanRow[]).map(rowToPlan);
}

export async function listVisits(planIds?: string[]): Promise<PlanVisit[]> {
  let q = getSupabase().from("plan_visits").select("*").order("visit_on", { ascending: false });
  if (planIds && planIds.length) q = q.in("plan_id", planIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as VisitRow[]).map(rowToVisit);
}

/** Every plan with its visit history and how due it is today. */
export async function getPlansSnapshot(today = londonDateKey(new Date())): Promise<PlansSnapshot> {
  if (!hasSupabase()) {
    const { plans, visits } = demoPlans(new Date());
    const sample = plans
      .map((p) => planState(p, visits.filter((v) => v.planId === p.id), DEFAULT_PLAN_SETTINGS, today))
      .sort(sortByUrgency);
    return {
      plans: sample,
      counts: {
        active: sample.filter((p) => p.status === "active").length,
        overdue: sample.filter((p) => p.state === "overdue").length,
        dueSoon: sample.filter((p) => p.state === "due" || p.state === "soon").length,
      },
      settings: DEFAULT_PLAN_SETTINGS,
      demo: true,
    };
  }
  const [plans, settings] = await Promise.all([listPlans(), getPlanSettings()]);
  const visits = plans.length ? await listVisits(plans.map((p) => p.id)) : [];
  const byPlan = new Map<string, PlanVisit[]>();
  for (const v of visits) {
    const list = byPlan.get(v.planId);
    if (list) list.push(v);
    else byPlan.set(v.planId, [v]);
  }

  const withState = plans
    .map((p) => planState(p, byPlan.get(p.id) ?? [], settings, today))
    .sort(sortByUrgency);

  return {
    plans: withState,
    counts: {
      active: withState.filter((p) => p.status === "active").length,
      overdue: withState.filter((p) => p.state === "overdue").length,
      dueSoon: withState.filter((p) => p.state === "due" || p.state === "soon").length,
    },
    settings,
    demo: false,
  };
}

const RANK: Record<PlanWithState["state"], number> = { overdue: 0, due: 1, soon: 2, ok: 3, paused: 4, ended: 5 };

function sortByUrgency(a: PlanWithState, b: PlanWithState): number {
  if (RANK[a.state] !== RANK[b.state]) return RANK[a.state] - RANK[b.state];
  if (a.nextDueOn && b.nextDueOn && a.nextDueOn !== b.nextDueOn) return a.nextDueOn < b.nextDueOn ? -1 : 1;
  return a.customerName.localeCompare(b.customerName);
}

export type PlanInput = Partial<{
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
}>;

function toRow(input: PlanInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("customer_name", input.customerName);
  set("phone", input.phone);
  set("email", input.email);
  set("address", input.address);
  set("postcode", input.postcode);
  set("vehicle", input.vehicle);
  set("plan_item_id", input.planItemId);
  set("plan_label", input.planLabel);
  set("cadence", input.cadence);
  set("price_pence", input.pricePence);
  set("discount_id", input.discountId);
  set("started_on", input.startedOn);
  set("term_visits", input.termVisits);
  set("status", input.status);
  set("match_terms", input.matchTerms);
  set("notes", input.notes);
  return row;
}

export async function createPlan(input: PlanInput & { customerName: string; planLabel: string }): Promise<Plan> {
  const { data, error } = await getSupabase().from("plans").insert(toRow(input)).select("*").single<PlanRow>();
  if (error) throw new Error(error.message);
  return rowToPlan(data);
}

export async function updatePlan(id: string, input: PlanInput): Promise<Plan> {
  const { data, error } = await getSupabase()
    .from("plans")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single<PlanRow>();
  if (error) throw new Error(error.message);
  return rowToPlan(data);
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await getSupabase().from("plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addVisit(args: {
  planId: string;
  visitOn: string;
  jobId?: string | null;
  jobTitle?: string | null;
  source?: VisitSource;
  note?: string | null;
}): Promise<PlanVisit> {
  const { data, error } = await getSupabase()
    .from("plan_visits")
    .insert({
      plan_id: args.planId,
      visit_on: args.visitOn,
      job_id: args.jobId ?? null,
      job_title: args.jobTitle ?? null,
      source: args.source ?? "manual",
      note: args.note ?? null,
    })
    .select("*")
    .single<VisitRow>();
  if (error) throw new Error(error.message);
  // A visit resets the "we already told you" flag so the next one can alert.
  await getSupabase().from("plans").update({ due_alerted_on: null }).eq("id", args.planId);
  return rowToVisit(data);
}

export async function removeVisit(id: number): Promise<void> {
  const { error } = await getSupabase().from("plan_visits").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Does this booking belong to this plan? Name (or an extra term) has to appear. */
function jobMatchesPlan(plan: Plan, haystack: string): boolean {
  return matchKeys(plan).some((key) => haystack.includes(key));
}

export type PlanSyncResult = {
  ran: boolean;
  reason?: string;
  added: { planId: string; customerName: string; visitOn: string; jobTitle: string }[];
};

/**
 * Tick off plan visits from the calendar. Looks back over recent bookings and
 * records any that match a plan customer and are not already recorded. Runs
 * inside the scheduled check, so plans stay up to date without any tapping.
 */
export async function syncPlanVisits(now = new Date(), lookbackDays = 45): Promise<PlanSyncResult> {
  if (!hasSupabase()) return { ran: false, reason: "supabase-not-configured", added: [] };
  if (env.demoMode || !configured.microsoft) return { ran: false, reason: "calendar-not-configured", added: [] };

  const plans = (await listPlans()).filter((p) => p.status === "active");
  if (plans.length === 0) return { ran: true, added: [] };

  const from = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const events = await fetchCalendarView(from.toISOString(), now.toISOString());
  const done = events
    .filter((e) => !e.isCancelled)
    .map(toJob)
    .filter((j) => new Date(j.end).getTime() <= now.getTime());

  const existing = new Set(
    (await listVisits(plans.map((p) => p.id))).filter((v) => v.jobId).map((v) => `${v.planId}:${v.jobId}`),
  );

  const added: PlanSyncResult["added"] = [];
  for (const job of done) {
    const haystack = `${job.customerName ?? ""} ${job.rawSubject}`.toLowerCase();
    const plan = plans.find((p) => jobMatchesPlan(p, haystack));
    if (!plan || existing.has(`${plan.id}:${job.id}`)) continue;
    try {
      const visitOn = londonDateKey(new Date(job.start));
      await addVisit({
        planId: plan.id,
        visitOn,
        jobId: job.id,
        jobTitle: job.service || job.rawSubject,
        source: "calendar",
      });
      existing.add(`${plan.id}:${job.id}`);
      added.push({ planId: plan.id, customerName: plan.customerName, visitOn, jobTitle: job.service || job.rawSubject });
    } catch (e) {
      console.warn("[plans] could not record visit", plan.customerName, e);
    }
  }
  return { ran: true, added };
}

export type PlanAlertResult = { notified: string[] };

/** One push a day listing plan visits that are due or late. */
export async function alertPlansDue(now = new Date()): Promise<PlanAlertResult> {
  if (!hasSupabase()) return { notified: [] };
  const today = londonDateKey(now);
  const { plans, settings } = await getPlansSnapshot(today);

  const due = plans.filter(
    (p) =>
      p.status === "active" &&
      p.dueAlertedOn !== today &&
      (p.state === "due" || p.state === "soon" || (p.state === "overdue" && settings.alertOverdue)),
  );
  if (due.length === 0) return { notified: [] };

  const overdue = due.filter((p) => p.state === "overdue");
  const title =
    overdue.length > 0
      ? `${overdue.length} plan ${overdue.length === 1 ? "visit is" : "visits are"} overdue`
      : `${due.length} plan ${due.length === 1 ? "visit" : "visits"} coming up`;
  const body = due
    .slice(0, 5)
    .map((p) => `${p.customerName} (${p.state === "overdue" ? `${Math.abs(p.daysUntilDue ?? 0)}d late` : p.nextDueOn})`)
    .join(", ");

  const r = await sendPushToAll({ title, body, url: "/plans", tag: "plans-due" });
  if (r.sent > 0 || r.skipped === "no-active-tokens") {
    await getSupabase()
      .from("plans")
      .update({ due_alerted_on: today })
      .in("id", due.map((p) => p.id));
  }
  return { notified: due.map((p) => p.customerName) };
}
