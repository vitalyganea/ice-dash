/* ===========================================================
   rush.js — the snow rush has to be unstoppable, and has to stop
   -----------------------------------------------------------
   Two halves to get right. While it lasts nothing on the hill may end the
   run — including a crevasse, which is tested separately from the ordinary
   collision and does not consult invulnerability. And when it runs out it
   has to run out: a bonus that quietly never expires is not a bonus.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K0 = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT0 = K0.DRIFT;
function nextRow0(W){for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+30)return W.rows[i];return null;}
/* The run-up has to be played properly or half the seeds never reach the
   point where the rush is handed over, and the test ends up measuring the
   bot rather than the bonus. */
function steer0(W){var r=nextRow0(W);if(!r)return;var t=G._chuteAt(r.d)+r.gap;
 var fr=Math.max(1,Math.round((r.d-W.dist)/W.speed));
 function m(d){var x=W.px,v=W.vx,tr=G._turnRate();for(var k=0;k<fr;k++){v+=(d*DRIFT0*W.speed-v)*tr;x+=v;}return Math.abs(x-t);}
 if(m(-W.dir)<m(W.dir)-6)G.tap();}

/* Drive him head-on into whatever is in front, which is exactly what a
   player would do once the screen says he cannot be hurt. */
function chargeInto(seed) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', null, 0);
  var W = G.debug();
  for (var f = 0; f < 4000; f++) {
    W = G.debug(); if (!W || W.state !== 'run') return null;
    if (W.dist > 2200) break;
    steer0(W);
    H.frames(1);
  }
  return G.debug();
}

console.log('A. while it lasts, the hill cannot end the run\n');
var survived = 0, tried = 0, smashed = 0, hadCrev = 0;
for (var s = 0; s < 10; s++) {
  var W = chargeInto(500 + s * 77);
  if (!W || W.state !== 'run') continue;
  tried++;
  /* Hand him the rush directly: waiting for the 1.3%-a-row pickup to land
     in front of a bot would make this test mostly about luck. */
  var K = G._consts();
  /* Six SECONDS, not 250 metres. By distance the same bonus shrank as the
     hill sped up — it was worth half as much at the bottom of a run. */
  W.rushT = 6 * 60;
  var startD = W.dist, crevSeen = 0, died = false;
  while (G.debug() && G.debug().state === 'run' && G.debug().rushT > 4) {
    var w = G.debug();
    crevSeen += w.objects.filter(function (o) {
      return o.t === 'crevasse' && Math.abs(o.d - w.dist) < 40;
    }).length;
    /* no steering at all: let him plough into whatever is there */
    H.frames(1);
  }
  var w2 = G.debug();
  if (w2 && w2.state === 'run') survived++; else died = true;
  if (w2) smashed += w2.smashed;
  if (crevSeen) hadCrev++;
  G.stop();
}
ok(tried >= 6, 'set up ' + tried + ' charges');
ok(survived === tried, 'every one of them came out the other side (' +
   survived + '/' + tried + ')');
ok(smashed > 0, 'and went through ' + smashed + ' obstacles doing it');

console.log('\nB. and then it stops\n');
/* Straight after it lapses he is ordinary again: no steering, he dies. */
var ended = 0, n = 0;
for (s = 0; s < 10; s++) {
  var W3 = chargeInto(500 + s * 77);
  if (!W3 || W3.state !== 'run') continue;
  n++;
  W3.rushT = 40;                              // a short one, on purpose
  for (var f = 0; f < 2400; f++) {
    var w = G.debug(); if (!w || w.state !== 'run') break;
    H.frames(1);
  }
  var w4 = G.debug();
  if (!w4 || w4.state !== 'run') ended++;
  G.stop();
}
ok(n >= 6, 'set up ' + n + ' short rushes');
ok(ended === n, 'all ' + ended + ' of them ended in a crash once it lapsed');

console.log('\nC. the music follows it, and does not outlast it\n');
/* The tempo lift belongs to the rush. If it leaks past a crash, the next
   run starts at a gallop for no reason — and nothing on screen would say
   why, which is the worst kind of bug to be told about. */
(function () {
  var log = [];
  var realSfx = global.Sfx;
  global.Sfx = new Proxy({}, { get: function (t, k) {
    return function (v) { if (k === 'excite') log.push(!!v); };
  } });
  H.setSeed(77); G.start(0, {}, 'snowcap', null, 0);
  var W = G.debug();
  /* Lay one in his path rather than setting the timer by hand: setting it
     skips the pickup, so the lift never fires and the test only ever proved
     half of what it claimed. */
  var placed = false;
  for (var f = 0; f < 900 && G.debug() && G.debug().state === 'run'; f++) {
    var w = G.debug();
    if (!placed && w.dist > 400) {
      w.objects.push({ t: 'rush', x: w.px, d: w.dist + 90, r: 25,
                       got: false, ph: 0 });
      placed = true;
    }
    if (w.rushT > 0) w.rushT = Math.min(w.rushT, 24);   // cut it short
    steer0(w); H.frames(1);
  }
  G.stop();
  global.Sfx = realSfx;
  var ons = log.filter(function (x) { return x; }).length;
  var offs = log.filter(function (x) { return !x; }).length;
  ok(ons === 1, 'taking one lifts the tempo exactly once (' + ons + ')');
  ok(offs > 0 && log[log.length - 1] === false,
     'and it settles again when the rush runs out (' + offs +
     ' settles, last = ' + log[log.length - 1] + ')');
})();

console.log('\nD. it is rare enough to stay a treat\n');
var K2 = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K2.DRIFT;
function nextRow(W){for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+30)return W.rows[i];return null;}
function steer(W){var r=nextRow(W);if(!r)return;var t=G._chuteAt(r.d)+r.gap;
 var fr=Math.max(1,Math.round((r.d-W.dist)/W.speed));
 function m(d){var x=W.px,v=W.vx,tr=G._turnRate();for(var k=0;k<fr;k++){v+=(d*DRIFT*W.speed-v)*tr;x+=v;}return Math.abs(x-t);}
 if(m(-W.dir)<m(W.dir)-6)G.tap();}
var picked = 0, metres = 0, runs = 0, RUSH_M = 6 * 60;
for (s = 0; s < 10; s++) {
  H.setSeed(700 + s * 53); G.start(0, {}, 'snowcap', null, 0);
  var seen = 0, last = 0;
  for (var f = 0; f < 12000; f++) {
    var w = G.debug(); if (!w || w.state !== 'run') break;
    /* count a pickup, not a frame: the timer only ever goes up at the
       moment he takes one */
    if (w.rushT > last) seen++;
    last = w.rushT;
    steer(w); H.frames(1);
  }
  var w5 = G.debug(); runs++; picked += seen; metres += w5.dist / 8;
  G.stop();
}
/* Six seconds at roughly 4.5 units a frame is about 200m of hill. */
var share = picked * 200 / Math.max(1, metres);
console.log('  ' + runs + ' runs, ' + picked + ' rushes taken over ' +
            Math.round(metres) + 'm — about ' + (share * 100).toFixed(0) +
            '% of the hill spent rushing');
ok(share < 0.22, 'it is a bonus, not the way the game is played (' +
   (share * 100).toFixed(0) + '% of distance)');
ok(picked > 0, 'but it does turn up (' + picked + ' across ' + runs + ' runs)');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'rush checks passed'));
process.exit(fail ? 1 : 0);
