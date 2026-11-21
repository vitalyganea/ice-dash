/* ===========================================================
   perf.js — how smoothly the hill runs on a slow phone
   -----------------------------------------------------------
   Real Chrome, the real page, the CPU slowed down (4x by default, about a
   budget Android phone), the game at the graphics a new player starts
   with. Each scene is ridden for a few seconds by the autopilot and every
   frame's interval is kept: the average rate, the 95th percentile frame,
   the longest, and how many frames missed (over 1.5 frame budgets).

     node test/perf.js            all scenes, 4x slower CPU
     CPU=6 SECS=8 node test/perf.js

   It fails if a scene runs more than 15% slower than the plain Freeride:
   a new thing on the hill may not cost a phone much more than the hill.
   =========================================================== */
var http = require('http'), fs = require('fs'), path = require('path');
var cp = require('child_process'), os = require('os');
var ROOT = path.join(__dirname, '..'), PORT = 8826, DPORT = 9338;
var CPU = +process.env.CPU || 4, SECS = +process.env.SECS || 6;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
function serve() {
  return new Promise(function (res) {
    var s = http.createServer(function (q, r) {
      var p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
      var f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    });
    s.listen(PORT, function () { res(s); });
  });
}
function getJSON(u) { return new Promise(function (res, rej) { http.get(u, function (r) { var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); }); }

/* the autopilot playtest.js taps by, run inside the page each frame */
var PILOT = "(function(){if(window.__pilot)return;window.__pilot=1;function step(){var W=Game.debug();" +
  "if(W&&W.state==='run'&&!W.demo){W.invuln=99999;var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+30){r=W.rows[i];break;}" +
  "if(r){var t=Game._chuteAt(r.d)+r.gap,fr=Math.max(1,Math.round((r.d-W.dist)/W.speed));" +
  "function m(d){var x=W.px,v=W.vx,tr=Game._turnRate();for(var k=0;k<fr;k++){v+=(d*0.82*W.speed-v)*tr;x+=v;}return Math.abs(x-t);}" +
  "if(m(-W.dir)<m(W.dir)-6)document.getElementById('game').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:200,clientY:300}));}}" +
  "requestAnimationFrame(step);}requestAnimationFrame(step);})();1";

async function main() {
  var server = await serve();
  var prof = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-perf-'));
  var proc = cp.spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--mute-audio', '--no-first-run',
    '--remote-debugging-port=' + DPORT, '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  try {
    var url; for (var i = 0; i < 80 && !url; i++) { try { url = (await getJSON('http://127.0.0.1:' + DPORT + '/json/version')).webSocketDebuggerUrl; } catch (e) { await sleep(250); } }
    var ws = new WebSocket(url), id = 0, waits = {};
    await new Promise(function (r) { ws.onopen = r; });
    ws.onmessage = function (e) { var m = JSON.parse(e.data); if (m.id && waits[m.id]) { waits[m.id](m); delete waits[m.id]; } };
    function send(method, params, sid) { var n = ++id; return new Promise(function (res) { waits[n] = function (m) { res(m.result || {}); }; ws.send(JSON.stringify({ id: n, method: method, params: params || {}, sessionId: sid })); }); }
    var tid = (await send('Target.createTarget', { url: 'about:blank' })).targetId;
    var sid = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).sessionId;
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2.6, mobile: true }, sid);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('icedash-save-v1'," + JSON.stringify(JSON.stringify({
      best: 4200, runs: 30, sfx: false, music: false, fish: 3000, gold: 4, owned: ['snowcap', 'dragon'], equipped: 'snowcap', lang: 'en',
      courses: { firstlight: 2 }, gift: Date.now(), egg: { fed: 3, hatched: false } })) + ")" }, sid);
    await send('Page.enable', {}, sid);
    await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' }, sid);
    await sleep(3500);
    async function ev(x) { var r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }, sid); return r.result && r.result.value; }
    await ev(PILOT);
    await send('Emulation.setCPUThrottlingRate', { rate: CPU }, sid);
    console.log('CPU ' + CPU + 'x slower, ' + SECS + ' s a scene, graphics as a new player has them (' +
                JSON.stringify(await ev("Game.quality ? Game.quality() : null")) + ')\n');

    /* a scene: start it, let it settle, then keep every frame's interval */
    async function scene(name, start) {
      await ev("Game.stop&&0;1");
      await ev(start);
      await sleep(1500);
      var r = await ev("new Promise(function(res){var t=[],last=0,end=performance.now()+" + (SECS * 1000) + ";" +
        "function f(now){if(last)t.push(now-last);last=now;if(now<end)requestAnimationFrame(f);else res(t);}requestAnimationFrame(f);})");
      var W = await ev("(function(){var W=Game.debug();return W?{st:W.state,koi:W.objects.filter(function(o){return o.t==='koi';}).length,b:W.biome}:null;})()");
      r.sort(function (a, b) { return a - b; });
      var avg = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
      var o = { name: name, fps: 1000 / avg, p95: r[Math.floor(r.length * 0.95)], max: r[r.length - 1], miss: r.filter(function (x) { return x > 25; }).length, n: r.length, W: W };
      console.log('  ' + name.padEnd(34) + o.fps.toFixed(1).padStart(5) + ' fps   p95 ' + o.p95.toFixed(1).padStart(5) + ' ms   worst ' +
                  o.max.toFixed(0).padStart(4) + ' ms   missed ' + o.miss + '/' + o.n + (W ? '   (' + W.st + (W.koi ? ', ' + W.koi + ' koi on the hill' : '') + ')' : ''));
      return o;
    }
    var ride = "(function(skin,course){var s=JSON.parse(localStorage.getItem('icedash-save-v1'));s.equipped=skin;localStorage.setItem('icedash-save-v1',JSON.stringify(s));" +
               "Game.start(0,{hud:function(){},over:function(){},lesson:function(){}},skin,course,0,{koi:!!course});})";
    var res = [];
    res.push(await scene('title (the hill behind the menu)', "1"));
    res.push(await scene('Freeride, Snowcap', ride + "('snowcap',null);1"));
    res.push(await scene('Freeride, the dragon', ride + "('dragon',null);1"));
    res.push(await scene('the dragon in flight', ride + "('dragon',null);clearInterval(window.__soar);window.__soar=setInterval(function(){var W=Game.debug();if(W&&W.state==='run')W.soarNext=W.dist+5;},200);1"));
    await ev("clearInterval(window.__soar);1");
    res.push(await scene('Sakura Garden line, no koi', ride.replace('{koi:!!course}', '{koi:false}') + "('snowcap','sakura');1"));
    res.push(await scene('Sakura Garden line, koi, Snowcap', ride + "('snowcap','sakura');1"));
    res.push(await scene('Sakura Garden line, koi, the dragon', ride + "('dragon','sakura');1"));
    await send('Emulation.setCPUThrottlingRate', { rate: 1 }, sid);

    console.log('');
    var base = res[1].fps;
    /* Measured against the plain Freeride on the same machine: a headless
       Chrome with no graphics chip, slowed down, is no phone, so what it
       says in frames a second is only for comparing one scene with another. */
    res.slice(2).forEach(function (o) {
      ok(o.fps >= base * 0.85, o.name + ': ' + o.fps.toFixed(1) + ' fps, against ' + base.toFixed(1) + ' for the plain Freeride (' + Math.round(o.fps / base * 100) + '%)');
    });
  } finally { proc.kill(); server.close(); }
  console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'performance checks passed'));
  process.exit(fail ? 1 : 0);
}
main().catch(function (e) { console.error('blew up: ' + (e.stack || e)); process.exit(2); });
