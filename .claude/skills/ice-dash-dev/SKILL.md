---
name: ice-dash-dev
description: Workflow for changing the Ice Dash game (YouTube Playables, plain HTML/CSS/JS on canvas). Use it whenever you add or change gameplay, obstacles, biomes, skins/creatures, courses, trophies, menus, saving, audio, translations or layout in this repo, fix a bug in js/*.js, or prepare icedash.zip for upload, even if the user only says "add X to the game" or "fix this".
---

# Ice Dash development

The game ships to YouTube Playables and has to pass certification. Most of
the hard-won correctness lives in the docs and the test suite, so the work
is mostly: find the right file, respect the constraints, prove it with the
checks the repo already has.

## 1. Orient

| Change | File | Also touch |
|---|---|---|
| physics, spawning, collisions, rendering | `js/game.js` (large; grep, don't read whole) | relevant `test/*.js` |
| a stretch of hill (palette, grip, fog) | `js/biomes.js` | `test/themes.js`, `test/lint-colors.js` |
| creature / skin, price | `js/skins.js` | `test/skinsafe.js`, `test/economy.js`, run `ladder.js` |
| a Known Line course | `js/courses.js` | `test/courses.js` |
| trophy | `js/achievements.js` | `test/economy.js` |
| menus, save, input, SDK lifecycle | `js/ui.js`, `index.html`, `css/style.css` | `test/persist.js`, `PLAYABLES.md` |
| any visible text | `js/i18n.js` (English, Russian, and Romanian in the `RO` block) | |
| sound | `js/audio.js` (synthesised only) | |

`SYSTEMS.md` records what has been built and what earlier changes broke;
skim the relevant section before touching a system. `GAME_SPEC.md` has the
non-goals; don't add something listed there.

## 2. Constraints (why they matter)

- **No libraries, no external requests, no audio/image assets** beyond the logo.
  The package is small and offline, and certification checks external calls.
- **Save only via SDK** inside Playables, and never before `loadData()` settles,
  or a fresh save can overwrite a player's cloud progress.
- **No Page Visibility API**; `onPause` must stop the loop *and* rendering.
- **Old saves must still load**: when changing the save shape, parse
  defensively in `adopt()` and keep defaults.
- **Any aspect ratio, mouse and touch**: new UI uses Pointer Events and
  buttons ≥ 44×44 css px; Esc closes modals without `preventDefault()`.
- **Three languages**: a string missing in Russian or Romanian falls back to
  English, but add all three. Readouts are written as labels (`рыба: 37`, `pești: 37`).
- Dark or strongly marked creatures only: white on pale ice is unreadable.

If a change affects a certification row, update `PLAYABLES.md` in the same change.

## 3. Verify

Run from the repo root (Git Bash):

```bash
bash test/run.sh                  # fast suites; or name some: bash test/run.sh courses gates
node test/ladder.js               # slow, when skins or prices change
node test/playtest.js desktop     # real Chrome; needs Chrome installed
```

Write a new check in `test/` when adding a system (copy the pattern from a
neighbour; `harness.js` loads the engine with a stubbed DOM) and add it to
`SUITES` in `test/run.sh` if it is fast.

For a visual check, serve the folder (`python -m http.server 8000`) and use
Claude in Chrome to screenshot at a phone shape (390×844) and a wide one
(1280×800), and read the console. Any console error is a bug.

## 4. Package

```bash
bash build.sh
```

It zips an explicit allowlist and fails if docs or tests leak in. A new
runtime file must be added to `FILES` there. `zip` is GnuWin32 at
`C:\Program Files (x86)\GnuWin32\bin`; if the shell can't find it, prefix
`PATH="$PATH:/c/Program Files (x86)/GnuWin32/bin"`.

Only rebuild `icedash.zip` when the user asks for a package; it is committed.

## 5. Report

Say which suites ran and their result, and whether the playtest or a
browser check was done. If something was skipped (e.g. ladder), say so.
