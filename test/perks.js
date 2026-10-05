/* ===========================================================
   perks.js — every creature's perk does what its card says
   -----------------------------------------------------------
   One check per creature, each the same moment ridden twice: once by
   that creature and once by Snowcap, who has no perk. The difference is
   the perk. skinsafe.js proves no perk can make the hill unfair; this
   proves each one is actually there.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0, covered = {};
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
function skin(id, title) { covered[id] = 1; console.log('\n' + id + ' — ' + title); }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var PR = K.PR;

/* A world with nothing on it, so only what a check puts there matters. */
function clean(id, opts, seed) {
  H.setSeed(seed || 5);
  G.start(0, {}, id, null, 0, opts);
  for (var f = 0; f < 30; f++) {
    var W = G.debug(); W.objects = []; W.px = G._chuteAt(W.dist); W.vx = 0; H.frames(1);
  }
  W = G.debug(); W.objects = [];
  W.nextRowD = 1e12;                                // no more rows laid
  return W;
}
function hold(n) {                                  // ride straight for n frames
  var x0 = G.debug().px;
  for (var f = 0; f < n; f++) { var w = G.debug(); if (!w) return; w.px = x0; w.vx = 0; H.frames(1); }
}
var HAZARD = { rock: 1, tree: 1, crevasse: 1, ramp: 1, geyser: 1, nunatak: 1, drift: 1 };
/* The open hill as the spawner lays it, with every hazard lifted off so
   nothing ends the ride; `see` is shown every object once. */
function hill(id, frames, see, seed, keep) {
  H.setSeed(seed || 77);
  G.start(0, {}, id, null, 0);
  var seen = {};
  for (var f = 0; f < frames; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    for (var i = W.objects.length - 1; i >= 0; i--) {
      var o = W.objects[i], key = o.t + ':' + Math.round(o.d) + ':' + Math.round(o.x);
      if (!seen[key]) { seen[key] = 1; see(o, W); }
      if (HAZARD[o.t] && !(keep && keep[o.t])) W.objects.splice(i, 1);
    }
    W.px = G._chuteAt(W.dist); W.vx = 0;
    H.frames(1);
  }
  G.stop();
}
function count(id, type, frames, seed) {
  var n = 0; hill(id, frames, function (o) { if (o.t === type) n++; }, seed); return n;
}

skin('snowcap', 'no perk at all');
var W = clean('snowcap');
ok(W.shield === 0 && W.combo === 0 && G._turnRate() === K.TURN, 'no bubble, no combo, the plain turn rate');
G.stop();

skin('mitten', 'hoovers up fish from much further away');
function grab(id, far) {
  var W = clean(id);
  W.objects.push({ t: 'fish', x: W.px + (15 + PR) * far, d: W.dist + 12, r: 15, got: false, ph: 0 });
  hold(20);
  var n = G.debug().fish; G.stop(); return n;
}
ok(grab('mitten', 1.7) === 1 && grab('snowcap', 1.7) === 0, 'a fish 1.7x out of reach: his, not Snowcap\'s');
ok(grab('mitten', 2.3) === 0, 'and his reach still has an end (2.3x is too far)');

skin('puffin', 'shrugs off one missed fish without losing the run of catches');
function missOne(id) {
  var W = clean(id); W.combo = 7;
  W.objects.push({ t: 'fish', x: W.px + 200, d: W.dist + 10, r: 15, got: false, ph: 0 });
  hold(30); var c = G.debug().combo; G.stop(); return c;
}
ok(missOne('puffin') === 7 && missOne('snowcap') === 0, 'a missed fish keeps his combo (7) and breaks Snowcap\'s (0)');

skin('seal', 'sniffs out the golden fish, far more of them');
var gSeal = count('seal', 'gold', 9000), gBase = count('snowcap', 'gold', 9000);
ok(gSeal >= gBase * 1.6, 'on the same hill: ' + gSeal + ' golden fish against ' + gBase);

skin('lemming', 'every star on the Daily Line pays 25 fish more');
ok(dailyStarPay('lemming', 3, true) === 75 && dailyStarPay('snowcap', 3, true) === 0,
   'three stars: +' + dailyStarPay('lemming', 3, true) + ' for him, +0 for Snowcap');
