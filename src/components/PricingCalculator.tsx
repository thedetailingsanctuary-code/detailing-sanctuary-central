"use client";
import { useState } from "react";
import { formatGBP, type PricingData, type PricingItem, type PricingService } from "@/lib/pricing-types";
import { WEBSITE_URL } from "./QuickLinks";

function priceLabel(i: PricingItem): string {
  if (i.isQuote) return "Quote";
  if (i.pricePence == null) return "-";
  return `${i.isFrom ? "from " : ""}${formatGBP(i.pricePence)}`;
}

export function PricingCalculator({ data }: { data: PricingData }) {
  const [serviceId, setServiceId] = useState(data.services[0]?.id ?? "");
  const [tierId, setTierId] = useState<string | null>(null);
  const service = data.services.find((s) => s.id === serviceId) ?? null;
  const item = service?.items.find((i) => i.id === tierId) ?? null;

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">1. Service</h2>
        <div className="flex flex-wrap gap-2">
          {data.services.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              data-active={s.id === serviceId}
              onClick={() => {
                setServiceId(s.id);
                setTierId(null);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        {service?.note && <p className="mt-2 text-sm text-fg-muted">{service.note}</p>}
      </section>

      {service && (
        <section>
          <h2 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-fg-muted">2. Option</h2>
          <div className="grid gap-2">
            {service.items.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setTierId(i.id)}
                className={`card flex min-h-16 items-center justify-between gap-3 p-4 text-left ${
                  i.id === tierId ? "border-gold" : ""
                }`}
                aria-pressed={i.id === tierId}
              >
                <span className="font-display text-lg uppercase leading-tight">{i.tier}</span>
                <span className="shrink-0 font-display text-lg text-gold">{priceLabel(i)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {item && service && <ResultPanel item={item} service={service} />}

      <p className="text-center text-[0.65rem] uppercase tracking-wider text-fg-muted">
        Prices from {data.source === "supabase" ? "the live price list" : "the built-in price list"}
      </p>
    </div>
  );
}

function ResultPanel({ item, service }: { item: PricingItem; service: PricingService }) {
  if (item.isQuote) {
    return (
      <section className="card-gold p-5">
        <div className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">{service.name}</div>
        <div className="mt-1 font-display text-3xl uppercase">Quote per vehicle</div>
        <p className="mt-2 text-sm text-fg-dim">
          Priced after seeing the paint. Note the vehicle, condition and the customer&apos;s expectations, then follow up.
        </p>
        <a href={`${WEBSITE_URL}/paint-correction.html`} target="_blank" rel="noopener" className="btn btn-ghost mt-4 w-full">
          Open paint correction page
        </a>
      </section>
    );
  }

  const price = item.pricePence ?? 0;
  const perMonth = item.visitsPerYear ? Math.round((price * item.visitsPerYear) / 12) : null;
  const perYear = item.visitsPerYear ? price * item.visitsPerYear : null;

  return (
    <section className="card-gold p-5">
      <div className="font-display text-sm uppercase tracking-[0.2em] text-fg-muted">
        {service.name} - {item.tier}
      </div>
      <div className="mt-1 font-display text-5xl leading-none text-gold">
        {item.isFrom && <span className="mr-2 text-2xl text-fg-dim">from</span>}
        {formatGBP(price)}
      </div>
      <div className="mt-1 text-sm text-fg-dim">
        {item.unit ?? "per vehicle"}
        {item.note ? ` - ${item.note}` : ""}
      </div>
      {perMonth != null && perYear != null && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="card p-3">
            <dt className="text-[0.65rem] uppercase tracking-wider text-fg-muted">Approx. per month</dt>
            <dd className="font-display text-xl">{formatGBP(perMonth)}</dd>
          </div>
          <div className="card p-3">
            <dt className="text-[0.65rem] uppercase tracking-wider text-fg-muted">Per year ({item.visitsPerYear} visits)</dt>
            <dd className="font-display text-xl">{formatGBP(perYear)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
