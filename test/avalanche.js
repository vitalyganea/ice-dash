/* ===========================================================
   avalanche.js — the open hill with the snow coming down behind
   -----------------------------------------------------------
   A lead to start with, snow a fixed share faster than a clean rider,
   crystal rings that knock it back, crashes that cost lead instead of the
   run. It must close in, pay out for rings, charge for crashes without
   ending the run or touching a spare life, end when the snow arrives —
   and it must END: a ring is worth less as the hill hardens, so even a
   rider who takes every one is caught eventually.
   Freeride must not change at all: Avalanche rolls no dice of its own.
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
/* Clear the hill just ahead, so a check about the snow is not ended early
   by a boulder the simple steering above happened to miss. */
function clearAhead(W) {
  for (var i = W.objects.length - 1; i >= 0; i--) {
    var o = W.objects[i];
    if (o.t === 'rock' || o.t === 'tree' || o.t === 'crevasse' || o.t === 'ramp' ||
        o.t === 'geyser' || o.t === 'nunatak' || o.t === 'drift' || o.t === 'gate')
      W.objects.splice(i, 1);
  }
}

/* ---- A. the snow closes in ---------------------------------- */
console.log('A. a lead to start with, and the snow closing it');
H.setSeed(7);
G.start(0, {}, 'snowcap', null, 2, { mode: 'avalanche' });
var W = G.debug();
var g0 = W.avGap;
ok(W.mode === 'avalanche' && g0 >= 400, 'starts with a lead on the snow (' + Math.round(g0 / 8) + ' m)');
for (var f = 0; f < 300; f++) { clearAhead(G.debug()); H.frames(1); }
W = G.debug();
ok(W.state === 'run' && W.avGap < g0 && W.avGap > g0 - 200,
   'five seconds of clean riding loses a little of it, not all (' + Math.round(g0 / 8) + ' -> ' + Math.round(W.avGap / 8) + ' m)');
G.stop();

/* ---- B. Freeride is untouched --------------------------------- */
console.log('\nB. the same hill as Freeride');
function rowsOf(seed, opts) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', null, 0, opts);
  for (var i = 0; i < 400; i++) { var w = G.debug(); steer(w); clearAhead(w); H.frames(1); }
  var w2 = G.debug(), sig = w2.rows.map(function (r) { return Math.round(r.d) + ':' + Math.round(r.gap); }).join('|');
  G.stop();
  return sig;
}
ok(rowsOf(33) === rowsOf(33, { mode: 'avalanche' }), 'Avalanche draws the very same hill Freeride does');

/* ---- C. a ring knocks it back --------------------------------- */
console.log('\nC. a crystal ring knocks the snow back');
H.setSeed(8);
G.start(0, {}, 'snowcap', null, 2, { mode: 'avalanche' });
H.frames(5);
W = G.debug(); clearAhead(W);
var gBefore = W.avGap;
W.objects.push({ t: 'gate', x: W.px, d: W.dist + 12, w: 60, passed: false });
H.frames(10);
W = G.debug();
ok(W.gates === 1 && W.avGap > gBefore + 150, 'taking one wins back lead (+' + Math.round((W.avGap - gBefore) / 8) + ' m)');
W.avGap = 5000;
W.objects.push({ t: 'gate', x: W.px, d: W.dist + 12, w: 60, passed: false });
H.frames(10);
ok(G.debug().avGap <= 900, 'but the lead it banks has a ceiling (' + Math.round(G.debug().avGap / 8) + ' m)');
G.stop();

