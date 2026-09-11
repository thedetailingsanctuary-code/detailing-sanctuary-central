-- Generated from config/pricing.json (2026-09-11). Safe to run more than once.

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
  ('valeting-maintenance', 'valeting', 'Valeting & detailing', 'package', 'Starting prices for a standard car in reasonable condition. Size and condition move the price.', 'Maintenance', 'Up to 3 hours, every 2-4 weeks. A deep clean is usually needed first.', 5500, null, true, false, false, null, null, null, null, 0),
  ('valeting-full', 'valeting', 'Valeting & detailing', 'package', 'Starting prices for a standard car in reasonable condition. Size and condition move the price.', 'Full Valet', 'Up to 4 hours, inside and out, finished with a ceramic sealant.', 10000, null, true, false, false, null, null, null, null, 1),
  ('valeting-deep', 'valeting', 'Valeting & detailing', 'package', 'Starting prices for a standard car in reasonable condition. Size and condition move the price.', 'Deep Clean', 'Up to 5 hours. Full Valet plus seats shampooed or leather balmed, steam clean, tar and iron removal.', 13500, null, true, false, false, null, null, null, null, 2),
  ('valeting-makeover', 'valeting', 'Valeting & detailing', 'package', 'Starting prices for a standard car in reasonable condition. Size and condition move the price.', 'Make Over', 'Up to 10 hours. Deep clean, gloss-enhancing machine polish and 12-month Fusso wax.', 28500, null, true, false, false, null, null, null, null, 3),
  ('sale-prep', 'valeting', 'Valeting & detailing', 'package', 'Starting prices for a standard car in reasonable condition. Size and condition move the price.', 'Car Sale Preparation', 'Exterior detail, interior deep clean, engine bay, wheels and tyres, listing photos.', 18000, null, true, false, false, null, null, null, null, 4),
  ('ceramic-2yr', 'ceramic', 'Ceramic coatings', 'coating', 'Added on top of a detail. Every package includes decontamination and a Stage 1 machine polish. Inc VAT.', '2 Year Ceramic Coating', 'Up to 2 years. Enhanced gloss, water beading, UV protection.', 35000, null, false, false, true, null, null, null, null, 100),
  ('ceramic-5yr', 'ceramic', 'Ceramic coatings', 'coating', 'Added on top of a detail. Every package includes decontamination and a Stage 1 machine polish. Inc VAT.', '5 Year Ceramic Coating', 'Up to 5 years. Mirror finish, extreme water and dirt repellency.', 40000, null, false, false, true, null, null, null, null, 101),
  ('ceramic-7yr', 'ceramic', 'Ceramic coatings', 'coating', 'Added on top of a detail. Every package includes decontamination and a Stage 1 machine polish. Inc VAT.', 'Ultimate 7 Year (10H)', 'Up to 7 years. Paintwork, wheels and exterior surfaces.', 56500, null, false, false, true, null, null, null, null, 102),
  ('ceramic-window', 'ceramic', 'Ceramic coatings', 'coating', 'Added on top of a detail. Every package includes decontamination and a Stage 1 machine polish. Inc VAT.', 'Window Ceramic Coating', 'Up to 7 years or about 45,000 miles. Glass polished and decontaminated first.', 17500, null, false, false, false, null, null, null, null, 103),
  ('ceramic-alloys', 'ceramic', 'Ceramic coatings', 'coating', 'Added on top of a detail. Every package includes decontamination and a Stage 1 machine polish. Inc VAT.', 'Alloy ceramic coating (set of 4)', 'Brake dust rinses off.', 7000, null, false, false, false, null, null, null, null, 104),
  ('ceramic-leather', 'ceramic', 'Ceramic coatings', 'coating', 'Added on top of a detail. Every package includes decontamination and a Stage 1 machine polish. Inc VAT.', 'Leather ceramic protection', 'Applied to seats, ideal while they are new.', 7500, null, false, false, false, null, null, null, null, 105),
  ('addon-ozone', 'addons', 'Add-ons & specialist', 'addon', 'Priced for a standard car and added to any valet or detail.', 'Ozone odour treatment', null, 4500, null, false, false, false, null, null, null, null, 200),
  ('addon-pet-hair', 'addons', 'Add-ons & specialist', 'addon', 'Priced for a standard car and added to any valet or detail.', 'Pet hair removal', null, 2500, null, false, false, false, 'per hour', 'hours', null, null, 201),
  ('addon-seats-out', 'addons', 'Add-ons & specialist', 'addon', 'Priced for a standard car and added to any valet or detail.', 'Seats-out detail', null, 4000, null, false, false, false, null, null, null, null, 202),
  ('addon-car-seat', 'addons', 'Add-ons & specialist', 'addon', 'Priced for a standard car and added to any valet or detail.', 'Car seat wash', null, 1500, null, false, false, false, 'per seat', 'seats', null, null, 203),
  ('addon-steam', 'addons', 'Add-ons & specialist', 'addon', 'Priced for a standard car and added to any valet or detail.', 'Interior steam clean', null, 3500, null, false, false, false, null, null, null, null, 204),
  ('addon-headlights', 'addons', 'Add-ons & specialist', 'addon', 'Priced for a standard car and added to any valet or detail.', 'Headlight restoration', 'Pair, sealed with a 1-year ceramic coating. 45-90 minutes.', 6000, 16500, false, false, false, null, null, null, null, 205),
  ('addon-exhaust', 'addons', 'Add-ons & specialist', 'addon', 'Priced for a standard car and added to any valet or detail.', 'Exhaust tip polish', null, 3500, null, false, false, false, null, null, null, null, 206),
  ('correction-stage2', 'correction', 'Paint correction', 'correction', 'Always quoted after seeing the paint. Stage 1 gloss enhancement is part of the Make Over.', 'Stage 2 machine polish', 'Two-stage correction, quoted after inspection.', 36500, null, true, false, false, null, null, null, null, 300),
  ('correction-motorbike', 'correction', 'Paint correction', 'correction', 'Always quoted after seeing the paint. Stage 1 gloss enhancement is part of the Make Over.', 'Motorbike correction', '3-6 hours at your home.', 17500, 45000, false, false, false, null, null, null, null, 301),
  ('correction-multistage', 'correction', 'Paint correction', 'correction', 'Always quoted after seeing the paint. Stage 1 gloss enhancement is part of the Make Over.', 'Multi-stage correction', 'Full correction on neglected paint.', null, null, false, true, false, null, null, null, null, 302),
  ('fleet-basic', 'fleet', 'Fleet (per vehicle)', 'fleet', 'Vans, pickups and company cars on site, scheduled around downtime. Two or more vehicles at one address works out cheaper per vehicle.', 'Basic Clean', 'Safe exterior wash, wheels, tyres, quick interior.', 7900, null, false, false, false, 'per vehicle', 'vehicles', null, null, 400),
  ('fleet-deep', 'fleet', 'Fleet (per vehicle)', 'fleet', 'Vans, pickups and company cars on site, scheduled around downtime. Two or more vehicles at one address works out cheaper per vehicle.', 'Deep Clean', 'Everything in Basic plus paint decontamination and interior deep clean.', 14900, null, false, false, false, 'per vehicle', 'vehicles', null, null, 401),
  ('fleet-ultimate', 'fleet', 'Fleet (per vehicle)', 'fleet', 'Vans, pickups and company cars on site, scheduled around downtime. Two or more vehicles at one address works out cheaper per vehicle.', 'Ultimate Clean', 'Presentation standard.', 19900, null, false, false, false, 'per vehicle', 'vehicles', null, null, 402),
  ('plan-ext-weekly', 'plans', 'Maintenance plans', 'plan', 'Needs a deep clean or detail first (from £135). A four-month term is 16 weekly, 8 fortnightly or 4 monthly visits. 5% off contracted, 10% off paid in full.', 'Exterior only, weekly', 'Safe wash, alloys, drying, sealant.', 3250, null, false, false, false, 'per visit', null, 16, null, 500),
  ('plan-ext-2weekly', 'plans', 'Maintenance plans', 'plan', 'Needs a deep clean or detail first (from £135). A four-month term is 16 weekly, 8 fortnightly or 4 monthly visits. 5% off contracted, 10% off paid in full.', 'Exterior only, every 2 weeks', null, 4000, null, false, false, false, 'per visit', null, 8, null, 501),
  ('plan-ext-monthly', 'plans', 'Maintenance plans', 'plan', 'Needs a deep clean or detail first (from £135). A four-month term is 16 weekly, 8 fortnightly or 4 monthly visits. 5% off contracted, 10% off paid in full.', 'Exterior only, monthly', null, 6500, null, false, false, false, 'per visit', null, 4, null, 502),
  ('plan-int-weekly', 'plans', 'Maintenance plans', 'plan', 'Needs a deep clean or detail first (from £135). A four-month term is 16 weekly, 8 fortnightly or 4 monthly visits. 5% off contracted, 10% off paid in full.', 'Interior & exterior, weekly', 'Adds interior vacuum and wipe-down.', 4500, null, false, false, false, 'per visit', null, 16, null, 503),
  ('plan-int-2weekly', 'plans', 'Maintenance plans', 'plan', 'Needs a deep clean or detail first (from £135). A four-month term is 16 weekly, 8 fortnightly or 4 monthly visits. 5% off contracted, 10% off paid in full.', 'Interior & exterior, every 2 weeks', null, 6000, null, false, false, false, 'per visit', null, 8, null, 504),
  ('plan-int-monthly', 'plans', 'Maintenance plans', 'plan', 'Needs a deep clean or detail first (from £135). A four-month term is 16 weekly, 8 fortnightly or 4 monthly visits. 5% off contracted, 10% off paid in full.', 'Interior & exterior, monthly', null, 8500, null, false, false, false, 'per visit', null, 4, null, 505)
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
where id not in ('valeting-maintenance', 'valeting-full', 'valeting-deep', 'valeting-makeover', 'sale-prep', 'ceramic-2yr', 'ceramic-5yr', 'ceramic-7yr', 'ceramic-window', 'ceramic-alloys', 'ceramic-leather', 'addon-ozone', 'addon-pet-hair', 'addon-seats-out', 'addon-car-seat', 'addon-steam', 'addon-headlights', 'addon-exhaust', 'correction-stage2', 'correction-motorbike', 'correction-multistage', 'fleet-basic', 'fleet-deep', 'fleet-ultimate', 'plan-ext-weekly', 'plan-ext-2weekly', 'plan-ext-monthly', 'plan-int-weekly', 'plan-int-2weekly', 'plan-int-monthly');

-- Vehicle sizes, deposit and plan discounts.
insert into public.app_settings (key, value, updated_at)
values ('pricing', '{"sizeStepPercent":7,"sizes":[{"id":"standard","name":"Standard car","steps":0},{"id":"large","name":"Large (SUV / estate)","steps":1},{"id":"xl","name":"Extra large (van / 7-seater)","steps":2}],"deposit":{"percent":25,"minimumPence":2500},"planDiscounts":[{"id":"payg","name":"Pay as you go","percent":0},{"id":"contracted","name":"Contracted","percent":5},{"id":"paid-in-full","name":"Paid in full","percent":10}],"termLabel":"four-month term"}'::jsonb, now())
on conflict (key) do update set value = excluded.value, updated_at = now();
