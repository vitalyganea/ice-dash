/* ===========================================================
   timerush.js — the open hill against a clock
   -----------------------------------------------------------
   Twenty seconds to start, three back for every clock bubble, five
   taken for a crash instead of the run. It must count down, pay out,
   charge for crashes without ending the run or touching a spare life,
   end when the time does — and it must END: clocks thin out as the hill
   hardens, so even a rider who takes every one runs dry eventually.
   Freeride must not change at all: the clocks are only rolled for here.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT;

function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
function steer(W) {
  var r = nextRow(W); if (!r) return;
  var t = G._chuteAt(r.d) + r.gap;
  var fr = Math.max(1, Math.round((r.d - W.dist) / W.speed));
  var tr = G._turnRate();
  function m(d) { var x = W.px, v = W.vx;
    for (var k = 0; k < fr; k++) { v += (d * DRIFT * W.speed - v) * tr; x += v; }
    return Math.abs(x - t); }
  if (m(-W.dir) < m(W.dir) - 6) G.tap();
}

/* ---- A. the clock ------------------------------------------- */
console.log('A. it counts down from twenty seconds');
H.setSeed(7);
G.start(0, {}, 'snowcap', null, 2, { mode: 'rush' });
var W = G.debug();
ok(W.mode === 'rush' && W.timeT === 20 * 60, 'starts on 20.0s (' + (W.timeT / 60).toFixed(1) + ')');
H.frames(60);
ok(Math.abs(G.debug().timeT - 19 * 60) <= 6, 'one second later it reads 19.0s (' + (G.debug().timeT / 60).toFixed(2) + ')');
G.stop();

/* ---- B. clocks are on the hill, and only in Time Rush ------- */
console.log('\nB. clock bubbles, and only here');
function clocksSeen(mode, seed) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', null, 0, mode ? { mode: mode } : undefined);
  var seen = {};
  for (var f = 0; f < 1500; f++) {
    var w = G.debug(); if (!w || w.state !== 'run') break;
    steer(w);
    w.objects.forEach(function (o) { if (o.t === 'clock') seen[o.d] = 1; });
    H.frames(1);
  }
  G.stop();
  return Object.keys(seen).length;
}
var nRush = clocksSeen('rush', 21), nFree = clocksSeen(null, 21);
ok(nRush >= 5, 'a Time Rush hill has clock bubbles on it (' + nRush + ' in 25 seconds)');
ok(nFree === 0, 'Freeride has none (' + nFree + ')');
/* Same seed, same hill: the clocks must not shift Freeride's dice. */
function freeRows(seed, opts) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', null, 0, opts);
  var w = G.debug(), sig = w.rows.map(function (r) { return Math.round(r.d) + ':' + Math.round(r.gap); }).join('|');
  G.stop();
  return sig;
}
ok(freeRows(33) === freeRows(33, { mode: 'free' }), 'and Freeride draws the very same hill it always did');

/* ---- C. pay and penalty ------------------------------------- */
console.log('\nC. a bubble pays three seconds, a crash costs five');
H.setSeed(8);
G.start(0, {}, 'snowcap', null, 2, { mode: 'rush' });
H.frames(5);
W = G.debug();
W.objects.push({ t: 'clock', x: W.px, d: W.dist + 15, r: 21, got: false, ph: 0 });
var t0 = W.timeT;
H.frames(10);
ok(G.debug().timeT >= t0 + 3 * 60 - 12, 'taking one adds three seconds (' + ((G.debug().timeT - t0) / 60).toFixed(2) + 's)');
W = G.debug();
var tBefore = W.timeT;
W.objects.push({ t: 'rock', x: W.px, d: W.dist + 6, r: 30, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
for (var f = 0; f < 60 && G.debug().state === 'run'; f++) H.frames(1);
ok(G.debug().state === 'crash', 'a boulder still stops him');
var tAtCrash = G.debug().timeT;
H.frames(40);
W = G.debug();
ok(W.state === 'run', 'and he is put back on the hill a beat later');
ok(tAtCrash - W.timeT >= 5 * 60, 'having paid five seconds for it (' + ((tAtCrash - W.timeT) / 60).toFixed(1) + 's gone)');
ok(W.lives === 2 && W.revives === 0, 'and no spare life (' + W.lives + ' still in hand)');
G.stop();

/* ---- D. time up ends it -------------------------------------- */
console.log('\nD. when the time is gone, so is the run');
var over = null;
H.setSeed(9);
G.start(0, { over: function (r) { over = r; } }, 'snowcap', null, 2, { mode: 'rush' });
G.debug().timeT = 30;
for (f = 0; f < 200 && !over; f++) { G.debug() && G.debug().objects.splice(0); H.frames(1); }
ok(over && over.mode === 'rush', 'the results arrive, marked as Time Rush');
ok(over && !over.finished && !over.canRevive, 'with no revive offered — there was no crash to walk back');

/* ---- E. it ends, even for the best rider -------------------- */
console.log('\nE. clocks thin out, so every run ends');
var dists = [];
for (var r = 0; r < 4; r++) {
  H.setSeed(400 + r * 13);
  over = null;
  G.start(0, { over: function (x) { over = x; } }, 'snowcap', null, 0, { mode: 'rush' });
  for (f = 0; f < 120000 && !over; f++) {
    var w2 = G.debug(); if (!w2) break;
    if (w2.state === 'run') {
      /* the best possible collector: every clock in reach is taken */
      for (var i = 0; i < w2.objects.length; i++)
        if (w2.objects[i].t === 'clock' && !w2.objects[i].got && w2.objects[i].d < w2.dist + 8 && w2.objects[i].d > w2.dist - 8)
          w2.objects[i].x = w2.px;
      steer(w2);
    }
    H.frames(1);
  }
  dists.push(over ? over.dist : -1);
  G.stop();
}
ok(dists.every(function (d) { return d > 0; }), 'every run reached the end (' + dists.join('m, ') + 'm)');
var med = dists.slice().sort(function (a, b) { return a - b; })[1];
ok(med >= 600, 'and a rider who takes every clock gets a proper run out of it (' + med + 'm)');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'time rush checks passed'));
process.exit(fail ? 1 : 0);
