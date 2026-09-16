"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, fetchJson } from "@/lib/client-hooks";
import { AMOUNT_HINT, parsePounds, poundsToPence } from "@/lib/money";
import {
  isOutstanding,
  isOverdue,
  money,
  moneyShort,
  PAYMENT_KINDS,
  statusLabel,
  whatsappHref,
  type Payment,
  type PaymentKind,
  type PaymentsSnapshot,
} from "@/lib/payments/types";
import { formatShortDate, londonDateKey } from "@/lib/time";

type Tab = "outstanding" | "paid";

const TONE: Record<string, string> = {
  Overdue: "text-danger",
  Waiting: "text-warn",
  "Not sent": "text-fg-muted",
  Paid: "text-ok",
  Cancelled: "text-fg-muted",
  Refunded: "text-fg-muted",
  Failed: "text-danger",
};

export function PaymentsHub() {
  const [snap, setSnap] = useState<PaymentsSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("outstanding");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      fetchJson<PaymentsSnapshot>("/api/payments")
        .then((s) => {
          setSnap(s);
          setError(null);
        })
        .catch((e: unknown) => setError(errorMessage(e, "Could not load payments"))),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const today = londonDateKey(new Date());
  const shown = useMemo(() => {
    const list = snap?.payments ?? [];
    return tab === "outstanding" ? list.filter(isOutstanding) : list.filter((p) => !isOutstanding(p));
  }, [snap, tab]);

  if (error && !snap) return <p className="card border-danger/50 p-4 text-sm text-danger">{error}</p>;
  if (!snap) return <p className="card p-6 text-center text-sm text-fg-muted">Loading payments...</p>;

  return (
    <div className="space-y-4">
      {snap.demo && <div className="pill border-gold/40 text-gold">Local preview - sample requests</div>}

      {!snap.providerReady && (
        <div className="card border-warn/50 p-3 text-sm">
          <span className="font-display uppercase text-warn">Square is not connected yet</span>
          <p className="mt-1 text-xs text-fg-dim">
            Add <code>SQUARE_ACCESS_TOKEN</code> and <code>SQUARE_LOCATION_ID</code> in Vercel and redeploy. Until then
            you can still record what is owed and mark it paid by hand - there is just no pay-by-card link.
          </p>
        </div>
      )}

      <section className="card-gold p-4 text-center">
        <div className="font-display text-4xl text-gold">{moneyShort(snap.totals.outstandingPence)}</div>
        <p className="mt-1 text-xs uppercase tracking-wider text-fg-muted">
          Outstanding
          {snap.totals.overdueCount > 0 ? ` - ${snap.totals.overdueCount} overdue` : ""}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-center">
          <div>
            <div className="font-display text-lg">{moneyShort(snap.totals.paidThisMonthPence)}</div>
            <div className="text-[0.6rem] uppercase tracking-wider text-fg-muted">Paid this month</div>
          </div>
          <div>
            <div className="font-display text-lg">{moneyShort(snap.totals.paidThisYearPence)}</div>
            <div className="text-[0.6rem] uppercase tracking-wider text-fg-muted">Paid this year</div>
          </div>
        </div>
      </section>

      <button type="button" onClick={() => setAdding(true)} className="btn btn-gold w-full">
        Request a payment
      </button>

      {error && <p className="card border-danger/50 p-3 text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        {(["outstanding", "paid"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} data-active={tab === t} className="chip flex-1 justify-center">
            {t === "outstanding" ? "Outstanding" : "Paid & done"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="card p-6 text-sm text-fg-muted">
          {tab === "outstanding" ? "Nothing outstanding - all settled up." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((p) => (
            <PaymentRow key={p.id} payment={p} today={today} onChanged={load} />
          ))}
        </ul>
      )}

      {adding && (
        <RequestSheet
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function PaymentRow({ payment, today, onChanged }: { payment: Payment; today: string; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = statusLabel(payment, today);
  const wa = whatsappHref(payment);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await onChanged();
    } catch (e) {
      setError(errorMessage(e, "That did not work"));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!payment.providerLinkUrl) return;
    try {
      await navigator.clipboard.writeText(payment.providerLinkUrl);
      setError("Link copied");
    } catch {
      setError("Could not copy - press and hold the link instead");
    }
  };

  return (
    <li className={`card overflow-hidden ${isOverdue(payment, today) ? "border-danger/50" : ""}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg uppercase leading-tight">{payment.customerName}</div>
          <div className="truncate text-xs text-fg-muted">{payment.description}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-lg text-gold">{money(payment.amountPence)}</div>
          <div className={`text-[0.62rem] uppercase tracking-wider ${TONE[label] ?? "text-fg-muted"}`}>{label}</div>
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-3 text-sm">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Reference" value={payment.reference} />
            <Field label="Due" value={payment.dueOn ? formatShortDate(`${payment.dueOn}T12:00:00Z`) : "-"} />
            <Field label="Sent" value={payment.sentAt ? formatShortDate(payment.sentAt) : "Not sent"} />
            <Field
              label={payment.status === "paid" ? "Paid" : "Type"}
              value={
                payment.status === "paid" && payment.paidAt
                  ? formatShortDate(payment.paidAt)
                  : (PAYMENT_KINDS.find((k) => k.id === payment.kind)?.label ?? payment.kind)
              }
            />
          </dl>

          {payment.emailError && <p className="text-xs text-danger">Email failed: {payment.emailError}</p>}
          {error && <p className="text-xs text-fg-dim">{error}</p>}

          {isOutstanding(payment) && (
            <div className="flex flex-wrap gap-2">
              {payment.customerEmail && (
                <button
                  type="button"
                  onClick={() => act({ action: payment.status === "sent" ? "chase" : "send" })}
                  disabled={busy}
                  className="btn btn-gold min-h-11 text-sm"
                >
                  {payment.status === "sent" ? "Send reminder" : "Email it"}
                </button>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener"
                  onClick={() => act({ action: "sent", channel: "whatsapp" })}
                  className="btn btn-ghost min-h-11 text-sm"
                >
                  WhatsApp
                </a>
              )}
              {payment.providerLinkUrl && (
                <button type="button" onClick={copyLink} className="btn btn-ghost min-h-11 text-sm">
                  Copy link
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {isOutstanding(payment) && (
              <>
                <button type="button" onClick={() => act({ action: "paid" })} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                  Mark as paid
                </button>
                <button type="button" onClick={() => act({ action: "cancel" })} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                  Cancel
                </button>
              </>
            )}
            {payment.customerPhone && (
              <a href={`tel:${payment.customerPhone}`} className="btn btn-ghost min-h-11 text-sm">
                Call
              </a>
            )}
          </div>
        </div>
      )}
    </li>
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

function RequestSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<PaymentKind>("deposit");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pounds = useMemo(() => parsePounds(amount), [amount]);

  const save = async () => {
    if (!customerName.trim()) return setError("Who is it for?");
    if (!description.trim()) return setError("What is it for?");
    if (pounds === null) return setError(AMOUNT_HINT);
    if (pounds < 1) return setError("Enter an amount of £1 or more");
    if (sendNow && !customerEmail.trim()) return setError("Add an email address, or untick 'email it now'");

    setBusy(true);
    setError(null);
    try {
      const { payment } = await fetchJson<{ payment: Payment }>("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || null,
          customerPhone: customerPhone.trim() || null,
          description: description.trim(),
          amountPence: poundsToPence(pounds),
          dueOn: dueOn || null,
        }),
      });
      if (sendNow) {
        await fetchJson(`/api/payments/${payment.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "send" }),
        });
      }
      await onSaved();
    } catch (e) {
      setError(errorMessage(e, "Could not create the request"));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70" role="dialog" aria-modal="true" aria-label="Request a payment">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close" />
      <div
        className="card max-h-[88dvh] overflow-y-auto rounded-b-none border-b-0 p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">Request a payment</h2>
          <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PAYMENT_KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)} data-active={kind === k.id} className="chip">
                {k.label}
              </button>
            ))}
          </div>

          <Labelled label="Customer name">
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </Labelled>

          <Labelled label="What it is for">
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deposit - Full Valet, black BMW"
            />
          </Labelled>

          <div className="grid grid-cols-2 gap-2">
            <Labelled label="Amount">
              <input className="input" inputMode="decimal" placeholder="35.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Labelled>
            <Labelled label="Pay by">
              <input className="input" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </Labelled>
          </div>

          <Labelled label="Email">
            <input className="input" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </Labelled>

          <Labelled label="Phone" hint="For the WhatsApp option">
            <input className="input" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </Labelled>

          <label className="flex items-center gap-2 text-sm text-fg-dim">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} className="h-5 w-5 accent-[#f0b429]" />
            Email it now
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="button" onClick={save} disabled={busy} className="btn btn-gold w-full">
            {busy ? "Working..." : sendNow ? "Create and send" : "Create request"}
          </button>
        </div>
      </div>
    </div>
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
