/* ===========================================================
   crevasse.js — the hole in the ice and the ramp over it
   -----------------------------------------------------------
   The ramp sits in the row's opening, so aiming at it is the same act
   as aiming at any other gap. What has to be proved is the rest: that
   the air lasts long enough to clear the hole at every speed, that
   missing it is fatal, and that nobody lands on something they were
   never shown.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT, TURN = K.TURN;

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

/* ---- A. a player who aims gets over them -------------------- */
console.log('A. an aiming player clears the crevasses');
var crossed = 0, fellIn = 0, seen = 0, jumps = 0, minAirLeft = 1e9;
[3, 17, 42, 101, 777].forEach(function (seed) {
  H.setSeed(seed); G.start(0, {}, 'snowcap');
  var wasAir = false;
  for (var f = 0; f < 9000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    steer(W);
    var air = W.airTo > W.dist;
    if (air && !wasAir) jumps++;
    wasAir = air;
    /* how much air is left the moment the far lip goes by */
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (o.t === 'crevasse' && o.passed && !o.checked &&
          W.dist >= o.d + 150) {
        o.checked = true;
        minAirLeft = Math.min(minAirLeft, W.airTo - W.dist);
      }
    }
    H.frames(1);
  }
  var W2 = G.debug();
  if (W2) { seen += W2.crevs; if (W2.state === 'crash') fellIn++; }
  crossed += jumps;
  G.stop();
});
ok(seen > 12, 'the hill produced ' + seen + ' crevasses across 5 runs');
ok(jumps > 10, 'the ramp launched ' + jumps + ' times');
ok(minAirLeft > 0, 'air still remained when the far lip passed (least ' +
   (minAirLeft === 1e9 ? 'n/a' : Math.round(minAirLeft)) + ' units)');

/* ---- B. missing the ramp is fatal --------------------------- */
console.log('\nB. missing the ramp drops you in');
var died = 0, tried = 0;
for (var s = 0; s < 120 && tried < 34; s++) {
  H.setSeed(1000 + s * 37); G.start(0, {}, 'snowcap');
  var target = null, launched = false;
  for (var f = 0; f < 9000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    if (!target) {
      for (var i = 0; i < W.objects.length; i++)
        if (W.objects[i].t === 'crevasse') { target = W.objects[i]; break; }
      steer(W);
      if (W.airTo > W.dist) launched = true;
    } else if (W.dist > target.d - 400) {
      if (W.airTo > W.dist) launched = true;
      /* deliberately sit against the bank so the ramp is missed */
      if (W.px < G._chuteAt(W.dist)) { if (W.dir > 0) G.tap(); }
      else if (W.dir < 0) G.tap();
    } else steer(W);
    H.frames(1);
    var W3 = G.debug();
    /* A bubble or a snow rush is SUPPOSED to carry him across, so an
       attempt made under either proves nothing about the ramp. Count only
       the unprotected ones. This block used to count them all, and adding
       the rush quietly turned a 10-of-12 into a 7-of-12 "failure" that was
       really the new bonus doing its job. */
    /* Hugging the bank does not always miss: the ramp spans the whole
       opening, so when the opening happens to sit against that bank he
       clips it and flies. Those are not misses at all, and counting them
       is why this read 71% fatal with a 75% bar — the setup, not the game.
       An attempt only counts if he never left the ground. */
    if (W3 && W3.airTo > W3.dist) launched = true;
    /* Grace after spending a life now carries him over a hole too, so an
       attempt made inside it says nothing about the ramp. */
    var guarded = W3 && (W3.shield > 0 || W3.rushT > 0 || W3.grace > 0 || launched);
    if (target && W3 && W3.state !== 'run' && W3.dist >= target.d - 30) {
      if (!guarded) { tried++; died++; }
      break;
    }
    if (target && W3 && W3.dist > target.d + 200) {
      if (!guarded) tried++;
      break;
    }   // survived it
  }
  G.stop();
}
ok(tried >= 24, 'set up ' + tried + ' deliberate misses');
ok(died >= tried * 0.75,
   'missing the ramp ended the run ' + died + ' times out of ' + tried);

/* ---- C. coming down is survivable --------------------------- */
/* The rule that matters is not "the hill is empty after a jump" — a
   ramp-boosting skin flies far past any lane we could clear — but "you
   are never killed by what you land on". */
function landingTest(skinId) {
  var landings = 0, killedOnLanding = 0, killedInAir = 0;
  [5, 23, 61, 88].forEach(function (seed) {
    H.setSeed(seed); G.start(0, {}, skinId);
    var wasAir = false, sinceLand = 1e9;
    for (var f = 0; f < 9000; f++) {
      var W = G.debug(); if (!W) break;
      if (W.state !== 'run') {
        if (sinceLand <= 30) killedOnLanding++;
        if (wasAir) killedInAir++;
        break;
      }
      steer(W);
      H.frames(1);
      W = G.debug(); if (!W || W.state !== 'run') {
        if (sinceLand <= 30) killedOnLanding++;
        if (wasAir) killedInAir++;
        break;
      }
      var air = W.airTo > W.dist;
      if (wasAir && !air) { landings++; sinceLand = 0; }
      else sinceLand++;
      wasAir = air;
    }
    G.stop();
  });
  return { landings: landings, onLanding: killedOnLanding, inAir: killedInAir };
}

console.log('\nC. coming down is survivable');
/* 'bear' was deleted two rounds of skins ago and skinById falls back to the
   penguin without a word, so this block quietly ran snowcap twice. Name the
   skins that actually change the jump, and refuse an id that is not real. */
['snowcap', 'orca', 'reindeer', 'walrus'].forEach(function (id) {
  if (!SKIN_BY_ID[id]) { console.log('  FAIL no such skin: ' + id); fail++; return; }
  var r = landingTest(id);
  ok(r.landings > 8, id + ': landed ' + r.landings + ' times');
  ok(r.inAir === 0, id + ': never killed while in the air');
  ok(r.onLanding === 0, id + ': never killed in the 30 frames after touching down' +
     (r.onLanding ? ' (' + r.onLanding + ' times)' : ''));
});

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'crevasse checks passed'));
process.exit(fail ? 1 : 0);
