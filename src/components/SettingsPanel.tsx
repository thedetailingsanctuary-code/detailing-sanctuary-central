"use client";
import { useCallback, useEffect, useState } from "react";
import type { StatusResponse } from "@/app/api/status/route";
import { errorMessage, fetchJson, useLocalStorageValue, useNotificationPermission } from "@/lib/client-hooks";
import { enablePush, pushConfiguredOnClient } from "@/lib/push/client";
import { formatTime } from "@/lib/time";
import { InstallButton } from "./InstallButton";
import { WEBSITE_URL } from "./QuickLinks";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Dot({ ok, warn = false }: { ok: boolean; warn?: boolean }) {
  const cls = ok ? "bg-ok" : warn ? "bg-warn" : "bg-fg-muted";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} aria-hidden />;
}

export function SettingsPanel({ email, name, demo }: { email: string; name: string; demo: boolean }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const storedPermission = useNotificationPermission();
  const storedToken = useLocalStorageValue("dsc_push_token");
  const [enabledNow, setEnabledNow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const permission = enabledNow ? "granted" : storedPermission;
  const hasToken = enabledNow || Boolean(storedToken);

  const loadStatus = useCallback(
    () =>
      fetchJson<StatusResponse>("/api/status")
        .then(setStatus)
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function onEnable() {
    setBusy(true);
    setMessage(null);
    const r = await enablePush();
    if (r.ok) {
      setEnabledNow(true);
      setMessage("This phone will now receive rain alerts.");
      await loadStatus();
    } else {
      setMessage(r.reason);
    }
    setBusy(false);
  }

  async function onTest() {
    setBusy(true);
    setMessage(null);
    try {
      const j = await fetchJson<{ sent: number; total: number; skipped?: string }>("/api/push/test", { method: "POST" });
      if (j.skipped) setMessage(`Nothing sent: ${j.skipped.replace(/-/g, " ")}`);
      else setMessage(`Sent to ${j.sent} of ${j.total} device${j.total === 1 ? "" : "s"}.`);
    } catch (e) {
      setMessage(errorMessage(e, "Test failed"));
    } finally {
      setBusy(false);
    }
  }

  const clientReady = pushConfiguredOnClient();
  const rain = status?.settings.rainAlert;
  const hours = status?.settings.businessHours;

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Account</h2>
        <p className="mt-1 font-display text-xl">{name || "Signed in"}</p>
        <p className="text-sm text-fg-dim">{email}</p>
        {!demo && (
          <form
            method="post"
            action="/api/auth/logout"
            className="mt-3"
            onSubmit={() => {
              // Drop the cached API responses before the session goes. They hold customer
              // names, addresses and balances, and nothing else ever clears them.
              navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHE" });
            }}
          >
            <button type="submit" className="btn btn-ghost w-full">
              Sign out
            </button>
          </form>
        )}
        {demo && <p className="mt-2 text-xs text-warn">Local preview mode - sign-in is bypassed on this machine only.</p>}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Rain alerts</h2>
        <p className="text-sm text-fg-dim">
          {rain && hours
            ? `Checks every 15 min, ${hours.start}-${hours.end} on ${hours.days.map((d) => DAY_NAMES[d]).join(", ")}. Alerts when ${rain.thresholdMm} mm or more of rain is due within ${rain.leadMinutes} min at the job (or home base between jobs).`
            : "Checks the forecast at the current or next job during business hours."}
        </p>
        <ul className="space-y-1 text-sm">
          <li className="flex items-center gap-2">
            <Dot ok={permission === "granted" && hasToken} warn={permission === "denied"} />
            This phone:{" "}
            {permission === "unsupported"
              ? "notifications not supported here"
              : permission === "denied"
                ? "notifications blocked in browser settings"
                : hasToken
                  ? "registered for alerts"
                  : "not registered yet"}
          </li>
          <li className="flex items-center gap-2">
            <Dot ok={Boolean(status?.configured.push) && clientReady} />
            Push service:{" "}
            {status ? (status.configured.push && clientReady ? "configured" : "not configured (Firebase keys)") : "..."}
          </li>
          <li className="flex items-center gap-2">
            <Dot ok={(status?.activeDevices ?? 0) > 0} />
            Devices registered: {status?.activeDevices ?? "-"}
          </li>
          {status?.lastAlert && (
            <li className="text-xs text-fg-muted">
              Last alert: {status.lastAlert.title ?? status.lastAlert.reason} at {formatTime(status.lastAlert.sentAt)}
            </li>
          )}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => void onEnable()}
            disabled={busy || permission === "denied" || permission === "unsupported"}
          >
            {hasToken ? "Re-register" : "Enable alerts"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void onTest()} disabled={busy}>
            Send test
          </button>
        </div>
        {message && <p className="text-sm text-fg-dim">{message}</p>}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Install</h2>
        <InstallButton />
      </section>

      <section className="card p-4">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Connections</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li className="flex items-center gap-2">
            <Dot
              ok={Boolean(status?.microsoft?.connected && !status?.microsoft?.needsReauth)}
              warn={Boolean(status?.microsoft?.needsReauth)}
            />
            Microsoft 365 calendar:{" "}
            {status
              ? status.demoMode
                ? "sample data (preview)"
                : !status.configured.microsoft
                  ? "not configured"
                  : status.microsoft?.needsReauth
                    ? "sign in again"
                    : status.microsoft?.connected
                      ? `connected (${status.microsoft.email ?? ""})`
                      : "not connected yet"
              : "..."}
          </li>
          <li className="flex items-center gap-2">
            <Dot ok={Boolean(status?.configured.supabase)} />
            Database (Supabase): {status ? (status.configured.supabase ? "configured" : "not configured") : "..."}
          </li>
          <li className="flex items-center gap-2">
            <Dot ok={Boolean(status?.configured.cron)} />
            Scheduled check secret: {status ? (status.configured.cron ? "set" : "not set") : "..."}
          </li>
          <li className="flex items-center gap-2">
            <Dot ok={Boolean(status)} />
            Weather source: {status?.weatherProvider ?? "..."}
          </li>
        </ul>
      </section>

      <a href={WEBSITE_URL} target="_blank" rel="noopener" className="btn btn-ghost w-full">
        Open detailingsanctuary.co.uk
      </a>

      <p className="text-center text-[0.65rem] uppercase tracking-wider text-fg-muted">
        DS Central v1 {status?.appBaseUrl ? `- ${status.appBaseUrl.replace(/^https?:\/\//, "")}` : ""}
      </p>
    </div>
  );
}
