# Systems

Build order top to bottom. Ice Dash was already built when this list was
first written, so rows 1–16 are existing systems recorded with the check
that actually proves each one, not work still to do. Rows 17 onwards are
the ship-ready work; row 20, the full playtest, is deliberately last
because it covers everything above it.

Status values: `pending` / `building` / `testing` / `done`.

## Built and verified

| #  | System | Status | Test notes |
|----|--------|--------|------------|
| 1  | Viewport & scaling | done | `viewport.js` — fills the screen at 12 shapes from 9:32 to 32:9, worst gap 0.0px, pixels stay square, full chute width visible, survives rotation mid-slide |
| 2  | Input / controls | done | `viewport.js` + manual. Tap bound to `window`, not the canvas: bound to the canvas, a tall phone swallowed every tap landing outside the drawing surface |
| 3  | Core movement & reachability | done | `mech.js` — drifting 121m vs aiming 6145m vs sharp play 11629m; every row proved reachable against the worst case |
| 4  | Collision & crash | done | `mech.js` — a flawed player is always caught eventually (14/14) |
| 5  | Object lifetime | done | `persist.js` — at 4 screen shapes, nothing is ever deleted while still on screen (0 of 176–288 culled) |
| 6  | Freeride generation | done | `mech.js` — runs vary 3.2x best-to-worst, so there is a best worth chasing |
| 7  | Known Lines (courses) | done | `courses.js` — 0 impossible rows across all six, a competent bot finishes 3/3 on each, and each course is identical under two different seeds |
| 8  | Crevasse & ice ramp | done | `crevasse.js` — the ramp launches, air always lasts past the far lip, and a genuine miss is fatal 34/34 |
| 9  | Blue-ice gates (crystal rings since row 39) | done | `gates.js` — green means scored (5/5, 4/4), and gates are a decision not free score (9 of 54 taken) |
| 10 | Skins & perks | done | `skinsafe.js` — no skin can make an opening unreachable (0 impossible, 0.0px overreach across all 8) |
| 11 | Economy & shop | done | `economy.js` — first skin in 3 runs, catalogue not cleared instantly (271), every perk measurably earns more than none |
| 12 | Biomes & themes | done | `themes.js` — each course holds its own weather start to finish; 5556 blended values checked across 20 crossfades for fields the blender forgot |
| 13 | Colour literals | done | `lint-colors.js` — 307 literals, 0 malformed |
| 14 | Extra lives / revive | done | `revive.js` — one life spent, resumes where he fell, plays on 1500 frames after; 8/8 crevasse falls survive (invulnerability does **not** cover crevasses, so they are cleared outright) |
| 15 | Snow rush | done | `rush.js` — 5/5 charges came through smashing 32 obstacles, 6/6 short rushes ended in a crash once lapsed, 2–5% of distance |
| 16 | Bridge shadow tint | done | Browser check `shade.html` — 16–28% of the light taken on all ten biomes (clustered at 23%), measured against the same row rendered without the bridge |

## Remaining

