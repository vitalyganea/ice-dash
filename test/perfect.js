/* ===========================================================
   perfect.js — the last-moment tap
   -----------------------------------------------------------
   A tap that turns him towards an opening within about a third of a
   second of reaching it, and carries him through, is a perfect tap:
   points, a step on the combo. Too early, a flutter of taps, a tap away
   from the opening, or missing the opening is not. And it must not touch
   the speed — the spawner proves every row at the hill's own pace.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

/* one row ahead, `frames` away, its opening `side` of him; then he taps */
function ride(frames, side, opts) {
  opts = opts || {};
  H.setSeed(3);
  G.start(0, {}, 'snowcap', null, 0);
  for (var f = 0; f < 40; f++) { var w = G.debug(); w.objects = []; w.px = G._chuteAt(w.dist); w.vx = 0; H.frames(1); }
  var W = G.debug();
  W.objects = []; W.nextRowD = 1e12; W.invuln = 9999;
  W.dir = -side; W.vx = 0;
  var d = W.dist + W.speed * frames;
  /* rows keep their opening relative to the chute centre at their own distance */
  W.rows = [{ d: d, gap: W.px + side * (opts.off || 25) - G._chuteAt(d), gapW: opts.w || 220 }];
  if (opts.flutter) { G.tap(); H.frames(4); G.tap(); H.frames(4); }
  var speed0 = W.speed, s0 = W.score, c0 = W.combo;
  G.tap();
  var gone = 0;
  for (f = 0; f < frames + 6; f++) { H.frames(1); if (G.debug().dist > d) gone++; }
  var w2 = G.debug();
  var out = { perfects: w2.perfects, combo: w2.combo - c0, speedOk: Math.abs(w2.speed - speed0) < 0.05, crossed: gone > 0 };
  G.stop();
  return out;
}

console.log('A. the last-moment tap');
var p = ride(14, 1);
ok(p.crossed && p.perfects === 1, 'a tap 14 frames out, towards the opening, through it: perfect');
ok(p.combo === 1, 'and it is a step on the combo');
ok(p.speedOk, 'and it does not change his speed');
var pl = ride(14, -1);
ok(pl.perfects === 1, 'the same to the left');

console.log('\nB. what is not');
ok(ride(45, 1).perfects === 0, 'a tap 45 frames out is just a tap');
ok(ride(14, 1, { flutter: true }).perfects === 0, 'a flutter of taps is not a perfect one');
ok(ride(14, 1, { off: -25 }).perfects === 0, 'a tap away from the opening is not');
ok(ride(14, 1, { off: 260, w: 60 }).perfects === 0, 'and missing the opening is not');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'perfect-tap checks passed'));
process.exit(fail ? 1 : 0);
