/* One stretch of hill fading into the next. The stones and pines are
   pictures painted once and copied after; through a fade they used to be
   drawn fresh every frame, which doubled the cost of a frame, and at its
   end every one on screen painted its new picture in the same frame —
   thirty to sixty canvases at once, which a phone felt as the game
   freezing each time the hill changed. Now each keeps its old picture,
   gets a new one a few a frame, and the two are crossfaded. The new ones
   are begun a second and a half before the stretch ends. */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

/* The hill behind the title plays silent with a copy of every sound's name;
   the harness's catch-all has no names to copy, so give it audio.js's. */
var SND = {};
require('vm').runInNewContext(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'audio.js'), 'utf8') +
  ';Object.keys(Sfx)', { window: {} }).forEach(function (k) { SND[k] = function () {}; });
global.Sfx = SND;

var made = 0, mk = global.document.createElement;
global.document.createElement = function () { made++; return mk.apply(this, arguments); };
var ZONE = BIOME_LEN * 8, FADE = 520, PER_FRAME = 4;

function frame() {
  var m0 = made, o0 = H.calls.ops;
  H.frames(1);
  return { made: made - m0, ops: H.calls.ops - o0 };
}
function scenery(W) { return W.objects.filter(function (o) { return o.t === 'rock' || o.t === 'tree' || o.t === 'deco'; }); }
function avg(a) { return a.reduce(function (s, x) { return s + x; }, 0) / Math.max(1, a.length); }

H.setSeed(11);
G.attract('snowcap');                   // steers itself and never ends
H.frames(240);                          // four seconds: the hill fills with stones and pines
var W = G.debug();

var worst = 0, held = 0, fadeOps = [], steadyOps = [], changes = 0, opening = [], floraSeen = 0, floraBare = 0;
for (var z = 0; z < BIOMES.length; z++) {
  var steady = [];
  for (var i = 0; i < 60; i++) { var f = frame(); steady.push(f.ops); worst = Math.max(worst, f.made); }
  steadyOps.push(avg(steady));
  /* Leaves, palms and crystals were painted fresh on every frame, most of
     a frame on a slow phone (SYSTEMS row 135); now they are pictures too. */
  if (BIOMES[W.biome % BIOMES.length].flora)
    scenery(W).forEach(function (o) {
      if (o.t === 'rock' || (o.t === 'deco' && o.kind !== 'tree')) return;
      var sy = G._screen(o.x, o.d).y;
      if (sy < 40 || sy > 500) return;   // well inside the picture, drawn for a while
      floraSeen++; if (!(o._pics && o._pics.length)) floraBare++;
    });
  var from = W.biome;
  W.biomeT = ZONE - W.speed * 150;      // two and a half seconds from the next stretch
  var inFade = [], newPics = 0;
  for (i = 0; i < 2000 && !(W.biome !== from && W.biomeT >= FADE); i++) {
    f = frame(); worst = Math.max(worst, f.made);
    if (W.biome !== from) {
      inFade.push(f.ops);
      if (inFade.length <= 10) newPics += f.made;
      scenery(W).forEach(function (o) { held = Math.max(held, (o._pics || []).length); });
    }
  }
  if (W.biome !== from) changes++;
  fadeOps.push(avg(inFade));
  opening.push(newPics);
  for (i = 0; i < 30; i++) { f = frame(); worst = Math.max(worst, f.made); }
  var after = scenery(W), extra = after.filter(function (o) { return (o._pics || []).length > 1; }).length;
  ok(extra === 0, BIOMES[W.biome % BIOMES.length].name + ': after the fade each thing holds one picture (' +
     after.length + ' things, ' + extra + ' still holding two)');
}
G.stop();

ok(floraSeen > 10 && floraBare === 0, 'where leaves, palms and crystals grow, each is copied from its picture (' +
   floraSeen + ' seen, ' + floraBare + ' painted fresh)');
ok(changes === BIOMES.length, 'the hill went through every stretch (' + changes + ' of ' + BIOMES.length + ')');
ok(worst <= PER_FRAME, 'no frame paints more than ' + PER_FRAME + ' new pictures, in a fade, at its end or between (worst ' + worst + ')');
ok(held <= 2, 'through a fade a thing holds at most two pictures, the old and the new (' + held + ')');
ok(Math.max.apply(null, opening) <= PER_FRAME, 'a fade opens with the new pictures already made (new in its first ten frames: ' + opening.join(' ') + ')');
var ratio = avg(fadeOps) / avg(steadyOps);
ok(ratio < 1.3, 'a frame in a fade costs about what a frame between fades does (' + ratio.toFixed(2) + 'x)');

console.log(fail ? '\n' + fail + ' fade check(s) FAILED' : '\nfade checks passed');
process.exit(fail ? 1 : 0);