ok(dailyStarPay('lemming', 3, false) === 0, 'and nothing for a line not finished');

skin('muskox', 'deep snow does not slow him down at all');
function wade(id) {
  var W = clean(id); W.objects.push({ t: 'drift', x: W.px, d: W.dist + 40, r: 70, ph: 0 });
  var d0 = W.dist; hold(40); var g = G.debug().dist - d0; G.stop(); return g;
}
var ox = wade('muskox'), sw = wade('snowcap');
ok(ox > sw * 1.15, 'through the same drift: ' + ox.toFixed(0) + ' against ' + sw.toFixed(0) + ' units');

function shielded(id) {
  var W = clean(id);
  var s0 = W.shield;
  W.invuln = 0; W.grace = 0;
  W.objects.push({ t: 'rock', x: W.px, d: W.dist + 20, r: 30, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  hold(30);
  var w = G.debug(), out = { start: s0, alive: w.state === 'run', saved: w.saved };
  G.stop(); return out;
}
skin('bubbles', 'starts every run already inside a bubble');
var bb = shielded('bubbles'), bs = shielded('snowcap');
ok(bb.start === 1 && bs.start === 0, 'the run opens with her in a bubble, Snowcap without');
ok(bb.alive && bb.saved === 1 && !bs.alive, 'and it takes a boulder for her (Snowcap crashes)');

skin('otter', 'time bubbles give her four seconds instead of three');
function clock(id) {
  var W = clean(id, { mode: 'rush' });
  W.objects.push({ t: 'clock', x: W.px, d: W.dist + 15, r: 27, got: false, ph: 0 });
  var t0 = W.timeT; hold(10); var g = G.debug().timeT - t0; G.stop(); return g;
}
var co = clock('otter'), cs = clock('snowcap');
ok(Math.abs((co - cs) - 60) <= 2, 'one bubble: ' + ((co - cs) / 60).toFixed(2) + ' s more for her');

skin('hare', 'the run speeds up far more gently');
function paceAt(id) {
  var W = clean(id); W.dist = 20000;
  hold(2); var s = G.debug().speed; G.stop(); return s;
}
/* The perk is on the climb, not the pace you start at: what the hill has
   added by 2.5 km is the thing that is gentler. */
var start = (function () { var W = clean('snowcap'); W.dist = 0; hold(1); var s = G.debug().speed; G.stop(); return s; })();
var ph = paceAt('hare'), ps = paceAt('snowcap');
var climb = (ph - start) / (ps - start);
ok(climb > 0.6 && climb < 0.8, '2.5 km down the hill has sped him up ' + Math.round(climb * 100) +
   '% as much as Snowcap (' + ph.toFixed(2) + ' against ' + ps.toFixed(2) + ' units a frame)');

skin('leopard', 'close calls pay double, and count from further away');
function closeCall(id, gap) {
  var W = clean(id); W.combo = 0;
  var r = 30, hit = r * 0.82 + PR * 0.78;
  W.objects.push({ t: 'rock', x: W.px + hit + gap, d: W.dist + 60, r: r, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  W.invuln = 0; W.grace = 0;
  var s0 = W.score; hold(60);
  var w = G.debug(), out = { n: w.closes, score: w.score - s0, alive: w.state === 'run' };
  G.stop(); return out;
}
var lc = closeCall('leopard', 6), sc = closeCall('snowcap', 6);
ok(lc.n === 1 && sc.n === 1 && lc.alive && sc.alive, 'a near pass is a close call for both');
ok(Math.round(lc.score - sc.score) === 15, 'and pays her 15 points more on the same pass (' + (lc.score - sc.score).toFixed(1) + ')');
ok(closeCall('leopard', 18).n === 1 && closeCall('snowcap', 18).n === 0, 'a wider pass counts only for her');

skin('compass', 'finds far more shoals, and bigger ones');
var fc = count('compass', 'fish', 9000), fs = count('snowcap', 'fish', 9000);
ok(fc >= fs * 1.3, 'on the same hill: ' + fc + ' fish against ' + fs);

skin('owl', 'always knows where the next opening is');
W = clean('owl'); var so = G._seeing(); G.stop();
W = clean('snowcap'); var ss = G._seeing(); G.stop();
ok(so && !ss, 'the line to the next opening is drawn for him and not for Snowcap');

skin('walrus', 'the crystal rings open wider for him, and pay triple');
function ringWidth(id) {
  var w = 0; hill(id, 6000, function (o) { if (o.t === 'gate' && !w) w = o.w; }); return w;
}
var rw = ringWidth('walrus'), rs = ringWidth('snowcap');
ok(rs > 0 && Math.abs(rw / rs - 1.55) < 0.02, 'the same ring: ' + rw.toFixed(1) + ' wide for him, ' + rs.toFixed(1) + ' for Snowcap');
function ringPay(id) {
  var W = clean(id); W.combo = 0;
  W.objects.push({ t: 'gate', x: W.px, d: W.dist + 12, w: 60, passed: false });
  var c0 = W.coins; hold(20); var g = G.debug().coins - c0; G.stop(); return g;
}
ok(ringPay('walrus') === 3 * ringPay('snowcap'), 'and one ring pays him ' + ringPay('walrus') + ' fish to Snowcap\'s ' + ringPay('snowcap'));

skin('narwhal', 'the ramp over a crevasse runs much wider for him');
function rampWidth(id) {
  var w = 0; hill(id, 30000, function (o) { if (o.t === 'ramp' && !w) w = o.w; }); return w;
}
var nw = rampWidth('narwhal'), ns = rampWidth('snowcap');
ok(ns > 0 && Math.abs(nw / ns - 1.6) < 0.02, 'the same ramp: ' + nw.toFixed(1) + ' wide for him, ' + ns.toFixed(1) + ' for Snowcap');

skin('reindeer', 'sure-footed: tucks in tight, and the glacier cannot swing him wide');
function glacierTurn(id) {
  var W = clean(id); W.biome = 3;                   // Glacier, the one slippery stretch
  var t = G._turnRate(); G.stop(); return t;
}
var tr = glacierTurn('reindeer'), ts = glacierTurn('snowcap');
ok(tr > ts * 1.3, 'on the Glacier he turns at ' + tr.toFixed(3) + ' against ' + ts.toFixed(3));
function squeeze(id) {
  var W = clean(id);
  var r = 30, edge = r * 0.82 + PR * 0.78 * 0.89;   // between his reach and Snowcap's
  W.invuln = 0; W.grace = 0;
  W.objects.push({ t: 'rock', x: W.px + edge, d: W.dist + 40, r: r, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  hold(50); var alive = G.debug().state === 'run'; G.stop(); return alive;
}
ok(squeeze('reindeer') && !squeeze('snowcap'), 'and he slips past a boulder that catches Snowcap');

skin('emperor', 'every run starts with the combo already at x2');
W = clean('emperor'); var ce = W.combo; G.stop();
W = clean('snowcap'); var cb = W.combo; G.stop();
ok(ce === 10 && cb === 0, 'combo ' + ce + ' (x2) at the start, against ' + cb);

skin('orca', 'hits a ramp so hard she clears half the hill, and starts shielded');
function air(id) {
  var W = clean(id);
  W.objects.push({ t: 'ramp', x: W.px, d: W.dist + 10, w: 80, used: false });
  hold(12); var a = G.debug().airSpan; G.stop(); return a;
}
var ao = air('orca'), as = air('snowcap');
ok(as > 0 && Math.abs(ao / as - 1.8) < 0.02, 'off the same ramp: ' + ao.toFixed(0) + ' units of air against ' + as.toFixed(0));
var os = shielded('orca');
ok(os.start === 1 && os.alive, 'and she starts in a bubble that takes a boulder');

skin('aurora', 'starts every run in a bubble and draws fish in from far away');
var au = shielded('aurora');
ok(au.start === 1 && au.alive && au.saved === 1, 'the run opens with her in a bubble, and it takes a boulder');
ok(grab('aurora', 1.6) === 1 && grab('snowcap', 1.6) === 0, 'a fish 1.6x out of reach: hers, not Snowcap\'s');

var missing = SKINS.filter(function (s) { return !covered[s.id]; }).map(function (s) { return s.id; });
console.log('');
ok(!missing.length, 'every creature in the catalogue has a check here' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ' (' + SKINS.length + ')'));

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'perk checks passed'));
process.exit(fail ? 1 : 0);
