import "server-only";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { DEFAULT_ALIASES } from "./services";
import {
  clampPercent,
  DEFAULT_STOCK_SETTINGS,
  isLow,
  type StockCategory,
  type StockEvent,
  type StockEventKind,
  type StockItem,
  type StockSettings,
  type StockSnapshot,
  type StockUsage,
} from "./types";

type ItemRow = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  size_label: string | null;
  level_percent: number | string;
  min_percent: number | string;
  supplier: string | null;
  supplier_url: string | null;
  last_cost_pence: number | null;
  last_purchased_on: string | null;
  last_restocked_at: string | null;
  low_alerted_at: string | null;
  notes: string | null;
  sort_order: number;
};

type EventRow = {
  id: number;
  created_at: string;
  item_id: string | null;
  kind: StockEventKind;
  delta_percent: number | string;
  level_after: number | string | null;
  job_id: string | null;
  job_title: string | null;
  service_key: string | null;
  note: string | null;
};

function rowToItem(r: ItemRow): StockItem {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: (r.category as StockCategory) || "other",
    sizeLabel: r.size_label,
    levelPercent: Number(r.level_percent),
    minPercent: Number(r.min_percent),
    supplier: r.supplier,
    supplierUrl: r.supplier_url,
    lastCostPence: r.last_cost_pence,
    lastPurchasedOn: r.last_purchased_on,
    lastRestockedAt: r.last_restocked_at,
    lowAlertedAt: r.low_alerted_at,
    notes: r.notes,
    sortOrder: r.sort_order,
  };
}

export async function getStockSettings(): Promise<StockSettings> {
  if (!hasSupabase()) return { ...DEFAULT_STOCK_SETTINGS, aliases: DEFAULT_ALIASES };
  const { data } = await getSupabase().from("app_settings").select("value").eq("key", "stock").maybeSingle();
  const v = (data?.value as Partial<StockSettings> | undefined) ?? {};
  return {
    autoDeduct: v.autoDeduct ?? DEFAULT_STOCK_SETTINGS.autoDeduct,
    alertRepeatDays: v.alertRepeatDays ?? DEFAULT_STOCK_SETTINGS.alertRepeatDays,
    aliases: Array.isArray(v.aliases) && v.aliases.length ? v.aliases : DEFAULT_ALIASES,
  };
}

export async function saveStockSettings(patch: Partial<StockSettings>): Promise<StockSettings> {
  const current = await getStockSettings();
  const next = { ...current, ...patch };
  await getSupabase()
    .from("app_settings")
    .upsert({ key: "stock", value: next, updated_at: new Date().toISOString() });
  return next;
}

export async function listItems(): Promise<StockItem[]> {
  const { data, error } = await getSupabase()
    .from("stock_items")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data as ItemRow[]).map(rowToItem);
}

export async function listUsage(): Promise<StockUsage[]> {
  const { data, error } = await getSupabase().from("stock_usage").select("service_key,item_id,percent_per_job");
  if (error) throw new Error(error.message);
  return (data as { service_key: string; item_id: string; percent_per_job: number | string }[]).map((r) => ({
    serviceKey: r.service_key,
    itemId: r.item_id,
    percentPerJob: Number(r.percent_per_job),
  }));
}

export async function listEvents(limit = 60): Promise<StockEvent[]> {
  const { data, error } = await getSupabase()
    .from("stock_events")
    .select("*, stock_items(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as (EventRow & { stock_items: { name: string } | null })[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    itemId: r.item_id,
    itemName: r.stock_items?.name ?? null,
    kind: r.kind,
    deltaPercent: Number(r.delta_percent),
    levelAfter: r.level_after == null ? null : Number(r.level_after),
    jobId: r.job_id,
    jobTitle: r.job_title,
    serviceKey: r.service_key,
    note: r.note,
  }));
}

export async function getStockSnapshot(): Promise<StockSnapshot> {
  if (!hasSupabase()) {
    return { items: [], usage: [], settings: { ...DEFAULT_STOCK_SETTINGS, aliases: DEFAULT_ALIASES }, events: [], low: [], unmatched: [], demo: true };
  }
  const [items, usage, settings, events] = await Promise.all([listItems(), listUsage(), getStockSettings(), listEvents()]);
  const unmatched = events.filter((e) => e.kind === "skipped").slice(0, 10);
  return { items, usage, settings, events, low: items.filter(isLow), unmatched, demo: false };
}

