# YouTube Playables compliance

How Pine Rush meets each certification requirement, and what is still left for
you to do in the Developer Portal.

## Integration

| Requirement | How it is met |
|---|---|
| SDK loaded before any game code | `index.html` — `<script src="https://www.youtube.com/game_api/v1">` is the first element in `<head>` |
| `firstFrameReady()` then `gameReady()` | `js/ui.js` — `firstFrameReady` fires in the first `requestAnimationFrame`; `gameReady` only after `loadData()` settles and the title menu is interactive |
| Progress saved only via `saveData` | `js/ui.js` `store()` — inside Playables the SDK is the sole mechanism; `localStorage` is used only when the SDK is absent |
| `loadData()` awaited before `saveData()` | `canSave` stays `false` until the load promise settles; `store()` returns early before that |
| Old saves must still load | `adopt()` parses defensively and falls back to defaults on anything unexpected |
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
| Touch targets | the one on-screen button is at least 44×44 css px and sits clear of the steering area |
| No input dropped | one control, no held state to get stuck |
| Esc closes modals | help and pause both close on Esc |
| No `preventDefault()` on Esc | the Esc branch returns before any other handling |
| Crisp at every resolution | the canvas backing store is sized in device pixels and the context scaled to match; re-runs on resize and on density change |
| Communicates end of content | the run is endless by design and says so; the run-over screen shows the distance and the best |
| No sharing prompts / external links / extra agreements / quit button | none present |
| No icon clashing with platform controls | the in-game button is a ☰ menu glyph, not a pause symbol |

## Privacy and data

No external calls other than the SDK itself. The webfont is embedded as a
data URI in `css/font.css` (Baloo 2, SIL OFL 1.1) precisely so nothing is
fetched at runtime. No clipboard access, no personal data, no login-like
screens, no QR-like graphics, no obfuscation, single page application, and no
`eval`, WebAssembly or Web Workers.

## Stability and performance

| Limit | This game |
|---|---|
| Initial bundle < 30 MiB (< 15 recommended) | 111 KB |
| Individual file < 30 MiB (< 512 KiB recommended) | largest is `css/font.css`, 44 KB |
| Saved game < 3 MiB (< 500 KiB recommended) | ~50 bytes |
| Load and interactive < 5 s | no assets to fetch; interactive on the first frame |
| At most 8000 files | 7 |
| Only relative paths | yes, the SDK URL aside |
| File names `[A-Za-z0-9_.-]` | yes |
| Standards-compliant Web APIs | Canvas 2D, WebAudio, Pointer Events |

## Left for you in the Developer Portal

Title, description, category, age rating, thumbnails and the privacy policy
link are portal-side metadata — they are not part of the bundle.
