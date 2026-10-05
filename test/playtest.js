/* ===========================================================
   playtest.js — the game, in a real browser, driven by real input
   -----------------------------------------------------------
   Everything else in test/ runs the engine headless with the DOM stubbed
   out. This does not: it starts Chrome, serves the actual page, and walks
   through it with mouse and touch events dispatched by the browser itself,
   on both declared platforms. What it is looking for is the half of the
   game the other suites cannot see — screens that do not open, buttons
   that do nothing, state lost between screens, and anything the page
   writes to the console.

   No dependencies: Chrome is driven over the DevTools protocol through
   node's own WebSocket.

     node test/playtest.js            both platforms
     node test/playtest.js desktop    just the one
   =========================================================== */
var http = require('http'), fs = require('fs'), path = require('path');
var cp = require('child_process'), os = require('os');

var ROOT = path.join(__dirname, '..');
var SHOTS = path.join(os.tmpdir(), 'icedash-playtest');
var PORT = 8824, DPORT = 9333;
var fail = 0, notes = [];
function ok(c, m) {
  console.log((c ? '  ok   ' : '  FAIL ') + m);
  notes.push({ ok: !!c, m: m });
  if (!c) fail++;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ---------------------------------------------------------- server */
var MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
             '.png': 'image/png', '.webp': 'image/webp' };