/* ---- D. a crash costs lead, not the run ----------------------- */
console.log('\nD. a crash costs lead, not the run');
H.setSeed(9);
G.start(0, {}, 'snowcap', null, 2, { mode: 'avalanche' });
H.frames(5);
W = G.debug(); clearAhead(W);
W.objects.push({ t: 'rock', x: W.px, d: W.dist + 6, r: 30, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
for (f = 0; f < 60 && G.debug().state === 'run'; f++) H.frames(1);
ok(G.debug().state === 'crash', 'a boulder still stops him');
var gCrash = G.debug().avGap;
H.frames(40);
W = G.debug();
ok(W.state === 'run', 'and he is put back on the hill a beat later');
ok(gCrash - W.avGap >= 100, 'with the snow nearer for it (' + Math.round((gCrash - W.avGap) / 8) + ' m lost)');
ok(W.lives === 2 && W.revives === 0, 'and no spare life spent (' + W.lives + ' still in hand)');
G.stop();

/* ---- E. deep snow costs lead ----------------------------------- */
console.log('\nE. deep snow costs lead');
function leadAfter(bog) {
  H.setSeed(10);
  G.start(0, {}, 'snowcap', null, 0, { mode: 'avalanche' });
  for (var i = 0; i < 120; i++) { var w = G.debug(); clearAhead(w); if (bog) w.bog = 2; H.frames(1); }
  var g = G.debug().avGap; G.stop(); return g;
}
var clean = leadAfter(false), bogged = leadAfter(true);
ok(bogged < clean - 60, 'two seconds wading loses lead a clean rider keeps (' +
   Math.round(clean / 8) + ' vs ' + Math.round(bogged / 8) + ' m)');

/* ---- F. caught ends it ----------------------------------------- */
console.log('\nF. when the snow arrives, the run is over');
var over = null;
H.setSeed(11);
G.start(0, { over: function (r) { over = r; } }, 'snowcap', null, 2, { mode: 'avalanche' });
G.debug().avGap = 3;
for (f = 0; f < 200 && !over; f++) { G.debug() && G.debug().bog !== undefined && (G.debug().bog = 2); H.frames(1); }
ok(over && over.mode === 'avalanche' && over.caught, 'the results arrive, marked as caught in Avalanche');
ok(over && !over.finished && !over.canRevive, 'with no revive offered, spare lives or not');
G.stop();

/* ---- G. it ends, even for the best rider ---------------------- */
console.log('\nG. rings are worth less as the hill hardens, so every run ends');
function ride(seed, takeAll) {
  H.setSeed(seed);
  var res = null;
  G.start(0, { over: function (x) { res = x; } }, 'snowcap', null, 0, { mode: 'avalanche' });
  for (var fr = 0; fr < 40000 && !res; fr++) {
    var w = G.debug(); if (!w) break;
    if (w.state === 'run') {
      /* nothing to hit, so the only thing that ends it is the snow */
      for (var i = w.objects.length - 1; i >= 0; i--) {
        var o = w.objects[i];
        if (o.t === 'rock' || o.t === 'tree' || o.t === 'crevasse' || o.t === 'ramp' ||
            o.t === 'geyser' || o.t === 'nunatak' || o.t === 'drift') w.objects.splice(i, 1);
        else if (o.t === 'gate' && !o.passed && o.d < w.dist + 8) {
          if (takeAll) o.x = w.px; else w.objects.splice(i, 1);
        }
      }
      steer(w);
    }
    H.frames(1);
  }
  G.stop();
  return res ? res.dist : -1;
}
/* Without rings the run is the same on every hill — the snow's pace
   follows the clean pace, which depends only on distance — so one is
   enough; with them it depends on where the rings fall, so two. */
var none = [ride(500, false)], all = [ride(500, true), ride(517, true)];
function med(a) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[0]; }
ok(none.every(function (d) { return d > 0; }) && all.every(function (d) { return d > 0; }),
   'every run reached the end, rings or none (' + none.join('m, ') + 'm / ' + all.join('m, ') + 'm)');
ok(med(none) >= 400 && med(none) <= 900, 'clean riding without a ring is a short run (' + med(none) + 'm)');
ok(med(all) >= med(none) * 2, 'and taking every ring makes it a much longer one (' + med(all) + 'm)');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'avalanche checks passed'));
process.exit(fail ? 1 : 0);
