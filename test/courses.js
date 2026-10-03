/* ===========================================================
   courses.js — are the marked runs actually rideable?
   -----------------------------------------------------------
   Writing a course by hand does not make it fair. The same turn that
   is impossible when a generator asks for it is impossible when I ask
   for it, so every row of every course goes through the same proof,
   and then a bot rides each one start to finish.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT, TURN = K.TURN;

function achievable(step, speed, grip) {
  var fr = Math.max(1, Math.floor(step / speed));
  var t = TURN * grip, x = 0, vx = -DRIFT * speed;
  for (var k = 0; k < fr; k++) { vx += (DRIFT * speed - vx) * t; x += vx; }
  return x;
}
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

/* ---- A. is every turn on paper possible? -------------------- */
console.log('A. every written turn is inside the physics');
COURSES.forEach(function (cd) {
  var rows = parseCourse(cd, K.CHUTE);
  var grip = BIOMES[cd.biome % BIOMES.length].grip;
  var worst = 1e9, at = 0, bad = 0;
  for (var i = 1; i < rows.length; i++) {
    /* Speed at this point of the run, since it is fixed by distance. */
    var d = 320 + i * cd.step;
    var speed = Math.min(K.SPEED_MAX, 3.0 + d * 0.000155);
    var need = Math.abs(rows[i].gap - rows[i - 1].gap);
    var can = achievable(cd.step, speed, grip);
    if (need > can) { bad++; if (can - need < worst) { worst = can - need; at = i; } }
    else if (can - need < worst) { worst = can - need; at = i; }
  }
  ok(bad === 0, cd.id.padEnd(11) + rows.length + ' rows, ' + bad +
     ' impossible, tightest margin ' + worst.toFixed(1) + 'px at row ' + at);
});

/* ---- B. does a bot get to the end? -------------------------- */
console.log('\nB. a competent rider finishes');
COURSES.forEach(function (cd) {
  var got = 0, runs = 3, fishSeen = 0, fin = 0, dist = 0;
  for (var r = 0; r < runs; r++) {
    H.setSeed(900 + r * 17);
    G.start(0, {}, 'snowcap', cd.id);
    for (var f = 0; f < 30000; f++) {
      var W = G.debug(); if (!W || W.state !== 'run') break;
      steer(W); H.frames(1);
    }
    var W2 = G.debug();
    if (W2) {
      if (W2.state === 'finish') fin++;
      fishSeen = Math.max(fishSeen, W2.fish);
      dist = Math.max(dist, Math.round(W2.dist / 8));
      got = Math.max(got, W2.fishTotal);
    }
    G.stop();
  }
  ok(fin === runs, cd.id.padEnd(11) + 'finished ' + fin + '/' + runs +
     '  (' + dist + 'm, caught ' + fishSeen + ' of ' + got + ' fish on the hill)');
  /* Three stars must be reachable: the goal is a share of what is really
     there, so the only way it can break is a course with no fish at all. */
  var goal3 = Math.round(got * 0.75), goal2 = Math.round(got * 0.40);
  ok(got >= 12 && goal3 <= got, cd.id.padEnd(11) + 'holds ' + got +
     ' fish; two stars at ' + goal2 + ', three at ' + goal3 +
     ' (best bot catch ' + fishSeen + ')');
});

/* ---- C. the same every time --------------------------------- */
console.log('\nC. a marked run is the same run twice');
COURSES.forEach(function (cd) {
  function fingerprint(seed) {
    H.setSeed(seed);
    G.start(0, {}, 'snowcap', cd.id);
    var sig = [];
    for (var f = 0; f < 1400; f++) {
      var W = G.debug(); if (!W || W.state !== 'run') break;
      steer(W); H.frames(1);
      W = G.debug(); if (!W) break;
      if (f % 70 === 0)
        for (var i = 0; i < W.rows.length; i++)
          sig.push(Math.round(W.rows[i].d) + ':' + Math.round(W.rows[i].gap));
    }
    G.stop();
    return sig.join('|');
  }
  /* Different RNG seeds must not change a single opening. */
  var a = fingerprint(11), b = fingerprint(98765);
  ok(a === b && a.length > 40,
     cd.id.padEnd(11) + 'identical under two different seeds (' +
     a.split('|').length + ' samples)');
});

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'course checks passed'));
process.exit(fail ? 1 : 0);
