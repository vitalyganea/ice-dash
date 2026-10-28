/* ===========================================================
   tools/media-lib.js — store pictures and videos from the real game
   -----------------------------------------------------------
   Shared by yandex/media.js and crazygames/media.js. Serves a built copy
   of the game, drives headless Chrome over the DevTools protocol (no
   library: node's own http and WebSocket) and gives back:
     open(shape, save)   a fresh tab on the game with that save in it
     shoot(tab, file)    a PNG of the tab
     cover(opts)         a live run with the logo over it, no HUD
     video(opts)         a run recorded from Chrome's screencast, as MP4
   plus icon() and flatten() for the image files. Every picture is taken
   mid-run with a steady rider at the reins, so stores that want real
   play in their pictures get it. Needs Chrome, ffmpeg and python3 + PIL.
   =========================================================== */
var http = require('http'), fs = require('fs'), path = require('path');
var cp = require('child_process'), os = require('os');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function mkdir(d) { fs.mkdirSync(d, { recursive: true }); return d; }

/* Some progress in the save, so the hill has a creature or two to show. */
var SAVE = { best: 18450, runs: 40, sfx: false, music: false, fish: 2380, gold: 5,
  owned: ['snowcap', 'mitten', 'puffin', 'seal', 'lemming', 'muskox', 'bubbles', 'otter', 'leopard', 'orca'],
  equipped: 'snowcap', ach: ['first', 'dist500'], lives: 2, finds: 0, tutDone: true,
  courses: { firstlight: 3, narrows: 2, gapteeth: 2, glassrun: 1, nightfall: 1 },
  comicSeen: { snowcap: true, mitten: true, puffin: true, seal: true, lemming: true, muskox: true,
               bubbles: true, otter: true, leopard: true, orca: true },
  marketSeen: ['mitten', 'puffin', 'seal', 'lemming', 'muskox', 'bubbles', 'otter', 'leopard', 'orca'],
  bestRush: 1240, bestAv: 900, vibrate: true };

/* The steady rider from store/shots.js: taps whenever the other way
   lands closer to the next opening, and is never knocked off. */
var RIDE = "(function(biome){var DR=Game._consts().DRIFT;window.__ride=setInterval(function(){var W=Game.debug();" +
  "if(!W||W.state!=='run')return;if(biome!==null){W.biome=biome;W.biomeT=600;}W.invuln=30;" +
  "var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+30){r=W.rows[i];break;}if(!r)return;" +
  "var t=Game._chuteAt(r.d)+r.gap,fr=Math.max(1,Math.round((r.d-W.dist)/W.speed)),tr=Game._turnRate();" +
  "function m(d){var x=W.px,v=W.vx;for(var k=0;k<fr;k++){v+=(d*DR*W.speed-v)*tr;x+=v;}return Math.abs(x-t);}" +
  "if(m(-W.dir)<m(W.dir)-6)Game.tap();},16);})";

/* A rider who plays like a person, for the videos. The steady rider above
   re-decides every frame and taps whenever the other way is a hair closer
   to the middle of the opening, so he shivers down the dead centre of the
   hill. This one keeps going the way he is going for as long as that still
   takes him through the next opening, and only taps when it would not;
   he sees it a moment late (a reaction of 100-250 ms) and does not tap
   again for 300-600 ms after. So he sweeps from one side to the other in
   long arcs, cuts it fine now and then, and reaches for a fish when it is
   nearly on his way. Never knocked off, like the other one. */
var RIDE_HUMAN = "(function(biome){var C=Game._consts(),DR=C.DRIFT,PR=C.PR||14,next=0,due=0;" +
  "function rnd(a,b){return a+Math.random()*(b-a);}" +
  "window.__ride=setInterval(function(){var W=Game.debug();if(!W||W.state!=='run')return;" +
  "if(biome!==null){W.biome=biome;W.biomeT=600;}W.invuln=30;var now=performance.now();" +
  "if(due){if(now>=due){due=0;next=now+rnd(300,600);Game.tap();}return;}if(now<next)return;" +
  "var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+20){r=W.rows[i];break;}if(!r)return;" +
  "var c=Game._chuteAt(r.d)+r.gap,fr=Math.max(1,Math.round((r.d-W.dist)/W.speed)),tr=Game._turnRate();" +
  "function at(d){var x=W.px,v=W.vx;for(var k=0;k<fr;k++){v+=(d*DR*W.speed-v)*tr;x+=v;}return x;}" +
  "var tol=Math.max(6,r.gapW/2-PR-10),stay=Math.abs(at(W.dir)-c),turn=Math.abs(at(-W.dir)-c);" +
  /* through either way: now and then turn anyway, to reach for a fish or just because */
  "var want=stay>tol?turn<stay:(turn<tol*0.5&&Math.random()<0.004);" +
  "if(want)due=now+rnd(100,250);},16);})";

