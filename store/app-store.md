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
| Bundle ID | `com.veetalea.icedash`, the same as on Android |

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

1. Identifiers: register `com.veetalea.icedash` with Game Center and iCloud
   (the app's entitlements ask for both).
2. App Store Connect: the app's record (name "Ice Dash", or a variant if the
   name is taken; primary language English; SKU `icedash`).
3. Game Center: a classic leaderboard, Leaderboard ID `freeride` (the id
   already in `ios/ids.xcconfig`), score "integer", sorted high to low, in
   all six languages.
4. An App Store Connect API key for the signing build on GitHub: made by
   the owner (Users and Access → Integrations), put in the repository's
   secrets by the owner. Keys are never typed here.
5. AdMob: an iOS app and a rewarded unit; the app id goes in
   `ios/ids.xcconfig`, the unit in `AD_UNIT_IOS` (`js/native.js`).
6. A workflow that signs, uploads to TestFlight and numbers the builds.

## Stage 3: the store

Listing in six languages from `listing.md` (name 30 characters, subtitle
30, keywords 100, description), screenshots for the 6.9" iPhone and the
13" iPad from the game itself, an app preview from the 30 s gameplay clips
(App Store previews may show only the app, so not the trailer), App Privacy
answers (as Play's Data safety: AdMob's data for advertising, analytics and
fraud prevention; the score to Game Center), age rating, the EU trader
declaration (the owner confirms), then the owner's "Submit for Review".
