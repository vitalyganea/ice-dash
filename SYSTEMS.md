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
| 9  | Blue-ice gates | done | `gates.js` — green means scored (5/5, 4/4), and gates are a decision not free score (9 of 54 taken) |
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
| 33 | Buttons cut from the logo's ice | done | The menus were the one part of the game in generic candy pills. Every `.btn` is now a block of the logo's ice: navy rim (`#062a78`, sampled off the logo), deep-blue edge for thickness, a pale face with two bands of light, snow on top outlined in navy all round — with a line only underneath, the half above the button was white on the white panel and read as a dotted stitch. Each colour sets five variables; Market is gold, the golden fish's colour. Locked Freeride is frosted with no snow. `.btn-sm` gets a thin skin of snow, because the full drift lay across "Wear" and "700 fish". Row gaps grew so snow never touches the block above. Title panel got the same rim and edge. `playtest.js` found Chrome only as `google-chrome` (Linux) and now finds it on Windows and macOS. Playtest: both platforms pass, nothing on the console; screenshots checked for title, market, pause and results |
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
