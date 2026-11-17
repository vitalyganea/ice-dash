# To do

## Move progress between Android and iPhone (transfer code)

**Unblocked:** Apple approved 1.2.9 on 15 Nov 2026 (see `store/app-store.md`).

Today the save goes to Play Games saved games on Android and to Game
Center/iCloud on the iPhone (`js/native.js`). A new phone of the same kind
gets everything back. A player moving from Android to an iPhone, or back,
keeps nothing. There are no real-money purchases (fish, skins and trophies
are all earned), so the whole save can move.

Chosen (owner, 11 Nov 2026): **a transfer code**. No account, no login, no
personal data.

- **Old phone:** Settings → "Move progress". The save goes up to the server
  and a short code comes back (e.g. `K7M-4QX`), good for 24 hours.
- **New phone:** Settings → "Have a code?". Type it in and see what the save
  holds (best, fish, skins). Confirm that it replaces this phone's progress,
  then load it and write it to the platform cloud as well. Each code works
  once.
- **Server:** Cloudflare Workers, free plan, on a `*.workers.dev` address.
  - The owner makes the free Cloudflare account.
  - Store saves in D1: 100,000 writes a day. KV allows only 1,000 a day.
  - Endpoints: `POST /transfer` (save in, code out) and
    `POST /transfer/<code>` (save out, then deleted).
  - Expiry: 24 h.
  - Rate-limit by IP.
  - Size cap on the save.
  - Codes avoid look-alike characters (0/O, 1/I/L).
- **In the game:**
  - Two buttons in Settings, on the native apps only (Yandex and CrazyGames
    have their own clouds).
  - Every word in all 6 languages (`js/i18n.js`).
  - Clear errors: code wrong or expired, no internet.
  - Merge rule: the incoming save replaces the old one after the
    confirmation, never silently.
- **Store paperwork:**
  - One sentence in `privacy.html` (game progress kept on our server for up
    to 24 h, only to move it).
  - The Play Data safety form and Apple's App Privacy: gameplay content, not
    linked to the player.
- **The no-external-requests rule:** CLAUDE.md forbids external requests.
  The transfer is the first one the page itself makes, so it goes in
  `js/native.js` only (the phone apps; Playables, Yandex and CrazyGames
  never load it), and CLAUDE.md gets that exception written down.
- **Release:** a new build for both stores (Android 1.3.0 / iOS 1.3.0; Android 1.2.9 and 1.2.10 went out on 12 Nov 2026 with the redrawn hill, 1.2.11 (versionCode 20) on 13 Nov).
- **Later:** the Godot version can use the same server and save format.

## Google Play achievements (and Game Center on the iPhone)

**Unblocked:** together with the transfer code above (Apple approved 1.2.9 on 15 Nov 2026).

The game's 33 lasting trophies (`ACHIEVEMENTS` in `js/achievements.js`)
become Play Games achievements. Each reads one number out of the save. The
13 daily tasks (`TASK_POOL`) change every day, so they stay in the game
only.

- **Plugin** (`PlayGamesPlugin.java`):
  - `achUnlock(id)`.
  - `achSteps(id, n)`, using setStepsImmediate so it can be repeated safely.
  - `achShow()` to open Play's own achievements list.
- **The game** (`js/native.js`, `PLAT.ach*`):
  - A trophy earned unlocks its achievement.
  - Counting trophies (e.g. `fish3000`, `jump50`, `smash50`) are
    incremental and send their steps, so Play shows the progress bar.
  - At the first start after the update, every trophy already in the save
    is sent, so existing players get theirs at once.
  - The Trophies panel gets a Play Games button (its words in all 6
    languages, plus a `.ios` twin for Game Center).
- **Mapping:** trophy id → Play achievement id, kept in `play-ids.xml` the
  way the leaderboard's is.
- **Play Console, one entry per achievement:**
  - Name and description in all 6 languages, from the trophies' own text in
    `js/i18n.js`.
  - A 512×512 icon drawn from the game's trophy art.
  - Points: at most 1000 in all, in steps of 5, split by each trophy's fish
    reward.
  - Incremental achievements: 2 to 10,000 steps.
  - Achievements cannot be deleted once published, so fix the list before
    publishing.
- **Release:** Android 1.3.0 (versionCode 21), together with the transfer
  code.
- **iPhone, same pass if wanted:**
  - Game Center achievements through `GameCenterPlugin.swift`, with the same
    calls.
  - App Store Connect: up to 100 achievements, 1000 points in all, 100 at
    most each.
