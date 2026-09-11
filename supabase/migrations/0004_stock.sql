-- Chemical stock tracking. Paste into the Supabase SQL editor and run once.
-- Levels are a percentage of the current bottle. Each finished job takes a set
-- percentage off, and a push goes out when anything drops to its minimum (10%).

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text not null default 'other',
  size_label text,
  level_percent numeric(5,2) not null default 100,
  min_percent numeric(5,2) not null default 10,
  supplier text,
  supplier_url text,
  last_cost_pence integer,
  last_purchased_on date,
  last_restocked_at timestamptz,
  low_alerted_at timestamptz,
  notes text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_usage (
  service_key text not null,
  item_id uuid not null references public.stock_items(id) on delete cascade,
  percent_per_job numeric(5,2) not null,
  primary key (service_key, item_id)
);

create table if not exists public.stock_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  item_id uuid references public.stock_items(id) on delete cascade,
  kind text not null,
  delta_percent numeric(6,2) not null default 0,
  level_after numeric(5,2),
  job_id text,
  job_title text,
  service_key text,
  note text
);
create index if not exists stock_events_job on public.stock_events (job_id);
create index if not exists stock_events_created on public.stock_events (created_at desc);

alter table public.stock_items enable row level security;
alter table public.stock_usage enable row level security;
alter table public.stock_events enable row level security;

