/* ===========================================================
   store/trailer/compose.js — the trailer, cut and scored
   -----------------------------------------------------------
   The edit (SCENES below) is drawn picture by picture by director.js in
   Chrome over the frames from capture.js, and scored with the game's own
   music recorded by audio.js along the same timeline (the tune of each
   world as it comes up, a game sound on each cut). ffmpeg puts the
   pictures and the sound together.
     node store/trailer/compose.js wide|tall|both
   Writes store/trailer/out/ice-dash-trailer-<wide|tall>.mp4 (1920x1080 /
   1080x1920, 30 fps, H.264 + AAC). Run capture.js first.
   =========================================================== */
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var M = require('../../tools/media-lib.js');
var ROOT = path.join(__dirname, '..', '..');
var FRAMES = process.env.TRAILER_FRAMES || '/tmp/icedash-trailer';
var OUTDIR = path.join(__dirname, 'out');
var FPS = 30;

/* The edit, in seconds. side: where the game's card stands in the wide
   picture (the words take the other half). cuts: [clip, first frame, label]. */
var SCENES = [
  { id: 'intro', t0: 0, t1: 3.2, note: ['ONE TAP. ENDLESS ICE.'] },
  { id: 'clip', t0: 3.2, t1: 6.8, clip: 'pine', from: 1, side: 'left', tap: true, text: ['ONE TAP'], note: 'to slide the other way' },
  { id: 'clip', t0: 6.8, t1: 9.6, clip: 'ember', from: 1, side: 'right', text: ['DODGE TREES,', 'CATCH FISH!'] },
  { id: 'clip', t0: 9.6, t1: 14.7, side: 'left', each: 0.85, text: ['14', 'WORLDS'], note: 'each with its own weather and music',
    cuts: [['neon', 1, 'Neon'], ['caves', 1, 'Crystal Caves'], ['cosmic', 1, 'Cosmic Ice'], ['jungle', 1, 'Frozen Jungle'],
           ['night', 1, 'Night Run'], ['glacier', 1, 'Glacier']] },
  { id: 'clip', t0: 14.7, t1: 18.0, clip: 'rush', from: 1, side: 'right', text: ['BEAT', 'THE CLOCK!'], note: 'grab the time bubbles' },
  { id: 'clip', t0: 18.0, t1: 21.4, clip: 'avalanche', from: 18, side: 'left', text: ['OUTRUN THE', 'AVALANCHE!'] },
  { id: 'clip', t0: 21.4, t1: 24.8, side: 'right', each: 0.85, zoom: 1.8, text: ['18', 'CREATURES'], note: 'each with a power of its own',
    cuts: [['ember', 55, 'Seal'], ['neon', 55, 'Orca'], ['cosmic', 55, 'Snow Leopard'], ['jungle', 55, 'Sea Otter']] },
  /* the penguin sliding at the camera (slideFrames): from its picture
     `from`, at `speed` times the GIF's own pace, into the lens at the end */
  { id: 'slide', t0: 24.8, t1: 26.8, from: 26, speed: 1.25 },
  { id: 'outro', t0: 26.8, t1: 31 }
];
var SECS = 31;

/* The sound along the same timeline: the world's tune as it comes up,
   the doubled gait for the rush and the avalanche, a game sound on cuts
   and a turn's sound on each tap the pictures show. */
