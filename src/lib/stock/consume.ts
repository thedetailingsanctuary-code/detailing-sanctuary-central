import "server-only";
import { fetchCalendarView } from "@/lib/calendar/graph";
import { toJob } from "@/lib/calendar/parse";
import { configured, env } from "@/lib/env";
import { sendPushToAll } from "@/lib/push";
import { hasSupabase } from "@/lib/supabase";
import { matchService, stockServiceName } from "./services";
import { changeLevel, getStockSettings, hasJobEvent, listItems, listUsage, markAlerted, recordSkipped } from "./store";
import { isLow, type StockItem } from "./types";

export type ConsumeResult = {
  jobId: string;
  title: string;
  serviceKey: string | null;
  applied: { itemId: string; name: string; percent: number; levelAfter: number }[];
  skipped: boolean;
};

/** Take one job's worth of chemicals off the shelf. */
export async function consumeForJob(args: { jobId: string; title: string; serviceKey?: string | null; force?: boolean }): Promise<ConsumeResult> {
  const settings = await getStockSettings();
  const key = args.serviceKey ?? matchService(args.title, settings.aliases);
  const result: ConsumeResult = { jobId: args.jobId, title: args.title, serviceKey: key, applied: [], skipped: false };

  if (!args.force && (await hasJobEvent(args.jobId))) return result; // already handled

  const usage = await listUsage();
  const rows = usage.filter((u) => u.serviceKey === (key ?? "default"));
  const fallback = key ? [] : usage.filter((u) => u.serviceKey === "default");
  const plan = rows.length ? rows : fallback;

  if (plan.length === 0) {
    result.skipped = true;
    await recordSkipped(args.jobId, args.title);
    return result;
  }

  for (const u of plan) {
    try {
      const item = await changeLevel(u.itemId, {
        kind: "job",
        deltaPercent: -u.percentPerJob,
        jobId: args.jobId,
        jobTitle: args.title,
        serviceKey: key ?? "default",
        note: `${stockServiceName(key ?? "default")} - ${u.percentPerJob}%`,
      });
      result.applied.push({ itemId: item.id, name: item.name, percent: u.percentPerJob, levelAfter: item.levelPercent });
    } catch (e) {
      console.warn("[stock] deduction failed for", u.itemId, e);
    }
  }
  return result;
}

/** Push one combined "running low" notification for items under their minimum, not nagged recently. */
export async function alertLowStock(now = new Date()): Promise<{ notified: string[] }> {
  const settings = await getStockSettings();
  const items = await listItems();
  const cutoff = now.getTime() - settings.alertRepeatDays * 24 * 60 * 60 * 1000;
  const due: StockItem[] = items.filter((i) => isLow(i) && (!i.lowAlertedAt || new Date(i.lowAlertedAt).getTime() < cutoff));
  if (due.length === 0) return { notified: [] };

  const lines = due.map((i) => `${i.name}${i.sizeLabel ? ` (${i.sizeLabel})` : ""}: ${Math.round(i.levelPercent)}%`);
  const title = due.length === 1 ? `Running low: ${due[0].name}` : `Running low on ${due.length} chemicals`;
  const body = lines.slice(0, 5).join(", ") + (due.length > 5 ? ` and ${due.length - 5} more` : "");
  const r = await sendPushToAll({ title, body, url: "/stock", tag: "stock-low" });
  if (r.sent > 0 || r.skipped === "no-active-tokens") await markAlerted(due.map((i) => i.id));
  return { notified: due.map((i) => i.name) };
}

export type StockRunResult = {
  ran: boolean;
  reason?: string;
  processed: ConsumeResult[];
  lowNotified: string[];
};

/**
 * Called by the scheduled check: deducts stock for every job that has finished
 * since the last run (36-hour lookback so evening jobs are caught next morning).
 */
export async function runStockDeductions(now = new Date()): Promise<StockRunResult> {
  if (!hasSupabase()) return { ran: false, reason: "supabase-not-configured", processed: [], lowNotified: [] };
  const settings = await getStockSettings();
  if (!settings.autoDeduct) return { ran: false, reason: "auto-deduct-off", processed: [], lowNotified: [] };
  if (env.demoMode || !configured.microsoft) return { ran: false, reason: "calendar-not-configured", processed: [], lowNotified: [] };

  const from = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const events = await fetchCalendarView(from.toISOString(), now.toISOString());
  const finished = events
    .filter((e) => !e.isCancelled && !e.isAllDay)
    .map(toJob)
    .filter((j) => new Date(j.end).getTime() <= now.getTime());

  const processed: ConsumeResult[] = [];
  for (const job of finished) {
    if (await hasJobEvent(job.id)) continue;
    processed.push(await consumeForJob({ jobId: job.id, title: job.service || job.rawSubject }));
  }
  const { notified } = await alertLowStock(now);
  return { ran: true, processed, lowNotified: notified };
}
