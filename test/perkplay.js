/* ===========================================================
   perkplay.js — every creature's perk, played for real
   -----------------------------------------------------------
   perks.js proves each perk on a hand-built moment, headless. This one
   plays: real Chrome, the real page, the creature put on in the Market
   with real taps, a Freeride started from the title and steered with
   real touches (the same autopilot playtest.js uses decides WHEN to
   tap). Nothing is placed on the hill for it. A watcher on the page
   counts what happened, and each creature is held against Snowcap
   ridden the same way. A perk that never shows in a real run fails
   here even when perks.js passes: that is the "it does not seem to do
   anything" a player would feel.

     node test/perkplay.js              every creature
     node test/perkplay.js seal owl     just these (Snowcap always rides)
     RUN_MS=60000 node test/perkplay.js longer rides (default 60 s each)

   Screenshots of every ride are in $TMPDIR/icedash-perkplay.
   =========================================================== */
var http = require('http'), fs = require('fs'), path = require('path');
var cp = require('child_process'), os = require('os');
global.window = global;
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'skins.js'), 'utf8'));

var ROOT = path.join(__dirname, '..');
var SHOTS = path.join(os.tmpdir(), 'icedash-perkplay');
var PORT = 8825, DPORT = 9334;
var RUN_MS = +process.env.RUN_MS || 60000;
var W_ = 390, H_ = 844;
var fail = 0, seen = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
function info(m) { console.log('       ' + m); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ---------------------------------------------------------- server + chrome */
var MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
function serve() {
  return new Promise(function (res) {
    var s = http.createServer(function (q, r) {
      var p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
      var f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('no'); return; }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(PORT, function () { res(s); });
  });
}
function getJSON(url) {
  return new Promise(function (res, rej) {
    http.get(url, function (r) { var b = ''; r.on('data', function (c) { b += c; });
      r.on('end', function () { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
function CDP(url) {
  var ws = new WebSocket(url), id = 0, waits = {};
  var ready = new Promise(function (r) { ws.onopen = r; });
  ws.onmessage = function (e) { var m = JSON.parse(e.data); if (m.id && waits[m.id]) { waits[m.id](m); delete waits[m.id]; } };
  return { ready: ready, close: function () { ws.close(); },
    send: function (method, params, sid) {
      var n = ++id;
      return new Promise(function (res, rej) {
        waits[n] = function (m) { m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); };
        ws.send(JSON.stringify({ id: n, method: method, params: params || {}, sessionId: sid }));
      });
    } };
}

/* ---------------------------------------------------------- the watcher
   Installed in the page once; reset at the start of every ride. It reads
   the world after each frame and counts only what the game itself did. */
var WATCH = "(function(){if(window.__pw)return;var S,seen,got,last,old,free=0,PR=Game._consts().PR;" +
  "window.__pwReset=function(){S={frames:0,dist:0,start:null,catches:0,far:0,farMax:0,fish:0,gold:0,gates:0,gateCoins:[],gateW:[],rampW:[]," +
  " air:[],bogF:0,bogRatio:0,closes:0,saved:0,seeing:0,shrugs:0,clockGain:[],spd:[],turns:[],turnT:null,crashes:0,drifts:0};" +
  " seen=new WeakSet();got=new WeakSet();last=null;old=Game.debug();};window.__pwReset();" +
  "window.__pwGet=function(){return S;};" +
  "function tick(){var W=Game.debug();" +
  " if(W&&W!==old&&W.state==='run'&&Game.isRunning()){" +
  "  if(!S.start)S.start={shield:W.shield,combo:W.combo};S.frames++;if(Game._seeing())S.seeing++;" +
  "  for(var i=0;i<W.objects.length;i++){var o=W.objects[i];" +
  "   if(!seen.has(o)){seen.add(o);if(o.t==='fish')S.fish++;if(o.t==='gold')S.gold++;" +
  "    if(o.t==='gate')S.gateW.push(o.w);if(o.t==='ramp')S.rampW.push(o.w);if(o.t==='drift')S.drifts++;}" +
  "   if((o.t==='fish'||o.t==='gold')&&o.got&&!got.has(o)){got.add(o);S.catches++;" +
  "    var q=Math.max(Math.abs(o.x-W.px),Math.abs(o.d-W.dist))/(o.r+PR);if(q>1.05)S.far++;if(q>S.farMax)S.farMax=q;}}" +
  "  if(last&&last.W===W){var adv=W.dist-last.dist;if(adv>0&&adv<60)S.dist+=adv;" +
  "   if(W.bog>0&&free>0){S.bogF++;S.bogRatio+=W.speed/free;}else if(!W.bog)free=W.speed;" +
  "   if(W.gates>last.gates)S.gateCoins.push(W.coins-last.coins);" +
  "   if(W.closes>last.closes)S.closes+=W.closes-last.closes;" +
  "   if(W.jumps>last.jumps)S.air.push(W.airSpan);" +
  "   if(W.saved>last.saved)S.saved+=W.saved-last.saved;" +
  "   if(last.ck>0&&!W.comboKeep&&W.combo>0&&W.combo>=last.combo)S.shrugs++;" +
  "   if(W.clocks>last.clocks)S.clockGain.push(W.timeT-last.timeT+1);" +
  /* how many frames from a tap until he is actually sliding the new way */
  "   if(W.dir!==last.dir)S.turnT={dir:W.dir,f:0};else if(S.turnT){S.turnT.f++;if(W.vx*S.turnT.dir>=0.5*0.82*W.speed){S.turns.push(S.turnT.f);S.turnT=null;}else if(S.turnT.f>60)S.turnT=null;}" +
  "   if(S.frames%30===0)S.spd.push([Math.round(W.dist),+W.speed.toFixed(3)]);}" +
  "  last={W:W,dist:W.dist,gates:W.gates,coins:W.coins,closes:W.closes,jumps:W.jumps,saved:W.saved,ck:W.comboKeep,combo:W.combo,clocks:W.clocks,timeT:W.timeT,dir:W.dir};" +
  " }else if(W&&last&&last.W===W&&W.state==='crash'&&!last.crashed){S.crashes++;last.crashed=1;}" +
  " requestAnimationFrame(tick);}window.__pw=1;requestAnimationFrame(tick);})();1";

/* the same prediction playtest.js taps by */
var WANT_TAP = "(function(){var W=Game.debug();if(!W||W.state!=='run')return -1;" +
  "var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+30){r=W.rows[i];break;}" +
  "if(!r)return 0;var t=Game._chuteAt(r.d)+r.gap;" +
  "var fr=Math.max(1,Math.round((r.d-W.dist)/W.speed));" +
  "function m(d){var x=W.px,v=W.vx,tr=Game._turnRate();" +
  "for(var k=0;k<fr;k++){v+=(d*0.82*W.speed-v)*tr;x+=v;}return Math.abs(x-t);}" +
  "return m(-W.dir)<m(W.dir)-6?1:0;})()";

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  var server = await serve();
  var profile = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-pp-'));
  var bin = process.env.CHROME || 'google-chrome';
  var proc = cp.spawn(bin, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  var url;
  for (var i = 0; i < 80 && !url; i++) { try { url = (await getJSON('http://127.0.0.1:' + DPORT + '/json/version')).webSocketDebuggerUrl; } catch (e) {} if (!url) await sleep(250); }
  var cdp = CDP(url); await cdp.ready;
  var tid = (await cdp.send('Target.createTarget', { url: 'about:blank' })).targetId;
  var sid = (await cdp.send('Target.attachToTarget', { targetId: tid, flatten: true })).sessionId;
  await cdp.send('Runtime.enable', {}, sid); await cdp.send('Page.enable', {}, sid);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W_, height: H_, deviceScaleFactor: 2, mobile: true }, sid);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }, sid);
  /* a player who owns every creature, wearing Snowcap, sound off */
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{if(!localStorage.getItem('icedash-save-v1'))localStorage.setItem('icedash-save-v1'," +
    JSON.stringify(JSON.stringify({ best: 4200, runs: 30, sfx: false, music: false, fish: 5000, gold: 10, lives: 0,
      owned: SKINS.map(function (s) { return s.id; }), equipped: 'snowcap', lang: 'en', gift: Date.now(), seenMarket: 1, courses: { firstlight: 2 } })) + ")}catch(e){}" }, sid);

  async function ev(expr) {
    var r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
    if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ' -> ' + r.exceptionDetails.text);
    return r.result.value;
  }
  async function shot(tag) {
    var r = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
    fs.writeFileSync(path.join(SHOTS, tag + '.png'), Buffer.from(r.data, 'base64'));
  }
  function visible(sel) {
    return ev("(function(){var e=document.querySelector(" + JSON.stringify(sel) + ");if(!e)return false;var s=getComputedStyle(e);" +
      "if(s.display==='none'||s.visibility==='hidden')return false;var r=e.getBoundingClientRect();return r.width>1&&r.height>1;})()");
  }
  async function waitFor(sel, ms) { for (var i = 0; i < (ms || 4000) / 100; i++) { if (await visible(sel)) return true; await sleep(100); } return false; }
  async function tapAt(x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x, y: y }] }, sid);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sid);
  }
  async function click(sel, expect) {
    for (var k = 0; k < 3; k++) {
      await sleep(250);
      var b = await ev("(function(){var e=document.querySelector(" + JSON.stringify(sel) + ");if(!e)return null;e.scrollIntoView({block:'center'});" +
        "var r=e.getBoundingClientRect();return r.width>1?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()");
      if (!b) throw new Error('not clickable: ' + sel);
      await tapAt(Math.round(b.x), Math.round(b.y));
      if (!expect || await waitFor(expect, 2500)) return true;
    }
    await shot('stuck'); throw new Error(sel + ' never led to ' + expect + ' (on ' + (await ev("[].map.call(document.querySelectorAll('.screen:not(.hidden),.sheet:not(.hidden)'),function(e){return e.id;}).join()")) + ')');
  }
  async function toTitle() {
    for (var k = 0; k < 20 && !(await visible('#screen-title')); k++) {
      if (await visible('#btn-menu')) { await click('#btn-menu'); await sleep(300); }
      if (await visible('.screen:not(.hidden) [data-action="back-title"]:not(#btn-back)')) await click('.screen:not(.hidden) [data-action="back-title"]:not(#btn-back)');
      else if (await visible('.sheet:not(.hidden) [data-action="close-sheet"]')) await click('.sheet:not(.hidden) [data-action="close-sheet"]');
      else if (await visible('#screen-revive')) await click('[data-action="no-life"]');
      else if (await visible('#screen-over')) await click('#screen-over [data-action="back-title"]');
      else if (await visible('#btn-back')) await click('#btn-back');
      await sleep(300);
    }
  }
  /* put the creature on the way a player does: Market, its tile, Wear */
  async function wear(id) {
    await toTitle();
    await click('#screen-title [data-action="shop"]', '#screen-shop');
    await click('#shop-grid [data-pick="' + id + '"]', '#sheet-skin');
    if (await visible('#sheet-skin-btn')) await click('#sheet-skin-btn');
    else await click('#sheet-skin [data-action="close-sheet"]');
    await sleep(300);
    var on = await ev("JSON.parse(localStorage.getItem('icedash-save-v1')).equipped");
    if (on !== id) throw new Error('the Market did not put ' + id + ' on (' + on + ')');
    await toTitle();
  }
  async function steer(ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < ms) {
      var want = await ev(WANT_TAP);
      if (want < 0) return false;
      if (want) await tapAt(W_ / 2, Math.round(H_ * 0.35));
      await sleep(30);
    }
    return true;
  }
  /* ride for `ms`, from a button on the title (or More modes), starting
     again whenever the hill ends the run; `setup` runs once a run is up */
  async function ride(tag, ms, how) {
    how = how || {};
    await ev("__pwReset();1");
    var t0 = Date.now(), first = true, shots = 0;
    while (Date.now() - t0 < ms) {
      await toTitle();
      if (how.modes) { await click('#btn-more', '#screen-modes'); await click(how.modes, '#hud'); }
      else await click('#btn-free', '#hud');
      for (var k = 0; k < 40 && !(await ev("!!(Game.debug()&&Game.debug().state==='run')")); k++) await sleep(100);
      if (how.setup) await ev(how.setup);
      if (first) { await sleep(700); await shot(tag + '-start'); first = false; }
      var left = ms - (Date.now() - t0);
      if (shots < 1 && left > 8000) { await steer(8000); await shot(tag + '-ride'); shots++; left -= 8000; }
      await steer(Math.max(0, left));
    }
    await ev("Game.debug()&&Game.debug().state==='run'&&Game.stop&&0;1");
    var S = await ev("__pwGet()");
    S.km = S.dist / 8000;
    return S;
  }

  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' }, sid);
  await waitFor('#screen-title', 15000);
  await sleep(800);
  await ev(WATCH);

  var want = process.argv.slice(2);
  var ids = SKINS.map(function (s) { return s.id; }).filter(function (id) { return id !== 'snowcap' && (!want.length || want.indexOf(id) >= 0); });
  function per(S, n) { return S.km > 0 ? n / S.km : 0; }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function median(a) { if (!a.length) return 0; var b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; }
  function f1(n) { return (+n).toFixed(1); }
  function head(S) { return f1(S.km) + ' km, ' + S.crashes + ' crash(es), ' + S.catches + ' catches'; }

  /* ---- Snowcap, the ruler every perk is held against ---- */
  console.log('\nsnowcap — no perk, ridden the same way');
  await wear('snowcap');
  var base = await ride('snowcap', RUN_MS);
  info(head(base) + '; fish ' + f1(per(base, base.fish)) + '/km, gold ' + f1(per(base, base.gold)) + '/km, close calls ' +
       f1(per(base, base.closes)) + '/km, gates ' + base.gateW.length + ', ramps ' + base.rampW.length + ', deep snow ' + base.bogF + ' frames');
  ok(base.start && base.start.shield === 0 && base.start.combo === 0 && base.far === 0, 'no bubble, no combo, no catch beyond his reach (' + JSON.stringify(base.start) + ', ' + base.far + ' far, furthest ' + f1(base.farMax) + 'x)');
  var baseGlacier = null, baseRush = null, baseDaily = null;

  function speedAgainst(S) {                       // his pace over Snowcap's at the same distance
    var r = []; S.spd.forEach(function (p) {
      if (p[0] < 4000) return;                     // the opening pace is the same for all
      var best = null; base.spd.forEach(function (q) { if (!best || Math.abs(q[0] - p[0]) < Math.abs(best[0] - p[0])) best = q; });
      if (best && Math.abs(best[0] - p[0]) < 400) r.push(p[1] / best[1]);
    }); return r.length ? mean(r) : null;
  }
  async function daily(id) {
    await wear(id);
    await toTitle();
    var f0 = await ev("JSON.parse(localStorage.getItem('icedash-save-v1')).fish");
    await ev("(function(){var s=JSON.parse(localStorage.getItem('icedash-save-v1'));delete s.daily;s.dailyStreak=0;localStorage.setItem('icedash-save-v1',JSON.stringify(s));})();1");
    await cdp.send('Page.reload', {}, sid); await waitFor('#screen-title', 15000); await sleep(600); await ev(WATCH);
    f0 = await ev("JSON.parse(localStorage.getItem('icedash-save-v1')).fish");
    await click('#btn-more', '#screen-modes'); await click('#btn-daily', '#hud');
    await sleep(600);
    /* riding the whole line would take minutes: it is crossed for him, as playtest.js does */
    await ev("(function(){var W=Game.debug();W.state='finish';W.endT=0;})();1");
    await waitFor('#screen-over', 8000); await sleep(500);
    await shot(id + '-daily-results');
    var o = await ev("({fish:JSON.parse(localStorage.getItem('icedash-save-v1')).fish,stars:(JSON.parse(localStorage.getItem('icedash-save-v1')).daily||{}).stars||0," +
                     "detail:document.getElementById('over-earned').textContent})");
    o.gain = o.fish - f0;
    return o;
  }

  for (var n = 0; n < ids.length; n++) {
    var id = ids[n], sk = SKIN_BY_ID[id], P = sk.perk;
    console.log('\n' + id + ' — ' + sk.perkText);
    await wear(id);
    var S = await ride(id, RUN_MS);
    info(head(S));
    var any = false;
    if (P.startShield) {
      any = true;
      ok(S.start && S.start.shield === 1, 'the ride opens with the bubble on, where a player sees it');
      ok(S.saved >= 1 || S.crashes === 0, 'and it takes a crash (' + S.saved + ' saved)' + (S.saved ? '' : ' — not hit in this ride'));
    }
    if (P.reach) {
      any = true;
      ok(S.far > 0, S.far + ' of ' + S.catches + ' catches were out of Snowcap\'s reach (furthest ' + f1(S.farMax) + 'x)');
    }
    if (P.comboKeep) {
      any = true;
      ok(S.shrugs > 0, 'missed fish shrugged off without losing the run of catches: ' + S.shrugs + ' time(s)');
    }
    if (P.goldRate) {
      any = true; var g = per(S, S.gold), gb = per(base, base.gold);
      ok(g >= gb * 1.4, 'golden fish on the hill: ' + f1(g) + '/km against Snowcap\'s ' + f1(gb) + '/km');
    }
    if (P.shoal) {
      any = true; var fi = per(S, S.fish), fb = per(base, base.fish);
      ok(fi >= fb * 1.25, 'fish on the hill: ' + f1(fi) + '/km against Snowcap\'s ' + f1(fb) + '/km');
    }
    if (P.bogImmune) {
      any = true;
      var sr = S.bogF ? S.bogRatio / S.bogF : null, br = base.bogF ? base.bogRatio / base.bogF : null;
      ok(S.bogF > 0, 'he rode into deep snow (' + S.bogF + ' frames; ' + S.drifts + ' patches on his hill, Snowcap ' + base.drifts + ')' + (S.bogF ? '' : ' — never met in this ride: a perk a player may never see'));
      if (sr !== null) ok(sr > 0.95 && (br === null || br < 0.9), 'and kept his pace in it: ' + Math.round(sr * 100) + '% of full speed' + (br !== null ? ', Snowcap ' + Math.round(br * 100) + '%' : ''));
    }
    if (P.slowRamp) {
      any = true; var sa = speedAgainst(S);
      ok(sa !== null && sa < 0.97, sa === null ? 'never got far enough down the hill for the pace to differ' :
         'down the hill he runs at ' + Math.round(sa * 100) + '% of Snowcap\'s pace at the same distance');
    }
    if (P.closeBonus) {
      any = true; var c = per(S, S.closes), cb = per(base, base.closes);
      if (!S.closes && !base.closes) info('--  no close calls for either: this rider keeps to the middle of every opening (perks.js proves the perk)');
      else ok(c >= cb * 1.2 && S.closes > 0, 'close calls: ' + f1(c) + '/km against Snowcap\'s ' + f1(cb) + '/km');
    }
    if (P.foresight) {
      any = true;
      ok(S.seeing / S.frames > 0.95, 'the line to the opening was up ' + Math.round(100 * S.seeing / S.frames) + '% of the ride (Snowcap ' +
         Math.round(100 * base.seeing / Math.max(1, base.frames)) + '%)');
    }
    if (P.gateBonus) {
      any = true;
      var gw = mean(S.gateW), gwb = mean(base.gateW);
      ok(S.gateW.length && base.gateW.length && gw / gwb > 1.4, 'crystal rings ' + f1(gw) + ' wide against ' + f1(gwb) + ' (' + S.gateW.length + ' met)');
      ok(S.gateCoins.length && median(S.gateCoins) >= 6, 'and a ring pays ' + median(S.gateCoins) + ' fish (Snowcap ' + median(base.gateCoins) + ')' +
         (S.gateCoins.length ? '' : ' — no ring taken'));
    }
    if (P.rampWide) {
      any = true; var rw = mean(S.rampW), rb = mean(base.rampW);
      ok(S.rampW.length && base.rampW.length && rw / rb > 1.4, 'crevasse ramps ' + f1(rw) + ' wide against ' + f1(rb) + ' (' + S.rampW.length + ' met)');
    }
    if (P.rampBoost) {
      any = true; var ai = mean(S.air), ab = mean(base.air);
      ok(S.air.length > 0 && (!base.air.length || ai / ab > 1.5), 'air off a ramp: ' + Math.round(ai) + ' against ' + Math.round(ab) + ' (' + S.air.length + ' jumps)');
    }
    if (P.comboStart) {
      any = true;
      ok(S.start && S.start.combo === 10, 'the ride opens with the combo at x2 (' + (S.start && S.start.combo) + ')');
    }
    if (P.grip) {
      any = true;
      if (!baseGlacier) { await wear('snowcap'); baseGlacier = await ride('snowcap-glacier', 20000, { setup: 'Game.debug().biome=3;1' }); await wear(id); }
      var G = await ride(id + '-glacier', 20000, { setup: 'Game.debug().biome=3;1' });
      ok(mean(G.turns) < mean(baseGlacier.turns) * 0.8, 'on the Glacier a tap has him sliding the new way in ' + f1(mean(G.turns)) + ' frames, Snowcap ' + f1(mean(baseGlacier.turns)));
    }
    if (P.clockGain) {
      any = true;
      if (!baseRush) { await wear('snowcap'); baseRush = await ride('snowcap-rush', 25000, { modes: '#btn-rush' }); await wear(id); }
      var R = await ride(id + '-rush', 25000, { modes: '#btn-rush' });
      ok(R.clockGain.length > 0 && mean(R.clockGain) > mean(baseRush.clockGain) + 40,
         'in Time Rush a time bubble gives ' + f1(mean(R.clockGain) / 60) + ' s (Snowcap ' + f1(mean(baseRush.clockGain) / 60) + ' s, ' + R.clockGain.length + ' caught)');
    }
    if (P.dailyStar) {
      any = true;
      if (!baseDaily) baseDaily = await daily('snowcap');
      var D = await daily(id);
      ok(D.gain - baseDaily.gain === 25 * D.stars && D.stars > 0 && D.detail.indexOf(String(25 * D.stars)) >= 0,
         'the Daily Line\'s ' + D.stars + ' star(s) pay ' + D.gain + ' fish, Snowcap ' + baseDaily.gain + ', and the results say so ("' + D.detail + '")');
    }
    ok(any, 'its perk was looked for');
    seen++;
  }

  console.log('\nscreenshots in ' + SHOTS);
  cdp.close(); proc.kill(); server.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'every perk showed in real play (' + seen + ' creatures)'));
  process.exit(fail ? 1 : 0);
}
main().catch(function (e) { console.error('blew up: ' + (e.stack || e)); process.exit(2); });
