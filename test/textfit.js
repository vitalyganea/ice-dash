/* ===========================================================
   textfit.js — every word fits, in every language, on every width
   -----------------------------------------------------------
   Real Chrome walks every menu screen, tab and sheet in all six
   languages at three phone widths and a desktop window, and looks at
   every piece of text on the page:
     - spilling out of its button, pill, tab or price tag,
     - cut off by a box that clips it, or shortened with "…",
     - running off the side of the screen,
     - a button's words wrapping onto a third line.
   Each problem is listed with the screen, the element and its text, and
   a screenshot with the offenders outlined in red is written to
   test/out/textfit/. Text too faint for its ground is listed too
   (WCAG contrast, where the ground is a plain colour or a button face).
   The words painted on the canvas (the HUD, PERFECT!, a stretch's name)
   are measured against the room the HUD gives them at each phone width.

     node test/textfit.js              all languages, all widths
     node test/textfit.js de 360       one language, one width
     SHOTS=1 node test/textfit.js ...  also a picture of every screen that passed
   =========================================================== */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
var ROOT = path.join(__dirname, '..');
var OUT = path.join(__dirname, 'out', 'textfit');
var PORT = +process.env.PORT || 8197, DPORT = +process.env.DPORT || 9247;
var LANGS = ['en', 'ru', 'ro', 'es', 'pt', 'de'];
var WIDTHS = [[360, 780, 3, true], [390, 844, 3, true], [412, 915, 2.6, true], [1280, 800, 1, false]];
var args = process.argv.slice(2);
if (args[0]) LANGS = [args[0]];
if (args[1]) WIDTHS = WIDTHS.filter(function (w) { return String(w[0]) === args[1]; });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
              '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise(function (res) {
    var s = http.createServer(function (q, r) {
      var u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
      var f = path.join(ROOT, u);
      if (f.indexOf(ROOT) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      if (u === '/index.html') {   // no YouTube SDK here: the page falls back to localStorage
        r.end(fs.readFileSync(f, 'utf8').split('\n').filter(function (l) { return !/youtube\.com\/game_api/.test(l); }).join('\n'));
        return;
      }
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
    send: function (method, params) { var n = ++id; return new Promise(function (res, rej) {
      waits[n] = function (m) { m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); };
      ws.send(JSON.stringify({ id: n, method: method, params: params || {} })); }); } };
}

/* What a screen is reached by: the game's own buttons (a made-up button
   with that data-action, clicked), then a tab inside it if any. */
var SCREENS = [
  ['title'], ['help', 'help'], ['modes', 'modes'], ['runs', 'runs'],
  ['shop-creatures', 'shop', '[data-stab="cr"]'], ['shop-frames', 'shop', '[data-stab="fr"]'],
  ['shop-upgrades', 'shop', '[data-stab="up"]'],
  ['skin-sheet-owned', 'shop', '#shop-grid [data-pick="mitten"]'],
  ['skin-sheet-locked', 'shop', '#shop-grid [data-pick="reindeer"]'],
  ['trophies', 'trophies'], ['settings', 'settings'], ['lang-sheet', 'settings', '#lang-open'],
  ['profile-avatar', 'profile', '[data-ptab="av"]'], ['profile-frames', 'profile', '[data-ptab="fr"]'],
  ['profile-titles', 'profile', '[data-ptab="ti"]'], ['profile-medals', 'profile', '[data-ptab="me"]'],
  ['dragon', 'dragon'], ['event', 'event'], ['pause', 'PAUSE'],
  ['comic', 'shop', ['#shop-grid [data-pick="mitten"]', '#sheet-skin-comic']],
  /* a run left to crash on its own: the revive (the save has lives), then the results */
  ['revive', 'CRASH'], ['over', 'CRASH', '[data-action="no-life"]']
];

