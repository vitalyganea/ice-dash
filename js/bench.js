/* ===========================================================
   bench.js — the hill's own performance test (test.html only)
   -----------------------------------------------------------
   Asked for by the owner, 24 Nov 2026: a page anyone can open on their own
   phone, where a bot rides Freeride by itself for some 100,000 m and the
   page measures how smoothly the hill runs on that screen, 60, 90 or
   120 Hz. Never shipped with the game: it is not in build.sh's FILES, and
   test.html loads the game's own files without ui.js, so there is no menu,
   no save and no sound; the player's progress on the same site is never
   read or touched.

   Every frame the browser shows is timed (its requestAnimationFrame stamp),
   kept as a histogram (constant memory however long the run), and summed
   per ten seconds and per stretch of hill. A frame counts as late when it
   took more than one and a half of the screen's own refresh.

   URL: ?m=100000 the distance in metres (1,000 at least), ?skin=dragon the
   creature. The result can be copied, or sent (on a tap, never by itself)
   to the board server's /v1/bench.
   =========================================================== */
(function () {
  'use strict';
  var Q = (function () { var o = {}; location.search.replace(/^\?/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); return o; })();
  var GOAL_M = Math.max(1000, Math.min(1000000, parseInt(Q.m, 10) || 100000));
  var SKIN = /^[a-z]+$/.test(Q.skin || '') ? Q.skin : 'snowcap';
  var SEND_URL = 'https://board.icedasher.workers.dev/v1/bench';
  var RO = /^ro/i.test(navigator.language || '');
  var TXT = RO ? {
    title: 'Ice Dasher — test de performanță',
    intro: 'Un bot coboară singur pe pârtie ' + fmt(GOAL_M) + ' m (cam ' + Math.round(GOAL_M / 2600) + ' min) și măsoară cât de fluid merge jocul pe ecranul tău. Nu se salvează nimic în joc. Ține pagina deschisă; ecranul rămâne aprins.',
    start: 'Pornește testul', stop: 'Oprește', send: 'Trimite rezultatele', copy: 'Copiază', again: 'Din nou',
    hz: 'Ecran', fps: 'Cadre/s', late: 'Cadre întârziate', dist: 'Distanță', time: 'Timp', tier: 'Grafică',
    full: 'completă', lower: 'redusă cu ', steps: ' trepte',
    measuring: 'Măsor ecranul…', done: 'Gata.', sent: 'Trimis, mulțumesc! Nr. ', sendFail: 'Nu s-a putut trimite. Încearcă din nou.',
    sendNote: 'Se trimit doar: tipul de telefon și browser, ecranul, numele plăcii grafice și timpii măsurați. Nimic personal.',
    copied: 'Copiat.', smooth: 'Fluiditate', freeze: 'Cea mai lungă blocare', p95: '95% din cadre sub'
  } : {
    title: 'Ice Dasher — performance test',
    intro: 'A bot rides the hill by itself for ' + fmt(GOAL_M) + ' m (about ' + Math.round(GOAL_M / 2600) + ' min) and measures how smoothly the game runs on your screen. Nothing is saved in the game. Keep this page open; the screen stays on.',
    start: 'Start the test', stop: 'Stop', send: 'Send the results', copy: 'Copy', again: 'Again',
    hz: 'Screen', fps: 'Frames/s', late: 'Late frames', dist: 'Distance', time: 'Time', tier: 'Graphics',
    full: 'full', lower: 'lowered ', steps: ' steps',
    measuring: 'Measuring the screen…', done: 'Done.', sent: 'Sent, thank you! No. ', sendFail: 'Could not send. Try again.',
    sendNote: 'Only this is sent: the kind of phone and browser, the screen, the graphics chip\'s name and the timings. Nothing personal.',
    copied: 'Copied.', smooth: 'Smoothness', freeze: 'Longest freeze', p95: '95% of frames under'
  };
  function $(id) { return document.getElementById(id); }
  function clock(secs) { return Math.floor(secs / 60) + ':' + ('0' + Math.floor(secs % 60)).slice(-2); }
  /* the game's own graphics ladder (game.js LADDER): 0 is everything on,
     each step down is the game easing off on a phone that cannot keep up */
  function tierWords(tr) { var n = parseInt(String(tr || '0'), 10) || 0; return n ? TXT.lower + n + (n > 1 ? TXT.steps : '') : TXT.full; }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  /* ---- the screen's refresh: the median frame before anything runs ---- */
  var HZ_STEPS = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
  function measureHz(done) {
    var ts = [], last = 0, n = 0;
    function f(t) {
      if (last) ts.push(t - last);
      last = t;
      if (++n < 150) requestAnimationFrame(f);
      else {
        ts.sort(function (a, b) { return a - b; });
        var med = ts[ts.length >> 1] || 16.7, hz = 1000 / med, best = 60, bd = 1e9;
        HZ_STEPS.forEach(function (h) { var d = Math.abs(h - hz); if (d < bd) { bd = d; best = h; } });
        done(best, med);
      }
    }
    requestAnimationFrame(f);
  }

  /* ---- the bot: the tests' good player (test/longrun.js), unkillable ---- */
  var K = null, steerT = -1, coolUntil = 0, revives = 0;
  function nextRow(W) { for (var i = 0; i < W.rows.length; i++) if (W.rows[i].d > W.dist + 30) return W.rows[i]; return null; }
  function miss(W, dir, fr, target) {
    var x = W.px, v = W.vx, tr = Game._turnRate();
    for (var k = 0; k < fr; k++) { v += (dir * K.DRIFT * W.speed - v) * tr; x += v; }
    return Math.abs(x - target);
  }
  function drive(W) {
    W.invuln = 1e6; W.grace = 1e6;
    if (W.state !== 'run') { W.lives = 9; if (Game.revive && Game.revive() !== false) revives++; return; }
    if (W.t === steerT || W.t < coolUntil) return;
    steerT = W.t;
    var row = nextRow(W); if (!row) return;
    var target = Game._chuteAt(row.d) + row.gap, fr = Math.max(1, Math.min(160, Math.round((row.d - W.dist) / Math.max(0.5, W.speed))));
    if (miss(W, -W.dir, fr, target) < miss(W, W.dir, fr, target) - 6) { Game.tap(); coolUntil = W.t + 8; }
  }

  /* ---- the measurement ---- */
  var BIN = 0.25, NB = 1000;                       // 0.25 ms bins up to 250 ms, then one for the rest
  var R = null;                                    // the run being measured
  function newRun(hz, refreshMs) {
    return { hz: hz, refresh: refreshMs, hist: new Uint32Array(NB + 1), frames: 0, sum: 0, late: 0, dropped: 0,
             f100: 0, f250: 0, worst: [], win: null, timeline: [], biomes: {}, tiers: [], t0: 0, last: 0,
             gaps: 0, gapMs: 0, pics0: 0, biome: '', tier: null, secLast: 0, stopped: false };
  }
  function pct(R, p) {
    var want = R.frames * p, acc = 0;
    for (var i = 0; i <= NB; i++) { acc += R.hist[i]; if (acc >= want) return Math.round((i + 0.5) * BIN * 10) / 10; }
    return 250;
  }
  function biomeName() { try { var B = Game._buildPal(); return (B && B.name) || ''; } catch (e) { return ''; } }
  function tierNow() { try { var q = Game.qualityNow(); return q.tier + '/' + q.res + '/' + q.fx; } catch (e) { return ''; } }
  function closeWin(R, W, t) {
    var w = R.win; if (!w || !w.n) return;
    var pics = Game._drawn ? Game._drawn().n : 0;
    R.timeline.push([Math.round((t - R.t0) / 100) / 10, Math.round(W.dist / 8), Math.round(1000 * w.n / w.sum * 10) / 10,
                     Math.round(1000 * w.late / w.n) / 10, Math.round(w.max), Math.round((pics - w.pics) * 1000 / w.sum), R.tier, R.biome]);
    R.win = null;
  }
  function frame(t) {
    if (!R || R.stopped) return;
    requestAnimationFrame(frame);
    var W = Game.debug();
    if (!W) return;
    drive(W);
    if (!R.last) { R.last = t; R.t0 = t; R.pics0 = Game._drawn ? Game._drawn().n : 0; return; }
    var dt = t - R.last; R.last = t;
    /* the page out of sight, or the phone asleep: not the game's fault */
    if (dt > 1000) { R.gaps++; R.gapMs += dt; return; }
    R.frames++; R.sum += dt;
    R.hist[Math.min(NB, Math.floor(dt / BIN))]++;
    var late = dt > R.refresh * 1.5;
    if (late) { R.late++; R.dropped += Math.max(0, Math.round(dt / R.refresh) - 1); }
    if (dt > 100) R.f100++;
    if (dt > 250) R.f250++;
    if (dt > 50) {
      R.worst.push([Math.round(dt), Math.round(W.dist / 8), R.biome]);
      R.worst.sort(function (a, b) { return b[0] - a[0]; });
      if (R.worst.length > 10) R.worst.length = 10;
    }
    if (!R.win) R.win = { n: 0, sum: 0, late: 0, max: 0, t: t, pics: Game._drawn ? Game._drawn().n : 0 };
    var w = R.win; w.n++; w.sum += dt; if (late) w.late++; if (dt > w.max) w.max = dt;
    var bs = R.biomes[R.biome] || (R.biomes[R.biome] = { n: 0, sum: 0, late: 0 });
    bs.n++; bs.sum += dt; if (late) bs.late++;
    if (t - R.secLast > 1000) {                   // once a second: the stretch, the graphics, the screen
      R.secLast = t;
      R.biome = biomeName();
      var tr = tierNow();
      if (tr !== R.tier) { R.tiers.push([Math.round((t - R.t0) / 1000), Math.round(W.dist / 8), tr]); R.tier = tr; }
      show(W, t);
    }
    if (t - w.t >= 10000) closeWin(R, W, t);
    if (W.dist / 8 >= GOAL_M) finish(true);
  }

  /* ---- the page ---- */
  var wake = null;
  function keepAwake() {
    try { if (navigator.wakeLock && (!wake || wake.released)) navigator.wakeLock.request('screen').then(function (l) { wake = l; }, function () {}); } catch (e) {}
  }
  function show(W, t) {
    var secs = (t - R.t0) / 1000;
    $('b-hz').textContent = R.hz + ' Hz';
    $('b-fps').textContent = R.frames ? (Math.round(1000 * R.frames / R.sum * 10) / 10) : '–';
    $('b-late').textContent = R.frames ? (Math.round(1000 * R.late / R.frames) / 10) + '%' : '–';
    $('b-dist').textContent = fmt(W.dist / 8) + ' / ' + fmt(GOAL_M) + ' m';
    $('b-time').textContent = clock(secs);
    $('b-tier').textContent = tierWords(R.tier);
    $('b-bar').style.width = Math.min(100, W.dist / 8 / GOAL_M * 100) + '%';
  }
  function device() {
    var gpu = '';
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) { var e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 120); }
    } catch (e) {}
    return { ua: navigator.userAgent.slice(0, 300), plat: navigator.platform || '', lang: (navigator.language || '').slice(0, 12),
             screen: screen.width + 'x' + screen.height, view: innerWidth + 'x' + innerHeight, dpr: window.devicePixelRatio || 1,
             cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0, touch: navigator.maxTouchPoints || 0, gpu: gpu };
  }
  var result = null;
  function finish(reached) {
    if (!R || R.stopped) return;
    var W = Game.debug();
    if (W) closeWin(R, W, R.last);
    R.stopped = true;
    try { if (wake) wake.release(); } catch (e) {}
    var biomes = {};
    Object.keys(R.biomes).forEach(function (k) {
      var b = R.biomes[k]; if (b.n < 30) return;
      biomes[k || '?'] = { fps: Math.round(1000 * b.n / b.sum * 10) / 10, late: Math.round(1000 * b.late / b.n) / 10, secs: Math.round(b.sum / 1000) };
    });
    var heap = (performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0;
    result = {
      v: 1, page: location.host + location.pathname, built: document.lastModified, skin: SKIN, goal: GOAL_M, reached: !!reached,
      m: W ? Math.round(W.dist / 8) : 0, secs: Math.round(R.sum / 1000), hz: R.hz, refresh: Math.round(R.refresh * 100) / 100,
      frames: R.frames, fps: Math.round(1000 * R.frames / R.sum * 10) / 10,
      p50: pct(R, 0.5), p95: pct(R, 0.95), p99: pct(R, 0.99), late: Math.round(1000 * R.late / R.frames) / 10,
      dropped: R.dropped, f100: R.f100, f250: R.f250, worst: R.worst, gaps: R.gaps, gapSecs: Math.round(R.gapMs / 1000),
      revives: revives, tiers: R.tiers, biomes: biomes, timeline: R.timeline, heapMB: heap, device: device()
    };
    $('b-run').classList.add('hidden');
    $('b-end').classList.remove('hidden');
    $('b-sum').innerHTML = '';
    [[TXT.hz, result.hz + ' Hz'], [TXT.fps, result.fps], [TXT.smooth, (100 - result.late).toFixed(1) + '%'],
     [TXT.p95, result.p95 + ' ms'], [TXT.freeze, (result.worst[0] ? result.worst[0][0] : Math.round(pct(R, 1))) + ' ms'],
     [TXT.dist, fmt(result.m) + ' m'], [TXT.time, clock(result.secs)], [TXT.tier, tierWords(R.tier)]].forEach(function (r) {
      var li = document.createElement('li'); li.innerHTML = '<span></span><b></b>';
      li.firstChild.textContent = r[0]; li.lastChild.textContent = r[1]; $('b-sum').appendChild(li);
    });
    $('b-status').textContent = TXT.done;
  }
  function begin() {
    $('b-start').disabled = true;
    $('b-status').textContent = TXT.measuring;
    keepAwake();
    measureHz(function (hz, med) {
      if (window.Sfx) { try { Sfx.sound(false); if (Sfx.music) Sfx.music(false); } catch (e) {} }
      var gifts = typeof liveEvent === 'function' && !!liveEvent();
      Game.start(0, { hud: function () {}, over: function () {} }, SKIN, null, 0, { gifts: gifts });
      K = Game._consts();
      R = newRun(hz, med);
      $('b-intro').classList.add('hidden');
      $('b-run').classList.remove('hidden');
      $('b-status').textContent = '';
      requestAnimationFrame(frame);
      setInterval(keepAwake, 30000);
    });
  }
  function send() {
    if (!result) return;
    var b = $('b-send'); b.disabled = true;
    var x = new XMLHttpRequest();
    x.open('POST', SEND_URL); x.setRequestHeader('content-type', 'application/json');
    x.onload = function () {
      var ok = x.status === 200, id = '';
      try { id = JSON.parse(x.responseText).id; } catch (e) {}
      $('b-status').textContent = ok ? TXT.sent + id : TXT.sendFail;
      b.disabled = ok;
    };
    x.onerror = function () { $('b-status').textContent = TXT.sendFail; b.disabled = false; };
    x.send(JSON.stringify(result));
  }
  function copy() {
    var s = JSON.stringify(result, null, 1);
    function said() { $('b-status').textContent = TXT.copied; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(said, function () {});
    else { var ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); said(); } catch (e) {} ta.remove(); }
  }
  window.addEventListener('load', function () {
    document.title = TXT.title;
    $('b-title').textContent = TXT.title;
    $('b-intro-text').textContent = TXT.intro;
    $('b-start').textContent = TXT.start;
    $('b-stop').textContent = TXT.stop;
    $('b-send').textContent = TXT.send;
    $('b-copy').textContent = TXT.copy;
    $('b-again').textContent = TXT.again;
    $('b-note').textContent = TXT.sendNote;
    ['hz', 'fps', 'late', 'dist', 'time', 'tier'].forEach(function (k) { $('l-' + k).textContent = TXT[k]; });
    $('b-start').addEventListener('click', begin);
    try { Game.attract(SKIN); } catch (e) {}                   // the hill behind the panel, as behind the title
    $('b-stop').addEventListener('click', function () { finish(false); });
    $('b-send').addEventListener('click', send);
    $('b-copy').addEventListener('click', copy);
    $('b-again').addEventListener('click', function () { location.reload(); });
    /* the test page for the tests (test/bench.js): its numbers, and a way to end early */
    window.__bench = { result: function () { return result; }, finish: function () { finish(false); }, run: function () { return R; } };
  });
})();
