# To do

## Move progress between Android and iPhone (transfer code)

**Status (22 Nov 2026):** not started. Nothing blocks it: 1.3.4 is in review
in both stores (Android versionCode 26, iOS build 15; see `store/`). It needs
the owner's free Cloudflare account first.

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
- **Release:** the next version after 1.3.4 (1.3.5, Android versionCode 27+),
  in both stores, together with the shared leaderboard and the achievements
  below, since all three use the same server or release.
- **Later:** the Godot version can use the same server and save format.

## Google Play achievements (and Game Center on the iPhone)

**Status (22 Nov 2026):** not started. It can go out with the transfer code above.

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
- **Release:** the same version as the transfer code (1.3.5, Android
  versionCode 27+).
- **iPhone, same pass if wanted:**
  - Game Center achievements through `GameCenterPlugin.swift`, with the same
    calls.
  - App Store Connect: up to 100 achievements, 1000 points in all, 100 at
    most each.

## One leaderboard for Android and iPhone together

Asked for by the owner, 22 Nov 2026. Today the Freeride board is two boards:
Play Games on Android, Game Center on the iPhone (`js/native.js`, `PG`).
Neither service can show the other's players, so a shared board needs a
server of our own. The game's own board panel already draws the rows
(`PLAT.boardTop`, `PLAT.boardMine`, the cards board), so only where the
rows come from changes. The look stays.

- **Server:** the same Cloudflare Worker and D1 as the transfer code above
  (one free account, one deploy).
  - `POST /score`: score, profile card code, platform and identity proof.
  - `GET /top?span=day|week|all`, `GET /me`.
  - Keep each player's best of the day, the week and all time, as the native
    boards do (the reset of 18 Nov 2026).
  - Rate-limit by player and IP.
- **Proof of who sends it** (no fake scores in someone else's name):
  - iPhone: Game Center `fetchItems(forIdentityVerificationSignature:)` in
    `GameCenterPlugin.swift`. The Worker checks the signature against Apple's
    public key.
  - Android: Play Games `requestServerSideAccess` in `PlayGamesPlugin.java`.
    The Worker exchanges the code with Google for the player id.
- **Plausibility checks:** refuse a score that is impossible for the run's
  length (distance / time above the top speed), plus the run's seed and
  duration with the score.
- **In the game:**
  - `native.js` sends the best and the card to the server as well as to the
    native board, which stays as a backup (and for Game Center
    achievements).
  - The panel reads the shared rows, with a platform icon next to each name.
  - If the server can't be reached, fall back to today's native rows.
- **Old scores:** they can't be copied out of the native boards. Each player
  shows up with their saved best the first time they sync (the game sends it
  from the save), so nothing is really lost.
- **Known gap:** someone who plays on both phones appears twice. Leave it for
  later; the transfer code could link the two ids.
- **Optional:** the web builds (CrazyGames, Yandex) could join the same
  board.
- **Paperwork:**
  - `privacy.html`: nickname and scores kept on our server for the
    leaderboard.
  - Play Data safety and Apple's App Privacy: user ID and gameplay content,
    linked to the player, used for app functionality.
  - CLAUDE.md: the no-external-requests rule gets this exception, `native.js`
    only, as with the transfer code.
- **Effort:** about 2–3 days with tests.
- **Release:** 1.3.5 with the transfer code (Android versionCode 27+, iOS from
  GitHub Actions → iOS release).
- **Owner first:** a free Cloudflare account, then `npx wrangler login`.

## Make the avatars more real (second pass)

Asked for by the owner, 21 Nov 2026, after the first pass of 1.3.4 (eyes,
fur and feathers, a head shape of its own for each kind, real flippers and
paws, the narwhal turned three-quarters). Everything is in `js/portraits.js`.
Check each one afterwards as the narwhal was checked: big (600 px), one part
at a time (eyes, head, muzzle or bill, ears, limbs, body, the kind's own
marks), against the real animal. The musk ox stays as it was in 1.3.3 (the
owner did not like the new horns).

First, the shared painting (it changes every avatar at once, ~1–1.5 h):

1. **Light and shadow.** One light from the side for all of them: shadow
   under the brows, the muzzle and the chin; a warm shadow where the head
   meets the body; cool light bounced up from the snow under the face.
2. **Fur in layers.** Short on the face, longer on the cheeks and neck,
   long on the shoulders; strands laid the way they grow (from the nose
   back to the ears, then down the neck); the outline of a furred head made
   of strands breaking its edge, not a smooth line.
3. **Livelier eyes.** The sky or a window reflected in them, a wet corner,
   and the dark rim of the lid on the mammals.

Then each kind (~2–3 h):

4. **Noses:** the grain of wet nose leather (cats, hare), nostrils with depth.
5. **Whiskers from their roots:** seal, leopard, otter and hare — rows of
   whisker pads, each whisker thinning to its tip.
6. **Inside the ears:** hare, leopard, reindeer, lemming — thin skin, fine
   veins on the hare's, hairs coming out of the ear.
7. **Penguins' feathers by zone:** small on the face, larger on the chest;
   on the emperor and the king, the orange fading to yellow down the neck.

Optional (~45 min):

8. **A soft background with depth** (out-of-focus snow or sky), so the
   avatar looks photographed, not cut out.
9. **Colour in the fur:** lighter at the tips, darker at the roots, subtle
   patches, not one gradient a zone.
