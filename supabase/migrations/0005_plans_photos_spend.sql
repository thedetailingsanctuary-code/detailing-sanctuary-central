-- Maintenance plans, job photos and product spend.
-- Paste the whole file into the Supabase SQL editor and run it once.

-- ---------------------------------------------------------------------------
-- 1. Maintenance plans
-- ---------------------------------------------------------------------------
-- One row per customer on a plan. Visits are ticked off automatically from the
-- Outlook calendar, so the only thing entered by hand is the customer itself.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text,
  email text,
  address text,
  postcode text,
  vehicle text,
  -- id from config/pricing.json, e.g. "plan-ext-2weekly"
  plan_item_id text,
  plan_label text not null,
  -- weekly | fortnightly | monthly
  cadence text not null default 'fortnightly',
  price_pence integer not null default 0,
  -- payg | contracted | paid-in-full
  discount_id text not null default 'payg',
  started_on date not null default current_date,
  term_visits integer,
  -- active | paused | ended
  status text not null default 'active',
  -- extra words that identify this customer's bookings in the calendar
  match_terms text[] not null default '{}',
  notes text,
  due_alerted_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plans_status on public.plans (status, customer_name);

create table if not exists public.plan_visits (
  id bigserial primary key,
  plan_id uuid not null references public.plans(id) on delete cascade,
  visit_on date not null,
  -- calendar event id when the visit was matched automatically
  job_id text,
  job_title text,
  -- calendar | manual
  source text not null default 'calendar',
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists plan_visits_job
  on public.plan_visits (plan_id, job_id) where job_id is not null;
create index if not exists plan_visits_plan_date
  on public.plan_visits (plan_id, visit_on desc);

-- ---------------------------------------------------------------------------
-- 2. Job photos (condition photos taken on arrival)
-- ---------------------------------------------------------------------------

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- calendar event id the photo belongs to
  job_id text,
  job_date date,
  customer_name text,
  postcode text,
  -- before | after | damage
  kind text not null default 'before',
  -- path inside the private job-photos bucket
  path text not null,
  note text,
  width integer,
  height integer,
  bytes integer
);

create index if not exists job_photos_job on public.job_photos (job_id);
create index if not exists job_photos_date on public.job_photos (job_date desc, created_at desc);
create index if not exists job_photos_customer on public.job_photos (lower(customer_name));

-- Private bucket: these are photos of customers' cars at their homes, so they
-- are never publicly readable. The app serves them through short-lived signed
-- links instead.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Product spend (read from supplier emails in Outlook)
-- ---------------------------------------------------------------------------

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  supplier text not null,
  order_ref text,
  purchased_on date not null,
  total_pence integer not null default 0,
  currency text not null default 'GBP',
  -- email | manual
  source text not null default 'email',
  -- Graph message id, so the same email is never counted twice
  message_id text,
  subject text,
  -- confirmed | pending | dismissed
  status text not null default 'pending',
  note text
);

create unique index if not exists purchases_message
  on public.purchases (message_id) where message_id is not null;
create index if not exists purchases_date on public.purchases (purchased_on desc);

-- ---------------------------------------------------------------------------
-- Row level security: service role only, same as every other table here.
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plan_visits enable row level security;
alter table public.job_photos enable row level security;
alter table public.purchases enable row level security;

-- ---------------------------------------------------------------------------
-- Settings rows
-- ---------------------------------------------------------------------------

insert into public.app_settings (key, value) values
  ('plans', '{"remindDaysAhead":2,"alertOverdue":true}'),
  ('purchases', '{"lookbackDays":45,"suppliers":[
     {"name":"Gold Label Car Care","match":["goldlabel","gold label"]},
     {"name":"AutoBead","match":["autobead","auto bead"]},
     {"name":"My Car Cleaning","match":["mycarcleaning","my car cleaning"]},
     {"name":"Spotless Water","match":["spotless water","spotlesswater"]}
   ]}')
on conflict (key) do nothing;
