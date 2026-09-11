"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, fetchJson } from "@/lib/client-hooks";
import { STOCK_SERVICES, stockServiceName } from "@/lib/stock/services";
import { isLow, STOCK_CATEGORIES, type StockAlias, type StockCategory, type StockEvent, type StockItem, type StockSnapshot } from "@/lib/stock/types";
import { formatShortDate, formatTime } from "@/lib/time";

type Tab = "levels" | "usage" | "rules";

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function barColour(item: StockItem): string {
  if (isLow(item)) return "bg-danger";
  if (item.levelPercent <= Math.max(item.minPercent * 2.5, 25)) return "bg-warn";
  return "bg-ok";
}

export function StockPanel() {
  const [snap, setSnap] = useState<StockSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("levels");
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      fetchJson<StockSnapshot>("/api/stock")
        .then((s) => {
          setSnap(s);
          setError(null);
        })
        .catch((e: unknown) => setError(errorMessage(e, "Could not load stock"))),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (error && !snap) return <p className="card border-danger/50 p-4 text-sm text-danger">{error}</p>;
  if (!snap) return <p className="card p-6 text-center text-sm text-fg-muted">Loading stock...</p>;

  if (snap.demo) {
    return (
      <p className="card p-6 text-sm text-fg-muted">
        Stock tracking needs the database. On the live app this shows your chemicals with a percentage left in each bottle.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {snap.low.length > 0 && (
        <div className="card border-danger/60 p-3 text-sm">
          <span className="font-display uppercase text-danger">Running low</span>
          <ul className="mt-1 space-y-0.5 text-fg-dim">
            {snap.low.map((i) => (
              <li key={i.id}>
                {i.name} {i.sizeLabel ? `(${i.sizeLabel})` : ""}: {pct(i.levelPercent)}
                {i.supplierUrl && (
                  <>
                    {" "}
                    <a href={i.supplierUrl} target="_blank" rel="noopener" className="text-gold underline">
                      reorder
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {snap.unmatched.length > 0 && tab === "levels" && <UnmatchedJobs events={snap.unmatched} onDone={load} />}

      <div className="flex gap-2">
        {(
          [
            ["levels", "Levels"],
            ["usage", "Per job"],
            ["rules", "Rules"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" className="chip" data-active={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        {tab === "levels" && (
          <button type="button" className="btn btn-gold ml-auto min-h-11 px-4 text-sm" onClick={() => setAdding(true)}>
            + Add
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {tab === "levels" && <Levels items={snap.items} onOpen={setEditing} events={snap.events} />}
      {tab === "usage" && <Usage snap={snap} onChanged={load} />}
      {tab === "rules" && <Rules snap={snap} onChanged={load} />}

      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onChanged={load} />}
      {adding && <AddSheet onClose={() => setAdding(false)} onChanged={load} />}
    </div>
  );
}

function Levels({ items, onOpen, events }: { items: StockItem[]; onOpen: (i: StockItem) => void; events: StockEvent[] }) {
  const groups = useMemo(() => {
    const map = new Map<StockCategory, StockItem[]>();
    for (const it of items) map.set(it.category, [...(map.get(it.category) ?? []), it]);
    return STOCK_CATEGORIES.filter((c) => map.has(c.id)).map((c) => ({ ...c, items: map.get(c.id)! }));
  }, [items]);

  return (
    <div className="space-y-4">
      {items.length === 0 && <p className="card p-6 text-center text-sm text-fg-muted">No products yet. Tap Add.</p>}
      {groups.map((g) => (
        <section key={g.id}>
          <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">{g.name}</h2>
          <ul className="space-y-2">
            {g.items.map((it) => (
              <li key={it.id}>
                <button type="button" onClick={() => onOpen(it)} className="card block w-full p-3 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-display uppercase leading-tight">{it.name}</span>
                      <span className="block text-xs text-fg-muted">
                        {[it.brand, it.sizeLabel].filter(Boolean).join(" - ")}
                      </span>
                    </span>
                    <span className={`shrink-0 font-display text-xl ${isLow(it) ? "text-danger" : "text-gold"}`}>{pct(it.levelPercent)}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-3">
                    <div className={`h-full rounded-full ${barColour(it)}`} style={{ width: `${Math.max(2, it.levelPercent)}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {events.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Recent activity</h2>
          <ul className="card divide-y divide-line text-xs">
            {events.slice(0, 15).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 p-2">
                <span className="min-w-0 text-fg-dim">
                  <span className="block truncate">
                    {e.kind === "skipped"
                      ? `Skipped: ${e.jobTitle}`
                      : `${e.itemName ?? "Item"}${e.kind === "job" ? ` - ${e.jobTitle ?? stockServiceName(e.serviceKey ?? "")}` : e.kind === "restock" ? " - restocked" : " - adjusted"}`}
                  </span>
                  <span className="text-fg-muted">
                    {formatShortDate(e.createdAt)} {formatTime(e.createdAt)}
                  </span>
                </span>
                <span className={`shrink-0 font-display ${e.deltaPercent < 0 ? "text-warn" : e.deltaPercent > 0 ? "text-ok" : "text-fg-muted"}`}>
                  {e.deltaPercent > 0 ? "+" : ""}
                  {e.deltaPercent}%{e.levelAfter != null ? ` (${Math.round(e.levelAfter)}%)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ItemSheet({ item, onClose, onChanged }: { item: StockItem; onClose: () => void; onChanged: () => Promise<void> }) {
  const [level, setLevel] = useState(Math.round(item.levelPercent));
  const [min, setMin] = useState(item.minPercent);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>, done?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fetchJson(`/api/stock/items/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await onChanged();
      if (done) setMsg(done);
    } catch (e) {
      setMsg(errorMessage(e, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={item.name} onClose={onClose}>
      <p className="text-xs text-fg-muted">
        {[item.brand, item.sizeLabel, item.supplier].filter(Boolean).join(" - ")}
        {item.lastPurchasedOn ? ` - last bought ${formatShortDate(item.lastPurchasedOn)}` : ""}
        {item.lastCostPence != null ? ` at £${(item.lastCostPence / 100).toFixed(2)}` : ""}
      </p>

      <div className="mt-4">
        <div className="flex items-end justify-between">
          <span className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Left in bottle</span>
          <span className="font-display text-4xl text-gold">{level}%</span>
        </div>
        <input type="range" min={0} max={100} step={1} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-2 w-full accent-[#f0b429]" />
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => setLevel((l) => Math.max(0, l - 10))}>
            -10
          </button>
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => setLevel((l) => Math.max(0, l - 5))}>
            -5
          </button>
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => setLevel((l) => Math.min(100, l + 5))}>
            +5
          </button>
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => setLevel((l) => Math.min(100, l + 10))}>
            +10
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-gold" disabled={busy || level === Math.round(item.levelPercent)} onClick={() => void patch({ level: { kind: "adjust", toPercent: level } }, "Level saved")}>
            Save level
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void patch({ level: { kind: "restock", toPercent: 100 }, lastPurchasedOn: new Date().toISOString().slice(0, 10) }, "New bottle logged")}>
            New bottle (100%)
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="text-sm text-fg-dim" htmlFor="min">
          Warn me at
        </label>
        <span className="flex items-center gap-2">
          <input id="min" type="number" min={1} max={90} value={min} onChange={(e) => setMin(Number(e.target.value))} className="input w-20 text-center" />
          <span className="text-sm text-fg-muted">%</span>
          <button type="button" className="btn btn-ghost min-h-10 px-3 text-xs" disabled={busy || min === item.minPercent} onClick={() => void patch({ minPercent: min }, "Saved")}>
            Save
          </button>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {item.supplierUrl && (
          <a href={item.supplierUrl} target="_blank" rel="noopener" className="btn btn-ghost">
            Reorder
          </a>
        )}
        <button
          type="button"
          className="btn btn-ghost text-danger"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Remove ${item.name} from the stock list?`)) return;
            setBusy(true);
            try {
              await fetchJson(`/api/stock/items/${item.id}`, { method: "DELETE" });
              await onChanged();
              onClose();
            } catch (e) {
              setMsg(errorMessage(e));
              setBusy(false);
            }
          }}
        >
          Remove
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-fg-dim">{msg}</p>}
    </Sheet>
  );
}

function AddSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<StockCategory>("other");
  const [size, setSize] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Sheet title="Add product" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          try {
            await fetchJson("/api/stock/items", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name, brand: brand || null, category, sizeLabel: size || null, supplierUrl: supplierUrl || null, levelPercent: 100 }),
            });
            await onChanged();
            onClose();
          } catch (err) {
            setMsg(errorMessage(err, "Could not add"));
            setBusy(false);
          }
        }}
      >
        <input className="input" placeholder="Product name *" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as StockCategory)}>
            {STOCK_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Size (5L, 500ml)" value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <input className="input" placeholder="Reorder link (optional)" inputMode="url" value={supplierUrl} onChange={(e) => setSupplierUrl(e.target.value)} />
        {msg && <p className="text-sm text-danger">{msg}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="submit" className="btn btn-gold" disabled={busy || !name.trim()}>
            Add at 100%
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function Usage({ snap, onChanged }: { snap: StockSnapshot; onChanged: () => Promise<void> }) {
  const [serviceKey, setServiceKey] = useState(STOCK_SERVICES[1].key);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const service = STOCK_SERVICES.find((s) => s.key === serviceKey)!;
  const current = useMemo(() => new Map(snap.usage.filter((u) => u.serviceKey === serviceKey).map((u) => [u.itemId, u.percentPerJob])), [snap.usage, serviceKey]);

  async function save(itemId: string, value: string) {
    const pctValue = Number(value);
    if (!Number.isFinite(pctValue)) return;
    if (pctValue === (current.get(itemId) ?? 0)) return;
    setSaving(itemId);
    try {
      await fetchJson("/api/stock/usage", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceKey, itemId, percentPerJob: pctValue }) });
      await onChanged();
    } finally {
      setSaving(null);
    }
  }

  const mlHint = (item: StockItem, p: number) => {
    const m = item.sizeLabel?.match(/([\d.]+)\s*(l|ml)/i);
    if (!m || !p) return "";
    const ml = m[2].toLowerCase() === "l" ? Number(m[1]) * 1000 : Number(m[1]);
    return ` = ${Math.round((ml * p) / 100)} ml`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STOCK_SERVICES.map((s) => (
          <button key={s.key} type="button" className="chip min-h-10 text-xs" data-active={s.key === serviceKey} onClick={() => setServiceKey(s.key)}>
            {s.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        {service.hint}. Enter the percentage of a bottle one {service.name.toLowerCase()} uses. 0 means not used.
      </p>
      <ul className="card divide-y divide-line">
        {snap.items.map((it) => {
          const val = drafts[`${serviceKey}:${it.id}`] ?? String(current.get(it.id) ?? 0);
          return (
            <li key={it.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm">{it.name}</span>
                <span className="block text-xs text-fg-muted">
                  {it.sizeLabel ?? ""}
                  {mlHint(it, Number(val))}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => setDrafts((d) => ({ ...d, [`${serviceKey}:${it.id}`]: e.target.value }))}
                  onBlur={(e) => void save(it.id, e.target.value)}
                  className={`input w-20 text-center ${saving === it.id ? "opacity-50" : ""}`}
                />
                <span className="text-sm text-fg-muted">%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Rules({ snap, onChanged }: { snap: StockSnapshot; onChanged: () => Promise<void> }) {
  const [aliases, setAliases] = useState<StockAlias[]>(snap.settings.aliases);
  const [autoDeduct, setAutoDeduct] = useState(snap.settings.autoDeduct);
  const [days, setDays] = useState(snap.settings.alertRepeatDays);
  const [newMatch, setNewMatch] = useState("");
  const [newKey, setNewKey] = useState(STOCK_SERVICES[1].key);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: Partial<{ aliases: StockAlias[]; autoDeduct: boolean; alertRepeatDays: number }>) {
    setBusy(true);
    setMsg(null);
    try {
      await fetchJson("/api/stock/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      await onChanged();
      setMsg("Saved");
    } catch (e) {
      setMsg(errorMessage(e, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Take stock off automatically when a calendar job finishes</span>
          <input
            type="checkbox"
            checked={autoDeduct}
            onChange={(e) => {
              setAutoDeduct(e.target.checked);
              void save({ autoDeduct: e.target.checked });
            }}
            className="h-6 w-6 accent-[#f0b429]"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Remind me again about a low item after</span>
          <span className="flex items-center gap-2">
            <input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} onBlur={() => void save({ alertRepeatDays: days })} className="input w-20 text-center" />
            <span className="text-fg-muted">days</span>
          </span>
        </label>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Job name matching</h2>
        <p className="text-xs text-fg-muted">If a calendar job title contains the words on the left, it counts as the job type on the right. Longest match wins.</p>
        <ul className="divide-y divide-line">
          {aliases.map((a, idx) => (
            <li key={`${a.match}-${idx}`} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">&ldquo;{a.match}&rdquo;</span>
              <span className="text-fg-muted">&rarr;</span>
              <span className="truncate">{stockServiceName(a.serviceKey)}</span>
              <button
                type="button"
                className="btn btn-ghost min-h-9 px-2 text-xs"
                onClick={() => {
                  const next = aliases.filter((_, i) => i !== idx);
                  setAliases(next);
                  void save({ aliases: next });
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input className="input" placeholder="words in the job title" value={newMatch} onChange={(e) => setNewMatch(e.target.value)} />
          <select className="input" value={newKey} onChange={(e) => setNewKey(e.target.value)}>
            {STOCK_SERVICES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-gold w-full"
          disabled={busy || !newMatch.trim()}
          onClick={() => {
            const next = [...aliases, { match: newMatch.trim().toLowerCase(), serviceKey: newKey }];
            setAliases(next);
            setNewMatch("");
            void save({ aliases: next });
          }}
        >
          Add rule
        </button>
        {msg && <p className="text-sm text-fg-dim">{msg}</p>}
      </section>
    </div>
  );
}

function UnmatchedJobs({ events, onDone }: { events: StockEvent[]; onDone: () => Promise<void> }) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="card border-warn/50 p-3 text-sm">
      <span className="font-display uppercase text-warn">Jobs that need a job type</span>
      <ul className="mt-2 space-y-2">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{e.jobTitle}</span>
            <select className="input w-40" value={choice[e.id] ?? "valeting-full"} onChange={(ev) => setChoice((c) => ({ ...c, [e.id]: ev.target.value }))}>
              {STOCK_SERVICES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-gold min-h-10 px-3 text-xs"
              disabled={busy === String(e.id)}
              onClick={async () => {
                setBusy(String(e.id));
                try {
                  const key = choice[e.id] ?? "valeting-full";
                  await fetchJson("/api/stock/consume", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ jobId: e.jobId, title: e.jobTitle, serviceKey: key }),
                  });
                  // Remember the choice for next time.
                  const snap = await fetchJson<StockSnapshot>("/api/stock");
                  const words = (e.jobTitle ?? "").toLowerCase().trim();
                  if (words && !snap.settings.aliases.some((a) => a.match === words)) {
                    await fetchJson("/api/stock/settings", {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ aliases: [...snap.settings.aliases, { match: words, serviceKey: key }] }),
                    });
                  }
                  await onDone();
                } finally {
                  setBusy(null);
                }
              }}
            >
              Apply
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close" />
      <div className="card max-h-[88dvh] overflow-y-auto rounded-b-none border-b-0 p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
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
