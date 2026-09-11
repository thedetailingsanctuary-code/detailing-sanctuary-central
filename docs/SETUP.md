# Setup guide

Everything below is a one-off. Budget about an hour with a cup of tea. You need five accounts;
four of them are free. Work through the sections in order and paste values into a notes file as
you go, then enter them all into Vercel in section 5.

| Account            | Used for                                  | Cost                                   |
| ------------------ | ----------------------------------------- | -------------------------------------- |
| Supabase           | Database + photo storage                  | Free tier is plenty                    |
| Microsoft Entra ID | Sign-in + reading the Outlook calendar    | Included with Microsoft 365            |
| Firebase           | Push notifications (rain alerts)          | Free (Spark plan)                      |
| Vercel             | Hosting + scheduled rain check            | Free (Hobby) or Pro at about $20/month - see 5.3 |
| GitHub             | Where the code lives so Vercel can deploy | Free                                   |

---

## 1. Supabase (database)

1. Go to https://supabase.com, sign in, **New project**. Name it `ds-central`, pick the London region,
   set a strong database password (you will not need it day to day).
2. When it finishes creating, open **SQL Editor** in the left menu, click **New query**, paste the whole
   contents of `supabase/migrations/0001_init.sql` from this project, and press **Run**. It creates the
   tables, seeds the price list and settings, and creates the `gallery` photo bucket.
3. Open **Project Settings > API** and copy:
   - **Project URL** -> `SUPABASE_URL`
   - **service_role** key (under "Project API keys", click reveal) -> `SUPABASE_SERVICE_ROLE_KEY`

   The service_role key is powerful. It only ever lives in Vercel's environment settings, never in
   the app that runs on the phone.

---

## 2. Microsoft Entra ID (sign-in and calendar access)

This is the "lock" on the app. Only the one account you name here can get in.

1. Go to https://entra.microsoft.com (sign in with the Microsoft 365 admin account).
2. **Applications > App registrations > New registration**
   - Name: `Detailing Sanctuary Central`
   - Supported account types: **Accounts in this organizational directory only (Single tenant)**
   - Redirect URI: choose **Web** and enter `https://YOUR-APP-DOMAIN/api/auth/callback`
     (you get the domain from Vercel in section 5 - come back and add it if you do Vercel first).
     Also add `http://localhost:3010/api/auth/callback` if you want to test real sign-in on the PC.
   - Register.
3. On the app's **Overview** page copy:
   - **Application (client) ID** -> `MS_CLIENT_ID`
   - **Directory (tenant) ID** -> `MS_TENANT_ID` (the GUID, not the domain name)
4. **Certificates & secrets > New client secret**. Description `ds-central`, expiry 24 months.
   Copy the **Value** column immediately (it is hidden later) -> `MS_CLIENT_SECRET`.
   Put a reminder in your calendar for the expiry date - you will need to make a new one then.
5. **API permissions > Add a permission > Microsoft Graph > Delegated permissions**. Tick:
   `Calendars.Read`, `User.Read`, `offline_access`, `openid`, `profile`, `email`. Add them, then click
   **Grant admin consent for <your organisation>** so you are never asked again on the phone.
6. `ALLOWED_USER_EMAIL` = the sign-in address of the account whose calendar has the bookings
   (for example `DetailMyCar@DetailingSanctuary.co.uk`). Only this address will be let in.
7. Optional extra lock: **Enterprise applications > Detailing Sanctuary Central > Properties**, set
   **Assignment required?** to **Yes**, then under **Users and groups** add only your account.

Phase 2 note: when quick-add booking is built, the only change here is adding the
`Calendars.ReadWrite` permission and granting consent again.

---

## 3. Firebase (push notifications)

1. Go to https://console.firebase.google.com, **Add project**, name it `ds-central`. You can turn
   Google Analytics off. Stay on the free Spark plan.
2. On the project home click the **web** icon (`</>`) to add a web app. Nickname `DS Central`.
   Do not tick Firebase Hosting. Register. It shows a `firebaseConfig` object - copy the values into
   one line of JSON, for example:
   `{"apiKey":"AIza...","authDomain":"ds-central.firebaseapp.com","projectId":"ds-central","messagingSenderId":"123456","appId":"1:123456:web:abc"}`
   -> `NEXT_PUBLIC_FIREBASE_CONFIG_JSON`
3. **Project settings (cog) > Cloud Messaging > Web configuration > Web Push certificates >
   Generate key pair**. Copy the key -> `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. **Project settings > Service accounts > Generate new private key**. It downloads a JSON file.
   Open it in Notepad, select all, and paste the whole thing (one line is fine) as
   `FIREBASE_SERVICE_ACCOUNT_JSON`. If Vercel complains about line breaks, base64 the file instead:
   PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\file.json"))`.
   Keep that file private; it is a server credential.

---

## 4. Put the code on GitHub