-- Starting stock list, taken from supplier order emails Mar-Sep 2026. Levels start at 100%; adjust in the app.
insert into public.stock_items (name, brand, category, size_label, supplier, supplier_url, last_cost_pence, last_purchased_on, sort_order) values
  ('Touch-Less V2 Concentrate Snow Foam', 'Bilt Hamber', 'prewash', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 3295, '2026-09-03', 10),
  ('H104 Citrus Cleanser Pre Wash', 'Hamblechem', 'prewash', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 2500, '2026-07-13', 11),
  ('Snow Foam Combo 2', 'Valet Pro', 'prewash', '1L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 1100, '2026-06-12', 12),
  ('H6 Jelly Wash Shampoo', 'Hamblechem', 'wash', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 3000, '2026-09-03', 20),
  ('Touch-On', 'Bilt Hamber', 'wash', '1L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 2395, '2026-09-03', 21),
  ('Concentrated Car Wash', 'ValetPro', 'wash', '1L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 920, '2026-03-22', 22),
  ('Yum Cars pH Neutral Shampoo', 'SR', 'wash', '500ml', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 1200, '2026-05-14', 23),
  ('Professional Fallout Remover', 'Autoglym', 'decon', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 3149, '2026-09-07', 30),
  ('Professional Tar & Adhesive Remover', 'Autoglym', 'decon', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 3972, '2026-09-07', 31),
  ('Surfex HD (all purpose cleaner)', 'Bilt Hamber', 'decon', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 2895, '2026-06-12', 32),
  ('Bilberry Wheel Cleaner', 'Valet Pro', 'wheels', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 3200, '2026-09-07', 40),
  ('Acid Wheel Cleaner', 'AutoBead', 'wheels', '5L', 'AutoBead', 'https://www.autobead.co.uk', 2995, '2026-03-13', 41),
  ('Green Star Universal Cleaner', 'Koch Chemie', 'interior', '1L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 705, '2026-06-12', 50),
  ('Enzyme Odour Eater', 'Valet Pro', 'interior', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 4400, '2026-03-22', 51),
  ('Microfibre Reviver (towel wash)', 'Valet Pro', 'interior', '5L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 2900, '2026-03-30', 52),
  ('Regenerate', 'Angelwax', 'interior', '500ml', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 2395, '2026-05-14', 53),
  ('Re-View Glass Polish', 'Bilt Hamber', 'glass', '500ml', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 1695, '2026-06-12', 60),
  ('Medium Cut Polish 2400 (P203S)', 'Menzerna', 'polish', '1L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 2969, '2026-07-02', 70),
  ('Heavy Cut Compound 1000', 'Menzerna', 'polish', '1L', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 2249, '2026-03-22', 71),
  ('Reign Ceramic Coating', 'Performance PPL', 'coating', '100ml', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 18995, '2026-08-23', 80),
  ('Cerberus Ceramic Coating V2', 'Garage Therapy', 'coating', '30ml', 'My Car Cleaning', 'https://www.mycarcleaning.co.uk', 5495, '2025-10-07', 81),
  ('Air Freshener & Sanitiser Royal Cherry', 'Gold Label', 'fragrance', '500ml', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 600, '2026-08-23', 90),
  ('Blast Air Freshener cans (mixed)', 'OCD', 'fragrance', '6 x 400ml', 'Gold Label Car Care', 'https://www.goldlabelcarcare.co.uk', 595, '2026-07-13', 91);

-- Starting usage per job type (percent of a bottle per job). These are sensible guesses - tune them in the app.
with i as (select id, name from public.stock_items)
insert into public.stock_usage (service_key, item_id, percent_per_job)
select s.service_key, i.id, s.pct
from (values
  -- Maintenance wash
  ('valeting-maintenance', 'Touch-Less V2 Concentrate Snow Foam', 2.0),
  ('valeting-maintenance', 'H6 Jelly Wash Shampoo', 1.0),
  ('valeting-maintenance', 'Bilberry Wheel Cleaner', 3.0),
  ('valeting-maintenance', 'Microfibre Reviver (towel wash)', 1.0),
  -- Full Valet
  ('valeting-full', 'Touch-Less V2 Concentrate Snow Foam', 3.0),
  ('valeting-full', 'H104 Citrus Cleanser Pre Wash', 2.0),
  ('valeting-full', 'H6 Jelly Wash Shampoo', 1.5),
  ('valeting-full', 'Touch-On', 4.0),
  ('valeting-full', 'Bilberry Wheel Cleaner', 5.0),
  ('valeting-full', 'Surfex HD (all purpose cleaner)', 2.0),
  ('valeting-full', 'Green Star Universal Cleaner', 4.0),
  ('valeting-full', 'Re-View Glass Polish', 2.0),
  ('valeting-full', 'Microfibre Reviver (towel wash)', 2.0),
  ('valeting-full', 'Blast Air Freshener cans (mixed)', 3.0),
  -- Deep Clean
  ('valeting-deep', 'Touch-Less V2 Concentrate Snow Foam', 3.0),
  ('valeting-deep', 'H104 Citrus Cleanser Pre Wash', 3.0),
  ('valeting-deep', 'H6 Jelly Wash Shampoo', 1.5),
  ('valeting-deep', 'Touch-On', 4.0),
  ('valeting-deep', 'Bilberry Wheel Cleaner', 5.0),
  ('valeting-deep', 'Professional Fallout Remover', 5.0),
  ('valeting-deep', 'Professional Tar & Adhesive Remover', 3.0),
  ('valeting-deep', 'Surfex HD (all purpose cleaner)', 4.0),
  ('valeting-deep', 'Green Star Universal Cleaner', 6.0),
  ('valeting-deep', 'Enzyme Odour Eater', 3.0),
  ('valeting-deep', 'Re-View Glass Polish', 2.0),
  ('valeting-deep', 'Microfibre Reviver (towel wash)', 3.0),
  ('valeting-deep', 'Blast Air Freshener cans (mixed)', 3.0),
  -- Make Over
  ('valeting-makeover', 'Touch-Less V2 Concentrate Snow Foam', 3.0),
  ('valeting-makeover', 'H104 Citrus Cleanser Pre Wash', 3.0),
  ('valeting-makeover', 'H6 Jelly Wash Shampoo', 1.5),
  ('valeting-makeover', 'Touch-On', 4.0),
  ('valeting-makeover', 'Bilberry Wheel Cleaner', 5.0),
  ('valeting-makeover', 'Professional Fallout Remover', 5.0),
  ('valeting-makeover', 'Professional Tar & Adhesive Remover', 3.0),
  ('valeting-makeover', 'Surfex HD (all purpose cleaner)', 4.0),
  ('valeting-makeover', 'Green Star Universal Cleaner', 6.0),
  ('valeting-makeover', 'Medium Cut Polish 2400 (P203S)', 5.0),
  ('valeting-makeover', 'Re-View Glass Polish', 2.0),
  ('valeting-makeover', 'Microfibre Reviver (towel wash)', 3.0),
  ('valeting-makeover', 'Blast Air Freshener cans (mixed)', 3.0),
  -- Car Sale Preparation
  ('sale-prep', 'Touch-Less V2 Concentrate Snow Foam', 3.0),
  ('sale-prep', 'H104 Citrus Cleanser Pre Wash', 3.0),
  ('sale-prep', 'H6 Jelly Wash Shampoo', 1.5),
  ('sale-prep', 'Bilberry Wheel Cleaner', 5.0),
  ('sale-prep', 'Professional Fallout Remover', 4.0),
  ('sale-prep', 'Surfex HD (all purpose cleaner)', 5.0),
  ('sale-prep', 'Green Star Universal Cleaner', 5.0),
  ('sale-prep', 'Re-View Glass Polish', 2.0),
  ('sale-prep', 'Microfibre Reviver (towel wash)', 3.0),
  -- Ceramic coating job (decon + Stage 1 polish + coating)
  ('ceramic', 'Touch-Less V2 Concentrate Snow Foam', 3.0),
  ('ceramic', 'H104 Citrus Cleanser Pre Wash', 3.0),
  ('ceramic', 'H6 Jelly Wash Shampoo', 1.5),
  ('ceramic', 'Bilberry Wheel Cleaner', 5.0),
  ('ceramic', 'Professional Fallout Remover', 6.0),
  ('ceramic', 'Professional Tar & Adhesive Remover', 4.0),
  ('ceramic', 'Medium Cut Polish 2400 (P203S)', 6.0),
  ('ceramic', 'Reign Ceramic Coating', 20.0),
  ('ceramic', 'Re-View Glass Polish', 3.0),
  ('ceramic', 'Microfibre Reviver (towel wash)', 3.0),
  -- Paint correction
  ('correction', 'Touch-Less V2 Concentrate Snow Foam', 3.0),
  ('correction', 'H6 Jelly Wash Shampoo', 1.5),
  ('correction', 'Professional Fallout Remover', 6.0),
  ('correction', 'Professional Tar & Adhesive Remover', 4.0),
  ('correction', 'Heavy Cut Compound 1000', 8.0),
  ('correction', 'Medium Cut Polish 2400 (P203S)', 8.0),
  ('correction', 'Microfibre Reviver (towel wash)', 3.0),
  -- Interior only
  ('interior', 'Surfex HD (all purpose cleaner)', 4.0),
  ('interior', 'Green Star Universal Cleaner', 6.0),
  ('interior', 'Enzyme Odour Eater', 3.0),
  ('interior', 'Re-View Glass Polish', 1.0),
  ('interior', 'Microfibre Reviver (towel wash)', 2.0),
  ('interior', 'Blast Air Freshener cans (mixed)', 3.0),
  -- Odour / ozone job
  ('odour', 'Enzyme Odour Eater', 10.0),
  ('odour', 'Surfex HD (all purpose cleaner)', 3.0),
  ('odour', 'Green Star Universal Cleaner', 4.0),
  ('odour', 'Air Freshener & Sanitiser Royal Cherry', 10.0),
  -- Anything else: treat as a Full Valet
  ('default', 'Touch-Less V2 Concentrate Snow Foam', 3.0),
  ('default', 'H6 Jelly Wash Shampoo', 1.5),
  ('default', 'Bilberry Wheel Cleaner', 5.0),
  ('default', 'Green Star Universal Cleaner', 4.0),
  ('default', 'Microfibre Reviver (towel wash)', 2.0)
) as s(service_key, item_name, pct)
join i on i.name = s.item_name
on conflict (service_key, item_id) do nothing;

-- Settings: automatic deduction on, nag again after 7 days, name matching rules live in the app.
insert into public.app_settings (key, value, updated_at)
values ('stock', '{"autoDeduct":true,"alertRepeatDays":7,"aliases":[]}'::jsonb, now())
on conflict (key) do nothing;
