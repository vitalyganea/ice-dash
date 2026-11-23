/* The six trophies of 1.3.5 (the owner, 23 Nov 2026): the clean stretches
   one run measures (no fish, no fall or bubble, no deep snow), a run's
   golden fish and catches in a row, the spans crossed. Each must be
   measured right, and each must be within reach of a decent player. */
var H = require('./harness.js');
eval(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'achievements.js'), 'utf8'));
var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
function nextRow(W) { for (var i = 0; i < W.rows.length; i++) if (W.rows[i].d > W.dist + 30) return W.rows[i]; return null; }
function miss(W, dir, fr, t) { var x = W.px, v = W.vx, tr = G._turnRate(); for (var k = 0; k < fr; k++) { v += (dir * K.DRIFT * W.speed - v) * tr; x += v; } return Math.abs(x - t); }
function steer(W, aim) {
  var row = nextRow(W); if (!row) return;
  var t = G._chuteAt(row.d) + row.gap + aim, fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
  if (miss(W, -W.dir, fr, t) < miss(W, W.dir, fr, t) - 8) G.tap();
}
/* one run, steered; `watch` sees every frame */
function ride(seed, skin, frames, watch) {
  H.setSeed(seed); G.start(0, {}, skin || 'snowcap');
  var cool = 0, f, W;
  for (f = 0; f < frames; f++) {
    W = G.debug(); if (!W || W.state !== 'run') break;
    if (cool > 0) cool--; else { steer(W, 0); cool = 8; }
    if (watch) watch(W);
    H.frames(1);
  }
  var r = G._result ? G._result() : null;
  W = G.debug(); G.stop(); return W;
}

console.log('A. the stretches are measured as they happen');
(function () {
  var W, lastFish = 0, lastBog = 0, lastFall = 0, dry = 0, snow = 0, clean = 0, fish0 = 0;
  W = ride(311, 'snowcap', 9000, function (w) {
    var m = Math.floor(w.dist / 8);
    if (w.fish + w.gold !== fish0) { fish0 = w.fish + w.gold; lastFish = w.dist; }
    if (w.bog > 0) lastBog = w.dist;
    if (w.shield > 0) lastFall = w.dist;
    dry = Math.max(dry, Math.floor((w.dist - lastFish) / 8));
    snow = Math.max(snow, Math.floor((w.dist - lastBog) / 8));
    clean = Math.max(clean, Math.floor((w.dist - lastFall) / 8));
  });
  ok(W && Math.abs(W.dryBest - dry) <= 1, 'the longest stretch without a fish (' + W.dryBest + ' m, watched ' + dry + ')');
  ok(W && Math.abs(W.snowBest - snow) <= 1, 'without deep snow (' + W.snowBest + ' m, watched ' + snow + ')');
  ok(W && Math.abs(W.cleanBest - clean) <= 1, 'without a fall or a bubble (' + W.cleanBest + ' m, watched ' + clean + ')');
})();

console.log('B. a fall and a bubble start the clean stretch again; a fish the dry one');
(function () {
  H.setSeed(77); G.start(0, {}, 'bubbles');                 // starts with a bubble held
  var W = G.debug();
  H.frames(120);
  ok(W.cleanBest === 0 && W.shield > 0, 'with a bubble held nothing counts as clean (' + W.cleanBest + ' m)');
  W.shield = 0; var at = W.dist;
  H.frames(240);
  var grown = W.cleanBest;
  ok(grown > 0 && grown <= Math.ceil((W.dist - at) / 8), 'once it is gone the stretch is his own (' + grown + ' m)');
  H.frames(60);
  W.lives = 1; W.state = 'crash'; W.endT = 1; W.crashAt = W.dist;
  var rv0 = W.revives, ok1 = G.revive();
  ok(ok1 !== false && W.revives === rv0 + 1 && W.state === 'run', 'a fall, and a life spent');
  ok(W.cleanFrom === W.dist, 'the clean stretch starts again from the fall');
  var d0 = W.fishFrom; W.objects.push({ t: 'fish', x: W.px, d: W.dist + 4, r: 15, got: false, ph: 0 });
  H.frames(3);
  ok(W.fishFrom > d0, 'and a fish caught starts the dry one again');
  G.stop();
})();

console.log('C. banked into the save and judged as trophies');
(function () {
  var s = { bestDry: 520, bestClean: 999, bestRunGold: 5, bestCombo: 20, bestNoSnow: 1500, totSpans: 9 };
  function got(id) { var a = ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0]; return a.stat(s) >= a.goal; }
  ok(got('dry500') && !got('clean1000') && got('gold5run') && got('combo3') && got('nosnow1500') && !got('spans10'),
     'each reads its own number from the save');
  var ids = ACHIEVEMENTS.map(function (a) { return a.id; });
  ok(ids.slice(-6).join() === 'dry500,clean1000,gold5run,combo3,nosnow1500,spans10',
     'the six are at the end of the list, so every card\'s medals keep their numbers');
})();

console.log('D. within reach of a decent player (12 steered runs)');
(function () {
  var dry = 0, clean = 0, snow = 0, gold = 0, combo = 0, spans = 0, n = 12;
  for (var i = 0; i < n; i++) {
    var W = ride(5000 + i * 37, 'snowcap', 30000);
    dry = Math.max(dry, W.dryBest); clean = Math.max(clean, W.cleanBest); snow = Math.max(snow, W.snowBest);
    gold = Math.max(gold, W.gold); combo = Math.max(combo, W.comboBest); spans += W.spans || 0;
  }
  console.log('    best of ' + n + ': dry ' + dry + ' m, clean ' + clean + ' m, no snow ' + snow + ' m, gold ' + gold + ', combo ' + combo + ', spans ' + spans + ' in all');
  ok(clean >= 1000 && snow >= 1500 && combo >= 20 && spans >= 10, 'clean 1000 m, 1500 m clear of deep snow, x3 and ten spans all come');
})();

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'trophy checks passed'));
process.exit(fail ? 1 : 0);
