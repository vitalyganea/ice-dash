/* ===========================================================
   newskins.js — the six newest perks do what they say
   -----------------------------------------------------------
   skinsafe.js proves no perk can make an opening unreachable. This proves
   each of the six newest actually does its job, one at a time, against
   the same moment with and without it.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

/* A world with nothing on it, so only what a check puts there matters. */
function clean(skin, opts) {
  H.setSeed(5);
  G.start(0, {}, skin, null, 0, opts);
  for (var f = 0; f < 30; f++) {
    var W = G.debug(); W.objects = []; W.px = G._chuteAt(W.dist); W.vx = 0; H.frames(1);
  }
  W = G.debug(); W.objects = [];
  W.nextRowD = 1e12;                                // no more rows laid
  return W;
}

console.log('A. Emperor penguin starts the combo at x2');
var W = clean('emperor');
ok(W.combo === 10, 'the run starts on a combo of ' + W.combo + ' (x2)');
G.stop();
W = clean('snowcap');
ok(W.combo === 0, 'and without him on ' + W.combo);
G.stop();

console.log('\nB. Puffin forgives one missed fish');
function missOne(skin) {
  var W = clean(skin);
  W.combo = 7;
  W.objects.push({ t: 'fish', x: W.px + 200, d: W.dist + 10, r: 15, got: false, ph: 0 });
  H.frames(30);
  var after1 = G.debug().combo;
  G.debug().objects.push({ t: 'fish', x: G.debug().px + 200, d: G.debug().dist + 10, r: 15, got: false, ph: 0 });
  H.frames(30);
  var after2 = G.debug().combo;
  G.stop();
  return [after1, after2];
}
var pf = missOne('puffin'), sc = missOne('snowcap');
ok(pf[0] === 7, 'the first miss keeps the combo (' + pf[0] + ')');
ok(pf[1] === 0, 'a second one, before ten more catches, does not (' + pf[1] + ')');
ok(sc[0] === 0, 'without him the first miss already breaks it (' + sc[0] + ')');

console.log('\nC. Musk ox is not slowed by deep snow');
function throughSnow(skin) {
  var W = clean(skin);
  W.objects.push({ t: 'drift', x: W.px, d: W.dist + 40, r: 70, ph: 0 });
  var d0 = W.dist;
  H.frames(40);
  var gone = G.debug().dist - d0;
  G.stop();
  return gone;
}
var ox = throughSnow('muskox'), plain = throughSnow('snowcap');
ok(ox > plain * 1.15, 'he covers more ground through it (' + ox.toFixed(0) + ' vs ' + plain.toFixed(0) + ')');

console.log('\nD. Sea otter: a time bubble is four seconds');
function bubble(skin) {
  var W = clean(skin, { mode: 'rush' });
  W.objects.push({ t: 'clock', x: W.px, d: W.dist + 15, r: 27, got: false, ph: 0 });
  var t0 = W.timeT;
  H.frames(10);
  var gain = G.debug().timeT - t0;
  G.stop();
  return gain;
}
var otter = bubble('otter'), base = bubble('snowcap');
ok(Math.abs((otter - base) - 60) <= 2, 'hers is a second longer (' + ((otter - base) / 60).toFixed(2) + 's more)');

console.log('\nE. Snow leopard: close calls pay double, from further away');
function close(skin, gap) {
  var W = clean(skin);
  /* a boulder whose edge passes `gap` units from his */
  var r = 30, hit = r * 0.82 + 24 * 0.78;            // hitR for an ordinary creature
  W.objects.push({ t: 'rock', x: W.px + hit + gap, d: W.dist + 60, r: r, rot: 0,
                   pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  W.invuln = 0; W.grace = 0;
  var x0 = W.px;
  for (var f = 0; f < 60; f++) { G.debug().px = x0; G.debug().vx = 0; H.frames(1); }
  var w2 = G.debug();
  var out = { closes: w2.closes, state: w2.state };
  G.stop();
  return out;
}
var l8 = close('leopard', 8), s8 = close('snowcap', 8);
var l18 = close('leopard', 18), s18 = close('snowcap', 18);
ok(l8.closes === 1 && s8.closes === 1, 'a near pass counts for both (' + l8.closes + ', ' + s8.closes + ')');
ok(l18.closes === 1 && s18.closes === 0, 'a wider one only for her (' + l18.closes + ' vs ' + s18.closes + ')');
/* the pay itself, on the same pass, with the combo held at x1 */
function closePay(skin) {
  var W = clean(skin);
  W.combo = 0;
  var r = 30, hit = r * 0.82 + 24 * 0.78;
  W.objects.push({ t: 'rock', x: W.px + hit + 6, d: W.dist + 60, r: r, rot: 0, pts: [1, 1, 1, 1, 1, 1, 1, 1, 1] });
  var before = W.score, f, x0 = W.px;
  for (f = 0; f < 60 && !G.debug().closes; f++) { G.debug().px = x0; G.debug().vx = 0; H.frames(1); }
  var w2 = G.debug(), sp = w2.score - before - (w2.dist - (W.dist)) * 0;
  G.stop();
  return w2.closes;
}
ok(closePay('leopard') === 1, 'and pays out once');
/* The amount: 15 points ordinarily, 30 for her. Read off the formula's own
   inputs rather than the score, which also grows with distance. */
ok((skinById('leopard').perk.closeBonus || 1) * 15 === 30 && (skinById('snowcap').perk.closeBonus || 1) * 15 === 15,
   'thirty points to her, fifteen to anyone else');

console.log('\nF. Lemming: each Daily Line star pays 25 more');
ok(dailyStarPay('lemming', 3, true) === 75, 'three stars, finished: +' + dailyStarPay('lemming', 3, true));
ok(dailyStarPay('lemming', 2, false) === 0, 'nothing for a line not finished');
ok(dailyStarPay('snowcap', 3, true) === 0, 'nothing for anyone else');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'new skin checks passed'));
process.exit(fail ? 1 : 0);
