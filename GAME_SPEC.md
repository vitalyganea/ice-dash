# Game Spec

> Written from the existing project and the build log rather than a fresh
> discovery interview: Ice Dash was already built when the game-dev skill was
> first applied to it, so genre, platform, art and the genre-specific answers
> below are read off `README.md`, `PLAYABLES.md` and the code, not guessed.
> The scope line is the one thing that was asked and answered directly.

## Core loop

You slide on your belly down a winding ice chute, seen from directly
overhead. You are always drifting to one side; a tap sends you the other
way, and that is the whole control. Boulders, pines and crevasses leave one
opening per row, and the run is a chain of decisions about when to flip.
Fish on the way are the currency; the shop turns them into animals whose
perks change how you earn, and into spare lives. One crash ends the run
unless you are carrying a spare.

## Genre

One-tap endless slide, top-down. Second mode: six fixed, hand-written
courses with a finish line and stars.

## Platform target

Both, mobile-first. The game is built for YouTube Playables, so phone is the
primary target and the viewport fills any screen shape from 9:32 to 32:9
with no letterbox. Desktop adds keyboard (Space / Arrow Up / W to tap, P and
Esc to pause) on top of the same pointer control. Pause on mobile is a large
bottom-right button plus a two-finger tap anywhere; the second finger is
never a steering input, because steering is a single tap.

## Art approach

Vector / flat shapes, drawn on `<canvas>` at runtime. No sprite sheets, no
audio files — every sound is synthesised with WebAudio. The one exception is
the title logo, a supplied raster image in `img/`.

## Scope

**Full small game, ship-ready.** Done means: the known open list is closed,
a full playtest has been run on both declared platforms with findings logged
in `PLAYTEST.md`, and the upload package is rebuilt and correct.

## Genre-specific answers

- **Control feel** — one tap flips the drift. Turn sharpness is per-biome
  (`grip`) and per-skin, and the spawner proves every row reachable against
  the *worst* case: already drifting the wrong way at full tilt, tapping
  now, on the least grippy ice at arrival.
- **Modes** — Freeride (generated, endless) and Known Lines (six written
  courses). Freeride is locked until First Light is finished, so a beginner
  learns the hill on a course that does not reshuffle.
- **Courses** — written one token per row in `js/courses.js`; every row is
  replayed against the same reachability proof the spawner uses. Stars are a
  share of the fish the course actually holds, counted as it is laid down.
- **Hazards** — boulders and pines (one opening per row), crevasses crossed
  by an ice ramp, snow bridges that cast a shadow over a cleared stretch,
  deep snow (never fatal: it costs pace, and pace is score), meltwater
  geysers (lethal only while up, and never over the middle of an opening)
  and nunataks, spines of rock that split the run in two for a few hundred
  metres with both ways past open and proved.
- **Pickups** — fish (currency), golden fish, snow bubble (absorbs one
  crash, including a crevasse fall), frozen find (rare; cracked open after
  the run for fish, gold or a spare life), snow rush (six seconds of
  ploughing through anything), and three readable finds: a cold draught
  that slows the hill, a lens that lights up the openings ahead, and a call
  that bends every fish towards you.
- **Biomes** — ten stretches of hill, each with its own palette, weather and
  in one case its own grip. Six are tied one-to-one to a course so you know
  which line you are on from the first frame.
- **Economy** — fish buy eleven animals, priced in a ladder, each with a
  perk that changes how you earn, and spare lives at 250 fish (cap 5). A
  perk may only ever make the hill *more* forgiving; `test/skinsafe.js`
  holds a declared direction for each one and fails on any that does not.
- **Aurora** — asked for by the user: one creature that cannot be bought,
  given to whoever earns every trophy, shown as the prize at the top of
  Trophies. Trophy rewards are claimed by hand.
- **Extra lives** — a crash with a spare in hand offers a 3-2-1 revive from
  where you fell. Nothing is banked until the player chooses.
- **First-run tutorial** — added at the user's request: a brand-new player
  (no runs in the save) is dropped straight into a short written line that
  teaches by playing it. The hill holds still until the first tap, then
  slows almost to a stop at the first two openings until the player taps
  the right way (left, then right). After that each thing on the hill is
  introduced as it comes into view — fish, the golden fish, the bubble,
  blue ice, the snow bridge, the crevasse and its ramp — with its own icon
  and one line. Nothing in it can end the run: a crash puts you straight
  back on the hill without spending a life. It can be skipped at any
  moment, replayed from How to play, and ends on a "you're ready" card that
  leads into First Light. English and Russian, like every other string.
- **Time Rush** — asked for by the user: the open hill against a clock.
  Twenty seconds to start; clock bubbles (+3 s) sit off the safe line, so
  time is earned by leaning out for it. A crash costs five seconds instead
  of the run. The score is the distance; it has its own best.
- **Avalanche** — asked for by the user, picked from a list: the open hill
  with a wall of snow behind. It starts 70 m back and comes down 10% faster
  than the pace a clean rider holds, so riding clean only slows the loss;
  deep snow and crashes (which put you back on the hill, as in Time Rush)
  cost lead, and each crystal ring knocks the snow back 22 m at the top of
  the hill, 6 m at the bottom, banked up to 112 m. Clean riding with no
  ring is caught near 700 m; taking every ring, near 3–4 km. Distance is
  the score; it has its own best. The title holds Freeride and Known Lines;
  Daily Line, Time Rush and Avalanche are under More modes.
- **Daily Line** — a marked line written fresh each day from the date, the
  same for everyone on that day, with stars like the others and a streak
  for finishing on consecutive days.
- **Three more stretches** — Frozen Jungle, Cosmic Ice and Crystal Caves,
  each with a marked line of its own. Still nothing built: leaves, stars
  and crystal, all under ice.
- **Trophies** for the new modes, the new lines and the streak.
- **Languages** — English, Russian and Romanian, picked from a window of flags in Settings.

## Explicit non-goals

- **Nothing man-made in the game world.** A standing constraint from the
  user: no flags, banners, crates, signs or chevrons. The finish is an
  apron of glacier ice; the "loot box" is a nodule of ice with something
  frozen inside it.
- No libraries, no build step, no bundler.
- No image or audio asset files beyond the title logo.
- No orientation lock, and no in-game master mute (Playables forbids both).
- No 3D, no engine.