/* The band at the top where the score sits, in css pixels. A cover is
   taken from a window this much taller and the band is cut away, so the
   readout never reaches it and the hill is not touched to get rid of it. */
var CUT = 200;

function py(code, args) { cp.execFileSync('python3', ['-c', code].concat(args)); }

/* 24-bit PNG, no alpha channel: what the stores ask for. */
function flatten(files) {
  if (!files.length) return;
  py("import sys\nfrom PIL import Image\nfor f in sys.argv[1:]:\n Image.open(f).convert('RGB').save(f, optimize=True)", files);
}
function icon(src, dst, size) {
  py("import sys\nfrom PIL import Image\nn=int(sys.argv[3])\nImage.open(sys.argv[1]).convert('RGB').resize((n,n), Image.LANCZOS).save(sys.argv[2], optimize=True)",
     [src, dst, String(size)]);
}

async function start(root, port, dport) {
  var MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.png': 'image/png', '.webp': 'image/webp' };
  /* Only the game's own files are served: a platform SDK asked for from
     elsewhere simply does not load, and the copy runs as the plain game. */
  var server = http.createServer(function (q, r) {
    var p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    var f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  }).listen(port);
  var prof = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-media-'));
  /* Outside requests (a platform's SDK from its own CDN) are refused, so
     the copy runs as the plain game in every picture. */
  var ch = cp.spawn('google-chrome', ['--headless=new', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=' + dport, '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore', detached: true });
  var ver = null;
  for (var i = 0; i < 50 && !ver; i++) {
    try { ver = await (await fetch('http://127.0.0.1:' + dport + '/json/version')).json(); } catch (e) { await sleep(200); }
  }
  var ws = new WebSocket(ver.webSocketDebuggerUrl), id = 0, wait = {}, frameSink = null;
  await new Promise(function (r) { ws.onopen = r; });
  ws.onmessage = function (m) {
    var d = JSON.parse(m.data);
    if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; }
    if (d.method === 'Page.screencastFrame' && frameSink) frameSink(d);
  };
  function send(method, params, sid) {
    return new Promise(function (res) { var n = ++id; wait[n] = res;
      ws.send(JSON.stringify({ id: n, method: method, params: params || {}, sessionId: sid })); });
  }

  /* pre: optional script run before the page's own, e.g. stand-ins for
     the Android app's plugins when the root is its www/ */
  async function open(shape, save, pre) {
    var tgt = (await send('Target.createTarget', { url: 'about:blank' })).result.targetId;
    var sid = (await send('Target.attachToTarget', { targetId: tgt, flatten: true })).result.sessionId;
    await send('Page.enable', {}, sid);
    await send('Emulation.setDeviceMetricsOverride', shape, sid);
    await send('Page.addScriptToEvaluateOnNewDocument', { source:
      "try{localStorage.setItem('icedash-save-v1'," + JSON.stringify(JSON.stringify(save)) + ")}catch(e){}" + (pre || '') }, sid);
    await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html' }, sid);
    await sleep(2000);
    return { tgt: tgt, sid: sid, ev: async function (x) {
      return (await send('Runtime.evaluate', { expression: x, returnByValue: true }, sid)).result; } };
  }
  async function shoot(tab, file) {
    var shot = await send('Page.captureScreenshot', { format: 'png' }, tab.sid);
    fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  }
  async function close(tab) { await send('Target.closeTarget', { targetId: tab.tgt }); }

  /* A real run in Pine Forest with the title logo over it.
       w, h      the file's size in pixels
       scale     file pixels per css pixel (the page is drawn at twice that
                 and scaled down, for clean edges)
       at        ms into the run
       place     'side': the logo on whichever side of the run he is not;
                 'top': centred above him
       logoW     the logo's width, as a share of the width */
  async function cover(o) {
    var cw = Math.round(o.w / o.scale), chh = Math.round(o.h / o.scale);
    var tab = await open({ width: cw, height: chh + CUT, deviceScaleFactor: 2, mobile: cw < chh },
                         Object.assign({}, SAVE, { lang: o.lang || 'en' }));
    await tab.ev("document.getElementById('btn-free').click()");
    await tab.ev(RIDE + "(0)");
    await sleep(o.at || 8000);
    var css = o.place === 'top'
      ? "'left:50%;top:" + (CUT + Math.round(chh * (o.top || 0.06))) + "px;transform:translateX(-50%);'"
      : "side+':2%;top:" + (CUT + Math.round(chh / 2)) + "px;transform:translateY(-50%);'";
    await tab.ev("document.getElementById('hud').style.visibility='hidden';" +
      "var W=Game.debug(),side=W.px<Game._chuteAt(W.dist)?'right':'left';" +
      "var i=document.createElement('img');i.src='img/logo.png';" +
      "i.style.cssText='position:fixed;'+" + css + "+'width:" + o.logoW + "%;z-index:50;filter:drop-shadow(0 6px 10px rgba(0,30,80,.45))';" +
      "document.body.appendChild(i);");
    await sleep(150);
    var raw = path.join(os.tmpdir(), 'icedash-cover-raw.png');
    await shoot(tab, raw);
    await close(tab);
    py("import sys\nfrom PIL import Image\nc=int(sys.argv[3])*2\nim=Image.open(sys.argv[1]).convert('RGB')\n" +
       "im.crop((0,c,im.width,im.height)).resize((int(sys.argv[4]),int(sys.argv[5])), Image.LANCZOS).save(sys.argv[2], optimize=True)",
       [raw, o.file, String(CUT), String(o.w), String(o.h)]);
  }

  /* A run recorded with the screencast: every frame Chrome paints, kept
     with its timestamp, then laid on a steady 30 fps by ffmpeg. The run is
     moved through several stretches so the clip shows more than one place.
       shape     css size; the file is twice that
       secs      length of the run in the clip
       still     optional picture held for stillSecs before the run */
  async function video(o) {
    var s = o.shape;
    var tab = await open({ width: s.width, height: s.height, deviceScaleFactor: 2, mobile: s.mobile },
                         Object.assign({}, SAVE, { lang: o.lang || 'en', equipped: 'snowcap' }));
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-video-'));
    var frames = [];
    frameSink = function (d) {
      if (d.sessionId !== tab.sid) return;
      var f = path.join(tmp, 'f' + String(frames.length).padStart(5, '0') + '.jpg');
      fs.writeFileSync(f, Buffer.from(d.params.data, 'base64'));
      frames.push({ f: f, t: d.params.metadata.timestamp });
      send('Page.screencastFrameAck', { sessionId: d.params.sessionId }, tab.sid);
    };
    var seq = o.seq || [0, 12, 13, 10, 11], every = Math.round(o.secs * 1000 / seq.length);
    await tab.ev("document.getElementById('btn-free').click()");
    await tab.ev((o.rider === 'steady' ? RIDE : RIDE_HUMAN) + "(null)");
    await tab.ev("(function(){var seq=" + JSON.stringify(seq) + ",k=0;setInterval(function(){var W=Game.debug();if(!W)return;k++;" +
      "if(k<seq.length){W.biome=seq[k];W.biomeT=0;}}," + every + ");Game.debug().biome=seq[0];})()");
    await sleep(1500);
    await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: s.width * 2, maxHeight: s.height * 2, everyNthFrame: 1 }, tab.sid);
    await sleep(o.secs * 1000 + 500);
    await send('Page.stopScreencast', {}, tab.sid);
    frameSink = null;
    await close(tab);
    var lines = [];
    for (var i = 0; i < frames.length; i++) {
      var dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1 / 30;
      lines.push("file '" + frames[i].f + "'", 'duration ' + Math.max(0.001, dur).toFixed(4));
    }
    lines.push("file '" + frames[frames.length - 1].f + "'");
    var list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, lines.join('\n'));
    var W = s.width * 2, H = s.height * 2, enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(o.crf || 20),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
    var run = o.still ? path.join(tmp, 'run.mp4') : o.file;
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'scale=' + W + ':' + H + ':flags=lanczos,fps=30,setsar=1', '-t', String(o.secs)].concat(enc, [run]));
    if (o.still) {
      cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', String(o.stillSecs || 1),
        '-i', o.still, '-i', run, '-filter_complex',
        '[0]scale=' + W + ':' + H + ':flags=lanczos,setsar=1,format=yuv420p[a];[1]setsar=1,format=yuv420p[b];[a][b]concat=n=2:v=1[v]',
        '-map', '[v]', '-r', '30'].concat(enc, [o.file]));
    }
    var secs = (frames[frames.length - 1].t - frames[0].t);
    fs.rmSync(tmp, { recursive: true, force: true });
    return { frames: frames.length, fps: frames.length / secs };
  }

  function stop() {
    /* the whole group: killing only the launcher leaves Chrome running,
       and the next run would find it on the same port with the old save */
    ws.close(); try { process.kill(-ch.pid); } catch (e) { ch.kill(); } server.close();
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  }
  return { open: open, shoot: shoot, close: close, cover: cover, video: video, stop: stop, cdp: send };
}

module.exports = { start: start, sleep: sleep, mkdir: mkdir, flatten: flatten, icon: icon, SAVE: SAVE, RIDE: RIDE, RIDE_HUMAN: RIDE_HUMAN };
