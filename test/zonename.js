/* ===========================================================
   zonename.js — the stretch's name, once, not on every tap
   -----------------------------------------------------------
   The name used to ride on the flash that every tap and every pickup
   sets. A marked run never leaves its first zone, so on every course the
   name came back with every single tap. It now has its own clock: up as
   the run begins, up again when the hill changes stretch, never on a tap.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

function keepAlive() {
  var W = G.debug();
  W.objects = W.objects.filter(function (o) { return o.t !== 'rock' && o.t !== 'tree' && o.t !== 'crevasse'; });
}

[['a marked run', 'firstlight'], ['freeride', null]].forEach(function (c) {
  console.log(c[0]);
  H.setSeed(3);
  G.start(0, {}, 'snowcap', c[1], 0);
  ok(G.debug().zoneT > 0, 'the name is up as the run begins');
  for (var f = 0; f < 300; f++) { keepAlive(); H.frames(1); }
  ok(G.debug().zoneT === 0, 'and gone a few seconds later');
  var shown = 0;
  for (f = 0; f < 600; f++) {
    keepAlive();
    if (f % 25 === 0) G.tap();
    H.frames(1);
    if (G.debug().zoneT > 0) shown++;
  }
  ok(shown === 0, 'twenty-four taps later it has not come back (' + shown + ' frames shown)');
  G.stop();
});

console.log('freeride, across a change of stretch');
H.setSeed(4);
G.start(0, {}, 'snowcap', null, 0);
var W = G.debug(), b0 = W.biome, seen = false;
W.biomeT = 0;
for (var f = 0; f < 20000 && G.debug().biome === b0; f++) { keepAlive(); H.frames(1); }
for (f = 0; f < 5; f++) { if (G.debug().zoneT > 0) seen = true; H.frames(1); }
ok(G.debug().biome !== b0 && seen, 'a new stretch puts its name up');
G.stop();

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'zone name checks passed'));
process.exit(fail ? 1 : 0);
