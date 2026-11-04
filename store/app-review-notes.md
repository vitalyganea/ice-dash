# App Review notes (App Store Connect → version → App Review Information → Notes)

Asked for by App Review on 4 Nov 2026 (Guideline 2.1, Information Needed,
submission 7f4c339f): a screen recording from a real device plus answers 2-6.
Fill in the two [brackets] before pasting. The recording is made with a
test-ads build (`ios-release.yml`, test_ads), which is never submitted.

---

Ice Dash: Penguin Slide is a casual one-tap arcade game. There is no account, no sign-in and no in-app purchase.

1. Screen recording: [VIDEO LINK]
Recorded on an iPhone 13 running iOS [VERSION], starting from the app's launch: the ad consent form, the menu, a Freeride run, a crash and the optional rewarded video to continue, the results and the Game Center leaderboard, a Known Lines course, the Fish Market and Settings. It was made with TestFlight build 1.2.9 (6), which is the submitted build 5 except that it plays Google's test ads, so that the rewarded video could be shown: AdMob limits real ads for this iOS app until it is on the App Store.

2. Purpose and audience: a short-session arcade game for players of any age (rated 4+). A penguin slides down an endless snowy hill and the player taps anywhere to switch direction, dodging trees, rocks and crevasses and catching fish. It offers quick, skill-based fun for short breaks, and it plays offline.

3. How to use it: open the app and tap Play. No setup, login or sample files are needed. Tap anywhere to turn. Modes in the menu: Known Lines (10 handmade courses with three stars each), Freeride (the endless hill; scores go to the Game Center leaderboard "Freeride"), Time Rush, Daily Line and Avalanche. Fish caught on the hill buy 18 creatures in the Fish Market. Settings has language, sound and graphics. After a crash the player may choose to watch a rewarded video to continue, or to double the fish of a run; no ad is ever shown otherwise. Note: AdMob limits ads for this iOS app until it is on the App Store and linked in AdMob, so your device may get no ad. When no ad is loaded the game simply hides those two offers and goes on as usual; nothing is locked behind an ad.

4. External services: Google AdMob (Google Mobile Ads SDK) for the optional rewarded videos, with Google's User Messaging Platform for the consent form where the law requires one; Apple Game Center for the Freeride leaderboard (the game works without Game Center); Apple iCloud key-value storage to keep progress across the player's devices; Apple's in-app rating prompt. No payment processor, AI service, data provider or server of our own.

5. Regional differences: none in features or content; the app works the same in every region. Only the ad consent form appears where the law requires it (such as the EEA, the UK and Switzerland), and the text follows the device language (English, Russian, Romanian, Spanish, Portuguese, German).

6. The app is not in a regulated industry. All game content (art, music, sounds, text, code) is original, made by the developer. The only third-party content is the ads served by Google AdMob under AdMob's terms.
