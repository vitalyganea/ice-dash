/* A gate must go green only when it was actually taken. */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT, TURN = K.TURN;

function play(seed, aim) {
  H.setSeed(seed); G.start(0, {}, 'snowcap');
  var seen = [], byD = {};
  for (var f = 0; f < 7000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    if (aim) {
      var row = null;
      for (var i = 0; i < W.rows.length; i++)
        if (W.rows[i].d > W.dist + 30) { row = W.rows[i]; break; }
      if (row) {
        var t = G._chuteAt(row.d) + row.gap;
        var fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
        var tr = G._turnRate();
        var m = function (d) { var x = W.px, v = W.vx;
          for (var k = 0; k < fr; k++) { v += (d * DRIFT * W.speed - v) * tr; x += v; }
          return Math.abs(x - t); };
        if (m(-W.dir) < m(W.dir) - 6) G.tap();
      }
    }
    H.frames(1);
    W = G.debug(); if (!W) break;
    for (var j = 0; j < W.objects.length; j++) {
      var o = W.objects[j];
      if (o.t !== 'gate' || !o.passed) continue;
      if (byD[o.d]) continue;
      byD[o.d] = 1;
      seen.push({ scored: !!o.scored });
    }
  }
  var g = G.debug() ? G.debug().gates : 0;
  G.stop();
  return { seen: seen, gates: g };
}

/* Aiming at the row's opening is not the same as threading the gate inside
   it, so a normal run should take some and miss some. */
var a = play(31, true), b = play(77, true);
var aScored = a.seen.filter(function (x) { return x.scored; }).length;
var bScored = b.seen.filter(function (x) { return x.scored; }).length;
ok(a.seen.length > 3, 'an aiming run went past ' + a.seen.length + ' gates');
ok(aScored === a.gates,
   'every gate drawn green was one that scored (' + aScored + ' green, ' + a.gates + ' scored)');
ok(b.seen.length > 3, 'a second run went past ' + b.seen.length + ' gates');
ok(bScored === b.gates,
   'and there too, green matched scored (' + bScored + ' / ' + b.gates + ')');
var totalSeen = a.seen.length + b.seen.length, totalGot = aScored + bScored;
ok(totalGot < totalSeen,
   'gates are a decision, not free score: ' + totalGot + ' of ' + totalSeen +
   ' taken, so the grey missed state does happen');
console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'gate feedback checks passed'));
process.exit(fail ? 1 : 0);
