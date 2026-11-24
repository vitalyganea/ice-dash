/* ===========================================================
   bench.js — the hill's own performance test (test.html only)
   -----------------------------------------------------------
   Asked for by the owner, 24 Nov 2026: a page anyone opens on their own
   phone; one tap, about fifteen minutes, and the report says where the
   hill stutters, on that screen (60, 90, 120 Hz) and that graphics chip.
   Never shipped with the game: not in build-android.sh's FILES, and test.html loads
   the game's own files without ui.js, so no menu, no save and no sound; the
   player's progress on the same site is never read or touched.

   What it does, in order (the hill seeded, so every phone rides the same):
     0. the screen's refresh, from the median frame;
     1. a survey, fast-forwarded and out of sight: the game's own generator
        lays 15 km of hill and one of every kind of thing it lays is kept
        (every bridge kind, a crevasse with a span and one jumped from a
        ramp, geysers, the fork rock, deep snow, fish arcs, rocks, trees, and
        every bonus). Whatever the game lays tomorrow is in the test without
        a line of this file changing;
     2. a real player's run to 50,000 points: the tests' casual player,
        imprecise and late, taking bonuses now and then, crashing and
        spending a life; on the way, at 400 m (slow) and 4,000 m (medium),
        an OBSTACLE COURSE: the stretch ahead cleared and the kinds from the
        survey laid one block after another (five bridges in a row, three of
        each other), each block measured on its own against a few seconds of
        empty hill at the same pace;
     3. the obstacle course at speed, once in each graphics setting (auto,
        full, lighter, spare, effects off);
     4. every creature, and every one of its skins, a few seconds each.
   Every frame the browser shows is timed (its requestAnimationFrame stamp)
   and tagged with what was on screen (a bridge ahead, under it, past it,
   the frame it comes into view; crevasses and spans the same way; jumps,
   the dragon's flight, fades between stretches...). Also caught: things on
   screen for a frame or two and then gone (a flash), things that turn up
   already halfway down the screen (a pop-in), script errors, long tasks,
   numbers gone wrong, the world's arrays growing.

   The report is made on the server in the first seconds (its number shown
   at once), sent again every 30 s, once more when the page is hidden or
   closed, and last at the end: a test cut short still leaves what it got.
   It goes to bench.icedasher.workers.dev (its own Worker and database,
   apart from the leaderboard); read with server/admin.mjs bench-show <no>.
   ?quick=1: a three-minute version (checks).
   =========================================================== */
