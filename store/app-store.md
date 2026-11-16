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

EU trader declaration (Business → DSA): the trader route's phone check
never got through (3 Nov: "Too many verification codes have been sent";
9 Nov: the SMS to the Moldovan number never arrived). On 9 Nov 2026 the
owner declared "I'm not a trader under the DSA"; Business → Compliance
shows Digital Services Act, 27 countries, Active. A declared status keeps
the app on the EU storefronts (only apps with no status are removed), with
no contact details shown. The owner may switch to trader later from the
same row, once the SMS arrives (the form already holds "Dacia 34/1", Chisinau
2060 and the email; the phone is left).

Answered on 4 Nov 2026, 1:00: Guideline 2.1, Information Needed (shown as
"Rejected, 2.1.0 Performance: App Completeness"; the leaderboard stays Ready
for Review). Apple wants, in the App Review notes, a screen recording from a
real device beginning at the app's launch, plus the app's purpose, how to
use it, its outside services, regional differences and third-party
content: `app-review-notes.md`. Then the owner clicks "Resubmit to App
Review".

AdMob shows the iOS app as "Requires review, Limited ad serving: add store
to lift limit", so the iPhone gets almost no real ads until the app is live
and linked in AdMob (Apps → the iOS app → Add store). With no ad loaded the
game hides the revive and double offers, as on Android.
For the recording the owner installs a TestFlight build made with
`ios-release.yml`'s test_ads box (AD_UNIT_IOS emptied, Google's test unit,
which always has an ad); the version keeps build 5.
Resubmitted 4 Nov 2026 10:09 UTC by the owner, state WAITING_FOR_REVIEW:
the notes from `app-review-notes.md` (set through App Store Connect's own
API from the page) and the recording attached (720x1558 H.264, 50 MB, 6.5
minutes, made from the phone's 730 MB HEVC file).
Still WAITING_FOR_REVIEW on 11 Nov 2026 (seven days, no message from Apple).
That day the owner asked App Review about it (developer.apple.com/contact →
App Review → App Review Status → Email), case 30000011995418; the answer comes
by email to the account's address.
Still WAITING_FOR_REVIEW on 13 Nov 2026 (nine days since the resubmission): no new
message on the submission, history unchanged since 4 Nov 12:09, the Free Apps
Agreement and the DSA row both Active, so nothing on the account holds it.
**Approved 15 Nov 2026**: In Review 18:43, Ready for Distribution 18:58
(Chișinău time), eleven days after the resubmission, without a word on the
case. Released at once (automatic release), live on the App Store:
https://apps.apple.com/us/app/ice-dash-penguin-slide/id6830137061 (checked
16 Nov: free, 4+, Casual, 12.5 MB, iOS 15+, Game Center leaderboard).
Left after it:
- AdMob: linked to the store listing 16 Nov 2026 (the owner clicked Add and
  Save; found by the listing's URL, not its numeric ID). Verification of
  app-ads.txt failed at first ("your details don't match"), though the file
  at https://vitalyganea.github.io/app-ads.txt has the right line and the
  listing's seller URL is https://vitalyganea.github.io/ice-dash/, the same
  domain that verified the Android app: AdMob's crawler had not caught up.
  Status "Verify app to lift limit"; check again a day later.
- The store page lists the languages as English only: the build declares no
  localizations (CFBundleLocalizations in Info.plist), though the game
  speaks six. Add them in the next build.
- 1.2.9 on the iPhone is the game as of 3 Nov, before the hill was redrawn
  (Android 1.2.9-1.2.11); the next iOS build should carry 1.2.11, and the
  listing's "crystal rings" become the arcs of leaping fish.

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
| 1.2.9 | 6 | 4 Nov 2026, run 6, test_ads | build 5 with Google's test ads, for App Review's screen recording only; never submitted |

## 1.2.11 (prepared 16 Nov 2026)

The game as on Android 1.2.11 (commit 554f6d3: MARKETING_VERSION 1.2.11 and
an InfoPlist.strings in six languages so the store lists them). Version
1.2.11 created in App Store Connect 16 Nov, Prepare for Submission, with
What's New, the promotional text (a new version starts with it empty) and
the description's crystal rings turned to arcs of leaping fish, in all
seven localizations (`app-store-listing.md`), each saved and the page
reloaded between languages. The owner added this machine's SSH key to the
GitHub account on 16 Nov (the remote is now git@github.com:vitalyganea/
ice-dash.git, so pushes go from here); pushed, then `ios-release.yml` run 7
(3 min 24 s), **build 7**, processed by Apple as Ready to Submit, chosen on
the version page and saved. The App Review notes now open with a line on
the update and say the recording was attached to 1.2.9 (a new version does
not carry the attachment over). Release: automatically, to all users at
once. **Sent for review by the owner, 16 Nov 2026**: 1.2.11 Waiting for Review
(1.2.9 stays live meanwhile).
The same morning the owner saw iOS's magnifier on a held tap (SYSTEMS row
165); fixed in commit 3c12e32, `ios-release.yml` run 8, **build 8**. 1.2.11
removed from review (Developer Rejected, at the owner's word), build 7
taken off the version, build 8 chosen and saved; texts and notes unchanged.
Left: "Add for Review", then Submit, again.
