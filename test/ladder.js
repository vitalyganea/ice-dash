/* ===========================================================
   ladder.js — a dearer skin must not be a worse skin
   -----------------------------------------------------------
   These two comparisons used to live in economy.js, on the 12 and 24
   samples that suite can afford. They do not survive there. A run's
   distance has a standard deviation around 600m on a mean near 1000, so
   24 samples resolve it to about ±24% — and the fault this check exists
   to catch (grip alone, which made the dearest skin WORSE) showed as 0.88
   against a healthy 1.03. Fifteen points apart, inside a ±24% window: the
   check passed once by luck and failed later on unchanged code.

   So it gets its own suite and its own sample budget. It is slow. Run it
   when the catalogue changes, not on every edit.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT;
var PROFILES = {
  'first-timer': { aim: 110, hold: 34, react: 16, fumble: 0.22, dead: 22 },
  'casual':      { aim:  70, hold: 26, react: 11, fumble: 0.12, dead: 14 }
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
function run(seed, P, skinId) {
  H.setSeed(seed); G.start(0, {}, skinId);
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
          if (Math.random() < P.fumble) cool = P.react + 4; else { G.tap(); cool = P.react; }
        }
      }
    }
    H.frames(1);
  }
  var W2 = G.debug();
  var o = W2 ? { dist: W2.dist / 8, coins: W2.coins } : { dist: 0, coins: 0 };
  G.stop();
  return o;
}
function sample(profile, skinId, n, field) {
  var v = [];
  for (var i = 0; i < n; i++) v.push(run(4000 + i * 41, PROFILES[profile], skinId)[field]);
  var mean = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
  var sd = Math.sqrt(v.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / v.length);
  return { mean: mean, se: sd / Math.sqrt(v.length) };
}
/* Two means differ when the gap is clear of the noise in both of them. */
function better(a, b) {
  var se = Math.sqrt(a.se * a.se + b.se * b.se);
  return { diff: a.mean - b.mean, sigma: (a.mean - b.mean) / Math.max(1e-9, se) };
}

var N = 60;
/* Every skin whose perk is about staying ON the hill rather than about
   what you pick up off it. They cannot be judged by coins, so they are
   judged by distance, against the free one. None of them has to be
   dramatically better — people buy them for how they feel — but a skin
   you paid 2500 fish for may not leave you worse off than the one you
   started with. */
console.log('A. the skins you buy to survive do not make it worse\n');
var SURVIVE = ['bubbles', 'hare', 'owl', 'narwhal', 'reindeer'];
var base = sample('first-timer', 'snowcap', N, 'dist');
console.log('  snowcap   ' + '    0'.padStart(5) + '   ' +
            Math.round(base.mean) + 'm ±' + Math.round(base.se));
SURVIVE.forEach(function (id) {
  var got = sample('first-timer', id, N, 'dist');
  var r = better(got, base);
  console.log('  ' + id.padEnd(9) + SKIN_BY_ID[id].price.toString().padStart(5) + '   ' +
              Math.round(got.mean) + 'm ±' + Math.round(got.se) +
              '   (' + r.sigma.toFixed(1) + ' sigma)');
  ok(r.sigma > -1.0,
     id + ' is not WORSE than the free one (' + r.sigma.toFixed(1) + ' sigma)');
});

console.log('\nB. the earning skins improve as they get dearer\n');
var EARN = ['mitten', 'compass', 'walrus'];
var got = {};
EARN.forEach(function (id) { got[id] = sample('casual', id, N, 'coins'); });
EARN.forEach(function (id) {
  console.log('  ' + id.padEnd(9) + SKIN_BY_ID[id].price.toString().padStart(5) +
              '   ' + got[id].mean.toFixed(0) + ' ±' + got[id].se.toFixed(0) + ' coins');
});
var order = EARN.slice().sort(function (a, b) { return SKIN_BY_ID[a].price - SKIN_BY_ID[b].price; });
for (var i = 1; i < order.length; i++) {
  var c = better(got[order[i]], got[order[i - 1]]);
  ok(c.sigma > -1.0,
     order[i] + ' is not worse than the cheaper ' + order[i - 1] +
     ' (' + c.sigma.toFixed(1) + ' sigma)');
}

/* Two of the perks only pay where the run is long: the hare's gentler
   ramp is worth almost nothing before the hill has had time to speed up,
   and the narwhal's wider ramp needs crevasses, which start at 1500m. A
   first-timer dies around 850m and never reaches either. Measured against
   a player who does get there, they have something to show.

   The owl is deliberately not here. Its perk is that you can SEE the next
   openings — and the simulated player reads the row list directly, so it
   already has perfect foresight and cannot feel the thing being sold. That
   is a limit of the measurement, not a verdict on the perk. */
console.log('\n' + 'C. the perks that only pay at distance, on a player who gets there\n');
var cbase = sample('casual', 'snowcap', N, 'dist');
console.log('  snowcap   ' + '    0'.padStart(5) + '   ' +
            Math.round(cbase.mean) + 'm ±' + Math.round(cbase.se));
['hare', 'narwhal'].forEach(function (id) {
  var got = sample('casual', id, N, 'dist');
  var r = better(got, cbase);
  console.log('  ' + id.padEnd(9) + SKIN_BY_ID[id].price.toString().padStart(5) + '   ' +
              Math.round(got.mean) + 'm ±' + Math.round(got.se) +
              '   (' + r.sigma.toFixed(1) + ' sigma)');
  ok(r.sigma > -1.0,
     id + ' is not worse for a player who gets that far (' + r.sigma.toFixed(1) + ' sigma)');
});

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ladder checks passed'));
process.exit(fail ? 1 : 0);
