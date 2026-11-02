/* ===========================================================
   store/trailer/gameplay.js — plain gameplay clips for short video
   -----------------------------------------------------------
   Thirty seconds of each world, of Time Rush and of Avalanche, as a
   player sees them, for TikTok, Reels and Shorts: the game's own screen
   with its pause button, no words or effects over it, and its own sound.
   The pictures are taken as capture.js takes them (the run moved on by
   hand, two 60 Hz steps a picture, so 30 fps whatever the machine does),
   by the same rider who plays like a person, but nothing holds him up:
   no invulnerability (the game draws it as spokes round him) and the
   avalanche left to come as it comes. A run that ends early is taken
   again with the rider's timing moved on; Time Rush ends when its clock
   does, and its clip with it.
   Every sound the game asks for is noted against its picture and played
   back by audio.js on the same timeline, over the tune of the stretch.
     node store/trailer/gameplay.js [clip ...]       all clips, or some
   Writes <OUT>/<clip>.mp4 (OUT: env GAMEPLAY_OUT, default
   store/trailer/out/gameplay), 1080x1920, 30 fps, H.264 + AAC; the
   pictures go to <GAMEPLAY_FRAMES, default /tmp/icedash-gameplay>/<clip>/.
   =========================================================== */
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var M = require('../../tools/media-lib.js');
var ROOT = path.join(__dirname, '..', '..');
var OUT = process.env.GAMEPLAY_OUT || path.join(__dirname, 'out', 'gameplay');
var FRAMES = process.env.GAMEPLAY_FRAMES || '/tmp/icedash-gameplay';
var SECS = +(process.env.GAMEPLAY_SECS || 30), FPS = 30, TRIES = 6;
var SHAPE = { width: 540, height: 960, deviceScaleFactor: 2, mobile: true };

/* name: { biome (held for the whole clip; null lets the hill change), skin, mode, warm: steps before the first picture } */
var CLIPS = {
  pine:      { biome: 0,  skin: 'snowcap', warm: 200 },
  ember:     { biome: 7,  skin: 'seal',    warm: 260 },
  neon:      { biome: 13, skin: 'orca',    warm: 260 },
  caves:     { biome: 12, skin: 'puffin',  warm: 260 },
  cosmic:    { biome: 11, skin: 'leopard', warm: 260 },
  jungle:    { biome: 10, skin: 'otter',   warm: 260 },
  night:     { biome: 6,  skin: 'mitten',  warm: 260 },
  glacier:   { biome: 3,  skin: 'muskox',  warm: 260 },
  rush:      { biome: 0,  skin: 'snowcap', warm: 150, mode: 'rush' },
  avalanche: { biome: null, skin: 'lemming', warm: 240, mode: 'avalanche' }
};

/* capture.js's rider without the invulnerability, his timing moved on by
   __rider.k for each new try */
var RIDER = "window.__rider={s:0,next:0,due:0,k:0};window.__rideStep=function(biome){var W=Game.debug();if(!W||W.state!=='run')return;" +
  "var R=__rider;R.s++;if(biome!==null){W.biome=biome;W.biomeT=600;}var C=Game._consts();" +
  "if(R.due){if(R.s>=R.due){R.due=0;R.next=R.s+16+((R.s+R.k)*7919)%14;Game.tap();}return;}if(R.s<R.next)return;" +
  "var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+20){r=W.rows[i];break;}if(!r)return;" +
  "var DR=C.DRIFT,PR=C.PR||14,c=Game._chuteAt(r.d)+r.gap,fr=Math.max(1,Math.round((r.d-W.dist)/W.speed)),tr=Game._turnRate();" +
  "function at(d){var x=W.px,v=W.vx;for(var k=0;k<fr;k++){v+=(d*DR*W.speed-v)*tr;x+=v;}return x;}" +
  "var tol=Math.max(6,r.gapW/2-PR-10),stay=Math.abs(at(W.dir)-c),turn=Math.abs(at(-W.dir)-c);" +
  "if(stay>tol&&turn<stay)R.due=R.s+4+((R.s+R.k)*104729)%7;};";
/* every sound the game asks for, with the picture it was asked in (the
   switches and the unlocking are the recorder's own business) */
var HOOK = "window.__sfx=[];window.__fr=0;Object.keys(Sfx).forEach(function(k){var f=Sfx[k];" +
  "if(typeof f!=='function'||/^(sound|music|platformAudio|unlock|hold)$/.test(k))return;" +
  "Sfx[k]=function(){if(window.__fr>0)__sfx.push([__fr,k,[].slice.call(arguments)]);return f.apply(this,arguments);};});1";

