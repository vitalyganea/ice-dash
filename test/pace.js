/* The world moves sixty steps a second whatever the screen does, and the
   picture is the world's alone, so a refresh that moved it gets a picture
   and one that did not gets none. A 90 or 120 Hz phone calls the loop more
   often than the world steps; painting the same picture again on every
   refresh doubled the work on a 120 Hz phone, which grew hot after a few
   minutes of play and slowed itself down. A slower screen, or a phone that
   falls behind, still gets a picture on every frame it shows. */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

function ride(hz, secs) {
  H.setSeed(7);
  G.attract('snowcap');                 // the hill behind the title: it steers itself and never ends
  H.framesAt(hz, hz);                   // a second to settle
  var t0 = G.debug().t, p0 = H.calls.paints, n = hz * secs, moved = 0;
  for (var i = 0; i < n; i++) {
    var t = G.debug().t;
    H.framesAt(hz, 1);
    if (G.debug().t !== t) moved++;
  }
  var r = { steps: G.debug().t - t0, paints: H.calls.paints - p0, frames: n, moved: moved };
  G.stop();
  return r;
}

[60, 90, 120, 144].forEach(function (hz) {
  var r = ride(hz, 5);
  ok(Math.abs(r.steps - 300) <= 1, hz + ' Hz: the world takes 60 steps a second (' + r.steps + ' in 5 s)');
  ok(r.paints === r.moved, hz + ' Hz: a picture for each refresh that moved the world, none for the rest (' +
     r.paints + ' pictures, ' + r.moved + ' of ' + r.frames + ' refreshes moved it)');
  ok(r.paints <= r.steps, hz + ' Hz: never more pictures than steps (' + r.paints + ' for ' + r.steps + ')');
});
/* last: a screen this slow switches the picture to its lighter quality,
   which repaints once more, so here it is "at least" */
var slow = ride(30, 5);
ok(slow.paints >= slow.frames, '30 Hz: a picture on every frame it shows (' + slow.paints + ' for ' + slow.frames + ' frames)');
ok(Math.abs(slow.steps - 300) <= 1, '30 Hz: and the world keeps its pace (' + slow.steps + ' steps in 5 s)');

console.log(fail ? '\n' + fail + ' pace check(s) FAILED' : '\npace checks passed');
process.exit(fail ? 1 : 0);
