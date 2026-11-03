# App Store (the iPhone app)

What exists on Apple's side, what was decided, and what is left. The Android
side is in `play-console.md`; the code is described in `CLAUDE.md` (iPhone)
and SYSTEMS row 148.

## Account

| | |
|---|---|
| Program | Apple Developer Program, enrolled as an individual (the owner's legal name is the seller on the App Store) |
| Team ID | 6Q7DMJAPL4 |
| Paid | 3 Nov 2026, US$99 a year; renews 4 Nov 2027 |
| Active | 3 Nov 2026 (about half an hour after paying) |
| Bundle ID | `com.veetalea.icedash`, the same as on Android; registered 3 Nov 2026 (App ID 74T58DYCNT) with Game Center and iCloud (CloudKit option, no container: the save uses only the key-value store) |
| App Store Connect | app record created 3 Nov 2026: **"Ice Dash: Penguin Slide"** ("Ice Dash" is taken on the App Store; the owner chose this name), Apple ID 6830137061, primary language English (U.S.), SKU `icedash`, user access Full; version 1.0 waiting (to become 1.2.9 with the first build) |
| Terms | App Store Connect Terms of Service accepted by the owner, 3 Nov 2026 |

## Building without a Mac

Nobody here has a Mac. `.github/workflows/ios.yml` builds on GitHub's macOS
runners, free for this public repository: Debug for the simulator and
Release for a phone, both unsigned, then walks the Debug build on iPhone,
small iPhone and iPad simulators and keeps the pictures (artifact
`ios-walk`). Codemagic (500 free minutes a month) was the other choice; it
needs an account of its own, GitHub does not.

## Stage 1 (3 Nov 2026): done without the account

The project, the Game Center and iCloud plugin, the iPhone's ads and
tracking question, its words for the board, the privacy policy, the walk.
Version 1.2.9.

## Stage 2: needs the account (left to do)

1. ~~Identifiers~~: done 3 Nov 2026.
2. ~~App Store Connect record~~: done 3 Nov 2026.
3. ~~Game Center~~: done 3 Nov 2026, after an hour of "Sorry, something
   went wrong" (503s from App Store Connect for the new record, while
   Apple's status page said all was well). Classic leaderboard "Freeride",
   Leaderboard ID `freeride` (the id in `ios/ids.xcconfig`), Integer, best
   score, high to low, not hidden; names as the game's own mode names, with
   the game's word for points: English (U.S.) Freeride / point, points;
   Russian Фрирайд / очко, очков; Romanian Liber / de puncte (one suffix
   only there); Spanish (Mexico) Libre / puntos (one suffix); Spanish
   (Spain) Libre / punto, puntos; Portuguese (Brazil) Livre / ponto, pontos;
   German Freie Fahrt / Punkt, Punkte. "Prepare for Submission": it goes
   for review with the first version.
4. ~~API key~~: done 3 Nov 2026. The owner asked for API access (approved
   at once), made an Admin key "GitHub Actions" and put it in the
   repository's secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`.
   Keys are never typed here.
5. ~~AdMob~~: done 3 Nov 2026. iOS app "Ice Dash: Penguin Slide" (not yet
   linked to a store; AdMob reviews it once the App Store listing is live
   and linked in its App settings), app id `ca-app-pub-6104904420104536~5953442824`
   in `ios/ids.xcconfig`; rewarded unit "Revive and double" (1 Reward, no
   partner bidding) `ca-app-pub-6104904420104536/8308143427` in
   `AD_UNIT_IOS`. The EU consent message (Privacy & messaging → European
   regulations) now covers both apps, the iOS one with the same privacy
   policy URL; the owner clicked "Publish changes" (the classifier stops
   that click here). app-ads.txt (https://vitalyganea.github.io/app-ads.txt)
   already lists the publisher id; AdMob finds it through the store
   listing's website, so the App Store listing's Marketing URL must be
   `https://vitalyganea.github.io/ice-dash/` (stage 3).
6. `.github/workflows/ios-release.yml` (by hand: Actions → iOS release):
   archives unsigned, signs the frameworks and the app ad hoc with the
   entitlements written out in full, then `-exportArchive` signs with
   Apple's cloud-managed certificate and uploads (no certificate made per
   run or kept anywhere). The build number is the workflow's run number.

## Submitted (3 Nov 2026, about 17:10 Chișinău time)

Version 1.2.9 with build 5 and the Game Center leaderboard Freeride, one
submission ("2 Items Submitted"), state WAITING_FOR_REVIEW; release
automatically once approved. The owner clicked "Submit for Review" (the
classifier stops that click here, as it stops Play's and AdMob's publishing).

What the submission holds:
- Listing in English (U.S.), Romanian, Russian, Spanish (Spain and Mexico),
  Portuguese (Brazil), German (`app-store-listing.md`): name, subtitle,
  description, keywords, promotional text, support and marketing URL,
  privacy policy URL in every language, copyright "2026 Vitalie Ganea".
- Screenshots: 8 for the iPhone (6.1/6.3-inch, 1206x2622, which App Store
  Connect now asks for and scales to the other iPhones) and 8 for the
  13-inch iPad (2064x2752) in each language, from `store/promo.js`
  (PROMO_FORMAT=iphone|ipad, the iPhone set shrunk from 1320x2868).
- Category Games (Casual, Action); price free; 175 countries or regions.
- Age rating 4+ (all None or No; Advertising Yes; not Made for Kids).
- Content rights: uses third-party content (the ads), with the rights (the
  owner's answer).
- App Privacy, published by the owner: Coarse Location, Device ID, Product
  Interaction, Advertising Data (third-party advertising, analytics), Crash,
  Performance and Other Diagnostic Data (analytics); none linked to the
  user, none used for tracking ("Data Not Linked to You").
- App Review contact: the owner, zzzvitalii@gmail.com; sign-in not
  required; a note on the ads, the board and the iCloud save.

Left: the EU trader declaration (Business → DSA). Its phone/email check
stopped at "Too many verification codes have been sent" on 3 Nov; until it
is done the app is not on the 27 EU storefronts. The address there reads
"Dacia 34\1" and should read "Dacia 34/1" (shown publicly to EU users).

## Stage 3: the store

Listing in six languages from `listing.md` (name 30 characters, subtitle
30, keywords 100, description), screenshots for the 6.9" iPhone and the
13" iPad from the game itself, an app preview from the 30 s gameplay clips
(App Store previews may show only the app, so not the trailer), App Privacy
answers (as Play's Data safety: AdMob's data for advertising, analytics and
fraud prevention; the score to Game Center), age rating, the EU trader
declaration (the owner confirms), then the owner's "Submit for Review".

## Builds

| Version | Build | Sent | Notes |
|---|---|---|---|
| 1.2.9 | 1 | 3 Nov 2026 11:57 UTC, `ios-release.yml` run 1 | the first: "Upload succeeded"; the only warning, no dSYM inside Google's own frameworks (they ship none). Ad hoc entitlements seen in the log (Game Center, key-value store) before Apple's signing |
| 1.2.9 | 2 | 3 Nov 2026, run 2 | the app's own AdMob app id and rewarded unit (real ads) |
| 1.2.9 | 3 | 3 Nov 2026, run 3 (second attempt: the first stopped at "Error Downloading App Information" from App Store Connect, a passing fault) | the hill no longer trembles (SYSTEMS row 149); the iPhone starts at Auto graphics |
| 1.2.9 | 4 | 3 Nov 2026, run 4 | Low sharpness on the iPhone never under half the screen's density (SYSTEMS row 150) |
| 1.2.9 | 5 | 3 Nov 2026, run 5 | no tracking question, NSUserTrackingUsageDescription gone (SYSTEMS row 151); the build to submit |
