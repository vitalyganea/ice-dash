---
name: visual-qa
description: Visual quality pass for Ice Dasher — every word fits and is readable in all six languages and on every width, the HUD's painted words stay on screen, colours come from the shared tokens with enough contrast, and the creature portraits read as one family. Use before a release, after any change to menus, CSS, translations, HUD text or portraits, or when the user says text is cut, unreadable, ugly, uneven, or asks for a "visual check" / "verificare vizuală".
---

# Visual QA

The game is drawn from code, so nobody "sees" it unless a check does.
This pass is the eyes. Work through it in order and report what failed.

## 1. Words fit (automatic)

```bash
node test/textfit.js            # 6 languages x 360/390/412/1280; ~10 min
node test/textfit.js de 360     # one language, one width
SHOTS=1 node test/textfit.js ro 390   # also a picture of every screen that passed
PORT=8198 DPORT=9249 node test/textfit.js ...   # beside another run
```

Real Chrome walks every screen, tab and sheet (title, help, modes, runs,
market tabs, a creature's sheet owned and locked, trophies, settings,
language, profile tabs, dragon, event, pause, comic, revive, results) and
fails on: text cut with "…", text out of its button/pill/tab, clipped,
off screen, a button on 3+ lines, **low contrast** (WCAG 4.5:1, 3:1 for
big/bold text or a lone symbol), and — per phone width — **HUD words**
(COMBO / COMBO LOST beside the score, stretch names, PERFECT!/CLOSE!)
that would run under the pause button or off the screen.

Outlined screenshots of each failure: `test/out/textfit/`, list in
`report.json`. A new screen or sheet goes into `SCREENS` in the script
(a data-action to click, then selectors to click in order; `CRASH` lets a
run crash on its own). With `SHOTS=1`, look at the new screen's picture
once to be sure it really was reached.

**Fixing:** prefer a shorter, natural translation over a smaller font;
never shrink below 12px. Fix it in the language that fails, in
`js/i18n.js`, and keep `{placeholders}` (`bash test/run.sh i18n`).
Canvas words near an edge go through `onScreenX` in `js/game.js`.

## 2. Words read well (by eye, a person decides)

The checks above cannot judge meaning. For translation sense, tone and
terminology (one word per thing per language: spare life, golden fish,
creature, trophy, Freeride…), give a reviewer agent `js/i18n.js` and ask
for a short list per language. **Show the owner the list before changing
anything** — they speak Romanian and Russian and decide names.

## 3. Colours

- Tokens live at the top of `css/style.css` (`:root`: `--ink`, `--paper`,
  `--green(-dark)`, `--blue(-dark)`, `--purple(-dark)`, `--pink`,
  `--gold`, `--gold-dark`, `--gold-ink`) and in the button families
  (`.btn-blue` … `--hi/--face/--lo/--edge/--deep`).
- Text uses an `-ink`/`-dark` token, never a fill token: `--gold-dark` is
  for bars and fills; gold *words* on pale ground use `--gold-ink`.
- A new colour in CSS needs a reason; reuse a token first. Game art
  (`game.js`, `biomes.js`, `skins.js`, `portraits.js`) has its own
  palettes per creature/stretch and is exempt, but HUD text there uses
  the same deep blue `#062a78` outline as the buttons.

## 4. Portraits read as one family

Render all of them on one sheet and look:

```js
// in the page (index.html served), all portraits at 180px:
SKINS.forEach(s => { const c = document.createElement('canvas');
  drawPortrait(c, 180, s.id); document.body.appendChild(c); });
```

Compare framing (head size in the circle, nothing poking out), level of
detail, eye style, background, and stray shapes (flat grey ellipses).
**Never change a portrait without the owner's yes** — the musk ox's was
rolled back once (keep it as in 1.3.3).

## 5. Report

Which checks ran, at which languages/widths, what failed and what was
fixed, and the open list for the owner (translations, portraits).