| #  | System | Status | Test notes |
|----|--------|--------|------------|
| 17 | Test harness lives in the repo | done | Moved to `test/`, paths made relative to the file so the suite travels with the repo. All 13 suites re-run and pass from the new location; the browser check `test/shade.html` too. `test/run.sh` runs the lot, or one by name |
| 30 | The catalogue after the three new creatures | done | `ladder.js` extended: section A now walks every skin bought to survive, not just the dearest one, and a new section C measures the two perks that only pay at distance (the hare's gentler ramp, the narwhal's wider ramp) against a player who actually gets that far — a first-timer dies around 850m and never reaches either. The owl is deliberately left out of both: its perk is that you can SEE the next openings, and the simulated player reads the row list directly, so it already has perfect foresight and cannot feel the thing being sold. That is a limit of the measurement, not a verdict on the perk. The run also found the seal — see below |
| 31 | Four painters defined twice, and one of them invisible | done | `drawRush`, `drawGate`, `drawFish` and `drawBubble` each had two definitions at module level, and JavaScript keeps the last one. Worse, the speed streaks were ALSO called `drawRush`, with no arguments — so the call that was meant to paint the snow rush pickup was reaching the streak painter instead and **the pickup was never drawn at all**. The invincibility bonus could only be taken by accident. Split into `drawRushBall` and `drawSpeedStreaks`, and the duplicates removed — the surviving `drawGate` and `drawBubble` are the richer of each pair, so the blue ice got its travelling band of light back and the bubble its turning film, motes and sliding catchlight |
| 32 | How to play, with pictures | done | Nineteen identical boxes of text was where a new player stopped reading, and the panel had nothing visual since the emoji came out. Each line that describes a thing now carries that thing, drawn by the game's **own** painters through `Game.drawHint` — change the bubble on the hill and the bubble in the panel changes with it. Sixteen icons, checked side by side at 110px: the geyser needed its own small drawing (a frozen frame of the real one, shrunk to 44px, spread into a round white puff indistinguishable from the deep snow above it), and the two lines about the glacier and the dark kept no icon, because a boulder does not explain "he turns lazily" |
| 18 | Skin price / order balance | done | Re-priced so cost tracks worth, and the catalogue reordered into a ladder. Two new guards in `economy.js`: the earning skins must improve with price, and the dearest one must buy distance. The second caught a real fault — see below. Casual grind 105 -> 76 runs; Reindeer 39 -> 26 |
| 19 | Upload package | done | Built by `build.sh` from an **allowlist** of the 13 files the game needs, because the previous package was built the other way round — as a set of excludes — and shipped `README.md` and `PLAYABLES.md` inside it while the README said it did not. The script fails if any planning doc, the testing page or `test/` turns up in the archive, so the claim is checked on every build rather than made once |
| 21 | Speed made visible | done | Streaks stretch 5.2x and brighten 2.8x from the top of the hill to terminal velocity, wind tears past the margins, the belly spray lengthens, and the frame closes in. Tuned for pace 0.3-0.9, where a run actually lives — the first pass scaled to arrive at 1.0 and so was at a tenth strength everywhere it mattered |
| 22 | Obstacle silhouette variety | done | Three pine forms and four boulder forms, chosen from the rotation the spawner already assigns — deterministic on a marked run, and not one spawn site had to change. Same radii, so difficulty is untouched; `courses.js` still reports every course identical under two seeds |
| 23 | Ice surface detail | done | Cracks, trapped air and old runner grooves, pinned to world distance. First pass keyed the marks to `B.bankShade` and was invisible — on most of the hill the bank shade is within a few points of the ice it sits on; they now use the same biome-aware neutral the bridge does |
| 24 | Grace after spending a life | done | Three seconds where nothing ends the run — kept separate from ordinary invulnerability because it has to cover a crevasse, and ordinary invulnerability deliberately does not (a landing and a shield save both grant it). `revive.js` section E |
| 25 | A paused run survives the menu | done | Menu used to call `Game.stop()`. It now keeps the run and the title grows a Continue button; a paused run also stops repainting the world sixty times a second. Two deeper faults found while testing it — see below |
| 26 | Trophies for the new systems | done | Eight added: frozen finds (x1, x10), snow rushes, obstacles ploughed through, a life spent, and the marked runs (one, all six, all eighteen stars). `totRevives` was being written and read by nothing. Trophy icons lost their emoji like everything else; an earned disc fills in instead |
| 27 | UX pass over the menus | done | Continue sat there permanently — `.btn-row{display:flex}` beats the browser's `[hidden]`, and every other hide in the file uses the `.hidden` class. Then: the destructive button on the pause screen demoted and labelled, "Finish the one before" said once instead of five times, How to play rebuilt around the one control with the rest grouped, the locked mode button made legible, spare lives shown on the results, and the market's purse made sticky so it is still on screen beside the dearest animal |
| 28 | The content batch | done | Three bonuses (a cold draught, a lens, a fish call), three creatures (Arctic Hare, Snowy Owl, Narwhal) and three hazards (deep snow, meltwater geysers, the fork). `fork.js`, new: 50+ forks over 8 runs, both lanes never under 102px against a 48px penguin, nothing standing in either, the plain aiming bot killed by none of them, the gold line never inside the rock when held exactly, and 50/52 tap-by-tap attempts at it coming out the far end with 50/50 making the opening that closes the fork. Two faults found on the way — see below |
| 29 | Playtest harness | done | `test/playtest.js` drives the real page in Chrome over the DevTools protocol with no library in between, on desktop 1280×800 and phone 390×844, hitting every button with a real mouse or touch event. 35 checks, both platforms clean, nothing on the console. Findings in `PLAYTEST.md` |
| 33 | Buttons cut from the logo's ice | done | The menus were the one part of the game in generic candy pills. Every `.btn` is now a block of the logo's ice: navy rim (`#062a78`, sampled off the logo), deep-blue edge for thickness, a pale face with two bands of light, snow on top drawn as SVG the way the logo's snow is: one thick cap wrapping the top corners, white shading to cold blue, uneven lobes hanging off the front, navy outline all round. Two passes with radial gradients came first and failed — beads, then a torn strip; the user could not tell it was snow. The cap is three pieces (two ends on `::after`, a middle on `::before` with `background-repeat:round` so the seams always meet), so it fits any width without stretching. Each colour sets five variables; Market is gold, the golden fish's colour. Locked Freeride is frosted with no snow. `.btn-sm` gets the same cap scaled down, because the full one lay across "Wear" and "700 fish". Row gaps grew so snow never touches the block above. Title panel got the same rim and edge. `playtest.js` found Chrome only as `google-chrome` (Linux) and now finds it on Windows and macOS. Playtest: both platforms pass, nothing on the console; screenshots checked for title, market, pause and results |
| 34 | Second frozen find would not open | done | Reported by the user: with two or more finds, the first opened and the second never did. `openFind()` disables its button for the length of the animation and nothing ever turned it back on — `buildFinds()` now sets `disabled` from the `opening` flag. The playtest opened only one find, so it could not see this; the seed now carries two and the walk opens both. Checked both ways: without the fix `1 opened` FAIL, with it both open |
| 35 | A way out that does not scroll away | done | Reported by the user: in the Market you had to scroll to the bottom of the shelf to leave. One back arrow, pinned top-left outside the screens so it never scrolls, shown on Market, Trophies, Known Lines, How to play and Settings. It runs the same `back-title` action as the Back button, so it still returns to the results or pause screen when that is where you came from. Esc now leaves all five too (it only left How to play). Narrow screens start their panel 80px lower so the arrow never covers it. Playtest: the arrow is on screen with the shelf scrolled halfway, it leaves the Market, and it is gone on the title — both platforms |
| 36 | A snow bridge that reads as a bridge | done | Reported by the user: new players did not understand the bridge and did not know what to do at it. It was a flat band of the banks' own snow straight across the screen, edge to edge — from above, a wall. Redrawn, still nothing man-made: each mouth is an arch over the run (anchored in the banks, bowed back 104px where the channel passes, flat-topped so it reads as an opening); the ice under the near arch falls into shadow you can see before you get there; icicles hang off the near lip, which only an overhang has; the run's two edges show faintly through the roof the whole way across; the roof casts a soft shadow so it sits above the hill. How to play gained a line for it, with an icon of a penguin heading in under the arch (EN + RU). Checked by render at three distances (approaching, at the mouth, underneath) on a phone and on four biomes including the two dark ones; lint-colors, themes, viewport, persist and the playtest pass |
| 37 | First-run tutorial | done | Asked for by the user: a new player should learn by playing a short map, not by reading. A marked line of its own (`TUTORIAL` in `courses.js`, kept out of `COURSES`: no stars, not in Known Lines, not on the way to Freeride) with lessons hung on its rows. The hill holds still until the first tap, and that tap only lets it go. The first two openings are taught, not hoped for: as soon as the row before is behind him the hill slows to a tenth until he is sliding the way through, with a breathing ring and an arrow; if the bank has already turned him the right way it says so instead of asking for a tap that would turn him wrong. Then fish, golden fish, bubble, blue ice, the snow bridge and the crevasse are each introduced as they come into view, with the hill's own icon, while the hill runs at 0.6 for the read. A crash puts him back a beat later with the row cleared and no life spent. Skip is always on screen; How to play can replay it; the finish card banks the fish and leads into First Light. A save with runs in it never sees it unasked (`tutDone` in the save). `test/tutorial.js`, new: every row inside the physics, the hold, the two waits (the hill all but stops), every lesson once and in order, a careful rider finishes, a player who never steers still finishes (6 crashes, 0 lives spent). Playtest: a brand-new player on both platforms lands in it, the hill holds, the first opening asks with an arrow; desktop rides it to the card and into First Light, phone skips it; neither sees it again. The playtest also caught a real crash: the finish hook stopped the engine from inside `step()` and the same frame then rendered a world that was gone — the loop now checks |
| 38 | The stretch's name on every tap | done | Reported by the user: on the marked runs the name came up on every tap (and in Freeride too, near the start of each stretch). The banner was drawn while `tapFlash` was up and the zone was under 120 units old; `tapFlash` is set by every tap and every pickup, and a marked run never leaves its first zone, so `biomeT` sat at 0 for the whole course. It has its own clock now, `zoneT`: up as a run begins (not in the tutorial, whose words sit in the same place) and when the hill changes stretch, never on a tap. `test/zonename.js`, new: on a course and on Freeride the name shows at the start, is gone a few seconds later and stays gone through 24 taps, and a new stretch brings it back |
| 39 | Blue ice became a ring of crystals | done | Asked for by the user, who picked the ring from four options. The oval of polished blue ice read as one more round thing on a hill full of round things. Same size and shape and the same place on the run, so where it pays has not moved and nothing in the spawner or the scoring changed: a hoop of clear ice set with short, blunt, six-sided gems, the light held in the middle, a glint running round it; gold when taken, grey when passed by. A first pass with long points facing out read as a crown of thorns — something to avoid, the opposite of the point. Every string that said blue ice now says crystal ring, in both languages (help, tutorial, the results line, the trophy, the walrus) |
| 40 | UI pass: switches, panels, pause button | done | Done unasked, on the user's standing instruction to make the UI changes I would recommend. Sound and Music were chips whose off state was the same 45% fade as an unpicked language — nobody could tell off from unchosen. They are switches now (track and knob, green when on), and the language chips are both full strength with the picked one in blue ice with a tick. Every panel wears the title's ice rim and edge, not just the title: pause, results, settings and the rest were plain white cards beside it. The pause button was the last plain white circle and is ice like the rest. Playtest: the Sounds switch flips what is saved and what it shows |
| 41 | UI pass: results headline, tutorial on a phone on its side | done | The score on the results card was small grey text the size of the detail line under it; it is the headline now, and New best is a gold badge of its own. On a phone held sideways (844x390) the tutorial's tap ring sat on top of the penguin, there being no room between the words and him; on short screens the words move to the top and the ring, smaller, goes beside him. Checked by screenshot at 844x390 and through the playtest on both platforms |
| 42 | The next locked line says how to open it | done | Found on the UI pass. Known Lines meant to tell you, on the next locked line only, what opens it — but the test was that the line before was FINISHED, which is exactly what unlocks this one, so it was never true and every locked row just said Locked. It now tests that the line before is open, and names it: "Finish The Narrows to open it" (both languages). Playtest checks the sentence on the seeded save |
| 43 | Start over means the thing you were riding | done | Found on the UI pass. "Give up and start over" on the pause screen always started Freeride: giving up on First Light put you on a different hill, and in the tutorial — Freeride still shut — it dropped a new player into the Known Lines list with the lesson left paused behind it. From the pause screen it now restarts the line you were on, tutorial included. Playtest pauses the tutorial, gives up, and finds the tutorial back at its first line, on both platforms |
| 44 | The title fits a laptop screen | done | Found on the UI pass. At 1280x800 the title panel ran past the bottom of the window and the best score was below the fold. The logo now sizes off the height as well as the width (44vh at most) and the gaps tighten under 860px tall. Checked on the playtest's desktop and phone title screenshots |
| 45 | One readout instead of three | done | Asked for by the user: the fish count sat apart with a swimming fish beside it, the BEST pill looked like nothing else and ran into the score card on a phone. Score, metres, the catch, spare lives and the best are one panel now, the same ice as the menus (light face, navy rim, deep edge), sized to what it holds so nothing can collide. The fish beside the count is a still icon. The count is the catch as the purse counts it — the `+N fish` the results card banks — not fish swallowed, which a creature's perk makes a different number. The best is a Freeride number and is no longer shown on a marked run. Rush time and the bubble moved to the right-hand corner (below Skip in the tutorial). Checked on the playtest's in-run screenshots, desktop and phone, and in the tutorial |
| 46 | Time Rush | done | The open hill against a clock: 20 s to start, clock bubbles (+3 s) off the safe line like the golden fish, a crash costs 5 s and puts you straight back instead of ending the run, no spare life is ever used. Bubbles thin from one row in two to one in ten as the hill hardens, so even a rider who takes every one runs dry (4 perfect bot runs: 6.6–10.3 km, all ended). The dice for them are only rolled in Time Rush, so Freeride draws the very same hills it always did (checked). A bubble is green-gold light with +3 written in it and a glint going round — no clock face, nothing on the hill is made. The readout shows the time where the score sits, orange under 8 s and pulsing red under 5, with the cost of a crash for a moment; the best is in metres and kept apart from Freeride's. Results: Time is up, scored in metres, time bubbles counted, Ride again is another Time Rush, start over from pause restarts it. Title: the modes are a grid now (Known Lines across the top, Freeride and Time Rush side by side), Market on its own row and the three quiet buttons sharing one. `test/timerush.js`, new; the playtest rides one on both platforms |
| 47 | Daily Line | done | A marked line written fresh each day out of the date by its own seeded generator (`dailyCourse` in `courses.js`), so every device gets the same line on the same day and none of it depends on the game's dice. Same tokens as the marked runs: 34 rows, wandering by at most two places a row (one on slippery ice), crevasses at least seven rows apart, at most one bridge and one find, fish, rings, gold, deep snow, geysers and the three finds sprinkled in. Its own stars for today and a streak of consecutive days finished (and the longest, and days done); it never touches the marked lines' board. The title button reads today's stars and the streak. Title modes are a 2x2 grid now: the two written lines on top, the two open-hill modes underneath. `test/daily.js`, new: a whole year of dates through the reachability proof (0 impossible rows, tightest margin 62px), all ten stretches visited, one day is one line whatever the game's dice, every day of the year a different line, yesterday right across months and years, 8 sampled days ridden to the finish. Playtest: starts from the title, finishing starts a streak and keeps the stars, results and title show them |
| 48 | Three new stretches and their lines | done | Frozen Jungle (teal ice, broad frozen leaves, fruit still on the branches along the banks, wet air), Cosmic Ice (violet-black ice with stars in it, an aurora, crystal spires) and Crystal Caves (amethyst and rose, crystal clusters, glowing motes rising). A new biome field, `flora`, swaps what grows on the hill for a shape of its own — `leaf` or `crystal` — at the same radius as the pine, so no row is any harder; it changes hands at the midpoint of a crossfade, like the shade washes. Each stretch has a marked line: Canopy, Starfall and Geode, written a little harder than The Cornice. Freeride now rotates through thirteen stretches; the Daily Line picks from all of them. Trophy text that said six lines now says every line (the goals already counted COURSES). courses.js: all three inside the physics (tightest 90px), finished 3/3, 24–28 fish each, identical under two seeds; themes.js passes across all thirteen. The playtest counts the lines from COURSES rather than expecting six, and waits for the pause button before pressing it (it raced it once on the phone) |
| 49 | Trophies for the new modes | done | Six more, 24 -> 30: Time Rush to 500 m and to 2000 m, 50 time bubbles, a first Daily Line, and Daily streaks of three and seven days. The marked-line goals already counted COURSES, so finishing all nine lines and all 27 stars moved with them on their own. Playtest: the list shows every trophy with a real name (none falling back to its key) and finishing the first Daily Line earns its one |
| 50 | The hill depends on the seed and the player, nothing else | done | Behind both suites that were already failing when this session began. Everything only looked at — puffs, snow, streaks, the shake, boulder outlines, scenery past the banks — drew from Math.random alongside the spawner, so catching a fish a frame earlier (all the reach perk does) threw different puffs and every row after it changed; economy.js was comparing a skin and no skin on two different hills and read noise (86 vs 94). It also made one seed a different hill on a phone and a laptop: the scenery count followed the screen width, and rows were decided against the player's distance at the moment they were laid, which is further back on a taller screen. Visuals now have their own generator (`frnd`), spawn decisions are keyed to the row (`hardAt(d)`, a fixed SPAWN_LEAD), the bubble is offered whether or not one is carried, and rush spacing counts from the last one offered. `test/determinism.js`, new: snowcap and mitten ride the same 47 rows on one seed (mitten catching 43 to 30), and a phone and a wide screen lay the same rows. mech.js passes again on the new hills (decent player median 6371m, under 7000; that measure is 14 noisy samples, 471–7937m) |
| 51 | Romanian | done | A third language, offered in Settings and picked up from a Romanian device. One block (`RO`) at the end of i18n.js so it reads and checks as a whole; all 242 keys, every {placeholder} and <b> matching the English. The embedded Baloo 2 subset had â and î but no ă, ș or ț, so those six letters (and their combining marks) come from a 2.8 KB cut of the same font, held to them by unicode-range. Playtest: the language switches to Setări and the game's own font draws ăȘț |
| 52 | Retention pass | done | Done unasked on the user's go-ahead, from my own list. Market badge: a red ! when a creature on the shelf is affordable (spare lives do not count, or it would always be lit). Results show what to go back for, with progress bars: points or metres to your best, fish for the next star, fish (or gold) for the next creature, or that one can be bought now. Unlock notice: finishing First Light for the first time says which modes it opened, and on the title the three buttons pulse once. Today's tasks: three a day from a pool of twelve, picked from the date like the Daily Line, never two of a kind, 50 fish each and 100 for all three; listed at the top of Trophies, counted on a chip on the title, announced on the results. Vibration: the engine reports moments (crash, golden fish, find, rush, time bubble, ring, bubble save, landing, close call, finish, time up) and the UI buzzes short patterns for them, throttled; a switch in Settings, hidden where there is nothing to vibrate. Music: Frozen Jungle, Cosmic Ice and Crystal Caves each have a tune (dorian marimba, high slow sines, minor bells); the tune follows the stretch. Close calls: passing within 14 units of a hit's edge, untouched, pays 15 points and says so over him. Combo: every ten catches in a row (fish, gold, rings) lift the points multiplier, to x3; a missed fish or a crash resets it; fish in the purse are untouched, so the shop is priced as before; shown beside the score. Freeride past full difficulty keeps doubling rows up a little more often over the next stretch (same single draw, so the dice are undisturbed). The HUD's slab — blurred shadow, gradient, rim — is drawn once into its own canvas and stamped. Tests: daily.js gains today's tasks (same three a day, no two of a kind all year, pays once); playtest checks the badge, goals, unlock notice and glowing modes, tasks on title and in Trophies, the Sounds switch |
| 53 | Six more creatures | done | Asked for by the user, picked from my list. Puffin (400 fish: black, white cheeks, a banded beak far too big — one missed fish does not break the combo, the forgiveness coming back after ten more catches), Lemming (500: orange-brown with a dark back stripe, round ears, a stub tail — each star on a finished Daily Line pays 25 fish more, shown on the results), Musk Ox (600: the reindeer's body with a heavy brow boss and horns sweeping out and down — deep snow does not slow him), Sea Otter (800: the seal's body in warm brown with a pale face — time bubbles give four seconds, and the bubble says +4 for her), Snow Leopard (1100: the hare's compact body with round ears, a long ringed tail and broken-ring rosettes, grey rather than white so it reads on ice — close calls pay 30 and count from 22 units out instead of 14) and Emperor Penguin (6 gold, before the orca: gold blazes either side of the neck — every run starts at a combo of ten, x2). New body variants, not new bodies: S.cat/S.stub/S.spot/S.stripe on the hare, S.horns and S.bodyTop on the reindeer, accessories puffin and collar on the penguin. A first pass drew the rosettes as one unbroken arc each, all opening the same way, and they read as a row of letter Cs. Seven perk keys added to skinsafe's ALLOWED, all generous. `test/newskins.js`, new: each perk against the same moment with and without it (combo 10 vs 0; the first miss kept, the second not, without the puffin the first breaks it; 121 vs 83 units through deep snow; +1.02 s per bubble; a pass 18 units out a close call for her only; 75 fish for three stars, nothing unfinished or for anyone else). skinsafe: all 17 creatures, 0 impossible, 0.0px overreach. Playtest counts the shelf from SKINS (17 of 17); economy.js, mech.js and ladder.js not run here |
| 54 | The Android app | done | Asked for by the user. Capacitor 8 around the unchanged game: `build-android.sh` builds `www/` from build.sh's own allowlist (so the app and the Playables bundle cannot disagree), takes out the YouTube SDK tag — the game already runs without it — and adds `js/native.js`: the hardware back button becomes Esc, which the game already answers (leave a panel, resume, pause a run), closes the app from the title, and returns to the menu from the results and the tutorial card; going to the background pauses a run; navigator.vibrate is answered by the Haptics plugin; the status bar is hidden. Every call is guarded, so off-device it does nothing. Icon: the game's own penguin painted by `Game._paint` on the buttons' ice, as an adaptive foreground and background; splash: the logo on the game's dark blue; all sizes generated by @capacitor/assets. Toolchain installed: JDK 17 then 21 (Capacitor 8 needs 21; Android Studio's bundled Java 25 is too new for Gradle 8.14), Android Studio, SDK platform 36 and build-tools 36. Release signing reads a git-ignored keystore.properties pointing at an upload key outside the repo. Built: app-debug.apk (10 MB) and a signed app-release.aab (7.5 MB, jarsigner-verified). Not yet run on a device or an emulator |
| 55 | Controls clear of the platform's top edge; PLAYABLES.md brought up to date | done | Found while updating PLAYABLES.md: its own row says the game keeps controls off the top edge, where YouTube draws its chrome over a Playable — and two added since sat right there, the back arrow (top-left) and Skip tutorial (top-right). Both moved bottom-left, opposite pause; narrow screens make room at the bottom of the long panels instead of the top. PLAYABLES.md now matches the game: gameReady may land on the tutorial, Esc on every panel, touch targets, how each mode ends, three languages, the font cuts, Daily and tasks from the device date with no server, bundle 1.04 MiB / 13 files / 724 KB zipped, game.js 243 KB, a full save about 1.2 KB, and the Vibration API. icedash.zip rebuilt (still the 13 allowlisted files, SDK tag in, nothing from the Android build). Playtest: the arrow is bottom-left and on screen with the shelf scrolled, both platforms |
| 56 | Play Store material | done | `docs/privacy.html` — a privacy policy in English and Romanian, true to the game: nothing collected or sent, progress kept on the device, no network, vibration the only permission; contact email left as a placeholder for the owner to fill. Published free through GitHub Pages from /docs (steps in store/listing.md). `store/listing.md` — app name, short and full description in en-US and ro-RO within Play's limits (short descriptions 80 and 76 of 80), and the Console answers: no ads, no purchases, no data collected, content rating, target audience. `store/icon-512.png`, `store/feature-graphic.png` (logo and the game's penguin on the buttons' ice, 1024x500) and seven 1080x1920 screenshots captured from the real game by `store/shots.js` over DevTools with a seeded save. An iframe attempt first did not carry the save into the game — every scene came up as a new player — hence the DevTools script. APK and AAB rebuilt with the moved buttons |
| 57 | The crystal ring stands up: a hoop to slide through | done | Asked for by the user: the bonus ring lay flat on the ice and read as a patch to cross. It now stands upright across the run, foreshortened from above, drawn in two halves — the far arc before the creature, the near arc after him (`drawGateFronts`, like the bridge roof) — so when he crosses it the ring closes round him; a shadow on the ice and a tuft of snow at each foot say it is standing. While it is still ahead of him the whole hoop is drawn under him. Same width and place, so scoring is untouched |
| 58 | Two functions called frnd | done | Found while detailing the creatures: the look's random generator (`frnd`, row 50) shared its name with an older per-strand fur hash, and JavaScript keeps the last of two same-named functions — so since row 50 every puff, flake, streak and bank decoration got the hash and came out in the same place every time. The hash is `strandJit` now. determinism.js still passes (the hill never used either) |
| 59 | Creature detail pass | done | Reported by the user: the lemming seemed to have no front legs. The hare body tucks its forepaws under the body, and on the lemming and the snow leopard they did not show at all; both now hold their forepaws out either side of the head (toes, a blot on the leopard's), and have whiskers. The lemming's stripe is soft-edged fur, not a slot. The sea otter holds its paws on its chest. The puffin's beak is broad and short with grey, yellow and red bands — the tall cone read as a party hat — and its cheeks are larger. The emperor shows gold at the throat and an orange streak on the beak. The musk ox has a fringe of long guard hair down both flanks, kept light after a first pass read as ribs. Checked by render; lint, determinism, newskins, gates, themes, tutorial, timerush, courses and the playtest pass |
| 60 | Opening a frozen find is a moment; so is a new best | done | Asked for by the user. The find is staged over 2.5 s: it shakes harder and harder while cracks of light run out from its middle and the light inside pulses faster, a rising tone under a crackle (`Sfx.charge`); it gives with a flash, a thump (`Sfx.boom`) and a buzz, rays turn behind it, the shell flies apart and the prize settles with a bounce. All of it in the prize's colour — blue for fish, gold for gold, rose for a spare life, the rarest — so the luck reads before the words. At the break a burst of rays and shards (confetti for gold and a life) is thrown across the whole window from a canvas over everything (`#fx-burst`), and once the words are up the prize flies in dots to the purse line, which bumps. A new best gets confetti down the whole screen, a fanfare (`Sfx.fanfare`), a buzz, and the score counting up. Checked by stepping the animation by hand and rendering mid-strain and just after the break for all three prizes; the playtest waits longer for the reveal and still opens both finds, nothing on the console. icedash.zip, the APK and the AAB rebuilt with everything since the morning |
| 20 | Full playtest | done | Both declared platforms walked end to end, logged in `PLAYTEST.md`. One real fault came out of looking at the screenshots rather than the assertions: the BEST pill tucked under the score panel on a 390px phone |

## What row 31 turned up

Grepping for a painter to borrow for the help icons turned up four of them
defined twice. Identical copies in two cases, so only dead weight; in the
other two the **first** of the pair was the richer drawing and the second,
plainer one was the one running. That had already cost time once this
project — two attempts to make the snow bridge opaque changed nothing,
because there were two `drawTunnel`s and the translucent one won.

The third collision was not dead code. The speed streaks that tear past
the margins are `drawRush()`, no arguments, defined last; the snow rush
pickup is `drawRush(x, y, o)`, defined earlier. Every frame a pickup was
on screen, `drawObjects` called the streak painter with three arguments it
ignores — so the ball of packed powder, the bonus that makes you
untouchable for six seconds, **was not drawn on the hill**. You could only
run into it by accident. Nothing in `test/` could see this: the suites
assert on state, and `rush.js` hands the bonus over directly rather than
looking for it on screen.

## What row 28 turned up

Two things, both found by measuring instead of guessing.

**The geyser was standing in the opening.** After it went in, two suites
started failing — no gates passed in an aiming run, and 440 gap pairs
checked instead of 800. Both have one root cause: runs had got much
shorter. Rather than pick the obstacle that looked guiltiest, a harness
rewrote `game.js` four ways and measured: both on 7930m, no geysers
22609m, no deep snow 5929m, neither 22475m. The geyser, three times over.
It sat at a flat 30% of the opening's width, which on a late row — 84
units wide, so 42 to a side — put its centre 25 units off the line while
its kill radius reached 43. There was no way through. It is placed off the
width now: its inner edge is held a clear player's width off the centre,
so on a wide row it eats a real part of one side and on a tight one it
steps aside almost entirely.

**The new content made the hill too kind.** Not any one piece of it: a
fork takes about 1200 units of hill out of hazard duty, and at one row in
twelve with an 1800-unit cooldown one turned up every 700m or so; deep snow
slows him, and the rows were proved at the speed the DISTANCE implies
rather than the speed he is doing, so every patch of it quietly makes the
rest of the hill easier than it was proved to be. Together a decent
player's median run went from 6262m to 8383m and three runs in fourteen
never ended at all — `mech.js` calls that a chore rather than a run, and
says so. Forks went to one row in twenty with a 3200-unit cooldown and deep
snow from 5.5% of rows to 3.8%: median 5935m, 13 of 14 runs ended.

**Two of the three new creatures were white.** Which is what an arctic hare
and a snowy owl are, and also exactly the mistake this game made once
before — the first pair of animals were an arctic fox and a polar bear, and
white on pale ice could not be rescued by drawing. The hare wears her
summer coat now, taupe with a white muzzle and black ear tips; the owl
stays white and the barring down his back does the reading for him, in
slate rather than in a lighter shade of himself. Her ears were also running
off the top of the shop portrait, which is how the whole thing came to be
looked at.

**A perk could change the hill, so two skins were never compared on the
same one.** The seal appeared to be a skin you pay 450 fish to earn less:
52 coins a run against the free skin's 71. Chasing it turned up something
larger. Her perk gates a spawn — `if (Math.random() < 0.13 * goldRate)` —
and the body of that `if` draws three more numbers. Spawn more golden
fish and you pull more numbers out of the stream, and every row after
that comes out somewhere else. The seal was not having a worse run down
the same mountain; she was riding a different mountain. The shoal perk
does the same thing, and `economy.js` and `ladder.js` exist precisely to
compare skins against each other.

Every perk-gated spawn now draws its numbers BEFORE asking whether the
thing exists, and always draws the same count — eight fish phases whether
or not there is a shoal, the golden fish's side and offset whether or not
there is a golden fish. It reads oddly and it is the point. Measured
again on the same hill, the seal's deficit halved.

And the half that was left is not a fault at all: a golden fish pays
`W.gold`, the hard currency the orca is bought with, and pays **nothing**
into `W.coins`. Trading fish-time for gold is the whole of what she is
for, and reading her in coins was reading the wrong purse. The fix I had
already written for her — pulling the gold in towards the safe line — was
reverted: it gave her 5.55 golden fish a run against the baseline's 1.40,
which would have put the eight-gold orca two runs away.

**The fork had to be rebuilt once.** The first version hung the rock off
the edge of the row's own opening, with the far lane beyond it. Crossing to
that lane meant 345 units of sideways travel from a line you only see 689
units ahead, and the measured result was 51 of 57 attempts surviving and 5
of 51 making the next opening. The second version lays the rock **on** the
line the row was just proved to reach, so both ways past ask the same of
you, and its flanks taper in a straight line rather than a curve — sideways
travel is a concave curve, so a straight line meeting it at the rock's
widest point sits under it the whole way in, and one proof at that point
covers the whole length. The geyser's cycle also stopped being keyed to the
frame count: by frames the same geyser on the same marked line was up on
one run and down on the next, which is not something a written-down course
is allowed to do.

## What row 25 turned up

The reported bug was that Menu from the pause screen lost the run. Fixing
that uncovered two more underneath it:

- The first guard only checked the pause screen, so **pause -> Menu ->
  Market -> Back still destroyed the run** — and the market is the whole
  reason to pause and walk away.
- `W.lives` and the equipped skin are read **at the start of a run**. You
  could pause, buy a spare life, carry on, and not have it. Resuming now
  carries back whatever was bought. The start-of-run shield is the one
  exception: that perk is for beginning a run wearing the animal, not for
  putting it on halfway down.

## What rows 21-23 turned up

A `lane` field was added to the ice streaks and never read. That one extra
`rnd()` per streak at world creation shifted the whole random stream, so
every generated hill changed and `mech` started failing a check that has
nothing to do with how anything looks ("the hill eventually catches a
flawed player", 10/14 where it wants 14). Removing the dead field put it
back to 13/14. Nothing in `newRun()` may draw a random number it does not
use.

## The bridge

Rebuilt after row 23: a solid roof of snow you pass **under**, with your own
silhouette showing through it, which was the original intent. It was lost
along the way — an attempt at a full ice cave filled the frame with a slab
of blue and had to be torn out, and what replaced it was only the bridge's
own shadow with the creature drawn on top of it, so he appeared to slide
over the thing. The roof now draws after the creature.

Row 36 gave it arched mouths, a dark opening under the near one, icicles
and the run's edges showing through, because new players read the straight
band as a wall and stopped to wonder what to do at it.

## What row 18 turned up

The new "dearest skin must buy something" guard failed, and it was right to.
Reindeer cost 4200 and earned 65 a run against the free penguin's 67, so its
whole case rested on grip — and grip was worth nothing:

- Held on the glacier for 70 runs, grip made **no** measurable difference
  (-0.8 standard errors). The reason is in the game's own design: the
  spawner already sizes every row against the grip of the stretch it sits
  on, so a glacier row is reachable at 0.62 and turning faster buys no
  ground. There was nothing for the perk to fix.
- Uncapped it was actively harmful on ordinary ice — sharper steering
  punishes a slow reaction, because you commit and the sharper turn carries
  you further past the line before your thumb lands.

Grip is now capped at ordinary ice (it can lift the glacier from 0.62 to
0.90 and do nothing anywhere else), and Reindeer also tucks his hitbox in
(`slim: 0.78`), which is the part that pays: 1129m against the baseline's
1061m, and 87 coins a run against 65.

A first reading of the whole-run numbers said grip made every quartile
worse. It did not — that distribution is wide enough (p25 292, p75 1371)
that 90 samples could not resolve a 10% difference. Holding the hill on one
biome is what made the question answerable.

## Dev level

`unlock.html` is the in-repo dev page: it writes the save directly (all
skins, all courses, a full wallet), and renders a gallery of every creature
and every stretch of hill using the game's own painter, so what it shows is
what the hill shows. It is kept deliberately — see row 19 for how it is
excluded from the upload.
