/* Nothing may be deleted while it is still on screen. The cull used to sit at
   a fixed 160 units behind the penguin, but a tall phone shows four times
   that much hill below him, so everything he passed winked out mid-picture. */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

H.setSeed(1); G.start(0, {}); G.stop();
var DRIFT, TURN;
function steer() {
  var W = G.debug(); if (!W || W.state !== 'run') return;
  var row = null;
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) { row = W.rows[i]; break; }
  if (!row) return;
  var t = G._chuteAt(row.d) + row.gap;
  var fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
  function m(dir) { var x = W.px, v = W.vx;
    for (var k = 0; k < fr; k++) { v += (dir * DRIFT * W.speed - v) * TURN; x += v; }
    return Math.abs(x - t); }
  if (m(-W.dir) < m(W.dir) - 6) G.tap();
}

[['laptop', 1440, 900], ['phone portrait', 390, 844], ['very tall', 360, 1280],
 ['superwide', 5120, 1440]].forEach(function (s) {
  global.window.innerWidth = s[1]; global.window.innerHeight = s[2];
  H.setSeed(4242); G.start(0, {}); G.resize();
  var K = G._consts();
  DRIFT = K.DRIFT; TURN = K.TURN;

  var seen = new Map(), worst = -1e9, worstT = null, vanished = 0, onScreenKills = 0;
  for (var f = 0; f < 2600; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;

    var now = new Set();
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      now.add(o);
      /* The TOP of it, not its anchor. A tunnel or a crevasse reaches back
         up the screen from o.d, and that far edge is the last part still in
         view — recording only o.d, this check happily passed a snow bridge
         being deleted with a third of it on screen. */
      seen.set(o, G._screen(o.x, o.d + (o.span || 0)).y);
    }
    seen.forEach(function (lastY, o) {
      if (now.has(o)) return;
      vanished++;
      /* it should only ever go while already past the bottom edge */
      if (lastY < K.VIEW_H) { onScreenKills++; }
      if (K.VIEW_H - lastY > worst) { worst = K.VIEW_H - lastY; worstT = o.t; }
      seen.delete(o);
    });

    steer(); H.frames(1);
  }
  G.stop();
  console.log('  ' + s[0].padEnd(15) + ' view ' + K.VIEW_W + 'x' + K.VIEW_H +
              '  below player ' + (K.VIEW_H - K.PLAYER_Y) +
              '  culled ' + vanished +
              '  while visible: ' + onScreenKills +
              (onScreenKills ? '  (worst ' + Math.round(worst) + 'px inside, a ' + worstT + ')' : ''));
  ok(vanished > 40, s[0] + ': saw enough objects retire (' + vanished + ')');
  ok(onScreenKills === 0, s[0] + ': nothing was deleted while still on screen');
});

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'persistence checks passed'));
process.exit(fail ? 1 : 0);
