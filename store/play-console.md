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
| Upload key | `C:\Users\Vital\.icedash-signing\` on Windows, `~/.icedash-signing/` on Linux — outside git, back it up. SHA-1 `B5:D4:14:38:4A:00:E2:1D:64:C0:A3:B1:06:02:03:22:E2:C0:FB:7D` |

## App content declarations (Dashboard → "Set up your app")

| Section | Answer |
|---|---|
| Privacy policy | the URL above; the Android app also links it from Settings (`js/native.js`) |
| Sign in details (App access) | No — nothing is restricted |
| Ads | No; **Yes from 1.2.0** (rewarded ads, see "Ads and the leaderboard") |
| Advertising ID | No up to 1.1.4 (INTERNET and VIBRATE only); **Yes from 1.2.0**: the AdMob SDK adds AD_ID — purposes Advertising or marketing, Analytics, Fraud prevention |
| Content rating | category Game, No to every question → PEGI 3, ESRB Everyone, IARC 3+ |
| Target audience | 13–15, 16–17, 18+ (no under-13s, so the Families rules do not apply) |
| Data safety | No data collected or shared up to 1.1.4 (the save never leaves the phone); **from 1.2.0** the answers under "Ads and the leaderboard" |
| News, Government, Financial features, Health | No |
| Store settings | category Arcade, contact email above |
| AI asset declaration | Don't label assets |
| Form factors | Google Play Games on PC opted out; Android XR left on |

## Releases

| Release | versionCode | Track | Status |
|---|---|---|---|
| 1.0.1 | 2 | Closed testing "1.0" | approved 5 Oct 2026 |
| 1.0.2 | 3 | Closed testing "1.0" | built 5 Oct 2026: edge to edge for Android 15 |
| 1.1.0 | 4 | Closed testing "1.0" | approved 20 Oct 2026: comics, economy, new icon, cave, timers (everything up to cc65ae6) |
| 1.1.1 | 5 | Closed testing "1.0" | built 21 Oct 2026: Market fits narrow phones; fixed screens zoom to fit instead of scrolling |
| 1.1.2 | 6 | Production (first) | **published 22 Oct 2026 about 11:12**, an hour after it was sent for review (10:16, submission 6), full rollout, 178 countries and regions; built on Linux, checked on an Android 15 emulator: panels change shape before they shrink, comic buttons, Romanian letters, plurals (everything up to 5b42dab) |
| 1.1.3 | 7 | Production | built and uploaded 22 Oct 2026: one picture per step, so a 90 or 120 Hz phone no longer paints every picture twice (reported stutter after about five minutes of play) |
| 1.1.4 | 8 | Production | built 22 Oct 2026: the hill changes stretch without a stall (reported slowdown each time the map changed in Freeride) |
| 1.2.0 | 9 | Production | in progress 23 Oct 2026: rewarded ads (a revive with no spare life, double the fish) and the Freeride board on Play Games; Play's review card; silent behind the lock screen (the music used to play on); the hill half again as fast on a slow phone (no clip to the ice, plants from pictures, SYSTEMS rows 134-135); Graphics in Settings (effects and sharpness, Auto by default). **Internal testing 27 Oct 2026 16:16** (list "Internal testers": the owner and one more address; opt-in https://play.google.com/apps/internaltest/4701354801625932493). Play Games project 378437852809 on Cloud project `ice-dash-512913`, OAuth consent in production, Android credential with the app signing SHA-1 `E4:C6:8C:…:7E:A3`, board Freeride `CgkIib2d5YELEAIQAQ`, all published 27 Oct. Sent for review 27 Oct 2026 (9 changes): Ads and Advertising ID = Yes, Data safety, store listing in six languages (name "Ice Dash" in each), tags Arcade, Casual, Hyper-casual, Runner |

Applied for production access on 19 Oct 2026; granted by 22 Oct 2026
(Dashboard: "Congratulations! Your game has been granted Google Play
production access"). Open testing is open too. Production stays "Inactive"
until a release is rolled out there: Dashboard → Create and publish a release
→ Select countries and regions, then Create a new release.
Done on 22 Oct 2026: all 177 countries plus rest of world, then 1.1.2 with
release notes in en-US only — the store listing had no other language yet,
and Play refuses notes for a language the listing lacks ("Unsupported
language translation found"). Managed publishing is off, so the release went
live by itself once approved: https://play.google.com/store/apps/details?id=com.veetalea.icedash

versionCode 1 was uploaded once and withdrawn; every new upload needs a higher
number (`android/app/build.gradle`). The next one is **9** (1.2.0, being prepared).

To build: `bash build-android.sh`, `npx cap sync android`, then in `android/`
`./gradlew bundleRelease` with `JAVA_HOME` set to JDK 21. The bundle is
`android/app/build/outputs/bundle/release/app-release.aab`. It is signed only
if `android/keystore.properties` (git-ignored) points at the upload key; on
Linux: `storeFile=/home/vitaliy/.icedash-signing/upload.jks`, JDK 21 in
`~/.local/jdk-21`, and `bash ./gradlew` (the script is not executable there).
Check the signer before uploading: `keytool -printcert -jarfile` on the
bundle must show the SHA-1 above.

Uploading: Test and release → Closed testing → track → Create new release
(or Edit release) → upload or "Add from library" → Next → **Save** — and
check the release no longer says "Draft" — then Publishing overview →
Submit changes for review. The deobfuscation-file warning can be ignored
(the code is not minified).

## Ads and the leaderboard (1.2.0)

What the app does is in SYSTEMS.md row 131. What has to be set up outside
it, once, with the same Google account as Play Console:

**AdMob** (admob.google.com)
1. Create the AdMob account (country, time zone, currency). Payment details
   can wait until the first payout threshold.
2. Apps → Add app → Android → listed on a store: Yes → find
   `com.veetalea.icedash` → Add. AdMob reviews the app (a few days); until
   then ads are limited.
3. App settings → **App ID** (`ca-app-pub-…~…`) → `admob_app_id` in
   `android/app/src/main/res/values/play-ids.xml`.
4. Ad units → Add ad unit → **Rewarded** ("Revive and double", reward 1 ×
   "reward") → its **ad unit id** (`ca-app-pub-…/…`) → `AD_UNIT` in
   `js/native.js`.
5. Privacy & messaging → **European regulations (GDPR)** → create a message
   for Ice Dash in the six languages → Publish. Without a published message
   there are no ads at all: found on the emulator (26 Oct 2026, the real App
   ID, no message yet), the consent check fails outright ("no form(s)
   configured for the input app ID"), and `native.js` asks for no ad until
   it has an answer. Publish it before the build goes to Play.
6. **app-ads.txt** — AdMob verifies the app through it (added 23 Oct 2026,
   "We couldn't verify Ice Dash"; publisher id `pub-6104904420104536`). It
   must sit at the root of the developer website named in the Play listing,
   and the Play listing had none. The site is the GitHub user site: a public
   repository named exactly `vitalyganea.github.io` with one file,
   `app-ads.txt`:
   `google.com, pub-6104904420104536, DIRECT, f08c47fec0942fa0`
   (served at https://vitalyganea.github.io/app-ads.txt; the project site
   with the privacy policy stays at /ice-dash/). On 26 Oct 2026 the live
   listing named `https://vitalyganea.github.io/ice-dash/` as its website;
   app-ads.txt is read from the root of that host, so the repository is all
   it takes (the Website may also be set to the bare host). In AdMob, a day
   later, Apps → app-ads.txt → Check for updates (Google says up to 7 days).

