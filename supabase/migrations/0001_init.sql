-- Detailing Sanctuary Central - initial schema.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- The app talks to the database only from the server with the service role key,
-- so every table is locked down (RLS on, no policies) - nothing is reachable from a browser.

create extension if not exists pgcrypto;

-- 1. Price list (source of truth once populated; config/pricing.json is the seed + fallback)
create table if not exists public.pricing_items (
  id text primary key,
  service_id text not null,
  service_name text not null,
  service_note text,
  tier text not null,
  price_pence integer,
  is_from boolean not null default false,
  is_quote boolean not null default false,
  unit text,
  note text,
  visits_per_year integer,
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2. Last good copy of the schedule (offline fallback)
create table if not exists public.calendar_cache (
  id text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- 3. Devices that receive rain alerts
create table if not exists public.push_tokens (
  token text primary key,
  platform text not null default 'web',
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 4. Gallery photos (files live in the "gallery" storage bucket)
create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  caption text,
  taken_on date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Settings (home base, business hours, alert tuning)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- 6. Microsoft tokens (encrypted by the app before they get here)
create table if not exists public.ms_tokens (
  id text primary key,
  account_email text,
  refresh_token_enc text,
  access_token_enc text,
  access_expires_at timestamptz,
  needs_reauth boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 7. Address -> coordinates cache
create table if not exists public.geocode_cache (
  address_key text primary key,
  lat double precision not null,
  lng double precision not null,
  source text,
  label text,
  created_at timestamptz not null default now()
);

-- 8. Alerts that were sent (used to avoid repeats)
create table if not exists public.alert_log (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  location_key text not null,
  reason text not null,
  job_id text,
  title text,
  body text,
  payload jsonb
);
create index if not exists alert_log_lookup on public.alert_log (location_key, reason, sent_at desc);

-- Lock everything: RLS on with no policies = only the service role can read/write.
alter table public.pricing_items enable row level security;
alter table public.calendar_cache enable row level security;
alter table public.push_tokens enable row level security;
alter table public.gallery_photos enable row level security;
alter table public.app_settings enable row level security;
alter table public.ms_tokens enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.alert_log enable row level security;

-- Default settings
insert into public.app_settings (key, value) values
  ('home_base', '{"label":"Wolverhampton (WV3)","postcode":"WV3","lat":52.579,"lng":-2.1566}'),
  ('business_hours', '{"start":"08:00","end":"18:00","days":[1,2,3,4,5,6]}'),
  ('rain_alert', '{"leadMinutes":30,"thresholdMm":0.1,"cooldownMinutes":90,"upcomingJobWindowMinutes":60}')
on conflict (key) do nothing;

-- Price list seed (mirrors config/pricing.json). Edit prices here later; the app reads this table first.
insert into public.pricing_items
  (id, service_id, service_name, service_note, tier, price_pence, is_from, is_quote, unit, note, visits_per_year, sort_order)
values
  ('valeting-maintenance', 'valeting', 'Valeting', 'Prices are ''from'' - final price depends on vehicle size and condition.', 'Maintenance', 5500, true, false, 'per visit', null, null, 0),
  ('valeting-full', 'valeting', 'Valeting', 'Prices are ''from'' - final price depends on vehicle size and condition.', 'Full Valet', 9000, true, false, null, null, null, 1),
  ('valeting-deep', 'valeting', 'Valeting', 'Prices are ''from'' - final price depends on vehicle size and condition.', 'Deep Clean', 13500, true, false, null, null, null, 2),
  ('valeting-makeover', 'valeting', 'Valeting', 'Prices are ''from'' - final price depends on vehicle size and condition.', 'Make Over', 28500, true, false, null, null, null, 3),
  ('ceramic-2yr', 'ceramic', 'Ceramic Coating', 'Standalone service - not bundled with valeting.', '2 Year Coating', 35000, false, false, null, null, null, 100),
  ('ceramic-5yr', 'ceramic', 'Ceramic Coating', 'Standalone service - not bundled with valeting.', '5 Year Coating', 40000, false, false, null, null, null, 101),
  ('ceramic-7yr', 'ceramic', 'Ceramic Coating', 'Standalone service - not bundled with valeting.', '7 Year 10H Coating', 56500, false, false, null, 'inc VAT', null, 102),
  ('ceramic-window', 'ceramic', 'Ceramic Coating', 'Standalone service - not bundled with valeting.', 'Window Ceramic Coating', 17500, false, false, null, null, null, 103),
  ('paint-correction-quote', 'paint-correction', 'Paint Correction', 'Quoted per vehicle after inspection.', 'Quote per vehicle', null, false, true, null, null, null, 200),
  ('plan-payg', 'maintenance-plan', 'Maintenance Plan', 'Contracted plans are priced per visit.', 'Pay as you go', 9000, false, false, 'per visit', null, null, 300),
  ('plan-weekly', 'maintenance-plan', 'Maintenance Plan', 'Contracted plans are priced per visit.', 'Weekly (contract)', 3500, false, false, 'per visit', null, 52, 301),
  ('plan-fortnightly', 'maintenance-plan', 'Maintenance Plan', 'Contracted plans are priced per visit.', 'Fortnightly (contract)', 4500, false, false, 'per visit', null, 26, 302),
  ('plan-3weekly', 'maintenance-plan', 'Maintenance Plan', 'Contracted plans are priced per visit.', 'Every 3 weeks (contract)', 6000, false, false, 'per visit', null, 17, 303),
  ('plan-monthly', 'maintenance-plan', 'Maintenance Plan', 'Contracted plans are priced per visit.', 'Monthly (contract)', 8000, false, false, 'per visit', null, 12, 304)
on conflict (id) do update set
  service_name = excluded.service_name,
  service_note = excluded.service_note,
  tier = excluded.tier,
  price_pence = excluded.price_pence,
  is_from = excluded.is_from,
  is_quote = excluded.is_quote,
  unit = excluded.unit,
  note = excluded.note,
  visits_per_year = excluded.visits_per_year,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Gallery storage bucket: public read (so photos load fast), writes only via the app's server key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
