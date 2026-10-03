/* ===========================================================
   tutorial.js — does the first-run tutorial actually teach?
   -----------------------------------------------------------
   The tutorial is a marked line with lessons hung on its rows. It has to
   hold the hill until the first tap, stop and wait for the first two
   taps rather than hope for them, show every lesson once and in order,
   and get ANY player to the finish — including one who never steers —
   without spending a life.
   =========================================================== */
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

/* ---- A. it is a course of its own --------------------------- */
console.log('A. kept apart from the marked runs');
ok(COURSES.every(function (c) { return c.id !== 'tutorial'; }),
   'not in COURSES, so no stars, not in Known Lines, not on the way to Freeride');
ok(courseById('tutorial') === TUTORIAL, 'but it can still be ridden by id');
var rows = parseCourse(TUTORIAL, K.CHUTE);
var grip = BIOMES[TUTORIAL.biome].grip, bad = 0;
for (var i = 1; i < rows.length; i++) {
  var speed = Math.min(K.SPEED_MAX, 3.0 + (320 + i * TUTORIAL.step) * 0.000155);
  var fr = Math.max(1, Math.floor(TUTORIAL.step / speed)), x = 0, vx = -DRIFT * speed;
  for (var k = 0; k < fr; k++) { vx += (DRIFT * speed - vx) * TURN * grip; x += vx; }
  if (Math.abs(rows[i].gap - rows[i - 1].gap) > x) bad++;
}
ok(bad === 0, 'every one of its ' + rows.length + ' rows is inside the physics (' + bad + ' impossible)');
var keys = Object.keys(TUTORIAL.lessons).map(Number);
ok(keys.every(function (r) { return r < rows.length; }), 'every lesson hangs on a row that exists');

/* ---- B. the hill waits for the first tap -------------------- */
console.log('\nB. it holds still until the player is ready');
var heard = [];
H.setSeed(5);
G.start(0, { lesson: function (m) { heard.push(m); } }, 'snowcap', 'tutorial', 0);
H.frames(180);
var W = G.debug();
ok(W.dist === 0, 'three seconds in and the hill has not moved (' + W.dist + ')');
ok(heard.length && heard[0].key === 'tut.start' && heard[0].wait, 'and it says so: ' + (heard[0] && heard[0].key));
var dir0 = W.dir;
G.tap();
ok(W.dir === dir0, 'the first tap only lets it go — it does not turn him');
H.frames(30);
ok(G.debug().dist > 0, 'and then the hill moves');
G.stop();

/* ---- C. the first two taps are asked for, and waited for ---- */
console.log('\nC. the first two taps are taught, not hoped for');
heard = [];
H.setSeed(6);
G.start(0, { lesson: function (m) { heard.push(m); } }, 'snowcap', 'tutorial', 0);
G.tap();                                   // let it go
var waitedSlow = 0, waitFrames = 0, answered = 0;
for (var f = 0; f < 4000 && answered < 2; f++) {
  W = G.debug();
  if (W.tutWait) {
    waitFrames++;
    if (W.speed < 0.6) waitedSlow++;
    /* a slow new player: half a second to read it, then the tap */
    if (waitFrames === 30) { G.tap(); answered++; waitFrames = 0; }
  }
  H.frames(1);
}
var asks = heard.filter(function (m) { return m.wait && m.key !== 'tut.start'; });
ok(asks.length >= 1 && (asks[0].key === 'tut.left' || asks[0].key === 'tut.right'),
   'the first opening asks for a tap in a direction (' + asks.map(function (m) { return m.key; }).join(', ') + ')');
ok(waitedSlow >= 29, 'and while it waits the hill all but stops (' + waitedSlow + ' slow frames)');
ok(heard.some(function (m) { return m.key === 'tut.nice'; }), 'a tap the right way is answered ("tut.nice")');
G.stop();

/* ---- D. every lesson, once, in order, to the finish --------- */
console.log('\nD. a careful rider sees every lesson and finishes');
function ride(player, seed) {
  var got = [], over = null;
  H.setSeed(seed);
  G.start(0, { lesson: function (m) { got.push(m); }, over: function (r) { over = r; } },
          'snowcap', 'tutorial', 0);
  G.tap();
  var wf = 0;
  for (var f = 0; f < 40000 && !over; f++) {
    var w = G.debug(); if (!w) break;
    if (w.state === 'run') {
      if (w.tutWait) { if (++wf === 24) { G.tap(); wf = 0; } }
      else if (player === 'bot') steer(w);
    }
    H.frames(1);
  }
  var end = G.debug();
  var res = { got: got, over: over, lives: end ? end.lives : -1, revives: end ? end.revives : -1 };
  G.stop();
  return res;
}
var r1 = ride('bot', 11);
var want = ['tut.weave', 'tut.fish', 'tut.gold', 'tut.bubble', 'tut.gate', 'tut.bridge',
            'tut.crevasse', 'tut.finish'];
var seen = r1.got.map(function (m) { return m.key; });
var order = want.map(function (k) { return seen.indexOf(k); });
ok(order.every(function (p) { return p >= 0; }), 'every lesson is shown (' + want.filter(function (k, j) { return order[j] < 0; }).join(', ') + ' missing)');
ok(order.every(function (p, j) { return j === 0 || p > order[j - 1]; }), 'and in the order the hill meets them');
ok(want.every(function (k) { return seen.filter(function (s) { return s === k; }).length === 1; }),
   'and each one only once');
ok(r1.over && r1.over.finished && r1.over.course === 'tutorial', 'the careful rider crosses the finish');

/* ---- E. nobody can fail out of it --------------------------- */
console.log('\nE. a player who never steers still gets to the end');
var r2 = ride('passive', 12);
var oops = r2.got.filter(function (m) { return m.key === 'tut.oops'; }).length;
ok(r2.over && r2.over.finished, 'they reach the finish (' + oops + ' crash(es) on the way)');
ok(oops > 0, 'having actually crashed — so the put-back was exercised');
ok(r2.lives === 0 && r2.revives === 0, 'and no life was spent doing it (lives ' + r2.lives + ', revives ' + r2.revives + ')');
ok(r2.over && !r2.over.canRevive, 'the end card never offers a revive for a lesson');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'tutorial checks passed'));
process.exit(fail ? 1 : 0);
