/* ===========================================================
   perfect.js — the dodge
   -----------------------------------------------------------
   A PERFECT is a close call he made himself: he scrapes past an obstacle,
   and the tap that turned him away from it came in the last moment
   before he reached it. A close call with no such tap — too early, after
   it, or a tap towards the thing — is only CLOSE. Neither touches speed:
   the spawner proves every row at the hill's own pace.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
var PR = (H.setSeed(1), G.start(0, {}), G._consts().PR); G.stop();

/* A boulder dead ahead whose edge passes 6 units from his, `ahead` frames
   away. He is held on his line so the pass is exact; the tap still turns
   him in the rules' eyes. `tapAt` is the frame of the tap (or null), and
   `toward` makes it a tap towards the boulder instead of away. */
function pass(tapAt, toward) {
  H.setSeed(5);
  G.start(0, {}, 'snowcap', null, 0);
  for (var f = 0; f < 30; f++) { var w = G.debug(); w.objects = []; w.px = G._chuteAt(w.dist); w.vx = 0; H.frames(1); }
  var W = G.debug();
  W.objects = []; W.nextRowD = 1e12; W.invuln = 0; W.grace = 0; W.combo = 0;
  var ahead = 40, r = 30, hit = r * 0.82 + PR * 0.78;
  W.objects.push({ t: 'rock', x: W.px + hit + 6, d: W.dist + W.speed * ahead, r: r, rot: 0,
                   pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  /* boulder on his right: away is left (-1), so before the tap he goes right */
  W.dir = toward ? -1 : 1;
  var x0 = W.px, speed0 = W.speed;
  for (f = 0; f < ahead + 20; f++) {
    if (f === tapAt) G.tap();
    var w2 = G.debug(); w2.px = x0; w2.vx = 0;
    H.frames(1);
  }
  W = G.debug();
  var out = { perfects: W.perfects, closes: W.closes, combo: W.combo, alive: W.state === 'run',
              speedOk: Math.abs(W.speed - speed0) < 0.2 };
  G.stop();
  return out;
}

console.log('A. the dodge');
var p = pass(28);
ok(p.alive && p.closes === 1 && p.perfects === 1, 'a tap away from the boulder 12 frames before it, a scrape past: PERFECT');
ok(p.combo === 1, 'and a step on the combo');
ok(p.speedOk, 'and no change of speed');
var lv = pass(41);
ok(lv.perfects === 1, 'a tap when already level with it, still scraping past, is a PERFECT too');

console.log('\nB. what is only CLOSE');
var n = pass(null);
ok(n.closes === 1 && n.perfects === 0, 'the same scrape with no tap is a close call, not a PERFECT');
ok(pass(0).perfects === 0, 'a tap 40 frames out, well before it, is not');
ok(pass(28, true).perfects === 0, 'a tap towards the boulder is not');
ok(pass(56).perfects === 0, 'a tap after it has gone by is not');

console.log('\nC. PERFECTs in a row chain');
/* two boulders, one each side, the second just after the first: two dodges */
function twice(gap) {
  H.setSeed(5);
  G.start(0, {}, 'snowcap', null, 0);
  for (var f = 0; f < 30; f++) { var w = G.debug(); w.objects = []; w.px = G._chuteAt(w.dist); w.vx = 0; H.frames(1); }
  var W = G.debug();
  W.objects = []; W.nextRowD = 1e12; W.invuln = 0; W.grace = 0;
  var r = 30, hit = r * 0.82 + PR * 0.78, x0 = W.px;
  var d1 = W.dist + W.speed * 40, d2 = d1 + W.speed * gap;
  W.objects.push({ t: 'rock', x: x0 + hit + 6, d: d1, r: r, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  W.objects.push({ t: 'rock', x: x0 - hit - 6, d: d2, r: r, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  W.dir = 1;
  var s0 = W.score, t1 = false, t2 = false, chainSeen = 0;
  for (f = 0; f < 40 + gap + 30; f++) {
    var w2 = G.debug(); w2.px = x0; w2.vx = 0;
    if (!t1 && d1 - w2.dist <= w2.speed * 12) { G.tap(); t1 = true; }      // now going left, away from the first
    if (!t2 && d2 - w2.dist <= w2.speed * 12) { G.tap(); t2 = true; }      // now right, away from the second
    H.frames(1);
    chainSeen = Math.max(chainSeen, G.debug().perfChain);
  }
  W = G.debug();
  var out = { perfects: W.perfects, chain: chainSeen };
  G.stop();
  return out;
}
var c = twice(60);
ok(c.perfects === 2 && c.chain === 2, 'two dodges a second apart: the second reads x2');
var c2 = twice(260);
ok(c2.perfects === 2 && c2.chain === 1, 'four seconds apart they do not chain');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'perfect checks passed'));
process.exit(fail ? 1 : 0);
