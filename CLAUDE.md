# Ice Dash

One-tap endless slide for **YouTube Playables**. Plain HTML + CSS + JS: no
libraries, no build step, no audio files. Everything is drawn on `<canvas>`
and every sound is synthesised with WebAudio. See `README.md` for the layout.

## Rules that are easy to break

- No dependencies and no external requests (the font is embedded in `css/font.css`).
- Inside Playables the save goes only through the SDK `saveData`, and only after
  `loadData()` has settled. `localStorage` is the fallback when the SDK is absent.
- Do not use the Page Visibility API. Pause/resume come only from `onPause`/`onResume`.
- No overall mute; audio stays subordinate to `isAudioEnabled()`.
- Every string goes through `js/i18n.js` in all six languages: English and Russian in
  the main table, then the `RO`, `ES`, `PT` (Brazilian) and `DE` blocks. `test/i18n.js`
  fails if any language is missing a key or changes its `{placeholders}` or tags.
- Must fill the viewport at every aspect ratio from 9:32 to 32:9, and work with
  mouse and touch.
- `PLAYABLES.md` lists every certification requirement and where it is met. Keep it true.

## Adding content (standing rules — apply without being asked)

- **A new stretch of hill (biome) gets a tune of its own.** Write a new mood in
  `js/audio.js` (note names via `line()` / `bars()`, its own key, lead voice and
  tempo, suited to the place) and name it in the biome's `mood:` field.
  `test/music.js` fails if a biome has no tune or shares one.
- **A new creature (skin) gets a perk no other creature has** — a new mechanic,
  not a reused perk in a different coat. Add the perk key in `js/game.js`,
  declare its direction in `test/skinsafe.js` (it may only make the hill more
  forgiving), give it a check in `test/perks.js` measured against Snowcap, and
  its name and perk text in every language. `test/perks.js` fails if a new
  creature only reuses existing perk keys, duplicates another's perk, or has no
  check. Only then add its id to `FOUNDING` in `test/perks.js`. It also needs
  an album feat in `js/album.js` (`ALBUM_FEAT`, tied to its perk) and its three
  stories in every language — `test/album.js` fails without them.

## Checking

```bash
bash test/run.sh            # all fast suites (node only)
bash test/run.sh courses    # one suite
node test/ladder.js         # slow; run when skins/prices change
node test/playtest.js       # real Chrome, both platforms
bash build.sh               # builds icedash.zip from an allowlist
```

A new runtime file must be added to the `FILES` list in `build.sh`, or it will
not ship (to Playables, to the Android app, to Yandex or to CrazyGames —
`build-android.sh`, `build-yandex.sh` and `build-crazygames.sh` read the same list).

## Android

Capacitor in `android/`. `npm run android:sync`, then in `android/`
`./gradlew assembleDebug` or `bundleRelease`, with `JAVA_HOME` set to JDK 21
(Android Studio's bundled Java 25 is too new for this Gradle). `js/native.js`
is the only Android-only code. The upload key lives outside the repo.

## Yandex Games

`bash build-yandex.sh` builds `yandex/game/` and `yandex/icedash-yandex.zip`
(Playables SDK swapped for `/sdk.js`, `js/yandex.js` added). `js/yandex.js` is
the only Yandex-only code: it answers the game's `window.ytgame` calls with
Yandex ones. It and `js/crazygames.js` are the only places allowed to watch
visibility (Yandex requires sound off when hidden); the game itself never does. `node yandex/media.js [--video]`
regenerates the console's icon, cover, screenshots and videos;
`yandex/README.md` says what goes where.

## CrazyGames

Same shape: `bash build-crazygames.sh` builds `crazygames/game/` and
`crazygames/icedash-crazygames.zip` (Playables SDK swapped for CrazyGames
SDK v3, `js/crazygames.js` added — the only CrazyGames-only code).
`node crazygames/media.js [--video]` makes the three covers and two preview
videos; `crazygames/README.md` has the upload steps. Both media scripts run
on `tools/media-lib.js`.
