/* ===========================================================
   determinism.js — the hill depends on the seed and the player only
   -----------------------------------------------------------
   Everything you only look at (puffs, snow, streaks, the shake, boulder
   shapes, scenery past the banks) draws from a generator of its own.
   Before, it shared the spawner's, so catching a fish a frame earlier —
   which is all the reach perk does — threw different puffs and changed
   every row after it, and the scenery's count followed the screen width,
   so one seed was a different hill on a phone and on a laptop. That made
   any "with this perk vs without" comparison a comparison of two hills.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT;

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
/* The rows of the hill, and the hazards in them, as one string. */
function ride(seed, skin, frames) {
  H.setSeed(seed);
  G.start(0, {}, skin);
  var seen = {}, sig = [];
  for (var f = 0; f < frames; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    W.rows.forEach(function (r) {
      var k = Math.round(r.d);
      if (!seen[k]) { seen[k] = 1; sig.push(k + ':' + Math.round(r.gap) + ':' + Math.round(r.gapW)); }
    });
    steer(W); H.frames(1);
  }
  var out = { sig: sig.join('|'), rows: sig.length, fish: G.debug() ? G.debug().fish : 0 };
  G.stop();
  return out;
}
function resizeTo(w, h) { window.innerWidth = w; window.innerHeight = h; }

console.log('A. a perk that only changes what you pick up does not change the hill');
var a = ride(77, 'snowcap', 2600), b = ride(77, 'mitten', 2600);
ok(a.rows > 30 && a.sig === b.sig, 'snowcap and mitten ride the same ' + a.rows + ' rows on the same seed');
ok(b.fish >= a.fish, 'and the longer reach catches at least as much on it (' + b.fish + ' vs ' + a.fish + ')');

console.log('\nB. the screen does not change the hill');
resizeTo(390, 844); G.start(0, {}); G.resize(); G.stop();
var phone = ride(91, 'snowcap', 2600);
resizeTo(1920, 1080); G.start(0, {}); G.resize(); G.stop();
var wide = ride(91, 'snowcap', 2600);
resizeTo(960, 540); G.start(0, {}); G.resize(); G.stop();
/* A tall phone sees further up the hill, so by the end it has laid a few
   more rows than the wide screen has: compare the rows both have. */
var pa = phone.sig.split('|'), wa = wide.sig.split('|'), n = Math.min(pa.length, wa.length);
ok(n > 30 && pa.slice(0, n).join('|') === wa.slice(0, n).join('|'),
   'a phone and a wide screen lay the same ' + n + ' rows');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'determinism checks passed'));
process.exit(fail ? 1 : 0);
