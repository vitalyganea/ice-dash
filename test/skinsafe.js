/* ===========================================================
   skinsafe.js — a perk may only ever be generous
   -----------------------------------------------------------
   The spawner proves every opening reachable using the biome's grip and
   the run's top speed. A perk that made turning worse, the penguin
   wider or the hill faster would silently create rows nobody can make.
   This enforces that as a rule rather than a comment: new perks must be
   declared here, and the scaling ones must point the generous way.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

/* key -> how it is allowed to move. 'up' means a multiplier that must be
   >= 1; 'flag' means a plain on/off that cannot take anything away. */
/* 'up' may only ever be >= 1, 'down' only ever <= 1, 'flag' is a switch.
   Every perk has to be in here: the whole rule of the catalogue is that a
   perk may only make the hill more forgiving, and a perk nobody declared
   is a perk nobody checked the direction of. */
var ALLOWED = { reach: 'up', shoal: 'up', startShield: 'flag',
                goldRate: 'up', gateBonus: 'up', fogRelief: 'up', grip: 'up',
                rampBoost: 'up', gateWide: 'up', rampWide: 'up',
                foresight: 'flag',
                /* the newest six: each only ever adds, or forgives */
                comboKeep: 'flag', bogImmune: 'flag', clockGain: 'up',
                closeBonus: 'up', closeWide: 'up', dailyStar: 'up', comboStart: 'up',
                /* the ramp is GENTLER, so smaller is the generous way */
                slowRamp: 'down',
                /* shrinks his hitbox, so smaller is the generous way */
                slim: 'down' };

console.log('A. every perk is declared and points the generous way');
SKINS.forEach(function (sk) {
  var keys = Object.keys(sk.perk || {});
  keys.forEach(function (k) {
    var rule = ALLOWED[k];
    ok(!!rule, sk.id + ': "' + k + '" is a declared perk' +
       (rule ? '' : ' — add it to ALLOWED and say which way it may move'));
    if (rule === 'up') ok(sk.perk[k] >= 1,
      sk.id + ': ' + k + ' = ' + sk.perk[k] + ' is generous (>= 1)');
    if (rule === 'down') ok(sk.perk[k] <= 1 && sk.perk[k] > 0,
      sk.id + ': ' + k + ' = ' + sk.perk[k] + ' is generous (0 < x <= 1)');
  });
  if (!keys.length) ok(true, sk.id + ': no perk');
});

console.log('\nB. no skin can make an opening unreachable');
var K0 = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K0.DRIFT, TURN = K0.TURN;

function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
function steer(W) {
  var r = nextRow(W); if (!r) return;
  var t = G._chuteAt(r.d) + r.gap;
  var fr = Math.max(1, Math.round((r.d - W.dist) / W.speed));
  /* Steer with the rate the game is really using, perk included — the
     bare constant made a sharper-turning skin look worse than none. */
  function m(d) { var x = W.px, v = W.vx;
    for (var k = 0; k < fr; k++) { v += (d * DRIFT * W.speed - v) * G._turnRate(); x += v; }
    return Math.abs(x - t); }
  if (m(-W.dir) < m(W.dir) - 6) G.tap();
}
function achievable(step, speed, grip) {
  var fr = Math.max(1, Math.floor(step / speed));
  var t = TURN * grip, x = 0, vx = -DRIFT * speed;
  for (var k = 0; k < fr; k++) { vx += (DRIFT * speed - vx) * t; x += vx; }
  return x;
}

SKINS.forEach(function (sk) {
  var pairs = 0, bad = 0, over = 0, tight = 1e9;
  [7, 555, 90210].forEach(function (seed) {
    H.setSeed(seed); G.start(0, {}, sk.id);
    var rows = [], byD = {};
    for (var f = 0; f < 5000; f++) {
      var W = G.debug(); if (!W || W.state !== 'run') break;
      steer(W); H.frames(1);
      W = G.debug(); if (!W || W.state !== 'run') break;
      for (var i = 0; i < W.rows.length; i++) {
        var r = W.rows[i];
        if (!byD[r.d]) { byD[r.d] = { d: r.d, gap: r.gap, reach: r.reach, crossed: false };
                         rows.push(byD[r.d]); }
        var rec = byD[r.d];
        if (!rec.crossed && W.dist >= r.d) {
          rec.crossed = true;
          rec.grip = BIOMES[W.biome % BIOMES.length].grip;
          rec.speed = W.speed;
        }
      }
    }
    G.stop();
    rows.sort(function (a, b) { return a.d - b.d; });
    for (var j = 1; j < rows.length; j++) {
      var a = rows[j - 1], b = rows[j];
      if (!a.crossed || !b.crossed) continue;
      var need = Math.abs(b.gap - a.gap);
      var can = achievable(b.d - a.d, Math.max(a.speed, b.speed), Math.min(a.grip, b.grip));
      pairs++;
      if (need > can) bad++;
      if (b.reach > can) over = Math.max(over, b.reach - can);
      tight = Math.min(tight, can - need);
    }
  });
  ok(bad === 0 && over === 0,
     sk.id.padEnd(8) + ' ' + pairs + ' pairs, ' + bad + ' impossible, ' +
     over.toFixed(1) + 'px overreach, tightest ' + tight.toFixed(1) + 'px');
});

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'skin safety checks passed'));
process.exit(fail ? 1 : 0);