export type ItemInput = Partial<{
  name: string;
  brand: string | null;
  category: StockCategory;
  sizeLabel: string | null;
  minPercent: number;
  supplier: string | null;
  supplierUrl: string | null;
  lastCostPence: number | null;
  lastPurchasedOn: string | null;
  notes: string | null;
  sortOrder: number;
}>;

function toRow(input: ItemInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.brand !== undefined) row.brand = input.brand;
  if (input.category !== undefined) row.category = input.category;
  if (input.sizeLabel !== undefined) row.size_label = input.sizeLabel;
  if (input.minPercent !== undefined) row.min_percent = clampPercent(input.minPercent);
  if (input.supplier !== undefined) row.supplier = input.supplier;
  if (input.supplierUrl !== undefined) row.supplier_url = input.supplierUrl;
  if (input.lastCostPence !== undefined) row.last_cost_pence = input.lastCostPence;
  if (input.lastPurchasedOn !== undefined) row.last_purchased_on = input.lastPurchasedOn;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  return row;
}

export async function createItem(input: ItemInput & { name: string; levelPercent?: number }): Promise<StockItem> {
  const { data, error } = await getSupabase()
    .from("stock_items")
    .insert({ ...toRow(input), level_percent: clampPercent(input.levelPercent ?? 100) })
    .select("*")
    .single<ItemRow>();
  if (error) throw new Error(error.message);
  return rowToItem(data);
}

export async function updateItem(id: string, input: ItemInput): Promise<StockItem> {
  const { data, error } = await getSupabase()
    .from("stock_items")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single<ItemRow>();
  if (error) throw new Error(error.message);
  return rowToItem(data);
}

export async function deactivateItem(id: string): Promise<void> {
  const { error } = await getSupabase().from("stock_items").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Change the level and log why. Returns the updated item. */
export async function changeLevel(
  id: string,
  args: { kind: StockEventKind; toPercent?: number; deltaPercent?: number; note?: string; jobId?: string; jobTitle?: string; serviceKey?: string },
): Promise<StockItem> {
  const sb = getSupabase();
  const { data: current, error } = await sb.from("stock_items").select("*").eq("id", id).single<ItemRow>();
  if (error) throw new Error(error.message);
  const before = Number(current.level_percent);
  const after = clampPercent(args.toPercent != null ? args.toPercent : before + (args.deltaPercent ?? 0));
  const patch: Record<string, unknown> = { level_percent: after, updated_at: new Date().toISOString() };
  if (args.kind === "restock") {
    patch.last_restocked_at = new Date().toISOString();
    patch.low_alerted_at = null;
  }
  if (after > Number(current.min_percent)) patch.low_alerted_at = null;
  const { data: updated, error: e2 } = await sb.from("stock_items").update(patch).eq("id", id).select("*").single<ItemRow>();
  if (e2) throw new Error(e2.message);
  await sb.from("stock_events").insert({
    item_id: id,
    kind: args.kind,
    delta_percent: Math.round((after - before) * 100) / 100,
    level_after: after,
    note: args.note ?? null,
    job_id: args.jobId ?? null,
    job_title: args.jobTitle ?? null,
    service_key: args.serviceKey ?? null,
  });
  return rowToItem(updated);
}

export async function setUsage(serviceKey: string, itemId: string, percentPerJob: number): Promise<void> {
  const sb = getSupabase();
  if (percentPerJob <= 0) {
    await sb.from("stock_usage").delete().eq("service_key", serviceKey).eq("item_id", itemId);
    return;
  }
  const { error } = await sb
    .from("stock_usage")
    .upsert({ service_key: serviceKey, item_id: itemId, percent_per_job: clampPercent(percentPerJob) }, { onConflict: "service_key,item_id" });
  if (error) throw new Error(error.message);
}

export async function hasJobEvent(jobId: string): Promise<boolean> {
  const { data } = await getSupabase().from("stock_events").select("id").eq("job_id", jobId).in("kind", ["job", "skipped"]).limit(1);
  return Boolean(data && data.length);
}

export async function recordSkipped(jobId: string, jobTitle: string): Promise<void> {
  await getSupabase().from("stock_events").insert({
    item_id: null,
    kind: "skipped",
    delta_percent: 0,
    level_after: null,
    job_id: jobId,
    job_title: jobTitle,
    note: "No matching job type - assign one in Stock",
  });
}

export async function markAlerted(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await getSupabase().from("stock_items").update({ low_alerted_at: new Date().toISOString() }).in("id", ids);
}
