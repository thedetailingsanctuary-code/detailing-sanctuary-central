-- Jobs pulled in from the booking hub.
-- Paste the whole file into the Supabase SQL editor and run it once.
--
-- The hub is the place a customer books; this table is the copy Central works
-- from so the board still shows the week when the hub is unreachable. The pull
-- only ever reads from the hub and writes here - it never touches the Outlook
-- calendar.
--
-- MONEY: every amount here is in PENCE, as whole numbers, like the rest of the
-- database. The hub sends pounds. The pull multiplies by 100 exactly once, in
-- poundsToPence() in src/lib/jobs/types.ts. Nothing may write to these columns
-- without going through it - a balance copied straight across turns £382 into
-- £3.82.

create table if not exists public.jobs (
  -- The hub's own reference, e.g. "DS-MU2ZVVPM". It is the primary key so that
  -- pulling the same job twice updates the row instead of duplicating the job.
  reference text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Calendar bookings behind the job. Big jobs run over two days and the hub
  -- books them as two slots, so there is a second of each rather than a list.
  booking_id text,
  second_booking_id text,
  starts_at timestamptz,
  second_starts_at timestamptz,

  customer_name text not null,
  customer_email text,
  customer_phone text,

  address text,
  town text,
  postcode text,

  vehicle text,
  size_label text,

  -- [{ "name": "Full Detail", "pricePence": 45000 }, ...] - the quote lines as
  -- they were priced on the day. Kept as jsonb rather than a child table
  -- because they are only ever read back whole, with the job.
  lines jsonb not null default '[]'::jsonb,

  -- PENCE. balance_pence is what is still owed, not a running total: the hub
  -- has already taken the deposit off.
  total_pence integer not null default 0,
  deposit_pence integer not null default 0,
  balance_pence integer not null default 0,

  -- Null when the hub did not say. Mobile jobs need a water and power check.
  at_customer boolean,
  notes text,

  -- booked | done | invoiced | paid
  -- Central owns this after the pull - a re-pull must not knock a job that has
  -- been done and invoiced back to booked.
  status text not null default 'booked',
  -- hub | manual, for jobs typed in here when the hub was down
  source text not null default 'hub',
  -- When it was last read from the hub, so a stale board can say so
  pulled_at timestamptz
);

-- The two ways the board is read: "what is still owed" and "what is on".
create index if not exists jobs_status on public.jobs (status, starts_at);
create index if not exists jobs_starts on public.jobs (starts_at desc);

-- Row level security: service role only, same as every other table here.
alter table public.jobs enable row level security;
