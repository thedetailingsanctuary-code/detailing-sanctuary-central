import "server-only";
import { graphFetch } from "@/lib/calendar/graph";
import { configured, env } from "@/lib/env";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { londonDateKey } from "@/lib/time";
import { demoPurchases } from "./demo";
import { parseOrderEmail } from "./parse";
import {
  DEFAULT_SPEND_SETTINGS,
  type MonthSpend,
  type Purchase,
  type PurchaseStatus,
  type SpendSettings,
  type SpendSnapshot,
  type SupplierSpend,
} from "./types";

type PurchaseRow = {
  id: string;
  created_at: string;
  supplier: string;
  order_ref: string | null;
  purchased_on: string;
  total_pence: number;
  source: string;
  message_id: string | null;
  subject: string | null;
  status: string;
  note: string | null;
};

function rowToPurchase(r: PurchaseRow): Purchase {
  return {
    id: r.id,
    createdAt: r.created_at,
    supplier: r.supplier,
    orderRef: r.order_ref,
    purchasedOn: r.purchased_on,
    totalPence: Number(r.total_pence),
    source: r.source === "manual" ? "manual" : "email",
    messageId: r.message_id,
    subject: r.subject,
    status: (r.status as PurchaseStatus) || "pending",
    note: r.note,
  };
}

export async function getSpendSettings(): Promise<SpendSettings> {
  if (!hasSupabase()) return DEFAULT_SPEND_SETTINGS;
  const { data } = await getSupabase().from("app_settings").select("value").eq("key", "purchases").maybeSingle();
  const v = (data?.value as Partial<SpendSettings> | undefined) ?? {};
  return {
    lookbackDays: v.lookbackDays ?? DEFAULT_SPEND_SETTINGS.lookbackDays,
    suppliers: Array.isArray(v.suppliers) && v.suppliers.length ? v.suppliers : DEFAULT_SPEND_SETTINGS.suppliers,
    lastScanAt: v.lastScanAt ?? null,
  };
}

export async function saveSpendSettings(patch: Partial<SpendSettings>): Promise<SpendSettings> {
  const next = { ...(await getSpendSettings()), ...patch };
  await getSupabase()
    .from("app_settings")
    .upsert({ key: "purchases", value: next, updated_at: new Date().toISOString() });
  return next;
}

export async function listPurchases(year?: number): Promise<Purchase[]> {
  let q = getSupabase().from("purchases").select("*").order("purchased_on", { ascending: false });
  if (year) q = q.gte("purchased_on", `${year}-01-01`).lte("purchased_on", `${year}-12-31`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as PurchaseRow[]).map(rowToPurchase);
}

/** Spend for one year, split by month and by supplier, plus anything needing a figure. */
export async function getSpendSnapshot(year = new Date().getFullYear()): Promise<SpendSnapshot> {
  const [all, settings] = hasSupabase()
    ? await Promise.all([listPurchases(year), getSpendSettings()])
    : [demoPurchases(year), DEFAULT_SPEND_SETTINGS];
  const confirmed = all.filter((p) => p.status === "confirmed");
  const pending = all.filter((p) => p.status === "pending");

  const months = new Map<string, MonthSpend>();
  const suppliers = new Map<string, SupplierSpend>();
  for (const p of confirmed) {
    const monthKey = p.purchasedOn.slice(0, 7);
    const m = months.get(monthKey) ?? { monthKey, totalPence: 0, count: 0 };
    m.totalPence += p.totalPence;
    m.count += 1;
    months.set(monthKey, m);

    const s = suppliers.get(p.supplier) ?? { supplier: p.supplier, totalPence: 0, count: 0 };
    s.totalPence += p.totalPence;
    s.count += 1;
    suppliers.set(p.supplier, s);
  }

  return {
    purchases: confirmed,
    pending,
    year,
    yearTotalPence: confirmed.reduce((sum, p) => sum + p.totalPence, 0),
    byMonth: [...months.values()].sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1)),
    bySupplier: [...suppliers.values()].sort((a, b) => b.totalPence - a.totalPence),
    settings,
    demo: !hasSupabase(),
  };
}

export type PurchaseInput = Partial<{
  supplier: string;
  orderRef: string | null;
  purchasedOn: string;
  totalPence: number;
  status: PurchaseStatus;
  note: string | null;
}>;

export async function updatePurchase(id: string, input: PurchaseInput): Promise<Purchase> {
  const row: Record<string, unknown> = {};
  if (input.supplier !== undefined) row.supplier = input.supplier;
  if (input.orderRef !== undefined) row.order_ref = input.orderRef;
  if (input.purchasedOn !== undefined) row.purchased_on = input.purchasedOn;
  if (input.totalPence !== undefined) row.total_pence = Math.max(0, Math.round(input.totalPence));
  if (input.status !== undefined) row.status = input.status;
  if (input.note !== undefined) row.note = input.note;

  const { data, error } = await getSupabase().from("purchases").update(row).eq("id", id).select("*").single<PurchaseRow>();
  if (error) throw new Error(error.message);
  return rowToPurchase(data);
}

