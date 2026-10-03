/* The viewport must cover the screen exactly at every device shape, while
   still showing the whole ice run. Bars are not just ugly here: anything
   outside the drawing surface used to swallow taps. */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var SHAPES = [
  ['iPhone portrait',      390,  844],
  ['iPhone landscape',     844,  390],
  ['Pixel tall portrait',  360, 1280],
  ['tablet portrait',      768, 1024],
  ['tablet landscape',    1024,  768],
  ['laptop',              1440,  900],
  ['1080p',               1920, 1080],
  ['ultrawide 21:9',      3440, 1440],
  ['superwide 32:9',      5120, 1440],
  ['sliver 9:32',          360, 1280],
  ['tiny',                 320,  480],
  ['square',               800,  800]
];

/* the engine wires itself up lazily on the first run, so kick it once */
H.setSeed(1); G.start(0, {}); G.stop();

var byId = H.byId;
var stage = byId['stage'], canvas = byId['game'];
var worstFill = 0, minClearAhead = 1e9, rows = [];

SHAPES.forEach(function (s) {
  var name = s[0], w = s[1], h = s[2];
  global.window.innerWidth = w; global.window.innerHeight = h;
  global.window.devicePixelRatio = 2;
  G.resize();
  var K = G._consts();

  var sw = parseFloat(stage.style.width), sh = parseFloat(stage.style.height);
  var fillErr = Math.max(Math.abs(sw - w), Math.abs(sh - h));
  worstFill = Math.max(worstFill, fillErr);

  var kx = canvas.width / K.VIEW_W, ky = canvas.height / K.VIEW_H;
  var aspectErr = Math.abs(kx - ky) / kx;

  var chuteFits = 2 * K.CHUTE + 2 * K.PR <= K.VIEW_W;
  var ahead = K.PLAYER_Y;
  minClearAhead = Math.min(minClearAhead, ahead);

  rows.push({ name: name, w: w, h: h, vw: K.VIEW_W, vh: K.VIEW_H,
              fill: fillErr, aspect: aspectErr, chute: chuteFits, ahead: ahead });
  console.log('  ' + name.padEnd(18) + String(w).padStart(5) + 'x' + String(h).padEnd(6) +
              ' world ' + String(K.VIEW_W).padStart(5) + 'x' + String(K.VIEW_H).padEnd(6) +
              ' fill-err ' + fillErr.toFixed(1) + 'px' +
              '  squash ' + (aspectErr * 100).toFixed(3) + '%' +
              '  chute ' + (chuteFits ? 'fits' : 'CUT') +
              '  ahead ' + ahead);
});

console.log('');
ok(worstFill <= 1, 'the stage covers the screen at every shape (worst gap ' +
   worstFill.toFixed(1) + 'px)');
ok(rows.every(function (r) { return r.aspect < 0.005; }),
   'the picture is never squashed (pixels stay square)');
ok(rows.every(function (r) { return r.chute; }),
   'the full width of the run is visible at every shape');
ok(rows.every(function (r) { return r.ahead >= 330; }),
   'there is always a usable amount of hill ahead (least ' + minClearAhead + ' units)');
ok(rows.every(function (r) { return r.vw >= 680 && r.vh >= 540; }),
   'the safe region is never cropped');

/* The run must still behave after a mid-run reshape. Steer while doing it:
   left alone the penguin drifts into the first rock and the test would be
   measuring a crash rather than a rotation. */
var KK = G._consts();
function steer() {
  var W = G.debug(); if (!W || W.state !== 'run') return;
  var row = null;
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) { row = W.rows[i]; break; }
  if (!row) return;
  var t = G._chuteAt(row.d) + row.gap;
  var fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
  function m(dir) {
    var x = W.px, v = W.vx;
    for (var k = 0; k < fr; k++) { v += (dir * KK.DRIFT * W.speed - v) * KK.TURN; x += v; }
    return Math.abs(x - t);
  }
  if (m(-W.dir) < m(W.dir) - 6) G.tap();
}

global.window.innerWidth = 1920; global.window.innerHeight = 1080;
G.resize();
H.setSeed(11); G.start(0, {});
for (var fi = 0; fi < 120; fi++) { steer(); H.frames(1); }
var before = G.debug();
var d0 = before.dist, px0 = before.px, sc0 = before.score;
global.window.innerWidth = 390; global.window.innerHeight = 844;
G.resize();
var after = G.debug();
ok(after && after.state === 'run', 'the run survives a rotation mid-slide');
ok(after.dist === d0 && after.px === px0 && after.score === sc0,
   'reshaping moves nothing: distance, position and score are untouched');
for (fi = 0; fi < 240; fi++) { steer(); H.frames(1); }
var later = G.debug();
ok(later.state === 'run',
   'it is still running 240 frames after the reshape (' +
   Math.round(later.dist / 8) + 'm)');
ok(later.objects.length > 0, 'obstacles still spawn into the taller view (' +
   later.objects.length + ' alive)');
G.stop();

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'viewport checks passed'));
process.exit(fail ? 1 : 0);
