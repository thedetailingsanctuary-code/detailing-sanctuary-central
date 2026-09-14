"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, fetchJson } from "@/lib/client-hooks";
import {
  CADENCES,
  cadenceFromPlanItemId,
  cadenceLabel,
  stateLabel,
  type Cadence,
  type PlanStatus,
  type PlansSnapshot,
  type PlanWithState,
} from "@/lib/plans/types";
import type { PricingData, PricingItem } from "@/lib/pricing-types";
import { formatDayLabel, londonDateKey } from "@/lib/time";
import { mapsUrl } from "./JobCard";

const money = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

const TONE: Record<PlanWithState["state"], { text: string; border: string; dot: string }> = {
  overdue: { text: "text-danger", border: "border-danger/60", dot: "bg-danger" },
  due: { text: "text-gold", border: "border-gold/60", dot: "bg-gold" },
  soon: { text: "text-warn", border: "border-warn/50", dot: "bg-warn" },
  ok: { text: "text-fg-dim", border: "border-line", dot: "bg-ok" },
  paused: { text: "text-fg-muted", border: "border-line", dot: "bg-fg-muted" },
  ended: { text: "text-fg-muted", border: "border-line", dot: "bg-fg-muted" },
};

export function PlansPanel() {
  const [snap, setSnap] = useState<PlansSnapshot | null>(null);
  const [plans, setPlans] = useState<PricingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PlanWithState | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      fetchJson<PlansSnapshot>("/api/plans")
        .then((s) => {
          setSnap(s);
          setError(null);
        })
        .catch((e: unknown) => setError(errorMessage(e, "Could not load plans"))),
    [],
  );

  useEffect(() => {
    load();
    fetchJson<PricingData>("/api/pricing")
      .then((p) => setPlans(p.services.filter((s) => s.kind === "plan").flatMap((s) => s.items)))
      .catch(() => setPlans([]));
  }, [load]);

  const resync = useCallback(async () => {
    setBusy(true);
    try {
      await fetchJson("/api/plans/visits?sync=1", { method: "POST" });
      await load();
    } catch (e) {
      setError(errorMessage(e, "Could not check the calendar"));
    } finally {
      setBusy(false);
    }
  }, [load]);

  if (error && !snap) return <p className="card border-danger/50 p-4 text-sm text-danger">{error}</p>;
  if (!snap) return <p className="card p-6 text-center text-sm text-fg-muted">Loading plans...</p>;

  const { counts } = snap;

  return (
    <div className="space-y-4">
      {snap.demo && <div className="pill border-gold/40 text-gold">Local preview - sample customers</div>}

      <section className="card grid grid-cols-3 divide-x divide-line p-0 text-center">
        <Stat label="On plan" value={counts.active} />
        <Stat label="Due soon" value={counts.dueSoon} tone={counts.dueSoon ? "text-warn" : undefined} />
        <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? "text-danger" : undefined} />
      </section>

      <div className="flex gap-2">
        <button type="button" onClick={() => setAdding(true)} className="btn btn-gold flex-1">
          Add customer
        </button>
        <button type="button" onClick={resync} className="btn btn-ghost px-4" disabled={busy}>
          {busy ? "Checking..." : "Re-check"}
        </button>
      </div>

      {error && <p className="card border-danger/50 p-3 text-sm text-danger">{error}</p>}

      {snap.plans.length === 0 ? (
        <p className="card p-6 text-sm text-fg-muted">
          Nobody on a plan yet. Add a customer and the app will tick their visits off as they appear in your calendar.
        </p>
      ) : (
        <ul className="space-y-2">
          {snap.plans.map((p) => (
            <PlanCard key={p.id} plan={p} onChanged={load} onEdit={() => setEditing(p)} />
          ))}
        </ul>
      )}

      {(adding || editing) && (
        <PlanSheet
          plan={editing}
          planItems={plans}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setAdding(false);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="p-3">
      <div className={`font-display text-2xl ${tone ?? "text-fg"}`}>{value}</div>
      <div className="text-[0.62rem] uppercase tracking-wider text-fg-muted">{label}</div>
    </div>
  );
}

