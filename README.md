# Detailing Sanctuary Central

Patrick's private operations hub for Detailing Sanctuary: today's and tomorrow's jobs from Outlook,
rain alerts for wherever the work is, a price calculator, a photo gallery and a link to the website.
One user, Android first, installable as a PWA and wrapped for Google Play as a Trusted Web Activity.

**v1 is read-only.** It never writes to the calendar. Phase 2 (quick-add bookings) plugs into the
same Microsoft client with one extra permission - see `docs/ARCHITECTURE.md`.

## Where to start

| I want to...                                   | Read                       |
| ---------------------------------------------- | -------------------------- |
| Set up the accounts and deploy it              | `docs/SETUP.md`            |
| Understand how it works, in plain English      | `docs/ARCHITECTURE.md`     |
| Put it on the Google Play Store                | `docs/PLAY_STORE.md`       |
| Change prices                                  | Supabase table `pricing_items` (or `config/pricing.json` as the fallback) |
| Change home base, hours or alert lead time     | Supabase table `app_settings` |

## Run it on this PC (sample data, no accounts needed)

```bash
npm install
npm run dev -- --port 3010
```

Open http://localhost:3010. `.env.local` has `DEMO_MODE=true`, which skips sign-in and shows sample
bookings. Weather is real (Open-Meteo needs no key). Remove `DEMO_MODE` once real keys are in place.

If the weather tile says "fetch failed" on this PC, Node cannot verify HTTPS certificates with its own
certificate list (security software on the machine re-signs web traffic). Start it with the Windows
certificate store instead - this is what `.claude/launch.json` does:

```powershell
$env:NODE_OPTIONS='--use-system-ca'; npm run dev -- --port 3010
```

This is a local quirk only; on Vercel it is not needed.

## Useful commands

```bash
npm run build       # production build (what Vercel runs)
npm run typecheck   # TypeScript only
npm run lint        # ESLint
npm run icons       # rebuild every app/Play icon from public/icons/source/app-icon-gold.svg
node scripts/make-feature-graphic.mjs   # rebuild the Play Store banner in assets/store/
```

## Stack

Next.js 16 (App Router) on Vercel - Supabase (Postgres + Storage) - Tailwind CSS 4 - Microsoft Graph
via a hand-rolled Entra ID sign-in (no auth library, one file to read) - Firebase Cloud Messaging for
push - Open-Meteo for weather behind a swappable provider interface - postcodes.io / OpenStreetMap for
address lookups - Vercel Cron (or Supabase pg_cron) for the 15-minute rain check.
