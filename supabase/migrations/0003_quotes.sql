-- Quotes sent to customers from the app (email, WhatsApp or copied text).
-- Paste into the Supabase SQL editor and run once.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  vehicle text,
  size_id text not null,
  lines jsonb not null,
  total_min_pence integer not null default 0,
  total_max_pence integer not null default 0,
  has_from boolean not null default false,
  has_quote boolean not null default false,
  deposit_pence integer not null default 0,
  note text,
  channel text not null default 'text',
  text text,
  sent_at timestamptz,
  email_status text,
  email_error text
);

create index if not exists quotes_created_at on public.quotes (created_at desc);

alter table public.quotes enable row level security;