function cues() {
  var sl = SCENES[SCENES.length - 2], end = SCENES[SCENES.length - 1];
  var c = [[0.0, "Sfx.mood('night');Sfx.music(true)"], [1.2, 'Sfx.fanfare()'], [3.15, 'Sfx.zone()'],
    [3.2, "Sfx.mood('base')"], [6.8, "Sfx.mood('ember')"], [6.75, 'Sfx.zone()'],
    [9.6, "Sfx.mood('neon')"], [14.65, 'Sfx.charge()'], [14.7, "Sfx.mood('base');Sfx.excite(true)"],
    [18.0, "Sfx.mood('midwinter');Sfx.rumble(1)"], [21.4, "Sfx.excite(false);Sfx.mood('cosmic')"],
    [sl.t0, "Sfx.mood('base');Sfx.jump()"], [sl.t1 - 0.35, 'Sfx.perfect(4)'],
    [end.t0, 'Sfx.fanfare()'], [SECS - 0.8, 'Sfx.music(false)']];
  /* the scrape of snow under his belly as he comes */
  for (var b = sl.t0 + 0.3; b < sl.t1 - 0.4; b += 0.3) c.push([b, 'Sfx.bank()']);
  SCENES.forEach(function (sc) {
    if (sc.cuts) sc.cuts.forEach(function (x, i) { c.push([sc.t0 + i * sc.each, sc.zoom ? 'Sfx.unlock()' : 'Sfx.gate()']); });
    if (!sc.clip) return;
    var log = JSON.parse(fs.readFileSync(path.join(FRAMES, sc.clip, 'log.json'), 'utf8')), n0 = sc.from || 1;
    var nEnd = n0 + Math.round((sc.t1 - sc.t0) * FPS);
    for (var n = n0 + 1; n < nEnd && n <= log.length; n++) {
      var e = log[n - 1], p = log[n - 2], t = sc.t0 + (n - n0) / FPS;
      if (sc.tap && e[0] !== p[0]) c.push([t, 'Sfx.turn()']);
      if (e[1] > p[1]) c.push([t, 'Sfx.pop()']);
    }
  });
  return c.sort(function (a, b) { return a[0] - b[0]; });
}

/* The penguin's slide is an animated GIF from Gemini on a green screen
   (penguin-slide.gif: 640x360, 10 pictures a second). Here it is made 30
   a second with motion-estimated in-betweens, its dither smoothed, brought
   up to 1920x1080 and keyed: the alpha from how much greener than red and
   blue a pixel is, the colour unmixed from the green behind it (so the
   spray of snow and the edge of his fur stay white, not mint), the edge
   drawn in 2 px. Into <FRAMES>/slide/, made again when the GIF changes. */
function slideFrames() {
  var src = path.join(__dirname, 'penguin-slide.gif'), dir = path.join(FRAMES, 'slide'), first = path.join(dir, '00001.png');
  if (!fs.existsSync(first) || fs.statSync(first).mtimeMs < fs.statSync(src).mtimeMs) {
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    var K = [31, 218, 48], green = '(g(X,Y)-max(r(X,Y),b(X,Y))-12)/120';
    var a = 'st(0,1-clip(' + green + ',0,1))', u = 'max(ld(0),0.03)';
    var r = 'clip((r(X,Y)-(1-ld(0))*' + K[0] + ')/' + u + ',0,255)', b = 'clip((b(X,Y)-(1-ld(0))*' + K[2] + ')/' + u + ',0,255)';
    var g = a + ';st(1,' + r + ');st(2,' + b + ');min(clip((g(X,Y)-(1-ld(0))*' + K[1] + ')/' + u + ',0,255),' +
      'if(lt(ld(0),0.97),(ld(1)+ld(2))/2,max(ld(1),ld(2))+8))';
    var thin = 'erosion=threshold0=0:threshold1=0:threshold2=0';
    var vf = ['format=rgb24', 'minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1', 'hqdn3d=4:3:4:3',
      'scale=1920:1080:flags=lanczos', 'format=gbrap',
      "geq=r='" + a + ';' + r + "':g='" + g + "':b='" + a + ';' + b + "':a='255*(1-clip(" + green + ",0,1))'",
      thin, thin, 'format=rgba'].join(',');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', vf, path.join(dir, '%05d.png')]);
  }
  return fs.readdirSync(dir).filter(function (f) { return /^\d+\.png$/.test(f); }).length;
}

