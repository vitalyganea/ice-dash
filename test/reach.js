/* Can every stretch of the hill be got through at all?

   test/longrun.js checks the rows: that each opening can be reached from
   the last. This checks everything a crash can come from, between the rows
   as well: boulders and trees, crevasses (only over from their ramp),
   geysers while they are up, the spines of rock that split the run.

   The hill is laid first by a rider who cannot be hurt, and every hazard on
   it is written down. Then, frame by frame, every place he could be in
   (where he is across the run, how fast he is moving across it, which way
   he is turning, whether he is in the air) is carried forward with both
   choices, tap or no tap, the hazards taken out. If at some frame nothing
   is left, that stretch cannot be ridden by anyone, however good: it is
   written down with what is there, and the search goes on past it.

   It also writes the narrowest places: where what is left of the run is
   only a few pixels wide, a stretch a person would call impossible even if
   a perfect rider gets through.

     node test/reach.js [metres] [seed,seed,...] [taps-per-second]
     node test/reach.js lines [days] [taps-per-second]     the Known Lines and
                                                            that many Daily Lines

   Snowcap (no perk: every perk only makes the hill kinder, test/skinsafe.js),
   Freeride. Slow: minutes a hill. Not in run.sh's fast suites. */
var H = require('./harness.js');
var G = global.Game;
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var PR = K.PR, CHUTE = K.CHUTE, DRIFT = K.DRIFT;
var AIR_DIST = 340, GEYSER_PERIOD = 170, GEYSER_UP = 54;
var LINES = process.argv[2] === 'lines';
var METRES = LINES ? 1e9 : +(process.argv[2] || 25000);
var SEEDS = LINES ? [] : (process.argv[3] || '11,222,3333').split(',').map(Number);
var DAYS = LINES ? +(process.argv[3] || 30) : 0;
var TPS = +(process.argv[4] || 60);                 // how often a tap may come; 60 = any frame
var EVERY = Math.max(1, Math.round(60 / TPS));

function hitR(o) { return o.r * 0.82 + PR * 0.78; }
function nunEdge(o, dd, side) {
  var u = Math.max(0, Math.min(1, (dd - o.d) / o.span));
  var t = u < 0.5 ? u * 2 : (1 - u) * 2;
  var a = side < 0 ? o.el : o.er;
  var f = u * (a.length - 1), i0 = f | 0, k = f - i0, i1 = Math.min(a.length - 1, i0 + 1);
  return o.w * 0.5 * t * (a[i0] + (a[i1] - a[i0]) * k);
}
function geyserUp(o, D) { return ((D * 0.18 + o.d * 0.7) % GEYSER_PERIOD) / GEYSER_PERIOD < GEYSER_UP / GEYSER_PERIOD; }

/* 1. Lay the hill: a rider in the air the whole way (nothing can hurt him,
   nothing he does changes what is laid), every frame's distance and turn
   rate kept, every hazard kept once. */
function lay(seed, course) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', course || null);
  var frames = [], seen = new Set(), haz = [], W = G.debug();
  var start = { x: W.px, vx: W.vx, dir: W.dir, D: W.dist };
  var endD = METRES * 8;
  for (var f = 0; f < 400000; f++) {
    W = G.debug(); if (!W) break;
    W.airTo = W.dist + 400; W.bog = 0; W.invuln = 0;
    W.px = G._chuteAt(W.dist); W.vx = 0;              // down the middle, picking nothing up
    var tr = G._turnRate();
    H.frames(1);
    W = G.debug(); if (!W) break;
    if (W.state === 'finish') break;                  // the end of a Known Line
    if (W.state !== 'run') { W.lives = 9; try { G.revive(); } catch (e) {} continue; }
    frames.push({ D: W.dist, sp: W.speed, tr: tr, c: G._chuteAt(W.dist) });
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (seen.has(o)) continue;
      if (o.t === 'rock' || o.t === 'tree' || o.t === 'crevasse' || o.t === 'ramp' || o.t === 'nunatak' || o.t === 'geyser') {
        seen.add(o);
        haz.push({ t: o.t, x: o.x, d: o.d, r: o.r, w: o.w, span: o.span, rel: o.rel, el: o.el && o.el.slice(), er: o.er && o.er.slice() });
      }
    }
    if (W.dist >= endD) break;
  }
  G.stop();
  haz.sort(function (a, b) { return a.d - b.d; });
  return { frames: frames, haz: haz, start: start };
}

