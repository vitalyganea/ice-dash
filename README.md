# 🐧 Pine Rush

A one-tap endless slide, written in plain HTML + CSS + JavaScript and built to
pass YouTube Playables certification. No libraries, no build step, no image or
audio files — everything is drawn on a `<canvas>` and every sound is
synthesised at runtime with WebAudio.

See [PLAYABLES.md](PLAYABLES.md) for how each certification requirement is met.

## Running it

Double-click `index.html`. That's it.

To serve it over a local web server instead:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Opened this way the game runs standalone: the Playables SDK is not present, so
the best score goes to `localStorage` instead of the cloud save, and the
platform pause and audio hooks are simply inactive.

## The one control

The penguin slides down an ice chute on his belly and is **always** drifting to
one side. A tap sends him the other way. That is the whole game.

| Input | Action |
|---|---|
| tap or click anywhere | slide the other way |
| `Space`, `↑`, `W` | the same |
| `P` | pause |
| `Esc` | pause, or close the open menu |

## What's in it

- An **endless** run down a chute that winds between snow banks
- Pines and boulders to weave through, seen from directly overhead
- 🐟 fish to swallow (25), ✨ a golden fish off the safe line (150),
  🫧 a snow bubble that absorbs one crash, 🚩 flag gates for a bonus
- Four stretches of hill that rotate every 520 m, cross-fading into each other rather than cutting: **Pine Forest**,
  **Rocky Pass**, **Glacier** (he turns lazily — tap earlier) and
  **Night Run** (the hill ahead fades into the dark)
- The run gets harder the whole way down: faster, gaps narrower, rows closer
  together and more often doubled up
- Best score saved through the Playables cloud save (distance plus everything collected)
- Music and sound effects, each with its own on/off toggle
- Fills the screen at any shape, from 9:32 to 32:9. A fixed safe region of
  the world is guaranteed visible and the view then extends to the edges, so
  there is never a letterbox or pillarbox — and never a strip of screen that
  ignores your taps

## Layout

```
index.html        the screens (title, help, pause, run over)
css/font.css      Baloo 2, embedded as a data URI (no external requests)
css/style.css     all interface styling
js/audio.js       sounds and music synthesised with WebAudio
js/biomes.js      the four stretches of hill: palette, grip, fog
js/game.js        the engine: physics, spawning, collisions, rendering
js/ui.js          menus, saving, input, Playables lifecycle
PLAYABLES.md      certification requirements and how each one is met
```

`README.md` and `PLAYABLES.md` are documentation — leave them out of the
uploaded bundle.

## One control, whole screen

The tap is bound to the window, not to the drawing surface. That matters: the
build before this one sized the canvas to a fixed aspect and centred it, so on
a tall phone more than half the display — including where a thumb naturally
rests — silently swallowed every tap. Two pointers landing within 45 ms count
as one tap, or a two-finger press would flip the direction twice and appear to
do nothing.

The pause button sits top right, clear of the lower half, because the whole
screen steers and a control under a resting thumb would pause the run by
accident.

## How the hill stays fair

The camera looks straight down, so world units and screen pixels are the same
thing: what the collision test measures is exactly what the player sees. There
is no perspective for the two to disagree about.

Rows of obstacles are laid down with one opening each. Before placing an
opening, the spawner works out how far sideways the penguin can actually get
before reaching that row — by simulating the turn from the worst state he can
be in, already drifting the wrong way at full tilt and tapping only now, on
the least grippy ice he will be standing on when he gets there. It then offsets
the opening by at most a fraction of that number, rising from 60% at the start
to 93% at full difficulty.

So the run can demand a near-perfect tap, but it can never demand an impossible
one. `scratchpad/pine/mech.js` checks this by replaying every row a real run
produces; it also verifies that the drawn scene and the collision test agree to
within a millionth of a pixel, and that distance survived actually tracks skill.

A tall phone shows far more hill than a laptop does, which would otherwise hand
it several extra seconds of warning. Past a fixed budget of clearly readable
hill the distance hazes over: shapes still show through, but not sharply enough
to plan on, so the run asks about the same of everyone.
