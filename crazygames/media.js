/* ===========================================================
   crazygames/media.js — the CrazyGames covers and videos, from the real game
   -----------------------------------------------------------
   Run build-crazygames.sh first. Writes, next to this file:
     covers/cover-1920x1080.png    landscape, 16:9
     covers/cover-800x1200.png     portrait, 2:3
     covers/cover-800x800.png      square, 1:1
     video/preview-16x9.mp4        1920x1080, 18 s  (with --video)
     video/preview-2x3.mp4         1080x1620, 18 s  (with --video)
   CrazyGames' rules: nothing written on a cover but the title, no icons,
   logos of stores or borders; a video of 15-20 s, under 50 MB, without
   sound, opening on the cover. Every cover is a live run with the title
   logo over it, the score cut away.
     node crazygames/media.js [--video | --video-only]
   The work is done by tools/media-lib.js.
   =========================================================== */
var path = require('path'), fs = require('fs');
var M = require('../tools/media-lib.js');
var HERE = __dirname, ROOT = path.join(HERE, 'game');
var arg = function (a) { return process.argv.indexOf(a) >= 0; };
var COVER_AT = +(process.env.COVER_AT || 8000);

var COVERS = [
  { file: 'cover-1920x1080.png', w: 1920, h: 1080, scale: 2,   place: 'side', logoW: 38 },
  { file: 'cover-800x1200.png',  w: 800,  h: 1200, scale: 1.5, place: 'top',  logoW: 78, top: 0.05 },
  { file: 'cover-800x800.png',   w: 800,  h: 800,  scale: 1,   place: 'top',  logoW: 52, top: 0.04 }
];

(async function main() {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.error('run build-crazygames.sh first'); process.exit(1); }
  var S = await M.start(ROOT, 8881, 9381);
  var dir = M.mkdir(path.join(HERE, 'covers'));
  if (!arg('--video-only')) {
    for (var c of COVERS) {
      await S.cover(Object.assign({ at: COVER_AT, lang: 'en' }, c, { file: path.join(dir, c.file) }));
      console.log('  covers/' + c.file);
    }
  }
  if (arg('--video') || arg('--video-only')) {
    M.mkdir(path.join(HERE, 'video'));
    var V = [
      ['preview-16x9.mp4', { width: 960, height: 540, mobile: false }, 'cover-1920x1080.png'],
      ['preview-2x3.mp4',  { width: 540, height: 810, mobile: true },  'cover-800x1200.png']
    ];
    for (var v of V) {
      var r = await S.video({ file: path.join(HERE, 'video', v[0]), shape: v[1], secs: 17, lang: 'en',
                              still: path.join(dir, v[2]), stillSecs: 1, crf: 23, seq: [0, 12, 13, 10] });
      console.log('  video/' + v[0] + '  (' + r.frames + ' frames, ' + r.fps.toFixed(1) + ' fps captured)');
    }
  }
  S.stop();
})().catch(function (e) { console.error(e); process.exit(1); });
