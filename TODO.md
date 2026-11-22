# To do

## Order for the global launch (owner, 22 Nov 2026)

Most critical first. 1.3.5 = items 1–8, then the server items, then the rest.
Every new item gets its place here when it is added (rule in CLAUDE.md);
work always starts at the top.

1. The close button under a player's card (minutes).
2. No vibration on a golden fish (minutes, ships with 1).
3. Crash and error reporting (below).
4. Visual quality: text that fits, translations, the palette and contrast
   (the brand book's core) and the avatars evened out, with a visual-QA
   skill to keep it so.
5. Review every mode: the bugs part first.
6. A better performance test, on many devices.
7. Economy: upgrades cost more, fewer golden fish (before many new players
   arrive, never after).
8. Store listings and SEO/ASO in every language (below). Also pause the old
   Play closed-testing track "1.0" (the AD_ID error).
9. The rest of the brand book (the written book, store art style).
10. One leaderboard for Android and iPhone.
11. Play Games / Game Center achievements.
12. The transfer code.
13. Avatars, second pass.

## Crash and error reporting

Added 22 Nov 2026. Today nobody learns that the game crashed or threw on a
player's phone.

- **Native crashes:** Firebase Crashlytics on Android and iOS (free).
- **JS errors:** `window.onerror` and `unhandledrejection` in `native.js`,
  sent as non-fatal reports (Crashlytics custom logs, or the Cloudflare
  server), with the version, device, screen and mode. Throttle them: the
  same error once per session.
- **Paperwork:** Play Data safety and Apple App Privacy (crash data, not
  linked to the player). One sentence in `privacy.html`. The CLAUDE.md
  external-requests exception (native apps only).
- Check the Play Console's own Android vitals (ANR and crash rate) and the
  pre-launch report each release.

## SEO and store listings (ASO) in every language

Asked for by the owner, 22 Nov 2026. How the game is found: in the Play
Store and the App Store (ASO), on the web (the GitHub Pages site,
`index.html`/`privacy.html`) and on CrazyGames/Yandex. Texts now live in
`store/listing.md`, `store/app-store-listing.md`, `yandex/`, `crazygames/`.

1. **Keywords per language** (en, ru, ro, es, pt-BR, de, and maybe more
   markets later: fr, it, tr, ja, ko, id).
   - What players actually search: "penguin game", "snow slide", "ski
     game", "endless runner", "offline game", in each language. Use the Play
     Console's search terms report and App Store Connect's "Search" source.
   - Competitors' titles and short descriptions in the same niche.
2. **Play Store:**
   - Title (30 characters): the name plus one keyword, e.g. "Ice Dasher:
     Penguin Slide".
   - Short description (80) carrying the main keyword.
   - Full description with the keywords used naturally (Google reads it, no
     stuffing).
   - Localised in each language, not only translated.
3. **App Store:**
   - Name (30), subtitle (30), keyword field (100 characters, comma-separated,
     no spaces, no words already in the name), one per localisation.
   - Use the extra localisations Apple counts for a country (e.g. English UK
     and Mexican Spanish for the US store) for more keywords.
   - Promotional text (170) changed with each event (dragon, New Year)
     without a review.
4. **Store art:**
   - Screenshots that sell in the first two (the title captioned with the
     main benefit, in each language).
   - The feature graphic and an app preview video (`store/trailer`).
   - The icon tested against alternatives (Play's store listing
     experiments).
5. **Ratings:** the in-app review prompt is already at good moments. Answer
   reviews in the player's language. Watch the rating per country.
6. **Web SEO** (the GitHub Pages page):
   - A real landing page: `<title>`, meta description, Open Graph and
     Twitter cards (picture), `hreflang` for the languages, the store
     badges with links, JSON-LD `VideoGame`/`MobileApplication` schema,
     `sitemap.xml` and `robots.txt`.
   - Fast load, and Search Console set up (the owner verifies the site).
7. **CrazyGames and Yandex:** titles, descriptions, tags and covers checked
   against the same keywords.
8. **Measure:** store listing visitors → installs (conversion) per country
   before and after, in the Play Console and App Store Connect analytics.
   Use Play's store listing experiments (A/B) for the title, icon and
   screenshots.

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
- **Release:** the version after the global-launch one (1.3.6 or later),
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
- **Release:** the same version as the transfer code (1.3.6 or
  later).
- **iPhone, same pass if wanted:**
  - Game Center achievements through `GameCenterPlugin.swift`, with the same
    calls.
  - App Store Connect: up to 100 achievements, 1000 points in all, 100 at
    most each.

## Visual quality: text that fits, one palette, even avatars, translations

Asked for by the owner, 22 Nov 2026. The honest review (graphics 65/100):
everything is drawn from code, coherent and friendly, but it shows that no
artist went over it. Three things give it away: the avatars are uneven, about
246 colours have no shared palette, and texts don't fit. This pass, done
together with the brand book below, should take graphics to ~75. Every word
must show properly on every screen: buttons, tabs, prices, pills, popups, the
HUD, the comic captions, the market rows.

**A skill for it.** Write a project skill once (`.claude/skills/visual-qa/`,
with the skill-creator), so every later change gets the same check without
being asked. It would:
- Screenshot every screen in all 6 languages at 360/390/412 px and wide.
- Run the text-fit test, the contrast check and the "no colour outside the
  palette" check.
- Line the avatars up side by side on one sheet to compare them.
- Report each problem with its screenshot, the file and line, and a proposed
  fix.

Before writing it, look for an existing skill or plugin for UI and visual QA
or accessibility audits, and use or adapt it if one fits.

**Avatars evened out** (the part of the avatar pass that belongs here, ahead
of the full realism pass, item 13):
- All portraits on one sheet at the same size.
- Fix the ones that stand out: line weight, the amount of detail, the light
  direction, how much of the frame the head fills, and saturation against
  the palette.
- The musk ox stays as in 1.3.3.

**Text and translations:**

- Walk every screen in all 6 languages (en, ru, ro, es, pt-BR, de) at phone
  widths (360, 390, 412) and on a wide screen. Look for text cut off, spilling
  out of a button, wrapping onto a third line or overlapping an icon. German
  and Russian are the longest, so check them first.
- Make it a test in real Chrome (like `test/playtest.js`). For each language
  and screen, every text element must fit in its box (scrollWidth ≤
  clientWidth, no overflow past its parent), with screenshots of each failure.
- Fixes: shorter wording where a word is too long, `hyphens`/wrapping or a
  smaller font step only where it still reads well, never `…` on something
  the player has to understand.
- Read every translation again for meaning and tone, not only length:
  - Same names everywhere (creatures, stretches, upgrades, the dragon event).
  - Correct plurals (ru/ro numbers with "fish", "seconds", "days").
  - Russian uses "ты" throughout. "Зверь" is gone (now "наши друзья").
  - The `.ios` twins say Game Center, not Google Play.

## Economy: upgrades cost more, fewer golden fish on the hill

Asked for by the owner, 22 Nov 2026. A player of one week can buy every
upgrade and still has golden fish left over.

- **Upgrade prices** (`UP_COST` in `js/ui.js`, now `[1..10]` golden fish a
  level, 55 for one upgrade to the top). Make it a steeper curve, e.g.
  `[3, 5, 8, 12, 16, 22, 28, 36, 45, 55]` (230 a line). Pick the numbers from
  how many golden fish a week of play brings in after the change below.
  Target: maxing every upgrade takes several weeks, not one.
- **Golden fish are too dense** on the hill: spawn points in `js/game.js`
  (`t: 'gold'` around lines 690, 868, 1022, the bonus rows at 1539).
  Thin them out by roughly a third. Keep them on the risky lines, where they
  are a reward.
- Re-check that frames and alt skins priced in gold (gold frame 10,
  emperor 12, orca 16) still feel reachable with fewer golden fish.
- Re-run `node test/ladder.js` and `test/economy.js`, then update their
  bounds. Update the "days to unlock everything" estimate (it was ~4 weeks at
  1 h a day).

## The close button hides under a player's card

Reported by the owner, 22 Nov 2026. A tap on a player's row on the board
opens their card (`#sheet-prof` in `index.html`), and its close cross
(`.sheet-x`) is drawn under the card (`#sheet-prof-card.prof-preview`), so it
can't be seen or tapped. Likely cause: `.sheet-x` is `position:absolute`
with no `z-index`, and the card comes after it in the markup and is
positioned too, so it paints on top. Fix: `z-index` on `.sheet-x` in
`css/style.css` (or keep the card clear of the corner). Check the other
sheets with the same cross (skin, update, language) at the same time, and
check the player's own profile screen.

## A better performance test, on many devices

Asked for by the owner, 22 Nov 2026. Today `test/perf.js` runs only in
headless Chrome on this PC, with the CPU slowed 4×, and compares scenes
against plain Freeride (relative, ≥ 85%). It says nothing about real phone
GPUs, heat, memory or 120 Hz screens.

1. **A benchmark mode in the game itself** (the base for everything below).
   - A URL flag or intent, e.g. `?bench=1`, plays a fixed scripted run: same
     seed, same taps, every stretch, the heavy scenes (Sakura with koi, the
     dragon flying, many ice cubes, low/high graphics), about 2–3 minutes.
   - Records each frame's time and reports p50/p95/p99, the share of frames
     over 20 ms and over 33 ms, the longest freeze, the screen's Hz, the
     quality tier and any tier changes, the JS heap and the start-up time.
   - Writes a JSON result (console + a file on the phone + logcat), plus the
     device model, OS and web view version.
2. **Several simulated devices on the PC** (fast, every change):
   - CDP profiles: low-end (CPU 6×, DPR 2, 360×800), mid (CPU 4×, DPR 2.6,
     412×915), high (CPU 1×, DPR 3, 430×932), plus a 120 Hz clock as in
     `test/hz.js`.
   - Absolute budgets per profile (e.g. p95 ≤ 16.7 ms on high), not only
     relative ones. Keep a saved baseline and fail when a change makes it
     more than ~10% worse.
   - Headless Chrome uses software drawing, so also run once with the real
     GPU (`--headless=new --use-angle=...` or a visible window).
3. **Real Android phones over USB:** the debug build (`assembleDebug`, web
   view inspectable) driven with `adb` and Chrome's remote debugging (CDP),
   the same script as on the PC. Also a 10-minute soak to see heat
   throttling and battery (`adb shell dumpsys batterystats`, `gfxinfo`).
4. **Many real devices in the cloud:**
   - **Firebase Test Lab, "Game Loop" tests**, on Android and iOS. The app is
     started with the test-loop intent, runs the benchmark by itself and
     writes the result file. The free plan has a few physical-device runs a
     day, enough for a weekly sweep over cheap, mid and flagship phones
     (Samsung A-series, Pixel, an older iPhone and a 120 Hz iPhone).
   - Alternatives (paid, per minute): BrowserStack App Automate or AWS
     Device Farm.
   - A script that collects the JSON from every device into one table.
5. **From real players (optional, later):** the game measures its own
   frame times in normal play and sends a small anonymous summary (model,
   p95, tier) to the same Cloudflare server. That shows what phones are
   really slow. It needs the privacy note like the leaderboard.

## A brand book, and the colours and fonts tidied up

Asked for by the owner, 22 Nov 2026. Choose the game's colours and fonts
once, write them down, and use only them everywhere, so text, buttons and
panels look like one game and read well.

Today:
- `:root` in `css/style.css` has a small palette (`--ink #0f3a55`,
  `--ink-soft`, `--paper`, green, blue, purple, pink, gold and their dark
  twins).
- Beside it, ~246 hard-coded hex colours are scattered through the CSS (e.g.
  `#062a78` on the close cross), plus colours written inside `js/ui.js` and
  the canvas code.
- Fonts: Nunito and Baloo 2, embedded in `css/font.css`
  (`--display: 'Nunito','Baloo 2',…`).

1. **Audit:** list every colour and font size actually used (CSS, inline
   styles, canvas text such as the HUD pills, the comic captions, the profile
   card). Group near-duplicates (several almost-same blues and inks).
2. **Choose the palette:**
   - Brand colours: ice blue, deep ink, gold for golden fish, fish orange, and
     the green "buy/go" colour.
   - Neutrals: paper and panel whites, soft ink for secondary text.
   - States: success, warning, danger, disabled.
   - One text colour for each background, measured for contrast (WCAG AA:
     4.5:1 for normal text, 3:1 for big text and icons). In particular: white
     on the green/gold/pink buttons, soft ink on paper, text over the hill.
3. **Choose the type:**
   - Display font for titles and buttons, body font for text.
   - A small scale of sizes (e.g. 12/14/16/19/23/30) and weights (700, 900).
   - Line heights.
   - It has to work for Cyrillic (ru) and the diacritics of ro, de, pt and es.
     Check that the embedded fonts carry them, and replace or add a font if
     not.
4. **Write the brand book** as a page (an Artifact) and a short
   `BRAND.md` in the repo. It covers:
   - The palette with hex codes and where each colour is used.
   - Type samples in all 6 languages.
   - Buttons (primary, secondary, ghost, buy with a price, disabled), panels,
     tabs, pills, sheets, the HUD.
   - The logo/title and the app icon, with their clear space.
   - Do's and don'ts.
   - The store art style (screenshots, covers) so new media matches.
5. **Apply it:**
   - Turn every hard-coded colour into a `--token`, with fonts and sizes as
     tokens too. Canvas code reads the same values (one JS palette mirroring
     the tokens).
   - Fix the contrast problems found in step 2.
   - Add a test: no raw hex outside the token block in `style.css`, and a
     contrast check of each button's text on its background.
   - Before/after screenshots of every screen for the owner to approve before
     shipping.
- Goes well together with "Text that fits everywhere" above (the same pass
  over every screen and language).

## Review every mode: does it work, and what is it for

Asked for by the owner, 22 Nov 2026. The modes today (title screen and the
"More" screen, `index.html` ~143–372; `W.mode` in `js/game.js`):

- **Freeride** (`free`): the endless main run, its board, the stretches
  (biomes).
- **Known Lines** (`runs`, `js/courses.js`): fixed courses with stars and
  "Next line", including the event lines (Sakura).
- **Daily** (`daily`): the day's run.
- **Rush** (`rush`): against the clock, with clock pickups.
- **Avalanche** (`avalanche`): the snow chasing from behind.
- **Events:**
  - New Year (`btn-event`, `js/events.js`).
  - The dragon egg, Sakura Garden (`btn-dragon`).
- **The tutorial / First Light** (`tut-first`).

For each mode:

1. **Does it work?**
   - Play it start to finish as a player would, in real Chrome
     (`test/playtest.js` style) and on a phone.
   - Start, pause, resume, give up, die, continue with a heart or an ad,
     finish.
   - Rewards (fish, golden fish, stars, trophies, daily tasks) arrive once
     and only once.
   - The best/record is saved (and sent to the board where it has one).
   - Every creature's perk behaves in it.
   - All 6 languages; low and high graphics.
   - List each bug found, then fix it.
2. **What is it for?**
   - What it gives the player that the others don't (a reason to come back
     each day, a skill to practise, a short session, collecting).
   - How it feeds the economy and progression.
   - Whether its rules are clear from its button and first screen.
   - Overlaps: e.g. Daily vs Known Lines vs Freeride; Rush vs Avalanche
     (both are "go fast").
3. **Numbers** (where there is data): how often each mode is opened and
   played.
   - There are no analytics today. A small anonymous count could go with the
     performance summaries to the Cloudflare server, if wanted.
   - Until then, judge from play.
4. **Write-up for the owner:**
   - A short table: mode / works? (bugs) / its purpose / keep, improve,
     merge or drop.
   - For "improve", one or two concrete ideas each (e.g. Avalanche gets its
     own board; Daily gets a streak reward).
   - Decide together before changing anything.

## No vibration on a golden fish

Asked for by the owner, 22 Nov 2026. Picking up a golden fish should not buzz
the phone. Remove `gold: 28` from `BUZZ` in `js/ui.js` (line ~1624). The
other buzzes (crash, caught, rewards) stay. Small, so it can go out with any
version.

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
- **Release:** 1.3.6 or later, with the transfer code (iOS from
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