/* Runs in the page: every problem with the text now on screen. */
var CHECK = function () {
  var BOX = /(^|\s|-)(btn|pill|tab|chip|tag|badge|price|purse|ribbon|pcard-title|up-buy|stat)/;
  var W = innerWidth, out = [], seen = new Set();
  function vis(el) {
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : !!el.offsetParent;
  }
  function boxOf(el) {
    for (var a = el; a && a !== document.body; a = a.parentElement) {
      if (a.tagName === 'BUTTON' || BOX.test(a.className && a.className.baseVal === undefined ? a.className : '')) return a;
    }
    return null;
  }
  function clipper(el) {
    for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') return a;
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return 'scroll';
    }
    return null;
  }
  function rgb(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function hex(h) {
    h = h.trim(); if (h[0] !== '#') return rgb(h);
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 1];
  }
  function lum(c) {
    var v = c.slice(0, 3).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function groundOf(el) {
    for (var a = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      var st = getComputedStyle(a);
      var face = st.getPropertyValue('--face');
      if (face && /btn/.test(a.className) && st.backgroundImage !== 'none') return hex(face).slice(0, 3);
      if (st.backgroundImage !== 'none' && !/url\(/.test(st.backgroundImage)) return null;   // a gradient: unknown
      var c = rgb(st.backgroundColor);
      if (c && c[3] >= 0.85) return c.slice(0, 3);
      if (c && c[3] > 0.15) return null;                                     // see-through: unknown
    }
    return null;
  }
  function name(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  }
  function flag(el, why, text) {
    var key = why + '|' + name(el) + '|' + text;
    if (seen.has(key)) return; seen.add(key);
    el.setAttribute('data-textfit', '1');
    out.push({ why: why, el: name(el), text: text.slice(0, 60) });
  }
  var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (var n = tw.nextNode(); n; n = tw.nextNode()) {
    var text = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    var el = n.parentElement;
    if (!el || /^(SCRIPT|STYLE|OPTION)$/.test(el.tagName) || !vis(el)) continue;
    var r = document.createRange(); r.selectNodeContents(n);
    var rects = Array.prototype.filter.call(r.getClientRects(), function (q) { return q.width > 0.5; });
    if (!rects.length) continue;
    var L = Math.min.apply(null, rects.map(function (q) { return q.left; })),
        R = Math.max.apply(null, rects.map(function (q) { return q.right; })),
        T = Math.min.apply(null, rects.map(function (q) { return q.top; })),
        B = Math.max.apply(null, rects.map(function (q) { return q.bottom; }));
    /* shortened with an ellipsis */
    var cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) flag(el, 'cut with …', text);
    /* out of its button, pill or tab */
    var bx = boxOf(el);
    if (bx) {
      var b = bx.getBoundingClientRect();
      if (L < b.left - 1 || R > b.right + 1 || T < b.top - 2 || B > b.bottom + 2) flag(bx, 'spills out of its box', text);
      if (bx.tagName === 'BUTTON' && el === bx || (bx.tagName === 'BUTTON' && el.parentElement === bx && el.tagName !== 'SMALL')) {
        var tops = {}; rects.forEach(function (q) { tops[Math.round(q.top / 4)] = 1; });
        var lines = Object.keys(tops).length;
        if (lines >= 3) flag(bx, 'button text on ' + lines + ' lines', text);
      }
    }
    /* clipped by a box that hides what overflows */
    var cl = clipper(el);
    if (cl && cl !== 'scroll') {
      var c = cl.getBoundingClientRect();
      if (R > c.right + 1 || L < c.left - 1) flag(el, 'clipped', text);
    }
    /* too faint against what it stands on (WCAG: 4.5:1, or 3:1 for big or
       bold text). Only where the ground is a known colour: a plain
       background, or a button's face; text over the hill is skipped. */
    var bg = groundOf(el);
    if (bg && cs.color) {
      var fg = rgb(cs.color);
      if (fg && fg[3] > 0.5) {
        var ratio = contrast(fg, bg), px = parseFloat(cs.fontSize), wt = parseInt(cs.fontWeight, 10) || 400;
        var need = (px >= 24 || (px >= 18.5 && wt >= 700) || !/[\p{L}\p{N}]/u.test(text)) ? 3 : 4.5;   // a lone ★ ✓ ! is a picture: 3:1
        if (ratio < need - 0.05) flag(el, 'low contrast ' + ratio.toFixed(1) + ':1 (' + cs.color + ' on ' + bg.join(',') + ')', text);
      }
    }
    /* off the side of the screen */
    if (cl !== 'scroll' && (R > W + 1 || L < -1)) flag(el, 'off the screen', text);
  }
  return out;
};

/* Runs in the page: the HUD's words, in the HUD's own sizes (game.js
   hud(): u from the screen, the score as wide as 88888, the combo pill
   2.5u), against where the pause button starts. PERFECT! and CLOSE! are
   slid onto the screen by game.js (onScreenX), so they only fail if wider
   than it. */
