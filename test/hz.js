/* ===========================================================
   hz.js — smooth on every screen, 60, 90 and 120 Hz
   -----------------------------------------------------------
   The world steps sixty times a second whatever the screen does. On a
   faster screen, or an iPhone's ProMotion changing its rate as it goes,
   pictures painted only when a step had been taken stayed up for uneven
   lengths of time: the hill seemed to stutter (the owner's iPhone at
   120 Hz, 1.3.4). This drives the real loop with a screen's own uneven
   clock and looks at every picture painted: how long each stayed up, and
   how evenly the hill moved between them, as the eye sees it.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

function sim(gen, N) {
  H.setSeed(4); G.start(0, {}, 'snowcap', null, 0);
  for (var i = 0; i < 90; i++) { H.tick(1000 / 60); G.debug().invuln = 1e9; }
  var last = G._drawn(), shown = [], hold = 0;
  for (var k = 0; k < N; k++) {
    var ms = gen(k);
    H.tick(ms); G.debug().invuln = 1e9;
    hold += ms;
    var now = G._drawn();
    if (now.n !== last.n) { shown.push({ hold: hold, move: now.d - last.d }); last = now; hold = 0; }
  }
  G.stop();
  /* speed as seen: how far the hill moved since the last picture, over
     how long the last picture had been up */
  var v = shown.slice(1).map(function (p) { return p.move / p.hold; });
  var avg = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
  var dev = Math.sqrt(v.reduce(function (a, b) { return a + (b - avg) * (b - avg); }, 0) / v.length) / avg;
  var fps = shown.length / (shown.reduce(function (a, p) { return a + p.hold; }, 0) / 1000);
  return { dev: dev, fps: fps };
}
var r = 12345; function rnd() { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }
var acc = 0;
var SCREENS = [
  ['60 Hz', function () { return 1000 / 60; }],
  ['120 Hz, its clock out by up to 1 ms', function () { return 1000 / 120 + (rnd() - 0.5) * 2; }],
  ['120 Hz in whole milliseconds (Safari)', function () { var a = Math.round(acc); acc += 1000 / 120; return Math.round(acc) - a; }],
  ['ProMotion, between 80 and 120 Hz', function (k) { return (Math.floor(k / 37) % 2 ? 1000 / 80 : 1000 / 120) + (rnd() - 0.5); }],
  ['90 Hz', function () { return 1000 / 90; }]
];
SCREENS.forEach(function (S) {
  var o = sim(S[1], 1200);
  ok(o.dev < 0.06 && o.fps > 55, S[0] + ': the hill moves evenly, ±' + (o.dev * 100).toFixed(1) + '% from picture to picture, ' + o.fps.toFixed(0) + ' pictures a second');
});
console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'smooth on every screen'));
process.exit(fail ? 1 : 0);