export async function createPurchase(input: PurchaseInput & { supplier: string; totalPence: number }): Promise<Purchase> {
  const { data, error } = await getSupabase()
    .from("purchases")
    .insert({
      supplier: input.supplier,
      order_ref: input.orderRef ?? null,
      purchased_on: input.purchasedOn ?? londonDateKey(new Date()),
      total_pence: Math.max(0, Math.round(input.totalPence)),
      source: "manual",
      status: input.status ?? "confirmed",
      note: input.note ?? null,
    })
    .select("*")
    .single<PurchaseRow>();
  if (error) throw new Error(error.message);
  return rowToPurchase(data);
}

export async function deletePurchase(id: string): Promise<void> {
  const { error } = await getSupabase().from("purchases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------------- */
/* Reading supplier emails                                                     */
/* -------------------------------------------------------------------------- */

type GraphMessage = {
  id: string;
  subject?: string;
  receivedDateTime: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  bodyPreview?: string;
  body?: { content?: string };
};

/**
 * Search the mailbox for one term. Only the suppliers configured in the
 * "purchases" setting are ever searched for - nothing else is read.
 */
async function searchMessages(term: string, top = 50): Promise<GraphMessage[]> {
  const qs = new URLSearchParams({
    $search: `"${term.replace(/"/g, "")}"`,
    $select: "id,subject,receivedDateTime,from,bodyPreview,body",
    $top: String(top),
  });
  const page = await graphFetch<{ value: GraphMessage[] }>(`/me/messages?${qs.toString()}`, {
    headers: { Prefer: 'outlook.body-content-type="text"' },
  });
  return page.value ?? [];
}

export type ScanResult = {
  ran: boolean;
  reason?: string;
  scanned: number;
  added: number;
  needsFigure: number;
  errors: string[];
};

/**
 * Read recent supplier order emails and record what was spent. An email whose
 * total could be read is saved ready to count; one without lands in "needs a
 * figure" so it is never guessed at.
 */
export async function scanSupplierEmails(now = new Date()): Promise<ScanResult> {
  const empty: ScanResult = { ran: false, scanned: 0, added: 0, needsFigure: 0, errors: [] };
  if (!hasSupabase()) return { ...empty, reason: "supabase-not-configured" };
  if (env.demoMode || !configured.microsoft) return { ...empty, reason: "microsoft-not-configured" };

  const settings = await getSpendSettings();
  const cutoff = new Date(now.getTime() - settings.lookbackDays * 24 * 60 * 60 * 1000);

  const seen = new Map<string, GraphMessage>();
  const errors: string[] = [];
  for (const supplier of settings.suppliers) {
    for (const term of [supplier.name, ...supplier.match].slice(0, 2)) {
      try {
        for (const m of await searchMessages(term)) seen.set(m.id, m);
      } catch (e) {
        errors.push(`${supplier.name}: ${e instanceof Error ? e.message : "search failed"}`);
      }
    }
  }

  const recent = [...seen.values()].filter((m) => new Date(m.receivedDateTime) >= cutoff);
  if (recent.length === 0) {
    await saveSpendSettings({ lastScanAt: now.toISOString() });
    return { ran: true, scanned: 0, added: 0, needsFigure: 0, errors };
  }

  const { data: existingRows } = await getSupabase()
    .from("purchases")
    .select("message_id")
    .in("message_id", recent.map((m) => m.id));
  const existing = new Set((existingRows ?? []).map((r) => r.message_id as string));

  let added = 0;
  let needsFigure = 0;
  for (const m of recent) {
    if (existing.has(m.id)) continue;
    const parsed = parseOrderEmail(
      {
        from: m.from?.emailAddress?.address ?? m.from?.emailAddress?.name ?? "",
        subject: m.subject ?? "",
        body: m.body?.content ?? m.bodyPreview ?? "",
      },
      settings.suppliers,
    );
    if (!parsed) continue;

    const { error } = await getSupabase().from("purchases").insert({
      supplier: parsed.supplier,
      order_ref: parsed.orderRef,
      purchased_on: londonDateKey(new Date(m.receivedDateTime)),
      total_pence: parsed.totalPence ?? 0,
      source: "email",
      message_id: m.id,
      subject: (m.subject ?? "").slice(0, 300),
      // Only a total the app actually read is allowed to count towards the year.
      status: parsed.totalPence ? "confirmed" : "pending",
    });
    if (error) {
      // A duplicate message id just means another run got there first.
      if (!error.message.includes("duplicate")) errors.push(error.message);
      continue;
    }
    added += 1;
    if (!parsed.totalPence) needsFigure += 1;
  }

  await saveSpendSettings({ lastScanAt: now.toISOString() });
  return { ran: true, scanned: recent.length, added, needsFigure, errors };
}

/** Called by the scheduled check: scans at most once every 12 hours. */
export async function maybeScanSupplierEmails(now = new Date()): Promise<ScanResult> {
  const settings = await getSpendSettings();
  const last = settings.lastScanAt ? new Date(settings.lastScanAt).getTime() : 0;
  if (now.getTime() - last < 12 * 60 * 60 * 1000) {
    return { ran: false, reason: "scanned-recently", scanned: 0, added: 0, needsFigure: 0, errors: [] };
  }
  return scanSupplierEmails(now);
}