var HUDCHECK = async function (L) {
  await document.fonts.ready;
  var CW = innerWidth, CH = innerHeight, u = Math.max(13, Math.min(22, Math.min(CW, CH) / 26));
  var F = 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif', out = [];
  var c = document.createElement('canvas').getContext('2d');
  function m(s, px) { c.font = '800 ' + px + F; return c.measureText(s).width; }
  var pb = document.getElementById('btn-menu');
  var right = CW - 12 - Math.max(44, pb ? pb.getBoundingClientRect().width : 44) - 6;
  var keep = getLang(); setLang(L);
  try {
    var after = 12 + u * 0.15 + m('88888', Math.round(u * 1.95)) + u * 0.5 + u * 2.5;
    [['hud.combo', ' x3', 1.0], ['hud.comboLost', '', 0.9]].forEach(function (k) {
      var s = t(k[0]) + k[1], end = after + m(s, Math.round(u * k[2]));
      if (end > right) out.push({ why: 'runs under the pause button (' + Math.round(end) + ' > ' + Math.round(right) + ')', text: s });
    });
    for (var b = 0; b < 40; b++) {
      var z = t('biome.' + b, null, ''); if (!z || z === 'biome.' + b) continue;
      if (m(z, Math.round(u * 1.5)) > CW - 24) out.push({ why: 'stretch name wider than the screen', text: z });
    }
    [['hud.perfect', ' \u00d79', 30 * 1.4], ['hud.close', ' \u00d72', 26]].forEach(function (k) {
      var s = t(k[0]) + k[1]; if (m(s, k[2]) > CW - 16) out.push({ why: 'wider than the screen', text: s });
    });
  } finally { setLang(keep); }
  return out;
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  var server = await serve();
  var prof = fs.mkdtempSync(path.join(require('os').tmpdir(), 'textfit-'));
  var ch = cp.spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + prof, 'about:blank'],
    { stdio: 'ignore' });
  var t = null;
  for (var i = 0; i < 80 && !t; i++) {
    try { t = (await getJSON('http://127.0.0.1:' + DPORT + '/json/list')).find(function (x) { return x.type === 'page'; }); } catch (e) {}
    if (!t) await sleep(250);
  }
  var cdp = CDP(t.webSocketDebuggerUrl); await cdp.ready;
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  async function ev(x) {
    var r = await cdp.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(x.slice(0, 80) + ' -> ' + r.exceptionDetails.text);
    return r.result.value;
  }
  var all = [], scripted = null, reached = {};
  for (var li = 0; li < LANGS.length; li++) {
    for (var wi = 0; wi < WIDTHS.length; wi++) {
      var L = LANGS[li], Wd = WIDTHS[wi];
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: Wd[0], height: Wd[1], deviceScaleFactor: Wd[2], mobile: Wd[3] });
      /* a player some way in: the market, trophies and profile have rows */
      var save = { best: 4200, runs: 30, sfx: false, music: false, fish: 3000, gold: 6, lang: L,
        owned: ['snowcap', 'mitten', 'seal', 'puffin'], equipped: 'seal', ach: ['first'], totFish: 900,
        bestDist: 980, courses: { firstlight: 2 }, tutDone: true, lives: 2 };
      if (scripted) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scripted });
      scripted = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source:
        "try{localStorage.setItem('icedash-save-v1'," + JSON.stringify(JSON.stringify(save)) + ")}catch(e){}" })).identifier;
      await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' });
      await sleep(3200);
      for (var si = 0; si < SCREENS.length; si++) {
        var S = SCREENS[si];
        await ev("(function(){document.querySelectorAll('[data-textfit]').forEach(function(e){e.removeAttribute('data-textfit')});" +
          "var b=document.querySelector('.sheet:not(.hidden) [data-action=close-sheet]'); if(b) b.click();" +
          "if (window.Game && Game.isRunning && Game.isRunning()) { Game.stop && Game.stop(); }" +
          "var x=document.createElement('button'); x.setAttribute('data-action','back-title'); document.body.appendChild(x); x.click(); x.remove(); return 1})()");
        await sleep(250);
        if (S[1] === 'CRASH') {
          await ev("(function(){var x=document.createElement('button');x.setAttribute('data-action','play');document.body.appendChild(x);x.click();x.remove();return 1})()");
          await sleep(800);
          await ev("(function(){var c=document.querySelector('.sheet:not(.hidden) [data-action=close-sheet]'); if(c) c.click(); return 1})()");
          for (var k = 0; k < 120; k++) {
            if (await ev("!!document.querySelector('#screen-revive:not(.hidden),#screen-over:not(.hidden)')")) break;
            await sleep(500);
          }
        } else if (S[1] === 'PAUSE') {
          await ev("(function(){var x=document.createElement('button');x.setAttribute('data-action','play');document.body.appendChild(x);x.click();x.remove();return 1})()");
          await sleep(1500);
          await ev("(function(){var c=document.querySelector('.sheet:not(.hidden) [data-action=close-sheet]'); if(c) c.click(); var m=document.getElementById('btn-menu'); if(m) m.click(); return 1})()");
          await sleep(500);
        } else if (S[1]) {
          await ev("(function(){var x=document.createElement('button');x.setAttribute('data-action','" + S[1] + "');document.body.appendChild(x);x.click();x.remove();return 1})()");
          await sleep(500);
        }
        var clicks = S[2] ? [].concat(S[2]) : [], got = 1;
        for (var ci = 0; ci < clicks.length && got; ci++) {
          got = await ev("(function(){var e=document.querySelector(" + JSON.stringify(clicks[ci]) + ");if(!e)return 0;e.scrollIntoView({block:'center'});e.click();return 1})()");
          await sleep(ci === clicks.length - 1 ? 900 : 450);
        }
        if (!got) continue;
        var shown = await ev("(function(){var s=document.querySelector('.screen:not(.hidden)');return s?s.id:''})()");
        if (S[0] !== 'title' && S[0] !== 'pause' && shown === 'screen-title' && !/sheet/.test(S[0])) continue;   // not offered to this player (an event over)
        reached[S[0]] = (reached[S[0]] || 0) + 1;
        var probs = await ev('(' + CHECK.toString() + ')()');
        if (process.env.SHOTS && !probs.length) {   // SHOTS=1: a picture of every screen, to see it was reached
          var sh0 = await cdp.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(OUT, 'ok-' + L + '-' + Wd[0] + '-' + S[0] + '.png'), Buffer.from(sh0.data, 'base64'));
        }
        if (probs.length) {
          await ev("(function(){var st=document.getElementById('tf-style')||document.createElement('style');st.id='tf-style';" +
            "st.textContent='[data-textfit]{outline:3px solid #ff1744!important;outline-offset:1px}';document.head.appendChild(st);" +
            "var f=document.querySelector('[data-textfit]'); if(f) f.scrollIntoView({block:'center'}); return 1})()");
          await sleep(120);
          var file = L + '-' + Wd[0] + '-' + S[0] + '.png';
          var shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(OUT, file), Buffer.from(shot.data, 'base64'));
          probs.forEach(function (p) { p.lang = L; p.width = Wd[0]; p.screen = S[0]; p.shot = file; all.push(p); });
        }
      }
      /* the words painted on the hill (the HUD, PERFECT!, a stretch's
         name) are not in the page: they are measured in its font against
         the room the HUD gives them at this width */
      if (Wd[3]) {
        var hud = await ev('(' + HUDCHECK.toString() + ')(' + JSON.stringify(L) + ')');
        hud.forEach(function (p) { p.lang = L; p.width = Wd[0]; p.screen = 'hud'; p.el = 'canvas'; p.shot = ''; all.push(p); });
      }
      process.stdout.write('  ' + L + ' ' + Wd[0] + ': ' + all.filter(function (p) { return p.lang === L && p.width === Wd[0]; }).length + ' problem(s)\n');
    }
  }
  console.log('  screens checked: ' + SCREENS.map(function (S) { return S[0] + (reached[S[0]] ? '' : ' (not reached)'); }).join(', '));
  cdp.close(); ch.kill(); server.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(all, null, 1));
  /* the same problem at several widths is listed once, with its widths */
  var byKey = {};
  all.forEach(function (p) {
    var k = p.lang + '|' + p.screen + '|' + p.why + '|' + p.el + '|' + p.text;
    (byKey[k] = byKey[k] || Object.assign({}, p, { widths: [] })).widths.push(p.width);
  });
  Object.keys(byKey).forEach(function (k) {
    var p = byKey[k];
    console.log('  FAIL ' + p.lang + ' ' + p.screen + ' [' + p.widths.join(',') + ']: ' + p.why + ' — ' + p.el + ' "' + p.text + '"');
  });
  console.log('\n' + (all.length ? Object.keys(byKey).length + ' PROBLEM(S), screenshots in test/out/textfit/' : 'every word fits'));
  process.exit(all.length ? 1 : 0);
}
main().catch(function (e) { console.error(e); process.exit(2); });
