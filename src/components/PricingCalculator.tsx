"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { safeParse, writeLocal } from "@/lib/client-hooks";
import {
  formatGBP,
  priceItem,
  quoteText,
  summariseQuote,
  totalLabel,
  type PlanDiscount,
  type PricingData,
  type PricingItem,
  type PricingService,
  type QuoteLine,
} from "@/lib/pricing-types";
import { INSTAGRAM_URL, WEBSITE_URL } from "./QuickLinks";

const KEY = "dsc_quote_v2";
type Saved = { sizeId: string; lines: QuoteLine[] };

function readSaved(): Saved | null {
  try {
    return safeParse<Saved>(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

const useIsClient = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export function PricingCalculator({ data }: { data: PricingData }) {
  const isClient = useIsClient();
  const [sizeId, setSizeId] = useState<string>(() => (typeof window === "undefined" ? "" : readSaved()?.sizeId) || data.meta.sizes[0]?.id || "standard");
  const [lines, setLines] = useState<QuoteLine[]>(() => (typeof window === "undefined" ? [] : (readSaved()?.lines ?? [])));
  const [openService, setOpenService] = useState<string | null>(data.services[0]?.id ?? null);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    writeLocal(KEY, { sizeId, lines } satisfies Saved);
  }, [sizeId, lines]);

  const quote = useMemo(() => summariseQuote(lines, data, sizeId), [lines, data, sizeId]);
  const selected = useMemo(() => new Map(lines.map((l) => [l.itemId, l])), [lines]);

  function isPlan(itemId: string) {
    return data.services.some((s) => s.kind === "plan" && s.items.some((i) => i.id === itemId));
  }
  function toggle(item: PricingItem) {
    setLines((prev) => {
      if (prev.some((l) => l.itemId === item.id)) return prev.filter((l) => l.itemId !== item.id);
      const discountId = item.kind === "plan" ? (data.meta.planDiscounts[0]?.id ?? null) : null;
      // Only one plan at a time.
      const base = item.kind === "plan" ? prev.filter((l) => !isPlan(l.itemId)) : prev;
      return [...base, { itemId: item.id, quantity: 1, discountId }];
    });
  }
  function setQty(itemId: string, quantity: number) {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity: Math.min(20, Math.max(1, quantity)) } : l)));
  }
  function setDiscount(itemId: string, discountId: string) {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, discountId } : l)));
  }
  function clear() {
    setLines([]);
    setSheet(false);
  }

  async function share() {
    const text = quoteText(quote, data.meta, { website: WEBSITE_URL, instagram: INSTAGRAM_URL });
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Detailing Sanctuary quote", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setToast("Quote copied. Paste it into a message.");
    } catch {
      setToast("Could not share on this device.");
    }
    setTimeout(() => setToast(null), 2500);
  }

  if (!isClient) {
    return <p className="card p-6 text-center text-sm text-fg-muted">Loading price list...</p>;
  }

  const count = lines.length;
  const total = totalLabel(quote);

  return (
    <div className="space-y-5 pb-24">
      <section>
        <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Vehicle size</h2>
        <div className="flex flex-wrap gap-2">
          {data.meta.sizes.map((s) => (
            <button key={s.id} type="button" className="chip" data-active={s.id === sizeId} onClick={() => setSizeId(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-muted">Each size step adds {data.meta.sizeStepPercent}% to valeting, coatings and add-ons, rounded up.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Tap to add to the quote</h2>
        {data.services.map((service) => (
          <ServiceGroup
            key={service.id}
            service={service}
            open={openService === service.id}
            onToggleOpen={() => setOpenService((o) => (o === service.id ? null : service.id))}
            selected={selected}
            data={data}
            sizeId={sizeId}
            onToggleItem={toggle}
            onQty={setQty}
            onDiscount={setDiscount}
          />
        ))}
      </section>

      <p className="text-center text-[0.65rem] uppercase tracking-wider text-fg-muted">
        Prices from {data.source === "supabase" ? "the live price list" : "the built-in price list"}
      </p>

      {/* Sticky quote bar */}
      <div className="fixed inset-x-0 z-20" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}>
        <div className="mx-auto max-w-lg px-4">
          <button
            type="button"
            onClick={() => count > 0 && setSheet(true)}
            className="card-gold flex w-full items-center justify-between gap-3 p-3 text-left"
            aria-expanded={sheet}
          >
            <span>
              <span className="block font-display text-sm uppercase tracking-[0.2em] text-fg-muted">
                Quote {count > 0 ? `(${count} item${count === 1 ? "" : "s"})` : ""}
              </span>
              <span className="block font-display text-2xl leading-none text-gold">
                {count === 0 ? "Nothing added yet" : total || (quote.plans.length ? "Plan selected" : "")}
              </span>
            </span>
            {count > 0 && <span className="btn btn-gold min-h-11 px-4 text-sm">View</span>}
          </button>
        </div>
      </div>

      {sheet && (
        <QuoteSheet
          quote={quote}
          data={data}
          onClose={() => setSheet(false)}
          onRemove={(id) => setLines((prev) => prev.filter((l) => l.itemId !== id))}
          onClear={clear}
          onShare={share}
          toast={toast}
        />
      )}
    </div>
  );
}

function ServiceGroup({
  service,
  open,
  onToggleOpen,
  selected,
  data,
  sizeId,
  onToggleItem,
  onQty,
  onDiscount,
}: {
  service: PricingService;
  open: boolean;
  onToggleOpen: () => void;
  selected: Map<string, QuoteLine>;
  data: PricingData;
  sizeId: string;
  onToggleItem: (item: PricingItem) => void;
  onQty: (id: string, qty: number) => void;
  onDiscount: (id: string, discountId: string) => void;
}) {
  const size = data.meta.sizes.find((s) => s.id === sizeId) ?? data.meta.sizes[0];
  const picked = service.items.filter((i) => selected.has(i.id)).length;
  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={onToggleOpen} className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open}>
        <span>
          <span className="block font-display text-lg uppercase leading-tight">{service.name}</span>
          {service.note && open && <span className="mt-1 block text-xs text-fg-muted">{service.note}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {picked > 0 && <span className="pill border-gold/60 text-gold">{picked} added</span>}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-fg-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <ul className="border-t border-line">
          {service.items.map((item) => {
            const line = selected.get(item.id) ?? null;
            const discount: PlanDiscount | null =
              item.kind === "plan" ? (data.meta.planDiscounts.find((d) => d.id === line?.discountId) ?? data.meta.planDiscounts[0] ?? null) : null;
            const priced = priceItem(item, data.meta, size, line?.quantity ?? 1, discount);
            const on = Boolean(line);
            return (
              <li key={item.id} className={`border-b border-line last:border-b-0 ${on ? "bg-surface-2" : ""}`}>
                <button type="button" onClick={() => onToggleItem(item)} className="flex w-full items-center gap-3 p-3 text-left" aria-pressed={on}>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${on ? "border-gold bg-gold text-ink" : "border-line-strong text-transparent"}`}
                    aria-hidden
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base uppercase leading-tight">
                      {item.isAddon ? "+ " : ""}
                      {item.tier}
                    </span>
                    {item.detail && <span className="block text-xs text-fg-muted">{item.detail}</span>}
                    {item.note && <span className="block text-xs text-fg-muted">{item.note}</span>}
                  </span>
                  <span className="shrink-0 text-right font-display text-base text-gold">
                    {priced.label}
                    {item.unit && <span className="block text-[0.65rem] uppercase tracking-wider text-fg-muted">{item.unit}</span>}
                  </span>
                </button>

                {on && item.quantityLabel && (
                  <div className="flex items-center justify-between gap-3 px-3 pb-3 pl-12">
                    <span className="text-sm text-fg-dim">How many {item.quantityLabel}?</span>
                    <span className="flex items-center gap-2">
                      <button type="button" className="btn btn-ghost min-h-10 w-11 px-0" onClick={() => onQty(item.id, (line?.quantity ?? 1) - 1)} aria-label="Fewer">
                        -
                      </button>
                      <span className="w-6 text-center font-display text-lg">{line?.quantity ?? 1}</span>
                      <button type="button" className="btn btn-ghost min-h-10 w-11 px-0" onClick={() => onQty(item.id, (line?.quantity ?? 1) + 1)} aria-label="More">
                        +
                      </button>
                    </span>
                  </div>
                )}

                {on && item.kind === "plan" && (
                  <div className="space-y-2 px-3 pb-3 pl-12">
                    <div className="flex flex-wrap gap-2">
                      {data.meta.planDiscounts.map((d) => (
                        <button key={d.id} type="button" className="chip min-h-9 text-xs" data-active={d.id === discount?.id} onClick={() => onDiscount(item.id, d.id)}>
                          {d.name}
                          {d.percent ? ` -${d.percent}%` : ""}
                        </button>
                      ))}
                    </div>
                    {priced.termPence != null && (
                      <p className="text-xs text-fg-dim">
                        {formatGBP(priced.minPence ?? 0)} per visit, {formatGBP(priced.termPence)} per {data.meta.termLabel} ({item.visitsPerTerm} visits).
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuoteSheet({
  quote,
  data,
  onClose,
  onRemove,
  onClear,
  onShare,
  toast,
}: {
  quote: ReturnType<typeof summariseQuote>;
  data: PricingData;
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onShare: () => void;
  toast: string | null;
}) {
  const total = totalLabel(quote);
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70" role="dialog" aria-modal="true" aria-label="Quote">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close" />
      <div className="card max-h-[85dvh] overflow-y-auto rounded-b-none border-b-0 p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">Quote</h2>
          <span className="pill">{quote.size.name}</span>
        </div>

        {quote.oneOff.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {quote.oneOff.map((l) => (
              <li key={l.item.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display uppercase">
                    {l.item.tier}
                    {l.item.quantityLabel && l.quantity > 1 ? ` x${l.quantity}` : ""}
                  </span>
                </span>
                <span className="font-display text-gold">{l.label}</span>
                <button type="button" onClick={() => onRemove(l.item.id)} className="btn btn-ghost min-h-9 px-2 text-xs" aria-label={`Remove ${l.item.tier}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {quote.oneOff.length > 0 && (
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <span className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Total</span>
            <span className="font-display text-3xl leading-none text-gold">{total}</span>
          </div>
        )}

        {quote.plans.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <h3 className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">Ongoing plan</h3>
            {quote.plans.map((l) => (
              <div key={l.item.id} className="mt-1 flex items-start gap-3">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-display uppercase">{l.item.tier}</span>
                  <span className="text-fg-dim">
                    {l.discount?.name}: {l.minPence != null ? formatGBP(l.minPence) : "-"} per visit
                    {l.termPence != null ? `, ${formatGBP(l.termPence)} per ${data.meta.termLabel}` : ""}
                  </span>
                </span>
                <button type="button" onClick={() => onRemove(l.item.id)} className="btn btn-ghost min-h-9 px-2 text-xs">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {quote.depositPence > 0 && (
          <p className="mt-3 text-xs text-fg-muted">
            {data.meta.deposit.percent}% deposit to book: {formatGBP(quote.depositPence)} (comes off the final bill).
            {quote.hasFrom ? " Starting prices; condition can move them." : ""}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-gold" onClick={onShare}>
            Share quote
          </button>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="btn btn-ghost">
            <InstagramIcon /> Instagram
          </a>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Keep adding
          </button>
          <button type="button" className="btn btn-ghost text-danger" onClick={onClear}>
            Clear
          </button>
        </div>
        {toast && <p className="mt-3 text-center text-sm text-fg-dim">{toast}</p>}
      </div>
    </div>
  );
}

export function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
