/* How dense the picture is, and how it steps down on a device that cannot
   keep up. The canvas is never denser than 2 pixels to a CSS pixel: 2.5
   cost a phone half as many pixels again on every frame for nothing you
   can see. A run that keeps missing frames steps down one stage at a time
   — fewer pixels first, then the decorative layers — and a phone that
   holds its pace, or a single hiccup, never does. */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
var canvas = H.byId['game'];

global.window.innerWidth = 412; global.window.innerHeight = 915;
global.window.devicePixelRatio = 2.625;
G.resize();
ok(canvas.width === 824 && canvas.height === 1830, 'a 412×915 phone at 2.625 gets a canvas at density 2 (' + canvas.width + '×' + canvas.height + ')');
global.window.devicePixelRatio = 1.5; G.resize();
ok(canvas.width === 618, 'a screen at 1.5 keeps its own density (' + canvas.width + ')');
global.window.devicePixelRatio = 2.625; G.resize();

function ride(hz, secs) {
  H.setSeed(7);
  G.attract('snowcap');                 // steers itself and never ends
  H.framesAt(hz, Math.round(hz * secs));
  G.stop();
  return { lowres: G._lowres(), lite: G._lite(), w: canvas.width };
}
var r = ride(60, 10);
ok(!r.lowres && !r.lite, '60 frames a second for ten seconds: full quality');
r = ride(55, 10);
ok(!r.lowres && !r.lite, '55 a second for ten seconds: still full quality');
G.attract('snowcap'); H.framesAt(60, 60); H.framesAt(4, 1); H.framesAt(60, 300); G.stop();
ok(!G._lowres(), 'a quarter-second hiccup in a smooth run is not a slow device');
r = ride(40, 3.2);
ok(r.lowres && !r.lite && r.w === 618, '40 a second: after two seconds and a bit, fewer pixels first (density 1.5, ' + r.w + ' wide), the layers kept');
r = ride(40, 3.2);
ok(r.lowres && r.lite, 'still 40 a second after that: the decorative layers go as well');

console.log(fail ? '\n' + fail + ' quality check(s) FAILED' : '\nquality checks passed');
process.exit(fail ? 1 : 0);