/* 2. Carry every place he could be through the hill. */
function search(hill, seed) {
  var F = hill.frames, Z = hill.haz, out = { dead: [], narrow: [] };
  var states = [{ x: hill.start.x, vx: hill.start.vx, dir: hill.start.dir, air: -1 }];
  var lo = 0, prevD = hill.start.D, narrowRun = null;
  for (var k = 0; k < F.length; k++) {
    var fr = F[k], D = fr.D, near = [];
    while (lo < Z.length && Z[lo].d + (Z[lo].span || 0) + 80 < D) lo++;
    for (var j = lo; j < Z.length && Z[j].d < D + 80; j++) near.push(Z[j]);
    var next = new Map(), L = fr.c - G._wallAt(D, -1), R = fr.c + G._wallAt(D, 1);
    var canTap = k % EVERY === 0;
    for (var s = 0; s < states.length; s++) {
      var st = states[s];
      for (var ch = 0; ch < (canTap ? 2 : 1); ch++) {
        var dir = ch ? -st.dir : st.dir;
        var vx = st.vx + (dir * DRIFT * fr.sp - st.vx) * fr.tr, x = st.x + vx;
        if (x < L) { x = L; dir = 1; } else if (x > R) { x = R; dir = -1; }
        var air = st.air, dead = false;
        for (var q = 0; q < near.length && !dead; q++) {
          var o = near[q];
          if (o.t === 'ramp') { if (o.d > prevD && o.d <= D && Math.abs(o.x - x) < o.w / 2 && !(air > D)) air = D + AIR_DIST; continue; }
          if (air > D) continue;
          if (o.t === 'crevasse') { if (o.d > prevD && o.d <= D) dead = true; continue; }
          if (o.t === 'rock' || o.t === 'tree') { var dx = o.x - x, dy = o.d - D, hr = hitR(o); if (dx * dx + dy * dy < hr * hr) dead = true; continue; }
          if (o.t === 'geyser') { var gr = o.r * 0.62 + PR * 0.7; if (geyserUp(o, D) && Math.abs(o.x - x) < gr && Math.abs(o.d - D) < gr) dead = true; continue; }
          if (o.t === 'nunatak') {
            if (D > o.d - 6 && D < o.d + o.span + 6) {
              var nrel = x - (fr.c + o.rel);
              if (nrel > -(nunEdge(o, D, -1) + PR * 0.74) && nrel < nunEdge(o, D, 1) + PR * 0.74) dead = true;
            }
          }
        }
        if (dead) continue;
        var key = Math.round(x) + ',' + Math.round(vx * 6) + ',' + dir + ',' + (air > D ? Math.round(air) : 0);
        if (!next.has(key)) next.set(key, { x: x, vx: vx, dir: dir, air: air });
      }
    }
    prevD = D;
    states = Array.from(next.values());
    if (!states.length) {
      var m = Math.round(D / 8), here = Z.filter(function (o) { return o.d > D - 260 && o.d < D + 60; })
        .map(function (o) { return o.t + '@' + Math.round(o.x - fr.c) + (o.w ? ' w' + Math.round(o.w) : o.r ? ' r' + Math.round(o.r) : ''); });
      out.dead.push({ seed: seed, m: m, D: Math.round(D), what: here.slice(-8) });
      /* go on from just past it, anywhere on the ice */
      for (var g = k + 1; g < F.length && F[g].D < D + 120; g++);
      k = g - 1; prevD = F[Math.max(0, k)].D;
      states = [];
      for (var xx = F[k].c - CHUTE + PR; xx <= F[k].c + CHUTE - PR; xx += 6) { states.push({ x: xx, vx: 0, dir: 1, air: -1 }); states.push({ x: xx, vx: 0, dir: -1, air: -1 }); }
      narrowRun = null;
      continue;
    }
    /* how wide what is left of the run is, on the ground */
    var mn = 1e9, mx = -1e9;
    for (s = 0; s < states.length; s++) { if (states[s].air > D) { mn = -1e9; break; } if (states[s].x < mn) mn = states[s].x; if (states[s].x > mx) mx = states[s].x; }
    var width = mn === -1e9 || D < hill.start.D + 400 ? 999 : mx - mn;   // (at the very start he is in one place)
    if (width < 6) { if (!narrowRun) narrowRun = { seed: seed, m: Math.round(D / 8), width: Math.round(width) }; else narrowRun.width = Math.min(narrowRun.width, Math.round(width)); }
    else if (narrowRun) { out.narrow.push(narrowRun); narrowRun = null; }
    /* keep the search a manageable size: the same place twice is once */
    if (states.length > 6000) {
      var thin = new Map();
      states.forEach(function (st) { var kk = Math.round(st.x / 2) + ',' + Math.round(st.vx * 3) + ',' + st.dir + ',' + (st.air > D ? 1 : 0); if (!thin.has(kk)) thin.set(kk, st); });
      states = Array.from(thin.values());
    }
  }
  return out;
}

