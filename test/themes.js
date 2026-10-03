/* ===========================================================
   themes.js — each marked run looks like itself, and the hill
   still crossfades cleanly now that the weather is data
   -----------------------------------------------------------
   Three biomes were added at once and every one of them brought a new
   field: falling air, an aurora, heat vents, an ash-coloured cap. Any
   field the crossfade forgets shows up as `undefined` inside a colour
   string — which canvas ignores silently, so it would never throw and
   never be noticed until someone looked at the right 500 ms of a run.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

console.log('A. every marked run has a stretch of hill to itself\n');
var seen = {}, clash = [];
COURSES.forEach(function (cd) {
  if (!BIOMES[cd.biome]) clash.push(cd.id + ' points at biome ' + cd.biome);
  else if (seen[cd.biome]) clash.push(cd.id + ' shares ' + BIOMES[cd.biome].name +
                                     ' with ' + seen[cd.biome]);
  else seen[cd.biome] = cd.id;
});
ok(!clash.length, clash.length ? clash.join('; ')
   : COURSES.map(function (c) { return BIOMES[c.biome].name; }).join(', '));

console.log('\nB. the crossfade carries every field, at every point of the fade\n');
/* A colour that came out of a missing field reads "rgb(NaN,...)" or has the
   word undefined in it. Walk two full cycles of the hill and look at all of
   them, not just the ones a screenshot happened to catch. */
H.setSeed(3); G.start(0, {});
var W = G.debug(), bad = [], checked = 0;
var K = G._consts();
for (var b = 0; b < BIOMES.length * 2; b++) {
  for (var f = 0; f <= 10; f++) {
    W.biome = b; W.biomeT = f * 52;               // 0..520, the whole fade
    var P = G._buildPal();
    Object.keys(P).forEach(function (k) {
      var v = P[k];
      var vals = (k === 'sky') ? v : [v];
      vals.forEach(function (one) {
        if (typeof one === 'string') {
          checked++;
          if (/undefined|NaN/.test(one)) bad.push(BIOMES[b % BIOMES.length].name +
                                                  ' t=' + (f * 52) + ' ' + k + '=' + one);
        } else if (typeof one === 'number' && !isFinite(one)) {
          checked++;
          bad.push(BIOMES[b % BIOMES.length].name + ' ' + k + ' is not a number');
        } else if (one && typeof one === 'object') {
          Object.keys(one).forEach(function (kk) {
            checked++;
            var u = one[kk];
            if (typeof u === 'string' ? /undefined|NaN/.test(u)
                                      : !isFinite(u))
              bad.push(BIOMES[b % BIOMES.length].name + ' air.' + kk + '=' + u);
          });
        }
      });
    });
  }
}
ok(!bad.length, bad.length ? bad.slice(0, 4).join(' | ')
   : 'checked ' + checked + ' blended values across ' + (BIOMES.length * 2) + ' handovers');

console.log('\nC. a marked run stays in its own weather from start to finish\n');
COURSES.forEach(function (cd) {
  H.setSeed(11); G.start(0, {}, 'snowcap', cd.id);
  var drift = 0, want = BIOMES[cd.biome].name;
  for (var i = 0; i < 400; i++) {
    H.frames(6);
    var w = G.debug(); if (!w || w.state !== 'run') break;
    if (G._buildPal().name !== want) drift++;
  }
  G.stop();
  ok(drift === 0, cd.id.padEnd(11) + ' held ' + want + (drift ? ' — drifted ' + drift + ' times' : ''));
});

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'theme checks passed'));
process.exit(fail ? 1 : 0);
