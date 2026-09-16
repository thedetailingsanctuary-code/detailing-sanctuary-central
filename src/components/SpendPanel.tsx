"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, fetchJson } from "@/lib/client-hooks";
import { AMOUNT_HINT, parsePounds, poundsToPence } from "@/lib/money";
import { poundsLabel, poundsShort, type Purchase, type SpendSnapshot } from "@/lib/spend/types";
import { formatMonthLabel, formatShortDate } from "@/lib/time";

type ScanResult = { ran: boolean; reason?: string; scanned: number; added: number; needsFigure: number; errors: string[] };

export function SpendPanel() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [snap, setSnap] = useState<SpendSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    (y: number) =>
      fetchJson<SpendSnapshot>(`/api/spend?year=${y}`)
        .then((s) => {
          setSnap(s);
          setError(null);
        })
        .catch((e: unknown) => setError(errorMessage(e, "Could not load spend"))),
    [],
  );

  useEffect(() => {
    load(year);
  }, [load, year]);

  const scan = useCallback(async () => {
    setScanning(true);
    setScanNote(null);
    try {
      const r = await fetchJson<ScanResult>("/api/spend?scan=1", { method: "POST" });
      setScanNote(
        !r.ran
          ? "Could not read the mailbox yet."
          : r.added === 0
            ? `Looked at ${r.scanned} emails - nothing new.`
            : `Added ${r.added} order${r.added === 1 ? "" : "s"}${r.needsFigure ? `, ${r.needsFigure} needing a figure` : ""}.`,
      );
      await load(year);
    } catch (e) {
      setError(errorMessage(e, "Could not read your emails"));
    } finally {
      setScanning(false);
    }
  }, [load, year]);

  if (error && !snap) return <p className="card border-danger/50 p-4 text-sm text-danger">{error}</p>;
  if (!snap) return <p className="card p-6 text-center text-sm text-fg-muted">Loading spend...</p>;

  const peak = Math.max(1, ...snap.byMonth.map((m) => m.totalPence));

  return (
    <div className="space-y-4">
      {snap.demo && <div className="pill border-gold/40 text-gold">Local preview - sample orders</div>}

      <section className="card-gold p-4 text-center">
        <div className="font-display text-4xl text-gold">{poundsShort(snap.yearTotalPence)}</div>
        <p className="mt-1 text-xs uppercase tracking-wider text-fg-muted">Spent on products in {snap.year}</p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" onClick={() => setYear(year - 1)} className="btn btn-ghost min-h-10 px-3 text-xs">
            {year - 1}
          </button>
          {year !== thisYear && (
            <button type="button" onClick={() => setYear(thisYear)} className="btn btn-ghost min-h-10 px-3 text-xs">
              {thisYear}
            </button>
          )}
        </div>
      </section>

      <div className="flex gap-2">
        <button type="button" onClick={scan} disabled={scanning} className="btn btn-gold flex-1">
          {scanning ? "Reading emails..." : "Check emails"}
        </button>
        <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost px-4">
          Add
        </button>
      </div>

      {scanNote && <p className="card p-3 text-xs text-fg-dim">{scanNote}</p>}
      {error && <p className="card border-danger/50 p-3 text-sm text-danger">{error}</p>}

      {snap.pending.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-warn">
            Needs a figure ({snap.pending.length})
          </h2>
          <ul className="space-y-2">
            {snap.pending.map((p) => (
              <PendingRow key={p.id} purchase={p} onDone={() => load(year)} />
            ))}
          </ul>
        </section>
      )}

      {snap.byMonth.length > 0 && (
        <section className="card p-3">
          <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">By month</h2>
          <ul className="space-y-1.5">
            {snap.byMonth.map((m) => (
              <li key={m.monthKey} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-fg-muted">{formatMonthLabel(m.monthKey).split(" ")[0]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${(m.totalPence / peak) * 100}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-fg-dim">{poundsShort(m.totalPence)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snap.bySupplier.length > 0 && (
        <section className="card p-3">
          <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">By supplier</h2>
          <ul className="space-y-1">
            {snap.bySupplier.map((s) => (
              <li key={s.supplier} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-fg-dim">{s.supplier}</span>
                <span className="shrink-0 font-display text-gold">{poundsShort(s.totalPence)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">
          Orders ({snap.purchases.length})
        </h2>
        {snap.purchases.length === 0 ? (
          <p className="card p-4 text-sm text-fg-muted">
            Nothing recorded for {snap.year} yet. Tap &ldquo;Check emails&rdquo; and the app will look through your
            supplier orders in Outlook.
          </p>
        ) : (
          <ul className="space-y-2">
            {snap.purchases.map((p) => (
              <PurchaseRow key={p.id} purchase={p} onDone={() => load(year)} />
            ))}
          </ul>
        )}
      </section>

      {adding && <AddSheet suppliers={snap.settings.suppliers.map((s) => s.name)} onClose={() => setAdding(false)} onSaved={async () => {
        setAdding(false);
        await load(year);
      }} />}
    </div>
  );
}

function PendingRow({ purchase, onDone }: { purchase: Purchase; onDone: () => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (status: "confirmed" | "dismissed") => {
    const pounds = parsePounds(value);
    if (status === "confirmed" && pounds === null) return;
    const body = status === "confirmed" ? { totalPence: poundsToPence(pounds ?? 0), status } : { status };
    setBusy(true);
    try {
      await fetchJson(`/api/spend/${purchase.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card border-warn/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-sm uppercase">{purchase.supplier}</span>
        <span className="shrink-0 text-xs text-fg-muted">{formatShortDate(`${purchase.purchasedOn}T12:00:00Z`)}</span>
      </div>
      {purchase.subject && <p className="mt-0.5 truncate text-xs text-fg-muted">{purchase.subject}</p>}
      <div className="mt-2 flex gap-2">
        <input
          className="input"
          inputMode="decimal"
          placeholder="Total, e.g. 84.50"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" onClick={() => save("confirmed")} disabled={busy} className="btn btn-gold px-4 text-sm">
          Save
        </button>
        <button type="button" onClick={() => save("dismissed")} disabled={busy} className="btn btn-ghost px-3 text-sm">
          Not an order
        </button>
      </div>
    </li>
  );
}

function PurchaseRow({ purchase, onDone }: { purchase: Purchase; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await fetchJson(`/api/spend/${purchase.id}`, { method: "DELETE" });
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base uppercase leading-tight">{purchase.supplier}</div>
          <div className="truncate text-xs text-fg-muted">
            {formatShortDate(`${purchase.purchasedOn}T12:00:00Z`)}
            {purchase.orderRef ? ` - ${purchase.orderRef}` : ""}
            {purchase.source === "manual" ? " - added by hand" : ""}
          </div>
        </div>
        <span className="shrink-0 font-display text-lg text-gold">{poundsLabel(purchase.totalPence)}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-line p-3 text-xs">
          {purchase.subject && <p className="text-fg-dim">{purchase.subject}</p>}
          <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost min-h-10 px-3 text-xs">
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

function AddSheet({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [supplier, setSupplier] = useState(suppliers[0] ?? "");
  const [total, setTotal] = useState("");
  const [purchasedOn, setPurchasedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pounds = useMemo(() => parsePounds(total), [total]);

  const save = async () => {
    if (!supplier.trim()) return setError("Which supplier?");
    if (pounds === null) return setError(AMOUNT_HINT);
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/spend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplier: supplier.trim(),
          totalPence: poundsToPence(pounds),
          purchasedOn,
          note: note.trim() || null,
        }),
      });
      await onSaved();
    } catch (e) {
      setError(errorMessage(e, "Could not save"));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70" role="dialog" aria-modal="true" aria-label="Add a purchase">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close" />
      <div
        className="card max-h-[88dvh] overflow-y-auto rounded-b-none border-b-0 p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">Add a purchase</h2>
          <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block font-display text-xs uppercase tracking-wider text-fg-muted">Supplier</span>
            <input className="input" list="dsc-suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <datalist id="dsc-suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block font-display text-xs uppercase tracking-wider text-fg-muted">Total</span>
              <input className="input" inputMode="decimal" placeholder="84.50" value={total} onChange={(e) => setTotal(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block font-display text-xs uppercase tracking-wider text-fg-muted">Date</span>
              <input className="input" type="date" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block font-display text-xs uppercase tracking-wider text-fg-muted">Note</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="button" onClick={save} disabled={busy} className="btn btn-gold w-full">
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