(function () {
  'use strict';
  var Q = (function () { var o = {}; location.search.replace(/^\?/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); return o; })();
  var QUICK = Q.quick === '1';
  /* Two switches to tell apart what makes the iPhone stop for 0.4 s about
     every 150 s with the time outside the page's script (reports 6-11,
     24 Nov 2026). They change nothing in the game; each adds to one thing,
     and if the stops come more often, that thing is it.
     ?junk=1: as much again of throwaway memory each frame as the hill makes
              (small objects, lists, colour strings), for the script engine
              to clear.
     ?grad=1: as many again of new gradients each frame (some 24), filled
              into a tiny canvas no one sees, for the drawing side to keep.
     ?keep=1: throwaway memory that lives some seconds first (a ring of 300
              frames' worth), as the hill's things and pictures do: a
              collector clears what dies at once cheaply and often, and
              stops for a big clear only when longer-lived things pile up.
              junk=1 made the stop come at 141 s instead of 165 (report 13). */
  var JUNK = Q.junk === '1', GRAD = Q.grad === '1', KEEP = Q.keep === '1', junkKeep = null, gradCv = null, ring = [], ringI = 0;
  function keepFrame() {
    var a = [], i;
    for (i = 0; i < 400; i++) a.push({ x: i * 0.5, y: Math.random(), k: [i, i + 1] });
    for (i = 0; i < 100; i++) a.push('rgba(' + (i & 255) + ',' + ((i * 7) & 255) + ',90,' + Math.random().toFixed(3) + ')');
    ring[ringI] = a; ringI = (ringI + 1) % 300;   // let go five seconds later
  }
  function junkFrame() {
    var a = [], i;
    for (i = 0; i < 2500; i++) a.push({ x: i * 0.5, y: Math.random(), k: [i, i + 1] });
    for (i = 0; i < 600; i++) a.push('rgba(' + (i & 255) + ',' + ((i * 7) & 255) + ',90,' + Math.random().toFixed(3) + ')');
    for (i = 0; i < 150; i++) a.push(function (v) { return v + i; });
    junkKeep = a;                      // kept for a frame, then thrown away
  }
  function gradFrame() {
    if (!gradCv) { gradCv = document.createElement('canvas'); gradCv.width = gradCv.height = 8; }
    var c = gradCv.getContext('2d');
    for (var i = 0; i < 24; i++) {
      var g = i % 3 ? c.createLinearGradient(0, 0, 8, 8) : c.createRadialGradient(4, 4, 0, 4, 4, 4);
      g.addColorStop(0, 'rgba(255,' + (i * 9) + ',0,.5)'); g.addColorStop(1, 'rgba(0,0,' + (i * 9) + ',0)');
      c.fillStyle = g; c.fillRect(0, 0, 8, 8);
    }
  }
  var SEED = 20271;
  /* which game the report is of: changed with every change made for speed,
     so two reports of one phone can be told apart (and compared) */
  var GAME_BUILD = 'pics-3';   // + no canvas thrown away (EMPTY_CV, SYSTEMS 207)   // 24 Nov 2026: pictures kept and made ahead, the creatures' beads from pictures (SYSTEMS 207)
  var SEND_URL = 'https://bench.icedasher.workers.dev/v1/bench';
  var LIMIT_MS = (QUICK ? 3.5 : 15) * 60000;           // the whole test, at most
  var PLAN = QUICK ? { surveyM: 4000, runMs: 60000, scoreGoal: 50000, slowAt: 300, midAt: 0, gfx: 2, creatureMs: 1500, creatures: 4, control: 2000 }
                   : { surveyM: 15000, runMs: 390000, scoreGoal: 50000, slowAt: 400, midAt: 4000, gfx: 5, creatureMs: 5000, creatures: 0, control: 5000 };
  var RO = /^ro/i.test(navigator.language || '');
  var TXT = RO ? {
    title: 'Ice Dasher — test de performanță',
    intro: 'Un bot joacă singur cam ' + (QUICK ? 3 : 15) + ' minute: o cursă ca un jucător real, piste cu toate obstacolele și bonusurile, toate tipurile de grafică și fiecare creatură cu fiecare costum. Pagina măsoară cât de fluid merge jocul pe ecranul tău. Nu se salvează nimic în joc. Ține pagina deschisă; ecranul rămâne aprins.',
    note: 'Raportul se trimite singur pe parcurs și la final: tipul de telefon și browser, ecranul, numele plăcii grafice și timpii măsurați. Nimic personal.',
    start: 'Testează', stop: 'Oprește', send: 'Încearcă din nou', copy: 'Copiază', again: 'Din nou',
    hz: 'Ecran', fps: 'Cadre/s', late: 'Cadre întârziate', dist: 'Distanță', time: 'Timp', tier: 'Grafică',
    full: 'completă', lower: 'redusă cu ', steps: ' trepte',
    measuring: 'Măsor ecranul…', report: 'Raportul nr. ', giveNo: 'Dă acest număr dezvoltatorului.',
    sending: 'Trimit raportul…', sent: 'Trimis, mulțumesc!', sendFail: 'Nu s-a putut trimite. Verifică internetul și încearcă din nou.',
    copied: 'Copiat.', smooth: 'Fluiditate', freeze: 'Cea mai lungă blocare', p95: '95% din cadre sub', score: 'Puncte',
    phase: ['Pregătesc pârtia…', 'Cursă ca un jucător', 'Pistă de obstacole', 'Grafică: ', 'Creaturi și costume', 'Gata.']
  } : {
    title: 'Ice Dasher — performance test',
    intro: 'A bot plays by itself for about ' + (QUICK ? 3 : 15) + ' minutes: a run like a real player\'s, courses with every obstacle and bonus, every graphics setting and every creature in every skin. The page measures how smoothly the game runs on your screen. Nothing is saved in the game. Keep this page open; the screen stays on.',
    note: 'The report is sent by itself along the way and at the end: the kind of phone and browser, the screen, the graphics chip\'s name and the timings. Nothing personal.',
    start: 'Test', stop: 'Stop', send: 'Try again', copy: 'Copy', again: 'Again',
    hz: 'Screen', fps: 'Frames/s', late: 'Late frames', dist: 'Distance', time: 'Time', tier: 'Graphics',
    full: 'full', lower: 'lowered ', steps: ' steps',
    measuring: 'Measuring the screen…', report: 'Report no. ', giveNo: 'Give this number to the developer.',
    sending: 'Sending the report…', sent: 'Sent, thank you!', sendFail: 'Could not send. Check the internet and try again.',
    copied: 'Copied.', smooth: 'Smoothness', freeze: 'Longest freeze', p95: '95% of frames under', score: 'Score',
    phase: ['Preparing the hill…', 'A run like a player\'s', 'Obstacle course', 'Graphics: ', 'Creatures and skins', 'Done.']
  };
  function $(id) { return document.getElementById(id); }
  function clock(secs) { return Math.floor(secs / 60) + ':' + ('0' + Math.floor(secs % 60)).slice(-2); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function tierWords(tr) { var n = parseInt(String(tr || '0'), 10) || 0; return n ? TXT.lower + n + (n > 1 ? TXT.steps : '') : TXT.full; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }

  /* ---- seeded numbers: the hill's (Math.random) and the bot's own ---- */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var botRnd = mulberry(SEED * 7 + 3);
  function seedHill() { Math.random = mulberry(SEED); }

  /* ---- the frame clock: ours, and the game's, which a survey drives ---- */
  var realRAF = window.requestAnimationFrame.bind(window);
  var hold = null;                                    // while set, the game's frames are ours to run
  /* where a slow frame's time went: the game's own code (its frame, with
     any garbage collection that fell in it), ours, and the report being
     sent; what is left is the browser's, outside the page's script. The
     most each took since the frame before (JS_MAX), read by measure() */
  var JS = { game: 0, bench: 0, up: 0, upAt: -1e9 };
  window.requestAnimationFrame = function (cb) {
    if (hold) { hold.cb = cb; return 0; }
    return realRAF(function (t) { var s0 = performance.now(); try { cb(t); } finally { var d = performance.now() - s0; if (d > JS.game) JS.game = d; } });
  };

  /* ---- the screen's refresh ---- */
  var HZ_STEPS = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
  function measureHz(done) {
    var ts = [], last = 0, n = 0;
    function f(t) {
      if (last) ts.push(t - last);
      last = t;
      if (++n < 150) realRAF(f);
      else {
        ts.sort(function (a, b) { return a - b; });
        var med = ts[ts.length >> 1] || 16.7, hz = 1000 / med, best = 60, bd = 1e9;
        HZ_STEPS.forEach(function (h) { var d = Math.abs(h - hz); if (d < bd) { bd = d; best = h; } });
        done(best, med);
      }
    }
    realRAF(f);
  }

  /* ---- what the hill lays ----
     STRUCT: the run's own furniture; everything else the survey finds is a
     bonus to be taken. NOT: never put on the course (scenery, a course's
     finish, the row fish). */
  var STRUCT = { tunnel: 1, crevasse: 1, ramp: 1, geyser: 1, nunatak: 1, rock: 1, tree: 1, drift: 1, gate: 1 };
  var NOT = { deco: 1, finish: 1, star: 1, dots: 1, flake: 1, fish: 1 };
  function kindKey(o) {
    if (o.t === 'crevasse') return o.bw ? 'crevasse (span)' : 'crevasse (jump)';
    return o.t;
  }
  function cloneOf(o) {
    var c = JSON.parse(JSON.stringify(o, function (k, v) { return k.charAt(0) === '_' ? undefined : v; }));
    var cx = Game._chuteAt(o.d);
    c.__rel = o.x - cx;
    if (o.bx !== undefined) c.__relB = o.bx - cx;
    return c;
  }
  function layAt(c, d) {
    var o = JSON.parse(JSON.stringify(c));
    var cx = Game._chuteAt(d);
    o.d = d; o.x = cx + (c.__rel || 0);
    if (c.__relB !== undefined) o.bx = cx + c.__relB;
    ['got', 'passed', 'used', 'checked', 'hit', 'smashed'].forEach(function (k) { if (k in o) o[k] = false; });
    o.__g = 1;                                        // ours: the course's, not the generator's
    return o;
  }

  /* ---- the survey ---- */
  var NODRAW = { chute: 1, ground: 1, ember: 1, neon: 1, trail: 1, objects: 1, sight: 1, streaks: 1, aurora: 1, veils: 1,
                 penguin: 1, gates: 1, close: 1, perfect: 1, chill: 1, vignette: 1, bridges: 1, avalanche: 1 };
  var SURVEY = null;
  function survey(done) {
    seedHill();
    Game.quality({ res: 1, fx: 3 });                   // fixed, not auto: nothing learnt about the phone here
    if (Game._skip) Game._skip(NODRAW);                // and nothing drawn: only the hill's laying is wanted
    hold = { cb: null };
    var gifts = typeof liveEvent === 'function' && !!liveEvent();
    Game.start(0, { hud: function () {}, over: function () {} }, 'snowcap', null, 0, { gifts: gifts });
    var ex = {}, kinds = {}, counts = {}, fakeT = 1000, t0 = performance.now();
    function collect(W) {
      for (var i = 0; i < W.objects.length; i++) {
        var o = W.objects[i];
        if (o.t === 'tunnel' && o._kind) kinds[o._kind] = 1;
        if (o.__sv || NOT[o.t]) continue;
        o.__sv = 1;
        var k = kindKey(o);
        counts[k] = (counts[k] || 0) + 1;
        if (!ex[k]) {
          ex[k] = cloneOf(o);
          if (k === 'crevasse (jump)') {                // its ramp, at the same lead
            for (var j = 0; j < W.objects.length; j++) {
              var q = W.objects[j];
              if (q.t === 'ramp' && Math.abs(q.d - (o.d - 52)) < 80) { ex[k].__ramp = cloneOf(q); ex[k].__lead = o.d - q.d; break; }
            }
          }
        }
      }
    }
    function tick() {
      var tq = performance.now(), over = false;
      while (performance.now() - tq < 28) {
        var cb = hold.cb; if (!cb) break; hold.cb = null;
        fakeT += 80; cb(fakeT);
        var W = Game.debug(); if (!W) { over = true; break; }
        W.invuln = 1e6; W.grace = 1e6;
        if (W.state !== 'run') { W.lives = 9; Game.revive(); }
        collect(W);
        if (W.dist / 8 >= PLAN.surveyM) { over = true; break; }
      }
      var Wn = Game.debug();
      $('b-phase').textContent = TXT.phase[0] + ' ' + Math.min(100, Math.round((Wn ? Wn.dist / 8 : 0) / PLAN.surveyM * 100)) + '%';
      if (!over) { realRAF(tick); return; }
      Game.stop();
      hold = null;
      if (Game._skip) Game._skip({});
      Game.quality({ res: 'auto', fx: 'auto' }, 0);
      /* every bridge kind the game has (its own list, so a new one joins
         the five by itself), else the ones the survey drew */
      var bk = (Game._bridgeKinds && Game._bridgeKinds()) || Object.keys(kinds).sort();
      SURVEY = { secs: r1((performance.now() - t0) / 1000), m: PLAN.surveyM, kinds: counts, bridgeKinds: bk, ex: ex };
      done();
    }
    realRAF(tick);
  }

  /* ---- the obstacle course: the survey's kinds, block after block ---- */
  function courseBlocks() {
    var ex = SURVEY.ex, keys = Object.keys(ex).sort(function (a, b) {
      var oa = a === 'tunnel' ? 0 : STRUCT[ex[a].t] ? 1 : 2, ob = b === 'tunnel' ? 0 : STRUCT[ex[b].t] ? 1 : 2;
      return oa - ob || (a < b ? -1 : a > b ? 1 : 0);
    });
    var out = [];
    keys.forEach(function (k) {
      var c = ex[k];
      if (k === 'tunnel') {
        var kinds = SURVEY.bridgeKinds.length ? SURVEY.bridgeKinds : [''];
        for (var i = 0; i < 5; i++) out.push({ block: '5 bridges in a row', c: c, kind: kinds[i % kinds.length] || null, gap: 260 });
      } else if (k === 'rock' || k === 'tree') {
        for (var j = 0; j < 4; j++) out.push({ block: k + 's', c: c, side: j % 2 ? 1 : -1, gap: 90 });
      } else {
        for (var m = 0; m < 3; m++) out.push({ block: k, c: c, gap: STRUCT[c.t] ? 240 : 150 });
      }
    });
    return out;
  }
  var C = null;                                       // the course on the hill now
  function layCourse(W, label) {
    var K2 = Game._consts(), d = W.dist + K2.PLAYER_Y + 260, d0 = d, blocks = courseBlocks(), laid = [];
    blocks.forEach(function (b) {
      var o = layAt(b.c, d);
      if (b.kind) o.kind = b.kind;
      if (b.side) o.x = Game._chuteAt(d) + b.side * K2.CHUTE * 0.62;
      o.__blk = b.block;
      if (b.c.__ramp) { var rp = layAt(b.c.__ramp, d - (b.c.__lead || 52)); rp.__blk = b.block; laid.push(rp); }
      laid.push(o);
      d += (o.span || 0) + b.gap;
    });
    C = { label: label, from: d0 - 40, to: d + 200, objs: laid };
    clearAhead(W);
    laid.forEach(function (o) { W.objects.push(o); });
    return C;
  }
  /* the generator's own things inside the course's stretch, gone before
     they come into view (they are laid far ahead, beyond the screen) */
  function clearAhead(W) {
    if (!C) return;
    for (var i = W.objects.length - 1; i >= 0; i--) {
      var o = W.objects[i];
      if (o.__g || o.t === 'deco') continue;
      if (o.d + (o.span || 0) >= C.from && o.d <= C.to) W.objects.splice(i, 1);
    }
  }

  /* ---- the bot ---- */
  var K = null, steerT = -1, coolUntil = 0, revives = 0, crashes = 0, taken = {}, wantBonus = null;
  var CASUAL = { aim: 70, hold: 26, react: 11, fumble: 0.12, dead: 14 };    // test/economy.js's casual rider
  var aimOff = 0, aimLeft = 0;
  function miss(W, dir, fr, target) {
    var x = W.px, v = W.vx, tr = Game._turnRate();
    for (var k = 0; k < fr; k++) { v += (dir * K.DRIFT * W.speed - v) * tr; x += v; }
    return Math.abs(x - target);
  }
  function nextRow(W) { for (var i = 0; i < W.rows.length; i++) if (W.rows[i].d > W.dist + 30) return W.rows[i]; return null; }
  function steerTo(W, x, d, dead) {
    var fr = Math.max(1, Math.min(160, Math.round((d - W.dist) / Math.max(0.5, W.speed))));
    return miss(W, -W.dir, fr, x) < miss(W, W.dir, fr, x) - dead;
  }
  function courseTarget(W) {
    var best = null;
    C.objs.forEach(function (o) {
      if (o.d < W.dist + 20) return;
      var x = null;
      if (o.t === 'ramp') x = o.x;
      else if (o.t === 'crevasse' && o.bw) x = o.bx;
      else if (o.t === 'gate' || !STRUCT[o.t]) x = o.x;
      else if (o.t === 'nunatak') x = o.x + (o.r || 40) + 70;
      if (x !== null && (!best || o.d < best.d)) best = { x: x, d: o.d };
    });
    return best;
  }
  function drive(W, mode) {
    if (mode !== 'real') { W.invuln = 1e6; W.grace = 1e6; }
    else if (W.invuln > 1e5) { W.invuln = 0; W.grace = 0; }
    if (W.state !== 'run') {
      if (W.state === 'crash' && !W.__counted) { crashes++; W.__counted = 1; }
      if (W.endT > 20) { W.lives = 9; if (Game.revive() !== false) { revives++; W.__counted = 0; } }
      return;
    }
    if (W.t === steerT || W.t < coolUntil) return;
    steerT = W.t;
    var tgt = null;
    if (C && W.dist >= C.from - 600 && W.dist <= C.to) tgt = courseTarget(W);
    if (!tgt && mode === 'real') {
      /* now and then the bonus a little off the line, as a player does */
      if (wantBonus && (wantBonus.d < W.dist || wantBonus.got)) wantBonus = null;
      if (!wantBonus) {
        for (var i = 0; i < W.objects.length; i++) {
          var o = W.objects[i];
          if (STRUCT[o.t] || NOT[o.t] || o.got || taken[o.d] || o.d < W.dist + 120 || o.d > W.dist + 520) continue;
          taken[o.d] = 1;
          if (botRnd() < 0.55) { wantBonus = o; break; }
        }
      }
      if (wantBonus) tgt = { x: wantBonus.x, d: wantBonus.d };
    }
    var dead = mode === 'real' ? CASUAL.dead : 6;
    if (!tgt) {
      var row = nextRow(W); if (!row) return;
      if (mode === 'real') { if (--aimLeft <= 0) { aimOff = (botRnd() - 0.5) * CASUAL.aim; aimLeft = CASUAL.hold; } }
      else aimOff = 0;
      tgt = { x: Game._chuteAt(row.d) + row.gap + aimOff, d: row.d };
    }
    if (steerTo(W, tgt.x, tgt.d, dead)) {
      if (mode === 'real' && botRnd() < CASUAL.fumble) { coolUntil = W.t + CASUAL.react + 4; return; }   // late, this time
      Game.tap(); coolUntil = W.t + (mode === 'real' ? CASUAL.react : 8);
    }
  }

  /* ---- the measurement ---- */
  var BIN = 0.25, NB = 1000;
  var R = null;
  function S() { return { n: 0, sum: 0, late: 0, o33: 0, o50: 0, max: 0 }; }
  function addS(s, dt, late) { s.n++; s.sum += dt; if (late) s.late++; if (dt > 33.4) s.o33++; if (dt > 50) s.o50++; if (dt > s.max) s.max = dt; }
  function outS(s, extra) {
    var o = { frames: s.n, ms: s.n ? r2(s.sum / s.n) : 0, late: s.n ? r1(100 * s.late / s.n) : 0, o33: s.o33, o50: s.o50, max: Math.round(s.max) };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  function newRun(hz, refresh) {
    return { hz: hz, refresh: refresh, hist: new Uint32Array(NB + 1), all: S(), dropped: 0, f100: 0, f250: 0,
             t0: 0, last: 0, gaps: 0, gapMs: 0, frames: 0, tags: {}, sec: {}, secOrder: [], worst: [], freezes: [],
             timeline: [], win: null, tiers: [], tier: null, biome: '', newBiomeT: 0, secLast: 0,
             flashes: [], popins: [], errors: [], errorsN: 0, nan: 0, maxObjs: 0, maxPuffs: 0, longN: 0, longMs: 0, longMax: 0,
             phase: '', section: '', stopped: false, endState: '' };
  }
  function pct(p) {
    var want = R.all.n * p, acc = 0;
    for (var i = 0; i <= NB; i++) { acc += R.hist[i]; if (acc >= want) return r1((i + 0.5) * BIN); }
    return 250;
  }
  function sec(name) { if (!R.sec[name]) { R.sec[name] = S(); R.secOrder.push(name); } return R.sec[name]; }

  /* what is on the screen this frame: tags, and the flash/pop-in watch */
  var TAGS = [], MINOR = { gift: 1, gold: 1, bubble: 1, clock: 1, koi: 1, 'fish arc': 1, 'deep snow': 1, 'many rocks/trees': 1, 'many fish': 1, twin: 1, chill: 1, call: 1 };
  var seenNow = [], seenPrev = [], life = typeof WeakMap === 'function' ? new WeakMap() : null;
  function tagsOf(W) {
    TAGS.length = 0;
    var ahead = K.PLAYER_Y + 40, behind = K.VIEW_H - K.PLAYER_Y + 40, solids = 0, fish = 0, i, o, a, b, k;
    function tag(x) { if (TAGS.indexOf(x) < 0) TAGS.push(x); }
    var tmp = seenPrev; seenPrev = seenNow; seenNow = tmp; seenNow.length = 0;
    for (i = 0; i < W.objects.length; i++) {
      o = W.objects[i];
      a = o.d - W.dist; b = o.d + (o.span || 0) - W.dist;
      if (b < -behind || a > ahead) continue;
      seenNow.push(o);
      if (life) {
        var L = life.get(o);
        if (!L) {
          L = { n: 0 };
          life.set(o, L);
          /* turned up already well down the screen: a pop-in */
          if (R.frames > 120 && o.t !== 'deco' && !o.leap && !o.bonus && (o.span ? b : a) < ahead - 260 && Math.abs(a) > 120 && R.popins.length < 40)
            R.popins.push([Math.round(W.dist / 8), o.t, R.biome, R.section]);
        }
        L.n++;
      }
      k = o.t;
      if (k === 'tunnel' || k === 'crevasse') {
        var nm = k === 'tunnel' ? 'bridge' : (o.bw ? 'span' : 'crevasse');
        tag(nm + (a > 0 ? ':ahead' : b >= 0 ? (k === 'tunnel' ? ':under' : ':over') : ':after'));
        if (!o.__bench) { o.__bench = 1; tag(nm + ':comes into view'); }
      } else if (k === 'rock' || k === 'tree') solids++;
      else if (k === 'fish') fish++;
      else if (k === 'nunatak') tag('fork rock');
      else if (k === 'find') tag('ice cube (find)');
      else if (k === 'gate') tag('fish arc');
      else if (k === 'drift') tag('deep snow');
      else if (k !== 'deco') tag(k);
    }
    /* gone after a frame or two on screen, and not by him: a flash */
    if (life) for (i = 0; i < seenPrev.length; i++) {
      o = seenPrev[i];
      if (W.objects.indexOf(o) >= 0) continue;
      var Lp = life.get(o);
      if (Lp && Lp.n <= 2 && Math.abs(o.d - W.dist) > 150 && R.flashes.length < 40)
        R.flashes.push([Math.round(W.dist / 8), o.t, Lp.n, R.biome, R.section]);
    }
    if (solids >= 14) tag('many rocks/trees');
    if (fish >= 16) tag('many fish');
    if (W.airTo > W.dist) tag('in the air');
    if (W.soarT > 0) tag('dragon flight');
    if (W.rushT > 0) tag('snow rush');
    if (W.twinT > 0) tag('twin fish');
    if (W.state === 'crash') tag('crash');
    if (W.invuln > 0 && W.invuln < 1e5) tag('after a revive');
    if (W.puffs && W.puffs.length > 24) tag('rock smash');
    try { if (Game._fading && Game._fading()) tag('stretch fade'); } catch (e) {}
    if (R.newBiomeT > 0) tag('new stretch (first 2 s)');
    var big = false;
    for (i = 0; i < TAGS.length; i++) if (!MINOR[TAGS[i]]) { big = true; break; }
    if (!big) TAGS.push('plain (nothing big on screen)');
    TAGS.push('all frames');
    return seenNow.length;
  }
  function biomeName() { try { var B = Game._buildPal(); return (B && B.name) || ''; } catch (e) { return ''; } }
  function tierNow() { try { var q = Game.qualityNow(); return q.tier + '/' + q.res + '/' + q.fx; } catch (e) { return ''; } }

  function measure(t, W) {
    if (!R.last) { R.last = t; R.t0 = t; return; }
    var dt = t - R.last; R.last = t;
    if (dt > 1000) { R.gaps++; R.gapMs += dt; return; }       // out of sight or asleep: not the game's
    R.frames++;
    if (!K || !K.VIEW_H || R.frames % 30 === 0) K = Game._consts();
    var seen = tagsOf(W);
    /* the pictures the game made since the last frame (Game._pics) */
    var P = Game._pics ? Game._pics() : null, built = 0, builtMs = 0, wideB = 0, wideMs = 0;
    if (P) {
      if (R.pics) { built = P.n - R.pics.n; builtMs = P.ms - R.pics.ms; wideB = P.wide - R.pics.wide; wideMs = P.wideMs - R.pics.wideMs; }
      R.pics = { n: P.n, ms: P.ms, wide: P.wide, wideMs: P.wideMs };
      if (built > 0) { TAGS.splice(TAGS.length - 1, 0, 'pictures made'); if (wideB > 0) TAGS.splice(TAGS.length - 1, 0, 'wide picture made (a bridge roof)'); }
    }
    /* this frame's split: the game's frame and the sending since the last,
       ours from the last frame (the one before this one's) */
    var js = [Math.round(JS.game), Math.round(R.benchPrev || 0), Math.round(JS.up), r1((performance.now() - JS.upAt) / 1000)];
    R.benchPrev = JS.bench; JS.game = 0; JS.up = 0;
    var late = dt > R.refresh * 1.5;
    addS(R.all, dt, late);
    R.hist[Math.min(NB, Math.floor(dt / BIN))]++;
    if (late) R.dropped += Math.max(0, Math.round(dt / R.refresh) - 1);
    if (dt > 100) R.f100++;
    if (dt > 250) R.f250++;
    for (var i = 0; i < TAGS.length; i++) addS(R.tags[TAGS[i]] || (R.tags[TAGS[i]] = S()), dt, late);
    if (R.section) {
      addS(sec(R.section), dt, late);
      if (C && C.label === R.section) {
        var blk = {};
        for (var j = 0; j < seenNow.length; j++) if (seenNow[j].__blk) blk[seenNow[j].__blk] = 1;
        for (var bn in blk) addS(sec(R.section + ' · ' + bn), dt, late);
      }
    }
    if (dt > 50 && (R.worst.length < 30 || dt > R.worst[R.worst.length - 1][0])) {
      R.worst.push([Math.round(dt), Math.round(W.dist / 8), R.biome, R.section, TAGS.join(', '), seen, r1(W.speed), built, Math.round(builtMs), wideB, Math.round(wideMs), js]);
      R.worst.sort(function (x, y) { return y[0] - x[0]; });
      if (R.worst.length > 30) R.worst.length = 30;
    }
    if (dt > 100 && R.freezes.length < 100)
      R.freezes.push([r1((t - R.t0) / 1000), Math.round(dt), Math.round(W.dist / 8), R.biome, R.section, TAGS.join(', '), built, Math.round(builtMs), wideB, Math.round(wideMs), js]);
    if (R.newBiomeT > 0) R.newBiomeT -= dt;
    if (!R.win) R.win = { n: 0, sum: 0, late: 0, max: 0, t: t, pics: Game._drawn ? Game._drawn().n : 0 };
    var w = R.win; w.n++; w.sum += dt; if (late) w.late++; if (dt > w.max) w.max = dt;
    if (t - R.secLast > 1000) {
      R.secLast = t;
      var bn2 = biomeName(); if (R.biome && bn2 !== R.biome) R.newBiomeT = 2000; R.biome = bn2;
      var tr = tierNow();
      if (tr !== R.tier) { R.tiers.push([Math.round((t - R.t0) / 1000), Math.round(W.dist / 8), tr, R.section]); R.tier = tr; }
      if (!isFinite(W.dist) || !isFinite(W.px) || !isFinite(W.speed) || !isFinite(W.score)) R.nan++;
      if (W.objects.length > R.maxObjs) R.maxObjs = W.objects.length;
      if (W.puffs && W.puffs.length > R.maxPuffs) R.maxPuffs = W.puffs.length;
      show(W, t);
    }
    if (t - w.t >= 10000) {
      var pics = Game._drawn ? Game._drawn().n : 0;
      R.timeline.push([Math.round((t - R.t0) / 1000), Math.round(W.dist / 8), r1(1000 * w.n / w.sum), r1(100 * w.late / w.n),
                       Math.round(w.max), Math.round((pics - w.pics) * 1000 / w.sum), R.tier, R.biome, R.section, r1(W.speed),
                       (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0), W.objects.length]);
      R.win = null;
    }
  }

  /* ---- the plan, step by step ---- */
  var STEPS = ['run', 'gfxCourses', 'creatures'], stepI = 0, sub = null;
  var GFX = [
    { name: 'auto', want: { res: 'auto', fx: 'auto' } }, { name: 'full (sharp, all effects)', want: { res: 0, fx: 0 } },
    { name: 'lighter (1/1)', want: { res: 1, fx: 1 } }, { name: 'spare (1/2)', want: { res: 1, fx: 2 } },
    { name: 'effects off (1/3)', want: { res: 1, fx: 3 } }];
  function setPhase(i, extra) { R.phase = TXT.phase[i] + (extra || ''); $('b-phase').textContent = R.phase; }
  /* an empty stretch for a control: the generator's things in the next
     seconds of hill cleared as they are laid */
  function clearStretch(W) { sub.stretchTo = W.dist + W.speed * 60 * (PLAN.control / 1000) + 2500; }
  function keepClear(W) {
    if (!sub.stretchTo || W.dist > sub.stretchTo) return;
    var from = W.dist + K.PLAYER_Y + 60;
    for (var i = W.objects.length - 1; i >= 0; i--) {
      var o = W.objects[i];
      if (o.__g || o.t === 'deco') continue;
      if (o.d >= from && o.d <= sub.stretchTo) W.objects.splice(i, 1);
    }
  }
  /* a course in three stages: control (empty hill), the course, done */
  function courseStage(W, t, name, onDone) {
    var c = sub.course;
    if (!c) { sub.course = c = { stage: 'control', t: t }; R.section = name + ': empty hill (control)'; clearStretch(W); return true; }
    if (c.stage === 'control' && t - c.t > PLAN.control) { c.stage = 'course'; R.section = name + ': course'; sub.stretchTo = 0; layCourse(W, R.section); }
    if (c.stage === 'course' && W.dist > C.to) { C = null; sub.course = null; onDone(); return false; }
    return true;
  }
  function next() { stepI++; sub = null; R.section = ''; }
  function stepFrame(W, t) {
    var st = STEPS[stepI];
    if (!st) { finish('done'); return; }
    if (!sub) sub = { t0: t };
    if (st === 'run') {
      var busy = false;
      if (!sub.slowDone && W.dist / 8 >= PLAN.slowAt) {
        busy = courseStage(W, t, 'slow', function () { sub.slowDone = true; R.section = 'run'; setPhase(1); });
        if (busy && sub.course && sub.course.stage === 'course') setPhase(2, ' · slow');
      } else if (PLAN.midAt && sub.slowDone && !sub.midDone && W.dist / 8 >= PLAN.midAt) {
        busy = courseStage(W, t, 'medium', function () { sub.midDone = true; R.section = 'run'; setPhase(1); });
        if (busy && sub.course && sub.course.stage === 'course') setPhase(2, ' · medium');
      } else if (!R.section || R.section === '') { R.section = 'run'; setPhase(1); }
      drive(W, busy ? 'course' : 'real');
      if (C) clearAhead(W);
      keepClear(W);
      var goal = W.score >= PLAN.scoreGoal || t - sub.t0 > PLAN.runMs;
      if (goal && !busy && sub.slowDone && (!PLAN.midAt || sub.midDone || W.dist / 8 < PLAN.midAt)) {
        R.runScore = Math.round(W.score); R.runM = Math.round(W.dist / 8); R.runSecs = Math.round((t - sub.t0) / 1000);
        next();
      }
      return;
    }
    if (st === 'gfxCourses') {
      if (sub.g === undefined) { sub.g = 0; Game.quality(GFX[0].want); setPhase(3, GFX[0].name); }
      drive(W, 'course');
      if (C) clearAhead(W);
      keepClear(W);
      var g = GFX[sub.g];
      courseStage(W, t, 'fast · ' + g.name, function () {
        sub.g++;
        if (sub.g >= Math.min(PLAN.gfx, GFX.length)) { Game.quality({ res: 'auto', fx: 'auto' }); next(); return; }
        Game.quality(GFX[sub.g].want); setPhase(3, GFX[sub.g].name);
      });
      return;
    }
    if (st === 'creatures') {
      if (!sub.list) {
        sub.list = [];
        (typeof SKINS !== 'undefined' ? SKINS : []).forEach(function (s) {
          sub.list.push({ skin: s.id, alt: '' });
          if (typeof ALT_BY_ID !== 'undefined') Object.keys(ALT_BY_ID).forEach(function (a) { if (ALT_BY_ID[a].of === s.id) sub.list.push({ skin: s.id, alt: a }); });
        });
        if (PLAN.creatures) sub.list = sub.list.slice(0, PLAN.creatures);
        sub.i = -1; sub.ct = 0;
      }
      drive(W, 'course');
      if (sub.i < 0 || t - sub.ct > PLAN.creatureMs) {
        sub.i++;
        if (sub.i >= sub.list.length) { Game.syncFromSave(9, 'snowcap'); if (Game.setLook) Game.setLook(''); next(); return; }
        var cr = sub.list[sub.i];
        Game.syncFromSave(9, cr.skin); if (Game.setLook) Game.setLook(cr.alt);
        R.section = 'creature: ' + cr.skin + (cr.alt ? ' + ' + cr.alt : '');
        setPhase(4, ' ' + (sub.i + 1) + '/' + sub.list.length);
        sub.ct = t;
      }
    }
  }

  /* ---- the frame ---- */
  var started = 0;
  function frame(t) {
    if (!R || R.stopped) return;
    realRAF(frame);
    var W = Game.debug();
    if (!W) return;
    if (!K) K = Game._consts();
    var b0 = performance.now();
    if (JUNK) junkFrame();
    if (GRAD) gradFrame();
    if (KEEP) keepFrame();
    stepFrame(W, t);
    JS.bench = performance.now() - b0;
    if (R.stopped) return;
    measure(t, W);
    if (performance.now() - started > LIMIT_MS) finish('time limit');
  }

  /* ---- the report ---- */
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
  var DEV = null;
  function report(state) {
    var W = Game.debug(), tags = [], secs = [];
    Object.keys(R.tags).forEach(function (k) {
      var g = R.tags[k]; if (g.n < 10 && k.indexOf('comes into view') < 0) return;
      tags.push(outS(g, { tag: k }));
    });
    tags.sort(function (a, b) { return (a.tag === 'all frames') - (b.tag === 'all frames') || b.late - a.late || b.ms - a.ms; });
    R.secOrder.forEach(function (k) { secs.push(outS(R.sec[k], { section: k })); });
    return {
      v: 1, kind: 'bench2', state: state, page: location.host + location.pathname + location.search, built: document.lastModified,
      seed: SEED, elapsed: Math.round((performance.now() - started) / 1000), phase: R.phase,
      hz: R.hz, refresh: r2(R.refresh), frames: R.all.n, fps: R.all.n ? r1(1000 * R.all.n / R.all.sum) : 0,
      p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), late: R.all.n ? r1(100 * R.all.late / R.all.n) : 0,
      dropped: R.dropped, f100: R.f100, f250: R.f250, gaps: R.gaps, gapSecs: Math.round(R.gapMs / 1000),
      m: W ? Math.round(W.dist / 8) : 0, secs: Math.round(R.all.sum / 1000), score: W ? Math.round(W.score) : 0,
      run: { score: R.runScore || 0, m: R.runM || 0, secs: R.runSecs || 0, crashes: crashes, revives: revives },
      survey: SURVEY ? { secs: SURVEY.secs, m: SURVEY.m, kinds: SURVEY.kinds, bridgeKinds: SURVEY.bridgeKinds } : null,
      sections: secs, tags: tags, worst: R.worst, freezes: R.freezes,
      glitches: { flashes: R.flashes, popins: R.popins, errors: R.errors, errorsN: R.errorsN, nan: R.nan,
                  maxObjects: R.maxObjs, maxPuffs: R.maxPuffs, longTasks: { n: R.longN, ms: Math.round(R.longMs), max: Math.round(R.longMax) } },
      pictures: (function () { var P = Game._pics ? Game._pics() : null; return P ? { n: P.n, ms: Math.round(P.ms), max: Math.round(P.max), mpx: r1(P.px / 1e6),
        wide: P.wide, wideMs: Math.round(P.wideMs), wideMax: Math.round(P.wideMax), wideMpx: r1(P.widePx / 1e6),
        reused: P.reused || 0, pooled: P.pooled || 0, ahead: P.ahead || 0, resized: P.resized || 0 } : null; })(),
      build: GAME_BUILD + (JUNK ? '+junk' : '') + (GRAD ? '+grad' : '') + (KEEP ? '+keep' : ''), tiers: R.tiers, timeline: R.timeline, device: DEV
    };
  }
  /* the report on the server: made at once, sent again every 30 s, once
     more when the page goes out of sight or away, and at the end */
  var RID = 0, RKEY = '', sendT = null;
  function post(url, body, cb) {
    var x = new XMLHttpRequest();
    x.open('POST', url); x.setRequestHeader('content-type', 'text/plain');
    x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) {} cb(x.status === 200 ? j : null); };
    x.onerror = function () { cb(null); };
    x.send(body);
  }
  function upload(state, cb) {
    if (!R) return;
    var u0 = performance.now();
    var body = JSON.stringify(report(state));
    JS.up += performance.now() - u0; JS.upAt = performance.now();
    if (!RID) post(SEND_URL, body, function (j) {
      if (j && j.id) { RID = j.id; RKEY = j.key || ''; showNo(); }
      if (cb) cb(!!(j && j.id));
    });
    else post(SEND_URL + '/' + RID + '?k=' + encodeURIComponent(RKEY), body, function (j) { if (cb) cb(!!(j && j.ok)); });
  }
  function beacon() {
    if (!R || R.stopped || !RID || !navigator.sendBeacon) return;
    try { navigator.sendBeacon(SEND_URL + '/' + RID + '?k=' + encodeURIComponent(RKEY), new Blob([JSON.stringify(report('closed early'))], { type: 'text/plain' })); } catch (e) {}
  }
  function showNo() { $('b-no').textContent = TXT.report + RID; $('b-no-note').textContent = TXT.giveNo; $('b-report').classList.remove('hidden'); }

  /* ---- the page ---- */
  var wake = null;
  function keepAwake() { try { if (navigator.wakeLock && (!wake || wake.released)) navigator.wakeLock.request('screen').then(function (l) { wake = l; }, function () {}); } catch (e) {} }
  function show(W, t) {
    var s = (performance.now() - started) / 1000;
    $('b-hz').textContent = R.hz + ' Hz';
    $('b-fps').textContent = R.all.n ? r1(1000 * R.all.n / R.all.sum) : '–';
    $('b-late').textContent = R.all.n ? r1(100 * R.all.late / R.all.n) + '%' : '–';
    $('b-dist').textContent = fmt(W.dist / 8) + ' m · ' + fmt(W.score);
    $('b-time').textContent = clock(s) + ' / ' + Math.round(LIMIT_MS / 60000) + ':00';
    $('b-tier').textContent = tierWords(R.tier);
    $('b-bar').style.width = Math.min(100, (performance.now() - started) / LIMIT_MS * 100) + '%';
  }
  var result = null;
  function finish(state) {
    if (!R || R.stopped) return;
    R.stopped = true; R.endState = state;
    try { if (wake) wake.release(); } catch (e) {}
    if (sendT) clearInterval(sendT);
    setPhase(5);
    result = report(state);
    $('b-run').classList.add('hidden');
    $('b-end').classList.remove('hidden');
    $('b-sum').innerHTML = '';
    [[TXT.hz, result.hz + ' Hz'], [TXT.fps, result.fps], [TXT.smooth, (100 - result.late).toFixed(1) + '%'],
     [TXT.p95, result.p95 + ' ms'], [TXT.freeze, (result.worst[0] ? result.worst[0][0] : Math.round(R.all.max)) + ' ms'],
     [TXT.dist, fmt(result.m) + ' m'], [TXT.score, fmt(result.run.score || result.score)], [TXT.time, clock(result.elapsed)],
     [TXT.tier, tierWords(R.tier)]].forEach(function (r) {
      var li = document.createElement('li'); li.innerHTML = '<span></span><b></b>';
      li.firstChild.textContent = r[0]; li.lastChild.textContent = r[1]; $('b-sum').appendChild(li);
    });
    finalSend(0);
  }
  function finalSend(tries) {
    $('b-status').textContent = TXT.sending; $('b-send').classList.add('hidden');
    upload(R.endState, function (ok) {
      if (ok) { $('b-status').textContent = TXT.sent; return; }
      if (tries < 2) { setTimeout(function () { finalSend(tries + 1); }, 10000); return; }
      $('b-status').textContent = TXT.sendFail; $('b-send').classList.remove('hidden');
    });
  }
  function begin() {
    $('b-start').disabled = true;
    $('b-phase').textContent = TXT.measuring;
    keepAwake();
    DEV = device();
    started = performance.now();
    measureHz(function (hz, med) {
      try { Sfx.sound(false); if (Sfx.music) Sfx.music(false); } catch (e) {}
      R = newRun(hz, med);
      $('b-intro').classList.add('hidden');
      $('b-run').classList.remove('hidden');
      try { Game.stop(); } catch (e) {}
      survey(function () {
        seedHill();
        var gifts = typeof liveEvent === 'function' && !!liveEvent();
        Game.start(0, { hud: function () {}, over: function () {} }, 'snowcap', null, 9, { gifts: gifts });
        K = Game._consts();
        setPhase(1);
        upload('running');
        sendT = setInterval(function () { if (!R.stopped) { upload('running'); keepAwake(); } }, 30000);
        realRAF(frame);
      });
    });
  }
  window.addEventListener('error', function (e) { if (R) { R.errorsN++; if (R.errors.length < 10) R.errors.push(String(e.message || e).slice(0, 160) + ' @' + (e.lineno || '')); } });
  window.addEventListener('unhandledrejection', function (e) { if (R) { R.errorsN++; if (R.errors.length < 10) R.errors.push('promise: ' + String(e.reason).slice(0, 160)); } });
  try {
    if (window.PerformanceObserver) new PerformanceObserver(function (l) {
      if (!R) return;
      l.getEntries().forEach(function (en) { R.longN++; R.longMs += en.duration; if (en.duration > R.longMax) R.longMax = en.duration; });
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}
  /* out of sight or away: what there is, by beacon (the page may not come back) */
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') beacon(); });
  window.addEventListener('pagehide', beacon);

  function copy() {
    var s = JSON.stringify(result || (R && report('running')), null, 1);
    function said() { $('b-status').textContent = TXT.copied; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(said, function () {});
    else { var ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); said(); } catch (e) {} ta.remove(); }
  }
  window.addEventListener('load', function () {
    document.title = TXT.title;
    $('b-title').textContent = TXT.title;
    $('b-intro-text').textContent = TXT.intro;
    $('b-intro-note').textContent = TXT.note;
    $('b-start').textContent = TXT.start;
    $('b-stop').textContent = TXT.stop;
    $('b-send').textContent = TXT.send;
    $('b-copy').textContent = TXT.copy;
    $('b-again').textContent = TXT.again;
    $('b-note').textContent = TXT.note;
    ['hz', 'fps', 'late', 'dist', 'time', 'tier'].forEach(function (k) { $('l-' + k).textContent = TXT[k]; });
    $('l-dist').textContent = TXT.dist + ' · ' + TXT.score;
    $('b-start').addEventListener('click', begin);
    $('b-stop').addEventListener('click', function () { finish('stopped'); });
    $('b-send').addEventListener('click', function () { finalSend(2); });
    $('b-copy').addEventListener('click', copy);
    $('b-again').addEventListener('click', function () { location.reload(); });
    try { Game.attract('snowcap'); } catch (e) {}
    window.__bench = { result: function () { return result; }, report: function () { return R ? report('running') : null; }, finish: function () { finish('stopped'); }, id: function () { return RID; } };
  });
})();
