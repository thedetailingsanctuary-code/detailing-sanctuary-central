// Turns config/pricing.json into SQL that updates the pricing_items table and pricing settings.
// Usage:  node scripts/pricing-sql.mjs > supabase/migrations/0003_pricing.sql
// Then paste that file into the Supabase SQL editor and run it.
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync("config/pricing.json", "utf8"));
const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v == null ? "null" : String(v));
const b = (v) => (v ? "true" : "false");

const rows = [];
const ids = [];
cfg.services.forEach((s, si) => {
  s.items.forEach((it, ii) => {
    ids.push(it.id);
    rows.push(
      `  (${q(it.id)}, ${q(s.id)}, ${q(s.name)}, ${q(s.kind)}, ${q(s.note)}, ${q(it.tier)}, ${q(it.detail)}, ${n(it.price_pence)}, ${n(it.price_max_pence)}, ${b(it.is_from)}, ${b(it.is_quote)}, ${b(it.is_addon)}, ${q(it.unit)}, ${q(it.quantity_label)}, ${n(it.visits_per_term)}, ${q(it.note)}, ${si * 100 + ii})`,
    );
  });
});

const out = `-- Generated from config/pricing.json (${cfg.updated}). Safe to run more than once.

alter table public.pricing_items
  add column if not exists service_kind text,
  add column if not exists detail text,
  add column if not exists price_max_pence integer,
  add column if not exists is_addon boolean not null default false,
  add column if not exists quantity_label text,
  add column if not exists visits_per_term integer;

insert into public.pricing_items
  (id, service_id, service_name, service_kind, service_note, tier, detail, price_pence, price_max_pence, is_from, is_quote, is_addon, unit, quantity_label, visits_per_term, note, sort_order)
values
${rows.join(",\n")}
on conflict (id) do update set
  service_id = excluded.service_id,
  service_name = excluded.service_name,
  service_kind = excluded.service_kind,
  service_note = excluded.service_note,
  tier = excluded.tier,
  detail = excluded.detail,
  price_pence = excluded.price_pence,
  price_max_pence = excluded.price_max_pence,
  is_from = excluded.is_from,
  is_quote = excluded.is_quote,
  is_addon = excluded.is_addon,
  unit = excluded.unit,
  quantity_label = excluded.quantity_label,
  visits_per_term = excluded.visits_per_term,
  note = excluded.note,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

-- Anything not in the JSON any more is hidden, not deleted.
update public.pricing_items set active = false, updated_at = now()
where id not in (${ids.map(q).join(", ")});

-- Vehicle sizes, deposit and plan discounts.
insert into public.app_settings (key, value, updated_at)
values ('pricing', ${q(JSON.stringify(cfg.meta))}::jsonb, now())
on conflict (key) do update set value = excluded.value, updated_at = now();
`;

process.stdout.write(out);
