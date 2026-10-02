# Playtest

The last row of `SYSTEMS.md`: the whole game, on both declared platforms,
walked end to end rather than exercised a system at a time.

## How it was run

`test/playtest.js` starts Chrome, serves the real `index.html` over HTTP and
drives it over the DevTools protocol with no library in between. Every
button is hit with a real mouse or touch event at the coordinates the page
actually lays it out at — nothing is clicked by calling a handler. Anything
the page writes to the console is collected for the whole session and fails
the run.

```bash
node test/playtest.js            # both platforms
node test/playtest.js mobile     # one of them
```

Two shapes, matching what `GAME_SPEC.md` declares:

| | viewport | input | device pixel ratio |
|---|---|---|---|
| desktop | 1280×800 | mouse, keyboard for Esc | 1 |
| phone | 390×844 | touch, Chrome mobile emulation | 3 |

The save is seeded before the page loads — three creatures, two spare
lives, one unopened find, First Light at two stars — so the market, the
revive and the results screen all have something real to show.

Screenshots of every step land in `/tmp/icedash-playtest`.

## What is walked

1. the title screen comes up and the engine is on the page
2. **Continue is not offered** when there is no run to continue
3. How to play opens, lists the whole hill, closes on Esc
4. Settings opens; both languages are offered; switching to Russian changes
   the text on screen; Back returns to the title
5. the Market opens with all eleven creatures on the shelf
6. Trophies opens with all twenty-four listed
7. Known Lines opens with all six marked runs listed
8. Freeride starts, the pause button appears, and tapping steers a real run
9. the pause button pauses; Menu from the pause screen reaches the title;
   **Continue is now offered**; a detour through the Market and back does
   not lose it; Continue picks the run up where it was left, unpaused
10. a crash with a life in hand offers the revive; spending it puts him back
    on the hill and he cannot be killed the instant he lands
11. turning the second life down ends the run on the results screen, with a
    score on it
12. the frozen find opens and pays out
13. back to the title, with Continue gone again, and the run written to the
    save

## Result

Both platforms pass, with nothing on the console on either.

Five faults were found and fixed while building the walk, all but one of
them in the test rather than the game:

- `offsetParent` is null for anything `position: fixed`, which every screen
  in this game is. The first version of the visibility helper called the
  whole interface invisible while screenshotting it perfectly happily.
- the Market is eleven creatures long and its Back button starts below the
  fold, so a click at its page coordinates landed outside the window and
  did nothing. Buttons are scrolled into view first now.
- the seeded save carries two lives, so the crash after the first revive
  offers the second one rather than ending the run. The walk now turns it
  down, which exercises the other half of that screen.
- tapping on a timer is not playing. The run died inside a couple of
  hundred metres and the pause button was gone before it could be pressed.
  The *decision* of whether to tap is read off the same prediction the
  headless bots use now; the tap itself is still a real touch on the real
  page, which is the part under test.
- synthesised touch does not always turn into a click — Chrome decides
  whether a touchStart/touchEnd pair was a tap, and now and again decides
  it was not. Retried rather than ignored, and the retries are counted and
  reported: a button that needs them every time is a real problem. Both
  platforms currently report zero.

The one real fault came out of looking at the screenshots rather than the
assertions: on a 390 px phone the BEST pill, centred on the screen, tucked
under the corner of the score panel — the panel reaches 164 css px and the
pill wanted to start at 148. It is centred only where there is room for
that now, and pushed clear of the panel where there is not.

One thing to know when reading the numbers: headless Chrome runs
`requestAnimationFrame` well under sixty a second, so seven seconds of wall
clock is not seven seconds of hill. Distances here are a fraction of what
the same play produces in `test/mech.js`, and nothing should be concluded
from them about how far a run goes.