async function render(kind, audioFile) {
  var size = kind === 'tall' ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
  var stage = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-trailer-' + kind + '-'));
  /* the page's own little site: the frames, the art and the lettering */
  var site = path.join(stage, 'site');
  fs.mkdirSync(path.join(site, 'img'), { recursive: true }); fs.mkdirSync(path.join(site, 'css'));
  fs.symlinkSync(FRAMES, path.join(site, 'frames'));
  fs.copyFileSync(path.join(ROOT, 'img', 'logo.png'), path.join(site, 'img', 'logo.png'));
  fs.copyFileSync(path.join(ROOT, 'store', 'promo', 'mascot', 'penguin3d.png'), path.join(site, 'img', 'penguin3d.png'));
  fs.copyFileSync(path.join(ROOT, 'css', 'font.css'), path.join(site, 'css', 'font.css'));
  fs.copyFileSync(path.join(__dirname, 'director.js'), path.join(site, 'director.js'));
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/font.css">' +
    '<style>html,body{margin:0;background:#05123a;overflow:hidden}</style></head><body><script src="/director.js"></script></body></html>');
  var logs = {};
  fs.readdirSync(FRAMES).forEach(function (d) {
    var f = path.join(FRAMES, d, 'log.json');
    if (fs.existsSync(f)) logs[d] = JSON.parse(fs.readFileSync(f, 'utf8'));
  });
  var L = await M.start(site, kind === 'tall' ? 8797 : 8798, kind === 'tall' ? 9797 : 9798);
  var pics = path.join(stage, 'pics'); fs.mkdirSync(pics);
  try {
    var tab = await L.open({ width: size.w, height: size.h, deviceScaleFactor: 1, mobile: false }, {});
    var ok = (await L.cdp('Runtime.evaluate', { expression: 'setup(' + JSON.stringify({ w: size.w, h: size.h, scenes: SCENES, logs: logs }) + ')', awaitPromise: true, returnByValue: true }, tab.sid)).result.result.value;
    if (!ok) throw new Error('the page could not load its art or its lettering');
    var n = SECS * FPS;
    /* TRAILER_PREVIEW=1.5,4,... : only those moments, as pictures to look at */
    if (process.env.TRAILER_PREVIEW) {
      fs.mkdirSync(OUTDIR, { recursive: true });
      for (var ts of process.env.TRAILER_PREVIEW.split(',')) {
        await L.cdp('Runtime.evaluate', { expression: 'frame(' + Math.round(+ts * FPS) + ')', awaitPromise: true }, tab.sid);
        var ps = await L.cdp('Page.captureScreenshot', { format: 'jpeg', quality: 85 }, tab.sid);
        fs.writeFileSync(path.join(OUTDIR, 'preview-' + kind + '-' + ts + '.jpg'), Buffer.from(ps.result.data, 'base64'));
      }
      await L.close(tab);
      return 'previews in ' + OUTDIR;
    }
    for (var i = 0; i < n; i++) {
      await L.cdp('Runtime.evaluate', { expression: 'frame(' + i + ')', awaitPromise: true }, tab.sid);
      var shot = await L.cdp('Page.captureScreenshot', { format: 'jpeg', quality: 94 }, tab.sid);
      fs.writeFileSync(path.join(pics, String(i).padStart(5, '0') + '.jpg'), Buffer.from(shot.result.data, 'base64'));
      if (i % 150 === 0) process.stdout.write(kind + ' ' + i + '/' + n + '\n');
    }
    await L.close(tab);
  } finally { await L.stop(); }
  fs.mkdirSync(OUTDIR, { recursive: true });
  var out = path.join(OUTDIR, 'ice-dash-trailer-' + kind + '.mp4');
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(pics, '%05d.jpg'),
    '-i', audioFile, '-map', '0:v', '-map', '1:a',
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=' + (SECS - 1.2) + ':d=1.2',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(SECS), '-movflags', '+faststart', out]);
  fs.rmSync(stage, { recursive: true, force: true });
  return out;
}

(async function () {
  var which = process.argv[2] || 'both', kinds = which === 'both' ? ['wide', 'tall'] : [which];
  var slides = slideFrames();
  SCENES.forEach(function (sc) { if (sc.id === 'slide') sc.last = slides; });
  var stage = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-trailer-audio-'));
  var cueFile = path.join(stage, 'cues.json'), audio = path.join(stage, 'score.wav');
  fs.writeFileSync(cueFile, JSON.stringify({ secs: SECS + 0.5, cues: cues() }));
  if (process.env.TRAILER_PREVIEW) audio = null;
  else if (!process.env.TRAILER_AUDIO) cp.execFileSync('node', [path.join(__dirname, 'audio.js'), cueFile, audio], { stdio: 'inherit' });
  else if (process.env.TRAILER_AUDIO) audio = process.env.TRAILER_AUDIO;
  for (var k of kinds) console.log('wrote ' + await render(k, audio));
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
