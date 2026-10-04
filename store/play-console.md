# Google Play Console — how Ice Dash was published

The steps as they were actually done (4–5 October 2026), with every answer
given, so the next release or a new app can follow them. Texts and graphics
are in `listing.md`.

## The app

| | |
|---|---|
| App id | `com.veetalea.icedash` (permanent) |
| Type | Game, free, category Arcade |
| Privacy policy | https://vitalyganea.github.io/ice-dash/privacy.html (`privacy.html` at the repo root, GitHub Pages from `/ (root)`) |
| Contact email | zzzvitalii@gmail.com |
| Upload key | `C:\Users\Vital\.icedash-signing\` — outside git, back it up |

## App content declarations (Dashboard → "Set up your app")

| Section | Answer |
|---|---|
| Privacy policy | the URL above; the Android app also links it from Settings (`js/native.js`) |
| Sign in details (App access) | No — nothing is restricted |
| Ads | No |
| Advertising ID | No (the build has only INTERNET and VIBRATE) |
| Content rating | category Game, No to every question → PEGI 3, ESRB Everyone, IARC 3+ |
| Target audience | 13–15, 16–17, 18+ (no under-13s, so the Families rules do not apply) |
| Data safety | No data collected or shared (the save never leaves the phone) |
| News, Government, Financial features, Health | No |
| Store settings | category Arcade, contact email above |
| AI asset declaration | Don't label assets |
| Form factors | Google Play Games on PC opted out; Android XR left on |

## Releases

| Release | versionCode | Track | Status |
|---|---|---|---|
| 1.0.1 | 2 | Closed testing "1.0" | approved 5 Oct 2026 |
| 1.0.2 | 3 | Closed testing "1.0" | built 5 Oct 2026: edge to edge for Android 15 |

versionCode 1 was uploaded once and withdrawn; every new upload needs a higher
number (`android/app/build.gradle`). The next one is **4**.

To build: `bash build-android.sh`, `npx cap sync android`, then in `android/`
`./gradlew bundleRelease` with `JAVA_HOME` set to JDK 21. The bundle is
`android/app/build/outputs/bundle/release/app-release.aab`.

Uploading: Test and release → Closed testing → track → Create new release
(or Edit release) → upload or "Add from library" → Next → **Save** — and
check the release no longer says "Draft" — then Publishing overview →
Submit changes for review. The deobfuscation-file warning can be ignored
(the code is not minified).

## Testers

- Closed testing needs **12 testers opted in for 14 days in a row** before
  "Apply for production" (Dashboard) unlocks.
- Only Gmail accounts on the list **QA Ice Dash** can join. Google sends them
  nothing: add the address, then send them the opt-in link yourself
  (`https://play.google.com/apps/testing/com.veetalea.icedash`).
- On the phone, logged in with that same account, Play shows
  "Install (early access)". If no install button appears, open the link in
  Chrome rather than the Play app.
- A Google Group as the tester list saves collecting addresses: anyone who
  joins the group can opt in.
- Testers must be real people; fake accounts can close the developer account.

## Plan (agreed 5 October 2026)

1. **Android to production.** 1.0.2 (edge to edge for Android 15) on the
   closed track; 12 testers for 14 days; then "Apply for production".
2. **Leaderboards (1.1).** Google Play Games Services, Android only through
   `native.js`: Freeride distance, Time Rush score, Daily Line (the same line
   for everyone, so a fair daily board); the weekly span is the "season".
   Optionally the 30 trophies as Play achievements. Needs the Play Games
   project, leaderboard ids and OAuth with both SHA-1 fingerprints (upload
   key and Play app signing key) — the usual place it goes wrong. Testable
   only on a real phone. Update Data safety and the privacy policy.
3. **Ads (1.2), if wanted.** Android only, rewarded ads at the revive and
   results screens, EU consent (UMP); Ads = Yes, Advertising ID = Yes, Data
   safety and the privacy policy updated. Playables stays ad-free.
4. **iOS, once Android has players.** `npx cap add ios`, the same game files;
   `native.js` without the back button. Needs a Mac with Xcode (or a cloud
   build such as Codemagic or GitHub Actions on macOS) and an Apple Developer
   account at $99 a year; testing through TestFlight.

The web version keeps running throughout. It can also be served from an
own server: the files from `build.sh` behind any web server with HTTPS.
