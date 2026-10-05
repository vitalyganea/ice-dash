# YouTube Playables compliance

How Ice Dash meets each certification requirement, and what is still left for
you to do in the Developer Portal.

## Integration

| Requirement | How it is met |
|---|---|
| SDK loaded before any game code | `index.html` — `<script src="https://www.youtube.com/game_api/v1">` is the first element in `<head>` |
| `firstFrameReady()` then `gameReady()` | `js/ui.js` — `firstFrameReady` fires in the first `requestAnimationFrame`; `gameReady` only after `loadData()` settles and the game is interactive — the title menu, or for a save with no runs in it the first-run tutorial, which holds the hill still until the first tap |
| Progress saved only via `saveData` | `js/ui.js` `store()` — inside Playables the SDK is the sole mechanism; `localStorage` is used only when the SDK is absent |
| `loadData()` awaited before `saveData()` | `canSave` stays `false` until the load promise settles; `store()` returns early before that |
| Old saves must still load | `adopt()` parses defensively and falls back to defaults; only skin ids this build knows about survive the load, so a save from a later version cannot equip something that is not here |
| Save at milestones | when a run ends, and on `onPause` |
| Failed save retried | `saveData()` is retried once before giving up |
| Audio follows YouTube | `isAudioEnabled()` seeds the state, `onAudioEnabledChange` updates it; `Sfx.platformAudio()` gates the master bus, so nothing can be output while YouTube is muted |
| No overall in-game mute | only granular Music / Sounds toggles, both subordinate to the platform setting |
| `onPause` halts everything | `Game.suspend()` cancels the animation frame, so the loop, physics, audio scheduling and **rendering** all stop |
| `onResume` is the only resume | `Game.unsuspend()` |
| Page Visibility API not used | not referenced |
| `sendScore` matches the save | score = the best run’s points, the same number the save holds, sent from the save-success path |

## Design

| Requirement | How it is met |
|---|---|
| Playable at every aspect ratio | the view is scaled so a fixed safe region of the world always fits, then extended to the screen edges. Verified at twelve shapes from 9:32 to 32:9 |
| Fills the viewport | exactly, at every shape — there is no letterbox or pillarbox at any aspect ratio |
| No orientation lock | none requested |
| State survives resize | `Game.resize()` reframes the live run; distance, score and the penguin's position are untouched |
| Touch **and mouse** for everything | the single control is a tap anywhere on the window, driven by Pointer Events, so mouse, touch and pen all work; every menu is ordinary buttons |
| Touch targets | every button is at least 44×44 css px. During a run the only one is pause (64 px); in the first-run tutorial a Skip button joins it. Both sit clear of the steering area, which buttons never pass taps to |
| No input dropped | one control, no held state to get stuck |
| Esc closes modals | every panel closes on Esc — How to play, Market, Trophies, Known Lines, Settings — and pause resumes on it |
| No `preventDefault()` on Esc | the Esc branch returns before any other handling |
| Crisp at every resolution | the canvas backing store is sized in device pixels and the context scaled to match; re-runs on resize and on density change |
| Communicates end of content | Freeride is endless by design and says so; the marked lines and the Daily Line end at a finish line with stars; Time Rush ends when its clock does, Avalanche when the snow catches you. Every results screen shows the score, the best, and what to go back for |
| No sharing prompts / external links / extra agreements / quit button | none present |
| English supported | English is the default and the fallback for every string; Russian and Romanian are offered alongside it in Settings, a Russian or Romanian device language is picked up on first run, and anything else falls back to English |
| No icon clashing with platform controls | nothing the game draws as a control sits along the top edge, where the platform draws its own chrome. In a run: the pause glyph (two bars), **bottom**-right, 64 css px. In the tutorial: Skip, **bottom**-left. Over the long panels: a back arrow, **bottom**-left. The readouts in the top-left are a panel of numbers, not a control |

## Privacy and data

No external calls other than the SDK itself. The webfont is embedded as a
data URI in `css/font.css` (Baloo 2, SIL OFL 1.1, with a Nunito subset for
Cyrillic and a small Baloo 2 cut for Romanian ă, ș, ț — each held to its own
letters by `unicode-range`). The Daily Line and today's tasks are picked from
the device's own date by a seeded generator in the bundle — there is no
server, so nothing is fetched for them. The only file fetched at
runtime is the title logo, `img/logo.webp` (158 KB) with `img/logo.png`
(380 KB) as the fallback for browsers without WebP — both are in the
bundle, so this is a same-origin read, not a network call. No clipboard access, no personal data, no login-like
screens, no QR-like graphics, no obfuscation, single page application, and no
`eval`, WebAssembly or Web Workers.

## Stability and performance

| Limit | This game |
|---|---|
| Initial bundle < 30 MiB (< 15 recommended) | 1.04 MiB across 13 files (724 KB zipped) — 538 KB of it the two logo encodings, 243 KB `js/game.js`, 59 KB the embedded fonts |
| Individual file < 30 MiB (< 512 KiB recommended) | largest is `img/logo.png`, 380 KB; largest script is `js/game.js`, 243 KB |
| Saved game < 3 MiB (< 500 KiB recommended) | about 1.2 KB with everything in it — all 18 creatures owned, all 33 trophies earned, all nine marked lines starred, a long Daily streak, today's tasks done. A fresh save is about a third of that |
| Load and interactive < 5 s | one image to fetch (158 KB WebP, same origin); the title screen is interactive on the first frame and does not wait for it |
| At most 8000 files | 13 (`unlock.html` is a testing page and is not shipped) |
| Only relative paths | yes, the SDK URL aside |
| File names `[A-Za-z0-9_.-]` | yes |
| Standards-compliant Web APIs | Canvas 2D, WebAudio, Pointer Events, and the Vibration API (`navigator.vibrate`, short patterns for big moments, off in Settings, and its switch hidden where the device has none) |

## Left for you in the Developer Portal

Title, description, category, age rating, thumbnails and the privacy policy
link are portal-side metadata — they are not part of the bundle.