**Play Games Services** (Play Console → Grow users → Play Games Services)
1. Setup and management → Configuration → "No, my game doesn't use Google
   APIs" → create the Play Games project. Its **project id** (digits) →
   `game_services_project_id` in `play-ids.xml`.
2. Credentials → Add credential → Android: the OAuth consent screen first
   (app name, support email), then an Android OAuth client for
   `com.veetalea.icedash` with the SHA-1 of the **app signing key** (Test
   and release → App integrity → App signing). A second one with the upload
   key's SHA-1 (above) lets a build signed here sign in too.
3. Leaderboards → Add leaderboard: **Freeride**, numeric, no decimals,
   larger is better → its **leaderboard id** (`CgkI…`) →
   `leaderboard_freeride` in `play-ids.xml`.
4. Testers: add the testers' accounts; then Review and publish the Play
   Games configuration (it can go out before the app does).

**Play Console declarations, with 1.2.0**
- App content → Ads: Yes. Advertising ID: Yes (above).
- Data safety (from Google's own disclosure pages for the Mobile Ads SDK and
  Play Games Services; the developer answers for them): data is collected,
  all encrypted in transit, no account creation in the app.
  - Location → Approximate location (IP), App activity → App interactions,
    App info and performance → Diagnostics, Device or other IDs: collected
    and shared, for Advertising or marketing, Analytics, Fraud prevention.
    Not optional.
  - App activity → Other actions (the Freeride score sent to Play Games):
    collected, not shared, for App functionality. Optional (only when
    signed in to Play Games).
  - The review card (SYSTEMS.md row 132) adds nothing: the rating goes
    straight to Google Play under Play's own terms, and the app never
    receives it (Google's In-App Review page: user-entered data, used for a
    review on the Play Store).
- Privacy policy: `privacy.html` describes all three (ads, board 23 Oct,
  review card 26 Oct 2026); it must be live on GitHub Pages before 1.2.0 is.
- Store listing: the texts in `listing.md`, rewritten for search on 26 Oct
  2026 (name, short and full description in all six languages). The ones
  live until then say "no ads, no data collected", which 1.2.0 ends. Add
  the five translations first: only then can 1.2.0 have release notes in
  all six languages.

Until the ids are in, a build plays Google's test ads and has no board; a
build sent to Play must have all four.

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