1. Create an empty private repository on https://github.com called `detailing-sanctuary-central`.
2. In a terminal inside this project folder:

```bash
git add -A
git commit -m "Detailing Sanctuary Central v1"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/detailing-sanctuary-central.git
git push -u origin main
```

`.env.local` and any keystore files are ignored by git, so secrets never get uploaded.

---

## 5. Vercel (hosting)

### 5.1 Create the project

1. https://vercel.com > **Add New > Project** > import `detailing-sanctuary-central` from GitHub.
   Framework is detected as Next.js. Do not deploy yet - open **Environment Variables** first.
2. Add every variable from the table below (Production and Preview both ticked).
3. Deploy. When it finishes you get a domain like `detailing-sanctuary-central.vercel.app`.
   You can add a nicer one later under **Settings > Domains** (for example `central.detailingsanctuary.co.uk`).
4. Set `APP_BASE_URL` to that domain (with `https://`, no trailing slash), then go back to
   Entra ID (section 2, step 2) and make sure the redirect URI matches it exactly. Redeploy.

### 5.2 Environment variables

| Name                                | Value from                                                   |
| ----------------------------------- | ------------------------------------------------------------ |
| `APP_BASE_URL`                      | Your Vercel domain, e.g. `https://ds-central.vercel.app`     |
| `SESSION_SECRET`                    | A random 48-character string (see `.env.example` for a one-liner) |
| `CRON_SECRET`                       | Another random string                                        |
| `MS_TENANT_ID`                      | Entra ID, section 2                                          |
| `MS_CLIENT_ID`                      | Entra ID, section 2                                          |
| `MS_CLIENT_SECRET`                  | Entra ID, section 2                                          |
| `ALLOWED_USER_EMAIL`                | Your Microsoft 365 sign-in address                           |
| `SUPABASE_URL`                      | Supabase, section 1                                          |
| `SUPABASE_SERVICE_ROLE_KEY`         | Supabase, section 1                                          |
| `FIREBASE_SERVICE_ACCOUNT_JSON`     | Firebase, section 3                                          |
| `NEXT_PUBLIC_FIREBASE_CONFIG_JSON`  | Firebase, section 3                                          |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY`    | Firebase, section 3                                          |
| `WEATHER_PROVIDER`                  | `open-meteo`                                                 |

### 5.3 The 15-minute rain check - pick one

The rain check is an endpoint that something has to call every 15 minutes during the day.
`vercel.json` already asks Vercel Cron to do that (Mon-Sat, 8am-6pm UK, the app skips anything
outside those hours by itself).

- **Vercel Pro (about $20/month):** nothing to do, it just works. This is the simplest option.
- **Vercel Hobby (free):** Hobby only allows once-a-day cron jobs and the deploy will complain
  about the 15-minute schedule. Do this instead:
  1. Delete the `"crons"` block from `vercel.json` (leave `{}`), commit and push.
  2. Open `supabase/optional/pg_cron_scheduler.sql`, replace `YOUR-APP-DOMAIN` and `YOUR_CRON_SECRET`,
     paste it into the Supabase SQL editor and run it. Supabase now calls the endpoint every 15 minutes, free.

Either way you can test the check by hand from a terminal (replace the two values):

```bash
curl -H "x-cron-secret: YOUR_CRON_SECRET" "https://YOUR-APP-DOMAIN/api/cron/rain-check?force=1"
```

`force=1` ignores business hours and the repeat-alert cooldown, so you should get a push if it is
about to rain wherever the app decided to look (the response tells you where and why).

---

## 6. First run on the phone

1. Open the Vercel domain in **Chrome** on the Android phone and sign in with Microsoft.
   This first sign-in is what gives the background rain check its own key to read the calendar.
2. Go to **Settings > Enable alerts** and allow notifications. Then **Send test** - a notification
   should appear within a few seconds.
3. **Settings > Install on this phone** (or Chrome menu > Add to Home screen). Until the Play Store
   version exists, this installed PWA is the app.
4. **Gallery > Add photos** to upload your first few work photos.

If the Today screen shows "Microsoft sign-in needs renewing" at any point (Microsoft expires the
background key after 90 days of no use, or after a password change), just sign in again.

---

## 7. Changing things later

- **Prices:** Supabase > Table editor > `pricing_items`. Edit `price_pence` (in pence: 9000 = £90),
  `tier`, or set `active` to false to hide a row. The app reads this table live.
- **Home base / hours / lead time:** `app_settings` table, edit the JSON in `value`.
  `leadMinutes` is how far ahead to warn (30), `thresholdMm` is how much rain counts (0.1 mm per
  15 minutes = anything at all; raise it to 0.3 or so if drizzle alerts get annoying),
  `cooldownMinutes` stops repeat alerts for the same place (90).
- **Weather source:** to move to AccuWeather MinuteCast later, add a provider file in
  `src/lib/weather/`, register it in `index.ts`, and set `WEATHER_PROVIDER`. Nothing else changes.
