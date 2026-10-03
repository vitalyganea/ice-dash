/* Can the people a gate would affect actually get through it?
   Locking Freeride behind the Known Lines only works if a beginner can
   finish them. If they cannot, the lock also shuts off the earning loop —
   no fish, no skins, no progress at all. */
var H = require('./harness.js'); var G = global.Game;
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT, TURN = K.TURN;

var PROFILES = {
  'first-timer': { aim: 110, hold: 34, react: 16, fumble: 0.22, dead: 22 },
  'casual':      { aim:  70, hold: 26, react: 11, fumble: 0.12, dead: 14 },
  'practised':   { aim:  36, hold: 20, react:  5, fumble: 0.05, dead:  6 }
};
function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
function miss(W, dir, fr, t) {
  var x = W.px, v = W.vx, tr = G._turnRate();
  for (var k = 0; k < fr; k++) { v += (dir * DRIFT * W.speed - v) * tr; x += v; }
  return Math.abs(x - t);
}
function run(seed, P, courseId) {
  H.setSeed(seed); G.start(0, {}, 'snowcap', courseId);
  var cool = 0, aim = 0, reRoll = 0;
  for (var f = 0; f < 30000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    if (cool > 0) cool--;
    else {
      var row = nextRow(W);
      if (row) {
        if (--reRoll <= 0) { aim = (Math.random() - 0.5) * P.aim; reRoll = P.hold; }
        var t = G._chuteAt(row.d) + row.gap;
        var fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
        if (miss(W, -W.dir, fr, t) < miss(W, W.dir, fr, t) - P.dead) {
          if (Math.random() < P.fumble) cool = P.react + 4;
          else { G.tap(); cool = P.react; }
        }
      }
    }
    H.frames(1);
  }
  var W2 = G.debug();
  var out = { fin: !!(W2 && W2.state === 'finish'),
              dist: W2 ? Math.floor(W2.dist / 8) : 0,
              fish: W2 ? W2.fish : 0, total: W2 ? W2.fishTotal : 0 };
  G.stop();
  return out;
}

var N = 20;
console.log('Runs finished out of ' + N + ', and how far they got when they failed\n');
console.log('  course      ' + Object.keys(PROFILES).map(function (p) {
  return p.padStart(14); }).join(''));
COURSES.forEach(function (cd) {
  var row = '  ' + cd.id.padEnd(12);
  Object.keys(PROFILES).forEach(function (name) {
    var fin = 0, far = 0, stars = [0, 0, 0, 0];
    for (var i = 0; i < N; i++) {
      var r = run(400 + i * 91, PROFILES[name], cd.id);
      if (r.fin) fin++; else far = Math.max(far, r.dist);
      stars[courseStars(cd, { finished: r.fin, fish: r.fish, fishTotal: r.total })]++;
    }
    row += (fin + '/' + N).padStart(8) + ('·' + stars[1] + stars[2] + stars[3]).padStart(6);
  });
  console.log(row);
});
console.log('\n  (the three digits after · are how many runs got 1, 2 and 3 stars)');
