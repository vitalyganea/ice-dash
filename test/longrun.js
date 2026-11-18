/* A good player to 80,000 points on several hills, as a real player would
   ride them: every crash written down with what was hit, where and how
   fast; and every pair of rows checked, that the next gap can be reached
   from the one before at the speed and grip he had there, and that no gap
   is narrower than he is. Slow (minutes); not in run.sh's fast suites.

     node test/longrun.js [points] [seed,seed,...]

   It fails if any passage cannot be ridden. (It was written for a report
   that some stretches could not be got through, 18 Nov 2026: 20 hills to
   80,000 found none.) */
var H = require('./harness.js');
var G = global.Game;
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT, TURN = K.TURN;
function nextRow(W) { for (var i = 0; i < W.rows.length; i++) if (W.rows[i].d > W.dist + 30) return W.rows[i]; return null; }
function projectMiss(W, dir, frames, t) { var x = W.px, vx = W.vx; for (var k = 0; k < frames; k++) { vx += (dir * DRIFT * W.speed - vx) * TURN; x += vx; } return Math.abs(x - t); }
function steer(W) {
  var row = nextRow(W); if (!row) return;
  var target = G._chuteAt(row.d) + row.gap, fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
  if (projectMiss(W, -W.dir, fr, target) < projectMiss(W, W.dir, fr, target) - 6) G.tap();
}
function achievable(step, speed, grip) {
  var frames = Math.max(1, Math.floor(step / speed)), t = TURN * grip, x = 0, vx = -DRIFT * speed;
  for (var k = 0; k < frames; k++) { vx += (DRIFT * speed - vx) * t; x += vx; }
  return x;
}
var TARGET = +(process.argv[2] || 80000), seeds = (process.argv[3] || '11,222,3333,44444,555,6066').split(',').map(Number), PAIRS = { checked: 0, bad: [], narrow: [] };
var all = [];
seeds.forEach(function (seed) {
  H.setSeed(seed);
  G.start(0, {});
  var rows = {}, prevRow = null, crashes = [], f = 0, lastCrashF = -999;
  for (f = 0; f < 400000; f++) {
    var W = G.debug(); if (!W) break;
    if (W.state === 'run') steer(W);
    else if (W.state === 'crash' && f - lastCrashF > 5) {
      lastCrashF = f;
      var ca = W.crashAt || {}, hit = null;
      for (var i = 0; i < W.objects.length; i++) { var o = W.objects[i]; if (o.x === ca.x && o.d === ca.d) { hit = o; break; } }
      var row = null, prev = null;
      var ds = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
      for (var j = 0; j < ds.length; j++) { if (ds[j] <= W.dist + 40) { prev = row; row = rows[ds[j]]; } }
      var grip = BIOMES[W.biome % BIOMES.length].grip, info = '';
      if (row && prev) {
        var need = Math.abs(row.gap - prev.gap), can = achievable(row.d - prev.d, W.speed, grip);
        info = 'need ' + need.toFixed(0) + ' can ' + can.toFixed(0) + (need > can ? ' IMPOSSIBLE' : '');
      }
      crashes.push({ score: Math.round(W.score), m: Math.round(W.dist / 8), speed: +W.speed.toFixed(2), grip: grip, biome: W.biome,
                     hit: hit ? hit.t + (hit.r ? ' r' + Math.round(hit.r) : '') + (hit.w ? ' w' + Math.round(hit.w) : '') : '?', info: info,
                     rel: hit ? Math.round(hit.x - G._chuteAt(hit.d)) : 0, px: Math.round(W.px - G._chuteAt(W.dist)) });
      W.lives = Math.max(W.lives, 1);
      try { G.revive(); } catch (e) {}
    }
    H.frames(1);
    W = G.debug(); if (!W) break;
    for (var r = 0; r < W.rows.length; r++) { var rr = W.rows[r]; if (!rows[rr.d]) rows[rr.d] = { d: rr.d, gap: rr.gap, gapW: rr.gapW }; var rec = rows[rr.d]; if (!rec.speed && W.dist >= rr.d) { rec.speed = W.speed; rec.grip = BIOMES[W.biome % BIOMES.length].grip; rec.m = Math.round(W.dist / 8); } }
    if (W.score >= TARGET) break;
  }
  var L = Object.keys(rows).map(function (k) { return rows[k]; }).filter(function (q) { return q.speed; }).sort(function (a, b) { return a.d - b.d; });
  for (var q = 1; q < L.length; q++) {
    var a = L[q - 1], b = L[q], need = Math.abs(b.gap - a.gap), can = achievable(b.d - a.d, Math.max(a.speed, b.speed), Math.min(a.grip, b.grip));
    PAIRS.checked++;
    if (need > can) PAIRS.bad.push({ seed: seed, m: b.m, need: Math.round(need), can: Math.round(can), speed: b.speed, grip: b.grip });
    if (b.gapW < 2 * K.PR + 4) PAIRS.narrow.push({ seed: seed, m: b.m, gapW: Math.round(b.gapW) });
  }
  var W2 = G.debug();
  console.log('seed ' + seed + ': ' + Math.round(W2.score) + ' pts, ' + Math.round(W2.dist / 8) + ' m, ' + f + ' frames, ' + crashes.length + ' crashes');
  crashes.forEach(function (c) { console.log('   ' + JSON.stringify(c)); });
  all = all.concat(crashes.map(function (c) { c.seed = seed; return c; }));
  G.stop();
});
var by = {}; all.forEach(function (c) { var k = c.hit.split(' ')[0]; by[k] = (by[k] || 0) + 1; });
console.log('row pairs checked ' + PAIRS.checked + ', impossible ' + PAIRS.bad.length + ' ' + JSON.stringify(PAIRS.bad.slice(0, 8)) + ', narrower than him ' + PAIRS.narrow.length + ' ' + JSON.stringify(PAIRS.narrow.slice(0, 8)));
console.log('crashes by what was hit: ' + JSON.stringify(by) + ', impossible gaps: ' + all.filter(function (c) { return /IMPOSSIBLE/.test(c.info); }).length);
if (PAIRS.bad.length || PAIRS.narrow.length || all.some(function (c) { return /IMPOSSIBLE/.test(c.info); })) { console.log('FAIL: a passage that cannot be ridden'); process.exit(1); }
console.log('every passage can be ridden');
