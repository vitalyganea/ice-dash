/* ===========================================================
   yandex/media.js — the Yandex Games console's pictures, from the real game
   -----------------------------------------------------------
   Run build-yandex.sh first. Writes, next to this file:
     icon-512.png                       512x512, from assets/icon-only.png
     cover-800x470.png                  a live run with the logo over it
     screenshots/desktop/{ru,en}/*.png  1920x1080, gameplay only
     screenshots/mobile/{ru,en}/*.png   1080x1920, gameplay only
     video/gameplay-16x9.mp4            1920x1080, 25 s  (with --video)
     video/gameplay-9x16.mp4            1080x1920, 25 s  (with --video)
   Yandex wants real play over at least 70% of every screenshot and
   video, so every one of them is taken mid-run.
     node yandex/media.js [--cover | --video | --video-only]
   The work is done by tools/media-lib.js.
   =========================================================== */
var path = require('path'), fs = require('fs');
var M = require('../tools/media-lib.js');
var HERE = __dirname, ROOT = path.join(HERE, 'game'), REPO = path.join(HERE, '..');
var arg = function (a) { return process.argv.indexOf(a) >= 0; };
/* how far into the run the cover is taken: the hill is full by then */
var COVER_AT = +(process.env.COVER_AT || 8000);

/* Gameplay only. ride: index into BIOMES to hold the run in (null = wherever). */
var SCENES = [
  { name: '1-freeride',      click: '#btn-free',  ride: 'null', wait: 7000, then: 'Game.debug().combo=23' },
  { name: '2-crystal-caves', click: '#btn-free',  ride: '12',   wait: 6500, equip: 'puffin' },
  { name: '3-time-rush',     click: '#btn-rush',  ride: 'null', wait: 5000, equip: 'otter' },
  { name: '4-neon',          click: '#btn-free',  ride: '13',   wait: 6500, equip: 'orca' },
  { name: '5-avalanche',     click: '#btn-av',    ride: '3',    wait: 6000, equip: 'leopard' },
  { name: '6-frozen-jungle', click: '#btn-free',  ride: '10',   wait: 6500, equip: 'seal' }
];
var SHAPES = {
  desktop: { width: 960, height: 540, deviceScaleFactor: 2, mobile: false },
  mobile:  { width: 540, height: 960, deviceScaleFactor: 2, mobile: true }
};

async function screenshots(S) {
  var made = [];
  for (var shape in SHAPES) for (var lang of ['ru', 'en']) {
    var dir = M.mkdir(path.join(HERE, 'screenshots', shape, lang));
    for (var sc of SCENES) {
      var tab = await S.open(SHAPES[shape], Object.assign({}, M.SAVE, { lang: lang }, sc.equip ? { equipped: sc.equip } : {}));
      await tab.ev("document.querySelector(" + JSON.stringify(sc.click) + ").click()");
      await tab.ev(M.RIDE + "(" + sc.ride + ")");
      await M.sleep(sc.wait);
      if (sc.then) { await tab.ev(sc.then); await M.sleep(300); }
      var f = path.join(dir, sc.name + '.png');
      await S.shoot(tab, f); made.push(f);
      console.log('  screenshots/' + shape + '/' + lang + '/' + sc.name + '.png');
      await S.close(tab);
    }
  }
  M.flatten(made);
}

(async function main() {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.error('run build-yandex.sh first'); process.exit(1); }
  var S = await M.start(ROOT, 8861, 9361);
  if (!arg('--video-only')) {
    M.icon(path.join(REPO, 'assets', 'icon-only.png'), path.join(HERE, 'icon-512.png'), 512);
    console.log('  icon-512.png');
    await S.cover({ file: path.join(HERE, 'cover-800x470.png'), w: 800, h: 470, scale: 1,
                    at: COVER_AT, place: 'side', logoW: 38, lang: 'ru' });
    console.log('  cover-800x470.png');
    if (!arg('--cover')) await screenshots(S);
  }
  if (arg('--video') || arg('--video-only')) {
    M.mkdir(path.join(HERE, 'video'));
    for (var v of [['gameplay-16x9.mp4', SHAPES.desktop], ['gameplay-9x16.mp4', SHAPES.mobile]]) {
      var r = await S.video({ file: path.join(HERE, 'video', v[0]), shape: v[1], secs: 25, lang: 'ru' });
      console.log('  video/' + v[0] + '  (' + r.frames + ' frames, ' + r.fps.toFixed(1) + ' fps captured)');
    }
  }
  S.stop();
})().catch(function (e) { console.error(e); process.exit(1); });
