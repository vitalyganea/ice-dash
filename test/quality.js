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

/* From here each ride starts clean at a known tier, one step in each. */
G.quality({ fx: 'auto', res: 'auto' }, 2);
r = ride(40, 3.2);
var q = G.qualityNow();
ok(q.fx === 2 && q.res === 1, 'still 40: the weather is thinned and the glows go out (low effects), the density kept (' + JSON.stringify(q) + ')');
r = ride(40, 7);
q = G.qualityNow();
ok(q.tier === 3 && q.res === 1 && r.w === 618, 'that is the bottom of the ladder: auto never goes to density 1, which looked soft for nothing (' + r.w + ' wide)');
G.quality({ fx: 'auto', res: 2 });
ok(canvas.width === 412, 'density 1 only when chosen (' + canvas.width + ' wide)');

/* The player's own choice holds, whatever the frame rate. */
var stepped = [];
G.onQualityStep(function (t) { stepped.push(t); });
G.quality({ fx: 0, res: 0 }, 0);
r = ride(40, 7);
q = G.qualityNow();
ok(q.fx === 0 && q.res === 0 && !r.lowres && !r.lite && stepped.length === 0, 'both chosen High: nothing steps down at 40 a second (' + JSON.stringify(q) + ')');
G.quality({ fx: 0, res: 'auto' }, 0);
r = ride(40, 7);
q = G.qualityNow();
ok(q.fx === 0 && q.res === 1, 'effects chosen High, sharpness left to auto: only the sharpness comes down (' + JSON.stringify(q) + ')');
ok(stepped.length === 1, 'each step is handed out to be remembered on the device (' + stepped.join(',') + ')');
G.quality({ fx: 2, res: 0 });
ok(G.qualityNow().fx === 2 && G.qualityNow().res === 0 && canvas.width === 824, 'low effects at full sharpness, as chosen (' + canvas.width + ')');
G.quality({ fx: 3, res: 0 });
ok(G.qualityNow().fx === 3, 'effects Off, as chosen');
G.quality({ fx: 0, res: 3 });
q = G.qualityNow();
ok(q.res !== 3, 'Off is for effects only: sharpness has no such level (' + JSON.stringify(q) + ')');
G.quality({ fx: 'auto', res: 'auto' }, 1);
q = G.qualityNow();
ok(q.tier === 1 && q.res === 1 && q.fx === 0, 'auto again, from the tier the device remembers (' + JSON.stringify(q) + ')');
G.quality({ fx: 'nonsense', res: 7 });
ok(G.qualityNow().tier === 1, 'anything else is auto');
G.onQualityStep(null);

console.log(fail ? '\n' + fail + ' quality check(s) FAILED' : '\nquality checks passed');
process.exit(fail ? 1 : 0);
