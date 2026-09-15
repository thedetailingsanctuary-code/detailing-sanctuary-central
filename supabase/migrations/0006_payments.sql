-- Payment requests (deposits and balances) sent from the app.
-- Paste the whole file into the Supabase SQL editor and run it once.
--
-- No card details are ever stored here or anywhere in the app: the customer
-- pays on Square's own hosted page. This table only records what was asked
-- for, where the payment page is, and whether it has been paid.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- deposit | balance | full | other
  kind text not null default 'deposit',
  customer_name text not null,
  customer_email text,
  customer_phone text,
  description text not null,

  -- what it relates to, any or none of these
  job_id text,
  quote_id uuid,
  plan_id uuid references public.plans(id) on delete set null,

  amount_pence integer not null,
  currency text not null default 'GBP',

  -- draft | sent | paid | cancelled | refunded | failed
  status text not null default 'draft',
  due_on date,
  sent_at timestamptz,
  paid_at timestamptz,
  paid_amount_pence integer,

  -- how it was sent: email | whatsapp | link
  channel text,
  email_status text,
  email_error text,

  -- provider side (Square today, swappable later)
  provider text not null default 'square',
  provider_link_id text,
  provider_link_url text,
  provider_order_id text,
  provider_payment_id text,
  -- our own reference, shown on the payment page
  reference text not null,

  -- stops the "still not paid" nudge repeating every day
  chased_on date,
  note text
);

create unique index if not exists payments_reference on public.payments (reference);
create index if not exists payments_status on public.payments (status, due_on);
create index if not exists payments_created on public.payments (created_at desc);
create index if not exists payments_order on public.payments (provider_order_id)
  where provider_order_id is not null;
create index if not exists payments_job on public.payments (job_id) where job_id is not null;

alter table public.payments enable row level security;

insert into public.app_settings (key, value) values
  ('payments', '{"chaseAfterDays":3,"remindUnpaid":true,"defaultKind":"deposit"}')
on conflict (key) do nothing;