function PlanCard({ plan, onChanged, onEdit }: { plan: PlanWithState; onChanged: () => Promise<void>; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const tone = TONE[plan.state];

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const markDone = () =>
    act(() =>
      fetchJson("/api/plans/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.id, visitOn: londonDateKey(new Date()) }),
      }),
    );

  const setStatus = (status: PlanStatus) =>
    act(() =>
      fetchJson(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    );

  return (
    <li className={`card overflow-hidden ${tone.border}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg uppercase leading-tight">{plan.customerName}</div>
          <div className="truncate text-sm text-fg-dim">
            {/* Tier names already say how often, so only spell it out for custom plans. */}
            {plan.planItemId ? plan.planLabel : `${plan.planLabel} - ${cadenceLabel(plan.cadence)}`}
            {plan.pricePence > 0 ? ` - ${money(plan.pricePence)}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-display text-sm uppercase ${tone.text}`}>{stateLabel(plan)}</div>
          {plan.termProgress && (
            <div className="text-[0.65rem] uppercase tracking-wider text-fg-muted">
              {plan.termProgress.done}/{plan.termProgress.of} visits
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-3 text-sm">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Next due" value={plan.nextDueOn ? formatDayLabel(plan.nextDueOn) : "-"} />
            <Field label="Last visit" value={plan.lastVisitOn ? formatDayLabel(plan.lastVisitOn) : "None yet"} />
            <Field label="Started" value={formatDayLabel(plan.startedOn)} />
            <Field label="Visits done" value={String(plan.visitCount)} />
          </dl>

          {plan.vehicle && <p className="text-fg-dim">{plan.vehicle}</p>}
          {plan.notes && <p className="whitespace-pre-line text-fg-dim">{plan.notes}</p>}

          <div className="flex flex-wrap gap-2">
            {plan.status === "active" && (
              <button type="button" onClick={markDone} disabled={busy} className="btn btn-gold min-h-11 text-sm">
                Visit done today
              </button>
            )}
            {plan.phone && (
              <a href={`tel:${plan.phone}`} className="btn btn-ghost min-h-11 text-sm">
                Call
              </a>
            )}
            {plan.email && (
              <a href={`mailto:${plan.email}`} className="btn btn-ghost min-h-11 text-sm">
                Email
              </a>
            )}
            {plan.address && (
              <a href={mapsUrl(plan.address)} target="_blank" rel="noopener" className="btn btn-ghost min-h-11 text-sm">
                Directions
              </a>
            )}
          </div>

          {plan.visits.length > 0 && (
            <details>
              <summary className="cursor-pointer font-display text-xs uppercase tracking-wider text-fg-muted">
                Visit history ({plan.visits.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-fg-dim">
                {plan.visits.slice(0, 20).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <span>{formatDayLabel(v.visitOn)}</span>
                    <span className="truncate text-fg-muted">
                      {v.jobTitle ?? (v.source === "manual" ? "Marked by hand" : "From the calendar")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button type="button" onClick={onEdit} className="btn btn-ghost min-h-11 text-sm">
              Edit
            </button>
            {plan.status === "active" ? (
              <button type="button" onClick={() => setStatus("paused")} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                Pause
              </button>
            ) : (
              <button type="button" onClick={() => setStatus("active")} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                Resume
              </button>
            )}
            {plan.status !== "ended" && (
              <button type="button" onClick={() => setStatus("ended")} disabled={busy} className="btn btn-ghost min-h-11 text-sm">
                End plan
              </button>
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

function PlanSheet({
  plan,
  planItems,
  onClose,
  onSaved,
}: {
  plan: PlanWithState | null;
  planItems: PricingItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState(plan?.customerName ?? "");
  const [phone, setPhone] = useState(plan?.phone ?? "");
  const [email, setEmail] = useState(plan?.email ?? "");
  const [address, setAddress] = useState(plan?.address ?? "");
  const [vehicle, setVehicle] = useState(plan?.vehicle ?? "");
  const [planItemId, setPlanItemId] = useState(plan?.planItemId ?? planItems[0]?.id ?? "");
  // Default the cadence to whatever the pre-selected tier implies, so the chips never disagree with the tier.
  const [cadence, setCadence] = useState<Cadence>(plan?.cadence ?? cadenceFromPlanItemId(planItems[0]?.id));
  const [startedOn, setStartedOn] = useState(plan?.startedOn ?? londonDateKey(new Date()));
  const [matchTerms, setMatchTerms] = useState((plan?.matchTerms ?? []).join(", "));
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(() => planItems.find((i) => i.id === planItemId) ?? null, [planItems, planItemId]);

  const pickPlanItem = (id: string) => {
    setPlanItemId(id);
    if (id) setCadence(cadenceFromPlanItemId(id));
  };

  const save = async () => {
    const name = customerName.trim();
    if (!name) {
      setError("Give the customer a name");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      customerName: name,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      vehicle: vehicle.trim() || null,
      planItemId: planItemId || null,
      planLabel: chosen?.tier ?? "Maintenance plan",
      cadence,
      pricePence: chosen?.pricePence ?? 0,
      termVisits: chosen?.visitsPerTerm ?? null,
      startedOn,
      matchTerms: matchTerms
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: notes.trim() || null,
    };
    try {
      await fetchJson(plan ? `/api/plans/${plan.id}` : "/api/plans", {
        method: plan ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await onSaved();
    } catch (e) {
      setError(errorMessage(e, "Could not save"));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await fetchJson(`/api/plans/${plan.id}`, { method: "DELETE" });
      await onSaved();
    } catch (e) {
      setError(errorMessage(e, "Could not delete"));
      setSaving(false);
    }
  };

  return (
    <Sheet title={plan ? "Edit plan" : "Add a plan customer"} onClose={onClose}>
      <div className="space-y-3">
        <Labelled label="Customer name">
          <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="As it appears in your bookings" />
        </Labelled>

        <Labelled label="Plan">
          <select className="input" value={planItemId} onChange={(e) => pickPlanItem(e.target.value)}>
            <option value="">Other / custom</option>
            {planItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.tier}
                {i.pricePence ? ` - ${money(i.pricePence)}` : ""}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="How often">
          <div className="flex flex-wrap gap-2">
            {CADENCES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCadence(c.id)}
                data-active={cadence === c.id}
                className="chip"
              >
                {c.label}
              </button>
            ))}
          </div>
        </Labelled>

        <div className="grid grid-cols-2 gap-2">
          <Labelled label="Phone">
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Labelled>
          <Labelled label="First visit">
            <input className="input" type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
          </Labelled>
        </div>

        <Labelled label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Labelled>

        <Labelled label="Address">
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Labelled>

        <Labelled label="Vehicle">
          <input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Black BMW 3 Series" />
        </Labelled>

        <Labelled label="Also count bookings containing" hint="Optional, comma separated - useful if the calendar uses a different name">
          <input className="input" value={matchTerms} onChange={(e) => setMatchTerms(e.target.value)} placeholder="Smith, BMW" />
        </Labelled>

        <Labelled label="Notes">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Labelled>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={save} disabled={saving} className="btn btn-gold flex-1">
            {saving ? "Saving..." : "Save"}
          </button>
          {plan && (
            <button type="button" onClick={remove} disabled={saving} className="btn btn-ghost px-4 text-sm">
              Delete
            </button>
          )}
        </div>
      </div>
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