/* one try at a clip: { n pictures, state the run ended in or 'run', mood, sfx } */
async function take(L, name, c, k) {
  var dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  var save = Object.assign({}, M.SAVE, { lang: 'en', equipped: c.skin, gfx: { fx: 0, res: 0 }, sfx: false, music: false });
  var tab = await L.open(SHAPE, save);
  try {
    await tab.ev(RIDER + "__rider.k=" + k + ";" + HOOK);
    if (c.mode) await tab.ev("document.querySelector('[data-action=\"" + c.mode + "\"]').click();1");
    else await tab.ev("document.getElementById('btn-free').click();1");
    await M.sleep(1200);
    await tab.ev("Game.pause();1");
    var B = c.biome === null || c.biome === undefined ? 'null' : c.biome;
    await tab.ev("(function(){for(var i=0;i<" + c.warm + ";i++){__rideStep(" + B + ");Game._step(1);}Game._render();return 1;})()");
    var mood = (await tab.ev("(function(){var W=Game.debug(),b=BIOMES[W.biome%BIOMES.length];return (b&&b.mood)||'base';})()")).result.value;
    var n = Math.round(SECS * FPS), end = 'run', stopAt = n;
    for (var f = 1; f <= stopAt; f++) {
      var st = (await tab.ev("(function(){__fr=" + f + ";for(var i=0;i<2;i++){__rideStep(" + B + ");Game._step(1);}Game._render();return Game.debug().state;})()")).result.value;
      var shot = await L.cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92 }, tab.sid);
      fs.writeFileSync(path.join(dir, String(f).padStart(5, '0') + '.jpg'), Buffer.from(shot.result.data, 'base64'));
      if (st !== 'run' && end === 'run') {
        end = st;
        /* the clock ran out: the end of a Time Rush is part of it, a second and a half of it */
        if (c.mode === 'rush' && (st === 'timeup' || st === 'finish')) stopAt = Math.min(n, f + 45);
        else return { n: f, end: st, mood: mood, sfx: [] };
      }
    }
    var sfx = (await tab.ev("JSON.stringify(__sfx)")).result.value;
    return { n: stopAt, end: end, mood: mood, sfx: JSON.parse(sfx) };
  } finally { await L.close(tab); }
}

/* the sound for a clip: the stretch's tune from the start, every sound at its picture */
function score(name, t) {
  var stage = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-gameplay-' + name + '-'));
  var cues = [[0, "Sfx.mood(" + JSON.stringify(t.mood) + ");Sfx.music(true)"]];
  t.sfx.forEach(function (s) {
    cues.push([(s[0] - 1) / FPS, 'Sfx.' + s[1] + '(' + s[2].map(function (a) { return JSON.stringify(a); }).join(',') + ')']);
  });
  var cueFile = path.join(stage, 'cues.json'), wav = path.join(stage, 'sound.wav');
  fs.writeFileSync(cueFile, JSON.stringify({ secs: t.n / FPS + 0.5, cues: cues }));
  cp.execFileSync('node', [path.join(__dirname, 'audio.js'), cueFile, wav], { stdio: 'inherit' });
  return { wav: wav, stage: stage };
}

(async function () {
  var want = process.argv.slice(2), names = want.length ? want : Object.keys(CLIPS);
  fs.mkdirSync(OUT, { recursive: true });
  var L = await M.start(ROOT, 8794, 9794), done = [];
  try {
    for (var name of names) {
      var c = CLIPS[name];
      if (!c) { console.log('no clip ' + name); continue; }
      var t = null;
      for (var k = 0; k < TRIES; k++) {
        t = await take(L, name, c, k * 37);
        console.log(name + ' try ' + (k + 1) + ': ' + t.n + ' pictures, ' + t.end + (t.end === 'run' ? '' : ' at ' + (t.n / FPS).toFixed(1) + ' s'));
        if (t.end === 'run' || (c.mode === 'rush' && t.sfx.length)) break;
      }
      done.push([name, t]);
    }
  } finally { await L.stop(); }
  for (var d of done) {
    var name = d[0], t = d[1];
    if (t.end !== 'run' && !(CLIPS[name].mode === 'rush' && t.sfx.length)) { console.log(name + ': every try ended early; left out'); continue; }
    var s = score(name, t), secs = t.n / FPS, out = path.join(OUT, name + '.mp4');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, name, '%05d.jpg'),
      '-i', s.wav, '-map', '0:v', '-map', '1:a',
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=' + Math.max(0, secs - 0.8).toFixed(2) + ':d=0.8',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', secs.toFixed(3), '-movflags', '+faststart', out]);
    fs.rmSync(s.stage, { recursive: true, force: true });
    console.log('wrote ' + out + ' (' + secs.toFixed(1) + ' s, ' + t.sfx.length + ' sounds)');
  }
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
