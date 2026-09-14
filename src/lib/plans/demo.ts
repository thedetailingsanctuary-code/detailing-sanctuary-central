import { addDays, londonDateKey } from "@/lib/time";
import type { Plan, PlanVisit } from "./types";

/** Sample plan customers for local preview only (no real customer data). */
export function demoPlans(now: Date): { plans: Plan[]; visits: PlanVisit[] } {
  const today = londonDateKey(now);
  const mk = (p: Partial<Plan> & Pick<Plan, "id" | "customerName" | "planLabel" | "cadence" | "pricePence">): Plan => ({
    phone: "+447700900001",
    email: null,
    address: null,
    postcode: null,
    vehicle: null,
    planItemId: null,
    discountId: "contracted",
    startedOn: addDays(today, -60),
    termVisits: 8,
    status: "active",
    matchTerms: [],
    notes: null,
    dueAlertedOn: null,
    ...p,
  });

  const plans = [
    mk({
      id: "demo-plan-1",
      customerName: "Sample Customer A",
      planLabel: "Exterior only, every 2 weeks",
      cadence: "fortnightly",
      pricePence: 4000,
      vehicle: "Black BMW 3 Series",
      address: "Tettenhall, Wolverhampton WV6 8AB, UK",
    }),
    mk({
      id: "demo-plan-2",
      customerName: "Sample Customer B",
      planLabel: "Interior & exterior, monthly",
      cadence: "monthly",
      pricePence: 8500,
      termVisits: 4,
    }),
    mk({
      id: "demo-plan-3",
      customerName: "Sample Customer C",
      planLabel: "Exterior only, weekly",
      cadence: "weekly",
      pricePence: 3250,
      termVisits: 16,
    }),
  ];

  // A is a few days late, B is due in two days, C is up to date.
  const visits: PlanVisit[] = [
    { id: 1, planId: "demo-plan-1", visitOn: addDays(today, -17), jobId: null, jobTitle: "Maintenance Wash", source: "calendar", note: null },
    { id: 2, planId: "demo-plan-1", visitOn: addDays(today, -31), jobId: null, jobTitle: "Maintenance Wash", source: "calendar", note: null },
    { id: 3, planId: "demo-plan-2", visitOn: addDays(today, -28), jobId: null, jobTitle: "Maintenance Wash", source: "calendar", note: null },
    { id: 4, planId: "demo-plan-3", visitOn: addDays(today, -2), jobId: null, jobTitle: "Maintenance Wash", source: "calendar", note: null },
  ];

  return { plans, visits };
}
