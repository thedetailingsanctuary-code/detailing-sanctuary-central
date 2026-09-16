"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, fetchJson } from "@/lib/client-hooks";
import { AMOUNT_HINT, parsePounds } from "@/lib/money";
import {
  isAwaitingBalance,
  jobMoney,
  jobSummary,
  poundsToPence,
  type HubJob,
  type JobStatus,
  type JobsSnapshot,
} from "@/lib/jobs/types";
// Type only, so the payments module itself never follows this board into the browser.
import type { Payment } from "@/lib/payments/types";
import { addDays, formatShortDate, formatTime, londonDateKey } from "@/lib/time";
import { mapsUrl } from "./JobCard";

type Filter = "today" | "week" | "awaiting" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "awaiting", label: "Awaiting balance" },
  { id: "all", label: "All" },
];

const STATUS: Record<JobStatus, { label: string; tone: string }> = {
  booked: { label: "Booked", tone: "text-fg-muted" },
  done: { label: "Done", tone: "text-warn" },
  invoiced: { label: "Invoiced", tone: "text-gold" },
  paid: { label: "Paid", tone: "text-ok" },
};

/** Rounded pounds for the headline figure - pennies are noise at that size. */
const moneyShort = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

function dayKeyOf(job: HubJob): string | null {
  return job.startsAt ? londonDateKey(new Date(job.startsAt)) : null;
}

function whenLabel(job: HubJob, today: string): string {
  if (!job.startsAt) return "No date";
  const time = formatTime(job.startsAt);
  return dayKeyOf(job) === today ? time : `${formatShortDate(job.startsAt)} - ${time}`;
}

