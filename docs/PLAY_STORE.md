# Google Play packaging (Trusted Web Activity)

Do this once the app is deployed on Vercel and you have used it for a few days as an installed PWA.
The Play Store version is the same web app in an Android wrapper made with Google's Bubblewrap tool.

## What you need

- A Google Play Developer account ($25 one-off): https://play.google.com/console
- Java JDK 17 and the Android SDK. Bubblewrap offers to download both the first time you run it.
- Node.js (already installed on this PC).
- Your live app domain (for example `central.detailingsanctuary.co.uk`).

## 1. Install Bubblewrap

```bash
npm install -g @bubblewrap/cli
```

Bubblewrap 1.25 (checked September 2026) builds against **Android 16 / API level 36**
(`compileSdkVersion 36`, `targetSdkVersion 36`), which is what Google Play now requires. After the
first build, confirm by opening `android/app/build.gradle` and checking both numbers read 36. If a
future Bubblewrap version ever drops below that, change them to 36 there.

## 2. Create the Android project

`android/twa-manifest.json` is pre-filled. Replace every `REPLACE-WITH-YOUR-APP-DOMAIN` with your real
domain, then:

```bash
cd android
bubblewrap init --manifest=https://YOUR-APP-DOMAIN/manifest.webmanifest
```

Accept the defaults it reads from the file. When asked to create a signing key, say yes and choose a
password - **write it down**, and keep `android.keystore` somewhere safe outside the project. Losing it
means you can never update the app on Play.

## 3. Build

```bash
bubblewrap build
```

This produces `app-release-bundle.aab` (for Play) and `app-release-signed.apk` (for sideloading onto
your phone to try it: `adb install app-release-signed.apk`, or copy the file over and open it).

## 4. Digital Asset Links (removes the browser bar)

Android only shows the app full screen if the website says "yes, this Android app is mine".

1. Play Console > your app > **Setup > App signing** > copy the **SHA-256 certificate fingerprint**
   under "App signing key certificate". (For the sideloaded APK, use the fingerprint Bubblewrap
   prints, or `bubblewrap fingerprint list`.)
2. Put it into `public/.well-known/assetlinks.json` in this project replacing the placeholder,
   commit and push so Vercel redeploys.
3. Check it: https://YOUR-APP-DOMAIN/.well-known/assetlinks.json must load as JSON.

## 5. Play Console listing

Create the app in Play Console (**Create app**, Android, Free). Things it will ask for:

- **App icon** 512x512 (no transparency): `assets/store/play-icon-512.png`.
- **Feature graphic** 1024x500: `assets/store/feature-graphic.png`
  (rebuild with `node scripts/make-feature-graphic.mjs` if the logo or shield changes).
- **Phone screenshots** (at least 2): take them on the phone from the installed app.
- **Privacy policy URL**: reuse https://detailingsanctuary.co.uk/privacy-policy.html (Play requires one
  even for a private app).
- **Data safety form**: the app collects the owner's calendar data and location of jobs (derived from
  addresses, not device GPS), stored in Supabase, not shared. No device GPS permission is requested.
- **Release**: Internal testing track first. Upload the `.aab`, add your own Google account as a
  tester, install from the testing link. Promote to Production when happy.

## 6. Updating later

Bump `appVersionCode` (whole number, +1 each time) and `appVersionName` in `android/twa-manifest.json`,
then `bubblewrap update` and `bubblewrap build`, upload the new `.aab`. Web changes deploy through Vercel
without a new Play release - the wrapper just loads the live site.
