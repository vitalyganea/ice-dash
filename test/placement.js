/* ===========================================================
   placement.js — nothing stands where it cannot be
   -----------------------------------------------------------
   Rides the open hill on many seeds, an invulnerable rider steering for
   each opening, and records every thing the spawner lays. Then it checks
   where each one ended up:
     - under a snow bridge's roof (hidden, or a hazard you cannot see);
     - in a crevasse (a fish over the black water, a geyser in mid-air);
     - on the nunatak;
     - off the run (a fish out on the bank, half a geyser in the snow);
     - in another thing (a fish inside a boulder, a geyser on a gate);
     - a thing past the banks standing in the lava channel.
   Each of these came up in play (owner, 12 Nov 2026).
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var SND = {};
require('vm').runInNewContext(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'audio.js'), 'utf8') +
  ';Object.keys(Sfx)', { window: {} }).forEach(function (k) { SND[k] = function () {}; });
global.Sfx = SND;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var CHUTE = K.CHUTE, DRIFT = K.DRIFT;
var PICKUP = { fish: 1, gold: 1, find: 1, bubble: 1, clock: 1, rush: 1, chill: 1, sight: 1, call: 1 };
var HAZARD = { rock: 1, tree: 1, geyser: 1 };
var SPAN = { tunnel: 1, crevasse: 1, nunatak: 1, finish: 1 };

/* the bank's wobble, as bankX draws it */
function wob(d, side) { return Math.sin(d * 0.011 + side * 2.1) * 9 + Math.sin(d * 0.03) * 4; }
/* how far each thing reaches on the ice, as drawn (not as it hits) */
function reach(o) {
  if (o.t === 'geyser') return o.r * 1.0;
  if (o.t === 'drift') return o.r * 0.9;
  if (o.t === 'gate') return 0;
  if (o.t === 'rock' || o.t === 'tree') return o.r * 0.9;
  return o.r || 0;
}

function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++) if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
function steer(W) {
  var r = nextRow(W); if (!r) return;
  var t = G._chuteAt(r.d) + r.gap;
  var fr = Math.max(1, Math.round((r.d - W.dist) / W.speed)), tr = G._turnRate();
  function m(d) { var x = W.px, v = W.vx; for (var k = 0; k < fr; k++) { v += (d * DRIFT * W.speed - v) * tr; x += v; } return Math.abs(x - t); }
  if (m(-W.dir) < m(W.dir) - 6) G.tap();
}

var all = [], biomeAt = [];
function ride(seed, frames, course) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', course);
  var seen = new Set();
  for (var f = 0; f < frames; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    W.invuln = 30;
    steer(W);
    H.frames(1);
    W = G.debug(); if (!W) break;
    /* judged as it comes into view: what the player is shown. (A fish
       moves later, drawn in by the magnet or by reach, which is not where
       it was laid.) */
    var into = W.dist + K.PLAYER_Y + 40;
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (seen.has(o) || o.d > into) continue;
      seen.add(o);
      var snap = {}; for (var key in o) if (typeof o[key] !== 'object') snap[key] = o[key];
      all.push({ seed: seed, o: snap, chute: G._chuteAt(o.d), at: W.dist, lava: (BIOMES[W.biome % BIOMES.length].lava || 0) > 0 });
    }
  }
  G.stop();
}
var SEEDS = +(process.env.SEEDS || 4), FRAMES = +(process.env.FRAMES || 6000);
for (var sd = 1; sd <= SEEDS; sd++) ride(sd * 7 + 3, FRAMES);
/* and every marked run, to its end */
global.COURSES.forEach(function (cd, ci) { ride(1000 + ci, 6000, cd.id); });