export function JobsPanel() {
  const [snap, setSnap] = useState<JobsSnapshot | null>(null);
  const [filter, setFilter] = useState<Filter>("today");
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [sending, setSending] = useState<HubJob | null>(null);
  // Balances already raised, by job reference. Without this the board would keep
  // offering "Send balance" on a job that has been billed and is simply waiting
  // to be paid, which is how one car ends up with two live payment links.
  const [openBalances, setOpenBalances] = useState<Record<string, Payment>>({});

  const load = useCallback(
    () =>
      Promise.all([
        fetchJson<JobsSnapshot>("/api/jobs"),
        // A failure here must not blank the board, but it does mean the guard
        // below is missing, so the Send button stays hidden rather than risking a
        // duplicate: an empty map is the safe direction only if we also know the
        // fetch worked, so record the failure.
        fetchJson<{ payments: Payment[] }>("/api/payments").catch(() => null),
      ])
        .then(([s, pay]) => {
          setSnap(s);
          if (pay) {
            const open: Record<string, Payment> = {};
            for (const p of pay.payments) {
              if (p.jobId && p.kind === "balance" && (p.status === "draft" || p.status === "sent")) open[p.jobId] = p;
            }
            setOpenBalances(open);
          }
          setError(null);
        })
        .catch((e: unknown) => setError(errorMessage(e, "Could not load jobs"))),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const pull = useCallback(async () => {
    setPulling(true);
    try {
      await fetchJson("/api/jobs?pull=1", { method: "POST" });
      await load();
    } catch (e) {
      setError(errorMessage(e, "Could not reach the hub"));
    } finally {
      setPulling(false);
    }
  }, [load]);

  const today = londonDateKey(new Date());
  // "This week" means today and the next six days - what is coming, not a Monday to Sunday box.
  const weekEnd = addDays(today, 6);

  const shown = useMemo(() => {
    const list = snap?.jobs ?? [];
    const picked = list.filter((j) => {
      if (filter === "all") return true;
      if (filter === "awaiting") return isAwaitingBalance(j);
      const key = dayKeyOf(j);
      if (!key) return false;
      return filter === "today" ? key === today : key >= today && key <= weekEnd;
    });
    // Diary views read soonest first; the money views read newest first.
    const upcoming = filter === "today" || filter === "week";
    return picked.sort((a, b) => {
      const at = a.startsAt ?? "";
      const bt = b.startsAt ?? "";
      return upcoming ? at.localeCompare(bt) : bt.localeCompare(at);
    });
  }, [snap, filter, today, weekEnd]);

  if (error && !snap) return <p className="card border-danger/50 p-4 text-sm text-danger">{error}</p>;
  if (!snap) return <p className="card p-6 text-center text-sm text-fg-muted">Loading jobs...</p>;

  const { counts } = snap;

  return (
    <div className="space-y-4">
      {snap.demo && <div className="pill border-gold/40 text-gold">Local preview - sample jobs</div>}

      {!snap.hubReady && (
        <div className="card border-warn/50 p-3 text-sm">
          <span className="font-display uppercase text-warn">The hub is not connected yet</span>
          <p className="mt-1 text-xs text-fg-dim">
            Add <code>HUB_BASE_URL</code> and <code>HUB_ADMIN_KEY</code> in Vercel and redeploy. Until then this list
            only shows what has already been pulled across - nothing new can come in.
          </p>
        </div>
      )}

      <section className="card-gold p-4 text-center">
        <div className="font-display text-4xl text-gold">{moneyShort(snap.outstandingBalancePence)}</div>
        <p className="mt-1 text-xs uppercase tracking-wider text-fg-muted">Balances still to collect</p>
        <div className="mt-3 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
          <Stat label="Today" value={counts.today} />
          <Stat label="This week" value={counts.thisWeek} />
          <Stat
            label="Awaiting"
            value={counts.awaitingBalance}
            tone={counts.awaitingBalance > 0 ? "text-warn" : undefined}
          />
        </div>
      </section>

      <button type="button" onClick={pull} disabled={pulling || !snap.hubReady} className="btn btn-gold w-full">
        {pulling ? "Pulling..." : "Pull from hub"}
      </button>

      {error && <p className="card border-danger/50 p-3 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} data-active={filter === f.id} className="chip">
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="card p-6 text-sm text-fg-muted">
          {snap.jobs.length === 0
            ? "No jobs here yet. Tap Pull from hub to bring across what has been booked."
            : filter === "today"
              ? "Nothing booked today."
              : filter === "week"
                ? "Nothing booked in the next week."
                : filter === "awaiting"
                  ? "Every balance is settled up."
                  : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((job) => (
            <JobRow
              key={job.reference}
              job={job}
              today={today}
              openBalance={openBalances[job.reference] ?? null}
              onChanged={load}
              onSendBalance={() => setSending(job)}
            />
          ))}
        </ul>
      )}

      {sending && (
        <SendBalanceSheet
          job={sending}
          onClose={() => setSending(null)}
          onDone={async () => {
            setSending(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="px-1">
      <div className={`font-display text-2xl ${tone ?? "text-fg"}`}>{value}</div>
      <div className="text-[0.62rem] uppercase tracking-wider text-fg-muted">{label}</div>
    </div>
  );
}

function JobRow({
  job,
  today,
  openBalance,
  onChanged,
  onSendBalance,
}: {
  job: HubJob;
  today: string;
  /** A balance already raised for this job and not yet paid. */
  openBalance: Payment | null;
  onChanged: () => Promise<void>;
  onSendBalance: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = STATUS[job.status];
  const summary = jobSummary(job);
  const fullAddress = [job.address, job.town, job.postcode].filter(Boolean).join(", ");

  const setStatus = async (next: JobStatus) => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/jobs/${job.reference}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      await onChanged();
    } catch (e) {
      setError(errorMessage(e, "That did not work"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`card overflow-hidden ${isAwaitingBalance(job) ? "border-warn/50" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg uppercase leading-tight">{job.customerName}</div>
          <div className="truncate text-xs text-fg-muted">{summary}</div>
          <div className="mt-0.5 text-xs text-fg-dim">{whenLabel(job, today)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-display text-lg ${job.balancePence > 0 ? "text-gold" : "text-fg-muted"}`}>
            {jobMoney(job.balancePence)}
          </div>
          <div className={`text-[0.62rem] uppercase tracking-wider ${status.tone}`}>{status.label}</div>
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-3 text-sm">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-line p-2 text-center">
            <Amount label="Total" pence={job.totalPence} />
            <Amount label="Deposit paid" pence={job.depositPence} tone="text-ok" />
            <Amount
              label="Balance due"
              pence={job.balancePence}
              tone={job.balancePence > 0 ? "text-gold" : "text-fg-muted"}
            />
          </div>

          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Vehicle" value={job.vehicle ?? "-"} />
            <Field label="Size" value={job.sizeLabel ?? "-"} />
            <Field label="Reference" value={job.reference} />
            <Field
              label="Second day"
              value={job.secondStartsAt ? `${formatShortDate(job.secondStartsAt)} - ${formatTime(job.secondStartsAt)}` : "-"}
            />
          </dl>

          {fullAddress && (
            <p className="text-fg-dim">
              {job.atCustomer ? "At the customer: " : ""}
              <a href={mapsUrl(fullAddress)} target="_blank" rel="noopener" className="text-gold underline">
                {fullAddress}
              </a>
            </p>
          )}

          {job.notes && <p className="whitespace-pre-line text-fg-dim">{job.notes}</p>}
          {error && <p className="text-xs text-danger">{error}</p>}

          {openBalance && (
            <p className="rounded-lg border border-gold/40 bg-surface-2 p-2 text-xs text-fg-dim">
              Balance of {jobMoney(openBalance.amountPence)} already requested
              {openBalance.sentAt ? ` - sent ${formatShortDate(openBalance.sentAt)}` : " - not sent yet"}. Chase it from
              the Payments screen rather than raising another.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {isAwaitingBalance(job) && !openBalance && (
              <button type="button" onClick={onSendBalance} className="btn btn-gold min-h-11 text-sm">
                Send balance
              </button>
            )}
            {job.customerPhone && (
              <a href={`tel:${job.customerPhone}`} className="btn btn-ghost min-h-11 text-sm">
                Call
              </a>
            )}
            {job.customerEmail && (
              <a href={`mailto:${job.customerEmail}`} className="btn btn-ghost min-h-11 text-sm">
                Email
              </a>
            )}
            {fullAddress && (
              <a href={mapsUrl(fullAddress)} target="_blank" rel="noopener" className="btn btn-ghost min-h-11 text-sm">
                Directions
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {job.status !== "booked" && (
              <button type="button" onClick={() => setStatus("booked")} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                Back to booked
              </button>
            )}
            {job.status !== "done" && (
              <button type="button" onClick={() => setStatus("done")} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                Mark as done
              </button>
            )}
            {/* The webhook retires a job when its balance is paid by card. This is the
                way out for cash, a card reader or a bank transfer - without it the job
                sits under Awaiting balance for ever, still offering to bill it again. */}
            {job.status !== "paid" && job.balancePence > 0 && (
              <button type="button" onClick={() => setStatus("paid")} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                Settled - mark paid
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Amount({ label, pence, tone }: { label: string; pence: number; tone?: string }) {
  return (
    <div>
      <div className={`font-display text-base ${tone ?? "text-fg"}`}>{jobMoney(pence)}</div>
      <div className="text-[0.6rem] uppercase tracking-wider text-fg-muted">{label}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.62rem] uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className="text-fg-dim">{value}</dd>
    </div>
  );
}

/**
 * Square is not connected, so a created request comes back with no link. Say that plainly instead of
 * wording it as though something payable went out.
 */
function resultLine(payment: Payment, emailedTo: string | null, emailProblem: string | null): string {
  const hasLink = Boolean(payment.providerLinkUrl);
  if (emailProblem) {
    return hasLink
      ? `Saved, but the email did not go: ${emailProblem}. The pay-by-card link is waiting on the Payments screen.`
      : `Saved, but the email did not go: ${emailProblem}. There is no payment link until Square is connected either.`;
  }
  if (emailedTo) {
    return hasLink
      ? `Emailed to ${emailedTo} with a pay-by-card link.`
      : `Emailed to ${emailedTo}, but there is no payment link until Square is connected - they will need to pay by card reader, cash or bank transfer.`;
  }
  return hasLink
    ? "Saved with a pay-by-card link - send it from the Payments screen when you are ready."
    : "Saved, but there is no payment link until Square is connected - take this one by card reader, cash or bank transfer.";
}

function SendBalanceSheet({ job, onClose, onDone }: { job: HubJob; onClose: () => void; onDone: () => Promise<void> }) {
  const summary = jobSummary(job);
  const [amount, setAmount] = useState((job.balancePence / 100).toFixed(2));
  const [email, setEmail] = useState(job.customerEmail ?? "");
  const [emailNow, setEmailNow] = useState(Boolean(job.customerEmail));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const pounds = useMemo(() => parsePounds(amount), [amount]);
  const valid = pounds !== null && pounds >= 1;
  const changed = valid && poundsToPence(pounds) !== job.balancePence;

  const send = async () => {
    if (pounds === null) return setError(AMOUNT_HINT);
    if (pounds < 1) return setError("Enter an amount of £1 or more");
    if (emailNow && !email.trim()) return setError("Add an email address, or untick 'email it now'");

    setBusy(true);
    setError(null);
    try {
      const { payment } = await fetchJson<{ payment: Payment }>("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "balance",
          jobId: job.reference,
          customerName: job.customerName,
          customerEmail: email.trim() || null,
          customerPhone: job.customerPhone,
          description: `Balance - ${summary}`,
          amountPence: poundsToPence(pounds),
        }),
      });

      // Everything past this point is a follow-up to a request that already exists. A thrown error here
      // would push Patrick to tap again and raise a second bill for the same car, so the failures are
      // carried into the result instead.
      let emailProblem: string | null = null;
      if (emailNow) {
        try {
          await fetchJson(`/api/payments/${payment.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "send" }),
          });
        } catch (e) {
          emailProblem = errorMessage(e, "the email did not send");
        }
      }

      let statusProblem = "";
      try {
        await fetchJson(`/api/jobs/${job.reference}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "invoiced" }),
        });
      } catch {
        statusProblem = " The job is still showing as done - tick it over by hand.";
      }

      setResult(resultLine(payment, emailNow ? email.trim() : null, emailProblem) + statusProblem);
    } catch (e) {
      // Safe to tap again: a balance for a job that already has one outstanding
      // comes back as that same request rather than a second bill, so a send that
      // died on a flaky signal cannot double-charge on the retry.
      setError(`${errorMessage(e, "Could not raise the balance")} - try again, it will not send twice.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Send balance" onClose={result ? () => void onDone() : onClose}>
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-dim">{result}</p>
          <button type="button" onClick={() => void onDone()} className="btn btn-gold w-full">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="font-display text-lg uppercase leading-tight">{job.customerName}</div>
            <p className="text-xs text-fg-muted">{summary}</p>
          </div>

          {/*
           * The terms say the final price is confirmed on the day, so the balance pulled from the hub is a
           * quote and not a bill. The amount stays editable with the quoted figure alongside it - that is why
           * sending a balance is one tap rather than none.
           */}
          <div className="grid grid-cols-2 gap-2">
            <Labelled label="Amount to send">
              <input
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="382.00"
              />
            </Labelled>
            <div>
              <span className="mb-1 block font-display text-xs uppercase tracking-wider text-fg-muted">Quoted</span>
              <div className="input flex items-center text-fg-dim">{jobMoney(job.balancePence)}</div>
            </div>
          </div>

          {changed && (
            <p className="text-xs text-warn">
              Sending {jobMoney(poundsToPence(pounds))} instead of the quoted {jobMoney(job.balancePence)}.
            </p>
          )}

          <p className="text-xs text-fg-muted">
            Deposit of {jobMoney(job.depositPence)} already paid against a total of {jobMoney(job.totalPence)}.
          </p>

          <Labelled label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Labelled>

          <label className="flex min-h-11 items-center gap-2 text-sm text-fg-dim">
            <input
              type="checkbox"
              checked={emailNow}
              onChange={(e) => setEmailNow(e.target.checked)}
              className="h-5 w-5 accent-[#f0b429]"
            />
            Email it now
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="button" onClick={send} disabled={busy} className="btn btn-gold w-full">
            {busy ? "Working..." : emailNow ? "Send balance" : "Save the balance"}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-xs uppercase tracking-wider text-fg-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.68rem] text-fg-muted">{hint}</span>}
    </label>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close" />
      <div
        className="card max-h-[88dvh] overflow-y-auto rounded-b-none border-b-0 p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">{title}</h2>
          <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
