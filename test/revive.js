/* ===========================================================
   revive.js — a spare life has to actually buy you something
   -----------------------------------------------------------
   The whole point of the feature is that you carry on from where you
   fell. Two ways that can quietly fail: the life is spent and you are
   dropped straight back onto the boulder that killed you, or the crevasse
   you fell into is still open under your feet — invulnerability covers
   boulders and trees but NOT crevasses, which are tested separately.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT;
/* The same aiming bot the other suites use: a revived player who never
   touches the screen dies the moment invulnerability lapses, and that is
   correct — it says nothing about whether reviving worked. */
function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
function steer(W) {
  var row = nextRow(W); if (!row) return;
  var t = G._chuteAt(row.d) + row.gap;
  var fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
  function miss(dir) {
    var x = W.px, v = W.vx, tr = G._turnRate();
    for (var k = 0; k < fr; k++) { v += (dir * DRIFT * W.speed - v) * tr; x += v; }
    return Math.abs(x - t);
  }
  if (miss(-W.dir) < miss(W.dir) - 6) G.tap();
}
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

function crashRun(seed, lives, courseId) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', courseId, lives);
  for (var f = 0; f < 6000; f++) {          // no taps: he finds the wall
    var W = G.debug();
    if (!W || W.state !== 'run') break;
    H.frames(1);
  }
  return G.debug();
}

console.log('A. a life is only offered when there is one, and only on a crash\n');
var seen = null;
H.setSeed(4); G.start(0, { over: function (r) { seen = r; } }, 'snowcap', null, 0);
for (var f = 0; f < 6000 && G.debug() && G.debug().state === 'run'; f++) H.frames(1);
H.frames(60);
ok(seen && seen.canRevive === false, 'with no lives in hand, no offer is made');
G.stop();

seen = null;
H.setSeed(4); G.start(0, { over: function (r) { seen = r; } }, 'snowcap', null, 2);
for (f = 0; f < 6000 && G.debug() && G.debug().state === 'run'; f++) H.frames(1);
H.frames(60);
ok(seen && seen.canRevive === true, 'with a life in hand, the offer is made');
var diedAt = G.debug().dist;
G.stop();

console.log('\nB. reviving puts him back on the hill, where he fell\n');
var W = crashRun(4, 2);
var before = W.dist, livesBefore = W.lives;
var okRev = G.revive();
var after = G.debug();
ok(okRev === true, 'revive() accepted');
ok(after.state === 'run', 'the run is going again');
ok(after.lives === livesBefore - 1, 'exactly one life was spent (' +
   livesBefore + ' -> ' + after.lives + ')');
ok(Math.abs(after.dist - before) < 1,
   'he carries on from where he fell (' + Math.round(after.dist) + ' vs ' +
   Math.round(before) + ')');
ok(after.invuln > 60, 'he gets a clear run-in (' + after.invuln + ' frames)');
ok(after.grace >= 170 && after.grace <= 190,
   'three seconds of it, give or take a frame (' + after.grace + ')');

console.log('\nC. and does not die again on the same obstacle\n');
var w0 = G.debug();
ok(w0 && w0.state === 'run', 'he is not dead on the very next frame');
var alive = 0;
for (f = 0; f < 1500; f++) {
  var w2 = G.debug();
  if (!w2 || w2.state !== 'run') break;
  steer(w2);
  H.frames(1);
  alive++;
}
/* Well past the 150 frames of invulnerability, so this is him surviving on
   the hill rather than on the timer. */
ok(alive >= 600, 'played on for ' + alive + ' frames after the revive');
G.stop();

console.log('\nD. the same holds for a crevasse, which invulnerability does not cover\n');
/* Gap Teeth is the course with crevasses; drive it badly enough to fall in. */
/* Aiming at the opening clears the ramp, so the ramp has to be missed on
   purpose: hug the bank as the crevasse comes up, the way crevasse.js does
   it, and he goes in. */
var fellIn = 0, survived = 0;
for (var s = 0; s < 40 && fellIn < 8; s++) {
  H.setSeed(1000 + s * 37);
  G.start(0, {}, 'snowcap', null, 1);
  var target = null, fell = false;
  for (f = 0; f < 9000; f++) {
    var w = G.debug();
    if (!w || w.state !== 'run') break;
    if (!target) {
      for (var i = 0; i < w.objects.length; i++)
        if (w.objects[i].t === 'crevasse') { target = w.objects[i]; break; }
      steer(w);
    } else if (w.dist > target.d - 400) {
      if (w.px < G._chuteAt(w.dist)) { if (w.dir > 0) G.tap(); }
      else if (w.dir < 0) G.tap();
    } else steer(w);
    H.frames(1);
    var w3 = G.debug();
    if (target && w3 && w3.state === 'crash' && w3.dist >= target.d - 40) { fell = true; break; }
    if (target && w3 && w3.dist > target.d + 220) { target = null; }   // survived it, look again
  }
  var w5 = G.debug();
  if (fell && w5 && w5.state === 'crash') {
    fellIn++;
    if (G.revive()) {
      var ok2 = true;
      for (var k = 0; k < 400; k++) {
        var w4 = G.debug();
        if (!w4 || w4.state !== 'run') { ok2 = false; break; }
        steer(w4);
        H.frames(1);
      }
      if (ok2) survived++;
    }
  }
  G.stop();
}
ok(fellIn > 0, 'set up ' + fellIn + ' crashes at a crevasse');
ok(fellIn === 0 || survived === fellIn,
   'every one of them carried on after reviving (' + survived + '/' + fellIn + ')');

console.log('\nE. the grace covers a crevasse, which plain invulnerability does not');

/* Last, because it ends by stopping the world. Dropped in between two
   earlier sections it left G.debug() null and the section after it failed
   on an empty world rather than on anything real. */
(function () {
  H.setSeed(31); G.start(0, {}, 'snowcap', null, 1);
  var w = G.debug();
  for (var f = 0; f < 600 && G.debug() && G.debug().state === 'run'; f++) {
    steer(G.debug()); H.frames(1);
  }
  w = G.debug();
  if (!w) { ok(false, 'could not set up a grace-vs-crevasse case'); return; }
  /* Both, the way revive() grants them: grace carries him over the hole,
     ordinary invulnerability keeps a boulder from finishing the job two
     seconds later. Setting only grace made this read as a failure when the
     crevasse had in fact been cleared perfectly well. */
  w.grace = 120; w.invuln = 120;
  /* drop a hole directly under him, well inside the grace */
  w.objects.push({ t: 'crevasse', x: G._chuteAt(w.dist + 60), d: w.dist + 60,
                   span: 150, passed: false });
  for (var k = 0; k < 90; k++) {
    var wk = G.debug(); if (!wk || wk.state !== 'run') break;
    steer(wk); H.frames(1);
  }
  var w2 = G.debug();
  ok(w2 && w2.state === 'run',
     'a crevasse met during the grace does not end the run');
  ok(w2 && w2.jumps > 0, 'the momentum carries him over it (' +
     (w2 ? w2.jumps : 0) + ' jump)');
  G.stop();
})();

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'revive checks passed'));
process.exit(fail ? 1 : 0);