function serve() {
  return new Promise(function (res) {
    var s = http.createServer(function (q, r) {
      var p = decodeURIComponent(q.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      var f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        r.writeHead(404); r.end('no'); return;
      }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(PORT, function () { res(s); });
  });
}

/* ---------------------------------------------------------- chrome */
/* `google-chrome` is only on the PATH on Linux. Elsewhere Chrome sits at a
   fixed install path; $CHROME overrides all of them. */
function chromeBin() {
  if (process.env.CHROME) return process.env.CHROME;
  var known = {
    win32: [path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  }[process.platform] || [];
  for (var i = 0; i < known.length; i++) if (fs.existsSync(known[i])) return known[i];
  return 'google-chrome';
}
function chrome(profile) {
  return cp.spawn(chromeBin(), [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + DPORT,
    '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
}
function getJSON(url) {
  return new Promise(function (res, rej) {
    http.get(url, function (r) {
      var b = ''; r.on('data', function (c) { b += c; });
      r.on('end', function () { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
async function wsTarget() {
  for (var i = 0; i < 80; i++) {
    try { var v = await getJSON('http://127.0.0.1:' + DPORT + '/json/version');
          if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl; } catch (e) {}
    await sleep(250);
  }
  throw new Error('chrome never came up');
}

/* A very small CDP client. */
function CDP(url) {
  var ws = new WebSocket(url), id = 0, waits = {}, listeners = [];
  var ready = new Promise(function (r) { ws.onopen = r; });
  ws.onmessage = function (e) {
    var m = JSON.parse(e.data);
    if (m.id && waits[m.id]) { waits[m.id](m); delete waits[m.id]; }
    else if (m.method) listeners.forEach(function (f) { f(m); });
  };
  return {
    ready: ready,
    on: function (f) { listeners.push(f); },
    close: function () { ws.close(); },
    send: function (method, params, sessionId) {
      var n = ++id;
      return new Promise(function (res, rej) {
        waits[n] = function (m) { m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); };
        ws.send(JSON.stringify({ id: n, method: method, params: params || {}, sessionId: sessionId }));
      });
    }
  };
}

/* ---------------------------------------------------------- the walk */
var PLATFORMS = {
  desktop: { w: 1280, h: 800, mobile: false, touch: 0, name: 'desktop 1280x800' },
  mobile:  { w: 390,  h: 844, mobile: true,  touch: 1, name: 'phone 390x844' }
};

async function walk(cdp, sid, P) {
  var errs = [];
  cdp.on(function (m) {
    if (m.sessionId !== sid) return;
    if (m.method === 'Runtime.exceptionThrown')
      errs.push('exception: ' + (m.params.exceptionDetails.exception || {}).description ||
                m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push('console.error: ' + m.params.args.map(function (a) { return a.value; }).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      errs.push('log: ' + m.params.entry.text);
  });
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send('Log.enable', {}, sid);
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: P.w, height: P.h, deviceScaleFactor: P.mobile ? 3 : 1, mobile: P.mobile }, sid);
  await cdp.send('Emulation.setTouchEmulationEnabled',
    { enabled: !!P.touch, maxTouchPoints: P.touch || 1 }, sid);

  /* A save with something in it, so the market, the revive and the trophy
     list all have something to show. Written before the page exists. */
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source:
    /* ...unless this tab has been told to come up as a brand-new player,
       which is how the tutorial is reached at the end of the walk. */
    "try{if(!sessionStorage.getItem('fresh'))localStorage.setItem('icedash-save-v1'," + JSON.stringify(JSON.stringify({
      best: 4200, runs: 9, sfx: false, music: false, fish: 3000, gold: 4,
      owned: ['snowcap', 'mitten', 'seal'], equipped: 'seal', lang: 'en',
      ach: ['first'], totFish: 900, totGold: 4, totGates: 20, totJumps: 3,
      totSaves: 1, bestDist: 980, bestRunFish: 60, lives: 2, finds: 2,
      totRevives: 0, totFinds: 0, totRushes: 0, totSmashed: 0, totForks: 0,
      courses: { firstlight: 2 }
    })) + ")}catch(e){}" }, sid);

  async function ev(expr) {
    var r = await cdp.send('Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true }, sid);
    if (r.exceptionDetails) throw new Error(expr + ' -> ' + r.exceptionDetails.text);
    return r.result.value;
  }
  async function shot(tag) {
    var r = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
    fs.writeFileSync(path.join(SHOTS, P.name.split(' ')[0] + '-' + tag + '.png'),
                     Buffer.from(r.data, 'base64'));
  }
  /* A real click: the page is hit with the same events a finger sends.
     The panel is scrolled to the button first — the Market is eleven
     creatures long and its Back button starts below the fold, so a click
     at its page coordinates landed outside the window and did nothing. */
  async function click(sel) {
    var box = await ev("(function(){var e=document.querySelector(" + JSON.stringify(sel) +
      ");if(!e)return {miss:'no such element'};" +
      "try{e.scrollIntoView({block:'center'});}catch(x){}" +
      "var r=e.getBoundingClientRect();" +
      "if(r.width<1||r.height<1)return {miss:'zero size'};" +
      "var vw=innerWidth,vh=innerHeight;" +
      "if(r.right<0||r.bottom<0||r.left>vw||r.top>vh)" +
      "  return {miss:'off screen '+JSON.stringify(r)+' in '+vw+'x'+vh};" +
      /* Aim at the middle of the part that IS on screen, so a button
         sitting half off the bottom edge is still hit where it is. */
      "var x=(Math.max(0,r.left)+Math.min(vw,r.right))/2;" +
      "var y=(Math.max(0,r.top)+Math.min(vh,r.bottom))/2;" +
      "return {x:x,y:y,w:r.width,h:r.height};})()");
    if (!box || box.miss) throw new Error('not clickable: ' + sel + ' (' +
                                          ((box && box.miss) || 'null') + ')');
    await tapAt(Math.round(box.x), Math.round(box.y));
    await sleep(180);
    return box;
  }
  /* Synthesised touch does not always turn into a click: Chrome decides
     whether a touchStart/touchEnd pair was a tap, and now and again it
     decides it was not. Retried rather than ignored, and the retries are
     counted and reported — a button that needs them every time is a real
     problem, not a flaky harness. */
  var retries = 0;
  async function clickFor(sel, expect, tries) {
    tries = tries || 3;
    for (var i = 0; i < tries; i++) {
      await click(sel);
      if (!expect || await waitFor(expect, 2500)) return i;
      retries++;
    }
    return -1;
  }
  async function tapAt(x, y) {
    var p = { x: x, y: y, button: 'left', clickCount: 1 };
    if (P.touch) {
      await cdp.send('Input.dispatchTouchEvent',
        { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] }, sid);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sid);
    } else {
      await cdp.send('Input.dispatchMouseEvent', Object.assign({ type: 'mousePressed' }, p), sid);
      await cdp.send('Input.dispatchMouseEvent', Object.assign({ type: 'mouseReleased' }, p), sid);
    }
  }
  async function tapHill() {
    await tapAt(Math.round(P.w / 2), Math.round(P.h * 0.35));
  }
  /* Tapping on a timer is not playing: a run died inside a couple of
     hundred metres and the pause button was gone before it could be
     pressed. The decision of WHETHER to tap is read off the same
     prediction the headless bots use; the tap itself is still a real
     touch on the real page, which is the part under test. */
  var WANT_TAP = "(function(){var W=Game.debug();if(!W||W.state!=='run')return -1;" +
    "var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+30){r=W.rows[i];break;}" +
    "if(!r)return 0;var t=Game._chuteAt(r.d)+r.gap;" +
    "var fr=Math.max(1,Math.round((r.d-W.dist)/W.speed));" +
    "function m(d){var x=W.px,v=W.vx,tr=Game._turnRate();" +
    "for(var k=0;k<fr;k++){v+=(d*0.82*W.speed-v)*tr;x+=v;}return Math.abs(x-t);}" +
    "return m(-W.dir)<m(W.dir)-6?1:0;})()";
  async function steerFor(ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < ms) {
      var want = await ev(WANT_TAP);
      if (want < 0) return false;                    // the run is over
      if (want) await tapHill();
      await sleep(30);
    }
    return true;
  }
  /* Whatever screen the hill left him on, get back to a live run. */
  async function ensureRunning() {
    if (await ev("Game.isRunning() && Game.debug() && Game.debug().state==='run'")) return;
    if (await visible('#screen-revive')) await clickFor('[data-action="no-life"]', '#screen-over');
    if (await visible('#screen-over')) await clickFor('#screen-over [data-action="back-title"]', '#screen-title');
    if (!(await visible('#screen-title'))) await waitFor('#screen-title', 4000);
    await clickFor('#btn-free', null);
    await sleep(400);
  }
  /* offsetParent is null for anything position:fixed, which every screen
     in this game is — the first version of this helper called the whole
     interface invisible while screenshotting it perfectly happily. */
  function visible(sel) {
    return ev("(function(){var e=document.querySelector(" + JSON.stringify(sel) +
              ");if(!e)return false;var st=getComputedStyle(e);" +
              "if(st.display==='none'||st.visibility==='hidden')return false;" +
              "var r=e.getBoundingClientRect();return r.width>1&&r.height>1;})()");
  }
  async function waitFor(sel, ms) {
    for (var i = 0; i < (ms || 4000) / 100; i++) {
      if (await visible(sel)) return true;
      await sleep(100);
    }
    return false;
  }

  console.log('\n--- ' + P.name + ' ---\n');
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' }, sid);
  for (var i = 0; i < 60 && !(await visible('#screen-title')); i++) await sleep(200);
  ok(await visible('#screen-title'), 'the title screen comes up');
  ok(await ev("!!(window.Game && Game.isRunning)"), 'the engine is on the page');
  await shot('01-title');
  /* the whole title in the window without scrolling: the plaque at the top,
     the row of quiet buttons at the bottom */
  var fit = await ev("(function(){var s=document.getElementById('screen-title');s.scrollTop=0;" +
    "var b=document.querySelector('.row-three').getBoundingClientRect(),p=document.getElementById('title-best').getBoundingClientRect();" +
    "return {rowBottom:Math.round(b.bottom),plaqueTop:Math.round(p.top),vh:innerHeight};})()");
  ok(fit.rowBottom <= fit.vh && fit.plaqueTop > 0, 'the whole title fits the window, best score to bottom row (' + JSON.stringify(fit) + ')');

  /* The bug that was reported: Continue sitting there with nothing to
     continue. */
  ok(!(await visible('#resume-row')),
     'Continue is not offered when there is no run to continue');
  /* The seed holds 3000 fish and three creatures, so the shelf has
     something on it the purse can pay for. */
  ok(await visible('#market-badge'), 'the Market button says something on the shelf is affordable');
  var chip = await ev("document.getElementById('title-tasks').textContent");
  ok(/of 3|all done/.test(chip), 'and the title shows how today\'s tasks are going ("' + chip + '")');

  /* ---- the panels ---- */
  await clickFor('[data-action="help"]', '#screen-help');
  ok(await waitFor('#screen-help'), 'How to play opens');
  var hints = await ev("(function(){var li=document.querySelectorAll('#screen-help [data-hint]');var n=0;" +
    "li.forEach(function(e){var c=e.querySelector('canvas');if(c&&c.width>0)n++;});return {all:li.length,drawn:n,clock:!!document.querySelector('[data-hint=\"clock\"] canvas')};})()");
  ok(hints.drawn === hints.all && hints.clock, 'every line that names a thing has its picture, the time bubble included (' + hints.drawn + ' of ' + hints.all + ')');
  ok(await ev("document.querySelectorAll('#screen-help li').length >= 14"),
     'and it covers the hill (' + (await ev("document.querySelectorAll('#screen-help li').length")) + ' entries)');
  await shot('02-help');
  await cdp.send('Input.dispatchKeyEvent',
    { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sid);
  await sleep(250);
  ok(await waitFor('#screen-title'), 'Esc closes it');

  await clickFor('[data-action="settings"]', '#screen-settings');
  ok(await waitFor('#screen-settings'), 'Settings opens');
  await shot('03-settings');
  ok(await ev("!!document.querySelector('#lang-open .flag svg') && /English/.test(document.getElementById('lang-open').textContent)"),
     'Settings shows the language in use, with its flag');
  ok(await clickFor('#lang-open', '#sheet-lang') >= 0, 'a tap on it opens the list of languages');
  var langs = await ev("Array.from(document.querySelectorAll('#lang-row button')).map(b=>b.textContent.trim())");
  var flags = await ev("document.querySelectorAll('#lang-row .flag svg').length");
  ok(langs.length === 3 && flags === 3, 'all three are offered, each with its flag (' + langs.join(', ') + ')');
  await shot('03b-languages');
  await click('#lang-row [data-lang="ru"]');
  ok(!(await visible('#sheet-lang')), 'picking one closes the list');
  var ruTitle = await ev("document.querySelector('#screen-settings .panel-title-text').textContent.trim()");
  ok(/[Ѐ-ӿ]/.test(ruTitle), 'switching language changes the text on screen (' + ruTitle + ')');
  await shot('04-settings-ru');
  await clickFor('#lang-open', '#sheet-lang');
  await click('#lang-row [data-lang="ro"]');
  var roTitle = await ev("document.querySelector('#screen-settings .panel-title-text').textContent.trim()");
  ok(roTitle === 'Setări', 'Romanian is there too (' + roTitle + ')');
  /* ă, ș and ț come from their own cut of the font: it has to be the
     game's font that draws them, not whatever the device falls back to. */
  var roFont = await ev("document.fonts.load('800 20px \"Baloo 2\"', 'ăȘț').then(function(f){return f.length>0 && document.fonts.check('800 20px \"Baloo 2\"', 'ăȘț');})");
  ok(roFont === true, 'and the game font has its own ă, ș and ț');
  await shot('04b-settings-ro');
  await clickFor('#lang-open', '#sheet-lang');
  await click('#lang-row [data-lang="en"]');
  ok(/English/.test(await ev("document.getElementById('lang-open').textContent")), 'and back to English');
  /* The sound switch: it has to flip what it shows AND what is saved. */
  var sfx0 = await ev("JSON.parse(localStorage.getItem('icedash-save-v1')).sfx");
  await click('#t-sfx');
  var sfx1 = await ev("JSON.parse(localStorage.getItem('icedash-save-v1')).sfx");
  var shows = await ev("document.getElementById('t-sfx').classList.contains('on')");
  ok(sfx1 === !sfx0 && shows === sfx1, 'the Sounds switch turns sound ' + (sfx1 ? 'on' : 'off') +
     ' and shows it (' + sfx0 + ' -> ' + sfx1 + ')');
  await click('#t-sfx');
  await clickFor('#screen-settings [data-action="back-title"]', '#screen-title');
  ok(await waitFor('#screen-title'), 'Back returns to the title');

  await clickFor('[data-action="shop"]', '#screen-shop');
  ok(await waitFor('#screen-shop'), 'the Market opens');
  var cards = await ev("document.querySelectorAll('#shop-grid [data-pick]').length");
  var nSkins = await ev("SKINS.length");
  ok(cards === nSkins && nSkins >= 17, 'every creature is on the shelf (' + cards + ' of ' + nSkins + ')');
  var purse = await ev("(function(){var f=document.getElementById('wallet-fish'),g=document.getElementById('wallet-gold');" +
    "var a=f.getBoundingClientRect(),b=g.getBoundingClientRect();" +
    "return {gap:Math.round(b.left-a.right),row:Math.abs(a.top-b.top)<4,coins:document.querySelectorAll('.purse .coin').length," +
    "f:f.textContent,g:g.textContent};})()");
  ok(purse.coins === 2 && purse.gap >= 8 && purse.row && /^\d/.test(purse.f) && !/fish|gold/i.test(purse.f + purse.g),
     'the purse is two pills side by side, a fish and a number each, apart (' + JSON.stringify(purse) + ')');
  ok(await ev("!document.querySelector('#shop-grid .skin-name, #shop-grid .skin-perk, #shop-grid button button')"),
     'the shelf is pictures: no names or perks written on the tiles');
  ok(await ev("!!document.querySelector('#shop-grid [data-pick=\"seal\"] .tag-worn')"),
     'the creature being ridden is marked on its tile');
  await shot('05-market');
  /* A tap on a tile opens its window, with the words and the button. */
  ok(await clickFor('#shop-grid [data-pick="mitten"]', '#sheet-skin') >= 0, 'a tap on a creature opens its window');
  var sk = await ev("({n:document.getElementById('sheet-skin-name').textContent," +
                    "p:document.getElementById('sheet-skin-perk').textContent," +
                    "b:document.getElementById('sheet-skin-btn').textContent})");
  ok(sk.n && sk.p.length > 10 && sk.b === 'Choose',
     'with its name, what it does, and Choose for one already owned (' + JSON.stringify(sk) + ')');
  await shot('05b-market-sheet');
  await click('#sheet-skin-btn');
  ok((await readSave()).equipped === 'mitten' && /✓/.test(await ev("document.getElementById('sheet-skin-btn').textContent")),
     'Choose puts it on, and the window now says it is chosen');
  ok(await clickFor('.sheet-x', null) >= 0 && !(await visible('#sheet-skin')), 'the cross closes the window');
  await clickFor('#shop-grid [data-pick="seal"]', '#sheet-skin');
  await click('#sheet-skin-btn');
  ok((await readSave()).equipped === 'seal', 'and choosing back works the same way');
  await clickFor('.sheet-x', null);
  var unowned = await ev("(function(){var e=document.querySelector('#shop-grid .tag-price.can');return e?e.parentNode.getAttribute('data-pick'):null;})()");
  ok(unowned, 'an affordable creature shows its price on the tile (' + unowned + ')');
  await clickFor('#shop-grid [data-pick="' + unowned + '"]', '#sheet-skin');
  var buyTxt = await ev("document.getElementById('sheet-skin-btn').textContent");
  ok(/^Buy/.test(buyTxt) && await ev("!document.getElementById('sheet-skin-btn').disabled"),
     'and its window offers to buy it (' + buyTxt.replace(/\s+/g, ' ') + ')');
  await clickFor('#btn-back', null);
  ok(!(await visible('#sheet-skin')) && await visible('#screen-shop'),
     'the back arrow closes the window first, leaving the Market open');
  /* The way out of the Market must not be a scroll away. The arrow is
     checked where it is, at the top of the window, with the shelf scrolled
     to the middle the way a player looking at one animal leaves it. */
  await ev("(function(){var s=document.querySelector('#screen-shop');s.scrollTop=s.scrollHeight/2;})()");
  var arrow = await ev("(function(){var e=document.querySelector('#btn-back');" +
    "if(!e||e.classList.contains('hidden'))return null;var r=e.getBoundingClientRect();" +
    "return {top:r.top,bottom:r.bottom,left:r.left,w:r.width,vh:innerHeight};})()");
  /* on screen with the shelf scrolled, and in the bottom-left corner: the
     top edge belongs to the platform's own controls */
  ok(arrow && arrow.bottom <= arrow.vh && arrow.top > arrow.vh * 0.6 && arrow.left < 40 && arrow.w >= 44,
     'the back arrow is on screen in the Market, bottom-left, without scrolling (' + JSON.stringify(arrow) + ')');
  ok(await clickFor('#btn-back', '#screen-title') >= 0, 'and it leaves the Market');
  ok(!(await visible('#btn-back')), 'and it is gone again on the title');
  /* the badge said something new was affordable; having looked, it is out,
     though the purse could still buy it */
  ok(!(await visible('#market-badge')), 'and the Market badge is out once the shelf has been seen');

  ok(await visible('#ach-badge'), 'the Trophies button says a reward is waiting');
  await clickFor('[data-action="trophies"]', '#screen-ach');
  ok(await waitFor('#screen-ach'), 'Trophies opens');
  /* Earned trophies wait to be paid: one claimed by hand, the rest at once. */
  var owed = await ev("document.querySelectorAll('#ach-list [data-claim]').length");
  ok(owed >= 2 && await ev("document.querySelector('#ach-list .ach-row').classList.contains('owed')"),
     'earned trophies wait with a Claim button, at the top of the list (' + owed + ')');
  var claimId = await ev("document.querySelector('#ach-list [data-claim]').getAttribute('data-claim')");
  var f0 = (await readSave()).fish;
  var rew = await ev("ACHIEVEMENTS.filter(function(a){return a.id===" + JSON.stringify(claimId) + ";})[0].reward");
  await click('#ach-list [data-claim="' + claimId + '"]');
  var sv1 = await readSave();
  ok(sv1.fish === f0 + rew && sv1.claimed.indexOf(claimId) >= 0,
     'Claim pays that trophy\'s fish into the purse (' + f0 + ' -> ' + sv1.fish + ', +' + rew + ')');
  ok(!(await ev("!!document.querySelector('#ach-list [data-claim=\"" + claimId + "\"]')")), 'and only once: its button is gone');
  await shot('06a-trophies-claim');
  if (owed >= 3) {
    ok(await visible('#ach-claim-all'), 'with more than one left, Claim all is offered');
    await click('#ach-claim-all');
  } else {
    await click('#ach-list [data-claim]');
  }
  ok(await ev("document.querySelectorAll('#ach-list [data-claim]').length") === 0 && !(await visible('#ach-claim-all')),
     'and when everything is claimed, nothing is left waiting');
  var trophies = await ev("document.querySelectorAll('#ach-list > *').length");
  var nTasks = await ev("document.querySelectorAll('#tasks-list .task-row').length");
  ok(nTasks === 3, 'today\'s three tasks head the trophy list (' + nTasks + ')');
  var nAch = await ev("ACHIEVEMENTS.length");
  ok(trophies === nAch && nAch >= 30, 'every trophy is listed (' + trophies + ' of ' + nAch + ')');
  var raw = await ev("Array.from(document.querySelectorAll('#ach-list .ach-name')).filter(e=>e.textContent.indexOf('ach.')===0).length");
  ok(raw === 0, 'and every one has a name, not a key (' + raw + ' untranslated)');
  await shot('06-trophies');
  await clickFor('#screen-ach [data-action="back-title"]', '#screen-title');
  ok(!(await visible('#ach-badge')), 'and the badge on the title goes out');

  await clickFor('[data-action="runs"]', '#screen-runs');
  ok(await waitFor('#screen-runs'), 'Known Lines opens');
  var lines = await ev("document.querySelectorAll('#runs-list > *').length");
  var nLines = await ev("COURSES.length");
  ok(lines === nLines && nLines >= 9, 'every marked line is listed (' + lines + ' of ' + nLines + ')');
  /* The seed has First Light done, so The Narrows is open and Gap Teeth is
     the next one locked: that row must say which line opens it. */
  var hint = await ev("Array.from(document.querySelectorAll('#runs-list .run-sub')).map(e=>e.textContent).join('|')");
  ok(/Finish The Narrows/.test(hint), 'the next locked line says which one to finish (' +
     (hint.split('|').filter(function (x) { return /Finish/.test(x); })[0] || 'none') + ')');
  await shot('07-lines');
  await clickFor('#screen-runs [data-action="back-title"]', '#screen-title');

  /* ---- actually riding ---- */
  await click('#btn-free');
  await sleep(400);
  ok(await ev("Game.isRunning()"), 'Freeride starts');
  ok(await visible('#btn-menu'), 'and the pause button is on screen');
  /* Headless Chrome runs rAF well under sixty a second, so seven seconds
     of wall clock is not seven seconds of hill. What is being asked here
     is whether the taps steer — whether he is still going — not how fast
     the browser managed to animate. */
  var stillUp = await steerFor(7000);
  var dist = await ev("Game.debug() ? Math.round(Game.debug().dist/8) : -1");
  ok(stillUp && dist > 100,
     'tapping steers a real run (' + dist + 'm covered, ' +
     (stillUp ? 'still going' : 'ended early') + ')');
  await shot('08-run');
  /* The readout must hold still while its numbers change: it may only
     move when a number gains a digit. With proportional digits it used to
     shuffle a pixel or two every frame as the metres ticked over. */
  var hudMoves = 0, hudSamples = 0, lastH = null;
  for (var hs = 0; hs < 80; hs++) {
    var hl = await ev("Game._hud && Game._hud()");
    if (hl && lastH && hl.digits === lastH.digits) {
      hudSamples++;
      if (hl.w !== lastH.w || hl.fx !== lastH.fx) hudMoves++;
    }
    if (hl) lastH = hl;
    if ((await ev(WANT_TAP)) === 1) await tapHill();
    await sleep(40);
  }
  ok(hudSamples > 20 && hudMoves === 0, 'the score panel holds still while its numbers change (' +
     hudMoves + ' shifts in ' + hudSamples + ' samples)');

  /* ---- pause, menu, and back into the same run ---- */
  await ensureRunning();
  await steerFor(1200);

  await waitFor('#btn-menu', 4000);
  await clickFor('#btn-menu', '#screen-pause');
  ok(await waitFor('#screen-pause'), 'the pause button pauses');
  await shot('09-pause');
  var atPause = await ev("Game.debug() ? Math.round(Game.debug().dist) : -1");
  await clickFor('#screen-pause [data-action="back-title"]', '#screen-title');
  ok(await waitFor('#screen-title'), 'Menu from the pause screen reaches the title');
  ok(await visible('#resume-row'), 'and NOW Continue is offered');
  await clickFor('[data-action="shop"]', '#screen-shop');
  await clickFor('#screen-shop [data-action="back-title"]', '#screen-title');
  await clickFor('[data-action="continue"]', null);
  await sleep(300);
  var back = await ev("Game.debug() ? Math.round(Game.debug().dist) : -1");
  /* A range, not a point: the run is moving again by the time it can be
     read, so the thing to check is that it carried on from where it was
     rather than starting over. */
  ok(back >= atPause && back < atPause + 600,
     'Continue picks the run up where it was left, not from the top (' +
     atPause + ' -> ' + back + ')');
  ok(await ev("!Game.isPaused()"), 'and it is running again, not still paused');

  /* ---- crash, and the life in hand ---- */
  /* No more steering: he runs out of hill on his own. */
  for (var c = 0; c < 900 && (await ev("Game.isRunning() && Game.debug() && Game.debug().state==='run'")); c++)
    await sleep(20);
  for (var w = 0; w < 50 && !(await visible('#screen-revive')) && !(await visible('#screen-over')); w++)
    await sleep(100);
  ok(await visible('#screen-revive'), 'a crash with a life in hand offers the revive');
  await shot('10-revive');
  await click('[data-action="use-life"]');
  for (var r2 = 0; r2 < 60 && !(await ev("Game.debug() && Game.debug().state==='run'")); r2++)
    await sleep(100);
  ok(await ev("Game.debug() && Game.debug().state==='run'"), 'the life puts him back on the hill');
  ok(await ev("Game.debug().grace > 0 || Game.debug().invuln > 0"),
     'and he cannot be killed the instant he lands');
  await shot('11-revived');

  /* ---- all the way to the end ---- */
  /* The seeded save carries two lives, so the next crash offers the second
     one. Turning it down is the other half of that screen and has to be
     walked too. */
  for (var c2 = 0; c2 < 1500; c2++) {
    if (await visible('#screen-over')) break;
    if (await visible('#screen-revive')) {
      await click('[data-action="no-life"]');
      ok(await waitFor('#screen-over', 6000),
         'turning the second life down ends the run');
      break;
    }
    await sleep(20);
  }
  ok(await waitFor('#screen-over', 8000), 'the run ends on the results screen');
  ok(/new story/i.test(await ev("document.getElementById('over-won').textContent")),
     'and the first run with the seal opens her first story');
  var shown = await ev("document.querySelector('#over-score').textContent.trim()");
  ok(/\d/.test(shown), 'which shows a score (' + shown + ')');
  var goals = await ev("Array.from(document.querySelectorAll('#over-goals .goal-txt')).map(e=>e.textContent).join(' | ')");
  ok(goals.length > 0, 'and what to go back for (' + goals + ')');
  await shot('12-over');

  /* ---- the finds: the save is seeded with two, and BOTH must open ----
     Opening one used to leave the button disabled for good, so the second
     find sat there and could never be cracked. Opening only one would not
     have seen it. */
  function finds() {
    return ev("(JSON.parse(localStorage.getItem('icedash-save-v1')||'{}').finds)||0");
  }
  if (await visible('#over-finds')) {
    var opened = 0, prize = '';
    for (var round = 0; round < 2 && await visible('#over-finds'); round++) {
      var before = await finds();
      if (before <= 0) break;
      await click('[data-action="open-find"]');
      /* The words are held back until the shell breaks, so wait for the
         prize line to come back rather than for a fixed moment. */
      var shown = false;
      for (var fi = 0; fi < 160 && !shown; fi++) {
        shown = await ev("!document.querySelector('#find-prize').classList.contains('hidden')" +
                         " && (JSON.parse(localStorage.getItem('icedash-save-v1')||'{}').finds||0) < " + before);
        if (!shown) await sleep(100);
      }
      if (!shown) break;
      prize = await ev("document.querySelector('#find-prize').textContent.trim()");
      opened++;
    }
    ok(opened >= 1, 'a frozen find opens and pays out (' + (prize || 'nothing') + ')');
    ok(opened >= 2, 'and the second one opens too, not just the first (' + opened + ' opened)');
    await shot('13-find');
  }

  await clickFor('#screen-over [data-action="back-title"]', '#screen-title');
  ok(await waitFor('#screen-title'), 'and back to the title');
  ok(!(await visible('#resume-row')), 'with Continue gone again, the run being over');

  var saved = await ev("localStorage.getItem('icedash-save-v1')");
  ok(saved && saved.length > 100, 'the run was written to the save (' + (saved || '').length + ' bytes)');

  /* ---- More modes ---- */
  ok(!(await visible('#btn-daily')) && !(await visible('#btn-rush')),
     'the title leads with two modes; the Daily Line and Time Rush are not on it');
  ok(await visible('#more-badge'), 'More modes carries a badge while today\'s line is unfinished');
  ok(await clickFor('#btn-more', '#screen-modes') >= 0, 'More modes opens its list');
  ok(await visible('#btn-daily .todo-dot'), 'where the unfinished Daily Line wears a quiet mark');
  ok(await visible('#btn-rush .todo-dot') && await visible('#btn-av .todo-dot'),
     'and so do Time Rush and Avalanche, never ridden on this save');
  await shot('18b-more-modes');
  await clickFor('#btn-back', '#screen-title');
  ok(!(await visible('#more-badge')), 'and having opened the list, the badge is out for the day, line unfinished or not');
  await clickFor('#btn-more', '#screen-modes');

  /* ---- the Daily Line ---- */
  ok(await clickFor('#btn-daily', '#hud') >= 0, 'the Daily Line starts from More modes');
  var dl = await ev("Game.debug().course.id");
  ok(dl === 'daily', 'as today\'s written line (' + dl + ')');
  await sleep(800);
  await shot('19-daily');
  /* Crossing the line is forced: riding all of it here would take minutes
     of headless frames and prove nothing courses.js has not. */
  await ev("(function(){var W=Game.debug();W.state='finish';W.endT=0;})();1");
  ok(await waitFor('#screen-over', 8000), 'finishing it brings up the results');
  var dsv = await ev("JSON.parse(localStorage.getItem('icedash-save-v1'))");
  ok(dsv.dailyStreak === 1 && dsv.daily && dsv.daily.stars >= 1,
     'which start a streak and keep today\'s stars (streak ' + dsv.dailyStreak + ', ' + (dsv.daily && dsv.daily.stars) + ' star)');
  ok(!(dsv.courses && dsv.courses.daily), 'without touching the marked lines\' board');
  ok(/streak/i.test(await ev("document.getElementById('over-detail').textContent")), 'and the results show the streak');
  ok((dsv.ach || []).indexOf('daily1') >= 0, 'and the first one earns its trophy');
  await clickFor('#screen-over [data-action="back-title"]', '#screen-title');
  ok(!(await visible('#more-badge')), 'and the More modes badge goes out once today\'s line is finished');
  await clickFor('#btn-more', '#screen-modes');
  ok(!(await visible('#btn-daily .todo-dot')), 'and its mark is gone once the line is finished');
  var dsub = await ev("document.getElementById('daily-sub').textContent");
  ok(/★/.test(dsub) && /1/.test(dsub), 'the Daily Line button now shows today\'s stars and the streak ("' + dsub + '")');

  /* ---- Time Rush ---- */
  ok(await clickFor('#btn-rush', '#hud') >= 0, 'Time Rush starts from More modes');
  ok(await ev("Game.debug().mode") === 'rush', 'as a timed run');
  /* The bubbles are taken off the hill for this check: riding through one
     puts three seconds back, and the clock read higher at the end than at
     the start of a perfectly good run. */
  await ev("(function(){var W=Game.debug();W.objects=W.objects.filter(function(o){return o.t!=='clock';});})();1");
  var tA = await ev("Game.debug().timeT");
  /* Headless Chrome can run at a handful of frames a second when the
     machine is busy, and a crash pauses the clock while it plays out — so
     wait until it has visibly moved rather than for a fixed time. */
  for (var rr = 0; rr < 100; rr++) {
    if ((await ev(WANT_TAP)) === 1) await tapHill();
    await ev("(function(){var W=Game.debug();if(W)W.objects=W.objects.filter(function(o){return o.t!=='clock';});})();1");
    await sleep(60);
    if (rr > 30 && (await ev("Game.debug()&&Game.debug().timeT")) < tA - 60) break;
  }
  var tB = await ev("Game.debug()&&Game.debug().timeT");
  ok(tB !== null && tB < tA, 'and the clock runs down while you ride (' + (tA / 60).toFixed(1) + 's -> ' + (tB / 60).toFixed(1) + 's)');
  await shot('17-rush');
  await ev("Game.debug().timeT = 2; 1");
  ok(await waitFor('#screen-over', 8000), 'when the time runs out the results come up');
  var rTitle = await ev("document.querySelector('#screen-over .panel-title-text').textContent");
  var rScore = await ev("document.getElementById('over-score').textContent");
  ok(/time is up/i.test(rTitle) && / m$/.test(rScore), 'saying the time is up, scored in metres (' + rScore + ')');
  ok((await ev("JSON.parse(localStorage.getItem('icedash-save-v1')).bestRush")) > 0, 'and Time Rush has a best of its own');
  await shot('18-rush-over');
  ok(await clickFor('#screen-over [data-action="retry"]', '#hud') >= 0 &&
     (await ev("Game.debug().mode")) === 'rush', 'Ride again is another Time Rush');
  await waitFor('#btn-menu', 4000);
  await clickFor('#btn-menu', '#screen-pause');
  await clickFor('#screen-pause [data-action="back-title"]', '#screen-title');
  await ev("Game.stop();1");

  /* ---- Avalanche ---- */
  await clickFor('#btn-more', '#screen-modes');
  ok(!(await visible('#btn-rush .todo-dot')) && await visible('#btn-av .todo-dot'),
     'ridden once, Time Rush loses its mark; Avalanche, not yet ridden, keeps it');
  ok(await clickFor('#btn-av', '#hud') >= 0, 'Avalanche starts from More modes');
  ok(await ev("Game.debug().mode") === 'avalanche' && await ev("Game.debug().avGap") > 0,
     'with a lead on the snow');
  /* Brought close, so the wall itself is on screen for the picture. */
  await ev("(function(){var W=Game.debug();W.avGap=140;W.objects.length=0;})();1");
  await sleep(400);
  await shot('18c-avalanche');
  await ev("(function(){var W=Game.debug();W.avGap=2;})();1");
  ok(await waitFor('#screen-over', 8000), 'when the snow arrives the results come up');
  var aTitle = await ev("document.querySelector('#screen-over .panel-title-text').textContent");
  var aScore = await ev("document.getElementById('over-score').textContent");
  ok(/avalanche/i.test(aTitle) && / m$/.test(aScore), 'saying the avalanche got you, scored in metres (' + aTitle + ' / ' + aScore + ')');
  ok((await ev("JSON.parse(localStorage.getItem('icedash-save-v1')).bestAv")) > 0, 'and Avalanche has a best of its own');
  ok(!(await visible('#btn-free .todo-dot')), 'Freeride, ridden on this save, has no mark on the title');
  await shot('18d-avalanche-over');
  ok(await clickFor('#screen-over [data-action="retry"]', '#hud') >= 0 &&
     (await ev("Game.debug().mode")) === 'avalanche', 'Ride again is another Avalanche');
  await waitFor('#btn-menu', 4000);
  await clickFor('#btn-menu', '#screen-pause');
  await clickFor('#screen-pause [data-action="back-title"]', '#screen-title');
  await ev("Game.stop();1");

  /* ---- a brand-new player: the tutorial ----
     Everything above ran on a save with runs in it, and the tutorial never
     appeared — which is itself the check that an existing player is not
     dropped into it. Now the same page as somebody who has never played. */
  async function readSave() {
    return ev("JSON.parse(localStorage.getItem('icedash-save-v1')||'{}')");
  }
  /* ---- the trophy creature ----
     Shut on the shelf until the board is complete, then given, not sold. */
  await clickFor('[data-action="shop"]', '#screen-shop');
  var tTag = await ev("(function(){var e=document.querySelector('#shop-grid [data-pick=\"aurora\"] .tag-trophy');return e?e.textContent:null;})()");
  ok(tTag && /\d+\/\d+/.test(tTag), 'Aurora is on the shelf with the trophies still to go (' + tTag + ')');
  /* the seal has been ridden: her window shows her stories */
  await clickFor('#shop-grid [data-pick="seal"]', '#sheet-skin');
  var alb = await ev("({rows:document.querySelectorAll('#sheet-skin-album .album-row').length,open:document.querySelectorAll('#sheet-skin-album .album-row.open').length,txt:(document.querySelector('#sheet-skin-album .album-row.open .album-txt')||{}).textContent||''})");
  ok(alb.rows === 3 && alb.open >= 1 && alb.txt.length > 20 && alb.txt.indexOf('story.') < 0,
     'her window holds three chapters, the first open with its story ("' + alb.txt.slice(0, 40) + '…")');
  await shot('05d-album');
  await clickFor('.sheet-x', null);
  await clickFor('#shop-grid [data-pick="aurora"]', '#sheet-skin');
  ok(await ev("document.getElementById('sheet-skin-btn').disabled"), 'and she cannot be bought');
  await shot('05c-aurora-locked');
  await clickFor('.sheet-x', null);
  await clickFor('#btn-back', '#screen-title');
  /* the same player with every trophy earned and paid */
  await ev("(function(){var s=JSON.parse(localStorage.getItem('icedash-save-v1'));" +
           "s.ach=ACHIEVEMENTS.map(function(a){return a.id;});s.claimed=s.ach.slice();" +
           "localStorage.setItem('icedash-save-v1',JSON.stringify(s));sessionStorage.setItem('fresh','1');Game.stop&&Game.stop();})();1");
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' }, sid);
  ok(await waitFor('#screen-title', 8000) && await visible('#market-badge'),
     'with every trophy earned, the Market says something is waiting');
  await clickFor('.row-three [data-action="trophies"]', '#screen-ach');
  ok(await visible('#prize-take'), 'and the prize at the top of Trophies offers her');
  await shot('06b-aurora-prize');
  await click('#prize-take');
  var svA = await readSave();
  ok(svA.owned.indexOf('aurora') >= 0 && svA.equipped === 'aurora', 'taking her puts her on (' + svA.equipped + ')');
  ok(!(await visible('#prize-take')) && /yours/i.test(await ev("document.getElementById('ach-prize').textContent")),
     'and the prize now says she is yours');
  await clickFor('#screen-ach [data-action="back-title"]', '#screen-title');
  await waitFor('#btn-free', 4000);                 // the title is still settling in
  ok(await clickFor('#btn-free', '#hud') >= 0 && (await ev("Game.debug().shield")) === 1,
     'she rides, and starts the run in a bubble as her perk says');
  await sleep(500);
  await shot('06c-aurora-riding');
  /* far down the hill and flat out, the camera has drawn back */
  await ev("(function(){var W=Game.debug();W.dist=26000;W.objects.length=0;W.invuln=99999;W.grace=99999;})();1");
  /* kept clear while the camera settles: with her reach she will otherwise
     sweep up a cold draught on the way, and the hill slows under it */
  for (var cl = 0; cl < 14; cl++) {
    await ev("(function(){var W=Game.debug();W.objects.length=0;W.chillT=0;W.bog=0;})();1");
    await sleep(180);
  }
  var zoom = await ev("Game.debug().zoom");
  ok(zoom < 0.96 && zoom > 0.9, 'flat out, the camera has drawn back (' + zoom.toFixed(3) + ')');
  var snow = await ev("Game._snow()");
  ok(snow > 0.5, 'and in Freeride the avalanche is felt behind him: a cold haze along the bottom (' + snow.toFixed(2) + ')');
  await shot('06d-camera-back');
  var trail = await ev("(function(){var t=Game.debug().trail;return {n:t.length,behind:t.length?Math.round(Game.debug().dist-t[0].d):0};})()");
  /* the eyes: a glance at a fish off to the right, then wide after a close call */
  /* only that fish on the hill, so it is the nearest; read on the very next frame */
  var look = await ev("(function(){var W=Game.debug();W.objects=W.objects.filter(function(o){return o.t!=='fish'&&o.t!=='gold';});" +
    "W.objects.push({t:'fish',x:W.px+120,d:W.dist+90,r:15,got:false,ph:0});Game._render();var e=Game._eye();return e?e.lx:null;})()");
  ok(look !== null && look > 0.3, 'he glances towards a fish off to his right (' + (look === null ? 'none' : look.toFixed(2)) + ')');
  await ev("Game.debug().closeT=45;1");
  await sleep(120);
  var wide = await ev("(function(){var e=Game._eye();return e?e.wide:null;})()");
  /* a perfect tap, staged: one opening a quarter of a second ahead, off to the side he taps towards */
  var perf = await ev("(async function(){var W=Game.debug();W.objects=[];W.closeT=0;W.dir=-1;W.vx=0;" +
    "var d=W.dist+W.speed*14;W.rows=[{d:d,gap:W.px+25-Game._chuteAt(d),gapW:220}];var n0=W.perfects;Game.tap();" +
    "for(var i=0;i<40&&Game.debug().perfects===n0;i++)await new Promise(function(r){setTimeout(r,16);});" +
    "return {n:Game.debug().perfects-n0,t:Game.debug().perfT};})()");
  ok(perf.n === 1 && perf.t > 0, 'a last-moment tap through an opening is a PERFECT (' + JSON.stringify(perf) + ')');
  await sleep(120);
  await shot('06e-perfect');
  ok(wide !== null && wide > 1.2, 'and his eyes go wide after a close call (' + (wide === null ? 'none' : wide.toFixed(2)) + ')');
  ok(trail.n > 10 && trail.behind > 100, 'and his belly has cut a groove behind him (' + trail.n + ' points, ' + trail.behind + ' units back)');
  await ev("Game.stop();1");

  await ev("sessionStorage.setItem('fresh','1');localStorage.removeItem('icedash-save-v1');Game.stop&&Game.stop();1");
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' }, sid);
  ok(await waitFor('#tut-card', 8000), 'a brand-new player is dropped straight into the tutorial');
  ok(!(await visible('#screen-title')) && await visible('#tut-skip'),
     'with no menu in the way, and a Skip button on screen');
  var first = await ev("document.getElementById('tut-text').textContent");
  ok(/tap anywhere/i.test(first), 'it asks for a tap before anything moves ("' + first + '")');
  var d0 = await ev("Game.debug().dist");
  await sleep(1200);
  ok((await ev("Game.debug().dist")) === d0, 'and the hill really is holding still');
  await shot('14-tut-start');
  await tapHill();
  var asked = false;
  for (var ti = 0; ti < 60 && !asked; ti++) {
    asked = await ev("(function(){var t=document.getElementById('tut-tap');" +
      "return !t.classList.contains('hidden')&&(t.classList.contains('to-left')||t.classList.contains('to-right'));})()");
    if (!asked) await sleep(150);
  }
  ok(asked, 'the first opening asks for a tap, with an arrow the way it will send him');
  await shot('15-tut-tap');

  /* Giving up from the pause screen starts the lesson over — it used to
     start Freeride, which a new player does not have yet. */
  await waitFor('#btn-menu', 4000);
  await clickFor('#btn-menu', '#screen-pause');
  await clickFor('#screen-pause [data-action="play"]', '#tut-card');
  var again = await ev("(Game.debug()&&Game.debug().course&&Game.debug().course.id)+'|'+document.getElementById('tut-text').textContent");
  ok(/^tutorial\|.*tap anywhere/i.test(again), 'giving up from pause starts the tutorial over (' + again.split('|')[0] + ')');
  await tapHill();

  if (P.name.indexOf('desktop') === 0) {
    /* Ride it to the end the way a new player would: tap when the ring
       asks, otherwise leave it alone — the crashes that follow are part of
       what is being checked, since nothing in here may end the run. */
    var done = false, taps = 0;
    for (var tw = 0; tw < 2400 && !done; tw++) {
      if (await visible('#screen-tutdone')) { done = true; break; }
      if (await ev("!document.getElementById('tut-tap').classList.contains('hidden')")) {
        await tapHill(); taps++; await sleep(250);
      } else await sleep(100);
    }
    ok(done, 'riding it through ends on the "you are ready" card (' + taps + ' asked-for taps)');
    var sv = await readSave();
    ok(sv.tutDone === true, 'and the save remembers it was done');
    await shot('16-tut-done');
    ok(await clickFor('#tutdone-go', '#hud') >= 0, 'the card leads straight into a real line');
    ok(await ev("Game.debug()&&Game.debug().course&&Game.debug().course.id") === 'firstlight',
       'which is First Light');
    ok(!(await visible('#tut-skip')), 'with no tutorial chrome left over');
    /* Finishing First Light opens the other modes, and says so. */
    await ev("(function(){var W=Game.debug();W.state='finish';W.endT=0;})();1");
    ok(await waitFor('#over-unlock', 8000), 'finishing First Light announces the modes it opens (' +
       (await ev("document.getElementById('over-unlock').textContent")) + ')');
    await shot('16b-unlocked');
    await clickFor('#screen-over [data-action="back-title"]', '#screen-title');
    ok(await ev("document.getElementById('btn-more').classList.contains('just-opened') && !document.getElementById('btn-rush').disabled"),
       'and on the title the new modes light up, open');
    await shot('16c-title-opened');
  } else {
    ok(await clickFor('#tut-skip', '#screen-title') >= 0, 'Skip leaves it for the title');
    ok((await readSave()).tutDone === true, 'and the save remembers it was skipped');
  }
  await ev("Game.stop&&Game.stop();1");
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' }, sid);
  for (var tr = 0; tr < 60 && !(await visible('#screen-title')); tr++) await sleep(200);
  ok(await visible('#screen-title') && !(await visible('#tut-card')),
     'and coming back, it is not shown again');

  /* Neon, the newest stretch, on its own marked line */
  await ev("(function(){document.querySelectorAll('.screen').forEach(function(e){e.classList.add('hidden');});" +
           "Game.stop();Game.start(0,{over:function(){}},'snowcap','neonnights',0);var W=Game.debug();W.invuln=99999;W.grace=99999;})();1");
  await sleep(1600);
  var nb = await ev("(function(){var W=Game.debug();return {biome:W.biome,name:BIOMES[W.biome].name,course:W.course&&W.course.id};})()");
  ok(nb.name === 'Neon' && nb.course === 'neonnights', 'Neon Nights rides in the Neon stretch (' + JSON.stringify(nb) + ')');
  await shot('20-neon');
  await ev("Game.stop();1");

  /* Every stretch's tune, played for a moment in a real AudioContext. */
  var tunes = await ev("(async function(){Sfx.unlock&&Sfx.unlock();Sfx.music(true);var n=0;" +
    "for(var i=0;i<BIOMES.length;i++){Sfx.mood(BIOMES[i].mood||'base');n++;await new Promise(function(r){setTimeout(r,250);});}" +
    "Sfx.music(false);return n;})()");
  ok(tunes === 14, 'every stretch\'s tune plays in the browser (' + tunes + ' of 14)');

  ok(errs.length === 0, 'nothing on the console (' + (errs.length ? errs.join(' | ') : 'clean') + ')');
  ok(retries <= 3, 'the interface answers the first tap (' + retries +
                   ' tap(s) had to be repeated)');
  return errs;
}

(async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  var only = process.argv[2];
  var server = await serve();
  var profile = fs.mkdtempSync(path.join(os.tmpdir(), 'icedash-chrome-'));
  var br = chrome(profile);
  var cdp = null;
  try {
    var url = await wsTarget();
    cdp = CDP(url); await cdp.ready;
    for (var key in PLATFORMS) {
      if (only && key !== only) continue;
      var t = await cdp.send('Target.createTarget', { url: 'about:blank' });
      var at = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      await walk(cdp, at.sessionId, PLATFORMS[key]);
      await cdp.send('Target.closeTarget', { targetId: t.targetId });
    }
  } finally {
    if (cdp) cdp.close();
    br.kill(); server.close();
  }
  console.log('\nscreenshots in ' + SHOTS);
  if (fail) { console.log('\n' + fail + ' FAILURE(S)'); process.exit(1); }
  console.log('\nplaytest passed');
})().catch(function (e) { console.error('playtest blew up: ' + e.message); process.exit(1); });
