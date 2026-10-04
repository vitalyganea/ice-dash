/* ===========================================================
   store/shots.js — the Play Store screenshots, from the real game
   -----------------------------------------------------------
   Serves the folder, drives Chrome over the DevTools protocol at a
   1080x1920 phone (540x960 css at 2x), seeds a save with some progress
   in it, and captures a handful of scenes into store/screenshots/.
     node store/shots.js
   No dependencies: node's own http and WebSocket, like test/playtest.js.
   =========================================================== */
var http = require('http'), fs = require('fs'), path = require('path');
var cp = require('child_process'), os = require('os');
var ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'screenshots');
var PORT = 8841, DPORT = 9341;
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
             '.png': 'image/png', '.webp': 'image/webp' };
var server = http.createServer(function (q, r) {
  var p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  var f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(PORT);

function chromeBin() {
  var c = [path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
           '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for (var i = 0; i < c.length; i++) if (fs.existsSync(c[i])) return c[i];
  return 'google-chrome';
}
var SAVE = { best: 18450, runs: 40, sfx: false, music: false, fish: 2380, gold: 5,
  owned: ['snowcap', 'mitten', 'puffin', 'seal', 'lemming', 'muskox', 'bubbles'], equipped: 'seal',
  lang: 'en', ach: ['first', 'dist500', 'dist2000', 'runfish30', 'fish500', 'gold1', 'jump1', 'lines1', 'wear3', 'daily1'],
  totFish: 1900, totGold: 9, totGates: 60, totJumps: 12, totSaves: 3, bestDist: 3100, bestRunFish: 140,
  lives: 2, finds: 0, courses: { firstlight: 3, narrows: 2, gapteeth: 2, glassrun: 1, nightfall: 1 },
  tutDone: true, bestRush: 1240, totClocks: 40, dailyBest: 3, dailyDays: 6, vibrate: true };

/* A steady rider, so a gameplay shot is mid-run and not a crash. */
var RIDE = "(function(biome){var DR=Game._consts().DRIFT;window.__ride=setInterval(function(){var W=Game.debug();" +
  "if(!W||W.state!=='run')return;if(biome!==null){W.biome=biome;W.biomeT=600;}W.invuln=30;" +
  "var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+30){r=W.rows[i];break;}if(!r)return;" +
  "var t=Game._chuteAt(r.d)+r.gap,fr=Math.max(1,Math.round((r.d-W.dist)/W.speed)),tr=Game._turnRate();" +
  "function m(d){var x=W.px,v=W.vx;for(var k=0;k<fr;k++){v+=(d*DR*W.speed-v)*tr;x+=v;}return Math.abs(x-t);}" +
  "if(m(-W.dir)<m(W.dir)-6)Game.tap();},16);})";

var SCENES = [
  { name: '1-title' },
  { name: '2-freeride', click: '#btn-free', ride: 'null', wait: 6500, then: 'Game.debug().combo=23' },
  { name: '3-time-rush', click: '#btn-rush', ride: 'null', wait: 5000 },
  { name: '4-crystal-caves', click: '#btn-free', ride: '12', wait: 6500, equip: 'puffin' },
  { name: '5-market', click: '[data-action="shop"]', wait: 900 },
  { name: '6-known-lines', click: '[data-action="runs"]', wait: 900 },
  { name: '7-tutorial', fresh: true, wait: 1500 }
];

(async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  var prof = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-shots-'));
  var ch = cp.spawn(chromeBin(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  var ver = null;
  for (var i = 0; i < 50 && !ver; i++) {
    try { ver = await (await fetch('http://127.0.0.1:' + DPORT + '/json/version')).json(); } catch (e) { await sleep(200); }
  }
  var ws = new WebSocket(ver.webSocketDebuggerUrl), id = 0, wait = {};
  await new Promise(function (r) { ws.onopen = r; });
  ws.onmessage = function (m) { var d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; } };
  function send(method, params, sid) {
    return new Promise(function (res) { var n = ++id; wait[n] = res;
      ws.send(JSON.stringify({ id: n, method: method, params: params || {}, sessionId: sid })); });
  }
  for (var s = 0; s < SCENES.length; s++) {
    var sc = SCENES[s];
    var tgt = (await send('Target.createTarget', { url: 'about:blank' })).result.targetId;
    var sid = (await send('Target.attachToTarget', { targetId: tgt, flatten: true })).result.sessionId;
    await send('Page.enable', {}, sid);
    await send('Emulation.setDeviceMetricsOverride', { width: 540, height: 960, deviceScaleFactor: 2, mobile: true }, sid);
    var save = Object.assign({}, SAVE, sc.equip ? { equipped: sc.equip } : {});
    await send('Page.addScriptToEvaluateOnNewDocument', { source: sc.fresh
      ? "try{localStorage.removeItem('icedash-save-v1')}catch(e){}"
      : "try{localStorage.setItem('icedash-save-v1'," + JSON.stringify(JSON.stringify(save)) + ")}catch(e){}" }, sid);
    await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' }, sid);
    await sleep(1800);
    async function ev(x) { return (await send('Runtime.evaluate', { expression: x, returnByValue: true }, sid)).result; }
    if (sc.click) await ev("document.querySelector(" + JSON.stringify(sc.click) + ").click()");
    if (sc.ride) await ev(RIDE + "(" + sc.ride + ")");
    await sleep(sc.wait || 800);
    if (sc.then) { await ev(sc.then); await sleep(300); }
    var shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    fs.writeFileSync(path.join(OUT, sc.name + '.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('  ' + sc.name);
    await send('Target.closeTarget', { targetId: tgt });
  }
  ws.close(); ch.kill(); server.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
})().catch(function (e) { console.error(e); process.exit(1); });