/* (a free ride's seed and a marked run's both key their own list) */
var bySeed = {};
all.forEach(function (e) { (bySeed[e.seed] = bySeed[e.seed] || []).push(e); });
var bad = { roof: [], crevasse: [], nunatak: [], offRun: [], overlap: [], lava: [] };
Object.keys(bySeed).forEach(function (s) {
  var L = bySeed[s];
  var spans = L.filter(function (e) { return SPAN[e.o.t]; });
  var solids = L.filter(function (e) { return HAZARD[e.o.t]; });
  L.forEach(function (e) {
    var o = e.o, rr = reach(o);
    if (SPAN[o.t] || o.t === 'ramp') return;
    var deco = o.t === 'deco';
    spans.forEach(function (S) {
      var so = S.o;
      if (so.t === 'tunnel' && !deco && o.d + rr > so.d - 10 && o.d - rr < so.d + so.span + 20) bad.roof.push(e);
      if (so.t === 'crevasse' && !deco && o.d + rr > so.d - 12 && o.d - rr < so.d + so.span + 12) bad.crevasse.push(e);
      if (so.t === 'nunatak' && !deco && o.d > so.d - 10 && o.d < so.d + so.span + 10 &&
          Math.abs(o.x - so.x) < so.w / 2 + rr * 0.4) bad.nunatak.push(e);   // the fork's strings hug its flanks
    });
    if (deco) {
      /* past the banks: the lava runs 18 to 68 out from the bank */
      var side = o.x > e.chute ? 1 : -1, out = Math.abs(o.x - e.chute) - CHUTE - wob(o.d, side);
      if (e.lava && out - rr < 70 && out + rr > 16) bad.lava.push(e);
      return;
    }
    var rel = o.x - e.chute, sd2 = rel > 0 ? 1 : -1;
    var edge = CHUTE + wob(o.d, sd2);
    var HW0 = o.w / 2 + 24 * 0.95, hl = o.hl || HW0, hr = o.hr || HW0;   // the arc's holes, where they were drawn
    if (o.t === 'rock' || o.t === 'tree') { if (Math.abs(rel) > edge - 2) bad.offRun.push(e); }   // a boulder may lean on the bank, not stand on it
    else if (o.t === 'gate') {
      if (Math.abs(rel - hl) + 8 > CHUTE + wob(o.d, rel - hl < 0 ? -1 : 1) ||
          Math.abs(rel + hr) + 8 > CHUTE + wob(o.d, rel + hr < 0 ? -1 : 1)) bad.offRun.push(e);
    }
    else if (Math.abs(rel) + rr > edge) bad.offRun.push(e);
    /* a drift lying round a tree is just snow banked against it: allowed */
    if (PICKUP[o.t] || o.t === 'geyser' || o.t === 'gate') {
      solids.forEach(function (S) {
        var so = S.o; if (so === o) return;
        var dx = so.x - o.x, dd = so.d - o.d, need = reach(so) + (o.t === 'gate' ? 0 : rr * 0.6);
        if (o.t === 'gate') {                         // a hole of the arc in a boulder
          [-1, 1].forEach(function (k) {
            var hx = o.x + (k < 0 ? -hl : hr);
            if (Math.hypot(so.x - hx, so.d - o.d) < reach(so) + 6) bad.overlap.push(e);
          });
        } else if (dx * dx + dd * dd < need * need) bad.overlap.push(e);
      });
    }
  });
});
if (process.env.SHOW) Array.from(new Set(bad.lava)).slice(0, 6).forEach(function (e) {
  var side = e.o.x > e.chute ? 1 : -1;
  console.log('   lava seed', e.seed, e.o.kind, 'out', Math.round(Math.abs(e.o.x - e.chute) - CHUTE - wob(e.o.d, side)), 'r', Math.round(e.o.r), 'd', Math.round(e.o.d));
});
if (process.env.SHOW) ['roof', 'crevasse'].forEach(function (k) {
  Array.from(new Set(bad[k])).slice(0, 6).forEach(function (e) {
    var sp = bySeed[e.seed].filter(function (q) { return q.o.t === (k === 'roof' ? 'tunnel' : 'crevasse'); })
      .map(function (q) { return [Math.round(q.o.d), Math.round(q.o.span), Math.round(q.at)]; });
    console.log('   ' + k, 'seed', e.seed, e.o.t, 'x', Math.round(e.o.x - e.chute), 'r', e.o.r, 'got', !!e.o.got, 'd', Math.round(e.o.d), 'seen at dist', Math.round(e.at), 'spans', JSON.stringify(sp.filter(function (q) { return Math.abs(q[0] - e.o.d) < 700; })));
  });
});
function uniq(a) { return Array.from(new Set(a)); }
function summary(a) {
  var c = {}; uniq(a).forEach(function (e) { c[e.o.t] = (c[e.o.t] || 0) + 1; });
  return JSON.stringify(c);
}
var n = all.filter(function (e) { return e.o.t !== 'deco'; }).length;
console.log('  ' + all.length + ' things laid over ' + SEEDS + ' rides (' + n + ' on the run)');
Object.keys(bad).forEach(function (k) {
  var u = uniq(bad[k]);
  console.log('  ' + k.padEnd(9) + String(u.length).padStart(5) + '  ' + summary(bad[k]));
});
if (process.env.STRICT !== '0') {
  ok(uniq(bad.roof).length === 0, 'nothing laid under a snow bridge');
  ok(uniq(bad.crevasse).length === 0, 'nothing laid over a crevasse');
  ok(uniq(bad.nunatak).length === 0, 'nothing laid on a nunatak');
  ok(uniq(bad.offRun).length === 0, 'nothing on the run reaches past the banks');
  ok(uniq(bad.overlap).length === 0, 'no fish, find, geyser, drift or gate inside a boulder or tree');
  ok(uniq(bad.lava).length === 0, 'no scenery standing in the lava channels');
}
console.log(fail ? '\n' + fail + ' placement check(s) FAILED' : '\nplacement checks passed');
process.exit(fail ? 1 : 0);
