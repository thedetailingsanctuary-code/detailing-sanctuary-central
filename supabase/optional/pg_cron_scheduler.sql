-- OPTIONAL: free scheduler that lives inside Supabase, instead of Vercel Cron.
-- Use this if the Vercel project is on the free Hobby plan (Hobby cron jobs can only run once a day).
-- 1. Replace YOUR-APP-DOMAIN and YOUR_CRON_SECRET below.
-- 2. Paste into the Supabase SQL editor and run.
-- 3. Remove the "crons" block from vercel.json so Vercel does not try to schedule it too.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'dsc-rain-check',
  '*/15 7-18 * * 1-6',  -- every 15 min, 07:00-18:59 UTC, Mon-Sat. The app itself skips runs outside 8am-6pm UK time.
  $$
  select net.http_get(
    url := 'https://YOUR-APP-DOMAIN/api/cron/rain-check',
    headers := '{"x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
    timeout_milliseconds := 30000
  )
  $$
);

-- Check it is registered:
--   select jobid, schedule, command from cron.job;
-- See recent runs:
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Remove it:
--   select cron.unschedule('dsc-rain-check');
