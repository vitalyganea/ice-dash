/* The bubble says it takes one crash for you. Does it, for every kind? */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT, TURN = K.TURN;

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

/* ---- hitting a boulder while shielded ---- */
var rockSaved = 0, rockDied = 0, rockTries = 0;
for (var s = 0; s < 30 && rockTries < 10; s++) {
  H.setSeed(600 + s * 41);
  G.start(0, {}, 'bubbles');                        // starts inside a bubble
  var hadShield = G.debug().shield;
  var savedBefore = 0;
  for (var f = 0; f < 9000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    /* drift into the wall side on purpose, but stay out of crevasses */
    var crev = null;
    for (var i = 0; i < W.objects.length; i++)
      if (W.objects[i].t === 'crevasse' && W.objects[i].d > W.dist) { crev = W.objects[i]; break; }
    if (crev && crev.d - W.dist < 700) steer(W);    // take the ramp properly
    H.frames(1);
    var W2 = G.debug(); if (!W2) break;
    if (W2.saved > savedBefore) { savedBefore = W2.saved; break; }
    if (W2.state !== 'run') break;
  }
  var W3 = G.debug();
  if (hadShield && W3) {
    if (W3.saved > 0) { rockSaved++; rockTries++; }
    else if (W3.state === 'crash') { rockDied++; rockTries++; }
  }
  G.stop();
}
console.log('A. boulder, while shielded');
ok(rockTries > 0, 'set up ' + rockTries + ' shielded collisions');
ok(rockDied === 0, 'the bubble absorbed every one (' + rockSaved + ' saved, ' +
   rockDied + ' died outright)');

/* ---- falling into a crevasse while shielded ---- */
console.log('\nB. crevasse, while shielded');
var crevDied = 0, crevSaved = 0, crevTries = 0;
for (s = 0; s < 260 && crevTries < 8; s++) {
  H.setSeed(3000 + s * 67);
  G.start(0, {}, 'bubbles');
  var target = null;
  for (f = 0; f < 9000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    if (!target) {
      for (i = 0; i < W.objects.length; i++)
        if (W.objects[i].t === 'crevasse') { target = W.objects[i]; break; }
      steer(W);
    } else if (W.dist > target.d - 240) {
      /* deliberately sit on the bank so the ramp is missed */
      if (W.px < G._chuteAt(W.dist)) { if (W.dir > 0) G.tap(); }
      else if (W.dir < 0) G.tap();
    } else steer(W);
    /* Only count a fall where the bubble was STILL UP going in — it grants
       one save, and a rock earlier in the run can legitimately have taken
       it. Without this the test blamed the crevasse for deaths that were
       simply a player who had already spent their save. */
    var pre = G.debug();
    var armed = pre && pre.shield > 0;
    H.frames(1);
    var W2 = G.debug();
    if (target && W2 && W2.dist >= target.d && armed) {
      if (W2.state !== 'run') { crevTries++; crevDied++; break; }
      if (W2.dist > target.d + 120) { crevTries++; crevSaved++; break; }
    }
    if (W2 && W2.state !== 'run') { break; }
  }
  G.stop();
}
ok(crevTries >= 4, 'set up ' + crevTries + ' shielded falls');
ok(crevDied === 0, 'the bubble absorbed the fall too (' + crevSaved +
   ' saved, ' + crevDied + ' died outright)');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'shield checks passed'));
process.exit(fail ? 1 : 0);
