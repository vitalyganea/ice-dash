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
- Every string goes through `js/i18n.js` in English, Russian and Romanian (the `RO` block).
- Must fill the viewport at every aspect ratio from 9:32 to 32:9, and work with
  mouse and touch.
- `PLAYABLES.md` lists every certification requirement and where it is met. Keep it true.

## Checking

```bash
bash test/run.sh            # all fast suites (node only)
bash test/run.sh courses    # one suite
node test/ladder.js         # slow; run when skins/prices change
node test/playtest.js       # real Chrome, both platforms
bash build.sh               # builds icedash.zip from an allowlist
```

A new runtime file must be added to the `FILES` list in `build.sh`, or it will
not ship (to Playables or to the Android app — `build-android.sh` reads the
same list).

## Android

Capacitor in `android/`. `npm run android:sync`, then in `android/`
`./gradlew assembleDebug` or `bundleRelease`, with `JAVA_HOME` set to JDK 21
(Android Studio's bundled Java 25 is too new for this Gradle). `js/native.js`
is the only Android-only code. The upload key lives outside the repo.