var allDead = [], allNarrow = [];
/* the Known Lines, and the Daily Line of as many days from today: the day's
   line is made from the date, so the date is what is set */
var RealDate = Date, JOBS = SEEDS.map(function (sd) { return { seed: sd, name: 'seed ' + sd }; });
if (LINES) {
  ['firstlight', 'narrows', 'gapteeth', 'glassrun', 'nightfall', 'cornice', 'canopy', 'starfall', 'geode', 'neonnights']
    .forEach(function (id) { JOBS.push({ seed: 7, course: id, name: id }); });
  for (var dd = 0; dd < DAYS; dd++) JOBS.push({ seed: 7, course: 'daily', day: dd, name: 'daily +' + dd });
}
JOBS.forEach(function (job) {
  if (job.day !== undefined) {
    var at = new RealDate(2026, 10, 19 + job.day, 12);
    global.Date = function (a) { return arguments.length ? new (Function.prototype.bind.apply(RealDate, [null].concat([].slice.call(arguments))))() : new RealDate(at.getTime()); };
    global.Date.now = function () { return at.getTime(); };
  } else global.Date = RealDate;
  var seed = job.name;
  var t0 = RealDate.now(), hill = lay(job.seed, job.course);
  var r = search(hill, seed);
  allDead = allDead.concat(r.dead); allNarrow = allNarrow.concat(r.narrow);
  var counts = {}; hill.haz.forEach(function (o) { counts[o.t] = (counts[o.t] || 0) + 1; });
  console.log(seed + ': ' + Math.round(hill.frames[hill.frames.length - 1].D / 8) + ' m, ' + JSON.stringify(counts) +
              ', impassable ' + r.dead.length + ', a few px wide ' + r.narrow.length + ' (' + Math.round((RealDate.now() - t0) / 1000) + ' s)');
  r.dead.forEach(function (d) { console.log('   IMPASSABLE at ' + d.m + ' m: ' + d.what.join(', ')); });
  r.narrow.slice(0, 5).forEach(function (n) { console.log('   narrow at ' + n.m + ' m: ' + n.width + ' px'); });
});
console.log('taps up to ' + TPS + ' a second; impassable ' + allDead.length + ', a few px wide ' + allNarrow.length);
if (allDead.length) { console.log('FAIL: a stretch no one can ride'); process.exit(1); }
console.log('every stretch can be ridden');
