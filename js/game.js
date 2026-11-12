/* ===========================================================
   game.js — Ice Dash: one-tap belly slide, seen from above
   -----------------------------------------------------------
   A top-down chute that winds down the mountain. Everything lives in
   world pixels, so what the collision code measures is exactly what the
   player sees — no perspective to disagree with.
   =========================================================== */
var Game = (function () {
  'use strict';

  var STEP_MS = 1000 / 60, STEP_EARLY = 1.5;
  /* The world region that must always be on screen. Everything is scaled so
     this fits, and then the viewport simply IS the screen — both dimensions
     run past the safe region rather than leaving a bar anywhere. */
  var SAFE_W = 680, SAFE_H = 540;
  var VIEW_W = 960, VIEW_H = 540;
  var CLEAR_AHEAD = 400;       // hill you can always read plainly, in world units
  var BEHIND = 300;            // how far past the penguin things stay alive (set by resize)

  var PLAYER_Y = 390;          // where the penguin sits on screen
  var CHUTE = 300;             // half-width of the ice run
  var LOOK   = 620;            // how far up the hill objects are kept alive (set by resize)

  var SPEED0 = 3.0, SPEED_MAX = 6.4, SPEED_RAMP = 0.000155;
  var ZONE_SHOW = 110;         // frames the stretch's name stays up
  var CLOSE_GAP = 14;          // a pass this near the edge of a hit is a close call
  var PERF_CHAIN = 180;        // frames: a PERFECT this soon after the last one chains
  /* Time Rush: the clock you start with, what a clock bubble gives back,
     and what a crash takes away instead of the run. */
  var RUSH_START = 20 * 60, CLOCK_GAIN = 3 * 60, CRASH_COST = 5 * 60;
  /* Avalanche: the lead you start with, how much faster than your clean
     pace the snow comes, what a crystal ring knocks it back by (less as the
     hill hardens, so a run always ends), and the most lead you can bank. */
  var AV_GAP0 = 800, AV_K = 1.06, AV_PUSH0 = 180, AV_PUSH1 = 50, AV_CAP = 1000;
  var AV_EASE = 4000;          // the snow builds to its full pace over the first 500 m
  var DRIFT  = 0.82;           // sideways speed as a fraction of the slide
  var TURN   = 0.16;           // how quickly the tap takes effect

  var ROW_GAP0 = 230, ROW_GAP1 = 165;   // rows close up as the run goes on

  /* A crevasse splits the whole run, and the only way over is the ramp of
     packed snow sitting in that row's opening. Because the ramp IS the
     opening, the reachability proof needs no special case: steer to the gap
     as always, and the gap happens to throw you into the air.
     Air is measured in DISTANCE, not frames, so it covers the same stretch
     of hill whether you are crawling at the start or flat out later on. */
  /* A gate spans this much of its opening, and sits this far off centre.
     Both numbers are forced: for the gate to exclude the middle of the
     opening (so a safe line does not collect it for free) yet still lie
     wholly inside it (so collecting it is never a crash), its half-width
     must be under a quarter of the opening. At 0.56 it could not do both,
     and every gate went on being free. */
  var GATE_W = 0.40;
  var GATE_OFF = 0.47;
  /* How long a snow rush lasts. Measured in SECONDS, not metres: by
     distance it ran out faster and faster as the hill sped up, so the same
     bonus was worth half as much at the bottom of a run as at the top. Six
     seconds is six seconds wherever you take it. */
  var RUSH_SECONDS = 6, RUSH_FRAMES = RUSH_SECONDS * 60;
  /* The breathing space after spending a life. Separate from the ordinary
     invulnerability because it has to cover a crevasse too, and ordinary
     invulnerability deliberately does not — a shield save and a landing
     grant it, and neither should let you walk over a hole. */
  var GRACE_SECONDS = 3, GRACE_FRAMES = GRACE_SECONDS * 60;
  /* The three timed finds that are not the snow rush. All of them only
     ever make the hill easier to read or easier to ride, which is what
     lets them sit on top of the spawner's promise without disturbing it. */
  var CHILL_FRAMES = 3 * 60, CHILL_FACTOR = 0.62;   // the hill slows down
  /* Deep snow bogs him down. It costs pace, and pace is score — but it
     never kills, and slower is always safe against a hill whose rows were
     proved at full speed. The game had only two outcomes before this,
     fine or dead, and nothing in between. */
  var BOG_FACTOR = 0.68;
  /* A geyser is lethal only while it is up, and it never covers the whole
     opening: it sits off to one side of it, so the other side is always
     there to be taken. You cannot brake, so the way past a bad cycle is to
     weave wider and arrive later — a new thing to do with the same tap. */
  var GEYSER_PERIOD = 170, GEYSER_UP = 54, GEYSER_R = 42;
  /* The fork. A nunatak is rock that never got buried — a spine of it
     standing up through the run and splitting the ice in two for a few
     hundred metres. Both ways past are open; only one of them is the one
     the hill proved for you, and the other is where the gold is. It is
     the first choice in the game that is a bet rather than a dodge, and
     it is still made with the same single tap. */
  var FORK_MIN = 96;                  // the narrowest the far way past may be
  var SIGHT_FRAMES = 7 * 60;                        // the next gaps light up
  var CALL_FRAMES  = 5 * 60;                        // every fish bends to you
  var CREV_SPAN = 150;                  // how wide the hole in the ice is
  var RAMP_LEAD = 52;                   // how far the ramp sits before it
  var AIR_DIST  = 340;                  // hill covered while airborne
  var HARD_OVER = 30000;                // world units to reach full difficulty
  var PR = 24;                 // the penguin's radius

  var canvas, ctx, stage, W = null;
  var skin = (typeof SKINS !== 'undefined') ? SKINS[0] : null;
  var pendingCourse = null;
  function perk() { return (skin && skin.perk) || {}; }
  var rafId = null, lastT = 0, accT = 0, paused = false, suspended = false;
  var drawnW = null;                                  // the world the canvas last showed (loop)
  var hooks = { hud: null, over: null, fx: null };
  /* Moments worth feeling in the hand: the UI turns these into a buzz on
     a phone, if the player has it on. The engine only says what happened. */
  function fx(e) { if (hooks.fx) { try { hooks.fx(e); } catch (x) {} } }
  var pendingMode = null;
  var drawK = 1;

  /* The canvas draws its own words. i18n.js may not be there — the engine
     is loaded on its own by the tests — so fall back to the English. */
  function tr(key, fallback) {
    return (typeof t === 'function') ? t(key, null, fallback) : fallback;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  /* Everything you only LOOK at draws from a generator of its own: puffs,
     falling snow, streaks, the shake, the shape of a boulder, the scenery
     out past the banks. They used to share Math.random with the spawner,
     so the hill itself depended on them — catching a fish a frame earlier
     threw a different puff and every row after it came out different, and
     the scenery's count followed the width of the screen, so the same seed
     was a different hill on a phone and on a laptop. The hill now depends
     on the seed and on what the player does, and on nothing else. */
  var fxS = 0x2f6b9d;
  function frand() { fxS = (Math.imul(fxS, 1664525) + 1013904223) >>> 0; return fxS / 4294967296; }
  function frnd(a, b) { return a + frand() * (b - a); }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);         c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* The chute snakes down the mountain. One function decides where its
     centre is at any distance, and everything else is placed relative to it. */
  function chuteAt(d) {
    return Math.sin(d * 0.0016) * 96 + Math.sin(d * 0.00061 + 1.7) * 62;
  }
  /* chuteHere(), which every point of every edge asks for, a few
     hundred times a frame: worked out once for each distance */
  var hereD = NaN, hereC = 0;
  function chuteHere() { if (W.dist !== hereD) { hereD = W.dist; hereC = chuteAt(hereD); } return hereC; }
  function biome() { return BIOMES[W.biome % BIOMES.length]; }

  /* BIOME_LEN is in metres and eight world units make a metre. This used to
     read BIOME_LEN * 3, so every stretch was a third of its stated length
     and the hill changed its mind roughly every five seconds. */
  function zoneLen() { return BIOME_LEN * 8; }

  /* ---- crossfading one stretch of hill into the next ----------
     Only the look is blended. grip must stay exactly what biome() reports,
     because that is the number the spawner already predicted when it placed
     each row; a blended grip would quietly break that promise. */
  var FADE = 520;
  var PAL = null;
  /* true while render() paints the hill itself, rather than an icon, a
     comic panel or the find: only there do things keep pictures of
     themselves, which are made at the hill's scale */
  var HILL = false;

  function rgbOf(h) {
    /* Through a fade the palette's colours are mixHex's rgb(r,g,b), not
       hex; read either. Read as hex they came out black. */
    if (h && h.charAt(0) === 'r') {
      var m = h.match(/[\d.]+/g) || [];
      return [+m[0] || 0, +m[1] || 0, +m[2] || 0];
    }
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lumOf(h) {
    var c = rgbOf(h);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function mixHex(a, b, t) {
    var A = rgbOf(a), B2 = rgbOf(b);
    return 'rgb(' + Math.round(A[0] + (B2[0] - A[0]) * t) + ',' +
                    Math.round(A[1] + (B2[1] - A[1]) * t) + ',' +
                    Math.round(A[2] + (B2[2] - A[2]) * t) + ')';
  }
  function mixTriplet(a, b, t) {
    if (!a) a = b; if (!b) b = a;
    if (!a) return '';
    var A = a.split(','), B2 = b.split(',');
    return Math.round(+A[0] + (+B2[0] - +A[0]) * t) + ',' +
           Math.round(+A[1] + (+B2[1] - +A[1]) * t) + ',' +
           Math.round(+A[2] + (+B2[2] - +A[2]) * t);
  }
  var AIR0 = { rgb: '255,255,255', a: 0.5, r: 1.6, rise: 0, drift: 0, hot: 0 };
  var TINTS = ['snowA', 'iceTop', 'iceBot', 'bankEdge', 'bankShade',
               'far', 'edge', 'tree', 'treeDark', 'trunk', 'rock', 'rockDark'];

  function buildPal() {
    var cur = biome();
    if (W.course) return cur;        // a marked run stays in its own weather
    if (W.biome === 0 || W.biomeT >= FADE) return cur;      // nothing to fade
    var prev = BIOMES[(W.biome - 1) % BIOMES.length];
    var t = W.biomeT / FADE;
    var out = { name: cur.name, grip: cur.grip };
    for (var i = 0; i < TINTS.length; i++)
      out[TINTS[i]] = mixHex(prev[TINTS[i]], cur[TINTS[i]], t);
    out.sky = [mixHex(prev.sky[0], cur.sky[0], t), mixHex(prev.sky[1], cur.sky[1], t)];
    out.fog = prev.fog + (cur.fog - prev.fog) * t;
    out.fogRGB = mixTriplet(prev.fogRGB, cur.fogRGB, t);
    out.hazeRGB = mixTriplet(prev.hazeRGB, cur.hazeRGB, t);
    /* What is falling through the frame crossfades as well, or snow would
       turn to ash between one frame and the next. */
    var pa = prev.air || AIR0, ca = cur.air || AIR0;
    out.air = { rgb:   mixTriplet(pa.rgb, ca.rgb, t),
                a:     pa.a + (ca.a - pa.a) * t,
                r:     pa.r + (ca.r - pa.r) * t,
                rise:  (pa.rise || 0) + ((ca.rise || 0) - (pa.rise || 0)) * t,
                drift: (pa.drift || 0) + ((ca.drift || 0) - (pa.drift || 0)) * t,
                hot:   (pa.hot || 0) + ((ca.hot || 0) - (pa.hot || 0)) * t };
    out.ember = (prev.ember || 0) + ((cur.ember || 0) - (prev.ember || 0)) * t;
    out.vents = (prev.vents || 0) + ((cur.vents || 0) - (prev.vents || 0)) * t;
    out.lava = (prev.lava || 0) + ((cur.lava || 0) - (prev.lava || 0)) * t;
    out.berries = (prev.berries || 0) + ((cur.berries || 0) - (prev.berries || 0)) * t;
    out.sparkle = (prev.sparkle || 0) + ((cur.sparkle || 0) - (prev.sparkle || 0)) * t;
    out.neon = (prev.neon || 0) + ((cur.neon || 0) - (prev.neon || 0)) * t;
    out.snowyTrees = (prev.snowyTrees || 0) +
                     ((cur.snowyTrees || 0) - (prev.snowyTrees || 0)) * t;
    /* A boulder's cap is a colour and blends; the two shade washes are rgba
       strings, so they change hands at the midpoint instead. */
    out.cap = mixHex(prev.cap || '#ffffff', cur.cap || '#ffffff', t);
    out.lip = mixHex(prev.lip || '#ffffff', cur.lip || '#ffffff', t);
    out.streak = (t < 0.5 ? prev : cur).streak;
    out.capShade = (t < 0.5 ? prev : cur).capShade;
    out.shadow = (t < 0.5 ? prev : cur).shadow;
    /* What grows on the hill is a shape, not a colour: it changes over at
       the midpoint of the fade, like the shade washes. */
    out.flora = (t < 0.5 ? prev : cur).flora;
    if (prev.aurora || cur.aurora) {
      out.aurora = mixTriplet(prev.aurora, cur.aurora, t);
      out.auroraA = (prev.aurora ? 1 : 0) + ((cur.aurora ? 1 : 0) - (prev.aurora ? 1 : 0)) * t;
    }
    return out;
  }
  function pal() { return PAL || biome(); }

  /* --------------------- world construction ------------------- */
  function newRun() {
    var w = {
      t: 0, dist: 0, speed: SPEED0, score: 0, fish: 0, gold: 0, gates: 0, coins: 0,
      shield: 0, invuln: 0, saved: 0,
      rushT: 0, lastRush: -1e9, smashed: 0, rushes: 0, grace: 0,
      chillT: 0, sightT: 0, callT: 0, bog: 0,
      px: 0, vx: 0, dir: 1, tilt: 0,
      objects: [], rows: [], flakes: [], puffs: [], spray: [], squash: 0, impact: 0, streaks: [],
      lastGap: 0, nextRowD: 320, lastStep: ROW_GAP0,
      airTo: -1, airSpan: AIR_DIST, clearUntil: 520, crevs: 0, jumps: 0,
      roofTo: -1e9, forkTo: -1e9, forceGap: null, forceGapW: 0, forks: 0,
      course: null, finishD: -1, fishTotal: 0, tunnelTo: -1e9,
      biome: 0, biomeT: 0, shake: 0,
      state: 'run', endT: 0, best: 0, crashAt: null, tapFlash: 0, zoneT: 0,
      mode: 'free', timeT: 0, clocks: 0, penT: 0, avGap: 0, avPush: 0, avPushN: 0, zoom: 1, trail: [],
      lastTapT: -999, tapPrev: -999, tapX: 0, tapD: -1e9, tapDir: 0, perfects: 0, perfT: 0, perfX: 0, perfD: 0,
      perfChain: 0, perfChainBest: 0, lastPerfT: -1e9,
      combo: 0, comboBest: 0, closes: 0, closeT: 0, closeX: 0,
      lives: 0, revives: 0, finds: 0
    };
    W = w;
    if (pendingCourse) {
      w.course = { id: pendingCourse.id, step: pendingCourse.step, i: 0,
                   rows: parseCourse(pendingCourse, CHUTE),
                   tut: !!pendingCourse.tutorial,
                   lessons: pendingCourse.lessons || null };
      w.biome = pendingCourse.biome;
      w.clearUntil = 0;
    }
    /* The tutorial: lessons waiting for their row, the one that is holding
       the hill until he taps, and a short slow while a line is read. The
       hill also stands still until the very first tap. */
    w.lessons = []; w.tutWait = null; w.tutK = 1; w.tutRead = 0;
    w.hold = !!(w.course && w.course.tut);
    /* Time Rush is the open hill against a clock. */
    if (pendingMode === 'rush' && !w.course) { w.mode = 'rush'; w.timeT = RUSH_START; }
    /* Avalanche is the open hill with the snow coming down behind you. */
    if (pendingMode === 'avalanche' && !w.course) { w.mode = 'avalanche'; w.avGap = AV_GAP0; }
    /* The name of the stretch you are on, once as the run begins. Not in
       the tutorial, whose own words sit in that same place. */
    w.zoneT = w.hold ? 0 : ZONE_SHOW;
    w.px = chuteAt(0);
    if (perk().startShield) w.shield = 1;
    /* The combo perks: one starts the run of catches already at ten (x2),
       the other carries a token that forgives a single missed fish. */
    w.combo = perk().comboStart || 0;
    w.comboKeep = perk().comboKeep ? 1 : 0;
    var i;
    var nStreak = Math.round(46 * Math.max(1, LOOK / 620));
    for (i = 0; i < nStreak; i++)
      /* Drawn from the look's own generator (frnd). Once these shared the
         hill's: a `lane` field added and never read took one extra draw per
         streak, every generated hill changed, and a mechanics check that had
         nothing to do with the look started failing. */
      w.streaks.push({ x: frnd(-CHUTE, CHUTE), d: frnd(0, LOOK), len: frnd(40, 130),
                       a: frnd(0.05, 0.22) });
    /* The pool is sized for the thickest weather on the hill; a clear
       stretch simply draws less of it (air.n). */
    var nFlake = Math.round(120 * Math.max(1, (VIEW_W * VIEW_H) / (960 * 540)));
    for (i = 0; i < Math.min(nFlake, 300); i++)
      w.flakes.push({ x: frnd(-VIEW_W, VIEW_W), y: frnd(0, VIEW_H), v: frnd(0.4, 1.5),
                      r: frnd(1, 2.6), ph: frnd(0, 6.2832), sw: frnd(0.6, 1.5) });
    while (w.nextRowD < LOOK) spawnRow();
    return w;
  }

  function hardness() { return clamp(W.dist / HARD_OVER, 0, 1); }
  /* What the spawner decides about a row is keyed to where the ROW is, as
     if it were laid a fixed distance ahead of the player. It used to read
     the player's own distance at the moment the row was laid — and rows
     are laid as far ahead as the screen can see, so a tall phone laid the
     same row earlier, easier, and with different dice than a laptop did.
     SPAWN_LEAD is the stock look-ahead, so on an ordinary screen nothing
     moves by more than a few metres. */
  var SPAWN_LEAD = 620;
  function hardAt(d) { return clamp((d - SPAWN_LEAD) / HARD_OVER, 0, 1); }

  /* How far sideways the penguin can actually get while covering `step` of
     hill — simulated honestly from the worst case: already drifting the wrong
     way at full tilt, and tapping only now. Ice biomes turn lazily, so the
     current grip is part of the answer. The spawner is then allowed to ask
     for a fraction of that, rising with difficulty: at the top end the turn
     has to be near perfect, but it is never impossible. */
  /* The hill's own pace. The spawner proves every row against THIS, not
     against whatever the player is riding — and `slowRamp` only ever makes
     the player slower than it, which leaves more time to turn, never less.
     A perk that sped him up would have to be proved against instead. */
  function speedAt(d) { return Math.min(SPEED_MAX, SPEED0 + d * SPEED_RAMP); }
  function rampOf() { return perk().slowRamp || 1; }
  /* 0 at the top of the hill, 1 at terminal velocity. Everything that has
     to look faster reads off this one number. */
  function pace() { return clamp((W.speed - SPEED0) / (SPEED_MAX - SPEED0), 0, 1); }

  /* A row is laid down LOOK units before anyone rides it, and the hill may
     have changed by then. Biome length is measured in distance, so which ice
     will be underfoot when this row arrives is known exactly. */
  function gripAt(d) {
    var ahead = Math.max(0, d - W.dist);
    var i = W.biome + Math.floor((W.biomeT + ahead) / zoneLen());
    return BIOMES[i % BIOMES.length].grip;
  }

  /* How far sideways the penguin can actually get while covering `step` of
     hill, simulated from the worst case he can be in: already drifting the
     wrong way at full tilt, tapping only now, on the least grippy ice he
     will be standing on. The spawner may then ask for a fraction of that,
     rising with difficulty — near the top the turn has to be sharp, but it
     is never more than the physics allows. */
  function reachOver(step, hard, d) {
    var speed = speedAt(d);
    var frames = Math.max(1, Math.floor(step / speed));
    /* A row can land exactly on a zone boundary, where the penguin crosses
       the line in the same instant he reaches it. Sample just past the row
       as well, so the promise is made on the grip he will actually have
       underfoot rather than the one he had a frame earlier. */
    var t = TURN * Math.min(gripAt(d - step), gripAt(d), gripAt(d + 12));
    var x = 0, vx = -DRIFT * speed;
    for (var i = 0; i < frames; i++) { vx += (DRIFT * speed - vx) * t; x += vx; }
    return Math.max(0, x) * lerp(0.60, 0.93, hard);
  }
  function reachBetweenRows() { return W ? reachOver(W.lastStep, hardAt(W.nextRowD), W.nextRowD) : 0; }

  /* One stable number per (row, column). A marked run has to come out the
     same every time, so the sides cannot be random — but keying them to the
     column alone, as they were, gave every row the identical wall of trees
     and boulders all the way down the course. Mixing the row index in keeps
     it repeatable and stops it repeating. */
  function courseNoise(row, col, salt) {
    var n = (row * 73856093) ^ (col * 19349663) ^ (salt * 83492791);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  /* Which of several silhouettes a boulder or pine wears. Read off the
     rotation the spawner already gave it, so it is stable for a given
     object and deterministic on a marked run without a single spawn site
     having to change. Every pine used to be the identical spiky star and
     every boulder the identical capped lump — nine of them in one frame
     read as a tiled texture rather than a hillside. */
  function formOf(o, n) {
    return Math.floor(((o.rot * 5.21) % 1 + 1) % 1 * n) % n;
  }

  function rockPts() {
    var p = [];
    for (var k = 0; k < 9; k++) p.push(0.70 + frand() * 0.44);
    return p;
  }

  /* A marked run is read, not invented. Everything the generator would
     decide — where the opening is, how wide, what is in it — is already
     written down, so the hill comes out the same every single time. */
  /* ---- after a row is laid: nothing where it cannot be ----
     Things turned up under a bridge, over a crevasse, out on the bank,
     inside a boulder, and trees stood in the lava (owner, 12 Nov 2026):
     a row's fish and finds run on past it, and the bridge or crevasse that
     comes next is decided after they are laid. So once a row is down, this
     goes over what lies beyond the top of the screen and puts it right. It
     only ever takes a thing away, slides a pickup over or fits a drift
     smaller — it never draws a random number, so a seed is still the same
     hill for every creature. test/placement.js holds it to this. */
  var PICKUPS = { fish: 1, gold: 1, find: 1, bubble: 1, clock: 1, rush: 1, chill: 1, sight: 1, call: 1 };
  function bankEdge(d, side) { return CHUTE + Math.sin(d * 0.011 + side * 2.1) * 9 + Math.sin(d * 0.03) * 4; }
  function laidReach(o) {                          // how far a thing reaches on the ice, as drawn
    if (o.t === 'drift') return o.r * 0.9;
    if (o.t === 'rock' || o.t === 'tree') return o.r * 0.9;
    return o.r || 0;
  }
  /* gathered once a row: what stands, and what spans the run */
  var tidySolids = [], tidySpans = [];
  function solidNear(x, d, rr, except) {          // a boulder, tree or geyser within rr of (x, d)
    for (var i = 0; i < tidySolids.length; i++) {
      var q = tidySolids[i];
      if (q === except || q._gone) continue;
      var need = laidReach(q) + rr, dx = q.x - x, dd = q.d - d;
      if (dx * dx + dd * dd < need * need) return q;
    }
    return null;
  }
  function inSpan(o, rr) {                         // under a roof, over a crevasse, on a nunatak, on a ramp
    for (var i = 0; i < tidySpans.length; i++) {
      var q = tidySpans[i];
      if (q === o) continue;
      if (q.t === 'tunnel' && o.d + rr > q.d - 10 && o.d - rr < q.d + q.span + 20) return q;
      if (q.t === 'crevasse' && o.d + rr > q.d - 12 && o.d - rr < q.d + q.span + 12) return q;
      if (q.t === 'nunatak' && o.d > q.d - 10 && o.d < q.d + q.span + 10 &&
          Math.abs(o.x - q.x) < q.w / 2 + rr * 0.4) return q;
      if (q.t === 'ramp' && !PICKUPS[o.t] && Math.abs(o.x - q.x) < q.w / 2 * 1.2 + rr &&
          o.d + rr > q.d - 30 && o.d - rr < q.d + 26) return q;       // a boulder or geyser in the ramp
    }
    return null;
  }
  /* A fish or a find that fell under a bridge or over a crevasse is not
     thrown away: the shoal carries on past it, on the same line, its
     spacing halved, where the stretch beyond is kept clear of boulders.
     Thrown away, they took a fifth of the fish out of a run and the shop
     came that much slower (economy.js). */
  function pickupNear(o, d) {
    for (var i = 0; i < W.objects.length; i++) {
      var q = W.objects[i];
      if (q !== o && !q._gone && PICKUPS[q.t] && Math.abs(q.d - d) < 30 && Math.abs(q.x - o.x) < 30) return true;
    }
    return false;
  }
  function carryPast(o, q, rr) {
    var start = q.t === 'tunnel' ? q.d - 10 : q.d - 12, end = q.d + q.span + (q.t === 'tunnel' ? 20 : 12);
    var rel = o.x - chuteAt(o.d), nd = end + rr + 24 + Math.max(0, o.d - start) * 0.5;
    for (var tries = 0; tries < 4 && pickupNear(o, nd); tries++) nd += 34;
    o.d = nd; o.x = chuteAt(nd) + rel;
    return !inSpan(o, rr);
  }
  function tidyLaid() {
    var from = W.dist + PLAYER_Y / 0.9 + 60, out = [], i, o, any = false;
    tidySolids = []; tidySpans = [];
    for (i = 0; i < W.objects.length; i++) {
      o = W.objects[i];
      if (o.d + (o.span || 0) < from - 120) continue;                // long behind what is being judged
      if (o.t === 'rock' || o.t === 'tree' || o.t === 'geyser') tidySolids.push(o);
      else if (o.t === 'tunnel' || o.t === 'crevasse' || o.t === 'nunatak' || o.t === 'ramp') tidySpans.push(o);
    }
    /* first what stands (geysers, then boulders and trees), so a pickup is
       then judged against what is still there */
    for (var pass = 0; pass < 3; pass++) {
      for (i = 0; i < W.objects.length; i++) {
        o = W.objects[i];
        if (o._gone || o.d < from) continue;
        var t = o.t, rr = laidReach(o);
        if (pass === 0 && t !== 'geyser') continue;
        if (pass === 1 && t !== 'rock' && t !== 'tree' && t !== 'drift' && t !== 'gate') continue;
        if (pass === 2 && !PICKUPS[t]) continue;
        var c = chuteAt(o.d), rel = o.x - c, side = rel < 0 ? -1 : 1, edge = bankEdge(o.d, side);
        var sp = inSpan(o, rr);
        if (sp && !(PICKUPS[t] && (sp.t === 'tunnel' || sp.t === 'crevasse') && carryPast(o, sp, rr))) { o._gone = true; continue; }
        if (sp) { c = chuteAt(o.d); rel = o.x - c; side = rel < 0 ? -1 : 1; edge = bankEdge(o.d, side); }
        if (t === 'geyser') {
          if (Math.abs(rel) + rr > edge - 4 || solidNear(o.x, o.d, rr * 0.75, o)) o._gone = true;
        } else if (t === 'drift') {
          var fit = (edge - 4 - Math.abs(rel)) / 0.9;
          if (fit < 30) o._gone = true; else if (fit < o.r) o.r = fit;
        } else if (t === 'gate') {
          /* where the arc's two holes go: each as far out as its default,
             but drawn in off the bank and out of any boulder (looks only:
             what scores is o.w, which is not touched) */
          var hw0 = o.w / 2 + PR * 0.95;
          [-1, 1].forEach(function (k) {
            var h = hw0;
            /* in as far as half the scoring zone if it must: an arc a
               little narrower than what scores is generous, not unfair */
            while (h > o.w / 4 && (Math.abs(rel + k * h) + 12 > bankEdge(o.d, rel + k * h < 0 ? -1 : 1) ||
                                   solidNear(o.x + k * h, o.d, 10, null))) h -= 3;
            o[k < 0 ? 'hl' : 'hr'] = h;
          });
        } else if (PICKUPS[t]) {
          /* off the run: slid back on; inside a boulder: slid clear of it,
             whichever way is nearer; and if neither works, not there */
          var lim = edge - 6 - rr;
          if (Math.abs(rel) > lim) o.x = c + side * lim;
          if (solidNear(o.x, o.d, rr * 0.6, null)) {
            var moved = false;
            for (var step = 8; step <= 64 && !moved; step += 8) {
              for (var dir = -1; dir <= 1 && !moved; dir += 2) {
                var nx = o.x + dir * step, nrel = nx - c;
                if (Math.abs(nrel) > bankEdge(o.d, nrel < 0 ? -1 : 1) - 6 - rr) continue;
                if (!solidNear(nx, o.d, rr * 0.6, null)) { o.x = nx; moved = true; }
              }
            }
            if (!moved) o._gone = true;
          }
        }
      }
    }
    for (i = 0; i < W.objects.length; i++) {
      o = W.objects[i];
      if (!o._gone) { out.push(o); continue; }
      any = true;
      if (o.t === 'fish' && W.course && W.fishTotal) W.fishTotal--;   // a marked run's count is of fish you can have
    }
    if (any) W.objects = out;
  }

  function spawnCourseRow(d) {
    var C = W.course;
    var cr = C.rows[C.i++];
    var prevStep = W.lastStep;
    W.lastStep = C.step;
    W.nextRowD += C.step;

    if (!cr) {                                       // past the last row
      if (W.finishD < 0) {
        /* The run-out used to be an empty chute and then the run simply
           stopped: nothing told you the course had ended, so the last two
           seconds read as a bug. Mark it on the hill instead — the glacier
           opens out into a bright apron of blue ice with seracs standing
           either side of the mouth. Natural, and visible from far enough
           back to see it coming. */
        W.finishD = d + 300;
        W.objects.push({ t: 'finish', x: place(0, W.finishD), d: W.finishD });
        /* (on the lava field, out past the channel: they stood in it) */
        var hot = !!biome().lava;
        for (var sk = 0; sk < 6; sk++) {
          var ss = sk < 3 ? -1 : 1, si = sk % 3;
          var sd = W.finishD + (si - 1) * 62;
          W.objects.push({
            t: 'deco', kind: 'rock',
            x: place(ss * (CHUTE + (hot ? 84 + 34 + si * 9 : 18 + si * 20)), sd), d: sd,
            r: 34 + si * 9, rot: sk * 1.7, pts: rockPts()
          });
        }
      }
      return;
    }
    W.lastGap = cr.gap;
    W.rows.push({ d: d, gap: cr.gap, gapW: cr.gapW,
                  reach: reachOver(prevStep, hardAt(d), d), step: prevStep });
    while (W.rows.length && W.rows[0].d < W.dist - BEHIND - 80) W.rows.shift();
    var ls = C.lessons && C.lessons[C.i - 1];
    if (ls) W.lessons.push({ d: d, key: ls.key, want: ls.want || 0, hint: ls.hint || null,
                             shown: false });

    function place(rel, dd) { return chuteAt(dd) + rel; }

    if (cr.crevasse) {
      W.crevs++;
      W.objects.push({ t: 'ramp', x: place(cr.gap, d - RAMP_LEAD), d: d - RAMP_LEAD,
                       w: cr.gapW * (perk().rampWide || 1), used: false });
      W.objects.push({ t: 'crevasse', x: place(0, d), d: d, span: CREV_SPAN, passed: false });
      return;
    }
    if (cr.gate) {
      var cgw = cr.gapW * GATE_W * (perk().gateWide || 1);
      /* Fixed side, so a marked run stays the same run every time. */
      var coff = ((C.i % 2) ? 1 : -1) * (cr.gapW - cgw) * GATE_OFF;
      W.objects.push({ t: 'gate', x: place(cr.gap + coff, d), d: d,
                       w: cgw, passed: false });
    }

    /* The clearance either side of the opening is unchanged — only which
       thing stands where, how big and which way round. The wall is as solid
       as it was; it just stops looking stamped out. */
    var col = 0;
    var underRoof = d < (W.roofTo || -1e9);
    for (var x = -CHUTE + 26; !underRoof && x <= CHUTE - 26; x += 74) {
      col++;
      var n1 = courseNoise(C.i, col, 1), n2 = courseNoise(C.i, col, 2),
          n3 = courseNoise(C.i, col, 3), n4 = courseNoise(C.i, col, 4);
      /* Nudge it sideways first, then test the clearance against where it
         actually ends up. Testing the nominal column and shifting afterwards
         would let a boulder creep 11px into the opening and quietly narrow
         every course. */
      var jx = x + Math.round(n4 * 22) - 11;
      if (Math.abs(jx - cr.gap) < cr.gapW / 2 + 28) continue;
      var dd = d + Math.round(n1 * 38) - 19;
      W.objects.push({
        t: n2 < 0.58 ? 'tree' : 'rock',
        x: place(jx, dd), d: dd,
        r: 27 + Math.round(n3 * 11), rot: n4 * 6.28, pts: rockPts()
      });
    }
    spawnScenery(d);

    if (cr.fish) {
      var sweep = Math.min(58, cr.gapW / 2 + 8);
      for (var i = 0; i < 4; i++) {
        var fd = d + i * 46 - 44;
        W.objects.push({ t: 'fish', x: place(cr.gap + Math.sin(i * 0.85) * sweep, fd),
                         d: fd, r: 15, got: false, ph: i * 1.1 });
        W.fishTotal++;
      }
    }
    if (cr.gold)
      W.objects.push({ t: 'gold',
                       x: place(clamp(cr.gap + 120, -CHUTE + 24, CHUTE - 24), d + 20),
                       d: d + 20, r: 19, got: false, ph: 1.4 });
    if (cr.bubble)
      W.objects.push({ t: 'bubble', x: place(cr.gap, d + 90), d: d + 90, r: 24,
                       got: false, ph: 2.2 });
    if (cr.drift) {
      /* Alternating sides, and held inside the run: written against a row
         whose opening is already hard over, a fixed offset put the patch
         out on the bank where nobody would ever touch it. */
      var dsx = clamp(cr.gap + ((C.i % 2) ? -1 : 1) * 120, -CHUTE + 34, CHUTE - 34);
      W.objects.push({ t: 'drift', x: place(dsx, d + 20), d: d + 20,
                       r: 58, ph: 1.0 });
    }
    if (cr.geyser) {
      var gso = ((C.i % 2) ? 1 : -1), gsx = cr.gap + geyserOff(cr.gapW, gso);
      if (Math.abs(gsx) > CHUTE - 30) gsx = cr.gap + geyserOff(cr.gapW, -gso);
      if (Math.abs(gsx) <= CHUTE - 30)
        W.objects.push({ t: 'geyser', x: place(gsx, d), d: d,
                         r: GEYSER_R, ph: 0 });
    }
    ['chill', 'sight', 'call'].forEach(function (k, ki) {
      if (!cr[k]) return;
      W.objects.push({ t: k, x: place(clamp(cr.gap + 100, -CHUTE + 28, CHUTE - 28), d + 40),
                       d: d + 40, r: 22, got: false, ph: 0.4 + ki });
    });
    if (cr.rush)
      W.objects.push({ t: 'rush', x: place(cr.gap, d + 60), d: d + 60, r: 25,
                       got: false, ph: 1.6 });
    if (cr.tunnel) {
      var ts = C.step * 1.6;
      W.objects.push({ t: 'tunnel', x: place(0, d + 40), d: d + 40,
                       span: ts, ph: 1.1 });
      W.roofTo = Math.max(W.roofTo || -1e9, d + 40 + ts + 230);
    }
    if (cr.find)
      W.objects.push({ t: 'find',
                       x: place(clamp(cr.gap + 110, -CHUTE + 30, CHUTE - 30), d + 40),
                       d: d + 40, r: 23, got: false, ph: 0.8 });
  }

  function spawnRow() {
    spawnRowRaw();
    tidyLaid();
  }
  function spawnRowRaw() {
    var d = W.nextRowD;
    if (W.course) return spawnCourseRow(d);
    var hard = hardAt(d), at = d - SPAWN_LEAD;
    var gapW = lerp(215, 84, hard);
    var prevStep = W.lastStep;
    var reach = reachOver(prevStep, hard, d);

    var step = lerp(ROW_GAP0, ROW_GAP1, hard);
    /* Past full difficulty the hill used to stop getting harder at all, and
       a good player could ride on for many minutes. The rows keep doubling
       up a little more often over the next stretch instead. Same single
       draw as before, so the dice are not disturbed — only the odds. */
    var past = clamp((at - HARD_OVER) / HARD_OVER, 0, 1);
    if (Math.random() < lerp(0, 0.3, hard) + 0.14 * past) step *= 0.62;    // rows doubling up
    W.lastStep = step;
    W.nextRowD += step;
    var lo = Math.max(-CHUTE + gapW / 2, W.lastGap - reach);
    var hi = Math.min(CHUTE - gapW / 2, W.lastGap + reach);
    if (lo > hi) lo = hi = clamp(W.lastGap, -CHUTE + gapW / 2, CHUTE - gapW / 2);
    var gap = rnd(lo, hi);
    /* Coming off a fork the two ways have to become one again, and which
       one you took is not known here. The row that closes a fork is pinned
       to the point both sides were proved to reach. */
    if (W.forceGap !== null) {
      if (W.forceGapW) gapW = Math.min(W.forceGapW, 2 * CHUTE - 48);
      gap = clamp(W.forceGap, -CHUTE + gapW / 2, CHUTE - gapW / 2);
      W.forceGap = null; W.forceGapW = 0;
    }
    W.lastGap = gap;
    W.rows.push({ d: d, gap: gap, gapW: gapW, reach: reach, step: prevStep });
    while (W.rows.length && W.rows[0].d < W.dist - BEHIND - 80) W.rows.shift();

    /* Rows reason in chute-relative space, but every object is stored in
       absolute world x. Mixing the two put the rocks outside the run. */
    function place(rel, dd) { return chuteAt(dd) + rel; }

    /* Now and then the row is a crevasse instead. Nothing else is placed on
       it, and the stretch beyond stays clear so nobody lands on a boulder
       they were never given the chance to avoid. */
    if (d > 1500 && d > W.clearUntil && Math.random() < lerp(0.05, 0.17, hard)) {
      W.crevs++;
      W.objects.push({ t: 'ramp', x: place(gap, d - RAMP_LEAD), d: d - RAMP_LEAD,
                       w: gapW * (perk().rampWide || 1), used: false });
      W.objects.push({ t: 'crevasse', x: place(0, d), d: d,
                       span: CREV_SPAN, passed: false });
      W.clearUntil = d + CREV_SPAN + 200;
      return;
    }

    /* The landing lane is kept clear of things that can HURT you. It used to
       skip the whole row, fish included, which left long dead stretches and
       quietly made the run a good deal easier than it was meant to be. */
    var clearLane = d < W.clearUntil;

    spawnScenery(d);

    /* Narrower than the opening AND off to one side of it. Centred it was
       free score: the line that gets you through the row alive is the
       middle, and a gate on the middle is taken without deciding anything.
       Shifted over, it costs you the safest line to collect it. */
    if (Math.random() < 0.15 && at > 900) {
      /* The walrus reads the blue ice, so for him the tongue of it is
         broader — he does not have to leave the safe line as far to be on
         it. Tripling what a gate pays without this made the perk a trap:
         it bought a reason to take a risk and nothing to make the risk
         smaller, and over 60 runs the walrus earned 90 coins against the
         100-fish mitten's 108. */
      var gw = gapW * GATE_W * (perk().gateWide || 1);
      var off = (Math.random() < 0.5 ? -1 : 1) * (gapW - gw) * GATE_OFF;
      W.objects.push({ t: 'gate', x: place(gap + off, d), d: d,
                       w: gw, passed: false });
    }

    if (!clearLane) for (var x = -CHUTE + 26; x <= CHUTE - 26; x += rnd(62, 96)) {
      if (Math.abs(x - gap) < gapW / 2 + 28) continue;
      if (Math.random() > lerp(0.60, 0.94, hard)) continue;
      var dd = d + rnd(-26, 26);
      W.objects.push({
        t: Math.random() < 0.58 ? 'tree' : 'rock',
        x: place(x + rnd(-10, 10), dd), d: dd,
        r: rnd(26, 40), rot: rnd(0, 6.28), pts: rockPts()
      });
    }
    /* Mostly MORE strings, only a little longer: scaling both by the same
       factor multiplied out to nearly four times the fish, which is far more
       than one 850-fish skin should be worth. */
    /* ---- a perk may not change the HILL ----------------------------
       Everything below draws its random numbers BEFORE asking whether the
       thing it is placing exists, and always draws the same count. It
       reads oddly and it matters: a perk that gates a spawn used to change
       how many numbers came out of the stream on that row, so every row
       after it came out differently. Two skins were never riding the same
       hill, which is exactly what `economy.js` and `ladder.js` set out to
       compare. The seal looked 20% short of the free skin over twenty
       runs; most of that was the two of them being measured on different
       mountains. */
    var shoal = perk().shoal || 1;
    var longer = 1 + (shoal - 1) * 0.45;
    var shoalRoll = Math.random(), lenRoll = Math.random();
    var phase = rnd(0, 6.28), fishPh = [];
    for (var fp = 0; fp < 8; fp++) fishPh.push(rnd(0, 6.28));
    if (shoalRoll < Math.min(0.85, 0.3 * shoal)) {
      var n = Math.min(8, 2 + ((lenRoll * 3 * longer) | 0));
      /* The shoal weaves across the lane instead of sitting on the racing
         line. On the line it was free score that asked nothing of you — and
         it made the reach perk worthless, because you already passed within
         a few units of every fish. The sweep is kept inside the opening so
         chasing one never walks you into a boulder. */
      var sweep = Math.min(58, gapW / 2 + 8);
      for (var i = 0; i < n; i++) {
        var fd = d + i * 46 - 44;
        W.objects.push({ t: 'fish',
                         x: place(gap + Math.sin(phase + i * 0.85) * sweep, fd), d: fd,
                         r: 15, got: false, ph: fishPh[i] });
      }
    }
    var goldRoll = Math.random(), goldSide = Math.random() < 0.5 ? -1 : 1;
    var goldOff = rnd(90, 150), goldPh = rnd(0, 6.28);
    if (goldRoll < Math.min(0.5, 0.13 * (perk().goldRate || 1)) && at > 1200) {
      var gd = d + 20;
      W.objects.push({ t: 'gold',
                       x: place(clamp(gap + goldSide * goldOff,
                                      -CHUTE + 24, CHUTE - 24), gd),
                       d: gd, r: 19, got: false, ph: goldPh });
    }
    /* Clock bubbles, in Time Rush only — and the dice for them are only
       rolled there, so the open hill draws exactly the same random numbers
       it always did and every Freeride check sees the same hills. Off the
       line like the golden fish: time is earned by leaning out for it.
       Thinner as the hill hardens, so a run cannot go on for ever. */
    if (W.mode === 'rush' && Math.random() < lerp(0.5, 0.1, hard)) {
      var cside = Math.random() < 0.5 ? -1 : 1, cdd = d + 60;
      W.objects.push({ t: 'clock',
                       x: place(clamp(gap + cside * rnd(60, 130), -CHUTE + 26, CHUTE - 26), cdd),
                       d: cdd, r: 27, got: false, ph: rnd(0, 6.28) });
    }
    /* Offered whether or not he is already carrying one: whether he is
       depends on when the row happens to be laid, which depends on the
       screen. Taking a second one simply keeps the one he has. */
    if (Math.random() < 0.055 && at > 1800) {
      var bd = d + 90;
      W.objects.push({ t: 'bubble', x: place(gap + rnd(-16, 16), bd), d: bd, r: 24,
                       got: false, ph: rnd(0, 6.28) });
    }
    /* A patch of deep soft snow. Never on the racing line's centre — it is
       a cost, not a wall, and it should be something you choose to clip. */
    if (Math.random() < 0.038 && at > 900) {
      var bd2 = d + rnd(-40, 60);
      W.objects.push({ t: 'drift',
                       x: place(clamp(gap + (Math.random() < 0.5 ? -1 : 1) * rnd(55, 150),
                                      -CHUTE + 40, CHUTE - 40), bd2),
                       d: bd2, r: rnd(40, 72), ph: rnd(0, 6.28) });
    }

    /* A meltwater geyser, standing off to one side of the opening. */
    if (Math.random() < 0.040 && at > 2600) {
      var side2 = Math.random() < 0.5 ? -1 : 1;
      var gx2 = gap + geyserOff(gapW, side2);
      /* If that side has run out of chute, try the other one, and if
         neither fits, let the row go without a geyser rather than crowd
         the opening. */
      if (Math.abs(gx2) > CHUTE - 30) gx2 = gap + geyserOff(gapW, -side2);
      if (Math.abs(gx2) <= CHUTE - 30)
        W.objects.push({ t: 'geyser', x: place(gx2, d), d: d,
                         r: GEYSER_R, ph: 0 });
    }

    /* The three readable finds. Each sits off the racing line like the
       golden fish does, so taking one costs you the safe line. */
    if (Math.random() < 0.030 && at > 1400) {
      var pk = ['chill', 'sight', 'call'][(Math.random() * 3) | 0];
      var kd = d + 50;
      W.objects.push({ t: pk,
                       x: place(clamp(gap + (Math.random() < 0.5 ? -1 : 1) * rnd(60, 130),
                                      -CHUTE + 28, CHUTE - 28), kd),
                       d: kd, r: 22, got: false, ph: rnd(0, 6.28) });
    }

    /* A drift of loose powder packed into a ball. Take it and he gathers
       it as he goes, and for a while nothing on the hill can stop him. */
    if (Math.random() < 0.013 && at > 2000 && at > W.lastRush + 2600) {
      var rd = d + 70;
      W.lastRush = d;               // spaced from the last one OFFERED, row by row
      W.objects.push({ t: 'rush',
                       x: place(clamp(gap + (Math.random() < 0.5 ? -1 : 1) * rnd(50, 120),
                                      -CHUTE + 30, CHUTE - 30), rd),
                       d: rd, r: 25, got: false, ph: rnd(0, 6.28) });
    }

    /* A snow bridge over the run: drifted snow that has arched across the
       chute and frozen there. You pass underneath it. It is not a hazard —
       it darkens the stretch it covers, so the line is harder to read
       without ever being hidden. */
    if (Math.random() < 0.035 && at > 2400 && d > W.tunnelTo + 900) {
      var tspan = rnd(300, 520);
      W.objects.push({ t: 'tunnel', x: place(0, d), d: d, span: tspan, ph: rnd(0, 6.28) });
      W.tunnelTo = d + tspan;
      /* The roof is solid, so anything standing under it would be a hazard
         the player cannot see. The bridge covers a clear stretch instead:
         it is a held breath, not a guessing game. */
      /* And a clear beat past the far mouth: you come out of a bridge with
         no idea what the hill is doing, so the first thing you meet must
         not already be on top of you. */
      W.clearUntil = Math.max(W.clearUntil, d + tspan + 260);
      W.roofTo = Math.max(W.roofTo || -1e9, d + tspan + 40);
    }

    /* A nodule of clear ice with something frozen into it. Rare on purpose:
       roughly one every eighty rows, so a long run turns up one or two and
       a short one usually turns up none. It sits off the racing line, like
       the golden fish, so finding one costs you something. */
    if (Math.random() < 0.012 && at > 1200) {
      var nd = d + 60;
      W.objects.push({ t: 'find',
                       x: place(clamp(gap + (Math.random() < 0.5 ? -1 : 1) * rnd(70, 140),
                                      -CHUTE + 30, CHUTE - 30), nd),
                       d: nd, r: 23, got: false, ph: rnd(0, 6.28) });
    }

    /* ---- the fork ---------------------------------------------------
       A nunatak: rock that never got buried, standing up through the run
       a little way past this row and splitting it in two. It is laid on
       the line the row was just proved to reach, so both ways past it ask
       the same of you — and the narrower of the two is the one with the
       gold down it. That is the whole idea: the first thing in the game
       you choose rather than dodge, chosen with the same single tap.

       It is laid last, after the row is finished, because the row has to
       be an ordinary one: you need somewhere proved to be standing when
       the rock comes into view. */
    if (d > 3000 && d > W.forkTo && !clearLane && Math.random() < 0.05) {
      var flead = 300, fspan = rnd(360, 580);
      /* Two limits on how big the rock may be. It may be no wider than he
         can get clear of by the time it is at its widest — and its flank
         may not recede faster than he can follow it back in on the far
         side, or there is no way back to the line the two lanes close on. */
      var fcap = Math.min(reachOver(flead + fspan * 0.5, hard, d + flead + fspan * 0.5)
                          - PR * 0.74 - 26,
                          fspan * 0.18);
      var fihw = Math.min(rnd(58, 104), fcap);
      var froomL = gap - fihw + CHUTE, froomR = CHUTE - gap - fihw;
      if (fihw >= 44 && froomL >= FORK_MIN && froomR >= FORK_MIN) {
        var fd0 = d + flead;
        W.objects.push({ t: 'nunatak', rel: gap, x: place(gap, fd0), d: fd0,
                         span: fspan, w: fihw * 2, ph: rnd(0, 6.28),
                         el: nunFacets(), er: nunFacets() });

        /* The tighter way past is the one that pays. Nothing is marked and
           nothing is explained: you can see both lanes and you can see
           where the gold is. */
        var frich = froomL < froomR ? -1 : 1, fwide = Math.max(froomL, froomR);
        /* Both strings run right alongside the rock rather than down the
           middle of their lane. That is the line the proof covers — the
           spawner guarantees he can get clear of the flank, not that he can
           get out to the bank — and it is the line worth riding, because a
           reward on the tight side is only a reward if it can be had. The
           figure is the one the cap above leaves room for: at PR * 1.15 it
           sat exactly on the limit, and a tap landing a frame late put him
           into the flank. */
        var fhug = fihw + PR * 1.05;
        var fcx = gap + frich * fhug;                   // the tight side
        var fpx = gap - frich * fhug;                   // the open one
        var fn = 3 + ((Math.random() * 3) | 0);
        for (var fi = 0; fi < fn; fi++) {
          var ffd = fd0 + 50 + fi * (fspan - 100) / Math.max(1, fn - 1);
          W.objects.push({ t: 'fish', x: place(fcx, ffd), d: ffd,
                           r: 15, got: false, ph: rnd(0, 6.28) });
          W.objects.push({ t: 'fish', x: place(fpx, ffd), d: ffd,
                           r: 15, got: false, ph: rnd(0, 6.28) });
        }
        var fgd = fd0 + fspan * 0.5;
        W.objects.push({ t: 'gold', x: place(fcx, fgd), d: fgd,
                         r: 19, got: false, ph: rnd(0, 6.28) });

        /* A row at the spine's far tip, pointing down the OPEN side, close
           in. It is the line anyone not going after the gold should be on,
           and it holds the aim inside a lane for as long as the rock is
           alongside. Without it the thing to steer at while the rock is
           still there is the opening past it, and the way to that opening
           runs through the rock. */
        W.rows.push({ d: fd0 + fspan, gap: gap - frich * (fihw + 46),
                      gapW: Math.min(fwide, 150), reach: reach, step: fspan });

        /* And past the tip the two lanes become one again. The closing
           opening is held wide enough to take both of them — it spans the
           rock's own width and a little more — so whichever side he rode,
           and however far out on it, he is already most of the way into
           it. A run-out as long as the run-in covers the rest. */
        W.nextRowD = fd0 + fspan + flead;
        W.lastStep = flead;
        W.lastGap = gap;
        W.forceGap = gap;
        W.forceGapW = Math.max(gapW, fihw * 2 + 110);
        W.clearUntil = Math.max(W.clearUntil, fd0 + fspan + flead * 0.6);
        W.forkTo = fd0 + fspan + flead + 3200;
        /* Blocks shed off the ends of it, sitting in the drift. They are
           scenery, not hazards — the lanes have to stay open — but they
           stop the rock from reading as one clean leaf dropped on the
           ice. */
        for (var fb = 0; fb < 3; fb++) {
          var fbd = fd0 + (fb === 0 ? frnd(-54, -16) : frnd(fspan + 10, fspan + 56));
          W.objects.push({ t: 'deco', kind: frand() < 0.8 ? 'rock' : 'tree',
                           x: place(gap + frnd(-26, 26), fbd), d: fbd,
                           r: frnd(14, 26), rot: frnd(0, 6.28), pts: rockPts() });
        }
        spawnScenery(fd0 + fspan * 0.4);
        spawnScenery(fd0 + fspan * 0.85);
      }
    }
  }

  /* What is actually ON the ice. Long stretches of the run were a flat
     field of blue with a few streaks over it; real ice is cracked, has old
     air trapped in it, and keeps the grooves of everything that came down
     before you. All of it is pinned to world distance so it scrolls with
     the hill rather than crawling on the glass, and all of it is keyed to
     that distance so the same stretch looks the same every time.

     Called from inside drawChute's clip, so none of it can stray onto the
     banks. */
  function drawIceDetail(B) {
    if (SPARE) return;                 // grooves, cracks and air in the ice: looks only
    var i, k, d, y, cx, h;
    /* A mark in the ice is the ice with light taken out of it. Keying the
       colour to B.bankShade looked right and was invisible: on most of the
       hill the bank shade is within a few points of the ice it would be
       drawn on. Same neutral grey the bridge shadow uses, at the same
       biome-aware strength, halved — these are hairlines, not shadows. */
    var ink = roofInk(B) * 0.62;

    /* ---- old grooves: the lines left by everything that slid here ---- */
    ctx.strokeStyle = 'rgb(' + ROOF_RGB + ')';
    ctx.lineCap = 'round';
    var gstep = 420, gbase = Math.floor((W.dist - 400) / gstep) * gstep;
    for (i = 0; i < 6; i++) {
      d = gbase + i * gstep;
      y = scrY(d);
      if (y < -500 || y > VIEW_H + 200) continue;
      h = Math.abs(Math.sin(d * 0.0131));
      cx = scrX(chuteAt(d) + (h * 2 - 1) * CHUTE * 0.8);
      ctx.globalAlpha = ink * (0.34 + h * 0.26);
      ctx.lineWidth = 2 + h * 2;
      for (k = 0; k < 2; k++) {                       // a pair, like runners
        ctx.beginPath();
        ctx.moveTo(cx + k * 13, y - 300);
        ctx.bezierCurveTo(cx + k * 13 + 14, y - 150, cx + k * 13 - 10, y + 80,
                          cx + k * 13 + 6, y + 260);
        ctx.stroke();
      }
    }

    /* ---- cracks ---- */
    var cstep = 150, cbase = Math.floor((W.dist - 200) / cstep) * cstep;
    for (i = 0; i < 16; i++) {
      d = cbase + i * cstep;
      y = scrY(d);
      if (y < -260 || y > VIEW_H + 160) continue;
      h = Math.abs(Math.sin(d * 0.0217 + 1.3));
      cx = scrX(chuteAt(d) + (Math.sin(d * 0.0091) * CHUTE * 0.86));
      var len = 40 + h * 110, wob = (h * 2 - 1);
      ctx.globalAlpha = ink * (0.52 + h * 0.46);
      ctx.lineWidth = 1.4 + h * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      var px2 = cx, py2 = y;
      for (k = 1; k <= 4; k++) {                      // a few kinked segments
        px2 += Math.sin(d * 0.03 + k * 2.1) * 22 + wob * 8;
        py2 += len / 4;
        ctx.lineTo(px2, py2);
      }
      ctx.stroke();
      if (h > 0.62) {                                 // a branch off the main one
        ctx.beginPath();
        ctx.moveTo(cx, y + len * 0.5);
        ctx.lineTo(cx + wob * 46, y + len * 0.5 + 34);
        ctx.stroke();
      }
    }

    /* ---- air trapped in the ice, in clusters ---- */
    var bstep = 130, bbase = Math.floor((W.dist - 150) / bstep) * bstep;
    for (i = 0; i < 20; i++) {
      d = bbase + i * bstep;
      y = scrY(d);
      if (y < -200 || y > VIEW_H + 140) continue;
      h = Math.abs(Math.sin(d * 0.0331 + 2.7));
      if (h < 0.34) continue;
      cx = scrX(chuteAt(d) + Math.sin(d * 0.0073 + 2.1) * CHUTE * 0.88);
      for (k = 0; k < 5; k++) {
        var a2 = k * 1.9 + d * 0.01;
        var rr2 = 2 + ((k * 7 + i * 3) % 4);
        /* Trapped air is brighter than the ice, not darker, so plain white
           reads on every stretch including the dark ones. */
        ctx.globalAlpha = 0.22 + h * 0.20;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a2) * (9 + k * 7), y + Math.sin(a2) * (7 + k * 5),
                rr2, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* Trees and boulders standing off the run itself. They never collide —
     they are there because on a wide screen the banks are most of the
     picture, and an empty field of snow reads as a bar rather than a place.
     They stay well clear of the bank edge so nothing looks like a hazard
     you were meant to dodge. */
  function spawnScenery(d) {
    var half = VIEW_W / 2 + 150;
    var room = half - CHUTE - 80;
    if (room < 60) return;
    var n = Math.min(5, 1 + Math.round(room / 230));
    for (var i = 0; i < n; i++) {
      var side = frand() < 0.5 ? -1 : 1;
      var dd = d + frnd(-95, 95), kind = frand() < 0.62 ? 'tree' : 'rock', fr = frand(), dr = frnd(19, 37);
      /* clear of the bank and of the lava channel that runs along it on
         the lava field (18 to 68 out), whatever the stretch: a tree used
         to stand in the lava */
      var out = 70 + dr + 14;
      W.objects.push({
        t: 'deco', kind: kind,
        x: chuteAt(dd) + side * (CHUTE + out + fr * Math.max(0, room + 80 - out)),
        d: dd, r: dr, rot: frnd(0, 6.28), pts: rockPts()
      });
    }
  }

  /* world position -> screen. One to one: no perspective anywhere. */
  function scrX(worldX) { return VIEW_W / 2 + (worldX - chuteHere()); }
  function scrY(d) { return PLAYER_Y - (d - W.dist); }

  /* --------------------------- input -------------------------- */
  function tap() {
    if (!W || W.state !== 'run') return;
    /* The tutorial's first tap only lets the hill go; it does not turn him,
       or the very first lesson would be answered before it was asked. */
    if (W.hold) { W.hold = false; lesson({ key: null }); return; }
    W.dir = -W.dir;
    W.tapFlash = 8;
    W.tapPrev = W.lastTapT; W.lastTapT = W.t; W.tapX = W.px; W.tapD = W.dist; W.tapDir = W.dir;
    Sfx.turn();
    for (var i = 0; i < 4; i++)
      W.puffs.push({ x: W.px - W.dir * 8, d: W.dist - 6, life: 18, max: 18, s: frnd(5, 11) });
    /* He digs in to turn: his body gives for a moment, and the edge he
       carves throws a fan of snow out of the turn and behind him. */
    W.squash = 1;
    for (i = 0; i < 12; i++)
      W.spray.push({ x: W.px - W.dir * 6, d: W.dist - 4, vx: -W.dir * frnd(1.2, 4.2), vd: -frnd(0.5, 3.4),
                     life: 26, max: 26, s: frnd(1.6, 3.4) });
  }

  /* Two fingers pause, and the first of them has already turned him. Put
     that back so pausing never costs you the line you were on. */
  function undoTap() {
    if (!W || W.state !== 'run') return;
    W.dir = -W.dir;
    W.tapFlash = 0;
  }

  /* ---------------------------- step -------------------------- */
  /* ---- the hill behind the menu ----
     On the title the hill is alive: the chosen animal sliding down it,
     weaving gently, the stretches going by. A demo, not a run — nothing on
     the ice but the scenery past the banks, nothing to hit, nothing scored
     or saved, and not a sound: every Sfx call it makes goes to a silent
     stand-in while it steps. Any real run simply replaces it. */
  var SILENT = null;
  function silentSfx() {
    if (SILENT) return SILENT;
    SILENT = {};
    for (var k in Sfx) SILENT[k] = typeof Sfx[k] === 'function' ? function () {} : Sfx[k];
    return SILENT;
  }
  /* It steers the way a player does — by turning, with a tap's give and
     spray — towards a line that weaves gently down the middle. */
  function demoPre() {
    W.objects = W.objects.filter(function (o) { return o.t === 'deco'; });
    W.invuln = 1e9; W.grace = 1e9; W.hold = false; W.lives = 0; W.zoneT = 0;
    var want = chuteAt(W.dist + 140) + Math.sin(W.dist * 0.0037) * CHUTE * 0.4;
    if ((want - W.px) * W.dir < -26 && W.t - (W.lastTapT || 0) > 24) {
      W.dir = -W.dir; W.lastTapT = W.t; W.squash = 1;
      for (var i = 0; i < 8; i++)
        W.spray.push({ x: W.px - W.dir * 6, d: W.dist - 4, vx: -W.dir * frnd(1.2, 4), vd: -frnd(0.5, 3),
                       life: 24, max: 24, s: frnd(1.4, 3) });
    }
  }
  function demoPost() { W.speed = Math.min(W.speed, 5.2); }
  function step() {
    if (W && W.demo) {
      var keepS = Sfx; Sfx = silentSfx();
      try { demoPre(); stepCore(); if (W) demoPost(); } finally { Sfx = keepS; }
      return;
    }
    stepCore();
  }
  function stepCore() {
    W.t++;
    /* Where he is in his stride, advanced a frame at a time at the rate his
       speed sets now. It was W.t times that rate, so whenever the speed
       changed every frame of the run so far was re-timed at once: coming
       out of the tutorial's slow motion the flippers raced through dozens
       of strokes in a moment, as if the slowed ones had piled up. */
    W.gait = (W.gait || 0) + 0.15 + (W.state === 'run' && !W.hold ? W.speed : 0) * 0.038;
    if (W.shake > 0) { W.shake *= 0.86; if (W.shake < 0.05) W.shake = 0; }
    if (W.tapFlash > 0) W.tapFlash--;
    if (W.squash > 0) W.squash = Math.max(0, W.squash - 0.075);
    if (W.impact > 0) W.impact = Math.max(0, W.impact - 0.05);

    if (W.state !== 'run') {
      W.endT++;
      if (W.zoneT > 0) W.zoneT--;
      if (W.crashAt) W.crashAt.spin += 0.22;
      updPuffs(); updFlakes();
      /* Nothing ends the tutorial but its finish line: a crash puts him
         back on the hill a beat later, the row that got him cleared, and
         no life is spent — a lesson you can fail out of is a bad lesson. */
      /* In Time Rush a crash is paid for in seconds, not with the run. */
      if (W.state === 'crash' && W.mode === 'rush' && W.endT === 30) {
        W.lives++; revive(); W.revives--;
        W.timeT = Math.max(0, W.timeT - CRASH_COST); W.penT = 70;
        if (W.timeT <= 0) { W.state = 'timeup'; W.endT = 0; }
        return;
      }
      /* In Avalanche a crash does not end the run either: he is back on
         the hill a beat later. The snow does not wait while he is down,
         and that is the whole of the cost. */
      if (W.state === 'crash' && W.mode === 'avalanche') {
        avalancheStep(0);
        if (W.state === 'crash' && W.endT === 30) { W.lives++; revive(); W.revives--; }
        return;
      }
      if (W.state === 'crash' && W.course && W.course.tut && W.endT === 30) {
        W.lives++; revive(); W.revives--;
        lesson({ key: 'tut.oops' });
        readFor('tut.oops');
        return;
      }
      if (W.endT === 46 && hooks.over)
        hooks.over({ score: Math.floor(W.score), dist: Math.floor(W.dist / 8),
                     fish: W.fish, gold: W.gold, gates: W.gates, saved: W.saved,
                     coins: W.coins, jumps: W.jumps,
                     finished: W.state === 'finish',
                     mode: W.mode, clocks: W.clocks, perfects: W.perfects, perfChain: W.perfChainBest, caught: W.state === 'caught', closes: W.closes, comboBest: W.comboBest,
                     course: W.course ? W.course.id : null,
                     fishTotal: W.fishTotal,
                     finds: W.finds, revives: W.revives,
                     rushes: W.rushes, smashed: W.smashed, forks: W.forks,
                     /* Only a crash can be walked back, and only while a
                        life is in hand. Crossing the line is final. */
                     canRevive: W.state === 'crash' && W.lives > 0,
                     crashed: W.state === 'crash' });
      return;
    }

    if (W.hold) { updPuffs(); updFlakes(); hud(); return; }

    var B = biome();
    W.speed = Math.min(SPEED_MAX, SPEED0 + W.dist * SPEED_RAMP * rampOf())
              * slowmo() * bogged() * tutPace();
    if (W.bog > 0) W.bog--;
    W.dist += W.speed;
    W.score += W.speed * 0.25;

    var target = W.dir * DRIFT * W.speed;
    /* A grip perk may only ever turn SHARPER. The spawner sizes every
       opening against the biome's own grip, so a sharper turn beats the
       promise rather than breaking it. */
    W.vx = lerp(W.vx, target, turnRate());
    W.px += W.vx;

    var c = chuteHere();
    if (W.px < c - CHUTE + PR) { W.px = c - CHUTE + PR; W.dir = 1;  bank(); }
    if (W.px > c + CHUTE - PR) { W.px = c + CHUTE - PR; W.dir = -1; bank(); }
    W.tilt = lerp(W.tilt, clamp(W.vx / Math.max(1, W.speed), -1.1, 1.1), 0.18);

    for (var i = W.objects.length - 1; i >= 0; i--) {
      var o = W.objects[i];
      /* A tunnel or a crevasse is not a point: its body reaches BACK up the
         screen from o.d, and the far end is the last part to leave the
         frame. Culling on o.d alone deleted a snow bridge a whole span
         early, so it vanished while a third of it was still in view. */
      if (o.d + (o.span || 0) < W.dist - BEHIND) {
        /* Counted here rather than where it is laid down: a rock that fell
           off the back of the world is one he actually got past. */
        if (o.t === 'nunatak') W.forks++;
        W.objects.splice(i, 1); continue;
      }
      var dy = o.d - W.dist, dx = o.x - W.px;

      /* Reach only ever widens what he can PICK UP. The rock test below is
         untouched, so no perk can move the line between a clean pass and a
         crash — only how far he can lean for a fish. */
      /* While the call is up, every fish on the hill leans his way. It
         moves the fish, not his reach: a reach big enough to hoover the
         whole run would quietly swallow the gold off the far side too. */
      if (W.callT > 0 && (o.t === 'fish' || o.t === 'gold') && !o.got) {
        var cdx = W.px - o.x, cdd = W.dist + 60 - o.d;
        var cl = Math.sqrt(cdx * cdx + cdd * cdd);
        if (cl > 1 && cl < 320) {
          var pull = 2.6 * (1 - cl / 320);
          o.x += cdx / cl * pull * 3.4;
          o.d += cdd / cl * pull * 0.9;
        }
      }
      var grab = (o.r + PR) * (perk().reach || 1);
      if ((o.t === 'fish' || o.t === 'gold' || o.t === 'bubble' || o.t === 'find' ||
           o.t === 'rush' || o.t === 'chill' || o.t === 'sight' || o.t === 'call' ||
           o.t === 'clock') && !o.got &&
          Math.abs(dy) < grab && Math.abs(dx) < grab) {
        o.got = true;
        var tone = '#bfe4ff';
        if (o.t === 'fish')      {
          comboUp();
          W.fish++; W.score += 25 * comboMult();
          W.coins += (W.fish <= FIRST_CATCH) ? 2 : 1;      // early catch pays double
          Sfx.berry();
        }
        else if (o.t === 'gold') {
          comboUp(); W.gold++; W.score += 150 * comboMult(); Sfx.gold(); tone = '#ffd83d'; W.tapFlash = 12;
          fx('gold');
        }
        else if (o.t === 'find') { W.finds++; W.score += 60; Sfx.gold(); tone = '#fff0b0'; W.tapFlash = 16; fx('find'); }
        else if (o.t === 'clock') {
          W.timeT += clockGain(); W.clocks++; Sfx.gold(); tone = '#d8ffb0'; W.tapFlash = 10; fx('clock');
        }
        else if (o.t === 'chill') {
          W.chillT = CHILL_FRAMES; Sfx.bubble(); tone = '#bfe4ff'; W.tapFlash = 14;
        }
        else if (o.t === 'sight') {
          W.sightT = SIGHT_FRAMES; Sfx.gold(); tone = '#d6ffa8'; W.tapFlash = 14;
        }
        else if (o.t === 'call') {
          W.callT = CALL_FRAMES; Sfx.berry(); tone = '#9fe8ff'; W.tapFlash = 14;
        }
        else if (o.t === 'rush') {
          W.rushT = RUSH_FRAMES; W.rushes++; fx('rush');
          Sfx.excite(true);
          Sfx.bubble(); tone = '#ffffff'; W.tapFlash = 18; W.shake = Math.max(W.shake, 10);
        }
        else                     { W.shield = 1; Sfx.bubble(); tone = '#9fe8ff'; W.tapFlash = 12; }
        for (var b = 0; b < (o.t === 'fish' ? 7 : 15); b++)
          W.puffs.push({ x: o.x, d: o.d, life: 22, max: 22, s: frnd(4, 11), tint: tone });
      }
      if (o.t === 'ramp' && !o.used && o.d <= W.dist) {
        o.used = true;
        if (Math.abs(dx) < o.w / 2) {
          W.airSpan = AIR_DIST * (perk().rampBoost || 1);
          W.airTo = W.dist + W.airSpan;
          W.jumps++;
          W.shake = Math.max(W.shake, 5);
          Sfx.jump();
          for (var j = 0; j < 12; j++)
            W.puffs.push({ x: W.px + frnd(-14, 14), d: W.dist - frnd(0, 16),
                           life: 24, max: 24, s: frnd(5, 12) });
        }
      }
      if (o.t === 'crevasse' && !o.passed && o.d <= W.dist) {
        o.passed = true;
        /* Nothing on the hill may stop a rush, or catch him in the grace
           after he has just spent a life. A hole that killed him while the
           screen says he cannot be hurt is the nastiest kind of surprise;
           the momentum carries him over instead. */
        if ((rushing() || W.grace > 0) && !airborne()) {
          W.airSpan = AIR_DIST * (perk().rampBoost || 1);
          W.airTo = W.dist + W.airSpan;
          W.jumps++;
          Sfx.jump();
          continue;
        }
        if (!airborne()) {
          /* The bubble is told to take one crash, and a fall down a
             crevasse is a crash. It used to be the one hit it silently did
             not cover, so a player carrying it died to the thing they had
             paid to be protected from. It carries you across rather than
             putting you back on ice that is not there. */
          if (W.shield > 0) {
            W.shield = 0; W.saved++; W.invuln = 80;
            W.airSpan = AIR_DIST * (perk().rampBoost || 1);
            W.airTo = W.dist + W.airSpan;
            W.shake = 14; W.tapFlash = 12;
            Sfx.bubble();
            for (var bq = 0; bq < 18; bq++)
              W.puffs.push({ x: W.px + frnd(-18, 18), d: W.dist + frnd(-10, 10),
                             life: 28, max: 28, s: frnd(5, 13), tint: '#9fe8ff' });
          } else { crash(o); continue; }
        }
      }
      if (o.t === 'gate' && !o.passed && o.d < W.dist) {
        o.passed = true;
        if (Math.abs(dx) < o.w / 2) {
          var gb = perk().gateBonus || 1;
          o.scored = true; o.passT = W.t;    // green means you took it,
          W.gates++;                         // not merely that it is behind you
          comboUp();
          W.score += Math.round(50 * gb) * comboMult();
          W.coins += Math.round(2 * gb);       // gates pay the shop as well
          Sfx.gate(); W.tapFlash = 10; fx('ring');
          if (W.mode === 'avalanche') {
            var before = W.avGap;
            W.avGap = Math.min(AV_CAP, W.avGap + lerp(AV_PUSH0, AV_PUSH1, hardAt(W.dist)));
            W.avPushN = W.avGap - before; W.avPush = 50;
          }
        }
      }
      /* plain circle overlap, in the very pixels being drawn */
      /* Deep snow: he wades. Not a hazard, a tax — and because it only
         ever slows him, it cannot break a row that was proved at pace. */
      if (o.t === 'drift') {
        var bdx = o.x - W.px, bdd = o.d - W.dist;
        if (bdx * bdx + bdd * bdd < (o.r + PR * 0.6) * (o.r + PR * 0.6)) {
          W.bog = 8;
          if (W.t % 5 === 0)
            W.puffs.push({ x: W.px + frnd(-14, 14), d: W.dist - 10,
                           life: 22, max: 22, s: frnd(4, 9) });
        }
        continue;
      }
      /* The spine. It is read off the same curve the painter draws, so the
         clear ice at its tips really is clear ice. */
      if (o.t === 'nunatak') {
        if (W.dist > o.d - 6 && W.dist < o.d + o.span + 6 &&
            !airborne() && W.invuln <= 0 && !rushing()) {
          var nnx = chuteHere() + o.rel, nrel = W.px - nnx;
          if (nrel > -(nunEdge(o, W.dist, -1) + PR * 0.74) &&
              nrel <  (nunEdge(o, W.dist,  1) + PR * 0.74)) {
            if (W.shield > 0) { W.shield = 0; W.saved++; W.invuln = 80; W.shake = 16; }
            else { crash({ x: nnx, d: W.dist, r: 40 }); continue; }
          }
        }
        continue;
      }
      /* A geyser kills only while it is up. */
      if (o.t === 'geyser') {
        if (geyserUp(o) && W.invuln <= 0 && !rushing() && !airborne() &&
            Math.abs(o.x - W.px) < o.r * 0.62 + PR * 0.7 &&
            Math.abs(o.d - W.dist) < o.r * 0.62 + PR * 0.7) {
          if (W.shield > 0) { W.shield = 0; W.saved++; W.invuln = 80; W.shake = 16; }
          else { crash(o); continue; }
        }
        continue;
      }
      /* Rushing, he goes through it. The boulder is removed rather than
         merely ignored, so it cannot come back round and kill him at the
         moment the rush runs out. */
      if (solid(o) && rushing() && !airborne() &&
          Math.abs(o.x - W.px) < o.r * 0.9 + PR * 0.8 &&
          Math.abs(o.d - W.dist) < o.r * 0.9 + PR * 0.8) {
        W.smashed++; W.score += 20;
        W.shake = Math.max(W.shake, 8);
        Sfx.crash();
        for (var sm = 0; sm < 10; sm++)
          W.puffs.push({ x: o.x + frnd(-o.r, o.r), d: o.d + frnd(-o.r, o.r),
                         life: 26, max: 26, s: frnd(5, 13) });
        W.objects.splice(i, 1);
        continue;
      }
      /* A close call: how near he came, kept while the thing is beside
         him, and paid out once it is behind him untouched. */
      if (solid(o) && !o.nearDone) {
        if (Math.abs(dy) < 70) {
          var nd = Math.sqrt(dx * dx + dy * dy) - hitR(o);
          if (o.near === undefined || nd < o.near) o.near = nd;
        }
        if (dy < -20) {
          o.nearDone = true;
          if (o.near !== undefined && o.near >= 0 && o.near < CLOSE_GAP * (perk().closeWide || 1) &&
              W.state === 'run' && !airborne() && !rushing() && W.grace <= 0) {
            W.closes++; W.score += Math.round(15 * (perk().closeBonus || 1)) * comboMult();
            /* A PERFECT is a close call he made himself: the tap that turned
               him away from this very obstacle came in the last moment —
               within about half a second before he reached it, or while he
               was alongside it — and he scraped past. A close call with no
               such tap is just CLOSE. `lead` is how far ahead the obstacle
               was at the tap; below zero he was already level with it. */
            var lead = o.d - W.tapD;
            if (lead > -hitR(o) && lead <= W.speed * 33 && W.tapDir * (W.tapX - o.x) > 0) {
              /* PERFECTs within three seconds of each other chain: x2, x3...
                 each one worth that much more, the flourish climbing */
              W.perfChain = (W.t - W.lastPerfT <= PERF_CHAIN) ? W.perfChain + 1 : 1;
              W.perfChainBest = Math.max(W.perfChainBest, W.perfChain);
              W.lastPerfT = W.t;
              W.perfects++; W.perfT = 50;
              W.perfX = o.x + (W.px > o.x ? 1 : -1) * hitR(o) * 0.8; W.perfD = o.d;
              comboUp();
              W.score += 40 * W.perfChain * comboMult();
              W.tapD = -1e9;                       // one PERFECT per tap
              Sfx.perfect(W.perfChain); fx('perfect');
            } else {
              W.closeT = 55; W.closeX = o.x;
              fx('close');
            }
          }
        }
      }
      /* a fish that went by uncaught breaks the run of catches */
      if (o.t === 'fish' && !o.got && !o.missed && dy < -30) {
        o.missed = true;
        if (W.comboKeep > 0) W.comboKeep = 0;        // the puffin shrugs one off
        else W.combo = 0;
      }
      if (solid(o) && W.invuln <= 0 && !rushing() && !airborne() &&
          dx * dx + dy * dy < hitR(o) * hitR(o)) {
        if (W.shield > 0) {
          W.shield = 0; W.saved++; W.invuln = 80; W.shake = 16; W.tapFlash = 12;
          Sfx.pop(); fx('save');
          for (var q = 0; q < 20; q++)
            W.puffs.push({ x: W.px + frnd(-16, 16), d: W.dist + frnd(-12, 12),
                           life: 26, max: 26, s: frnd(5, 13), tint: '#9fe8ff' });
        } else crash(o);
      }
    }

    while (W.nextRowD < W.dist + LOOK) spawnRow();

    if (W.wasAir && !airborne()) {                   // touchdown
      W.wasAir = false;
      /* You cannot be killed by whatever you happen to come down on. The
         alternative was clearing the hill for as far as the longest possible
         flight, which with a ramp-boosting skin meant hollowing out 600
         units of run every time — the landing lane is for looks now, and
         this is what actually makes the landing fair. */
      W.invuln = Math.max(W.invuln, 30);
      Sfx.land(); fx('land');
      W.shake = Math.max(W.shake, 9);
      for (var lp = 0; lp < 16; lp++)
        W.puffs.push({ x: W.px + frnd(-20, 20), d: W.dist - frnd(0, 18),
                       life: 26, max: 26, s: frnd(5, 14) });
    }
    if (airborne()) W.wasAir = true;

    if (W.course && W.finishD > 0 && W.dist >= W.finishD && W.state === 'run') {
      W.state = 'finish'; W.endT = 0; W.rushT = 0; Sfx.excite(false);
      Sfx.zone(); fx('finish');
      for (var fp = 0; fp < 22; fp++)
        W.puffs.push({ x: W.px + frnd(-26, 26), d: W.dist + frnd(-16, 16),
                       life: 34, max: 34, s: frnd(5, 14), tint: '#ffe08a' });
    }

    tutorial();
    if (W.mode === 'rush' && W.state === 'run') {
      if (--W.timeT <= 0) {
        W.timeT = 0; W.state = 'timeup'; W.endT = 0; W.rushT = 0;
        Sfx.excite(false); Sfx.zone(); fx('timeup');
      }
    }
    if (W.mode === 'avalanche' && W.state === 'run') avalancheStep(W.speed);
    var fsn = freerideSnow();
    if (fsn > 0 && W.t % 330 === 0 && Sfx.rumble) Sfx.rumble(0.35 + 0.65 * fsn);
    /* The groove his belly cuts in the ice, a point every few units of
       hill, broken where he flies; kept only as far back as can be seen. */
    var tr = W.trail, lastT = tr[tr.length - 1];
    if (airborne()) { if (lastT && lastT.x !== null) tr.push({ x: null, d: W.dist }); }
    else if (!lastT || W.dist - lastT.d >= 7)
      /* with where he is in his stride and which way he faces, so an
         animal that runs can leave its footprints where its feet came down */
      tr.push({ x: W.px, d: W.dist, rush: W.rushT > 0, g: W.gait || 0,
                a: Math.atan2(W.vx, Math.max(W.speed, 3)) * 0.85 });
    while (tr.length && tr[0].d < W.dist - BEHIND - 40) tr.shift();
    /* the camera draws back with pace (7% at full speed), and leans in a
       little on a close call */
    var zt = 1 - 0.07 * pace();
    if (W.closeT > 0 || W.perfT > 30) zt = Math.min(1, zt + 0.04);
    W.zoom += (zt - W.zoom) * ((W.closeT > 0 || W.perfT > 30) ? 0.12 : 0.025);
    if (W.penT > 0) W.penT--;
    if (W.closeT > 0) W.closeT--;
    if (W.perfT > 0) W.perfT--;
    if (W.zoneT > 0) W.zoneT--;
    if (W.invuln > 0) W.invuln--;
    if (W.rushT > 0 && --W.rushT === 0) Sfx.excite(false);
    if (W.grace > 0) W.grace--;
    if (W.chillT > 0) W.chillT--;
    if (W.sightT > 0) W.sightT--;
    if (W.callT  > 0) W.callT--;
    if (!W.course) W.biomeT += W.speed;
    /* Carry the overshoot over instead of dropping it: zeroing here makes
       every zone a fraction longer than the last, and the drift eventually
       puts gripAt() in the wrong biome when it places a row near a border.
       A marked run never changes zone at all. */
    if (!W.course && W.biomeT >= zoneLen()) {
      W.biomeT -= zoneLen(); W.biome++; Sfx.zone(); W.tapFlash = 14; W.zoneT = ZONE_SHOW;
      if (Sfx.mood) Sfx.mood(biome().mood || 'base');
    }

    updPuffs(); updFlakes();
    hud();
  }

  /* ---- the tutorial ----
     Each lesson belongs to a row. A line is shown as its row comes into
     view; a lesson that wants a direction is raised earlier — as soon as
     the row before it is behind him — so there is room left to make the
     turn once he has tapped. */
  function lesson(msg) { if (hooks.lesson) hooks.lesson(msg); }
  function tutorial() {
    var C = W.course;
    if (!C || !C.tut) return;
    for (var i = 0; i < W.lessons.length; i++) {
      var L = W.lessons[i];
      if (L.shown) continue;
      var at = L.want ? Math.min(C.step * 0.95, PLAYER_Y + 60) : PLAYER_Y - 30;
      if (L.d - W.dist > at) continue;
      L.shown = true;
      if (L.want && W.dir !== L.want) {
        W.tutWait = L;
        lesson({ key: L.key, want: L.want, wait: true });
      } else if (L.want) {
        /* Already going the right way, by luck or by the bank turning him:
           say so instead of asking for a tap that would turn him wrong. */
        lesson({ key: 'tut.going', want: L.want });
        readFor('tut.going');
      } else {
        lesson({ key: L.key, hint: L.hint });
        readFor(L.key);
      }
    }
    if (W.tutWait && W.dir === W.tutWait.want) {
      W.tutWait = null;
      lesson({ key: 'tut.nice', ok: true });
      readFor('tut.nice');
    }
    if (W.tutRead > 0) W.tutRead--;
    /* The hill eases to a stop while a tap is asked for and eases back off
       after it — never a jump. Lines that only tell you something no
       longer slow it at all: each one used to drop the hill to 60% for
       two and a half seconds, and over a whole lesson the speed lurched up
       and down twenty-odd times, which reads as a game that stutters. */
    /* tutK runs in a straight line (to a stop in half a second, back up in
       0.4 s) and the pace follows it through an S-curve, so the change
       starts and ends softly — an exponential ease made its biggest jump
       on the very first frame, which is the lurch this is here to stop. */
    /* While a tap is asked for the hill does not stop at once: it settles
       into slow motion (45%) and only comes to rest if nobody has tapped by
       the time the opening is close. A player who answers in a second
       never sees it stop at all — stopping dead right after the start was
       a second interruption on top of the first. */
    /* and while a line is up to be read, slow motion too (55%), for as
       long as that line takes to read in the player's language */
    var want = W.tutRead > 0 ? 0.55 : 1;
    if (W.tutWait) {
      var left = W.tutWait.d - W.dist;
      want = left > 110 ? 0.45 : 0.45 * clamp((left - 20) / 90, 0, 1);
    }
    if (W.tutK > want) W.tutK = Math.max(want, W.tutK - 1 / 30);
    else W.tutK = Math.min(want, W.tutK + 1 / 24);
  }
  /* How long a line holds the hill in slow motion: time to read it, from
     its length in the language being shown — two seconds at the least,
     five at the most. */
  function readFor(key) {
    var txt = String(tr(key, '')).replace(/<[^>]+>/g, '');
    W.tutRead = Math.round(clamp(80 + txt.length * 2.4, 120, 300));
  }
  /* Slower is always safe — every row is proved at full pace — so the
     tutorial may bring the hill to a stop while it waits for a tap. */
  function tutPace() {
    if (!W.course || !W.course.tut) return 1;
    var k = W.tutK === undefined ? 1 : W.tutK;
    return k * k * (3 - 2 * k);
  }
  /* While the hill is held for a tap: the edges dim and a ring pulses
     round him, so the stop reads as the game handing him the move, not as
     the game stalling. */
  function drawTutWait() {
    if (!W.course || !W.course.tut || !W.tutWait) return;
    var k = clamp((1 - W.tutK) / 0.55, 0, 1);
    ctx.save();
    var g = ctx.createRadialGradient(VIEW_W / 2, PLAYER_Y - 60, VIEW_H * 0.2, VIEW_W / 2, PLAYER_Y - 60, VIEW_H * 0.9);
    g.addColorStop(0, 'rgba(6,20,52,0)');
    g.addColorStop(1, 'rgba(6,20,52,' + (0.42 * k).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    var ph = (W.t % 50) / 50;
    ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - ph) * 0.85 * k).toFixed(3) + ')';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(scrX(W.px), PLAYER_Y, 34 + ph * 46, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }

  function drawCloseCall() {
    if (!W.closeT) return;
    var a = Math.min(1, W.closeT / 18), rise = (55 - W.closeT) * 0.9;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '800 26px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.lineWidth = 6; ctx.strokeStyle = '#062a78';
    var tx = scrX(W.px), ty = PLAYER_Y - 62 - rise;
    var word = tr('hud.close', 'CLOSE!');
    ctx.strokeText(word, tx, ty);
    ctx.fillStyle = '#ffe066';
    ctx.fillText(word, tx, ty);
    ctx.restore();
  }
  /* The PERFECT: a spark where he scraped past the obstacle, and the word
     over it, so it is plain what was dodged and where. Not real speed: the
     spawner proves each row at the hill's own pace (reachOver at speedAt),
     and on the Glacier a 6% burst would cost about a sixth of the sideways
     reach that proof relies on. */
  function drawPerfect() {
    if (!W.perfT) return;
    var a = Math.min(1, W.perfT / 16), rise = (50 - W.perfT) * 1.1, pop = 1 + Math.max(0, W.perfT - 40) * 0.04;
    var sx = scrX(W.perfX), sy = scrY(W.perfD);
    /* the spark on the obstacle's edge, flaring out and fading */
    var sp = 1 - W.perfT / 50;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - sp * 1.4);
    ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
    for (var k = 0; k < 8; k++) {
      var ang = k * 0.785 + 0.2, r0 = 4 + sp * 10, r1 = 10 + sp * 34 * (k % 2 ? 0.6 : 1);
      ctx.lineWidth = k % 2 ? 2 : 3.2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(ang) * r0, sy + Math.sin(ang) * r0);
      ctx.lineTo(sx + Math.cos(ang) * r1, sy + Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath(); ctx.arc(sx, sy, 7 * (1 - sp), 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.translate(sx, sy - 44 - rise);
    ctx.scale(pop, pop);
    ctx.font = '800 30px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.lineWidth = 7; ctx.strokeStyle = '#062a78';
    var word = tr('hud.perfect', 'PERFECT!') + (W.perfChain > 1 ? ' \u00d7' + W.perfChain : '');
    ctx.strokeText(word, 0, 0);
    var g = ctx.createLinearGradient(0, -24, 0, 6);
    g.addColorStop(0, '#fff6c9'); g.addColorStop(1, '#ffb22e');
    ctx.fillStyle = g;
    ctx.fillText(word, 0, 0);
    ctx.restore();
  }
  function solid(o) { return o.t === 'rock' || o.t === 'tree'; }
  /* The run of catches. Every ten in a row lifts the multiplier on POINTS,
     up to three — fish in the purse are untouched, so the shop is priced
     exactly as before. A missed fish or a crash starts it again. */
  function comboUp() {
    W.combo++; if (W.combo > W.comboBest) W.comboBest = W.combo;
    /* a spent forgiveness comes back after ten more catches */
    if (perk().comboKeep && !W.comboKeep && W.combo % 10 === 0) W.comboKeep = 1;
  }
  /* What a time bubble gives, for whoever is wearing what. */
  /* The snow comes down at a fixed share faster than the pace a clean
     rider holds at this point of the hill, so riding clean only slows the
     loss; deep snow, a crash or a cold draught you did not need cost lead. */
  function avalancheStep(mySpeed) {
    var clean = Math.min(SPEED_MAX, SPEED0 + W.dist * SPEED_RAMP * rampOf()) * slowmo();
    /* It starts at his own pace and builds to its full lead over the first
       500 m, so a new rider has time to find the rhythm before it presses.
       At 10% faster from the first frame, with a 70 m start, a real player
       — who clips the deep snow and crashes now and then — was caught in a
       few hundred metres, and the mode played as a punishment. */
    var k = 1 + (AV_K - 1) * Math.min(1, W.dist / AV_EASE);
    W.avGap += mySpeed - clean * k;
    if (W.avPush > 0) W.avPush--;
    if (W.avGap <= 0) {
      W.avGap = 0; W.state = 'caught'; W.endT = 0; W.rushT = 0; W.shake = 18;
      Sfx.excite(false); Sfx.crash(); fx('caught');
    }
  }
  function clockGain() { return Math.round(CLOCK_GAIN * (perk().clockGain || 1)); }
  function comboMult() { return 1 + Math.min(2, Math.floor(W.combo / 10)); }
  /* How close a boulder has to be before it counts. `slim` tucks the
     creature in; it touches this and nothing else, so it cannot double as
     a reach perk and cannot let him ride inside the bank. */
  function hitR(o) { return o.r * 0.82 + PR * 0.78 * (perk().slim || 1); }
  function airborne() { return W.airTo > W.dist; }
  function rushing() { return W.rushT > 0; }
  /* Slower is always safe: every row was proved against the hill's own
     pace, and moving under it only ever buys more time to turn. */
  function slowmo() { return W.chillT > 0 ? CHILL_FACTOR : 1; }
  function bogged() { return (W.bog > 0 && !perk().bogImmune) ? BOG_FACTOR : 1; }
  /* How far through its cycle a geyser is. Keyed to how far down the hill
     the player has come, not to the frame count: by frames the same geyser
     on the same marked line was up on one run and down on the next,
     depending on nothing the player could see or do. By distance it is
     always in the same state at the moment you reach it, and it still
     breathes the whole way down as you close on it — the tell is real and
     the line is learnable. */
  function geyserPhase(o) {
    return ((W.dist * 0.18 + o.d * 0.7) % GEYSER_PERIOD) / GEYSER_PERIOD;
  }
  function geyserUp(o) { return geyserPhase(o) < GEYSER_UP / GEYSER_PERIOD; }
  /* Where a geyser stands, measured out from the centre of the opening.
     Its inner edge is held a clear player's width off that centre, so the
     line straight through the gap is never the thing it threatens: on a
     wide row it eats a real part of one side, and on a tight row it steps
     out of the way almost entirely. Without this it sat at a flat 30% of
     the width — which on a late, narrow row put it squarely on the only
     line there was. */
  /* How wide the spine is at a given point down the run: nothing at both
     tips, widest through the middle, with a slow waver along it so it
     reads as rock rather than as a drawn shape. */
  /* How far one flank of the spine stands out from its line, at a point
     down the run. Underneath it is a straight taper, and that is what makes
     the thing provable: the spawner proves the way past at the widest point
     only, and one proof covers the whole length just as long as the rock
     never widens FASTER than the penguin can move away from it. Sideways
     travel is a concave curve, so a straight line meeting it at the middle
     sits under it the whole way in — a rounded flank does not, and it was
     the first stretch of the rock that kept killing people.

     On top of the taper the flank is broken into facets, each one pulled
     IN from it and never out, so the silhouette is rock rather than a
     drawn diamond without any of the proof being spent. The two flanks are
     broken differently, which is most of what stops it reading as a
     shape. */
  function nunEdge(o, dd, side) {
    var u = clamp((dd - o.d) / o.span, 0, 1);
    var t = u < 0.5 ? u * 2 : (1 - u) * 2;
    var a = side < 0 ? o.el : o.er;
    var f = u * (a.length - 1), i0 = f | 0, k = f - i0;
    var i1 = Math.min(a.length - 1, i0 + 1);
    return o.w * 0.5 * t * (a[i0] + (a[i1] - a[i0]) * k);
  }
  function nunHalf(o, dd) {
    return Math.max(nunEdge(o, dd, -1), nunEdge(o, dd, 1));
  }
  function nunFacets() {
    var a = [], i;
    for (i = 0; i < 6; i++) a.push(rnd(0.66, 1));
    return a;
  }
  function geyserOff(gapW, side) {
    return side * (GEYSER_R * 0.62 + PR * 0.7 + Math.max(34, gapW * 0.25));
  }
  function seeing() { return W.sightT > 0 || perk().foresight; }

  /* How fast the steering actually answers right now, perk included. Anything
     predicting where the creature will be has to use this and not the raw
     constant, or it will steer for a machine that is not the one running. */
  /* The grip perk fills in what a slippery stretch takes away; it never
     sharpens the steering past what ordinary ice already gives you.

     Multiplying without the cap made the dearest skin on the ladder a
     downgrade, and not by a little: over 90 runs a weak player went 814m
     with it against 922m without, every quartile lower. Sharper steering
     punishes a slow reaction — you commit, and in the frames before your
     thumb lands the sharper turn has carried you further past the line.
     Capped at 1 it does nothing on good ice and lifts the glacier from
     0.62 to 0.90, which is exactly what the skin says it does. */
  function turnRate() {
    return TURN * Math.min(1, biome().grip * (perk().grip || 1));
  }

  function bank() { W.shake = Math.max(W.shake, 6); Sfx.bank(); }

  function crash(o) {
    W.state = 'crash'; W.endT = 0; W.shake = 24; W.impact = 1;
    W.combo = 0; fx('crash');
    W.rushT = 0; Sfx.excite(false);
    W.crashAt = { x: o.x, d: o.d, r: o.r, spin: 0 };
    Sfx.crash();
    for (var i = 0; i < 20; i++)
      W.puffs.push({ x: W.px + frnd(-18, 18), d: W.dist + frnd(-14, 14),
                     life: 34, max: 34, s: frnd(6, 15) });
  }

  /* Picking yourself up where you fell. The hill is not rewound — the row
     that got you is simply cleared out of the way, because dropping the
     player back on top of the same boulder would spend the life and kill
     them in the same frame.

     Invulnerability covers boulders and trees but NOT a crevasse: that test
     is separate and does not consult it. So the crevasse and its ramp are
     removed outright rather than trusted to the timer. */
  function revive() {
    if (!W || W.state !== 'crash' || W.lives <= 0) return false;
    W.lives--; W.revives++;
    W.state = 'run'; W.endT = 0; W.crashAt = null; W.shake = 0;
    /* Three seconds where nothing at all can end the run: boulders, pines
       and crevasses alike. Spending a life and dying again two beats later
       is the one outcome that would make the whole feature feel like a
       swindle. */
    W.invuln = GRACE_FRAMES; W.grace = GRACE_FRAMES;
    W.airTo = -1; W.airSpan = 0; W.wasAir = false;

    var from = W.dist - 140, to = W.dist + 340, n = 0;
    for (var i = W.objects.length - 1; i >= 0; i--) {
      var o = W.objects[i];
      var far = o.d + (o.t === 'crevasse' ? (o.span || 0) : 0);
      if (far < from || o.d > to) continue;
      if (o.t === 'rock' || o.t === 'tree' || o.t === 'crevasse' || o.t === 'ramp') {
        W.objects.splice(i, 1); n++;
      }
    }
    for (var p = 0; p < 18; p++)
      W.puffs.push({ x: W.px + frnd(-26, 26), d: W.dist + frnd(-20, 20),
                     life: 30, max: 30, s: frnd(6, 14), tint: '#bfe9ff' });
    Sfx.gold();
    return true;
  }

  function updPuffs() {
    for (var i = W.puffs.length - 1; i >= 0; i--) {
      var p = W.puffs[i];
      p.s *= 1.035; p.life--;
      if (p.life <= 0) W.puffs.splice(i, 1);
    }
    for (i = W.spray.length - 1; i >= 0; i--) {
      var q = W.spray[i];
      q.x += q.vx; q.d += q.vd; q.vx *= 0.9; q.vd *= 0.9; q.life--;
      if (q.life <= 0) W.spray.splice(i, 1);
    }
  }
  /* Snow falls with the run; an ember climbs against it. `rise` is taken
     off the fall, so over the lava field the air moves the other way and
     the hill reads as hot without anything being said about it. */
  function updFlakes() {
    var A = (pal().air) || AIR0, sway = A.drift || 0;
    for (var i = 0; i < W.flakes.length; i++) {
      var f = W.flakes[i];
      f.y += f.v + W.speed * 0.3 - (A.rise || 0) * (0.5 + f.v);
      f.x += Math.sin(W.t * 0.035 * f.sw + f.ph) * sway * 0.5;
      if (f.y > VIEW_H + 6) { f.y = -6; f.x = frand() * VIEW_W; }
      else if (f.y < -8) { f.y = VIEW_H + 6; f.x = frand() * VIEW_W; }
      if (f.x < -10) f.x += VIEW_W + 20; else if (f.x > VIEW_W + 10) f.x -= VIEW_W + 20;
    }
  }

  function hud() {
    if (hooks.hud) hooks.hud({ score: Math.floor(W.score), dist: Math.floor(W.dist / 8) });
  }

  /* ========================= RENDERING ========================= */
  function render() {
    PAL = buildPal();
    FADING = fadeOf(); NEXT = FADING ? null : nextOf(); spriteBudget = SPRITES_PER_FRAME;
    ctx.setTransform(drawK, 0, 0, drawK, 0, 0);
    ctx.globalAlpha = 1;
    var shx = (frand() - 0.5) * W.shake, shy = (frand() - 0.5) * W.shake;
    if (OFF) shx = shy = 0;              // effects Off: the picture holds still
    /* Behind the title on a wide screen the menu stands on the left, so
       the demo's camera looks at the hill from the right half instead. */
    var camX = (W.demo && VIEW_W > VIEW_H * 1.15) ? VIEW_W * 0.24 : 0;
    if (camX) { ctx.fillStyle = pal().snowA; ctx.fillRect(0, 0, VIEW_W, VIEW_H); shx += camX; }
    /* on a phone the menu fills the middle, so the demo's animal rides low,
       in the strip of hill showing under it */
    var keepPY0 = PLAYER_Y;
    if (W.demo && VIEW_H > VIEW_W) PLAYER_Y = Math.round(VIEW_H * 0.93);
    ctx.save();
    ctx.translate(shx, shy);
    /* The camera breathes: it draws back as the hill speeds up, and leans
       in for a moment on a close call. Drawn back, the world is painted as
       if the screen were larger and scaled down to fit, so every painter
       still covers the whole view and nothing at the edges is left bare;
       it never leans in past 1, so the chute is never cropped. */
    var z = W.zoom || 1, keepW = VIEW_W, keepH = VIEW_H, keepP = PLAYER_Y;
    if (z < 0.999) { VIEW_W = keepW / z; VIEW_H = keepH / z; PLAYER_Y = keepP / z; ctx.scale(z, z); }
    try {
    HILL = true;
    if (W.objects.length) prepBridges();
    drawChute();
    drawGround();
    drawEmberGlow();
    drawNeon();
    drawSightLine();
    if (!OFF) drawTrail();
    drawObjects();
    drawSpeedStreaks();
    drawAurora();
    drawVeils();          /* the haze far up the hill, and the fog */
    drawPenguin();
    drawGateFronts();     /* after him: he goes THROUGH the hoop */
    drawCloseCall();
    drawPerfect();
    drawTutWait();
    drawChill();
    drawPaceVignette();
    drawBridges();        /* after him: he is UNDER the bridge */
    drawAvalanche();      /* when it catches him, it covers him */
    } finally { HILL = false; VIEW_W = keepW; VIEW_H = keepH; PLAYER_Y = keepP; }
    ctx.restore();
    ctx.save();
    ctx.translate(shx, shy);
    if (!OFF) drawFlakes();  /* falling snow is in front of the lens, not on the hill */
    ctx.restore();
    drawLight();
    PLAYER_Y = keepPY0;
    drawHud();
  }

  /* the ice run and the snow banks that wind along either side */
  /* ---- the ground, with some volume to it ----
     A hash for things fixed to the hill: the same patch of deep ice or the
     same glint on the snow is in the same place every time you pass it,
     and scrolls with the hill instead of swimming on the screen. */
  function hh(n, k) { var v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); }
  function bankX(d, side) {
    var wob = Math.sin(d * 0.011 + side * 2.1) * 9 + Math.sin(d * 0.03) * 4;
    return VIEW_W / 2 + (chuteAt(d) - chuteHere()) + side * (CHUTE + wob);
  }
  /* The ice: deeper and clearer in patches, darker there; frost dulling it
     in others; old bubbles caught in it; the left bank's shadow lying
     across its edge (the sun is upper left, so the right bank throws none
     onto it); and a broad soft sheen of sky that holds still on the screen
     while the ice runs under it — which is what reflections do, and what
     makes a floor read as glassy rather than painted. */
  function iceBody(B) {
    if (LITE) return iceStrip(B);
    var dTop = W.dist + PLAYER_Y + 160, dBot = W.dist + PLAYER_Y - VIEW_H - 160, cell, k, d, x, y, r;
    for (cell = Math.floor(dBot / 170); cell <= Math.floor(dTop / 170); cell++) {
      for (k = 0; k < 1; k++) {
        d = cell * 170 + hh(cell, k) * 170;
        x = scrX(chuteAt(d) + (hh(cell, k + 7) - 0.5) * CHUTE * 1.7); y = scrY(d);
        r = 40 + hh(cell, k + 13) * 60;
        var deep = hh(cell, k + 19) < 0.55, blob = iceBlob(deep);
        if (blob) ctx.drawImage(blob, x - r * 1.3, y - r * 0.8, r * 2.6, r * 1.6);   // unrotated: a turned image is dear to paint
      }
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;          // bubbles held in it
      for (k = 0; k < 4; k++) {
        d = cell * 170 + hh(cell, k + 30) * 170;
        x = scrX(chuteAt(d) + (hh(cell, k + 40) - 0.5) * CHUTE * 1.8); y = scrY(d);
        ctx.beginPath(); ctx.arc(x, y, 1.5 + hh(cell, k + 50) * 2.5, 0, 6.2832); ctx.stroke();
      }
    }
    iceStrip(B);
  }
  /* the left bank's shadow across the edge of the ice */
  function iceStrip(B) {
    var y, d;
    ctx.fillStyle = B.bankShade;
    for (var pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.22 : 0.18;
      var wd = pass ? 16 : 34;
      ctx.beginPath();
      for (y = -40; y <= VIEW_H + 40; y += 12) { d = W.dist + (PLAYER_Y - y); ctx.lineTo(bankX(d, -1) - 4, y); }
      for (y = VIEW_H + 40; y >= -40; y -= 12) { d = W.dist + (PLAYER_Y - y); ctx.lineTo(bankX(d, -1) + wd + Math.sin(d * 0.02) * 4, y); }
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* (the sky's sheen holds still on the screen, so it is part of the
       light laid over the canvas — index.html #light) */
  }
  var blobs = {};
  function iceBlob(deep) {
    var k = deep ? 'd' : 'f';
    if (blobs[k] !== undefined) return blobs[k];
    blobs[k] = null;
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas'), cx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!cx) return null;
    cv.width = 64; cv.height = 64;
    var g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, deep ? 'rgba(30,120,200,.07)' : 'rgba(255,255,255,.16)');
    g.addColorStop(1, deep ? 'rgba(30,120,200,0)' : 'rgba(255,255,255,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
    return (blobs[k] = cv);
  }
  /* A bank: snow heaped up beside the run, not a flat white margin. The
     slope down to the ice faces the run — in shade on the left, in the sun
     on the right — and the top of the bank rolls in soft drifts, with now
     and then a glint where a crystal catches the sun. Called with the
     bank's own outline as the current path. */
  function bankBody(B, side) {
    var y, d, k, cell, x;
    ctx.save();
    /* LITE draws only the slope, which reaches past the outline by two
       units at most, under the lip drawn next; the clip, dear on a slow
       phone, is kept for the drifts and glints (34 -> 40 frames a second
       on the A9 2020, row 134) */
    if (!LITE) ctx.clip();
    /* the slope: bands along the edge, shaded or lit — filled, not
       stroked; a stroke seventy wide down the whole screen was one of the
       dearest things in the frame */
    var bands = side < 0 ? [[36, 0.16], [15, 0.22]] : [[28, 0.26]];
    ctx.fillStyle = side < 0 ? B.bankShade : '#ffffff';
    for (k = 0; k < bands.length; k++) {
      ctx.globalAlpha = bands[k][1];
      ctx.beginPath();
      for (y = -40; y <= VIEW_H + 40; y += 14) { d = W.dist + (PLAYER_Y - y); ctx.lineTo(bankX(d, side) - side * 2, y); }
      for (y = VIEW_H + 40; y >= -40; y -= 14) { d = W.dist + (PLAYER_Y - y); ctx.lineTo(bankX(d, side) + side * bands[k][0], y); }
      ctx.closePath(); ctx.fill();
    }
    if (LITE) { ctx.globalAlpha = 1; ctx.restore(); return; }
    /* drifts rolling across the top, each lit on its upper left */
    var dTop = W.dist + PLAYER_Y + 160, dBot = W.dist + PLAYER_Y - VIEW_H - 160;
    for (cell = Math.floor(dBot / 120); cell <= Math.floor(dTop / 120); cell++) {
      d = cell * 120 + hh(cell, side + 3) * 120;
      x = bankX(d, side) + side * (40 + hh(cell, side + 5) * 110); y = scrY(d);
      var rr = 26 + hh(cell, side + 9) * 34;
      ctx.globalAlpha = 0.1; ctx.fillStyle = B.bankShade;
      ctx.beginPath(); ctx.ellipse(x + rr * 0.25, y + rr * 0.2, rr * 1.5, rr * 0.7, -0.3, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(x - rr * 0.2, y - rr * 0.15, rr * 1.3, rr * 0.55, -0.3, 0, 6.2832); ctx.fill();
    }
    /* glints */
    for (cell = Math.floor(dBot / 46); cell <= Math.floor(dTop / 46); cell++) {
      var tw = Math.sin(W.t * 0.045 + hh(cell, side + 60) * 40);
      if (tw < 0.8) continue;
      d = cell * 46 + hh(cell, side + 61) * 46;
      x = bankX(d, side) + side * (14 + hh(cell, side + 62) * 150); y = scrY(d);
      var a = (tw - 0.8) * 5, sz = 2.2 + hh(cell, side + 63) * 2.5;
      ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y); ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawChute() {
    var B = pal(), y, d, c, i;

    ctx.fillStyle = B.snowA;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var ice = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    ice.addColorStop(0, B.iceTop); ice.addColorStop(1, B.iceBot);

    ctx.beginPath();                                  // left edge, top to bottom
    for (y = -40; y <= VIEW_H + 40; y += 10) {
      d = W.dist + (PLAYER_Y - y);
      c = chuteAt(d) - chuteHere();
      ctx.lineTo(VIEW_W / 2 + c - CHUTE, y);
    }
    for (y = VIEW_H + 40; y >= -40; y -= 10) {        // back up the right edge
      d = W.dist + (PLAYER_Y - y);
      c = chuteAt(d) - chuteHere();
      ctx.lineTo(VIEW_W / 2 + c + CHUTE, y);
    }
    ctx.closePath();
    ctx.fillStyle = ice; ctx.fill();

    /* What lies in the ice is not clipped to it: whatever runs over its
       edge is covered by the banks, which are filled out to that edge
       below. The clip was the dearest thing in the frame on a slow
       phone: an OPPO A9 2020 drew 23 frames a second with it and 34
       without, and the picture is the same to the pixel but for the
       edge's own anti-aliasing (27 Oct 2026). */
    ctx.save();
    iceBody(B);
    /* The one thing a run is ABOUT is that it gets faster, and at 1127m it
       used to look exactly as quick as at 76m. The streaks carry it: they
       stretch, thin and brighten as he picks up, so the floor is visibly
       tearing past by the end. */
    var sp = pace(), s, sy, sx;
    ctx.strokeStyle = B.streak || 'rgba(255,255,255,.5)';   // streaks of polished ice
    ctx.lineWidth = 4 - 2.2 * sp;
    for (i = 0; i < W.streaks.length; i++) {          // the ones gone below come round again
      s = W.streaks[i];
      if (scrY(s.d) > VIEW_H + 320) { s.d += LOOK + 200; s.x = frnd(-CHUTE, CHUTE); }
    }
    /* A hundred streaks, each its own shade of 0.05 to 0.22: drawn in six
       bands of shade, one stroke a band, rather than a stroke a streak. */
    for (var sb = 0; sb < 6; sb++) {
      ctx.globalAlpha = (0.05 + (sb + 0.5) * 0.17 / 6) * (1.9 + 3.4 * sp);
      ctx.beginPath();
      for (i = 0; i < W.streaks.length; i++) {
        s = W.streaks[i];
        if (Math.min(5, ((s.a - 0.05) / 0.17 * 6) | 0) !== sb) continue;
        sy = scrY(s.d);
        if (sy < -320 || sy > VIEW_H + 320) continue;
        sx = scrX(chuteAt(s.d) + s.x);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 6, sy + s.len * (1 + 4.2 * sp));
      }
      ctx.stroke();
    }
    drawIceDetail(B);
    ctx.globalAlpha = 1;
    ctx.restore();

    /* the lip of snow where the banks meet the ice */
    [-1, 1].forEach(function (side) {
      /* The bank's outline wobbles, and where it stands back from the ice
         the snow between is the background showing through. The fill goes
         out to the ice's own edge there (cover), which hides what ran over
         that edge; the true outline is then traced again for the bank's
         slope and its lip. */
      function outline(cover) {
        ctx.beginPath();
        for (y = -40; y <= VIEW_H + 40; y += 10) {
          d = W.dist + (PLAYER_Y - y);
          c = chuteAt(d) - chuteHere();
          var wob = Math.sin(d * 0.011 + side * 2.1) * 9 + Math.sin(d * 0.03) * 4;
          if (cover && wob > 0) wob = 0;
          ctx.lineTo(VIEW_W / 2 + c + side * (CHUTE + wob), y);
        }
        ctx.lineTo(side < 0 ? -60 : VIEW_W + 60, VIEW_H + 40);
        ctx.lineTo(side < 0 ? -60 : VIEW_W + 60, -40);
        ctx.closePath();
      }
      outline(true);
      ctx.fillStyle = B.snowA; ctx.fill();
      if (!LITE) outline(false);        // bankBody clips to it; LITE does not
      bankBody(B, side);
      /* a blue shadow where the bank drops onto the ice, then a bright lip:
         without it the snow and the ice read as one flat field. Traced
         again, since bankBody leaves its own last shape as the path: the
         lip used to be stroked round an off-screen drift (row 135). */
      outline(false);
      ctx.strokeStyle = B.bankShade; ctx.lineWidth = 11;
      ctx.stroke();
      ctx.strokeStyle = B.lip || '#ffffff'; ctx.lineWidth = 4;
      ctx.stroke();

      /* Sastrugi: the ridges wind carves into packed snow, running the way
         the wind ran. These used to be ellipses, and from directly overhead
         a shaded ellipse on snow reads as a puddle, which is the one thing
         it cannot be up here. */
      ctx.strokeStyle = B.bankShade;
      ctx.lineCap = 'round';
      var base = Math.floor(W.dist / 96) * 96;
      for (var fi = -1; fi < 11; fi++) {
        var fd = base + fi * 96;
        var fy = scrY(fd);
        if (fy < -160 || fy > VIEW_H + 160) continue;
        var fc = chuteAt(fd) - chuteHere();
        var wob2 = Math.sin(fd * 0.011 + side * 2.1) * 9 + Math.sin(fd * 0.03) * 4;
        var ex = VIEW_W / 2 + fc + side * (CHUTE + wob2);
        var off = 10 + ((fi * 29) % 26);
        var len = 34 + ((fi * 37) % 44);
        var lean = side * (2 + ((fi * 13) % 7));
        ctx.globalAlpha = 0.13 + ((fi * 7) % 5) * 0.022;
        ctx.lineWidth = 3 + ((fi * 11) % 3);
        ctx.beginPath();
        ctx.moveTo(ex + side * off, fy - len / 2);
        ctx.lineTo(ex + side * off + lean, fy + len / 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawObjects() {
    var list = W.objects.filter(function (o) {
      var y = scrY(o.d);
      /* The finish is 450 units tall and is the one thing the player needs
         to see coming, so it is kept well before the ordinary cull. */
      if (o.t === 'finish') return y > -700 && y < VIEW_H + 200;
      /* A spanned thing is culled on BOTH its ends: its near end can be off
         the bottom of the screen while most of it is still in view. */
      if (o.t === 'nunatak') return scrY(o.d + o.span) < VIEW_H + 160 && y > -160;
      return y > -140 && y < VIEW_H + 140;
    }).sort(function (a, b) { return a.d - b.d; });        // nearest drawn last

    var B = pal();
    for (var i = 0; i < list.length; i++) {
      var o = list[i], x = scrX(o.x), y = scrY(o.d);
      if (o.t === 'tunnel')      continue;               // drawn in its own pass
      else if (o.t === 'finish')  drawFinish(y, o, B);
      else if (o.t === 'crevasse') drawCrevasse(y, o, B);
      else if (o.t === 'ramp')   drawRamp(x, y, o, B);
      else if (o.t === 'rock')   drawRock(x, y, o, B);
      else if (o.t === 'tree')   drawTree(x, y, o, B);
      else if (o.t === 'deco') {                       // never a hazard, so it sits back
        ctx.globalAlpha = 0.82;
        if (o.kind === 'tree') drawTree(x, y, o, B); else drawRock(x, y, o, B);
        ctx.globalAlpha = 1;
      }
      else if (o.t === 'gate')   drawGate(x, y, o, 'back');
      else if (o.t === 'fish')   { if (!o.got) drawFish(x, y, o, false); }
      else if (o.t === 'gold')   { if (!o.got) drawFish(x, y, o, true); }
      else if (o.t === 'bubble') { if (!o.got) drawBubble(x, y, o); }
      else if (o.t === 'find')   { if (!o.got) drawFind(x, y, o); }
      else if (o.t === 'clock')  { if (!o.got) drawClock(x, y, o); }
      else if (o.t === 'rush')   { if (!o.got) drawRushBall(x, y, o); }
      else if (o.t === 'chill' || o.t === 'sight' || o.t === 'call') {
        if (!o.got) drawFind3(x, y, o);
      }
      else if (o.t === 'drift')  drawDrift(x, y, o, B);
      else if (o.t === 'geyser') drawGeyser(x, y, o, B);
      else if (o.t === 'nunatak') drawNunatak(o, B);
    }
    for (i = 0; i < W.puffs.length; i++) {
      var p = W.puffs[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.75;
      ctx.fillStyle = p.tint || B.snowA;     // pure white glares on the night run
      ctx.beginPath(); ctx.arc(scrX(p.x), scrY(p.d), p.s, 0, 6.2832); ctx.fill();
    }
    /* The fan of snow off his edge, seventy-odd flecks: in five steps of
       fading and two sizes, each a rim (so it shows on pale ice) and then
       the white, one stroke apiece, rather than two strokes a fleck. */
    ctx.lineCap = 'round';
    for (var qa = 0; qa < 5; qa++) for (var qz = 0; qz < 2; qz++) {
      var some = false;
      ctx.beginPath();
      for (i = 0; i < W.spray.length; i++) {
        var q = W.spray[i];
        if (Math.min(4, (Math.max(0, q.life / q.max) * 5) | 0) !== qa || (q.s >= 2.4 ? 1 : 0) !== qz) continue;
        var qx = scrX(q.x), qy = scrY(q.d);
        ctx.moveTo(qx, qy); ctx.lineTo(qx - q.vx * 2.2, qy + q.vd * 2.2);
        some = true;
      }
      if (!some) continue;
      var qs = qz ? 2.9 : 1.9;                        // the middle of each size, 1.4 to 3.4
      ctx.globalAlpha = (qa + 0.5) / 5 * 0.95;
      ctx.strokeStyle = B.bankShade; ctx.lineWidth = qs * 2.2; ctx.stroke();
      ctx.strokeStyle = B.snowA; ctx.lineWidth = qs * 1.5; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- the snow bridge ----
     You go UNDER it, and what you can see of yourself is your shadow. That
     was the idea from the start; it got lost when an attempt at an ice cave
     filled the frame with a blue slab and had to be torn out.

     The roof is opaque and the colour of the snow it is made of, taken from
     the stretch of hill it crosses so it is never a grey card dropped on a
     coloured world. It is drawn after the creature, so he is beneath it. */
  var ROOF_RGB = '18,22,28';
  function roofInk(B) {
    /* How hard to shade the roof so it takes the same share of the light on
       every stretch. Deriving the colour from the biome's own bank shade
       looked right and was invisible on the lava field, where the bank is
       already near-black: it changed the picture by two points out of 255. */
    var lum = (lumOf(B.iceTop) + lumOf(B.iceBot)) * 0.5;
    return clamp(0.23 * lum / Math.max(10, lum - 20), 0.18, 0.52);
  }

  /* The creature flattened to one colour and softened, for showing through
     the snow above him. Painted into a buffer and tinted with source-in
     rather than drawn twice: what has to show is his outline, not his
     markings. A plain dark oval stood in for this once and read as a
     thumbprint on the glass. */
  var shadeBuf = null, shadeSoft = null, SHADE = 132;
  /* It is a soft blur of him, so it need not be painted every frame:
     his outline is redrawn every third frame
     or when he turns, and the picture held in between. Painting the whole
     creature each frame was the costliest thing left under a bridge. */
  var shadeAt = -1e9, shadeAng = 0;
  function creatureShade(x, y, ang) {
    if (typeof document === 'undefined' || !document.createElement) return;
    if (!shadeBuf) {
      shadeBuf = document.createElement('canvas');
      shadeBuf.width = SHADE; shadeBuf.height = SHADE;
    }
    var c = shadeBuf.getContext('2d');
    if (!c) return;
    if (!shadeSoft) { shadeSoft = document.createElement('canvas'); shadeSoft.width = shadeSoft.height = SHADE / 3; }
    if (Math.abs(W.t - shadeAt) >= 3 || W.t < shadeAt || Math.abs(ang - shadeAng) > 0.08) {
      shadeAt = W.t; shadeAng = ang;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, SHADE, SHADE);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.save();
      c.translate(SHADE / 2, SHADE / 2);
      c.rotate(ang);
      paintCreature(c, skin || SKINS[0],
                    { ang: 0, wag: 0, gait: W.t * 0.2, turn: 0,
                      scale: 1.2, lift: 0, air: false, shield: -1 });
      c.restore();
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = '#20364f';
      c.fillRect(0, 0, SHADE, SHADE);
      c.globalCompositeOperation = 'source-over';
      /* Softened by shrinking it to a third and letting it be stretched
         back: a blur filter on the main canvas cost 2.5 ms a frame. */
      var sc = shadeSoft.getContext('2d');
      sc.clearRect(0, 0, SHADE / 3, SHADE / 3);
      sc.drawImage(shadeBuf, 0, 0, SHADE / 3, SHADE / 3);
    }
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shadeSoft, x - SHADE / 2, y - SHADE / 2, SHADE, SHADE);
    ctx.restore();
  }

  /* Players new to the hill read the old bridge as a wall: a flat band of
     the banks' own snow laid straight across the screen, edge to edge, with
     nothing to say the run carries on beneath it. It now has the shape of a
     snow bridge seen from above:
       - each mouth is an ARCH over the run, the snow thinning where the
         channel passes and anchored deep into the banks on either side;
       - under the near arch the ice falls into shadow, a dark opening you
         can see into before you reach it;
       - icicles hang off the near lip, which only an overhang has;
       - the run's own edges show faintly through the roof, so the way on
         is visible the whole way across.
     Nothing in it is built: it is snow, ice and shadow, like the rest. */
  var ARCH = 104, ARCH_K = 1;             // how far the mouth bows back over the run; ARCH_K: less for the short arches of a pair
  function archAt(x, my, dir, ph) {
    /* The edge of the roof at screen x. Over the banks it sits on the mouth
       line; over the run it bows back by ARCH, flat-topped and steep-sided
       so it reads as an opening rather than as a wave. dir is +1 for the
       near mouth (bows up the screen), -1 for the far one. */
    var d = W.dist + (PLAYER_Y - my);
    var cx = VIEW_W / 2 + chuteAt(d) - chuteHere();
    var t = (x - cx) / (CHUTE * 0.94);
    var t2 = t * t, s = Math.abs(t) < 1 ? 1 - t2 * t2 * t2 : 0;
    return my - dir * ARCH * ARCH_K * s + Math.sin(x * 0.045 + ph) * 3;
  }
  function archPath(my, dir, ph, x0, x1, n) {
    var pts = [];
    n = n || 40;
    for (var k = 0; k <= n; k++) {
      var x = x0 + (x1 - x0) * k / n;
      pts.push([x, archAt(x, my, dir, ph)]);
    }
    return pts;
  }
  function tracePts(pts, dy) {
    ctx.beginPath();
    for (var q = 0; q < pts.length; q++) {
      if (q) ctx.lineTo(pts[q][0], pts[q][1] + (dy || 0));
      else ctx.moveTo(pts[q][0], pts[q][1] + (dy || 0));
    }
  }
  /* The run's two edges between two screen heights, as a closed path. */
  function traceRun(top, bot) {
    var y, d;
    ctx.beginPath();
    for (y = top; y <= bot; y += 10) { d = W.dist + (PLAYER_Y - y); ctx.lineTo(bankX(d, -1), y); }
    for (y = bot; y >= top; y -= 10) { d = W.dist + (PLAYER_Y - y); ctx.lineTo(bankX(d, 1), y); }
    ctx.closePath();
  }

  /* The bridge is the costliest thing on the hill to paint: its shadows
     and the dark of its mouth are dozens of wide strokes laid across the
     whole run. Painted fresh every frame it nearly doubled the time a frame
     took (18 ms to 33 in Chrome, 38 under it), and the game stuttered as
     you came up to one. But nothing in it moves while it is on screen —
     it is fixed to the hill, and the hill only slides — so it is painted
     once into a picture and the picture is slid. Only the light of him
     underneath is painted each frame. While the palette is still turning
     (a fade between stretches) it is painted directly, since a picture
     would have to be made again every frame. */
  function drawBridges() {
    var B = pal(), ink = null;
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (o.t !== 'tunnel') continue;
      var yIn = scrY(o.d), yOut = scrY(o.d + o.span);
      if (yOut > VIEW_H + 120 || yIn < -120) continue;
      if (ink === null) ink = roofInk(B);
      bridgeKind(o, B);
      /* Through a fade between stretches the palette turns every frame,
         so the bridge is not painted in it: it is the picture in the old
         palette and the picture in the new, the new laid over the old as
         the fade goes, the way the rocks and trees do it. Painting it
         fresh every frame of the fade was what still dropped a phone to
         15 a second there. The pictures are made in prepBridges(), before
         anything else in the frame takes its share of new pictures. */
      var S2 = roofSet(o, B, ink, false), F = FADING;
      if (F && S2.a && S2.b) {
        var a0 = ctx.globalAlpha, an = a0 * F.t, ao = an >= 1 ? 1 : a0 * (1 - F.t) / (1 - an);
        ctx.globalAlpha = ao; roofBlit(S2.a);
        ctx.globalAlpha = an; roofBlit(S2.b);
        ctx.globalAlpha = a0;
      } else if (S2.a || S2.b) roofBlit(S2.a || S2.b);
      else bridgeParts(o).forEach(function (P) { ARCH_K = P.bow || 1; paintBridge(P.o, B, ink, -20, VIEW_W + 20, -60, VIEW_H + 60, P.kind); ARCH_K = 1; });
      bridgeLight(o);
    }
  }
  /* The picture is made in the screen's terms at the moment it is made.
     Afterwards the hill has slid (W.dist), the camera has followed the
     chute sideways (chuteHere) and drawn back or leaned in with pace
     (VIEW_W and PLAYER_Y change with the zoom, every frame at speed): all
     of which only move the picture. The zoom first sat in its key, and on
     the phone the picture was made again every frame, which was slower
     than painting the bridge outright. */
  var ROOF_MARGIN = 0.18;                  // how far the picture runs past each side, a share of the screen
  /* Four kinds of bridge, one picked for each by where it stands: the
     snow bridge, an arch of clear blue glacier ice, an arch of the hill's
     own stone, and a pair of short snow or ice arches with open sky
     between them. They only look different: each covers the same stretch
     of run, so nothing about the hill changes. */
  var BRIDGE_KINDS = ['snow', 'snow', 'ice', 'rock', 'double'];
  function bridgeKind(o, B) {
    /* settled the first time it is drawn, and kept: on the lava field
       there is no clear ice to make an arch of, so it is stone there */
    if (!o._kind) {
      var k = o.kind || BRIDGE_KINDS[Math.floor(hh(Math.round(o.d || 0), 23) * BRIDGE_KINDS.length) % BRIDGE_KINDS.length];
      o._hot = !!(B && (B.ember || 0) > 0.3);
      if (o._hot && k === 'ice') k = 'rock';
      o._kind = k;
    }
    return o._kind;
  }
  function snowPatch(x, y, r, sd, col) {      // a patch of snow lying in a hollow: lumps, not a pill
    ctx.fillStyle = col;
    ctx.beginPath();
    for (var j = 0; j < 4; j++) {
      var a = hh(sd, j) * 6.2832, d = r * 0.55 * hh(sd, j + 4);
      ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.45, r * (0.35 + 0.35 * hh(sd, j + 8)), r * (0.18 + 0.16 * hh(sd, j + 12)),
                  (hh(sd, j + 16) - 0.5) * 0.8, 0, 6.2832);
    }
    ctx.fill();
  }
  function bridgeParts(o) {
    var k = bridgeKind(o);
    if (k !== 'double') return [{ o: o, kind: k }];
    var inner = hh(Math.round(o.d || 0), 29) < 0.5 || o._hot ? 'snow' : 'ice', part = o.span * 0.38;
    var bow = Math.min(1, part * 0.36 / ARCH);
    return [{ o: { d: o.d, span: part, ph: o.ph }, kind: inner, bow: bow },
            { o: { d: o.d + o.span - part, span: part, ph: o.ph + 1.7 }, kind: inner, bow: bow }];
  }
  function roofBlit(R) { ctx.drawImage(R.cv, R.x0 + roofDX(R), R.y0 + roofDY(R), R.w, R.h); }
  /* the pictures a bridge is drawn from this frame: one, or through a
     fade the old stretch's and the new one's; made only when build is set,
     at most one a frame, and out of the frame's share of new pictures */
  function roofSet(o, B, ink, build) {
    var budget = { n: build ? 1 : 0 }, F = FADING;
    if (!F) {
      var cur = roofPicture(o, B, ink, budget);
      if (cur && NEXT && NEXT !== B) roofPicture(o, NEXT, roofInk(NEXT), budget, true);   // the stretch about to come, ahead of its fade
      return { a: cur, b: null };
    }
    var to = roofPicture(o, F.to, roofInk(F.to), budget, true);
    return { a: roofPicture(o, F.from, roofInk(F.from), budget, true), b: to };
  }
  function prepBridges() {
    var B = pal();
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (o.t !== 'tunnel') continue;
      if (scrY(o.d + o.span) > VIEW_H + 120 || scrY(o.d) < -120) continue;
      bridgeKind(o, B);
      roofSet(o, B, roofInk(B), true);
    }
  }
  function roofDX(R) { return (VIEW_W - R.vw) / 2 - (chuteHere() - R.ch); }
  function roofDY(R) { return (PLAYER_Y - R.py) + (W.dist - R.dist); }
  function roofPicture(o, B, ink, budget, fading) {
    if (typeof document === 'undefined' || !HILL) return null;
    var key = [B.snowA, B.rock, B.rockDark, B.cap, B.lip, ink.toFixed(3), drawK, SPARE].join('|');
    var Rs = o._roofs || (o._roofs = []), R = null, i;
    for (i = 0; i < Rs.length; i++) if (Rs[i].key === key) { R = Rs[i]; break; }
    if (R) {
      var dx = roofDX(R);
      if (R.x0 + dx <= -4 && R.x0 + R.w + dx >= VIEW_W + 4) return R;     // still covers the screen
      free({ s: R }); Rs.splice(i, 1); R = null;
    }
    if (!budget || budget.n <= 0 || spriteBudget <= 0) return null;
    if (!fading && FADING) return null;
    budget.n--; spriteBudget--;
    var m = VIEW_W * ROOF_MARGIN, yIn = scrY(o.d), yOut = scrY(o.d + o.span);
    var x0 = -m - 20, x1 = VIEW_W + m + 20, y0 = yOut - ARCH - 70, y1 = yIn + 240;
    R = spriteOf(x0, y0, x1, y1, function (ox, oy) {
      ctx.save(); ctx.translate(ox, oy);
      bridgeParts(o).forEach(function (P) { ARCH_K = P.bow || 1; paintBridge(P.o, B, ink, x0, x1, y0, y1, P.kind); ARCH_K = 1; });
      ctx.restore();
    });
    if (!R) return null;
    R.key = key; R.ch = chuteHere(); R.dist = W.dist; R.vw = VIEW_W; R.py = PLAYER_Y;
    Rs.push(R);
    while (Rs.length > 2) free({ s: Rs.shift() });                         // the oldest: the stretch behind
    return R;
  }
  /* him underneath, as light scattering up through the snow: inside the
     roof only */
  function bridgeLight(o0) {
    var parts = bridgeParts(o0);
    for (var pi = 0; pi < parts.length; pi++) { ARCH_K = parts[pi].bow || 1; bridgeLightUnder(parts[pi].o); ARCH_K = 1; }
  }
  function bridgeLightUnder(o) {
    var yIn = scrY(o.d), yOut = scrY(o.d + o.span);
    var py = PLAYER_Y, pxx = scrX(W.px);
    if (!(py < archAt(pxx, yIn, 1, o.ph) + 8 && py > archAt(pxx, yOut, -1, o.ph + 2) - 8)) return;
    var near = archPath(yIn, 1, o.ph, pxx - 110, pxx + 110, 12), far = archPath(yOut, -1, o.ph + 2, pxx - 110, pxx + 110, 12), k;
    ctx.save();
    ctx.beginPath();
    for (k = 0; k < far.length; k++) ctx.lineTo(far[k][0], far[k][1]);
    for (k = near.length - 1; k >= 0; k--) ctx.lineTo(near[k][0], near[k][1]);
    ctx.closePath(); ctx.clip();
    {
      var gl = ctx.createRadialGradient(pxx, py, 4, pxx, py, 92);
      gl.addColorStop(0, 'rgba(176,214,242,.52)');
      gl.addColorStop(0.5, 'rgba(192,222,246,.28)');
      gl.addColorStop(1, 'rgba(206,232,250,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(pxx, py, 92, 0, 6.2832); ctx.fill();
      creatureShade(pxx, py, Math.atan2(W.vx, Math.max(W.speed, 3)) * 0.85);
    }
    ctx.restore();
  }
  /* The bridge itself, in screen terms, between X0..X1 and Y0..Y1. */
  function paintBridge(o, B, ink, X0, X1, Y0, Y1, kind) {
    kind = kind || 'snow';
    var yIn = scrY(o.d), yOut = scrY(o.d + o.span);
    var k, sh, nA = Math.max(40, Math.round(40 * (X1 - X0) / (VIEW_W + 40)));
    var near = archPath(yIn, 1, o.ph, X0, X1, nA);
    var far = archPath(yOut, -1, o.ph + 2, X0, X1, nA);

    /* ---- the opening: shadow on the ice under the near arch ----
       Laid down first, under the roof. Clipped to the run so the banks
       are never smudged, and darkest right under the lip. */
    ctx.save();
    traceRun(yIn - ARCH - 20, yIn + 100);
    ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    for (sh = 0; sh < 18; sh++) {
      ctx.strokeStyle = 'rgba(' + ROOF_RGB + ',' +
        Math.min(0.9, ink * 1.5 * Math.pow(1 - sh / 18, 1.5)).toFixed(3) + ')';
      tracePts(near, 3 + sh * 5);
      ctx.stroke();
    }
    /* a cave, not a bridge: right under the lip the ice falls into a deep
       blue dark, the mouth you are riding into */
    ctx.lineWidth = 12;
    for (sh = 0; sh < 4; sh++) {
      ctx.strokeStyle = 'rgba(8,28,58,' + Math.min(0.75, ink * (2.6 - sh * 0.55)).toFixed(3) + ')';
      tracePts(near, 4 + sh * 8);
      ctx.stroke();
    }
    ctx.restore();

    /* ---- the roof ---- */
    ctx.save();
    ctx.beginPath();
    for (k = 0; k < far.length; k++) {
      if (k) ctx.lineTo(far[k][0], far[k][1]); else ctx.moveTo(far[k][0], far[k][1]);
    }
    for (k = near.length - 1; k >= 0; k--) ctx.lineTo(near[k][0], near[k][1]);
    ctx.closePath();
    /* lifted off the hill: a soft shadow falling towards you */
    ctx.save();
    ctx.shadowColor = 'rgba(' + ROOF_RGB + ',' + (ink * 0.9).toFixed(3) + ')';
    ctx.shadowBlur = 30; ctx.shadowOffsetY = 20;          // it stands high: the shadow falls further
    if (kind === 'ice') {                                  // clear blue glacier ice, paler towards the far side
      var ig0 = ctx.createLinearGradient(0, yOut - ARCH, 0, yIn);
      ig0.addColorStop(0, '#dff4fd'); ig0.addColorStop(0.5, '#9fd4ee'); ig0.addColorStop(1, '#5fa9d6');
      ctx.fillStyle = ig0;
    } else if (kind === 'rock') {                          // a natural arch of the hill's own stone
      var rg0 = ctx.createLinearGradient(0, yOut - ARCH, 0, yIn);
      rg0.addColorStop(0, mixHex(B.rock, '#ffffff', 0.18)); rg0.addColorStop(0.6, B.rock); rg0.addColorStop(1, B.rockDark);
      ctx.fillStyle = rg0;
    } else ctx.fillStyle = B.snowA;
    ctx.fill();
    ctx.restore();
    ctx.clip();

    /* Shaded into each mouth, where the drift curls over: the roof is
       rounded, not a card. */
    ctx.lineWidth = 10;
    for (sh = 0; sh < 5; sh++) {
      ctx.strokeStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.42 * (1 - sh / 5)).toFixed(3) + ')';
      tracePts(near, -(5 + sh * 9)); ctx.stroke();
      tracePts(far, 5 + sh * 9); ctx.stroke();
    }
    /* the back of the hill: a lit ridge along the middle of the roof */
    var midY = (yIn + yOut) / 2;
    var rg = ctx.createLinearGradient(0, midY - 60, 0, midY + 60);
    rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.5, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(X0 - 20, midY - 60, X1 - X0 + 40, 120);

    /* The run showing through: its two edges, faint, the whole way
       across. This is what says the way on is under here. */
    var top = Math.max(yOut - ARCH, Y0), bot = Math.min(yIn + 10, Y1);
    var see = kind === 'ice' ? 1.6 : kind === 'rock' ? 0.7 : 1;      // ice lets more of it through
    traceRun(top, bot);
    ctx.fillStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.2 * see).toFixed(3) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + ROOF_RGB + ',' + Math.min(0.9, ink * 0.55 * see).toFixed(3) + ')';
    ctx.lineWidth = 3;
    ctx.stroke();

    /* Sastrugi: the ridges wind carves into hard snow, each a low
       crescent lit along its crest and blue in its lee. Pinned to
       distance, so they ride with the roof. */
    var st = 52, base = Math.floor((W.dist + (PLAYER_Y - bot)) / st) * st;
    ctx.lineCap = 'round';
    var cxR = scrX(chuteAt(o.d + o.span / 2)), sdB = Math.floor(o.ph * 97), j2;
    if (kind === 'ice') {
      /* Glacier ice is banded where each summer's melt froze into it
         (ogives), bowed the way the ice flowed; split by crevasses along
         its length; dusted with snow in patches. */
      for (j2 = 1; j2 <= 7; j2++) {
        ctx.strokeStyle = j2 % 2 ? 'rgba(255,255,255,.28)' : 'rgba(26,86,140,.16)';
        ctx.lineWidth = j2 % 2 ? 12 : 7;
        tracePts(near, -(24 + j2 * (yIn - yOut) / 8)); ctx.stroke();
      }
      for (j2 = 0; j2 < 4; j2++) {
        var kx = cxR + (hh(sdB, j2 + 600) - 0.5) * CHUTE * 2.2, ky0 = yIn - ARCH * 0.6, ky1 = yOut + 10;
        ctx.strokeStyle = 'rgba(18,66,118,.4)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(kx, ky0);
        for (var kq = 1; kq <= 6; kq++) ctx.lineTo(kx + (hh(sdB + kq, j2 + 610) - 0.5) * 14 + kq * 2, lerp(ky0, ky1, kq / 6));
        ctx.stroke();
      }
      for (j2 = 0; j2 < 9; j2++) {
        var px3 = cxR + (hh(sdB, j2 + 620) - 0.5) * CHUTE * 2.6, py3 = lerp(yOut - 20, yIn - ARCH * 0.5, hh(sdB, j2 + 630)), pr3 = 10 + hh(sdB, j2 + 640) * 22;
        snowPatch(px3, py3, pr3 * 1.3, sdB * 7 + j2, 'rgba(255,255,255,.7)');
      }
    } else if (kind === 'rock') {
      /* Stone laid down in beds, bowed with the arch; joints across the
         beds; snow lying in the hollows on its back. */
      for (j2 = 1; j2 <= 9; j2++) {
        ctx.strokeStyle = j2 % 2 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.14)';
        ctx.lineWidth = j2 % 2 ? 2.4 : 1.6;
        tracePts(near, -(16 + j2 * (yIn - yOut) / 10)); ctx.stroke();
      }
      for (j2 = 0; j2 < 12; j2++) {                     // knobs of harder stone standing out of it
        var nx2 = cxR + (hh(sdB, j2 + 730) - 0.5) * CHUTE * 2.6, ny2 = lerp(yOut, yIn - ARCH * 0.5, hh(sdB, j2 + 740)), nr = 6 + hh(sdB, j2 + 750) * 12;
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.beginPath(); ctx.ellipse(nx2 + nr * 0.25, ny2 + nr * 0.3, nr, nr * 0.7, 0.3, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath(); ctx.ellipse(nx2 - nr * 0.2, ny2 - nr * 0.2, nr * 0.75, nr * 0.5, 0.3, 0, 6.2832); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1.4;
      for (j2 = 0; j2 < 14; j2++) {
        var jx = cxR + (hh(sdB, j2 + 660) - 0.5) * CHUTE * 2.6, jy = lerp(yOut, yIn - ARCH * 0.5, hh(sdB, j2 + 670));
        ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(jx + 3, jy + 10 + hh(sdB, j2 + 680) * 10); ctx.stroke();
      }
      for (j2 = 0; j2 < 10; j2++) {
        var sx4 = cxR + (hh(sdB, j2 + 690) - 0.5) * CHUTE * 2.6, sy4 = lerp(yOut - 10, yIn - ARCH * 0.6, hh(sdB, j2 + 700)), sr4 = 9 + hh(sdB, j2 + 710) * 20;
        snowPatch(sx4 + 2, sy4 + 3, sr4 * 1.4, sdB * 5 + j2, 'rgba(' + ROOF_RGB + ',' + (ink * 0.35).toFixed(3) + ')');
        snowPatch(sx4, sy4, sr4 * 1.4, sdB * 5 + j2, B.cap || '#ffffff');
      }
    }
    for (var g2 = 0; g2 < (SPARE || kind !== 'snow' ? 0 : 40); g2++) {      // looks only: not at low effects
      var gd = base + g2 * st, gy = scrY(gd);
      if (gy < top - 40 || gy > bot + 40) continue;
      var gk = Math.floor(gd / st);
      for (var gq = 0; gq < 3; gq++) {
        var gx = scrX(chuteAt(gd)) + (hh(gk, gq) - 0.5) * CHUTE * 2.6, gw = 18 + hh(gk, gq + 7) * 30, gh = 4 + hh(gk, gq + 11) * 5;
        var ga = (hh(gk, gq + 13) - 0.5) * 0.5;
        ctx.strokeStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.32).toFixed(3) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(gx + 1.5, gy + 2, gw, gh, ga, 0.15, Math.PI - 0.15); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(gx, gy, gw, gh, ga, 0.25, Math.PI - 0.25); ctx.stroke();
      }
    }

    /* The hill the cave runs under: stone breaking through the snow on
       its back, each lit on the upper left and dark below, with snow
       lying on top of it, and drifts banked against it. Pinned to the
       roof's own distance, so it rides with it. */
    for (var rk = 0; rk < (kind === 'snow' ? 7 : 0); rk++) {
      var u1 = hh(Math.floor(o.ph * 97), rk), u2 = hh(Math.floor(o.ph * 97), rk + 20);
      var rdd = o.d + o.span * (0.18 + 0.64 * u2), ry = scrY(rdd);
      var rxx = cxR + (u1 - 0.5) * CHUTE * 2.3, rr2 = 14 + hh(Math.floor(o.ph * 97), rk + 40) * 22;
      if (ry < top - 40 || ry > bot + 40) continue;
      ctx.fillStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.35).toFixed(3) + ')';          // its shadow on the snow
      ctx.beginPath(); ctx.ellipse(rxx + rr2 * 0.35, ry + rr2 * 0.45, rr2 * 1.15, rr2 * 0.75, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = B.rockDark;
      ctx.beginPath();
      for (var rq = 0; rq < 11; rq++) {
        var ra = rq / 11 * 6.2832, rrad = rr2 * (0.7 + 0.42 * hh(rk + 7, rq));
        var qx = rxx + Math.cos(ra) * rrad, qy = ry + Math.sin(ra) * rrad * 0.74;
        rq ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
      }
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = B.rock;                                                              // the lit facets
      ctx.beginPath(); ctx.moveTo(rxx - rr2, ry - rr2); ctx.lineTo(rxx + rr2 * 0.5, ry - rr2);
      ctx.lineTo(rxx + rr2 * 0.15, ry + rr2 * 0.1); ctx.lineTo(rxx - rr2 * 0.4, ry + rr2 * 0.35); ctx.lineTo(rxx - rr2, ry + rr2 * 0.2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.2;                          // a crack across it
      ctx.beginPath(); ctx.moveTo(rxx - rr2 * 0.1, ry - rr2 * 0.6); ctx.lineTo(rxx + rr2 * 0.1, ry); ctx.lineTo(rxx + rr2 * 0.5, ry + rr2 * 0.4); ctx.stroke();
      ctx.fillStyle = B.cap || '#ffffff';                                                  // snow lying on it, in lumps
      ctx.beginPath();
      ctx.ellipse(rxx - rr2 * 0.25, ry - rr2 * 0.6, rr2 * 0.7, rr2 * 0.32, -0.2, 0, 6.2832);
      ctx.ellipse(rxx + rr2 * 0.3, ry - rr2 * 0.55, rr2 * 0.45, rr2 * 0.26, 0.2, 0, 6.2832);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = B.snowA;                                                             // a drift banked against it
      ctx.beginPath(); ctx.ellipse(rxx - rr2 * 0.75, ry + rr2 * 0.35, rr2 * 0.45, rr2 * 0.22, 0.4, 0, 6.2832); ctx.fill();
    }

    ctx.restore();

    /* ---- the face of the overhang ----
       Hanging down from the near lip over the run: the front of the
       rock and ice the cave is cut into, lit at the top and falling into
       blue shade, layered where the ice built up, so the roof has height
       and is not a sheet laid over the run. */
    var FACE = 58, cxF = scrX(chuteAt(o.d)), facePts = [];
    for (var fq = 0; fq <= 36; fq++) {
      var fxx = cxF - CHUTE * 1.02 + fq / 36 * CHUTE * 2.04;
      var ft = (fxx - cxF) / (CHUTE * 0.98), fs = Math.max(0, 1 - Math.pow(Math.abs(ft), 6));
      /* an arch cut into it: shallow over the middle of the run, the
         full height at the sides — the mouth, with its pillars */
      facePts.push([fxx, archAt(fxx, yIn, 1, o.ph), fs * (0.4 + 0.6 * Math.pow(Math.abs(ft), 2.5))]);
    }
    /* The dark inside, seen through the mouth: deepest right under the
       arch, falling away across the ice towards you. Laid down first, so
       the face sits over its top. This is what says you go IN there. */
    ctx.save();
    traceRun(yIn - ARCH, yIn + FACE + 160);
    ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 5;
    for (var dk = 0; dk < 34; dk++) {                 // fine steps: no bands
      ctx.strokeStyle = 'rgba(4,14,34,' + (0.5 * Math.pow(1 - dk / 34, 1.8)).toFixed(3) + ')';
      ctx.beginPath();
      for (var fq0 = 0; fq0 <= 36; fq0++) {
        var fp0 = facePts[fq0];
        ctx.lineTo(fp0[0], fp0[1] + FACE * fp0[2] - 6 + dk * 3.3);
      }
      ctx.stroke();
    }
    /* and a glimpse of the way on, far inside: a faint blue glow of
       daylight at the other end */
    var gl2 = ctx.createRadialGradient(cxF, yIn + FACE * 0.4 + 10, 2, cxF, yIn + FACE * 0.4 + 10, CHUTE * 0.6);
    gl2.addColorStop(0, 'rgba(120,190,240,.28)'); gl2.addColorStop(1, 'rgba(120,190,240,0)');
    ctx.fillStyle = gl2; ctx.fillRect(cxF - CHUTE, yIn - 20, CHUTE * 2, FACE + 80);
    ctx.restore();
    ctx.beginPath();
    for (fq = 0; fq < facePts.length; fq++) ctx.lineTo(facePts[fq][0], facePts[fq][1]);
    for (fq = facePts.length - 1; fq >= 0; fq--) ctx.lineTo(facePts[fq][0], facePts[fq][1] + FACE * facePts[fq][2] + Math.sin(fq * 1.7 + o.ph) * 2.5 * facePts[fq][2]);
    ctx.closePath();
    var fgr = ctx.createLinearGradient(0, yIn - ARCH, 0, yIn + FACE);
    if (kind === 'ice') {
      fgr.addColorStop(0, '#e8f8ff'); fgr.addColorStop(0.45, '#7cc6ea'); fgr.addColorStop(0.8, '#2f7fb6'); fgr.addColorStop(1, '#1b4f7a');
    } else if (kind === 'rock') {
      fgr.addColorStop(0, mixHex(B.rock, '#ffffff', 0.3)); fgr.addColorStop(0.45, B.rock);
      fgr.addColorStop(0.8, B.rockDark); fgr.addColorStop(1, mixHex(B.rockDark, '#000000', 0.35));
    } else {
      fgr.addColorStop(0, '#e2f1fa'); fgr.addColorStop(0.45, '#8fb4cf'); fgr.addColorStop(0.8, '#4d6f8c'); fgr.addColorStop(1, '#2c445c');
    }
    ctx.fillStyle = fgr; ctx.fill();
    ctx.save(); ctx.clip();
    for (var lay = 1; lay <= 5; lay++) {                                            // the layers: firn, then ice, a winter each
      ctx.strokeStyle = lay % 2 ? 'rgba(255,255,255,.4)' : 'rgba(30,80,130,.28)';
      ctx.lineWidth = lay % 2 ? 1.6 : 2.4;
      ctx.beginPath();
      for (fq = 0; fq < facePts.length; fq++)
        ctx.lineTo(facePts[fq][0], facePts[fq][1] + FACE * facePts[fq][2] * lay / 6 + Math.sin(fq * 0.9 + lay * 2 + o.ph) * 2);
      ctx.stroke();
    }
    for (fq = 1; fq < facePts.length - 1; fq += 2) {                                // stone showing through the ice
      var hs2 = hh(fq, Math.floor(o.ph * 10)), fy0 = facePts[fq][1] + FACE * facePts[fq][2] * (0.35 + 0.4 * hs2);
      if (kind !== 'snow' || facePts[fq][2] < 0.3 || hs2 < 0.78) continue;
      var rw = 8 + hs2 * 14, rh = 6 + hs2 * 9;
      ctx.fillStyle = 'rgba(40,58,80,.3)';
      ctx.beginPath(); ctx.ellipse(facePts[fq][0], fy0, rw * 0.7, rh * 0.7, hs2 - 0.5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(200,225,245,.35)';
      ctx.beginPath(); ctx.ellipse(facePts[fq][0] - rw * 0.3, fy0 - rh * 0.4, rw * 0.5, rh * 0.3, -0.3, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(10,30,60,.45)'; ctx.lineWidth = 2;                     // its bottom edge, over the dark
    ctx.beginPath();
    for (fq = 0; fq < facePts.length; fq++) ctx.lineTo(facePts[fq][0], facePts[fq][1] + FACE * facePts[fq][2] + Math.sin(fq * 1.7 + o.ph) * 2.5 * facePts[fq][2]);
    ctx.stroke();

    /* ---- the lips ----
     The near mouth's edge is a cornice: the roof's snow rolled over the
     opening in a thick, lumpy lip, lit along its crest and blue in its
     own shade, with icicles hanging off it here and there, in twos and
     threes where the meltwater ran, each its own length. Now and then a
     stone shows through. It was a row of cobbles, which read as a wall
     built across the run; before that, a white line with a row of
     identical icicles, which read as teeth. */
    var seedL = Math.floor(o.ph * 131), cxIn = scrX(chuteAt(o.d));
    var x0L = cxIn - CHUTE * 1.04, x1L = cxIn + CHUTE * 1.04, NL = 44, CP = [];
    for (var cq = 0; cq <= NL; cq++) {
      var cxq = x0L + (x1L - x0L) * cq / NL;
      CP.push([cxq, archAt(cxq, yIn, 1, o.ph), hh(seedL, cq), hh(seedL, cq + 300)]);
    }
    var lipOn = CP[0][1] > Y0 && CP[0][1] < Y1;
    if (lipOn) {
      /* the icicles, under the lip */
      ctx.lineCap = 'round';
      for (cq = 2; cq < (SPARE ? 0 : NL - 1); cq++) {  // looks only: not at low effects
        if (CP[cq][2] > (kind === 'ice' ? 0.55 : kind === 'rock' ? 0.14 : 0.34)) continue;
        var nIc = 1 + Math.floor(CP[cq][3] * 3);
        for (var ci = 0; ci < nIc; ci++) {
          var icx = CP[cq][0] + ci * 4.2, il = (8 + hh(seedL + ci, cq + 40) * 24) * (ci ? 0.55 : 1), iw = 2 + hh(seedL + ci, cq + 60) * 2;
          var iy2 = CP[cq][1] + 5;
          ctx.fillStyle = 'rgba(178,220,244,.92)';
          ctx.beginPath(); ctx.moveTo(icx - iw, iy2); ctx.quadraticCurveTo(icx - iw * 0.35, iy2 + il * 0.6, icx + 0.3, iy2 + il);
          ctx.quadraticCurveTo(icx + iw * 0.45, iy2 + il * 0.55, icx + iw, iy2); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(icx - iw * 0.5, iy2 + 1); ctx.lineTo(icx - iw * 0.1, iy2 + il * 0.7); ctx.stroke();
        }
      }
      /* a stone now and then, set in the face under the snow */
      for (cq = 3; cq < (kind === 'snow' ? NL - 2 : 0); cq += 5) {
        if (CP[cq][3] < 0.5) continue;
        var sr = 5 + CP[cq][2] * 6, sx2 = CP[cq][0], sy3 = CP[cq][1] + 5;
        ctx.fillStyle = B.rockDark;
        ctx.beginPath(); ctx.ellipse(sx2, sy3, sr * 1.2, sr * 0.8, CP[cq][3] - 0.5, 0, 6.2832); ctx.fill();
        ctx.fillStyle = B.rock;
        ctx.beginPath(); ctx.ellipse(sx2 - sr * 0.3, sy3 - sr * 0.25, sr * 0.7, sr * 0.45, -0.4, 0, 6.2832); ctx.fill();
      }
      /* the cornice: its shaded underside, then the snow, then its crest */
      ctx.fillStyle = 'rgba(64,116,164,.55)';
      ctx.beginPath(); ctx.moveTo(CP[0][0], CP[0][1]);
      for (cq = 0; cq <= NL; cq++) ctx.lineTo(CP[cq][0], CP[cq][1] + 6 + CP[cq][2] * 4);
      for (cq = NL; cq >= 0; cq--) ctx.lineTo(CP[cq][0], CP[cq][1] - 4);
      ctx.closePath(); ctx.fill();
      var lipCol = kind === 'rock' ? B.rock : kind === 'ice' ? '#eefaff' : B.snowA, thick = kind === 'ice' ? 0.55 : 1;
      ctx.fillStyle = lipCol;
      ctx.beginPath(); ctx.moveTo(CP[0][0], CP[0][1] - 8 * thick);
      for (cq = 0; cq <= NL; cq++) ctx.lineTo(CP[cq][0], CP[cq][1] + (2 + CP[cq][3] * 3.5) * thick);
      for (cq = NL; cq >= 0; cq--) ctx.lineTo(CP[cq][0], CP[cq][1] - 9 * thick);
      ctx.closePath(); ctx.fill();
      for (cq = 1; cq < NL; cq += 2) {                                  // rolled over in lumps
        var lr = (4 + CP[cq][2] * 5) * thick;
        ctx.fillStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.25).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(CP[cq][0] + 1.2, CP[cq][1] + 1.5, lr, 0, Math.PI); ctx.fill();
        ctx.fillStyle = lipCol;
        ctx.beginPath(); ctx.arc(CP[cq][0], CP[cq][1] - 0.5, lr, 0, 6.2832); ctx.fill();
        if (kind === 'rock' && CP[cq][3] > 0.35) {                      // snow lying on the stones of the lip
          ctx.fillStyle = B.cap || '#ffffff';
          ctx.beginPath(); ctx.ellipse(CP[cq][0] - lr * 0.15, CP[cq][1] - lr * 0.55, lr * 0.85, lr * 0.4, 0, 0, 6.2832); ctx.fill();
        }
      }
      ctx.strokeStyle = B.lip || 'rgba(255,255,255,.95)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (cq = 0; cq <= NL; cq++) ctx.lineTo(CP[cq][0], CP[cq][1] - 6 - CP[cq][2] * 1.5);
      ctx.stroke();
    }

    /* The far edge: the cornice curling over the way out, its shadow
       falling on the ice beyond it. */
    ctx.save();
    traceRun(yOut - ARCH - 40, yOut + 20); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (sh = 0; sh < 4; sh++) {
      ctx.strokeStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.5 * (1 - sh / 4)).toFixed(3) + ')';
      ctx.lineWidth = 6; tracePts(far, -6 - sh * 5); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = kind === 'rock' ? B.rock : kind === 'ice' ? '#eefaff' : B.snowA;
    ctx.beginPath(); ctx.moveTo(far[0][0], far[0][1] + 6);
    for (var fxp = 0; fxp < far.length; fxp++) ctx.lineTo(far[fxp][0], far[fxp][1] - 3 - hh(seedL + 3, fxp) * 5);
    for (fxp = far.length - 1; fxp >= 0; fxp--) ctx.lineTo(far[fxp][0], far[fxp][1] + 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = B.lip || 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (fxp = 0; fxp < far.length; fxp++) ctx.lineTo(far[fxp][0], far[fxp][1] - 3 - hh(seedL + 3, fxp) * 5);
    ctx.stroke();
  }

  /* Deep, soft, wind-dumped snow. Pale and granular, with a rim where it
     heaps against the ice — it has to read as DEEP rather than as another
     white thing lying on white. */
  function drawDrift(x, y, o, B) {
    var r = o.r, k;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = B.snowA;
    ctx.globalAlpha = 0.88;
    /* Rounded, not faceted. Straight segments between wobbling radii came
       out as a spiky star, which reads as a splash rather than a heap. */
    var pts = [], a, rr;
    for (k = 0; k < 20; k++) {
      a = k / 20 * 6.2832;
      rr = r * (0.88 + 0.12 * Math.sin(k * 1.7 + o.ph));
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.76]);
    }
    ctx.beginPath();
    ctx.moveTo((pts[19][0] + pts[0][0]) / 2, (pts[19][1] + pts[0][1]) / 2);
    for (k = 0; k < 20; k++) {
      var nx = pts[(k + 1) % 20];
      ctx.quadraticCurveTo(pts[k][0], pts[k][1],
                           (pts[k][0] + nx[0]) / 2, (pts[k][1] + nx[1]) / 2);
    }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke();
    /* grain, so it reads as loose and not as a painted shape */
    ctx.fillStyle = B.bankShade;
    for (k = 0; k < 16; k++) {
      var ga = k * 2.399 + o.ph, gr = r * (0.2 + 0.62 * ((k * 7) % 10) / 10);
      ctx.globalAlpha = 0.10 + ((k * 5) % 4) * 0.03;
      ctx.beginPath();
      ctx.ellipse(Math.cos(ga) * gr, Math.sin(ga) * gr * 0.74,
                  3 + (k % 3), 2 + (k % 2), 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* A meltwater geyser. It breathes before it goes, which is the whole
     fairness of it: you can see the next one coming from far enough back
     to lengthen your line and arrive after it has dropped. */
  /* A geyser comes up through the ice of the run itself, after the
     owner's sketch. Two kinds, one for each geyser by where it stands:
       - a burst: the ice round it smashed in a star: cracks running out,
         deep and blue, plates of ice heaved up at the hole's edge with
         their broken sides showing, shards strewn about;
       - a crater: the ice round it sunk in steps, cracked in rings and a
         few cracks running out, a crust of frozen spray on its rim with
         icicles hanging into the water.
     In the middle of each a hole of dark water, which rises as its turn
     comes, boils, swells into a blue dome, and then goes up: a roaring
     column of jets out of a boil of white foam, steam rolling off it.
     (A sinter cone and a terraced fountain came before these; the owner
     found them too much like a park fountain.) What it can hit is the
     same circle it always was. The ice is painted once into a picture;
     only water, steam and spray move. */
  var GEYSER_KINDS = ['ring', 'burst'];
  function geyserKind(o) {
    return o.kind || GEYSER_KINDS[Math.floor(hh(Math.round(o.d || 0) + Math.round(o.x || 0) * 7, 41) * 2) % 2];
  }
  /* where the water comes out, above the spot on the ice: the crater */
  function geyserTop(kind, r) {
    return kind === 'ring' ? { y: -r * 0.02, rx: r * 0.24, ry: r * 0.18 }
                           : { y: -r * 0.02, rx: r * 0.26, ry: r * 0.19 };
  }
  function geyserGround(r, rnd, lobe, kind, B) {
    var k, j, T = geyserTop(kind, r);
    var mg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.25);  // wet, darkened ice round it
    mg.addColorStop(0, 'rgba(40,104,152,.34)'); mg.addColorStop(1, 'rgba(40,104,152,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * 1.02, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.2;      // glazed where the spray froze
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.06, r * 0.86, 0, 3.4, 4.9); ctx.stroke();
    /* its shadow on the ice, thrown down and to the right */
    ctx.fillStyle = 'rgba(30,64,100,.2)';
    ctx.beginPath(); ctx.ellipse(r * 0.22, r * 0.16, r * 0.82, r * 0.6, 0.35, 0, 6.2832); ctx.fill();

    {
      /* ---- the ice, broken round the vent ---- */
      var NCR = 8, ang0 = rnd(1100) * 6.2832, hx = T.rx, hy = T.ry, A = [];
      for (k = 0; k < NCR; k++) A.push(ang0 + k / NCR * 6.2832 + (rnd(k + 1110) - 0.5) * 0.45);
      /* the cracks, running out from the hole: dark and deep at their
         root, narrowing to nothing, each lit along one lip */
      var crackPts = function (a0, len, sd) {
        var P = [[Math.cos(a0) * hx * 0.9, Math.sin(a0) * hy * 0.9]], aa = a0;
        for (var q = 1; q <= 5; q++) {
          aa += (rnd(sd + q) - 0.5) * 0.5;
          var rr = lerp(hx * 0.9, len, q / 5);
          P.push([Math.cos(aa) * rr, Math.sin(aa) * rr * 0.8]);
        }
        return P;
      };
      var crack = function (P, w0) {
        var L = [], R = [], n = P.length;
        for (var q = 0; q < n; q++) {
          var a1 = P[Math.min(q + 1, n - 1)], a2 = P[Math.max(q - 1, 0)];
          var dx = a1[0] - a2[0], dy = a1[1] - a2[1], dl = Math.hypot(dx, dy) || 1, w = w0 * (1 - q / (n - 1));
          L.push([P[q][0] - dy / dl * w, P[q][1] + dx / dl * w]); R.push([P[q][0] + dy / dl * w, P[q][1] - dx / dl * w]);
        }
        var g = ctx.createLinearGradient(P[0][0], P[0][1], P[n - 1][0], P[n - 1][1]);
        g.addColorStop(0, '#0a2c46'); g.addColorStop(1, '#3f86b4');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
        for (q = 1; q < n; q++) ctx.lineTo(L[q][0], L[q][1]);
        for (q = n - 1; q >= 0; q--) ctx.lineTo(R[q][0], R[q][1]);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;        // the lit lip
        ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1] - 0.5); for (q = 1; q < n; q++) ctx.lineTo(L[q][0], L[q][1] - 0.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(14,50,80,.5)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(R[0][0], R[0][1] + 0.5); for (q = 1; q < n; q++) ctx.lineTo(R[q][0], R[q][1] + 0.5); ctx.stroke();
      };
      if (kind === 'burst') {
        for (k = 0; k < NCR; k++) {
          var len = r * (0.95 + 0.5 * rnd(k + 1120));
          var Pc = crackPts(A[k], len, k * 10 + 1200);
          crack(Pc, r * (0.08 + 0.04 * rnd(k + 1130)));
          if (rnd(k + 1140) < 0.7) {                     // a branch off it
            var bi = 2 + Math.floor(rnd(k + 1150) * 2), ba = A[k] + (rnd(k + 1160) < 0.5 ? -0.7 : 0.7);
            var Pb = [Pc[bi]];
            for (j = 1; j <= 3; j++) Pb.push([Pc[bi][0] + Math.cos(ba + (rnd(k * 3 + j + 1170) - 0.5) * 0.4) * r * 0.12 * j,
                                           Pc[bi][1] + Math.sin(ba + (rnd(k * 3 + j + 1170) - 0.5) * 0.4) * r * 0.1 * j]);
            crack(Pb, r * 0.035);
          }
        }
        /* plates of ice heaved up round the hole, tipped towards it: their
           broken edge stands up and shows its side */
        for (k = 0; k < NCR; k++) {
          if (rnd(k + 1180) < 0.45) continue;
          var a1 = A[k] + 0.12, a2 = A[(k + 1) % NCR] - 0.12 + (k === NCR - 1 ? 6.2832 : 0);
          var ro = r * (0.7 + 0.25 * rnd(k + 1190)), th = r * (0.1 + 0.05 * rnd(k + 1195));
          var inner = [], outer = [];
          for (j = 0; j <= 6; j++) {
            var aj = lerp(a1, a2, j / 6), jag = 0.82 + 0.3 * rnd(k * 7 + j + 1200);
            inner.push([Math.cos(aj) * hx * 1.1, Math.sin(aj) * hy * 1.1]);
            outer.push([Math.cos(aj) * ro * jag, Math.sin(aj) * ro * 0.8 * jag]);
          }
          /* heaved up at the hole: its inner edge lifted by th, so that edge
             stands as a wall of blue ice facing you */
          var lifted = inner.map(function (pt) { return [pt[0], pt[1] - th]; });
          var plate = lifted.concat(outer.slice().reverse());
          var side = lifted.concat(inner.slice().reverse());
          var eg = ctx.createLinearGradient(0, -th - hy, 0, hy);
          eg.addColorStop(0, '#7fbde0'); eg.addColorStop(1, '#2f6f9c');
          ctx.fillStyle = eg; polyPath(ctx, side); ctx.fill();
          ctx.strokeStyle = 'rgba(220,244,255,.5)'; ctx.lineWidth = 0.8;     // layers in its broken edge
          ctx.beginPath();
          for (j = 0; j <= 6; j++) ctx.lineTo(inner[j][0], inner[j][1] - th * 0.5);
          ctx.stroke();
          var pg2 = ctx.createLinearGradient(-ro, -ro, ro, ro);
          pg2.addColorStop(0, '#d4eef9'); pg2.addColorStop(1, '#9ccbe6');
          ctx.fillStyle = pg2; polyPath(ctx, plate); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(lifted[0][0], lifted[0][1]); for (j = 1; j <= 6; j++) ctx.lineTo(lifted[j][0], lifted[j][1]); ctx.stroke();
          ctx.strokeStyle = 'rgba(20,70,110,.4)'; ctx.lineWidth = 1; polyPath(ctx, plate); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.8;   // a crack across the plate
          ctx.beginPath(); ctx.moveTo(lerp(lifted[2][0], outer[2][0], 0.2), lerp(lifted[2][1], outer[2][1], 0.2));
          ctx.lineTo(lerp(lifted[4][0], outer[4][0], 0.7), lerp(lifted[4][1], outer[4][1], 0.7)); ctx.stroke();
        }
      } else {
        /* ---- a crater: the ice sunk in steps round the vent ---- */
        var R1 = r * 0.6, R2 = r * 0.9, step = r * 0.07;
        var wall = function (R, hgt, c0, c1) {        // the far side of a step, standing as a wall towards you
          var wg = ctx.createLinearGradient(0, -R * 0.8, 0, -R * 0.8 + hgt);
          wg.addColorStop(0, c0); wg.addColorStop(1, c1);
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.8, 0, Math.PI, 0, false);
          ctx.ellipse(0, hgt, R, R * 0.8, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill();
        };
        ctx.fillStyle = 'rgba(40,110,160,.14)';      // the outer ring, a little down
        ctx.beginPath(); ctx.ellipse(0, step * 0.5, R2, R2 * 0.8, 0, 0, 6.2832); ctx.fill();
        wall(R2, step * 0.7, '#9cc9e3', '#5f9cc6');
        ctx.fillStyle = 'rgba(30,96,148,.2)';        // the inner one, further down
        ctx.beginPath(); ctx.ellipse(0, step * 1.2, R1, R1 * 0.8, 0, 0, 6.2832); ctx.fill();
        wall(R1, step * 1.2, '#7fb6d9', '#3f7fae');
        /* cracks round each step, broken, and a few running out */
        var ringCrack = function (R, w, sd, gaps, dy) {
          for (var q = 0; q < 14; q++) {
            if (rnd(sd + q) < gaps) continue;
            var a0 = (q + rnd(sd + q + 20) * 0.2) / 14 * 6.2832, a1 = (q + 0.9) / 14 * 6.2832, P = [];
            for (var m = 0; m <= 4; m++) {
              var am = lerp(a0, a1, m / 4), rr = R * (0.97 + 0.06 * rnd(sd + q * 5 + m + 40));
              P.push([Math.cos(am) * rr, Math.sin(am) * rr * 0.8 + dy]);
            }
            crack(P, w);
          }
        };
        ringCrack(R2, r * 0.035, 1500, 0.35, step * 0.6);
        ringCrack(R1, r * 0.045, 1600, 0.2, step * 1.2);
        for (k = 0; k < 5; k++) {
          var ra = A[k * 8 % NCR] + k * 0.3, Pr = crackPts(ra, r * (1.05 + 0.3 * rnd(k + 1700)), k * 10 + 1710);
          crack(Pr, r * 0.05);
        }
        /* the crust of frozen spray on the rim, and icicles hanging from its
           far side into the water */
        ctx.fillStyle = 'rgba(70,120,165,.45)';
        lobe(hx * 1.55, hy * 1.6, 20, 0.14, 1800); ctx.save(); ctx.translate(1, 2); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#f2f8fc';
        lobe(hx * 1.55, hy * 1.6, 20, 0.14, 1800); ctx.fill();
        ctx.fillStyle = '#ffffff';
        for (k = 0; k < 9; k++) {                     // its lumps
          var la = k / 9 * 6.2832 + rnd(k + 1820), lr = r * (0.04 + 0.03 * rnd(k + 1830));
          ctx.beginPath(); ctx.arc(Math.cos(la) * hx * 1.35, Math.sin(la) * hy * 1.4 - lr * 0.3, lr, 0, 6.2832); ctx.fill();
        }
        for (k = 0; k < 7; k++) {                     // icicles off the far rim
          var ia = Math.PI * (1.15 + 0.7 * k / 6), il = r * (0.05 + 0.07 * rnd(k + 1840)), iw = r * 0.022;
          var ix = Math.cos(ia) * hx * 1.12, iy = Math.sin(ia) * hy * 1.12;
          ctx.fillStyle = 'rgba(214,240,252,.95)';
          ctx.beginPath(); ctx.moveTo(ix - iw, iy); ctx.lineTo(ix + iw, iy); ctx.lineTo(ix + iw * 0.2, iy + il); ctx.closePath(); ctx.fill();
        }
      }
      /* shards strewn about, and frost where the spray froze */
      for (k = 0; k < 12; k++) {
        var sa = rnd(k + 1300) * 6.2832, sd2 = r * (0.6 + 0.7 * rnd(k + 1310)), ss = r * (0.025 + 0.035 * rnd(k + 1320));
        var sxp = Math.cos(sa) * sd2, syp = Math.sin(sa) * sd2 * 0.8;
        ctx.fillStyle = 'rgba(30,80,120,.25)';
        ctx.beginPath(); ctx.ellipse(sxp + ss * 0.4, syp + ss * 0.5, ss, ss * 0.5, 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#eaf7fd';
        polyPath(ctx, [[sxp - ss * (0.8 + 0.4 * rnd(k + 1330)), syp], [sxp - ss * 0.2, syp - ss * (0.6 + 0.6 * rnd(k + 1340))], [sxp + ss, syp - ss * 0.2], [sxp + ss * 0.3, syp + ss * 0.6]]); ctx.fill();
        ctx.fillStyle = '#9fcde6';
        polyPath(ctx, [[sxp + ss * 0.3, syp + ss * 0.6], [sxp + ss, syp - ss * 0.2], [sxp + ss * 0.9, syp + ss * 0.3]]); ctx.fill();
      }
      /* the hole: open water, its edge broken ice */
      ctx.fillStyle = '#d9effa';
      lobe(hx * 1.12, hy * 1.12, 14, 0.12, 1400); ctx.fill();
    }
    /* the crater: turquoise going down into the dark */
    var hg = ctx.createRadialGradient(0, T.y + T.ry * 0.2, 1, 0, T.y, T.rx);
    hg.addColorStop(0, '#031827'); hg.addColorStop(0.55, '#0b4a6e'); hg.addColorStop(1, '#3fb3d0');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, T.y, T.rx, T.ry, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,.35)'; ctx.lineWidth = 1; ctx.stroke();
  }
  function drawGeyser(x, y, o, B) {
    var ph = geyserPhase(o), up = geyserUp(o), r = o.r, k, upF = GEYSER_UP / GEYSER_PERIOD;
    var t = up ? ph / upF : 0, h = up ? Math.sin(Math.PI * t) : 0;
    var w8 = up ? 1 : (ph - upF) / (1 - upF);       // build-up, 0 just after, 1 just before
    var kind = geyserKind(o), T = geyserTop(kind, r);
    var seed = o.d * 0.0137 + (o.x || 0) * 0.031;
    function rnd(i) { var v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); }
    function lobe(rx, ry, n, wob, off) {
      var P = [];
      for (var i = 0; i < n; i++) {
        var a = i / n * 6.2832, f = 1 - wob + wob * 2 * rnd(i + off);
        P.push([Math.cos(a) * rx * f, Math.sin(a) * ry * f]);
      }
      ctx.beginPath();
      ctx.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
      for (i = 0; i < n; i++) {
        var q = P[(i + 1) % n];
        ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + q[0]) / 2, (P[i][1] + q[1]) / 2);
      }
      ctx.closePath();
    }
    ctx.save();
    ctx.translate(x, y);
    var GB = B || PAL || {};
    var pic = HILL
      ? pictureOf(o, 'geyser|' + kind + '|' + drawK, function () {
          return spriteOf(-r * 1.5, -r * 1.3, r * 1.5, r * 1.3, function (ox, oy) {
            ctx.save(); ctx.translate(ox, oy); geyserGround(r, rnd, lobe, kind, GB); ctx.restore();
          });
        }, 1)
      : null;
    if (up) {
      /* the column's shadow, thrown down the hill along the ice; laid
         down before the geyser itself, which stands in it */
      var SL = r * (0.6 + 1.2 * h) - T.y * 0.6, sw = T.rx * 1.6;
      ctx.save(); ctx.rotate(Math.atan2(SUN_DY, SUN_DX));
      ctx.fillStyle = 'rgba(30,70,110,' + (0.16 * h).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(r * 0.2, -sw);
      ctx.bezierCurveTo(SL * 0.5, -sw * 1.1, SL * 0.85, -sw * 1.6, SL, -sw * 0.8);
      ctx.quadraticCurveTo(SL + sw * 1.5, 0, SL, sw * 0.8);
      ctx.bezierCurveTo(SL * 0.85, sw * 1.6, SL * 0.5, sw * 1.1, r * 0.2, sw);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (pic) blit(pic, 0, 0); else geyserGround(r, rnd, lobe, kind, GB);

    /* the water in the crater: rising as its turn comes, rippling faster,
       boiling, then swelling into a dome — the warning from far up the hill */
    ctx.translate(0, T.y);
    var vr = T.rx, vy = T.ry, lv = 0.35 + 0.65 * w8;
    var wg = ctx.createRadialGradient(-vr * 0.2 * lv, -vy * 0.25 * lv, 0.5, 0, 0, vr * lv);
    wg.addColorStop(0, 'rgba(150,232,246,' + (0.4 + 0.5 * w8).toFixed(2) + ')');
    wg.addColorStop(1, 'rgba(24,130,170,' + (0.25 + 0.45 * w8).toFixed(2) + ')');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.ellipse(0, 0, vr * lv * 0.92, vy * lv * 0.92, 0, 0, 6.2832); ctx.fill();
    if (!up && w8 > 0.35) {                           // boiling
      var nb = Math.round(2 + 5 * (w8 - 0.35));
      for (k = 0; k < nb; k++) {
        var bp = (W.t * (0.04 + 0.05 * w8) + rnd(k + 150)) % 1;
        var ba = rnd(k + 170) * 6.2832, bd = rnd(k + 190) * 0.7;
        ctx.strokeStyle = 'rgba(235,250,255,' + (0.9 * (1 - bp)).toFixed(2) + ')'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(Math.cos(ba) * vr * lv * bd, Math.sin(ba) * vy * lv * bd, 0.6 + bp * (1.2 + 1.5 * w8), 0, 6.2832); ctx.stroke();
      }
    }
    if (!up && w8 > 0.86) {                           // the blue dome, the instant before
      var dm = (w8 - 0.86) / 0.14, dr = vr * (0.6 + 0.9 * dm);
      var dg = ctx.createRadialGradient(-dr * 0.3, -dr * 0.4 - dm * 3, 0.5, 0, -dm * 3, dr);
      dg.addColorStop(0, 'rgba(230,252,255,.95)'); dg.addColorStop(0.5, 'rgba(90,200,228,.9)'); dg.addColorStop(1, 'rgba(30,140,184,.75)');
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.ellipse(0, -dm * 3, dr, dr * 0.8, 0, 0, 6.2832); ctx.fill();
    }
    /* steam, always: thin when it sleeps, thick as it wakes, rolling off
       up the hill, lit on its upper left */
    var ns = up ? 7 : 2 + Math.round(4 * w8);
    for (k = 0; k < ns; k++) {
      var sp = (W.t * 0.006 + rnd(k + 210)) % 1;
      var sx = (rnd(k + 230) - 0.5) * r * 0.4 + Math.sin(sp * 4 + k) * r * 0.15 - sp * r * 0.35;
      var sy = -sp * r * (1.1 + 0.8 * h);
      var srr = r * (0.16 + sp * 0.4) * (up ? 1.4 : 0.7 + 0.5 * w8);
      var sal = (1 - sp) * (up ? 0.5 : 0.14 + 0.32 * w8);
      var sg = ctx.createRadialGradient(sx - srr * 0.3, sy - srr * 0.3, 0, sx, sy, srr);
      sg.addColorStop(0, 'rgba(255,255,255,' + sal.toFixed(2) + ')');
      sg.addColorStop(0.6, 'rgba(226,236,244,' + (sal * 0.7).toFixed(2) + ')');
      sg.addColorStop(1, 'rgba(206,222,236,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sx, sy, srr, 0, 6.2832); ctx.fill();
    }

    if (up) {
      /* Erupting. The column leaps from the crater or the hole, lit on the
         sun's side and grey on the other, and bursts at the top into spray
         and a cloud of steam; out of the ice it roars up in several jets
         from a boil of white foam. */
      var H = r * (0.6 + 1.8 * h), bw = vr * 1.0;
      {
        /* the boil of white water round its foot, churning */
        var fz = Math.floor(W.t / 5) % 4;
        ctx.fillStyle = 'rgba(150,186,212,.8)';
        lobe(vr * (1.55 + 0.3 * h), vy * (1.6 + 0.3 * h), 22, 0.12, 500 + fz * 30); ctx.fill();
        ctx.save(); ctx.translate(-1.5, -2);
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        lobe(vr * (1.35 + 0.3 * h), vy * (1.4 + 0.3 * h), 22, 0.12, 520 + fz * 30); ctx.fill();
        ctx.restore();
      }
      var cl = [], cr2 = [], NC = 10;
      for (k = 0; k <= NC; k++) {
        var u = k / NC, wob = Math.sin(W.t * 0.31 + k * 1.9) * bw * 0.22, wob2 = Math.sin(W.t * 0.27 + k * 2.3) * bw * 0.22;
        var half = bw * (0.9 + u * 1.15) * (0.9 + 0.2 * rnd(k + 450 + Math.floor(W.t / 4) % 4));
        var mid = Math.sin(W.t * 0.13 + u * 3) * bw * 0.15 * u;
        cl.push([mid - half - wob, -H * u]); cr2.push([mid + half + wob2, -H * u]);
      }
      var colPath = function () {
        ctx.beginPath(); ctx.moveTo(cl[0][0], cl[0][1]);
        for (k = 1; k <= NC; k++) ctx.quadraticCurveTo(cl[k - 1][0], cl[k - 1][1], (cl[k - 1][0] + cl[k][0]) / 2, (cl[k - 1][1] + cl[k][1]) / 2);
        ctx.lineTo(cl[NC][0], cl[NC][1]); ctx.lineTo(cr2[NC][0], cr2[NC][1]);
        for (k = NC; k >= 1; k--) ctx.quadraticCurveTo(cr2[k][0], cr2[k][1], (cr2[k - 1][0] + cr2[k][0]) / 2, (cr2[k - 1][1] + cr2[k][1]) / 2);
        ctx.lineTo(cr2[0][0], cr2[0][1]);
        ctx.closePath();
      };
      var cg2 = ctx.createLinearGradient(-bw * 2, 0, bw * 2.2, 0);
      cg2.addColorStop(0, 'rgba(255,255,255,.97)'); cg2.addColorStop(0.45, 'rgba(240,247,252,.95)');
      cg2.addColorStop(0.8, 'rgba(184,208,226,.93)'); cg2.addColorStop(1, 'rgba(150,182,206,.9)');
      ctx.fillStyle = cg2; colPath(); ctx.fill();
      ctx.strokeStyle = 'rgba(150,196,224,.5)'; ctx.lineWidth = 1;           // jets streaking up it
      for (k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(k * bw * 0.45, -2);
        ctx.quadraticCurveTo(k * bw * 0.8 + Math.sin(W.t * 0.2 + k) * 2, -H * 0.5, k * bw * 1.1, -H * 0.85); ctx.stroke();
      }
      {
        /* more jets inside the roar of it, fanning a little as they rise,
           and steam rolling off its sides */
        ctx.lineCap = 'round';
        for (k = 0; k < 5; k++) {
          var jt = (k - 2) / 2, jw2 = Math.sin(W.t * 0.4 + k * 1.3) * bw * 0.15;
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.75 + 0.2 * (k % 2)).toFixed(2) + ')'; ctx.lineWidth = bw * (0.35 + 0.15 * (k % 2));
          ctx.beginPath(); ctx.moveTo(jt * bw * 0.5, -2);
          ctx.quadraticCurveTo(jt * bw * 0.8 + jw2, -H * 0.55, jt * bw * 1.9 + jw2, -H * (0.92 + 0.12 * Math.sin(W.t * 0.2 + k))); ctx.stroke();
        }
        for (k = 0; k < (SPARE ? 3 : 6); k++) {
          var side2 = k % 2 ? 1 : -1, sp2 = (W.t * 0.008 + rnd(k + 560)) % 1;
          var stx = side2 * (bw * 1.6 + sp2 * r * 0.6), sty = -H * (0.25 + 0.5 * rnd(k + 570)) - sp2 * r * 0.3, str2 = r * (0.22 + 0.3 * sp2) * (0.6 + 0.5 * h);
          var stg = ctx.createRadialGradient(stx - str2 * 0.3, sty - str2 * 0.3, 0, stx, sty, str2);
          stg.addColorStop(0, 'rgba(255,255,255,' + (0.7 * (1 - sp2)).toFixed(2) + ')'); stg.addColorStop(1, 'rgba(220,232,242,0)');
          ctx.fillStyle = stg; ctx.beginPath(); ctx.arc(stx, sty, str2, 0, 6.2832); ctx.fill();
        }
      }
      for (k = 0; k < 22; k++) {                       // drops flung out and falling back
        var dp = (W.t * 0.035 + rnd(k + 300)) % 1;
        var da = rnd(k + 320) * 6.2832, dr2 = r * (0.25 + dp * (0.6 + 0.6 * rnd(k + 340))) * (0.5 + 0.5 * h);
        var lift = Math.sin(Math.PI * dp) * r * 0.5 * h;
        ctx.fillStyle = 'rgba(235,250,255,' + (0.95 * (1 - dp * 0.7)).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(Math.cos(da) * dr2, -H * 0.6 + Math.sin(da) * dr2 * 0.8 - lift, 1 + rnd(k + 360) * 1.6, 0, 6.2832); ctx.fill();
      }
      for (k = 0; k < 7; k++) {                          // the cloud it bursts into at the top
        var ca = k * 0.9 + W.t * 0.02;
        var crr = bw * (1.4 + 0.7 * rnd(k + 500)) * (0.6 + 0.6 * h);
        var ccx = Math.cos(ca) * bw * 1.5 - k * bw * 0.12, ccy = -H - r * 0.15 + Math.sin(ca) * bw * 0.6 - k * bw * 0.2;
        var cgr = ctx.createRadialGradient(ccx - crr * 0.3, ccy - crr * 0.3, 0, ccx, ccy, crr);
        cgr.addColorStop(0, 'rgba(255,255,255,.85)'); cgr.addColorStop(0.6, 'rgba(228,238,246,.55)');
        cgr.addColorStop(1, 'rgba(210,226,238,0)');
        ctx.fillStyle = cgr;
        ctx.beginPath(); ctx.arc(ccx, ccy, crr, 0, 6.2832); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* The three readable finds, told apart by shape as well as colour: a
     six-point frost star that slows the hill, a clear lens that shows the
     line, and a ring of little fish that calls the shoal. Colour alone
     would not do it — three coloured discs on blue ice read as three
     coloured discs. */
  function drawFind3(x, y, o) {
    var r = o.r, a = W.t * 0.03 + o.ph, k;
    var tone = o.t === 'chill' ? ['#ffffff', '#9fd9f6', '#4a9fd0']
             : o.t === 'sight' ? ['#f2ffe4', '#b9ea86', '#4f9a3c']
                               : ['#eaf8ff', '#86cdf0', '#2f7fb4'];
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(40,100,150,.22)';
    ctx.beginPath(); ctx.ellipse(4, 7, r * 1.0, r * 0.88, 0, 0, 6.2832); ctx.fill();

    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.34, 1, 0, 0, r);
    g.addColorStop(0, tone[0]); g.addColorStop(0.6, tone[1]); g.addColorStop(1, tone[2]);
    ctx.fillStyle = g;

    if (o.t === 'chill') {
      /* A cold draught: a snowflake caught in a gust. The wind is the
         point — curls of it wrapping round, turning slowly, because the
         thing it does is slow the hill down. A star on its own read as
         one more snowflake. */
      ctx.save();
      ctx.rotate(a * 0.25);
      ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
      for (k = 0; k < 6; k++) {                      // the flake: six arms, branched
        ctx.save(); ctx.rotate(k * 1.0472);
        ctx.lineWidth = r * 0.12;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.62); ctx.stroke();
        ctx.lineWidth = r * 0.07;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.34); ctx.lineTo(-r * 0.16, -r * 0.48);
        ctx.moveTo(0, -r * 0.34); ctx.lineTo(r * 0.16, -r * 0.48);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#d8f2ff';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, 6.2832); ctx.fill();
      ctx.restore();
      /* the gust: three streaks of wind blowing through it, each ending
         in a curl, drifting slowly across */
      ctx.save();
      ctx.lineCap = 'round';
      for (k = 0; k < 3; k++) {
        var gy = (k - 1) * r * 0.5, drift = Math.sin(a * 0.9 + k * 1.7) * r * 0.08;
        var gx0 = -r * 1.05 + drift, gx1 = r * (0.55 - (k % 2) * 0.2) + drift;
        ctx.strokeStyle = 'rgba(46,130,196,.9)'; ctx.lineWidth = r * 0.085;
        ctx.beginPath();
        ctx.moveTo(gx0, gy);
        ctx.bezierCurveTo(gx0 + r * 0.5, gy - r * 0.12, gx1 - r * 0.5, gy + r * 0.12, gx1, gy);
        /* the curl back over at the tip */
        ctx.arc(gx1, gy - r * 0.14, r * 0.14, Math.PI * 0.5, Math.PI * 1.85, true);
        ctx.stroke();
      }
      ctx.restore();
    } else if (o.t === 'sight') {
      /* A clear lens of ice, and through it, a path lighting up: dots of
         gold light running up it one after another — the openings ahead,
         shown before you get there. The green oval before it read as a
         sweet. */
      var lg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      lg.addColorStop(0, 'rgba(214,242,255,.95)'); lg.addColorStop(0.6, 'rgba(110,182,226,.92)');
      lg.addColorStop(1, 'rgba(46,112,170,.95)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = r * 0.16; ctx.stroke();
      ctx.strokeStyle = 'rgba(70,140,196,.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, 6.2832); ctx.stroke();
      /* the path, an S up the lens */
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 6.2832); ctx.clip();
      /* the path itself, a faint warm trail */
      ctx.strokeStyle = 'rgba(255,214,110,.55)'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      ctx.beginPath();
      for (k = 0; k <= 20; k++) {
        var uu = k / 20, qx = Math.sin(uu * 3.4 - 0.6) * r * 0.36, qy = r * 0.62 - uu * r * 1.24;
        k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
      }
      ctx.stroke();
      for (k = 0; k < 6; k++) {
        var u = k / 5, px = Math.sin(u * 3.4 - 0.6) * r * 0.36, py = r * 0.62 - u * r * 1.24;
        var lit = (a * 0.8 - u + 10) % 1;            // a light that runs up it
        var glow = Math.max(0, 1 - lit * 3);
        ctx.fillStyle = 'rgba(255,206,64,' + (0.8 + 0.2 * glow).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(px, py, r * (0.12 + 0.06 * glow), 0, 6.2832); ctx.fill();
        if (glow > 0.2) {
          ctx.fillStyle = 'rgba(255,240,180,' + (0.35 * glow).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(px, py, r * 0.24, 0, 6.2832); ctx.fill();
        }
      }
      ctx.restore();
    } else {
      /* A horseshoe magnet frozen in a block of ice, red and blue, with
         its field pulsing out of the poles and two small fish being drawn
         in. The one man-made thing on the hill, by the user's choice: a
         ring of fish read as nothing, and a magnet says at once what it
         does (GAME_SPEC.md, non-goals). */
      var bob = Math.sin(a * 1.6) * r * 0.05;
      /* the block of ice */
      var ig = ctx.createLinearGradient(-r, -r, r, r);
      ig.addColorStop(0, 'rgba(240,250,255,.95)'); ig.addColorStop(0.5, 'rgba(176,222,246,.9)');
      ig.addColorStop(1, 'rgba(110,180,222,.92)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, -r * 0.92); ctx.lineTo(r * 0.82, -r * 0.86);
      ctx.lineTo(r * 0.94, r * 0.74); ctx.lineTo(-r * 0.7, r * 0.9); ctx.lineTo(-r * 0.94, -r * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.2; ctx.stroke();
      /* the field: arcs pulsing outwards from the poles */
      for (k = 0; k < 3; k++) {
        var ph2 = (a * 0.9 + k / 3) % 1;
        ctx.globalAlpha = (1 - ph2) * 0.75;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, -r * 0.42 + bob, r * (0.3 + ph2 * 0.62), Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      /* the magnet: a thick U, red arm and blue arm, silver poles */
      ctx.save();
      ctx.translate(0, bob);
      ctx.lineCap = 'butt';
      var w = r * 0.3, R = r * 0.42, cy = r * 0.08;
      ctx.lineWidth = w;
      ctx.strokeStyle = '#d8323f';                      // red half
      ctx.beginPath(); ctx.moveTo(-R, -r * 0.34); ctx.lineTo(-R, cy); ctx.arc(0, cy, R, Math.PI, Math.PI * 1.5, true); ctx.stroke();
      ctx.strokeStyle = '#2f6fd6';                      // blue half
      ctx.beginPath(); ctx.moveTo(R, -r * 0.34); ctx.lineTo(R, cy); ctx.arc(0, cy, R, 0, Math.PI * 0.5); ctx.stroke();
      ctx.fillStyle = '#e6edf3';                        // the poles
      ctx.fillRect(-R - w / 2, -r * 0.56, w, r * 0.22);
      ctx.fillRect(R - w / 2, -r * 0.56, w, r * 0.22);
      ctx.strokeStyle = 'rgba(6,42,120,.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath();                                  // a navy outline round the U
      ctx.moveTo(-R - w / 2, -r * 0.56); ctx.lineTo(-R - w / 2, cy); ctx.arc(0, cy, R + w / 2, Math.PI, 0, true);
      ctx.lineTo(R + w / 2, -r * 0.56); ctx.lineTo(R - w / 2, -r * 0.56); ctx.lineTo(R - w / 2, cy);
      ctx.arc(0, cy, R - w / 2, 0, Math.PI); ctx.lineTo(-R + w / 2, -r * 0.56); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)';          // shine on the red arm
      ctx.fillRect(-R - w * 0.3, -r * 0.3, w * 0.22, r * 0.36);
      ctx.restore();
      /* two small fish, drawn in towards the poles */
      ctx.fillStyle = '#2f7fb4';
      for (k = 0; k < 2; k++) {
        var t2 = (a * 0.7 + k * 0.5) % 1, side = k ? 1 : -1;
        var fx = side * r * (1.25 - t2 * 0.75), fy = -r * (0.95 - t2 * 0.45);
        ctx.save();
        ctx.globalAlpha = Math.min(1, (1 - t2) * 2.2);
        ctx.translate(fx, fy); ctx.rotate(side > 0 ? 2.6 : 0.55);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.18, r * 0.09, 0, 0, 6.2832); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-r * 0.16, 0); ctx.lineTo(-r * 0.28, -r * 0.08); ctx.lineTo(-r * 0.28, r * 0.08);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.24, r * 0.13, -0.5, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /* A ball of packed powder, still spinning where the wind rolled it. */
  function drawRushBall(x, y, o) {
    var r = o.r, a = W.t * 0.05 + o.ph, k;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(60,120,166,.22)';
    ctx.beginPath(); ctx.ellipse(4, 7, r * 1.05, r * 0.92, 0, 0, 6.2832); ctx.fill();

    /* Speed lines streaming out behind it: this is the find that makes
       you unstoppable, and a still snowball said nothing of the kind. */
    ctx.lineCap = 'round';
    for (k = 0; k < 4; k++) {
      var sxo = (k - 1.5) * r * 0.42, run = (a * 1.8 + k * 0.37) % 1;
      var len = r * (0.7 + 0.5 * ((k * 7) % 3) / 2);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 - run * 0.6).toFixed(3) + ')';
      ctx.lineWidth = r * (0.12 - k % 2 * 0.03);
      ctx.beginPath();
      ctx.moveTo(sxo, r * 0.7 + run * r * 0.3);
      ctx.lineTo(sxo * 1.15, r * 0.7 + run * r * 0.3 + len);
      ctx.stroke();
    }

    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.34, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.62, '#e8f5ff');
    g.addColorStop(1, '#b9d9ef');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();

    /* packed layers, turning: this is a ball that has been rolling */
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.clip();
    ctx.strokeStyle = 'rgba(150,196,226,.55)'; ctx.lineWidth = 2.2;
    for (k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(Math.cos(a + k * 2.1) * r * 0.3, Math.sin(a + k * 2.1) * r * 0.3,
                  r * 0.78, r * 0.34, a * 0.6 + k, 0, 6.2832);
      ctx.stroke();
    }
    ctx.restore();

    /* a glowing heart to it, beating */
    var beat = 0.6 + 0.4 * Math.sin(a * 3);
    var core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.62);
    core.addColorStop(0, 'rgba(255,226,120,' + (0.95 * beat).toFixed(3) + ')');
    core.addColorStop(0.5, 'rgba(255,170,70,' + (0.5 * beat).toFixed(3) + ')');
    core.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 6.2832); ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke();

    /* loose powder flicking off it */
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (k = 0; k < 6; k++) {
      var fa = a * 1.6 + k * 1.047, fr = r * (1.18 + 0.16 * Math.sin(a * 2 + k));
      ctx.beginPath();
      ctx.arc(Math.cos(fa) * fr, Math.sin(fa) * fr, 2.4 + (k % 3), 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  /* Seen from above, a snow bridge is a band of shadow with a bright lip of
     drifted snow at each mouth. Nothing here is built: it is snow that
     drifted across the gap and set. */









  /* A ball of packed powder, still spinning where the wind rolled it. */

  
  /* An ice cube with something frozen inside it: a block of clear blue
     glacier ice, seen from above and a little to the side so you get its
     top and two of its faces, bevelled and frosted at the edges, and a
     golden fish caught stiff in the middle, glowing through the ice. It
     was a lumpy nodule — asked to become a cube, and a cube is what you
     would want to crack open. Bobs gently where it lies. */
  /* the three faces (top, left, right) for a cube of half-size s, round
     the corner nearest you at the centre */
  function cubeFaces(s) {
    return [
      [[0, -s * 1.1], [s, -s * 0.55], [0, 0], [-s, -s * 0.55]],
      [[-s, -s * 0.55], [0, 0], [0, s * 1.1], [-s, s * 0.55]],
      [[0, 0], [s, -s * 0.55], [s, s * 0.55], [0, s * 1.1]]
    ];
  }
  var CUBE_TONE = [['#f2fbff', '#bfe7fa'], ['#a6dcf5', '#6cbbe6'], ['#5fa9db', '#3a82c0']];
  function polyPath(c, pts, dx, dy) {
    c.beginPath();
    for (var q = 0; q < pts.length; q++) {
      var px = pts[q][0] + (dx || 0), py = pts[q][1] + (dy || 0);
      q ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  function cubeFill(c, f, pts, s, alpha) {
    var g = c.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, CUBE_TONE[f][0]); g.addColorStop(1, CUBE_TONE[f][1]);
    c.globalAlpha = alpha;
    c.fillStyle = g; polyPath(c, pts); c.fill();
    c.globalAlpha = 1;
  }
  /* the golden fish frozen in a find, nose to the right, lying aslant */
  function drawGoldFish(c, r, pulse) {
    c.save();
    c.rotate(-0.45);
    c.scale(-1, 1);
    c.translate(-r * 0.03, 0);
    realFish(c, r * 0.47, r * 0.16, 2.4, true, pulse);
    c.restore();
  }
  /* The block itself. Glacier ice is never glass: it is blue where it is
     thick, cloudy at the heart where the air was pushed as it froze, with
     a stream of bubbles caught rising, a fracture shining inside it, rime
     on its foot and its corners knocked. Snow has settled on top and
     slumps over the front edge, and more is banked round its foot, so it
     sits IN the hill rather than on it. It no longer bobs: a block of ice
     does not.
     What is inside is NOT shown (owner, 12 Nov 2026): a golden fish seen
     through clear ice promised gold, and the find pays fish, gold or a
     life. So the ice is frosted thick and milky, and all that shows
     through it is a question mark of light, its colour turning slowly
     through the three things it might be — gold, blue, rose. */
  var FIND_HUES = [[255, 206, 84], [110, 196, 255], [255, 128, 182]];
  function findHue(a) {                       // the light inside, turning: rgb triplet
    var t = (a * 0.18) % 3, i = Math.floor(t), f = t - i, f2 = f * f * (3 - 2 * f);
    var A = FIND_HUES[i % 3], B2 = FIND_HUES[(i + 1) % 3], wh = 0.55 * Math.sin(Math.PI * f);   // through white, not mud
    function ch(j) { var v = A[j] + (B2[j] - A[j]) * f2; return Math.round(v + (255 - v) * wh); }
    return ch(0) + ',' + ch(1) + ',' + ch(2);
  }
  function drawFind(x, y, o, c) {
    c = c || ctx;
    var r = o.r, a = (W ? W.t : 0) * 0.021 + o.ph, k, i;
    var s = r * 0.82, F = cubeFaces(s), pulse = 0.55 + 0.45 * Math.sin(a * 2.1), hue = findHue(a);
    var w = function (f) { return Math.max(0.5, s * f); };
    function on(P, u, v) {                    // a point on face P, u along P0-P1, v along P0-P3
      return [P[0][0] + (P[1][0] - P[0][0]) * u + (P[3][0] - P[0][0]) * v,
              P[0][1] + (P[1][1] - P[0][1]) * u + (P[3][1] - P[0][1]) * v];
    }
    function blob(P, uv, dx, dy) {            // a soft lump through points on a face
      var q = uv.map(function (t) { var p = on(P, t[0], t[1]); return [p[0] + (dx || 0), p[1] + (dy || 0)]; });
      var n = q.length;
      c.beginPath();
      c.moveTo((q[n - 1][0] + q[0][0]) / 2, (q[n - 1][1] + q[0][1]) / 2);
      for (var j = 0; j < n; j++) {
        var nx = q[(j + 1) % n];
        c.quadraticCurveTo(q[j][0], q[j][1], (q[j][0] + nx[0]) / 2, (q[j][1] + nx[1]) / 2);
      }
      c.closePath();
    }
    var hex = [[0, -1.1 * s], [s, -0.55 * s], [s, 0.55 * s], [0, 1.1 * s], [-s, 0.55 * s], [-s, -0.55 * s]];
    c.save();
    c.translate(x, y);

    /* its shadow, thrown down and to the right, and in it the light the
       block gathers and lets through: ice casts a bright patch, not only
       a dark one */
    c.fillStyle = 'rgba(24,66,112,.22)';
    polyPath(c, [[0, 0], [0.95 * s, 0.6 * s], [1.95 * s, 1.15 * s], [0.95 * s, 1.72 * s], [-0.05 * s, 1.15 * s], [-s, 0.55 * s]]);
    c.fill();
    var cs = c.createRadialGradient(0.95 * s, 1.15 * s, 0, 0.95 * s, 1.15 * s, 0.7 * s);
    cs.addColorStop(0, 'rgba(' + hue + ',' + (0.3 + 0.25 * pulse).toFixed(3) + ')');
    cs.addColorStop(0.5, 'rgba(190,240,255,.3)'); cs.addColorStop(1, 'rgba(190,240,255,0)');
    c.fillStyle = cs;
    c.beginPath(); c.ellipse(0.95 * s, 1.15 * s, 0.7 * s, 0.38 * s, 0.5, 0, 6.2832); c.fill();

    /* the block, seen into: pale at the top, deep blue in the thick of it */
    var bg = c.createLinearGradient(-s * 0.6, -1.1 * s, s * 0.6, 1.1 * s);
    bg.addColorStop(0, '#dcf2fc'); bg.addColorStop(0.5, '#86c6e9'); bg.addColorStop(1, '#2d70a8');
    c.fillStyle = bg; polyPath(c, hex); c.fill();
    c.save(); polyPath(c, hex); c.clip();
    var cg = c.createRadialGradient(0, s * 0.05, 1, 0, s * 0.05, s * 1.1);
    cg.addColorStop(0, 'rgba(' + hue + ',' + (0.75 + 0.25 * pulse).toFixed(3) + ')');
    cg.addColorStop(0.55, 'rgba(' + hue + ',' + (0.3 + 0.2 * pulse).toFixed(3) + ')');
    cg.addColorStop(1, 'rgba(' + hue + ',0)');
    c.fillStyle = cg; c.fillRect(-s * 1.5, -s * 1.5, s * 3, s * 3);
    /* frosted through: milky, so nothing inside has a shape */
    var mg = c.createRadialGradient(-s * 0.15, s * 0.1, 0, 0, s * 0.1, s * 1.1);
    mg.addColorStop(0, 'rgba(244,250,255,.45)'); mg.addColorStop(1, 'rgba(226,240,250,.6)');
    c.fillStyle = mg; c.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
    c.restore();

    /* the three faces over it: the top frosted, the lit side clear, the
       side away from the sun deep */
    cubeFill(c, 0, F[0], s, 0.3);
    cubeFill(c, 1, F[1], s, 0.14);
    cubeFill(c, 2, F[2], s, 0.24);

    /* the lit face: a stream of bubbles caught rising, and darker where
       the ice is thickest, at its foot */
    c.save(); polyPath(c, F[1]); c.clip();
    var dg = c.createLinearGradient(0, -0.2 * s, 0, 1.1 * s);
    dg.addColorStop(0, 'rgba(20,70,130,0)'); dg.addColorStop(1, 'rgba(20,70,130,.3)');
    c.fillStyle = dg; c.fillRect(-s, -s, s, 2.2 * s);
    c.strokeStyle = 'rgba(255,255,255,.62)'; c.lineWidth = w(0.025);
    for (i = 0; i < 7; i++) {
      var bp = on(F[1], 0.3 + Math.sin(i * 1.9) * 0.04, 0.88 - i * 0.1);
      c.beginPath(); c.arc(bp[0], bp[1], s * (0.05 - i * 0.005), 0, 6.2832); c.stroke();
    }
    /* a feather of fracture inside, catching the light */
    var f0 = on(F[1], 0.55, 0.18), f1 = on(F[1], 0.72, 0.42), f2 = on(F[1], 0.62, 0.66);
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = w(0.16);
    c.beginPath(); c.moveTo(f0[0], f0[1]); c.quadraticCurveTo(f1[0], f1[1], f2[0], f2[1]); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = w(0.025);
    c.stroke();
    c.restore();

    /* the face away from the sun: a shell-shaped fracture shining in it,
       runnels where it has started to melt, and rime along its foot */
    c.save(); polyPath(c, F[2]); c.clip();
    c.fillStyle = dg; c.fillRect(0, -s, s, 2.2 * s);
    var cp = on(F[2], 0.58, 0.4);
    c.fillStyle = 'rgba(255,255,255,.13)';
    c.beginPath(); c.ellipse(cp[0], cp[1], s * 0.27, s * 0.15, -0.55, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = w(0.025);
    c.beginPath(); c.ellipse(cp[0], cp[1], s * 0.27, s * 0.15, -0.55, 3.6, 6.0); c.stroke();
    c.strokeStyle = 'rgba(236,250,255,.28)'; c.lineWidth = w(0.03);
    for (i = 0; i < 2; i++) {
      var r0 = on(F[2], 0.25 + i * 0.4, 0.08), r1 = on(F[2], 0.27 + i * 0.42, 0.62 + i * 0.1);
      c.beginPath(); c.moveTo(r0[0], r0[1]); c.lineTo(r1[0], r1[1]); c.stroke();
    }
    c.fillStyle = 'rgba(244,252,255,.6)';
    for (i = 0; i < 16; i++) {
      var rp = on(F[2], hh(i, 3), 0.8 + hh(i, 7) * 0.2);
      c.beginPath(); c.arc(rp[0], rp[1], s * (0.018 + hh(i, 11) * 0.025), 0, 6.2832); c.fill();
    }
    c.restore();

    /* the question mark of light, deep in the frosted ice: a wide glow of
       the turning colour, the mark in it, and a bright core */
    c.save();
    polyPath(c, hex); c.clip();
    c.translate(-s * 0.08, s * 0.32); c.rotate(-0.1);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var qf = function (sz) { return '800 ' + Math.max(6, Math.round(sz)) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif'; };
    var qg = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.8);
    qg.addColorStop(0, 'rgba(' + hue + ',' + (0.55 + 0.25 * pulse).toFixed(3) + ')'); qg.addColorStop(1, 'rgba(' + hue + ',0)');
    c.fillStyle = qg; c.beginPath(); c.arc(0, 0, s * 0.8, 0, 6.2832); c.fill();
    c.font = qf(s * 1.3);
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(' + hue + ',.95)'; c.lineWidth = Math.max(1, s * 0.14);
    c.strokeText('?', 0, 0);
    c.fillStyle = 'rgba(255,255,255,' + (0.85 + 0.15 * pulse).toFixed(3) + ')';
    c.fillText('?', 0, 0);
    c.restore();

    /* the edges, worn round: bright where they face the sun, a thin dark
       line where the block turns away; and a corner knocked off */
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = 'rgba(16,58,108,.5)'; c.lineWidth = w(0.05);
    c.beginPath(); c.moveTo(s, -0.55 * s); c.lineTo(s, 0.55 * s); c.lineTo(0, 1.1 * s); c.lineTo(-s, 0.55 * s); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = w(0.07);
    polyPath(c, F[0]); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = w(0.045);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 1.1 * s); c.moveTo(-s, -0.55 * s); c.lineTo(-s, 0.55 * s); c.stroke();
    c.fillStyle = 'rgba(232,248,255,.92)';
    polyPath(c, [[s, -0.55 * s], [s * 0.78, -0.44 * s], [s * 0.86, -0.3 * s], [s, -0.36 * s]]); c.fill();
    c.strokeStyle = 'rgba(30,90,150,.45)'; c.lineWidth = w(0.025);
    c.beginPath(); c.moveTo(s * 0.78, -0.44 * s); c.lineTo(s * 0.86, -0.3 * s); c.stroke();

    /* the snow on top: a cap settled on the back of it, its edge broken
       into lumps, thinner and bluer where it is in its own shade, slumped
       over the front edge in one place and sparkling */
    var cap = [];
    for (i = 0; i < 18; i++) {
      var ca = i / 18 * 6.2832, cr = 0.34 * (0.86 + 0.24 * hh(i, 21)) * (i & 1 ? 0.93 : 1.03);
      cap.push([0.4 + Math.cos(ca) * cr * 1.1, 0.44 + Math.sin(ca) * cr]);
    }
    c.fillStyle = 'rgba(96,146,190,.5)'; blob(F[0], cap, s * 0.03, s * 0.06); c.fill();
    var sg = c.createLinearGradient(-s * 0.6, -s * 1.1, s * 0.3, -s * 0.1);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.6, '#f3f8fc'); sg.addColorStop(1, '#cfe0ee');
    c.fillStyle = sg; blob(F[0], cap); c.fill();
    var e0 = on(F[0], 0.26, 1), e1 = on(F[0], 0.42, 1);   // a lump slumped over the front edge
    c.fillStyle = '#eef5fa';
    c.beginPath(); c.moveTo(e0[0] - s * 0.04, e0[1] - s * 0.06);
    c.bezierCurveTo(e0[0], e0[1] + s * 0.12, e1[0] - s * 0.06, e1[1] + s * 0.16, e1[0] + s * 0.02, e1[1] - s * 0.02);
    c.lineTo(on(F[0], 0.34, 0.86)[0], on(F[0], 0.34, 0.86)[1]);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = w(0.04);
    var l0 = on(F[0], 0.1, 0.3), lm = on(F[0], 0.2, 0.12), l1 = on(F[0], 0.5, 0.1);
    c.beginPath(); c.moveTo(l0[0], l0[1]); c.quadraticCurveTo(lm[0], lm[1], l1[0], l1[1]); c.stroke();
    for (i = 0; i < 4; i++) {                 // the sparkle of it
      var tw = Math.max(0, Math.sin(a * 3.1 + i * 1.7));
      if (tw < 0.2) continue;
      var sp = on(F[0], [0.3, 0.52, 0.2, 0.46][i], [0.3, 0.42, 0.55, 0.66][i]), sl = s * 0.08 * tw;
      c.strokeStyle = 'rgba(255,255,255,' + tw.toFixed(3) + ')'; c.lineWidth = w(0.025);
      c.beginPath(); c.moveTo(sp[0] - sl, sp[1]); c.lineTo(sp[0] + sl, sp[1]);
      c.moveTo(sp[0], sp[1] - sl); c.lineTo(sp[0], sp[1] + sl); c.stroke();
    }

    /* snow drifted against its foot: low, lumpy, hugging the bottom edges */
    function drift(x0, y0, x1, y1, ht, seed) {
      var n = 6, dxl = x1 - x0, dyl = y1 - y0;
      c.beginPath(); c.moveTo(x0, y0);
      for (var j = 1; j <= n; j++) {
        var t0 = (j - 0.5) / n, t1 = j / n, bump = ht * (0.55 + 0.45 * Math.sin(Math.PI * t0)) * (0.7 + 0.5 * hh(seed, j));
        c.quadraticCurveTo(x0 + dxl * t0, y0 + dyl * t0 - bump, x0 + dxl * t1, y0 + dyl * t1 - bump * 0.35 * Math.sin(Math.PI * t1));
      }
      c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + ht * 0.7, x0, y0);
      c.closePath();
    }
    [[-1.12, 0.5, -0.12, 1.08, 0.22, 3], [-0.25, 1.12, 0.45, 0.82, 0.16, 5], [0.62, 0.66, 1.08, 0.48, 0.12, 9]].forEach(function (m) {
      c.fillStyle = 'rgba(96,146,190,.42)'; c.save(); c.translate(s * 0.03, s * 0.05);
      drift(m[0] * s, m[1] * s, m[2] * s, m[3] * s, m[4] * s, m[5]); c.fill(); c.restore();
      var dg2 = c.createLinearGradient(0, (m[1] + m[3]) / 2 * s - m[4] * s, 0, (m[1] + m[3]) / 2 * s + m[4] * s * 0.6);
      dg2.addColorStop(0, '#ffffff'); dg2.addColorStop(1, '#d6e6f2');
      c.fillStyle = dg2; drift(m[0] * s, m[1] * s, m[2] * s, m[3] * s, m[4] * s, m[5]); c.fill();
    });

    /* a glint running along the front edge of the top */
    var gp = (a * 0.35) % 1, g0 = on(F[0], 1, 0), g1 = on(F[0], 1, 1);
    c.fillStyle = 'rgba(255,255,255,' + (0.9 * Math.sin(gp * Math.PI)).toFixed(3) + ')';
    c.beginPath(); c.arc(g0[0] + (g1[0] - g0[0]) * gp, g0[1] + (g1[1] - g0[1]) * gp, s * 0.08, 0, 6.2832); c.fill();
    c.restore();
  }

  /* Where the course runs out. Not a banner or a flag — the ice itself
     changes: a wide apron of clean blue glacier, a bright lip where it
     starts, and spray hanging over it. */
  function drawFinish(y, o, B) {
    /* The run does not get a line drawn across it — it stops being a run.
       The ice breaks off in a ridge of blocks and beyond it is open snow.

       It used to be a white stroke with two pale rectangles behind it, and
       both rectangles ended in a hard horizontal edge straight across the
       frame. Three graphic bands stacked up; nothing about it said you had
       arrived anywhere. */
    var i, k, t, lx, ly;
    var w = CHUTE + 140, cx = scrX(o.x);
    /* Far enough that its far edge is never on screen: at 460 it ended in
       a hard horizontal line straight across the frame. */
    var past = 1500;

    ctx.save();

    /* ---- the snowfield beyond, with a broken edge where the ice ends ---- */
    ctx.beginPath();
    ctx.moveTo(cx - w, y - past);
    ctx.lineTo(cx + w, y - past);
    for (i = 24; i >= 0; i--) {
      t = i / 24;
      lx = cx - w + w * 2 * t;
      /* the break is ragged, and sags a little in the middle where the
         run has worn it thinnest */
      ly = y - Math.sin(t * Math.PI) * 26
             + Math.sin(t * 13.1 + o.d * 0.01) * 13
             + Math.sin(t * 31.7) * 5;
      ctx.lineTo(lx, ly);
    }
    ctx.closePath();
    var sg = ctx.createLinearGradient(0, y, 0, y - past);
    sg.addColorStop(0, B.snowA);
    sg.addColorStop(0.55, B.snowA);
    sg.addColorStop(1, B.bankEdge || B.snowA);
    ctx.fillStyle = sg;
    ctx.fill();

    /* ---- the ridge: blocks of ice stood on end where it sheared ---- */
    for (i = 0; i < 26; i++) {
      t = (i + 0.5) / 26;
      lx = cx - w + w * 2 * t;
      ly = y - Math.sin(t * Math.PI) * 26 + Math.sin(t * 13.1 + o.d * 0.01) * 13;
      var h = 16 + Math.abs(Math.sin(i * 2.3 + o.d * 0.013)) * 30;
      var bw = 13 + ((i * 7) % 9);
      var lean = Math.sin(i * 1.7) * 0.22;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(lean);
      var bg = ctx.createLinearGradient(0, -h, 0, h * 0.5);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.55, B.bankEdge || '#dff1fb');
      bg.addColorStop(1, B.bankShade);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-bw, h * 0.5);
      ctx.lineTo(-bw * 0.72, -h);
      ctx.lineTo(bw * 0.78, -h * 0.86);
      ctx.lineTo(bw, h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    /* ---- loose chunks scattered on the snow just past the break ---- */
    for (i = 0; i < 11; i++) {
      /* x and y need their own numbers. Taking both from one made every
         chunk fall on the same perfect diagonal. */
      var hx = Math.sin(i * 3.1 + o.d * 0.007);
      var hy = Math.abs(Math.sin(i * 1.73 + o.d * 0.019 + 2.2));
      var h2 = Math.abs(hx);
      var px = cx + hx * w * 0.82;
      var py = y - 40 - hy * 300;
      var r2 = 7 + h2 * 11;
      ctx.fillStyle = 'rgba(150,186,212,.30)';
      ctx.beginPath(); ctx.ellipse(px + 3, py + 4, r2, r2 * 0.8, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = B.bankEdge || '#eaf6ff';
      ctx.beginPath();
      ctx.moveTo(px - r2, py + r2 * 0.6);
      ctx.lineTo(px - r2 * 0.5, py - r2);
      ctx.lineTo(px + r2 * 0.8, py - r2 * 0.6);
      ctx.lineTo(px + r2, py + r2 * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.6; ctx.stroke();
    }

    /* ---- a last wash of light on the ice just short of it ---- */
    var lg = ctx.createLinearGradient(0, y + 150, 0, y);
    lg.addColorStop(0, 'rgba(226,246,255,0)');
    lg.addColorStop(1, 'rgba(226,246,255,.40)');
    ctx.fillStyle = lg;
    ctx.fillRect(cx - CHUTE - 20, y, CHUTE * 2 + 40, 150);
    ctx.restore();
  }


  /* A boulder from above: grey stone with a cap of snow sitting on its upper
     face, the join between them wavy rather than a clean arc. */
  /* A nunatak from above: a ridge, not a wall. The crest takes the light
     and holds what snow stays on it, the flanks fall away into the rock's
     own shadow, and both tips run out to nothing so you can see exactly
     where the ice starts again at either end of it. Every edge is read off
     nunEdge, which is also what the run collides against, so what looks
     like clear ice is clear ice. */
  function drawNunatak(o, B) {
    var d0 = Math.max(o.d, W.dist + PLAYER_Y - VIEW_H - 80);
    var d1 = Math.min(o.d + o.span, W.dist + PLAYER_Y + 80);
    if (d1 <= d0) return;
    var n = Math.max(4, Math.ceil((d1 - d0) / 14)), i;

    /* One pass down the rock per band. `a` and `b` are how far out on each
       flank its two edges run — a number, or a function of how far down the
       rock you are, which is what lets a band pinch out to nothing and open
       up again. Reading them off nunEdge means a band follows the facets
       instead of cutting across them. */
    function band(a, b, dx, dy) {
      var k, dd, u, cx, y;
      var fa = typeof a === 'function' ? a : function () { return a; };
      var fb = typeof b === 'function' ? b : function () { return b; };
      ctx.beginPath();
      for (k = 0; k <= n; k++) {
        dd = d0 + (d1 - d0) * k / n; u = (dd - o.d) / o.span;
        cx = scrX(chuteAt(dd) + o.rel) + (dx || 0); y = scrY(dd) + (dy || 0);
        if (k === 0) ctx.moveTo(cx - nunEdge(o, dd, -1) * fa(u), y);
        else ctx.lineTo(cx - nunEdge(o, dd, -1) * fa(u), y);
      }
      for (k = n; k >= 0; k--) {
        dd = d0 + (d1 - d0) * k / n; u = (dd - o.d) / o.span;
        cx = scrX(chuteAt(dd) + o.rel) + (dx || 0);
        ctx.lineTo(cx + nunEdge(o, dd, 1) * fb(u), scrY(dd) + (dy || 0));
      }
      ctx.closePath();
    }

    ctx.save();
    band(1, 1, 7, 10);
    ctx.fillStyle = B.shadow || 'rgba(86,132,176,.26)'; ctx.fill();

    /* Snow drifts AGAINST a rock, not onto it — from straight above, a
       ridge is a dark thing with a bright collar of packed drift piled
       round it. Painted white down the middle instead it read as a crack
       in the ice, which is the one thing it must not look like. */
    ctx.fillStyle = B.cap || '#ffffff';
    ctx.globalAlpha = 0.26; band(1.40, 1.40); ctx.fill();
    ctx.globalAlpha = 0.52; band(1.17, 1.17); ctx.fill();
    ctx.globalAlpha = 1;

    band(1, 1);
    ctx.fillStyle = B.rockDark; ctx.fill();
    ctx.save(); ctx.clip();

    band(0.74, 0.14);                                 // the lit flank
    ctx.fillStyle = B.rock; ctx.fill();

    /* And the faces between the facets, each one taking the light a little
       differently. Without them the lit flank is one flat brown shape the
       whole length of the rock. */
    var nodes = o.el.length;
    for (i = 0; i < nodes - 1; i++) {
      var ua = i / (nodes - 1), ub = (i + 1) / (nodes - 1);
      var sda = o.d + o.span * ua, sdb = o.d + o.span * ub;
      if (sdb < d0 || sda > d1) continue;
      var tone = ((i * 7919) % 5) / 5;
      ctx.fillStyle = tone < 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(22,30,40,.13)';
      /* Along the flank, not across the rock: a quad spanning both edges
         reads as a band painted over it. */
      ctx.beginPath();
      ctx.moveTo(scrX(chuteAt(sda) + o.rel) - nunEdge(o, sda, -1), scrY(sda));
      ctx.lineTo(scrX(chuteAt(sdb) + o.rel) - nunEdge(o, sdb, -1), scrY(sdb));
      ctx.lineTo(scrX(chuteAt(sdb) + o.rel) - nunEdge(o, sdb, -1) * 0.18, scrY(sdb));
      ctx.lineTo(scrX(chuteAt(sda) + o.rel) - nunEdge(o, sda, -1) * 0.18, scrY(sda));
      ctx.closePath(); ctx.fill();
    }

    /* Two cracks running the LENGTH of it, which is how a ridge of rock
       breaks. Across it they read as hoops on a barrel; along it they
       split the thing into blocks. */
    ctx.strokeStyle = 'rgba(28,38,50,.28)'; ctx.lineWidth = 2.4;
    [-0.30, 0.34].forEach(function (f, ci) {
      ctx.beginPath();
      for (var k = 0; k <= n; k++) {
        var dd2 = d0 + (d1 - d0) * k / n;
        var e = f < 0 ? -nunEdge(o, dd2, -1) : nunEdge(o, dd2, 1);
        var wob = Math.sin(dd2 * 0.016 + o.ph + ci * 2.1) * 0.16;
        var xx = scrX(chuteAt(dd2) + o.rel) + e * (Math.abs(f) + wob);
        if (k === 0) ctx.moveTo(xx, scrY(dd2)); else ctx.lineTo(xx, scrY(dd2));
      }
      ctx.stroke();
    });

    /* Fractures: short, angled, never reaching across — a line all the way
       over turned the thing into a barrel with hoops on it. */
    ctx.strokeStyle = 'rgba(34,46,60,.34)'; ctx.lineCap = 'round';
    var fstep = 46, fbase = Math.ceil(d0 / fstep) * fstep;
    for (i = 0; fbase + i * fstep < d1; i++) {
      var fd = fbase + i * fstep;
      var fl = nunEdge(o, fd, -1), fr = nunEdge(o, fd, 1);
      var fx = scrX(chuteAt(fd) + o.rel), fy = scrY(fd);
      var side = ((i * 7919) % 11) < 5 ? -1 : 1;
      var inn = ((i * 104729) % 7) / 7 * 0.34;
      var len = (side < 0 ? fl : fr) * (0.44 + ((i * 7717) % 5) / 11);
      ctx.lineWidth = 2 + ((i * 31) % 2);
      ctx.beginPath();
      ctx.moveTo(fx + side * (side < 0 ? fl : fr) * inn, fy - 4);
      ctx.lineTo(fx + side * ((side < 0 ? fl : fr) * inn + len), fy + 7);
      ctx.stroke();
    }
    ctx.restore();

    band(1, 1);
    ctx.strokeStyle = 'rgba(52,72,92,.40)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  /* ---- painted once, blitted after ----
     A pine is a few hundred points and a stone four clipped passes; the
     scenery past the banks alone is dozens of them, every frame. None of
     it moves, so each is painted once into a little canvas of its own at
     the screen's resolution and copied from then on.
     While one stretch fades into the next the colours change every frame.
     That used to mean drawing everything fresh for the length of the fade,
     which doubled the cost of a frame, and at its end every stone and pine
     on screen painted its new picture in the same frame: thirty to sixty
     canvases at once, which a phone felt as the game freezing each time the
     hill changed. Now a thing keeps its picture in the old stretch's
     colours and gets one in the new, and the two are crossfaded. Pictures
     are made a few a frame (SPRITES_PER_FRAME); a thing whose picture is
     not made yet is drawn fresh, exactly as before, so nothing pops. The
     new stretch's are begun a second and a half before it (NEXT), so the
     fade opens with them made. */
  var SPRITES_PER_FRAME = 4, spriteBudget = SPRITES_PER_FRAME;
  var FADING = null, NEXT = null;   // set by render(): { from, to, t } through a fade; the stretch about to come
  function fadeOf() {
    if (!W || W.course || W.biome === 0 || W.biomeT >= FADE) return null;
    return { from: BIOMES[(W.biome - 1) % BIOMES.length], to: biome(), t: W.biomeT / FADE };
  }
  function nextOf() {
    if (!W || W.course || W.biomeT < zoneLen() - W.speed * 90) return null;
    return BIOMES[(W.biome + 1) % BIOMES.length];
  }
  /* o's picture under key, made now by make() if the frame can afford it.
     A thing holds one picture; through a fade, and the run-up to one, two. */
  function pictureOf(o, key, make, keep) {
    var P = o._pics || (o._pics = []), s = null, i;
    for (i = 0; i < P.length; i++) if (P[i].k === key) { s = P[i].s; break; }
    if (i === P.length) {
      if (spriteBudget <= 0) return null;
      spriteBudget--;
      s = make();
      P.push({ k: key, s: s });
    }
    while (P.length > keep) free(P.splice(P[0].k === key ? 1 : 0, 1)[0]);   // the oldest: the stretch behind
    return s;
  }
  function free(p) { if (p.s) p.s.cv.width = p.s.cv.height = 0; }   // its memory now, not at the next GC
  /* Draws o from its pictures and says whether it could; when it could
     not, the caller draws it fresh in B. key(P) names o's picture in a
     palette P, paint(P) makes it. */
  function drawPictured(o, x, y, B, key, paint) {
    var F = (B === PAL) ? FADING : null, N = (B === PAL) ? NEXT : null;
    if (!F) {
      var one = pictureOf(o, key(B), function () { return paint(B); }, N ? 2 : 1);
      if (N && spriteBudget > 2)            // what is on the hill now goes first
        pictureOf(o, key(N), function () { return paint(N); }, 2);
      if (one) blit(one, x, y);
      return !!one;
    }
    var kf = key(F.from), kt = key(F.to);
    var sf = pictureOf(o, kf, function () { return paint(F.from); }, 2);
    var st = pictureOf(o, kt, function () { return paint(F.to); }, 2);
    if (!sf || !st) return false;
    /* the new over the old, at alphas that sum, for an opaque pixel, to
       the alpha this thing is drawn at and to a mix of t of the new one */
    var a0 = ctx.globalAlpha, an = a0 * F.t, ao = an >= 1 ? 1 : a0 * (1 - F.t) / (1 - an);
    ctx.globalAlpha = ao; blit(sf, x, y);
    ctx.globalAlpha = an; blit(st, x, y);
    ctx.globalAlpha = a0;
    return true;
  }
  /* The box runs from (x0, y0) to (x1, y1) around the thing's centre, with
     room for the shadow it throws, which is painted into it too. */
  function spriteOf(x0, y0, x1, y1, paint) {
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas');
    var cx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!cx) return null;
    var w = x1 - x0, h = y1 - y0;
    cv.width = Math.ceil(w * drawK); cv.height = Math.ceil(h * drawK);
    cx.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0);
    var keep = ctx; ctx = cx;
    try { paint(-x0, -y0); } finally { ctx = keep; }
    return { cv: cv, x0: x0, y0: y0, w: w, h: h };
  }
  function rockKey(P) { return P.rock + P.rockDark + (P.cap || '') + '|' + drawK; }
  function treeKey(P) { return P.tree + P.treeDark + (P.cap || '') + (P.snowyTrees || 0) + '|' + drawK; }
  function plantKey(P) { return (P.flora ? P.flora + P.trunk : '') + treeKey(P); }
  function blit(spr, x, y) { ctx.drawImage(spr.cv, x + spr.x0, y + spr.y0, spr.w, spr.h); }

  /* ---- one sun for the whole hill ----
     Low in the upper left, where every highlight in the game already sits.
     Each thing standing on the ice throws its shadow the same way, down
     and to the right, as long as the thing is tall: a pine a long one, a
     boulder a short one. It used to be a round disc under everything, the
     same for a tree as for a stone, which is what made them read as
     stickers laid on the ice rather than things standing on it. Under the
     long shadow a tight, darker one where it meets the ice — the contact
     that says it is heavy and it is there. */
  var SUN_DX = 0.6, SUN_DY = 0.8;
  function castShadow(r, h, col) {
    var L = h, ang = Math.atan2(SUN_DY, SUN_DX), w = r * 0.78;
    ctx.save();
    ctx.translate(SUN_DX * r * 0.2, SUN_DY * r * 0.2);   // starts under its far side, no halo on the lit one
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.bezierCurveTo(L * 0.45, -w, L * 0.8, -w * 0.62, L, -w * 0.34);
    ctx.quadraticCurveTo(L + w * 0.5, 0, L, w * 0.34);
    ctx.bezierCurveTo(L * 0.8, w * 0.62, L * 0.45, w, 0, w);
    ctx.arc(0, 0, w, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5;                            // softer towards its tip
    ctx.beginPath(); ctx.ellipse(L * 0.35, 0, L * 0.55 + w * 0.3, w * 1.15, 0, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(16,40,72,.22)';             // contact
    ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.14, r * 0.84, r * 0.78, 0, 0, 6.2832); ctx.fill();
  }

  function drawRock(x, y, o, B, bare) {
    var r = o.r, k, a, rad;
    var rsh = r * (formOf(o, 4) === 2 ? 0.45 : formOf(o, 4) === 1 ? 1.0 : 0.7);
    if (!bare && drawPictured(o, x, y, B, rockKey, function (P) {
      return spriteOf(-r * 1.6, -r * 1.6, r * 1.6 + rsh * 0.7, r * 1.6 + rsh * 0.9,
                      function (cx, cy) { drawRock(cx, cy, o, P, 'shadow'); });
    })) return;
    ctx.save();
    ctx.translate(x, y);
    if (!bare || bare === 'shadow') castShadow(r, rsh, B.shadow || 'rgba(86,132,176,.26)');
    ctx.rotate(o.rot);

    function outline(scale, noLump) {
      var f = formOf(o, 4);
      var n = o.pts.length, pt = [];
      var squashY = f === 2 ? 0.66 : 0.94;           // the slab lies flat
      var squashX = f === 1 ? 0.82 : 1;              // the shard stands up
      for (k = 0; k < n; k++) {
        a = k / n * 6.2832;
        /* The shard's radii are pushed to extremes so it reads as cleaved
           rather than weathered. */
        var pk = f === 1 ? (o.pts[k] > 1 ? 1.22 : 0.74) : o.pts[k];
        rad = r * scale * pk;
        pt.push([Math.cos(a) * rad * squashX, Math.sin(a) * rad * squashY]);
      }
      ctx.beginPath();
      if (f === 1) {                                 // flat faces, hard corners
        ctx.moveTo(pt[0][0], pt[0][1]);
        for (k = 1; k < n; k++) ctx.lineTo(pt[k][0], pt[k][1]);
      } else {                                       // round the corners off
        ctx.moveTo((pt[n - 1][0] + pt[0][0]) / 2, (pt[n - 1][1] + pt[0][1]) / 2);
        for (k = 0; k < n; k++) {
          var nx = pt[(k + 1) % n];
          ctx.quadraticCurveTo(pt[k][0], pt[k][1],
                               (pt[k][0] + nx[0]) / 2, (pt[k][1] + nx[1]) / 2);
        }
      }
      ctx.closePath();
      if (f === 3 && !noLump) {                      // a second lump beside it
        ctx.moveTo(r * 0.52 * scale, -r * 0.1 * scale);
        ctx.arc(r * 0.22 * scale, r * 0.16 * scale, r * 0.44 * scale, 0, 6.2832);
      }
    }

    /* 0 a rounded boulder, 1 a cleaved shard with flat faces, 2 a low
       slab, 3 a pair leaning together. The outline helper takes the
       per-form squash so the footprint stays the same size. */
    var rform = formOf(o, 4);
    /* the dark outline drawn first and the stone over it, so only its
       outer half shows: stroked last, the pair's second lump drew a whole
       circle across the middle of the stone */
    outline(1, true);
    ctx.strokeStyle = 'rgba(52,72,92,.4)'; ctx.lineWidth = 4; ctx.stroke();
    outline(1);
    ctx.fillStyle = B.rockDark; ctx.fill();

    ctx.save();
    outline(1); ctx.clip();
    /* The stone is turned at random, but sunlight is not: undo the rotation
       so the cap always lies on the upper face instead of drifting round. */
    ctx.rotate(-o.rot);
    ctx.fillStyle = B.rock;                       // lit face
    ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.22, r * 0.92, r * 0.82, -0.35, 0, 6.2832); ctx.fill();
    /* each stone its own: a warmer or a colder grey, and more or less snow
       on it (from its own shape, so it is the same stone every pass) */
    var rtone = (o.pts[2] * 7.7) % 1;
    if (rtone < 0.33 || rtone > 0.66) {
      ctx.fillStyle = rtone < 0.33 ? 'rgba(130,96,60,.13)' : 'rgba(50,80,120,.12)';
      ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
    }
    var capLift = (o.pts[1] - 0.92) * r * 0.9;

    /* The cap follows the curve of the boulder, so it thins out towards the
       sides instead of cutting straight across like a lid. */
    var t, capY = function (u) {
      return r * (-0.04 - 0.46 * u * u + Math.sin(u * 4.1 + o.pts[0] * 9) * 0.08) + capLift;
    };
    ctx.fillStyle = B.cap || '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-r * 1.25, capY(-1.25));
    for (t = -1.25; t <= 1.25; t += 0.16) ctx.lineTo(r * t, capY(t));
    ctx.lineTo(r * 1.25, -r * 1.4);
    ctx.lineTo(-r * 1.25, -r * 1.4);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = B.capShade || 'rgba(163,196,224,.5)';   // under its lower lip
    ctx.beginPath();
    ctx.moveTo(-r * 1.25, capY(-1.25));
    for (t = -1.25; t <= 1.25; t += 0.16) ctx.lineTo(r * t, capY(t));
    for (t = 1.25; t >= -1.25; t -= 0.16) ctx.lineTo(r * t, capY(t) + r * 0.11);
    ctx.closePath(); ctx.fill();

    /* facets: a darker plane turned away from the sun and a lighter one
       facing it, with the crease between them; and a crack */
    ctx.fillStyle = 'rgba(30,40,56,.16)';
    ctx.beginPath(); ctx.moveTo(r * 0.05, r * 0.05); ctx.lineTo(r * 1.2, -r * 0.1); ctx.lineTo(r * 1.2, r * 1.2); ctx.lineTo(-r * 0.3, r * 1.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,56,.22)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(r * 0.05, r * 0.05); ctx.lineTo(r * 1.2, -r * 0.1);
    ctx.moveTo(r * 0.05, r * 0.05); ctx.lineTo(-r * 0.3, r * 1.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,40,56,.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.25); ctx.lineTo(-r * 0.32, r * 0.42); ctx.lineTo(-r * 0.3, r * 0.6); ctx.stroke();
    ctx.restore();

    /* the edges: lit along the upper left, dark along the lower right */
    function edgeLine(dx, dy, col, wdt) {
      ctx.save();
      outline(1); ctx.clip();
      ctx.rotate(-o.rot); ctx.translate(dx, dy); ctx.rotate(o.rot);
      outline(1, true); ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.stroke();
      ctx.restore();
    }
    edgeLine(2.2, 2.2, 'rgba(255,255,255,.45)', 2);
    edgeLine(-2.4, -2.4, 'rgba(20,30,46,.3)', 2.4);
    ctx.restore();
  }

  /* A conifer from directly overhead: rings of needles stepping inward and
     catching more light as they near the tip, with snow settled along the
     upper branches. Nothing sits dead centre — a dot there reads as an eye. */
  /* ---- what grows where it is not pine ----
     Same radius as the pine it stands in for, so a row is exactly as hard
     as it was; only what it looks like changes. */

  /* The frozen jungle: a broad-leaved plant seen from above, its leaves
     fanned out from the middle, each with its vein and a rim of frost. */
  function drawLeafPlant(x, y, o, B) {
    var r = o.r, n = 6 + formOf(o, 3), k;
    ctx.save();
    ctx.translate(x, y);
    castShadow(r, r * 1.0, 'rgba(30,80,70,.24)');
    ctx.rotate(o.rot);
    for (k = 0; k < n; k++) {
      ctx.save();
      ctx.rotate(k / n * 6.2832 + (k % 2) * 0.18);
      var L = r * (k % 2 ? 0.92 : 1.02), Wd = r * 0.34;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Wd, -L * 0.45, 0, -L);
      ctx.quadraticCurveTo(-Wd, -L * 0.45, 0, 0);
      ctx.fillStyle = k % 2 ? B.treeDark : B.tree;
      ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(235,255,250,.75)';   // frost on the rim
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -L * 0.08); ctx.lineTo(0, -L * 0.9);  // the vein
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = B.trunk;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  /* Neon: a palm seen from straight above — long feathered fronds raying
     out of the crown, dark against the violet ice with a line of neon
     along each spine and rim. */
  function drawPalm(x, y, o, B) {
    var r = o.r * 1.12, n = 7 + formOf(o, 3), k, j;
    ctx.save();
    ctx.translate(x, y);
    castShadow(r * 0.8, r * 2.2, 'rgba(10,0,30,.32)');
    ctx.rotate(o.rot);
    for (k = 0; k < n; k++) {
      ctx.save();
      ctx.rotate(k / n * 6.2832 + (k % 2) * 0.22);
      var L = r * (k % 2 ? 0.95 : 1.08), bend = (k % 3 - 1) * 0.18;
      /* the frond: leaflets either side of a curving spine */
      ctx.fillStyle = k % 2 ? B.treeDark : B.tree;
      for (j = 1; j <= 6; j++) {
        var u = j / 7, sx = Math.sin(bend * u * 3) * L * 0.2, sy = -L * u, w = r * 0.44 * (1 - u * 0.55);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + w, sy + L * 0.02, sx + w * 1.1, sy + L * 0.12);
        ctx.quadraticCurveTo(sx + w * 0.4, sy + L * 0.06, sx, sy + L * 0.08);
        ctx.quadraticCurveTo(sx - w * 0.4, sy + L * 0.06, sx - w * 1.1, sy + L * 0.12);
        ctx.quadraticCurveTo(sx - w, sy + L * 0.02, sx, sy);
        ctx.fill();
      }
      ctx.strokeStyle = '#d8fdff'; ctx.lineWidth = 1.6;                 // light down the spine
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.sin(bend * 1.5) * L * 0.2, -L * 0.5, Math.sin(bend * 3) * L * 0.2, -L);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = B.trunk;                                           // the crown
    ctx.beginPath(); ctx.arc(0, 0, r * 0.17, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#ff5fd8'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  }

  /* Neon's sky, seen in the ice: a striped sun going down far ahead, its
     bands cut through, and faint scanlines rolling down the run. Under
     everything on the hill, and only as strong as the stretch is Neon. */
  function drawNeon() {
    var B = pal(), amt = B.neon || 0;
    if (amt <= 0.01 || SPARE) return;
    ctx.save();
    var cx = VIEW_W / 2, cy = VIEW_H * 0.2, R = Math.min(VIEW_W, VIEW_H) * 0.34;
    var sg = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    sg.addColorStop(0, 'rgba(255,230,120,' + (0.42 * amt).toFixed(3) + ')');
    sg.addColorStop(0.55, 'rgba(255,90,170,' + (0.36 * amt).toFixed(3) + ')');
    sg.addColorStop(1, 'rgba(160,40,220,' + (0.18 * amt).toFixed(3) + ')');
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
    ctx.fillStyle = sg;
    /* painted in slices, the gaps between them widening down the lower
       half — the bands are left out, never cut out of what is under it */
    var yy = cy - R;
    for (var b = 0; b < 6; b++) {
      var by = cy + R * (0.08 + b * 0.16), bh = R * (0.025 + b * 0.014);
      ctx.fillRect(cx - R, yy, R * 2, by - yy);
      yy = by + bh;
    }
    ctx.fillRect(cx - R, yy, R * 2, cy + R - yy);
    ctx.restore();
    /* scanlines, rolling slowly down the run */
    ctx.fillStyle = 'rgba(40,232,255,' + (0.06 * amt).toFixed(3) + ')';
    var off = (W.t * 0.6) % 14;
    for (var y = -14 + off; y < VIEW_H; y += 14) ctx.fillRect(0, y, VIEW_W, 2);
    ctx.restore();
  }

  /* Crystal caves and cosmic ice: a cluster of crystals grown up out of
     the ice, faceted, catching the light on one face. */
  function drawCrystalSpire(x, y, o, B) {
    var r = o.r, n = 5 + formOf(o, 3), k;
    ctx.save();
    ctx.translate(x, y);
    castShadow(r, r * 1.9, 'rgba(40,20,70,.24)');
    ctx.rotate(o.rot);
    ctx.lineJoin = 'round';
    for (k = 0; k < n; k++) {
      ctx.save();
      ctx.rotate(k / n * 6.2832 + (k % 2) * 0.35);
      var L = r * (0.72 + 0.3 * ((k * 7) % 4) / 3), Wd = r * 0.24;
      /* lit face, shaded face, and an edge between them */
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Wd, -L * 0.55); ctx.lineTo(0, -L); ctx.closePath();
      ctx.fillStyle = B.tree; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Wd, -L * 0.55); ctx.lineTo(0, -L); ctx.closePath();
      ctx.fillStyle = B.treeDark; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Wd, -L * 0.55); ctx.lineTo(0, -L);
      ctx.lineTo(Wd, -L * 0.55); ctx.closePath();
      ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
      ctx.restore();
    }
    var g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  /* The box a tree's picture needs, for a pine or for what grows instead:
     its reach, and its shadow down and to the right. */
  function plantBox(o, P) {
    var r = o.r, R = r, sh;
    if (P.flora === 'palm') { R = r * 1.21; sh = r * 1.12 * 2.2; }
    else if (P.flora) { R = r * 1.04; sh = r * (P.flora === 'crystal' ? 1.9 : 1.0); }
    else sh = r * (formOf(o, 3) === 1 ? 2.3 : formOf(o, 3) === 2 ? 1.2 : 1.9);
    return [-R * 1.35, -R * 1.35, R * 1.35 + sh * 0.7, R * 1.35 + sh * 0.95];
  }
  function drawTree(x, y, o, B, bare) {
    /* What grows where it is not pine keeps a picture as the pine does
       (bare 'shadow' is that picture being painted). Painted fresh, the
       leaves, palms and crystals were most of a frame on a slow phone: on
       the OPPO A9 2020 the frozen jungle ran at 25 frames a second with
       them and 53 without (row 135). Through a fade the old picture and the
       new crossfade, pine into leaf, where the plant used to swap halfway. */
    if (!bare && drawPictured(o, x, y, B, plantKey, function (P) {
      var m = plantBox(o, P);
      return spriteOf(m[0], m[1], m[2], m[3], function (cx, cy) { drawTree(cx, cy, o, P, 'shadow'); });
    })) return;
    if (B.flora === 'leaf')    return drawLeafPlant(x, y, o, B);
    if (B.flora === 'crystal') return drawCrystalSpire(x, y, o, B);
    if (B.flora === 'palm')    return drawPalm(x, y, o, B);
    var r = o.r, k, a, rad, ri;
    var tsh = r * (formOf(o, 3) === 1 ? 2.3 : formOf(o, 3) === 2 ? 1.2 : 1.9);
    ctx.save();
    ctx.translate(x, y);

    if (!bare || bare === 'shadow') castShadow(r, tsh, 'rgba(66,104,144,.24)');

    ctx.rotate(o.rot);
    /* No two trees alike. Turning one round did nothing you could see —
       a ring of branches looks the same from every side, and the light and
       the snow are fixed to the sun — so each tree draws its own: how many
       branches, how far each one reaches, how big each tier is, which way
       it leans and how far, a darker or a yellower green, and how much
       snow it is carrying. From a seed of its own, so the same tree is
       the same every time you pass it. Its footprint never changes. */
    var seed = o.rot * 7.13 + (o.d || 0) * 0.0173 + (o.x || 0) * 0.031;
    function rs(i) { var v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); }
    var leanA = rs(2) * 6.2832, leanR = r * (0.04 + rs(3) * 0.13);
    var tone = rs(4), snowK = 0.7 + rs(5) * 0.6;
    function lean(ri, n) {                             // how far up the tree this tier is, pushed over
      var f = n > 1 ? ri / (n - 1) : 0;
      return [Math.cos(leanA) * leanR * f, Math.sin(leanA) * leanR * f];
    }
    /* A tier is a ring of fir branches seen end-on from above: each a
       pointed spray with full curved sides, the tips of one tier falling
       between those of the tier under it. */
    var LOBES = 8 + Math.floor(rs(1) * 4);
    function tipOf(k) { return 0.97 + rs(20 + k) * 0.17; }
    function ring(scale, spin, pinch) {
      rad = r * scale;
      var vIn = rad * (0.42 + pinch * 0.42), n = LOBES, span = 6.2832 / n, jag = rad * 0.05;
      /* each side of a spray is ragged with needles: points along the
         curve from the notch to the tip, pushed in and out in turn */
      function side(a0, am, tip, dir) {
        for (var q = 1; q <= 6; q++) {
          var u = q / 6;
          var ang = dir > 0 ? a0 + (am - a0) * Math.pow(u, 0.7) : am + (a0 - am) * (1 - Math.pow(1 - u, 1.4));
          var rr = dir > 0 ? vIn + (tip - vIn) * u : tip + (vIn - tip) * u;
          var bulge = Math.sin(Math.PI * u) * rad * 0.1;
          var out = (q % 2 ? 1 : -0.6) * jag * Math.sin(Math.PI * u);
          ctx.lineTo(Math.cos(ang) * (rr + bulge + out), Math.sin(ang) * (rr + bulge + out));
        }
      }
      ctx.beginPath();
      ctx.moveTo(Math.cos(spin) * vIn, Math.sin(spin) * vIn);
      for (k = 0; k < n; k++) {
        var a0 = spin + k * span, am = a0 + span / 2, a1 = a0 + span;
        var tip = rad * tipOf(k);
        side(a0, am, tip, 1);
        side(a1, am, tip, -1);
      }
      ctx.closePath();
    }
    function needles(scale, spin, col) {               // the rib down each branch
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.7, r * 0.03); ctx.lineCap = 'round';
      ctx.beginPath();
      for (k = 0; k < LOBES; k++) {
        var am = spin + (k + 0.5) / LOBES * 6.2832;
        ctx.moveTo(Math.cos(am) * r * scale * 0.45, Math.sin(am) * r * scale * 0.45);
        ctx.lineTo(Math.cos(am) * r * scale * 0.92, Math.sin(am) * r * scale * 0.92);
      }
      ctx.stroke();
    }
    /* 0 a full spruce, 1 a narrow spire, 2 an old one with the crown
       mostly gone. Same radius in every case, so nothing about the hill
       changes except what it looks like. */
    var form = formOf(o, 3);
    var tiers = form === 1
      ? [[0.86, 0.00, 0.62, B.treeDark],
         [0.62, 0.42, 0.64, B.tree],
         [0.40, 0.84, 0.66, B.tree],
         [0.20, 1.26, 0.68, B.tree]]
      : form === 2
      ? [[1.00, 0.00, 0.88, B.treeDark],
         [0.58, 0.50, 0.90, B.tree]]
      : [[1.00, 0.00, 0.76, B.treeDark],
         [0.76, 0.36, 0.78, B.tree],
         [0.52, 0.72, 0.80, B.tree],
         [0.30, 1.08, 0.82, B.tree]];
    for (ri = 1; ri < tiers.length; ri++)            // the upper tiers each a little bigger or smaller
      tiers[ri] = [tiers[ri][0] * (0.9 + rs(40 + ri) * 0.18), tiers[ri][1] + rs(50 + ri) * 0.6, tiers[ri][2], tiers[ri][3]];
    var NT = tiers.length;
    for (ri = 0; ri < NT; ri++) {
      var lo = lean(ri, NT);
      ctx.save();
      ctx.rotate(-o.rot); ctx.translate(lo[0], lo[1]); ctx.rotate(o.rot);
      if (ri > 0) {                                  // the tier above throws its shadow on this one
        ctx.save();
        ctx.rotate(-o.rot); ctx.translate(r * 0.07, r * 0.1); ctx.rotate(o.rot);
        ring(tiers[ri][0] * 1.04, tiers[ri][1], tiers[ri][2]);
        ctx.fillStyle = 'rgba(6,30,24,.32)'; ctx.fill();
        ctx.restore();
      }
      ring(tiers[ri][0], tiers[ri][1], tiers[ri][2]);
      ctx.fillStyle = tiers[ri][3];
      ctx.fill();
      if (ri > 0) {                                  // each tier steps into the light
        ctx.globalAlpha = 0.10 * ri;
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (tone < 0.34 || tone > 0.66) {              // this one's own green
        ctx.fillStyle = tone < 0.34 ? 'rgba(0,26,16,.16)' : 'rgba(214,236,150,.13)';
        ctx.fill();
      }
      needles(tiers[ri][0], tiers[ri][1], 'rgba(0,30,20,.2)');
      ctx.restore();
    }
    ctx.rotate(-o.rot);                              // light comes from one place

    /* Snow on the branches that face the sun: the outer part of each
       sunward spray, thicker the more squarely it faces the light (and the
       deeper the winter), none on the far side. */
    var load = B.snowyTrees || 0;
    ctx.fillStyle = B.cap || '#ffffff';
    for (ri = 0; ri < tiers.length; ri++) {
      var trad = r * tiers[ri][0], span = 6.2832 / LOBES, lo2 = lean(ri, NT);
      ctx.save(); ctx.translate(lo2[0], lo2[1]);
      for (k = 0; k < LOBES; k++) {
        var am = tiers[ri][1] + o.rot + (k + 0.5) * span;
        /* The snow turns with the tree: asked for, every tree visibly
           turned its own way — fifteen degrees, thirty, ninety — and with
           the snow fixed to the sun no turn could be seen. The shadow on
           the ice still falls away from the sun. */
        var face = Math.cos(am - (-2.3 + o.rot));
        if (face < 0.15) continue;
        var from = 1 - Math.min(0.75, (0.28 + 0.3 * load) * face * snowK);
        var tip = trad * tipOf(k);
        ctx.globalAlpha = Math.min(1, (0.55 + 0.4 * face + 0.3 * load) * (0.8 + 0.2 * snowK));
        ctx.beginPath();
        ctx.moveTo(Math.cos(am - span * 0.3) * trad * from * 0.95, Math.sin(am - span * 0.3) * trad * from * 0.95);
        ctx.quadraticCurveTo(Math.cos(am - span * 0.2) * trad * 0.94, Math.sin(am - span * 0.2) * trad * 0.94,
                             Math.cos(am) * tip * 0.99, Math.sin(am) * tip * 0.99);
        ctx.quadraticCurveTo(Math.cos(am + span * 0.12) * trad * 0.9, Math.sin(am + span * 0.12) * trad * 0.9,
                             Math.cos(am + span * 0.16) * trad * from, Math.sin(am + span * 0.16) * trad * from);
        ctx.quadraticCurveTo(Math.cos(am - span * 0.05) * trad * (from + 0.06), Math.sin(am - span * 0.05) * trad * (from + 0.06),
                             Math.cos(am - span * 0.3) * trad * from * 0.95, Math.sin(am - span * 0.3) * trad * from * 0.95);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (load > 0.02) {                               // and a cap right on the crown
      var top = lean(NT - 1, NT);
      ctx.globalAlpha = 0.6 * load;
      ctx.fillStyle = B.cap || '#ffffff';
      ctx.beginPath();
      ctx.ellipse(top[0] - r * 0.04, top[1] - r * 0.08, r * 0.3, r * 0.26, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* A split clean through the ice. Drawn as a hole rather than a stripe:
     the walls catch the light, the depth does not. */
  function drawCrevasse(y, o, B) {
    var top = scrY(o.d + o.span), bot = y;
    var cTop = chuteAt(o.d + o.span) - chuteHere();
    var cBot = chuteAt(o.d) - chuteHere();
    var lTop = VIEW_W / 2 + cTop - CHUTE - 30, rTop = VIEW_W / 2 + cTop + CHUTE + 30;
    var lBot = VIEW_W / 2 + cBot - CHUTE - 30, rBot = VIEW_W / 2 + cBot + CHUTE + 30;

    function edge(yy, xa, xb, amp, phase) {          // a broken, icy lip
      var n = 16, i;
      for (i = 0; i <= n; i++) {
        var t = i / n, xx = xa + (xb - xa) * t;
        ctx.lineTo(xx, yy + Math.sin(t * 9 + phase) * amp + Math.sin(t * 23) * amp * 0.4);
      }
    }
    ctx.beginPath();
    ctx.moveTo(lTop, top);
    edge(top, lTop, rTop, 7, 0.6);
    ctx.lineTo(rBot, bot);
    for (var i = 16; i >= 0; i--) {
      var t = i / 16, xx = lBot + (rBot - lBot) * t;
      ctx.lineTo(xx, bot + Math.sin(t * 9 + 2.3) * 7 + Math.sin(t * 23) * 2.8);
    }
    ctx.closePath();
    var g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, '#12354f'); g.addColorStop(0.45, '#06131f'); g.addColorStop(1, '#0d2841');
    ctx.fillStyle = g; ctx.fill();

    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(120,200,240,.3)';          // ice walls, lit near the lip
    ctx.beginPath(); ctx.rect(0, top, VIEW_W, 16); ctx.fill();
    ctx.fillStyle = 'rgba(90,170,215,.2)';
    ctx.beginPath(); ctx.rect(0, bot - 13, VIEW_W, 13); ctx.fill();

    /* Layers in the wall: a glacier is laid down season by season and the
       cut through it shows the years. */
    ctx.fillStyle = 'rgba(150,215,250,.07)';
    for (var ly = 1; ly < 5; ly++)
      ctx.fillRect(0, top + (bot - top) * ly / 6, VIEW_W, 3);

    /* Meltwater at the bottom of it, moving. The hole used to be an empty
       dark band — there was nothing down there to be afraid of. */
    var wTop = top + (bot - top) * 0.46;
    var wg = ctx.createLinearGradient(0, wTop, 0, bot);
    wg.addColorStop(0, 'rgba(6,26,48,.75)');
    wg.addColorStop(1, 'rgba(14,52,86,.9)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, wTop, VIEW_W, bot - wTop);

    var ph = W.t * 0.035 + (o.d % 211) * 0.03;
    ctx.strokeStyle = 'rgba(150,205,240,.4)'; ctx.lineWidth = 1.6;
    for (var wv = 0; wv < 4; wv++) {                 // swell running across it
      var wy = wTop + 6 + wv * (bot - wTop - 10) / 4;
      var amp = 2.4 + wv * 0.7, len = 52 + wv * 17;
      ctx.globalAlpha = 0.5 - wv * 0.07;
      ctx.beginPath();
      for (var wx = -20; wx <= VIEW_W + 20; wx += 12)
        ctx.lineTo(wx, wy + Math.sin(wx / len + ph + wv) * amp);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(214,242,255,.7)';          // glints off the swell
    for (var gl = 0; gl < 7; gl++) {
      var gx = ((gl * 137 + W.t * 0.5 + o.d) % (VIEW_W + 60)) - 30;
      var gy = wTop + 10 + ((gl * 53) % Math.max(10, bot - wTop - 16));
      ctx.fillRect(gx, gy + Math.sin(gx / 60 + ph) * 2, 5 + (gl % 3) * 3, 1.6);
    }

    [0, 1, 2].forEach(function (fl) {                // floes turning on the water
      var fx = ((fl * 331 + W.t * 0.22 + o.d * 2) % (VIEW_W + 120)) - 60;
      var fy = wTop + 12 + ((fl * 71) % Math.max(8, bot - wTop - 22));
      var fr2 = 9 + (fl % 3) * 5;
      ctx.save();
      ctx.translate(fx, fy + Math.sin(fx / 70 + ph) * 2.5);
      ctx.rotate(Math.sin(W.t * 0.01 + fl) * 0.3);
      ctx.fillStyle = 'rgba(206,234,250,.85)';
      ctx.beginPath();
      ctx.moveTo(-fr2, 2); ctx.lineTo(-fr2 * 0.4, -3.5); ctx.lineTo(fr2 * 0.5, -2.6);
      ctx.lineTo(fr2, 2.4); ctx.lineTo(0, 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(70,120,160,.35)';
      ctx.fillRect(-fr2, 2.6, fr2 * 2, 1.6);
      ctx.restore();
    });

    var mist = ctx.createLinearGradient(0, wTop - 26, 0, wTop + 6);
    mist.addColorStop(0, 'rgba(226,244,255,0)');     // breath coming off the water
    mist.addColorStop(1, 'rgba(216,238,252,.22)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, wTop - 26, VIEW_W, 32);
    ctx.restore();

    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;  // the broken rim
    ctx.beginPath(); ctx.moveTo(lTop, top); edge(top, lTop, rTop, 7, 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lBot, bot); edge(bot, lBot, rBot, 7, 2.3); ctx.stroke();
  }

  /* The way across: packed snow heaped into a ramp, sitting exactly in the
     row's opening so it is aimed at the same way as every other gap. */
  /* A block of the hill's own ice, shoved up into a ramp. Ice is not a
     smooth moulding: it cleaves into flat planes, it traps bubbles, and it
     is darkest where it is thickest. A single soft gradient with a big
     white highlight over it is exactly what makes a thing look like
     plastic, so there is none of that here.

     The colours are fixed rather than taken from the biome — the rocky
     pass has a sandy snow palette and a sand-coloured ramp read as a dune
     — with only a whisper of the local light washed over the top. */
  /* Three kinds of ramp, after the owner's pictures (12 Nov 2026), one
     for each ramp by where it stands:
       - a swell: a great smooth drift of snow heaped against the lip,
         rounded, lit on the sun's side, blue in its own shade, fading
         into the run at its foot;
       - a kicker: weathered planks of pale wood laid up the slope, ragged
         at the foot where they splay, a beam across the top, snow dusted
         on them;
       - a slab: a dark deck of old boards laid across, worn and gapped,
         with snow lying in the gaps and a beam down each side.
     The planks are the second thing on the hill that somebody built, by
     the owner's choice (GAME_SPEC.md, non-goals). All three are lifted on
     dark stretches if they need it, so a ramp can never be missed.
     Painted once into a picture. */
  var RAMP_KINDS = ['swell', 'kicker', 'slab'];
  function rampKind(o) {
    return o.kind || RAMP_KINDS[Math.floor(hh(Math.round(o.d || 0) + Math.round(o.x || 0) * 3, 17) * 3) % 3];
  }
  function rampKey(P) { return 'ramp' + P.iceTop + P.iceBot + P.snowA + (P.fog || 0) + '|' + drawK; }
  function rgbaMix(a, b, t, al) {             // a mix of two hex colours, as rgba
    var A = rgbOf(a), C = rgbOf(b);
    return 'rgba(' + Math.round(A[0] + (C[0] - A[0]) * t) + ',' + Math.round(A[1] + (C[1] - A[1]) * t) + ',' +
           Math.round(A[2] + (C[2] - A[2]) * t) + ',' + al.toFixed(3) + ')';
  }
  function drawRamp(x, y, o, B, bare) {
    var hw = o.w / 2, h = 48;
    var TOP = -h * 0.62, BOT = h * 0.5;
    if (!bare && HILL && drawPictured(o, x, y, B, rampKey, function (P) {
      return spriteOf(-hw * 1.7 - 12, TOP - 22, hw * 1.7 + 28, BOT + 44,
                      function (cx, cy) { drawRamp(cx, cy, o, P, true); });
    })) return;
    var kind = rampKind(o);
    var seed = Math.round(o.w * 7.3 + (o.d || 0) * 0.13);
    var u = clamp(hw / 50, 0.3, 1);                  // the small things are sized to the ramp: the icon's is tiny
    var iceL = (lumOf(B.iceTop) + lumOf(B.iceBot)) * 0.5 - (B.fog || 0) * 60;
    var lift = clamp((205 - iceL) / 120, 0, 1) * 0.78;
    function tone(c, to) { return mixHex(c, to || '#eaf7ff', lift); }
    function lipY(t) {                               // the lip, a shallow curve, t 0..1 across
      var q = 1 - t; return q * q * TOP + 2 * q * t * (TOP - h * 0.22) + t * t * TOP;
    }
    function lipX(t) { return -hw * 0.72 + t * hw * 1.44; }

    ctx.save();
    ctx.translate(x, y);

    /* ---- the ice round it, shared by all three ---- */
    /* its shadow, thrown to the right by the sun on the upper left: none
       at the foot, where it has no height, longest beside the lip */
    for (var sh = 0; sh < 3; sh++) {
      var sg = 3 + sh * 4;
      ctx.fillStyle = 'rgba(40,78,116,' + (0.13 - sh * 0.035).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(hw * 1.0, BOT + 2);
      ctx.lineTo(hw * 0.7, TOP);
      ctx.lineTo(hw * 0.72 + (12 + sg) * u, TOP + 6 * u);
      ctx.quadraticCurveTo(hw * 1.0 + (10 + sg) * u, (TOP + BOT) / 2, hw * 1.06 + sg * 0.3, BOT + 2);
      ctx.closePath(); ctx.fill();
    }
    var k;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    function snowLump(cx, cy, rx, ry, sd) {          // a little heap of snow, lit on top, blue beneath
      ctx.fillStyle = 'rgba(80,120,160,.35)';
      ctx.beginPath(); ctx.ellipse(cx + rx * 0.15, cy + ry * 0.4, rx, ry, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#f6fafd';
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, (hh(sd, 1) - 0.5) * 0.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(cx - rx * 0.2, cy - ry * 0.3, rx * 0.55, ry * 0.45, 0, 0, 6.2832); ctx.fill();
    }

    if (kind === 'swell') {
      /* ---- a great smooth drift of snow ---- */
      var body = function () {
        ctx.beginPath();
        ctx.moveTo(-hw * 1.28, BOT + 12);
        ctx.bezierCurveTo(-hw * 1.25, BOT - 14, -hw * 0.95, TOP + 2, lipX(0.05), lipY(0.05) - 1);
        ctx.quadraticCurveTo(0, TOP - h * 0.3, lipX(0.95), lipY(0.95) - 1);
        ctx.bezierCurveTo(hw * 0.95, TOP + 2, hw * 1.25, BOT - 14, hw * 1.28, BOT + 12);
        ctx.quadraticCurveTo(0, BOT + 22, -hw * 1.28, BOT + 12);
        ctx.closePath();
      };
      var g = ctx.createRadialGradient(-hw * 0.35, TOP + (BOT - TOP) * 0.25, 2, 0, (TOP + BOT) / 2, hw * 1.35);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#f2f7fb'); g.addColorStop(0.8, '#d4e4ef'); g.addColorStop(1, '#b9d0e1');
      ctx.fillStyle = g; body(); ctx.fill();
      ctx.save(); body(); ctx.clip();
      var sd2 = ctx.createLinearGradient(-hw * 1.3, 0, hw * 1.3, 0);        // the side away from the sun
      sd2.addColorStop(0, 'rgba(255,255,255,0)'); sd2.addColorStop(0.6, 'rgba(120,160,196,0)'); sd2.addColorStop(1, 'rgba(110,150,190,.4)');
      ctx.fillStyle = sd2; ctx.fillRect(-hw * 1.4, TOP - 20, hw * 2.8, BOT - TOP + 50);
      /* its foot fading into the run: in its own picture the snow itself
         is rubbed out towards the foot; drawn straight onto the hill (an
         icon, or a frame short of pictures) the run's colour is laid over */
      var ft = ctx.createLinearGradient(0, BOT + 22, 0, BOT - 14);
      if (bare) {
        ft.addColorStop(0, 'rgba(0,0,0,1)'); ft.addColorStop(0.3, 'rgba(0,0,0,.85)'); ft.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = ft; ctx.fillRect(-hw * 1.4, BOT - 14, hw * 2.8, 38);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ft.addColorStop(0, rgbaMix(B.iceBot, '#ffffff', 0.15, 1)); ft.addColorStop(1, rgbaMix(B.iceBot, '#ffffff', 0.15, 0));
        ctx.fillStyle = ft; ctx.fillRect(-hw * 1.4, BOT - 14, hw * 2.8, 38);
      }
      for (k = 0; k < 6; k++) {                     // soft wind lines across its back
        var wy = lerp(BOT - 8, TOP + 10, hh(seed, k + 600)), ww = hw * (0.25 + 0.3 * hh(seed, k + 610)), wx = (hh(seed, k + 620) - 0.5) * hw;
        ctx.strokeStyle = 'rgba(140,175,205,.3)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(wx - ww, wy + 1); ctx.quadraticCurveTo(wx, wy - 4, wx + ww, wy + 1); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(wx - ww, wy); ctx.quadraticCurveTo(wx, wy - 5, wx + ww, wy); ctx.stroke();
      }
      ctx.restore();
      /* the crest at the lip, crisp, with the drop behind it */
      ctx.strokeStyle = 'rgba(70,110,150,.45)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(lipX(0.05), lipY(0.05) - 3); ctx.quadraticCurveTo(0, TOP - h * 0.3 - 3, lipX(0.95), lipY(0.95) - 3); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lipX(0.05), lipY(0.05) - 0.5); ctx.quadraticCurveTo(0, TOP - h * 0.3 - 0.5, lipX(0.95), lipY(0.95) - 0.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)';      // snow grains blown off it
      for (k = 0; k < 12; k++) {
        ctx.beginPath();
        ctx.arc((hh(seed, k + 640) - 0.5) * hw * 2.8, BOT + 10 + hh(seed, k + 650) * 14 * u, (0.8 + hh(seed, k + 660) * 1.4) * u, 0, 6.2832);
        ctx.fill();
      }
    } else if (kind === 'kicker') {
      /* ---- weathered planks of pale wood, laid up the slope ---- */
      var NP = Math.max(4, Math.round(hw / 9)), WOOD = ['#d4ad7c', '#c69c69', '#b98c5a', '#cfa676', '#c09460'];
      ctx.fillStyle = 'rgba(60,40,24,.55)';          // the dark under them, seen between
      polyPath(ctx, [[-hw * 1.02, BOT + 4], [lipX(0) - 2, TOP + 2], [lipX(1) + 2, TOP + 2], [hw * 1.02, BOT + 4]]); ctx.fill();
      for (k = 0; k < NP; k++) {
        var t0 = k / NP, t1 = (k + 1) / NP, gap = 0.012;
        var splay = (t0 + t1 - 1) * 0.14 * hw;     // they splay out at the foot
        var foot = BOT + (hh(seed, k + 700) - 0.3) * 12 * u, len = 0.86 + 0.14 * hh(seed, k + 710);
        var bx0 = lerp(-hw, hw, t0 + gap) + splay, bx1 = lerp(-hw, hw, t1 - gap) + splay;
        var tx0 = lipX(t0 + gap), tx1 = lipX(t1 - gap), ty0 = lipY(t0 + gap), ty1 = lipY(t1 - gap);
        var fy0 = lerp(ty0, foot, len), fy1 = lerp(ty1, foot + (hh(seed, k + 720) - 0.5) * 6 * u, len);
        var wc = WOOD[k % WOOD.length];
        var pg = ctx.createLinearGradient(0, TOP, 0, BOT);
        pg.addColorStop(0, mixHex(wc, '#ffffff', 0.18)); pg.addColorStop(1, mixHex(wc, '#6b4a2c', 0.2));
        ctx.fillStyle = pg;
        polyPath(ctx, [[bx0, fy0], [tx0, ty0], [tx1, ty1], [bx1, fy1]]); ctx.fill();
        ctx.strokeStyle = 'rgba(70,44,22,.5)'; ctx.lineWidth = 0.9; ctx.stroke();
        ctx.strokeStyle = 'rgba(110,72,40,.35)'; ctx.lineWidth = 0.7;  // its grain
        for (var gq = 1; gq <= 2; gq++) {
          var gt = gq / 3 + (hh(seed + gq, k + 730) - 0.5) * 0.12;
          ctx.beginPath(); ctx.moveTo(lerp(bx0, bx1, gt), lerp(fy0, fy1, gt));
          ctx.quadraticCurveTo(lerp(lerp(bx0, bx1, gt), lerp(tx0, tx1, gt), 0.5) + (hh(seed, k + gq + 740) - 0.5) * 3, (TOP + BOT) / 2, lerp(tx0, tx1, gt), lerp(ty0, ty1, gt));
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,240,215,.45)'; ctx.lineWidth = 0.8;   // its lit edge
        ctx.beginPath(); ctx.moveTo(bx0 + 0.6, fy0); ctx.lineTo(tx0 + 0.6, ty0); ctx.stroke();
        if (hh(seed, k + 750) < 0.3) {              // a split end
          ctx.strokeStyle = 'rgba(60,38,18,.6)'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(lerp(bx0, bx1, 0.5), lerp(fy0, fy1, 0.5)); ctx.lineTo(lerp(bx0, bx1, 0.45), lerp(fy0, fy1, 0.5) - 8 * u); ctx.stroke();
        }
      }
      /* the beam across the top, and snow dusted on the boards */
      ctx.fillStyle = '#8c6440';
      ctx.beginPath(); ctx.moveTo(lipX(0) - 3, lipY(0) + 3); ctx.quadraticCurveTo(0, TOP - h * 0.22 + 3, lipX(1) + 3, lipY(1) + 3);
      ctx.lineTo(lipX(1) + 3, lipY(1) - 3); ctx.quadraticCurveTo(0, TOP - h * 0.22 - 3, lipX(0) - 3, lipY(0) - 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,200,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lipX(0) - 3, lipY(0) - 2.5); ctx.quadraticCurveTo(0, TOP - h * 0.22 - 2.5, lipX(1) + 3, lipY(1) - 2.5); ctx.stroke();
      ctx.fillStyle = 'rgba(250,253,255,.8)';
      for (k = 0; k < 7; k++) {
        var st = hh(seed, k + 760), sv = 0.15 + 0.7 * hh(seed, k + 770);
        ctx.beginPath(); ctx.ellipse(lerp(lerp(-hw, hw, st), lipX(st), sv), lerp(BOT, TOP, sv), (4 + hh(seed, k + 780) * 7) * u, (1.6 + hh(seed, k + 790) * 2) * u, 0, 0, 6.2832); ctx.fill();
      }
      snowLump(-hw * 1.05, BOT + 6, 9 * u, 4 * u, seed + 1); snowLump(hw * 1.08, BOT + 4, 8 * u, 3.6 * u, seed + 2);
    } else {
      /* ---- a dark deck of old boards, laid across ---- */
      var RISE = 10 * u, NB = Math.max(5, Math.round((BOT - TOP) / 7));
      /* the beams down each side, standing on the ice */
      var beam = function (side) {
        var x0 = side * hw * 1.02, x1 = side * hw * 0.74;
        ctx.fillStyle = '#3a2e25';
        polyPath(ctx, [[x0, BOT + 3], [x1, TOP + 2], [x1 + side * 5 * u, TOP + RISE], [x0 + side * 6 * u, BOT + 5]]); ctx.fill();
      };
      beam(-1); beam(1);
      ctx.fillStyle = '#231b15';                    // the dark between the boards
      polyPath(ctx, [[-hw, BOT + 2], [lipX(0), TOP], [lipX(1), TOP], [hw, BOT + 2]]); ctx.fill();
      for (k = 0; k < NB; k++) {
        var v0 = k / NB, v1 = (k + 1) / NB - 0.022;
        var yA = lerp(BOT, TOP, v0), yB = lerp(BOT, TOP, v1);
        var xA = lerp(hw, hw * 0.72, v0) + (hh(seed, k + 800) - 0.5) * 4 * u, xB = lerp(hw, hw * 0.72, v1) + (hh(seed, k + 810) - 0.5) * 4 * u;
        var xa = -lerp(hw, hw * 0.72, v0) - (hh(seed, k + 820) - 0.5) * 4 * u, xb = -lerp(hw, hw * 0.72, v1) - (hh(seed, k + 830) - 0.5) * 4 * u;
        var bc = ['#5d4c3f', '#544336', '#62513f', '#4d3e33'][k % 4];
        var bg = ctx.createLinearGradient(-hw, 0, hw, 0);
        bg.addColorStop(0, mixHex(bc, '#ffffff', 0.12 + lift * 0.3)); bg.addColorStop(1, mixHex(bc, '#1c140f', 0.25 - lift * 0.15));
        ctx.fillStyle = bg;
        polyPath(ctx, [[xa, yA], [xb, yB], [xB, yB], [xA, yA]]); ctx.fill();
        ctx.strokeStyle = 'rgba(200,180,160,.25)'; ctx.lineWidth = 0.9;   // its worn top edge, and grain along it
        ctx.beginPath(); ctx.moveTo(xb, yB + 0.5); ctx.lineTo(xB, yB + 0.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(20,14,10,.35)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(lerp(xa, xb, 0.5) + 6, (yA + yB) / 2 + (hh(seed, k + 840) - 0.5));
        ctx.lineTo(lerp(xA, xB, 0.5) - 6, (yA + yB) / 2 + (hh(seed, k + 850) - 0.5)); ctx.stroke();
        ctx.fillStyle = 'rgba(30,22,16,.7)';        // the nails at its ends
        ctx.beginPath(); ctx.arc(xa + 4 * u, (yA + yB) / 2, 0.9 * u, 0, 6.2832); ctx.arc(xA - 4 * u, (yA + yB) / 2, 0.9 * u, 0, 6.2832); ctx.fill();
        if (hh(seed, k + 860) < 0.55) {              // snow lying in the gap above it
          ctx.fillStyle = 'rgba(245,250,253,.85)';
          var sx0 = lerp(xb, xB, hh(seed, k + 870) * 0.6), sl = (xB - xb) * (0.15 + 0.3 * hh(seed, k + 880));
          ctx.beginPath(); ctx.ellipse(sx0 + sl / 2, yB - 0.3, sl / 2, 1.6 * u, 0, 0, 6.2832); ctx.fill();
        }
      }
      /* the lip: the last board's edge, and snow along it */
      ctx.strokeStyle = 'rgba(15,10,8,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lipX(0), TOP); ctx.lineTo(lipX(1), TOP); ctx.stroke();
      ctx.fillStyle = '#f2f7fb';
      ctx.beginPath(); ctx.moveTo(lipX(0) - 2, TOP);
      for (k = 0; k <= 10; k++) ctx.lineTo(lipX(k / 10), TOP - (1.5 + hh(seed, k + 890) * 2.5) * u);
      ctx.lineTo(lipX(1) + 2, TOP); ctx.closePath(); ctx.fill();
      snowLump(-hw * 1.08, BOT + 6, 10 * u, 4.5 * u, seed + 3); snowLump(hw * 1.1, BOT + 4, 7 * u, 3.4 * u, seed + 4);
      snowLump(-hw * 0.86, TOP + 8, 6 * u, 3 * u, seed + 5);
    }
    ctx.restore();
  }

  /* The gate: an arc of leaping fish (owner's choice, 12 Nov 2026). Two
     holes in the ice, one each side of the opening, and fish leaping from
     the one into the other one after another, over the opening, so the
     animal slides under a bow of fish. It was an arch of ice crystals, and
     before that a tongue of blue ice, and before that posts with pennants.
     Kept as type 'gate' in the code because that is what it is to the
     rules: a thing you steer through for a bonus. The holes stand where
     the arch's feet stood, as wide as ever, so where it pays has not moved.
     Drawn in two parts: the holes, the light in the opening and the fishes'
     shadows on the ice under everything; the fish after the creature,
     because they are over him. Taken, the fish turn gold and sparks fall;
     passed by, the shoal has gone down and only the holes are left.
     `part` is 'back', 'front', or nothing for the whole thing (icons). */
  function arcFish(gold, ph, sc) {               // one fish, nose along +y turned up, at scale sc
    var pic = (HILL && ctx.canvas === canvas) ? fishPic(gold, ph) : null;
    ctx.save(); ctx.scale(sc, sc);
    if (pic) blit(pic, 0, 0);
    else { ctx.rotate(Math.PI / 2); realFish(ctx, gold ? 24 : 18, gold ? 7.8 : 6.1, ph, gold, 0.6); }
    ctx.restore();
  }
  function drawGate(x, y, o, part) {
    /* The gate scores on his centre, so his body passes as far again to
       either side: the holes sit that much wider than the scoring zone,
       and the arc stands tall enough to clear him. The light on the ice
       still shows the zone itself. */
    var zone = o.w / 2, hw = zone + PR * 0.95;
    /* the holes may have been drawn in off the bank or out of a boulder
       (tidyLaid): the arc then spans them, a little off centre */
    var hL = o.hl || hw, hR = o.hr || hw, mid = (hR - hL) / 2;
    hw = (hL + hR) / 2;
    var H = hw * 0.85;
    var ice = part !== 'front', arch = part !== 'back';   // null or undefined: all of it
    var lit = o.scored, gone = o.passed && !o.scored;
    var hr = clamp(hw * 0.17, 4, 12), N = 5, spd = 0.016, seedG = (o.d || 0) % 97;
    ctx.save();
    ctx.translate(x + mid, y);
    if (gone) ctx.globalAlpha = 0.7;

    if (ice) {
      /* the light held in the opening: the part you aim for */
      var glow = ctx.createRadialGradient(-mid, 0, 2, -mid, 0, zone);
      glow.addColorStop(0, lit ? 'rgba(255,224,120,.5)' : gone ? 'rgba(200,210,220,.1)' : 'rgba(170,232,255,.4)');
      glow.addColorStop(1, 'rgba(170,232,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(-mid, 0, zone, 14, 0, 0, 6.2832); ctx.fill();
      /* the holes: open water in a rim of broken ice, rings spreading on it */
      [-1, 1].forEach(function (k) {
        var hx = k * hw;
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.beginPath();
        for (var q = 0; q < 10; q++) {
          var qa = q / 10 * 6.2832, qr = hr * (1.35 + 0.18 * hh(seedG + k, q));
          ctx.lineTo(hx + Math.cos(qa) * qr, 2 + Math.sin(qa) * qr * 0.62);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(70,120,160,.35)'; ctx.lineWidth = 1.1; ctx.stroke();
        var wg = ctx.createRadialGradient(hx, 2, 1, hx, 2, hr);
        wg.addColorStop(0, '#062a44'); wg.addColorStop(0.7, '#0f557e'); wg.addColorStop(1, '#3a9cc4');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.ellipse(hx, 2, hr, hr * 0.6, 0, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(210,244,255,.6)'; ctx.lineWidth = 0.9;       // rings where they go in and out
        var rp = (W.t * spd * N) % 1;
        ctx.globalAlpha *= (1 - rp);
        ctx.beginPath(); ctx.ellipse(hx, 2, hr * (0.3 + 0.65 * rp), hr * 0.6 * (0.3 + 0.65 * rp), 0, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = gone ? 0.7 : 1;
      });
      /* the fishes' shadows, running across the ice under the arc */
      if (!gone) {
        ctx.fillStyle = 'rgba(30,70,110,.12)';
        for (var j = 0; j < N; j++) {
          var su = (W.t * spd + j / N) % 1;
          if (su < 0.06 || su > 0.94) continue;
          var sh2 = Math.sin(Math.PI * su);
          ctx.beginPath(); ctx.ellipse(lerp(-hw, hw, su) + 6 + sh2 * 8, 5, 7 * (1 - 0.3 * sh2), 2.6, 0, 0, 6.2832); ctx.fill();
        }
      }
    }

    if (arch && !gone) {
      /* the bow they leap along: a faint ribbon of spray, so the arc reads
         as one thing even between the fish */
      ctx.lineCap = 'round';
      ctx.strokeStyle = lit ? 'rgba(255,236,170,.4)' : 'rgba(235,250,255,.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 2, hw, H, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
      /* the fish, each leaping out of the one hole and into the other, a
         few drops flung off behind it */
      for (j = 0; j < N; j++) {
        var u = (W.t * spd + j / N) % 1, a = Math.PI + u * Math.PI;
        var fx = Math.cos(a) * hw, fy = 2 + Math.sin(a) * H;
        var th = Math.atan2(Math.cos(a) * H, -Math.sin(a) * hw);         // along the arc, the way it is going
        var vis = Math.min(1, u / 0.07, (1 - u) / 0.07);                  // out of the water and back in
        if (vis <= 0) continue;
        ctx.fillStyle = lit ? 'rgba(255,240,180,.8)' : 'rgba(240,250,255,.8)';
        for (var dq = 1; dq <= 2; dq++) {
          var ua = Math.PI + Math.max(0, u - dq * 0.035) * Math.PI;
          ctx.beginPath(); ctx.arc(Math.cos(ua) * hw, 2 + Math.sin(ua) * H, 1.6 / dq + 0.6, 0, 6.2832); ctx.fill();
        }
        ctx.save();
        ctx.globalAlpha *= vis;
        ctx.translate(fx, fy); ctx.rotate(th + Math.PI / 2);
        arcFish(!!lit, W.t * 0.24 + j * 1.3 + seedG, (lit ? 0.5 : 0.62) * clamp(hw / 60, 0.35, 1));   // smaller on a small arc (the icon)
        ctx.restore();
      }
      /* splashes where they leave and where they land */
      [-1, 1].forEach(function (k) {
        var sp = ((W.t * spd * N) + (k > 0 ? 0.93 : 0.07) * N) % 1;
        if (sp > 0.35) return;
        ctx.fillStyle = 'rgba(240,250,255,' + (0.9 * (1 - sp / 0.35)).toFixed(3) + ')';
        for (var q = 0; q < 5; q++) {
          var qa = Math.PI * (1.1 + 0.8 * q / 4), qd = hr * (0.4 + sp * 2.2);
          ctx.beginPath(); ctx.arc(k * hw + Math.cos(qa) * qd, 2 + Math.sin(qa) * qd * 0.9 - sp * 6, 1.4, 0, 6.2832); ctx.fill();
        }
      });
      /* taken: sparks falling off the arc onto him */
      if (lit && o.passT !== undefined && W.t - o.passT < 30) {
        var age = (W.t - o.passT) / 30;
        ctx.fillStyle = 'rgba(255,236,160,' + (1 - age).toFixed(3) + ')';
        for (j = 0; j < 12; j++) {
          var a2 = Math.PI + (j + 0.5) / 12 * Math.PI;
          ctx.beginPath(); ctx.arc(Math.cos(a2) * hw, 2 + Math.sin(a2) * H + age * 34 * (0.6 + (j % 3) * 0.25), 2.6 * (1 - age * 0.5), 0, 6.2832); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  /* The arches, drawn after the creature: they stand over him. */
  function drawGateFronts() {
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (o.t !== 'gate') continue;
      var y = scrY(o.d);
      if (y < -80 || y > VIEW_H + 60) continue;
      drawGate(scrX(o.x), y, o, 'front');
    }
  }

  /* Time, in Time Rush: a bubble of green-gold light with what it gives
     written in it. No clock face — nothing on this hill is made — just
     the seconds, and a glint running round the rim like a sweep hand. */
  function drawClock(x, y, o) {
    var r = o.r, bob = Math.sin(W.t * 0.08 + o.ph) * 2.5;
    ctx.save();
    ctx.translate(x, y + bob);
    var halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.7);
    halo.addColorStop(0, 'rgba(200,255,150,.45)'); halo.addColorStop(1, 'rgba(200,255,150,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, 6.2832); ctx.fill();
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#e2ffc0'); g.addColorStop(1, '#7fd65a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#2f7d32';
    ctx.stroke();
    /* the sweep: a bright arc going round */
    var a0 = W.t * 0.09 + o.ph;
    ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.arc(0, 0, r - 4, a0, a0 + 1.3); ctx.stroke();
    ctx.font = '800 ' + Math.round(r * 0.95) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.2; ctx.strokeStyle = '#ffffff';
    var gainTxt = '+' + Math.round(clockGain() / 60);
    ctx.strokeText(gainTxt, 0, 1);
    ctx.fillStyle = '#1f6a24';
    ctx.fillText(gainTxt, 0, 1);
    ctx.restore();
  }

  /* A fish, not a fish-shaped lozenge. The body flexes in an S that runs
     from the nose back to the tail, the tail follows a beat behind it, and
     the fins trail. A golden one is the same fish with everything turned
     up: longer fins, a brighter flank, and sparks coming off it. */
  function drawFish(x, y, o, gold) {
    var ph = W.t * 0.24 + o.ph;
    var bend = Math.sin(ph - 0.8) * 0.3;             // the body trails the tail
    var L = gold ? 25 : 18;
    var by = y + Math.sin(W.t * 0.07 + o.ph) * 3;

    var halo = gold ? 0.3 + 0.16 * Math.sin(W.t * 0.13 + o.ph) : 0.22;
    ctx.fillStyle = gold ? 'rgba(255,205,60,' + halo.toFixed(2) + ')'
                         : 'rgba(150,215,255,.22)';
    ctx.beginPath(); ctx.arc(x, by, L * 1.35, 0, 6.2832); ctx.fill();

    /* The fish itself is the same at the same point of its stroke, so on
       the hill it comes from one of FISH_FRAMES pictures of the stroke:
       one picture, not a dozen shapes and two fresh gradients, a fish a
       frame. Anywhere else (the icons) it is painted as it always was. */
    var pic = ctx.canvas === canvas ? fishPic(gold, ph) : null;
    if (pic) { blit(pic, x, by); if (!gold) return; }
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(Math.PI / 2 + bend * 0.3);
    if (!pic) fishBody(gold, ph);

    if (gold) {                                      // sparks coming off it
      ctx.fillStyle = 'rgba(255,248,200,.9)';
      for (var sp = 0; sp < 3; sp++) {
        var sa = W.t * 0.06 + o.ph + sp * 2.1;
        var sr = L * (1.1 + 0.16 * Math.sin(W.t * 0.11 + sp));
        var ss = 1.4 + 1.1 * Math.abs(Math.sin(W.t * 0.09 + sp * 1.7));
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr * 0.62, ss, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  var FISH_FRAMES = 24, fishPics = { k: 0, n: [], g: [] };
  function fishPic(gold, ph) {
    if (fishPics.k !== drawK) fishPics = { k: drawK, n: [], g: [] };
    var set = gold ? fishPics.g : fishPics.n;
    var f = Math.round((ph % 6.2832 + 6.2832) % 6.2832 / 6.2832 * FISH_FRAMES) % FISH_FRAMES;
    if (set[f] === undefined) {
      var fph = f / FISH_FRAMES * 6.2832;
      set[f] = spriteOf(-38, -38, 38, 38, function (ox, oy) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(Math.PI / 2 + Math.sin(fph - 0.8) * 0.3 * 0.3);
        fishBody(gold, fph);
        ctx.restore();
      });
    }
    return set[f];
  }
  /* the fish at one point of its stroke, around its middle, nose up */
  function fishBody(gold, ph) {
    realFish(ctx, gold ? 24 : 18, gold ? 7.8 : 6.1, ph, gold, 0.6);
  }

  /* A real fish, flapping on its side on the ice, nose towards -x. The
     plain one is an Arctic char: blue-black back, a silver flank with
     pale spots, a white belly. The golden one is the same fish in gold.
     It was a cartoon: a lozenge with a ring for an eye. Now it has the
     shape of a fish (a blunt head, the deepest point behind the gills, a
     narrow root to the tail), the fins a char has (dorsal, the little
     adipose, pectoral, pelvic, anal), fins you can see the rays in, a
     forked tail, scales, a lateral line and a small eye. It bends in one
     curve from behind the gills, and the tail follows the curve. */
  var FISH_INK = {
    n: { back: '#1f4766', mid: '#5f8fae', flank: '#b9d8e8', belly: '#f6fbfd', fin: '96,138,168',
         ray: '30,62,90', iris: '#cfdbe2', sheen: '206,178,236', spot: '236,246,252', line: '30,60,86' },
    g: { back: '#a85006', mid: '#e48a12', flank: '#ffc63e', belly: '#fff3c6', fin: '238,160,40',
         ray: '140,70,0', iris: '#ffe7a0', sheen: '255,248,214', spot: '255,236,170', line: '130,64,0' }
  };
  function realFish(c, L, H, ph, gold, glint) {
    var I = gold ? FISH_INK.g : FISH_INK.n, k, u, x;
    var bend = Math.sin(ph - 0.8) * 0.55, lw = Math.max(0.5, H * 0.07);
    var x0 = -L, x1 = 0.5 * L;
    function yc(xx) { var q = (xx + 0.45 * L) / L; return q > 0 ? bend * H * 1.1 * q * q : 0; }
    function half(q) {                                 // 0 at the snout, 1 at the root of the tail
      return q < 0.36 ? Math.sqrt(q / 0.36) * (0.78 + 0.22 * q / 0.36)
                      : 1 - 0.8 * Math.pow((q - 0.36) / 0.64, 1.35);
    }
    function topY(xx) { return yc(xx) - H * half((xx - x0) / (x1 - x0)); }
    function botY(xx) { return yc(xx) + H * 0.86 * half((xx - x0) / (x1 - x0)); }
    function body() {
      c.beginPath(); c.moveTo(x0, yc(x0) + H * 0.04);
      for (k = 1; k <= 16; k++) { x = x0 + (x1 - x0) * k / 16; c.lineTo(x, topY(x)); }
      for (k = 16; k >= 1; k--) { x = x0 + (x1 - x0) * k / 16; c.lineTo(x, botY(x)); }
      c.closePath();
    }
    function fin(pts, base) {                          // a fin of rays and the skin between them
      c.fillStyle = 'rgba(' + I.fin + ',.72)';
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      c.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      c.quadraticCurveTo(pts[3][0], pts[3][1], pts[4][0], pts[4][1]);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(' + I.ray + ',.38)'; c.lineWidth = lw * 0.7;
      c.beginPath();
      for (var r = 0; r <= 4; r++) {
        var t = r / 4, bx = pts[0][0] + (pts[4][0] - pts[0][0]) * t, by = pts[0][1] + (pts[4][1] - pts[0][1]) * t;
        var ex = pts[1][0] + (pts[3][0] - pts[1][0]) * t, ey = pts[1][1] + (pts[3][1] - pts[1][1]) * t;
        c.moveTo(bx, by); c.lineTo(bx + (ex - bx) * (base || 0.62), by + (ey - by) * (base || 0.62));
      }
      c.stroke();
    }

    /* the tail, forked, set at the angle the body ends at */
    var ang = Math.atan(bend * H * 1.1 * 2 * 0.95 / L) + Math.sin(ph) * 0.18, TL = L * (gold ? 0.74 : 0.62);
    c.save();
    c.translate(x1 - L * 0.04, yc(x1)); c.rotate(ang);
    var tg = c.createLinearGradient(0, 0, TL, 0);
    tg.addColorStop(0, gold ? 'rgba(230,140,20,.98)' : 'rgba(70,112,146,.98)');
    tg.addColorStop(1, 'rgba(' + I.fin + ',.72)');
    c.fillStyle = tg;
    c.beginPath(); c.moveTo(0, -H * 0.2);
    c.quadraticCurveTo(TL * 0.4, -H * 0.5, TL, -H * 1.05);
    c.quadraticCurveTo(TL * 0.68, -H * 0.3, TL * 0.58, 0);
    c.quadraticCurveTo(TL * 0.68, H * 0.3, TL, H * 1.05);
    c.quadraticCurveTo(TL * 0.4, H * 0.5, 0, H * 0.2);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(' + I.ray + ',.34)'; c.lineWidth = lw * 0.7;
    c.beginPath();
    for (k = -4; k <= 4; k++) {
      var tt = k / 4;
      c.moveTo(TL * 0.04, H * 0.16 * tt);
      c.lineTo(TL * (0.6 + 0.36 * Math.abs(tt)), H * 1.0 * tt);
    }
    c.stroke();
    c.restore();

    /* the fins behind the body */
    var dx = -0.3 * L;
    fin([[dx, topY(dx) + 1], [dx + 0.04 * L, topY(dx) - H * 0.95], [dx + 0.2 * L, topY(dx + 0.2 * L) - H * 0.7],
         [dx + 0.3 * L, topY(dx + 0.3 * L) - H * 0.12], [dx + 0.34 * L, topY(dx + 0.34 * L) + 1]]);
    x = 0.3 * L;                                        // the adipose: a small fleshy lobe, no rays
    c.fillStyle = gold ? '#c96c0a' : '#2f5878';
    c.beginPath(); c.moveTo(x - 0.06 * L, topY(x - 0.06 * L) + 0.5);
    c.quadraticCurveTo(x, topY(x) - H * 0.38, x + 0.08 * L, topY(x + 0.08 * L) + 0.5); c.fill();
    x = 0.18 * L;                                       // the anal fin
    fin([[x, botY(x) - 1], [x + 0.03 * L, botY(x) + H * 0.4], [x + 0.12 * L, botY(x + 0.12 * L) + H * 0.36],
         [x + 0.17 * L, botY(x + 0.17 * L) + H * 0.08], [x + 0.19 * L, botY(x + 0.19 * L) - 1]]);
    x = -0.1 * L;                                       // the pelvic fin
    fin([[x, botY(x) - 1], [x + 0.05 * L, botY(x) + H * 0.36], [x + 0.16 * L, botY(x + 0.16 * L) + H * 0.3],
         [x + 0.15 * L, botY(x + 0.15 * L) + H * 0.04], [x + 0.13 * L, botY(x + 0.13 * L) - 1]]);

    /* the body: dark back, silver flank, white belly */
    var g = c.createLinearGradient(0, -H, 0, H * 0.9);
    g.addColorStop(0, I.back); g.addColorStop(0.3, I.mid); g.addColorStop(0.52, I.flank);
    g.addColorStop(0.78, I.belly); g.addColorStop(1, mixHex(I.belly, I.mid, 0.25));
    c.fillStyle = g; body(); c.fill();

    c.save(); body(); c.clip();
    c.lineCap = 'round';
    /* the light along the flank, and the sheen scales throw */
    c.strokeStyle = 'rgba(' + I.sheen + ',.4)'; c.lineWidth = H * 0.38;
    c.beginPath();
    for (k = 0; k <= 10; k++) { x = -0.6 * L + 1.05 * L * k / 10; c.lineTo(x, yc(x) - H * 0.08); }
    c.stroke();
    /* the scales, small and in rows, catching the light as a mesh */
    c.strokeStyle = gold ? 'rgba(255,246,200,.3)' : 'rgba(240,250,255,.26)'; c.lineWidth = lw * 0.6;
    var sr = H * 0.17;
    c.beginPath();
    for (var row = -3; row <= 3; row++) {
      for (x = -0.5 * L + (row & 1) * sr; x < x1; x += sr * 1.6) {
        var yy = yc(x) + row * sr * 1.05;
        c.moveTo(x + sr * 0.9, yy - sr * 0.55);
        c.quadraticCurveTo(x + sr * 1.5, yy, x + sr * 0.9, yy + sr * 0.55);
      }
    }
    c.stroke();
    /* the char's pale spots, along the back and the upper flank */
    if (!gold) {
      c.fillStyle = 'rgba(' + I.spot + ',.55)';
      for (k = 0; k < 9; k++) {
        x = -0.5 * L + k * 0.105 * L;
        c.beginPath(); c.arc(x, yc(x) - H * (0.42 + 0.18 * ((k * 7) % 3) / 2), H * 0.075, 0, 6.2832); c.fill();
      }
    }
    /* the lateral line, gill to tail */
    c.strokeStyle = 'rgba(' + I.line + ',.4)'; c.lineWidth = lw * 0.8;
    c.beginPath();
    for (k = 0; k <= 10; k++) { x = -0.6 * L + 1.1 * L * k / 10; c.lineTo(x, yc(x) - H * (0.2 - 0.12 * k / 10)); }
    c.stroke();
    /* the gill cover, and its lit edge */
    x = -0.6 * L;
    c.strokeStyle = 'rgba(' + I.line + ',.55)'; c.lineWidth = lw * 1.1;
    c.beginPath(); c.moveTo(x - 0.02 * L, topY(x) + H * 0.1);
    c.quadraticCurveTo(x + 0.1 * L, yc(x) + H * 0.1, x - 0.02 * L, botY(x) - H * 0.05); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = lw * 0.7;
    c.beginPath(); c.moveTo(x + 0.03 * L, topY(x) + H * 0.25);
    c.quadraticCurveTo(x + 0.14 * L, yc(x) + H * 0.1, x + 0.03 * L, botY(x) - H * 0.15); c.stroke();
    /* wet: a bright streak along the top of the back */
    c.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.35 * (glint || 0)).toFixed(3) + ')'; c.lineWidth = lw * 1.4;
    c.beginPath();
    for (k = 0; k <= 8; k++) { x = -0.78 * L + 0.9 * L * k / 8; c.lineTo(x, topY(x) + H * 0.2); }
    c.stroke();
    c.restore();

    c.strokeStyle = gold ? 'rgba(120,56,0,.45)' : 'rgba(18,44,66,.45)'; c.lineWidth = lw;
    body(); c.stroke();

    /* the pectoral fin, low behind the gill, clear enough to see the flank through */
    c.save();
    c.translate(-0.56 * L, yc(-0.56 * L) + H * 0.38);
    c.rotate(0.5 + Math.sin(ph - 1.2) * 0.3);
    fin([[0, -H * 0.12], [L * 0.16, -H * 0.2], [L * 0.3, -H * 0.02], [L * 0.2, H * 0.16], [0, H * 0.1]], 0.7);
    c.restore();

    /* the mouth, the nostril and the eye: small, as a fish's are */
    c.strokeStyle = 'rgba(' + I.line + ',.65)'; c.lineWidth = lw;
    c.beginPath(); c.moveTo(x0 + 0.01 * L, yc(x0) + H * 0.06); c.lineTo(x0 + 0.15 * L, H * 0.18); c.stroke();
    var ex = x0 + 0.24 * L, ey = -H * 0.24, er = H * 0.21;
    c.fillStyle = I.iris; c.beginPath(); c.arc(ex, ey, er, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(' + I.line + ',.7)'; c.lineWidth = lw * 0.8; c.stroke();
    c.fillStyle = '#0d141c'; c.beginPath(); c.arc(ex + er * 0.05, ey + er * 0.05, er * 0.6, 0, 6.2832); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex - er * 0.25, ey - er * 0.28, er * 0.24, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(' + I.line + ',.6)';
    c.beginPath(); c.arc(x0 + 0.08 * L, -H * 0.3, H * 0.05, 0, 6.2832); c.fill();
  }

  /* A bubble of trapped air, not a glass marble: it wobbles as it drifts,
     the highlight slides around the inside of the skin as it turns, and
     there are motes caught in it. */
  function drawBubble(x, y, o) {
    var ph = W.t * 0.08 + o.ph;
    var r = o.r + Math.sin(ph) * 2;
    var sx = 1 + Math.sin(ph * 1.7) * 0.07;          // it is never quite round
    var sy = 1 - Math.sin(ph * 1.7) * 0.07;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);

    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.85)');
    g.addColorStop(0.55, 'rgba(160,230,255,.35)');
    g.addColorStop(1, 'rgba(110,200,245,.2)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.clip();
    /* A shield, not just a bubble: a honeycomb of ice across its skin,
       catching the light as it turns, says it is there to take a hit. */
    ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1.1;
    var hs = r * 0.3, hoff = (ph * 3) % (hs * 1.732);
    for (var hy = -r - hs; hy < r + hs; hy += hs * 1.5) {
      var row = Math.round((hy + r + hs) / (hs * 1.5));
      for (var hx = -r - hs * 2 + (row % 2) * hs * 0.866 + hoff; hx < r + hs; hx += hs * 1.732) {
        ctx.beginPath();
        for (var hk = 0; hk < 6; hk++) {
          var hang = hk * 1.0472 + 0.5236;
          var vx = hx + Math.cos(hang) * hs * 0.55, vy = hy + Math.sin(hang) * hs * 0.55;
          hk ? ctx.lineTo(vx, vy) : ctx.moveTo(vx, vy);
        }
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.3)';        // the film turning inside
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.66, r * 0.3, ph * 0.6, 0, 6.2832);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';         // motes caught in it
    for (var m = 0; m < 3; m++) {
      var ma = ph * 0.9 + m * 2.3;
      ctx.beginPath();
      ctx.arc(Math.cos(ma) * r * 0.42, Math.sin(ma * 1.3) * r * 0.4, 1.5, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(210,245,255,.9)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke();

    var ha = -2.2 + Math.sin(ph * 0.7) * 0.5;        // the catchlight slides
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath();
    ctx.ellipse(Math.cos(ha) * r * 0.52, Math.sin(ha) * r * 0.52,
                r * 0.26, r * 0.13, ha + 1.6, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath();
    ctx.ellipse(-Math.cos(ha) * r * 0.6, -Math.sin(ha) * r * 0.6,
                r * 0.12, r * 0.07, ha, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /* A tongue of blue ice: wind-scoured glacier surface, polished smooth and
     darker than the snow around it. It replaced a pair of posts with
     pennants — those were the one thing on the hill somebody had to have
     put there, and nothing else in this game is man-made.

     Kept as type 'gate' in the code because that is what it is to the
     rules: a thing you steer through for a bonus. */

  /* A fish, not a fish-shaped lozenge. The body flexes in an S that runs
     from the nose back to the tail, the tail follows a beat behind it, and
     the fins trail. A golden one is the same fish with everything turned
     up: longer fins, a brighter flank, and sparks coming off it. */

  /* ---- the penguin, flat on its belly, seen from directly above ---- */
  /* What tells one penguin from another when you are looking straight down
     at his back: something round the neck, something on his head, or a light
     of his own. Anything subtler than that is invisible at this size. */
  function drawSkinExtra(c, S) {
    if (!S.accessory || !S.accent) return;
    if (S.accessory === 'scarf') {
      c.fillStyle = S.accent;
      c.beginPath(); c.ellipse(0, -15, 15.5, 7.5, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)';
      c.beginPath(); c.ellipse(0, -13, 15.5, 5.5, 0, 0, 6.2832); c.fill();
      c.fillStyle = S.accent;                       // two tails streaming behind
      [-1, 1].forEach(function (k) {
        c.beginPath();
        c.moveTo(k * 8, -12);
        c.quadraticCurveTo(k * 17, 6, k * 12, 20);
        c.lineTo(k * 5, 17);
        c.quadraticCurveTo(k * 9, 4, k * 3, -11);
        c.closePath(); c.fill();
        /* knitted in stripes, two pale bands across each tail, and a fringe
           at its end, at any size (they were only there close up) */
        c.save(); c.clip();
        c.fillStyle = 'rgba(255,236,226,.55)';
        [6, 11].forEach(function (yy) {
          c.beginPath(); c.moveTo(k * 2, yy - 1.3); c.lineTo(k * 18, yy - 0.3); c.lineTo(k * 18, yy + 1.3); c.lineTo(k * 2, yy + 0.3); c.closePath(); c.fill();
        });
        c.restore();
        c.strokeStyle = S.accent; c.lineWidth = 0.9; c.lineCap = 'round';
        for (var fr = 0; fr < 4; fr++) {
          c.beginPath(); c.moveTo(k * (5.6 + fr * 1.6), 18 - fr * 0.4); c.lineTo(k * (5.4 + fr * 1.8), 22.5 - fr * 0.3); c.stroke();
        }
      });
      c.save();                                       // ribs round the collar, faint at this size
      c.beginPath(); c.ellipse(0, -15, 15.5, 7.5, 0, 0, 6.2832); c.clip();
      c.strokeStyle = 'rgba(110,16,16,.28)'; c.lineWidth = 0.7;
      for (var rb0 = -14; rb0 <= 14; rb0 += 2.6) { c.beginPath(); c.moveTo(rb0, -22); c.lineTo(rb0 + 1.2, -8); c.stroke(); }
      c.restore();
      if (DETAIL) {
        /* the knit: ribs round the collar and down the tails, and a darker
           fold where it wraps */
        c.save();
        c.beginPath(); c.ellipse(0, -15, 15.5, 7.5, 0, 0, 6.2832); c.clip();
        c.strokeStyle = 'rgba(120,20,20,.35)'; c.lineWidth = 0.6;
        for (var rb = -15; rb <= 15; rb += 1.8) {
          c.beginPath(); c.moveTo(rb, -22); c.lineTo(rb + 1.2, -8); c.stroke();
        }
        c.strokeStyle = 'rgba(255,200,200,.25)'; c.lineWidth = 0.5;
        for (rb = -14; rb <= 15; rb += 1.8) {
          c.beginPath(); c.moveTo(rb + 0.6, -22); c.lineTo(rb + 1.8, -8); c.stroke();
        }
        c.restore();
      }
    } else if (S.accessory === 'cap') {
      /* A brass compass on a cord, lying on his back behind the head, and
         its needle pointing at the nearest fish: he knows where the shoals
         are. Off the hill (a shop card, a comic) it settles on north. */
      var nd = -Math.PI / 2 + Math.sin((W ? W.t : 0) * 0.05) * 0.15;
      if (HILL && W && W.objects) {
        var best = 1e9;
        for (var fi = 0; fi < W.objects.length; fi++) {
          var fo = W.objects[fi];
          if ((fo.t !== 'fish' && fo.t !== 'gold') || fo.got || fo.d < W.dist - 10) continue;
          var fdx = fo.x - W.px, fdd = fo.d - W.dist, fq = fdx * fdx + fdd * fdd;
          if (fq < best) { best = fq; nd = Math.atan2(-fdd, fdx) - PENG_ANG; }
        }
      }
      c.strokeStyle = 'rgba(60,40,20,.7)'; c.lineWidth = 0.9;            // the cord, round his neck
      c.beginPath(); c.moveTo(-8, -15); c.quadraticCurveTo(0, -11.5, 8, -15); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath(); c.ellipse(0.8, -7, 6.4, 5.6, 0, 0, 6.2832); c.fill();
      var cgb = c.createLinearGradient(-6, -13, 6, -1);
      cgb.addColorStop(0, '#ffe08a'); cgb.addColorStop(0.5, S.accent); cgb.addColorStop(1, '#8a5a12');
      c.fillStyle = cgb;
      c.beginPath(); c.ellipse(0, -8, 6.2, 5.6, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#eef3f2';                        // the face under its glass
      c.beginPath(); c.ellipse(0, -8, 4.5, 4, 0, 0, 6.2832); c.fill();
      c.save(); c.translate(0, -8); c.rotate(nd);    // the needle: red to the fish, white behind
      c.fillStyle = '#d8302c';
      c.beginPath(); c.moveTo(4, 0); c.lineTo(0, -1.1); c.lineTo(0, 1.1); c.closePath(); c.fill();
      c.fillStyle = '#9aa3ab';
      c.beginPath(); c.moveTo(-3.4, 0); c.lineTo(0, -1.1); c.lineTo(0, 1.1); c.closePath(); c.fill();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,.55)';          // the glass catching the light
      c.beginPath(); c.ellipse(-1.6, -9.6, 1.8, 1, -0.5, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(90,60,10,.6)'; c.lineWidth = 0.7;
      c.beginPath(); c.ellipse(0, -8, 6.2, 5.6, 0, 0, 6.2832); c.stroke();
    } else if (S.accessory === 'tusk') {
      /* The one thing that makes a narwhal a narwhal: a tooth, grown out
         through the LEFT side of the upper lip, straight ahead and a touch
         to the left, with the left-handed spiral it is known for. It came
         out of the middle of the crown, like a unicorn's horn. Drawn from
         the lip forward, so the head covers its root. */
      c.save();
      c.translate(-2.2, -41); c.rotate(-0.04);
      var tg = c.createLinearGradient(-2.4, 0, 2.4, 0);
      tg.addColorStop(0, '#d8cdb4'); tg.addColorStop(0.45, S.accent); tg.addColorStop(1, '#c9bc9e');
      c.fillStyle = tg;
      c.beginPath();
      c.moveTo(-2.4, 2); c.lineTo(2.4, 2);
      c.lineTo(0.8, -27); c.quadraticCurveTo(0, -28.4, -0.8, -27);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(110,100,82,.55)'; c.lineWidth = 0.8;
      for (var tw = 0; tw < 6; tw++) {                 // the spiral
        var ty = -1 - tw * 4.4, hw = 2.2 - tw * 0.24;
        c.beginPath(); c.moveTo(-hw, ty); c.lineTo(hw, ty - 2.6); c.stroke();
      }
      c.restore();
    } else if (S.accessory === 'puffin') {
      /* nothing: the rockhopper's plumes and bill are its own (bodyPenguin) */
    } else if (S.accessory === 'collar') {
      /* nothing: the emperor's gold is his own ear patch (bodyPenguin) */
    } else if (S.accessory === 'aurora') {
      /* The northern lights across her back: soft bands of green and
         violet, kept inside the body and drifting slowly, a glow rather
         than a line. */
      var ph = (W ? W.t : 0) * 0.035;
      c.save();
      c.beginPath(); c.ellipse(0, -1, 14.5, 19, 0, 0, 6.2832); c.clip();
      c.globalCompositeOperation = 'lighter';
      [['110,255,180', -9, 0], ['150,200,255', -2, 1.7], ['190,130,255', 5, 3.4]].forEach(function (rb) {
        for (var bx = -15; bx <= 15; bx += 3) {
          var by = rb[1] + Math.sin(bx * 0.16 + ph + rb[2]) * 2.2;
          var gr = c.createRadialGradient(bx, by, 0, bx, by, 6);
          gr.addColorStop(0, 'rgba(' + rb[0] + ',.32)');
          gr.addColorStop(1, 'rgba(' + rb[0] + ',0)');
          c.fillStyle = gr;
          c.beginPath(); c.ellipse(bx, by, 6, 6, 0, 0, 6.2832); c.fill();
        }
      });
      c.restore();
    } else if (S.accessory === 'glow') {
      /* a soap bubble round him: clear, its film banded with the colours
         thin film throws, turning slowly, a window of light on it */
      var bt = (W ? W.t : 0) * 0.02;
      var gg = c.createRadialGradient(0, -4, 18, 0, -4, 33);
      gg.addColorStop(0, 'rgba(200,240,255,0)'); gg.addColorStop(1, 'rgba(200,240,255,.28)');
      c.fillStyle = gg;
      c.beginPath(); c.ellipse(0, -4, 30, 33, 0, 0, 6.2832); c.fill();
      c.lineWidth = 2.2;
      [['255,120,220', 0], ['255,230,120', 1.6], ['120,255,190', 3.2], ['120,200,255', 4.8]].forEach(function (f) {
        c.strokeStyle = 'rgba(' + f[0] + ',.38)';
        c.beginPath(); c.ellipse(0, -4, 29, 32, 0, f[1] + bt, f[1] + bt + 1.5); c.stroke();
      });
      c.strokeStyle = 'rgba(235,250,255,.75)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, -4, 30, 33, 0, 0, 6.2832); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.6)';           // the window, and its little twin
      c.beginPath(); c.ellipse(-15, -24, 6, 3.4, -0.6, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.ellipse(17, 16, 3, 1.6, -0.6, 0, 6.2832); c.fill();
    }
  }

  /* One painter, two callers: the live penguin on the hill and the little
     portrait on each shop card. Everything it needs comes in through `o`,
     so the preview does not have to fake a world to borrow the drawing. */
  /* ---- the creatures -------------------------------------------
     All of them are seen from straight above, flat out on their fronts
     with the head forward. What has to read at this size is the
     silhouette and two or three markings; anything finer is mud. */

  /* The penguins, after the owner's pick (12 Nov 2026): each one a real
     species, and all of them tobogganing as penguins really do.
     - The body is a torpedo now, not a ball: the head forward on a short
       neck, the widest point behind the shoulders, tapering to a stiff
       tail. Lying on its belly it is the back you see, glossy and finely
       feathered; the white front shows only at the flanks, and more of it
       on the outside of a turn, where the body rolls up off the snow.
     - It moves the way they do: the feet kick back by turns, the flippers
       row together now and then, a stroke and a slow return.
     - Each skin is a species you could tell from above: Snowcap an Adélie
       (all black head, the white ring round the eye, a stubby black bill,
       pink feet); Mitten a chinstrap (a black cap, white face, the thin
       black strap under the chin); Puffin a rockhopper (yellow plumes
       springing back from over red eyes, a stout orange bill); Bubbles a
       little blue penguin in a real soap bubble; Compass a gentoo (the
       white band over the crown, an orange bill and feet) with a brass
       compass whose needle points at the nearest fish; the Emperor
       larger, gold at the ear fading down the neck, a long black bill with
       its orange streak, black feet; Aurora shaped as a king penguin, with
       the northern lights for its ear patches and across its back.
     The eyes are as they were. */
  var PENGUIN_SP = {
    snowcap: { sp: 'adelie', beak: '#2c2e34', bill: 'short', feet: '#eeaaa6', edge: 'rgba(150,70,70,.5)' },
    mitten:  { sp: 'chinstrap', beak: '#26282e', bill: 'short', feet: '#eeaaa6', edge: 'rgba(150,70,70,.5)' },
    puffin:  { sp: 'rockhopper', beak: '#e4521c', bill: 'stout', feet: '#f0a8a2', edge: 'rgba(150,70,70,.5)', eye: '#a3161b' },
    bubbles: { sp: 'little', beak: '#3a3f48', bill: 'short', feet: '#efb6b2', edge: 'rgba(150,80,80,.45)' },
    compass: { sp: 'gentoo', beak: '#f0541c', bill: 'long', feet: '#ff8a2a', edge: 'rgba(170,70,10,.5)' },
    emperor: { sp: 'emperor', beak: '#1f2126', bill: 'long', feet: '#2a2c31', edge: 'rgba(0,0,0,.45)', size: 1.07, stripe: '#ff8a3d' },
    aurora:  { sp: 'king', beak: '#1f2126', bill: 'long', feet: '#2b2d33', edge: 'rgba(0,0,0,.45)', size: 1.03, stripe: '#8ff3ff' }
  };
  function penguinBody(c) {                       // round and plump: a cartoon penguin, not a torpedo
    c.beginPath();
    c.moveTo(0, -20);
    c.bezierCurveTo(13, -21.5, 21, -12, 21, -1);
    c.bezierCurveTo(21, 11, 15, 21, 7, 24);
    c.quadraticCurveTo(0, 27, -7, 24);
    c.bezierCurveTo(-15, 21, -21, 11, -21, -1);
    c.bezierCurveTo(-21, -12, -13, -21.5, 0, -20);
    c.closePath();
  }
  function penguinCrown(c) {
    for (var ci = -2; ci <= 2; ci++) {
      var ca = ci * 0.36, len = ci === 0 ? 11 : 7.5 - Math.abs(ci);
      c.save();
      c.translate(Math.sin(ca) * 10, -28 - Math.cos(ca) * 3);
      c.rotate(ca);
      var cg2 = c.createLinearGradient(0, 0, 0, -len);
      cg2.addColorStop(0, '#7fd8f0'); cg2.addColorStop(1, '#ffffff');
      c.fillStyle = cg2;
      c.beginPath();
      c.moveTo(-2.6, 0); c.lineTo(0, -len); c.lineTo(2.6, 0); c.lineTo(0, 2);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(20,60,110,.55)'; c.lineWidth = 0.8; c.stroke();
      c.restore();
    }
  }
  /* Cartoon eyes (owner, 12 Nov 2026: "a bit cuter, like a cartoon"):
     big and glossy, white round a dark iris, two lights in each. They
     still blink, glance at the nearest fish and go wide in a fright. */
  function cuteEyes(c, cy, spread, r, iris) {
    var E = eyeState(), rr = r * Math.min(1.25, E.wide);
    [-1, 1].forEach(function (k) {
      var ex = k * spread, ey = cy;
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.beginPath(); c.ellipse(ex + 0.3, ey + 0.9, rr * 1.04, rr * Math.max(0.3, E.shut), 0, 0, 6.2832); c.fill();
      if (E.shut < 0.3) {                            // a blink: a happy curve
        c.strokeStyle = '#121418'; c.lineWidth = Math.max(1, r * 0.4); c.lineCap = 'round';
        c.beginPath(); c.moveTo(ex - rr * 0.9, ey); c.quadraticCurveTo(ex, ey - rr * 0.6, ex + rr * 0.9, ey); c.stroke();
        return;
      }
      c.fillStyle = '#ffffff';
      c.beginPath(); c.ellipse(ex, ey, rr, rr * 0.96 * E.shut, 0, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(20,24,32,.5)'; c.lineWidth = 0.6; c.stroke();
      var px = ex + E.lx * r * 0.28 - k * r * 0.08, py = ey - r * 0.2 + E.ly * r * 0.28;   // looking ahead, a touch inward
      c.fillStyle = iris || '#1c2230';
      c.beginPath(); c.ellipse(px, py, r * 0.64, r * 0.64 * E.shut, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#0b0d12';
      c.beginPath(); c.ellipse(px, py, r * 0.4, r * 0.4 * E.shut, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(px - r * 0.24, py - r * 0.26, r * 0.24, 0, 6.2832); c.fill();
      c.beginPath(); c.arc(px + r * 0.2, py + r * 0.2, r * 0.11, 0, 6.2832); c.fill();
    });
  }
  var PENG_ANG = 0;                     // his heading, for the compass needle
  function bodyPenguin(c, S, ang, wag, o) {
    PENG_ANG = ang || 0;
    var P = PENGUIN_SP[S.id] || { sp: 'plain', beak: S.trim, bill: 'short', feet: S.trim, edge: S.trimEdge };
    var g = o.gait || 0, turn = clamp(o.turn || 0, -1, 1), k;
    c.save();
    if (P.size) c.scale(P.size, P.size);

    /* the flippers: held out a little back, and now and then both rowing
       hard against the snow, a stroke and a slow return */
    var row = Math.pow(Math.max(0, Math.sin(g * 0.55)), 2);
    [-1, 1].forEach(function (k) {
      c.save();
      c.translate(k * 15, -9);
      c.rotate(k * (0.3 + 0.8 * row + swing(o, k > 0 ? 0 : 0.4, 0.05)) - ang * 0.32 * k);
      var fg = c.createLinearGradient(0, -5, k * 28, 12);
      fg.addColorStop(0, S.flipper[0]); fg.addColorStop(0.6, S.flipper[1]); fg.addColorStop(1, S.flipper[2]);
      c.fillStyle = fg;
      c.beginPath();                                   // short and plump, a rounded paddle
      c.moveTo(0, -6.5);
      c.quadraticCurveTo(k * 14, -8, k * 22, 2);
      c.quadraticCurveTo(k * 25, 8, k * 19, 9);
      c.quadraticCurveTo(k * 9, 9, 0, 7.5);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(170,198,230,.45)'; c.lineWidth = 1.3;  // its lit leading edge
      c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(k * 14, -7.5, k * 21.5, 2); c.stroke();
      c.fillStyle = 'rgba(244,250,255,.55)';           // white on its trailing edge, underneath
      c.beginPath(); c.moveTo(k * 4, 7); c.quadraticCurveTo(k * 12, 8, k * 19, 8.4); c.quadraticCurveTo(k * 12, 6, k * 4, 5.6); c.closePath(); c.fill();
      c.restore();
    });

    /* the feet, kicking back by turns: a push and a slow draw up */
    [-1, 1].forEach(function (k) {
      var kick = Math.max(0, Math.sin(g + (k > 0 ? 0 : Math.PI)));
      c.save();
      c.translate(k * 8.5, 22 + kick * 4.5);
      c.rotate(k * (0.25 + 0.35 * kick));
      c.fillStyle = P.feet;
      c.beginPath();                                   // webbed, three round toes
      c.moveTo(-2.6, -3.5);
      c.quadraticCurveTo(-k * 5.5, 4, -k * 4.2, 11);
      c.quadraticCurveTo(-k * 3, 13.2, -k * 1.6, 11.4);
      c.quadraticCurveTo(-k * 0.4, 14.6, k * 1.4, 12.6);
      c.quadraticCurveTo(k * 3.2, 14.4, k * 4.6, 11.6);
      c.quadraticCurveTo(k * 6, 4, 2.6, -3.5);
      c.closePath(); c.fill();
      c.strokeStyle = P.edge; c.lineWidth = 1; c.stroke();
      c.restore();
    });

    /* the short stiff tail, between the feet */
    c.fillStyle = S.body[2];
    c.beginPath(); c.moveTo(-4.5, 22); c.quadraticCurveTo(0, 33, 4.5, 22); c.closePath(); c.fill();

    /* the white front, showing at the flanks: more on the outside of a
       turn, where he rolls up off the snow */
    [-1, 1].forEach(function (k) {
      var up = 0.35 + 0.65 * Math.max(0, -k * turn);
      c.fillStyle = 'rgba(244,250,255,' + (0.55 + 0.35 * up).toFixed(3) + ')';
      c.beginPath();
      c.moveTo(k * 17, -10);
      c.bezierCurveTo(k * (20.5 + 3 * up), -2, k * (19 + 3 * up), 12, k * 8, 24);
      c.bezierCurveTo(k * 14, 12, k * 16.5, 0, k * 15, -10);
      c.closePath(); c.fill();
    });

    var bg = c.createRadialGradient(-7, -12, 4, 0, 0, 33);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    penguinBody(c); c.fill();
    c.save();
    c.globalAlpha = 0.2;
    furCoat(c, 0, 16, 17, 22, S.body[0], 7);
    c.globalAlpha = 1;
    c.restore();
    /* the feathers: small, overlapping, in staggered rows like roof tiles,
       every light edge in one stroke and every shadow in another */
    c.save();
    penguinBody(c); c.clip();
    c.lineWidth = 0.8;
    for (var fp = 0; fp < 2; fp++) {
      var fa0 = fp ? 0.6 : 0.5, fa1 = fp ? 2.54 : 2.64, fdy = fp ? 0.8 : 0;
      c.strokeStyle = fp ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)';
      c.beginPath();
      for (var fr = 0, fy = -19; fy <= 28; fy += 3.4, fr++) {
        for (var fx = -20 + (fr % 2) * 2.5; fx <= 20; fx += 5) {
          c.moveTo(fx + 2.6 * Math.cos(fa0), fy + fdy + 2.6 * Math.sin(fa0));
          c.arc(fx, fy + fdy, 2.6, fa0, fa1);
        }
      }
      c.stroke();
    }
    if (P.sp === 'emperor' || P.sp === 'king') {      // their pale gold showing at the neck, either side
      var nc = P.sp === 'king' ? '160,230,255' : '255,214,120';
      [-1, 1].forEach(function (k) {
        var ng = c.createRadialGradient(k * 13, -15, 0, k * 13, -15, 10);
        ng.addColorStop(0, 'rgba(' + nc + ',.55)'); ng.addColorStop(1, 'rgba(' + nc + ',0)');
        c.fillStyle = ng; c.beginPath(); c.arc(k * 13, -15, 10, 0, 6.2832); c.fill();
      });
    }
    c.restore();

    crease(c, 0, -18, 11, 4.5, 0.16);                 // where the head sits on the back
    sheen(c, -7, -8, 7.5, 15, -0.25, 0.14);           // along the back
    sheen(c, 9, 2, 3, 11, 0.2, 0.07);                 // a thin edge on the far side
    var hb = Math.sin(g * 2) * 0.4;                    // the head nodding with the kicks
    function face() {                                  // the head, a quarter bigger than life: a cartoon's
      c.translate(0, -26 + hb); c.scale(1.26, 1.26); c.translate(0, 26 - hb);
    }
    c.save(); face();
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -26 + hb, 11.5, 10.8, 0, 0, 6.2832); c.fill();
    sheen(c, -3.5, -29 + hb, 5.5, 4, -0.4, 0.18);     // light on the crown
    penguinFace(c, S, P, hb);
    c.fillStyle = 'rgba(255,130,150,.32)';             // rosy cheeks, behind the eyes
    [-1, 1].forEach(function (k) { c.beginPath(); c.ellipse(k * 9.2, -22.2 + hb, 2.6, 1.6, k * 0.5, 0, 6.2832); c.fill(); });
    cuteEyes(c, -27.2 + hb, 5.6, 3.5, P.eye);
    if (P.sp === 'rockhopper') penguinCrest(c, hb);
    if (S.accessory === 'aurora') penguinCrown(c);
    c.restore();

    drawSkinExtra(c, S);
    c.save(); face(); penguinBill(c, S, P, hb); c.restore();
    c.restore();
  }
  /* the marks of each species on the head, under the eyes */
  function penguinFace(c, S, P, hb) {
    var k;
    if (P.sp === 'chinstrap') {
      /* a black cap; the face below it white, and the strap under the chin
         showing at each side */
      [-1, 1].forEach(function (k) {
        c.fillStyle = '#f4f7fa';
        c.beginPath();
        c.moveTo(k * 3.5, -33 + hb);
        c.bezierCurveTo(k * 9, -34 + hb, k * 12.5, -29 + hb, k * 11.4, -22.5 + hb);
        c.quadraticCurveTo(k * 8, -20.5 + hb, k * 6, -23 + hb);
        c.quadraticCurveTo(k * 9, -28 + hb, k * 3.5, -33 + hb);
        c.closePath(); c.fill();
        c.strokeStyle = '#1a1c22'; c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(k * 5, -33.4 + hb); c.quadraticCurveTo(k * 11.6, -31 + hb, k * 11.8, -24 + hb); c.stroke();
      });
    } else if (P.sp === 'gentoo') {
      /* the white band over the crown, from one eye to the other */
      /* (bowed towards the bill, a bonnet over the crown: bowed the other
         way it sat behind the eyes like a grin) */
      c.fillStyle = '#f6f9fc';
      c.beginPath();
      c.moveTo(-9, -29 + hb);
      c.quadraticCurveTo(0, -34.5 + hb, 9, -29 + hb);
      c.quadraticCurveTo(7.5, -27 + hb, 6, -28.4 + hb);
      c.quadraticCurveTo(0, -31.2 + hb, -6, -28.4 + hb);
      c.quadraticCurveTo(-7.5, -27 + hb, -9, -29 + hb);
      c.closePath(); c.fill();
    } else if (P.sp === 'emperor' || P.sp === 'king') {
      /* the ear patch: deep at the ear, fading down the side of the neck */
      var c0 = P.sp === 'king' ? '180,140,255' : '255,150,40', c1 = P.sp === 'king' ? '140,240,255' : '255,214,110';
      [-1, 1].forEach(function (k) {
        var eg = c.createLinearGradient(k * 8, -27 + hb, k * 14, -14);
        eg.addColorStop(0, 'rgba(' + c0 + ',.95)'); eg.addColorStop(0.6, 'rgba(' + c1 + ',.8)'); eg.addColorStop(1, 'rgba(' + c1 + ',0)');
        c.fillStyle = eg;
        c.beginPath();
        c.moveTo(k * 9.8, -26 + hb);
        c.bezierCurveTo(k * 13, -27 + hb, k * 15, -20, k * 14.5, -13);
        c.quadraticCurveTo(k * 11, -16, k * 8.4, -21 + hb);
        c.closePath(); c.fill();
      });
    }
  }
  /* the rockhopper's plumes: a yellow brow over each eye, running back and
     springing out in a spray of feathers behind it */
  function penguinCrest(c, hb) {
    [-1, 1].forEach(function (k) {
      c.strokeStyle = '#ffd43a'; c.lineCap = 'round'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(k * 3.5, -32 + hb); c.quadraticCurveTo(k * 8.5, -32 + hb, k * 10.5, -26 + hb); c.stroke();
      c.lineWidth = 1.1;
      for (var q = 0; q < 5; q++) {
        var qa = -0.5 + q * 0.32;
        c.strokeStyle = q % 2 ? '#ffe57a' : '#f2b81c';
        c.beginPath(); c.moveTo(k * 10.2, -26.5 + hb);
        c.quadraticCurveTo(k * (13 + q), -26 + hb + q * 1.5, k * (15.5 + q * 0.8), -28 + hb + q * 3.4 + Math.sin(qa) * 2);
        c.stroke();
      }
    });
  }
  /* the bill, in each species' own shape and colour */
  function penguinBill(c, S, P, hb) {
    var L = P.bill === 'long' ? 8.5 : P.bill === 'stout' ? 6 : 5, W2 = P.bill === 'long' ? 2.3 : P.bill === 'stout' ? 3.4 : 2.8;
    var y0 = -33.5 + hb, tip = y0 - L;       // small and rounded, a cartoon's
    function shape(cc) {
      cc.beginPath();
      cc.moveTo(-W2, y0 + 0.6); cc.quadraticCurveTo(-W2 * 0.75, y0 - L * 0.55, -0.4, tip + 0.4);
      cc.quadraticCurveTo(0, tip - 0.4, 0.4, tip + 0.4);
      cc.quadraticCurveTo(W2 * 0.75, y0 - L * 0.55, W2, y0 + 0.6);
      cc.quadraticCurveTo(0, y0 - 0.8, -W2, y0 + 0.6);
      cc.closePath();
    }
    var bk = c.createLinearGradient(-W2, 0, W2, 0);
    bk.addColorStop(0, mixHex(P.beak, '#ffffff', 0.25)); bk.addColorStop(0.5, P.beak); bk.addColorStop(1, mixHex(P.beak, '#000000', 0.25));
    c.fillStyle = bk; shape(c); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.6; c.stroke();
    if (P.stripe) {                                   // the streak along the lower mandible, showing each side
      c.strokeStyle = P.stripe; c.lineWidth = 1.1; c.lineCap = 'round';
      [-1, 1].forEach(function (k) {
        c.beginPath(); c.moveTo(k * W2 * 0.85, y0 - 0.2); c.quadraticCurveTo(k * W2 * 0.6, y0 - L * 0.5, k * 0.6, tip + L * 0.25); c.stroke();
      });
    }
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.6;   // light along the ridge
    c.beginPath(); c.moveTo(0.5, y0 - 1); c.quadraticCurveTo(0.9, y0 - L * 0.5, 0.2, tip + 1); c.stroke();
    if (DETAIL) {                                     // close up: nostrils and the gape
      c.fillStyle = 'rgba(0,0,0,.5)';
      [-1, 1].forEach(function (k) { c.beginPath(); c.ellipse(k * W2 * 0.45, y0 - L * 0.35, 0.5, 0.25, k * 1.2, 0, 6.2832); c.fill(); });
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.45;
      c.beginPath(); c.moveTo(-W2 * 0.8, y0); c.quadraticCurveTo(-W2 * 0.3, y0 - L * 0.6, 0, tip + 0.8); c.stroke();
    }
  }

  /* ---- what separates an animal from a shape ------------------
     Three things, in order of how much they buy you: eyes, a coat that
     breaks the outline, and toes. A perfectly smooth vector edge is the
     single biggest tell that you are looking at a drawing, so the furred
     animals get their silhouette broken up and the sleek ones get a wet
     sheen instead. Everything here is deterministic — a creature must not
     shimmer from frame to frame. */

  /* Stable per-strand jitter for fur and feathers: the same strand lands in
     the same place every frame. It was called frnd, and so was the look's
     random generator added beside it — JavaScript keeps the LAST of two
     functions with one name, so every puff, flake and streak quietly got
     this hash instead of a random number and came out in the same place
     every time. One name each now. */
  function strandJit(i, k) {
    var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  /* A furred edge, not a fringe of spikes. The first attempt used forty
     long strands and every one of them read separately — the polar bear
     came out looking like a sea urchin. Fur at this size is DENSE, SHORT
     and barely darker than the coat: what the eye picks up is a softened,
     slightly uneven outline, never an individual hair. */
  function furRing(c, cy, rx, ry, n, len, dark, light, seed) {
    var i, a, ca, sa, bx, by, nx, ny, L, w;
    c.save();
    c.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? light : dark;
      c.globalAlpha = pass ? 0.5 : 0.65;
      c.lineWidth = pass ? 1.3 : 1.9;
      for (i = 0; i < n; i++) {
        a = (i + (pass ? 0.5 : 0)) / n * 6.2832;
        ca = Math.cos(a); sa = Math.sin(a);
        bx = ca * rx; by = cy + sa * ry;
        nx = ca / rx; ny = sa / ry;
        L = Math.sqrt(nx * nx + ny * ny) || 1;
        nx /= L; ny /= L;
        w = len * (0.5 + strandJit(i, seed + pass) * 0.7);
        c.beginPath();
        c.moveTo(bx - nx * w, by - ny * w);
        c.lineTo(bx + nx * w * 0.9, by + ny * w * 0.9);
        c.stroke();
      }
    }
    c.restore();
  }

  /* Fur lying on the back. Every stroke used to be vertical, which on a
     pale animal read as wax running down it; they lie along the body's own
     radius now, the way a coat actually sits, and they are short. */
  function furCoat(c, cy, rx, ry, n, tone, seed) {
    c.save();
    c.strokeStyle = tone; c.lineWidth = 1.3; c.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var a = strandJit(i, seed) * 6.2832;
      var d = 0.3 + strandJit(i, seed + 3) * 0.62;
      var x = Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      /* Flowing back from the head rather than out from the middle: taking
         the centre as the origin made every stroke point at it and the
         whole coat read as a starburst. */
      var hx = 0, hy = cy - ry * 1.15;
      var ox = x - hx, oy = y - hy;
      var m = Math.sqrt(ox * ox + oy * oy) || 1;
      ox /= m; oy /= m;
      var L = 2.6 + strandJit(i, seed + 7) * 3.4;
      c.beginPath();
      c.moveTo(x - ox * L, y - oy * L);
      c.lineTo(x + ox * L, y + oy * L);
      c.stroke();
    }
    c.restore();
  }

  /* Eyes do more for this than everything else put together. Placed on the
     sides of the head for prey, further forward for a hunter. */
  /* What the eyes are doing, set by drawPenguin for the animal on the hill
     and null for a portrait: a blink now and then, a glance at the nearest
     fish, wide with alarm for a moment after a close call. */
  var EYE = null;
  /* Close-up detail: on when a comic paints a creature large. At the size
     it rides the hill a beak is a triangle and nothing finer would show;
     four times bigger, the triangle is all you see. */
  var DETAIL = false;
  function eyeState() {
    return EYE || { shut: 1, wide: 1, lx: 0, ly: 0 };
  }
  function eyes(c, cy, spread, up, r, dark) {
    var E = eyeState(), rr = r * E.wide;
    [-1, 1].forEach(function (k) {
      var ex = k * spread, ey = cy - up;
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.beginPath(); c.ellipse(ex, ey + 0.8, rr * 1.35, rr * 1.2 * Math.max(0.35, E.shut), 0, 0, 6.2832); c.fill();
      if (E.wide > 1.05) {                           // the whites, showing in alarm
        c.fillStyle = 'rgba(255,255,255,' + Math.min(0.95, (E.wide - 1) * 2.4).toFixed(3) + ')';
        c.beginPath(); c.ellipse(ex, ey, rr * 1.3, rr * 1.25, 0, 0, 6.2832); c.fill();
      }
      if (E.shut < 0.3) {                            // a blink: the lid, a line
        c.strokeStyle = dark || '#121418'; c.lineWidth = Math.max(1, r * 0.55); c.lineCap = 'round';
        c.beginPath(); c.moveTo(ex - rr, ey); c.quadraticCurveTo(ex, ey + rr * 0.45, ex + rr, ey); c.stroke();
        return;
      }
      var px = ex + E.lx * r * 0.35, py = ey + E.ly * r * 0.35;   // a glance
      c.fillStyle = dark || '#121418';
      c.beginPath(); c.ellipse(px, py, rr, rr * 0.95 * E.shut, 0, 0, 6.2832); c.fill();
      if (DETAIL) {
        /* close up: a dark brown iris round the pupil, a wet rim, and two
           lights — a window and the sky */
        var ig = c.createRadialGradient(px, py, rr * 0.2, px, py, rr * 0.82);
        ig.addColorStop(0, '#0a0b0d'); ig.addColorStop(0.45, '#0a0b0d');
        ig.addColorStop(0.5, '#4a2c1a'); ig.addColorStop(1, '#2a1a10');
        c.fillStyle = ig;
        c.beginPath(); c.ellipse(px, py, rr * 0.82, rr * 0.78 * E.shut, 0, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = rr * 0.12;
        c.beginPath(); c.ellipse(px, py, rr * 0.96, rr * 0.91 * E.shut, 0, 3.6, 5.9); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.55)';
        c.beginPath(); c.arc(px + rr * 0.32, py + rr * 0.3, rr * 0.13, 0, 6.2832); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,.85)';         // catchlight, same side on both
      c.beginPath(); c.arc(px - rr * 0.34, py - rr * 0.34, rr * 0.34, 0, 6.2832); c.fill();
    });
  }

  /* Three toes and a claw apiece: a paw without them is a mitten. */
  function toes(c, k, r, tone, claw) {
    c.fillStyle = tone;
    for (var i = -1; i <= 1; i++) {
      var a = i * 0.55;
      var x = Math.sin(a) * r * 0.62, y = -Math.cos(a) * r * 0.95;
      c.beginPath(); c.ellipse(x, y, r * 0.3, r * 0.34, a, 0, 6.2832); c.fill();
    }
    if (!claw) return;
    c.strokeStyle = claw; c.lineWidth = 1.3; c.lineCap = 'round';
    for (i = -1; i <= 1; i++) {
      var a2 = i * 0.55;
      var x2 = Math.sin(a2) * r * 0.62, y2 = -Math.cos(a2) * r * 0.95;
      c.beginPath();
      c.moveTo(x2, y2 - r * 0.18);
      c.lineTo(x2 + Math.sin(a2) * r * 0.3, y2 - r * 0.5);
      c.stroke();
    }
  }

  /* Light off the top left, and a soft dark crease where one mass sits on
     another. Between them they turn a flat blob into something with a back
     and a head. */
  function sheen(c, x, y, rx, ry, rot, a) {
    c.fillStyle = 'rgba(255,255,255,' + a + ')';
    c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 6.2832); c.fill();
  }
  function crease(c, x, y, rx, ry, a) {
    c.fillStyle = 'rgba(0,0,0,' + a + ')';
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill();
  }

  /* A white animal on white snow has no silhouette at all unless you draw
     it one. Dark creatures leave `outline` off and get nothing. */
  function edge(c, S, w) {
    if (!S.outline) return false;
    c.strokeStyle = S.outline; c.lineWidth = w || 2.2;
    return true;
  }

  /* An animal drawn as separate closed shapes reads as separate shapes: a
     circle for the head, ovals for the paws, all sitting beside each other.
     These build the whole creature as ONE path out of overlapping lumps,
     then stroke it heavily before filling. The stroke lands on the internal
     seams too, but the fill covers those, so what is left is a single
     unbroken outline round the lot — limbs growing out of the body instead
     of parked next to it. */
  function lump(c, x, y, rx, ry, rot) {
    c.moveTo(x + Math.cos(rot || 0) * rx, y + Math.sin(rot || 0) * rx);
    c.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832);
  }
  function wedge(c, x, y, tipX, tipY, half) {
    c.moveTo(x - half, y);
    c.lineTo(tipX, tipY);
    c.lineTo(x + half, y);
    c.closePath();
  }
  /* A leg described by where it leaves the body and which way it points,
     so the pad can be put on the far end of it. Placing pads relative to
     the leg's CENTRE put every one of them inside the animal. */
  function limbTip(sx, sy, a, len) {
    return [sx + Math.cos(a) * len, sy + Math.sin(a) * len];
  }
  function limb(cc, sx, sy, a, len, wide) {
    lump(cc, sx + Math.cos(a) * len * 0.5, sy + Math.sin(a) * len * 0.5,
         len * 0.5, wide, a);
  }

  /* A leg as it is seen from above, in two parts with a joint between:
     L.sx, L.sy where it leaves the body (inside it, so the join is hidden),
     the upper part (thigh or forearm) at angle a1 for l1, the lower part
     at a2 for l2; w0, wk, w1 its half-width at the root, the joint and the
     foot. Traced as one smooth outline into the same path as the body, so
     it grows out of the animal instead of lying on it. */
  function legPts(L) {
    var kx = L.sx + Math.cos(L.a1) * L.l1, ky = L.sy + Math.sin(L.a1) * L.l1;
    var tx = kx + Math.cos(L.a2) * L.l2, ty = ky + Math.sin(L.a2) * L.l2;
    return { kx: kx, ky: ky, tx: tx, ty: ty };
  }
  function leg(cc, L) {
    var q = legPts(L), am = (L.a1 + L.a2) / 2;
    function side(x, y, a, w, k) { return [x - Math.sin(a) * w * k, y + Math.cos(a) * w * k]; }
    var pts = [
      side(L.sx, L.sy, L.a1, L.w0, 1), side(q.kx, q.ky, am, L.wk, 1), side(q.tx, q.ty, L.a2, L.w1, 1),
      [q.tx + Math.cos(L.a2) * L.w1 * 1.3, q.ty + Math.sin(L.a2) * L.w1 * 1.3],
      side(q.tx, q.ty, L.a2, L.w1, -1), side(q.kx, q.ky, am, L.wk, -1), side(L.sx, L.sy, L.a1, L.w0, -1),
      [L.sx - Math.cos(L.a1) * L.w0, L.sy - Math.sin(L.a1) * L.w0]
    ];
    /* the same turn as the body's ellipses: a leg wound the other way
       cancels where it overlaps the body (the nonzero rule) and leaves a
       hole at the shoulder */
    var area = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q2 = pts[(i + 1) % pts.length];
      area += p[0] * q2[1] - q2[0] * p[1];
    }
    if (area < 0) pts.reverse();
    smoothClosed(cc, pts);
  }
  /* Inside the silhouette: a soft well where the leg goes under the body,
     and light along the top of it, so it has a round side and a shaded one
     like everything else. */
  function legShade(c, L, well) {
    var q = legPts(L);
    pocket(c, L.sx, L.sy, L.w0 * 1.5, well);
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    /* from partway down the upper leg: begun at the root, inside the body,
       the light ran across the chest as a stripe */
    var ux = L.sx + Math.cos(L.a1) * L.l1 * 0.55, uy = L.sy + Math.sin(L.a1) * L.l1 * 0.55;
    var nx = -Math.sin(L.a2) * L.k, ny = Math.cos(L.a2) * L.k;     // across the leg, outward
    c.strokeStyle = 'rgba(255,244,228,.18)'; c.lineWidth = L.wk * 0.8;
    c.beginPath();
    c.moveTo(ux - nx * L.wk * 0.3, uy - ny * L.wk * 0.3); c.lineTo(q.kx - nx * L.wk * 0.3, q.ky - ny * L.wk * 0.3);
    c.lineTo(q.tx - nx * L.w1 * 0.3, q.ty - ny * L.w1 * 0.3);
    c.stroke();
    c.strokeStyle = 'rgba(30,20,12,.18)'; c.lineWidth = L.wk * 0.6;
    c.beginPath();
    c.moveTo(ux + nx * L.wk * 0.55, uy + ny * L.wk * 0.55); c.lineTo(q.kx + nx * L.wk * 0.55, q.ky + ny * L.wk * 0.55);
    c.lineTo(q.tx + nx * L.w1 * 0.5, q.ty + ny * L.w1 * 0.5);
    c.stroke();
    c.restore();
  }
  /* A cloven hoof on the end of a leg, seen from above: two dark toes side
     by side, lit along their tops, and the dewclaws just behind. */
  function hoof(c, L, S) {
    var q = legPts(L), h = L.hoof;
    c.save();
    c.translate(q.tx, q.ty); c.rotate((L.face === undefined ? L.a2 : L.face) + Math.PI / 2);
    c.fillStyle = S.pawDark;
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.ellipse(k * h * 0.42, -h * 0.25, h * 0.46, h * 0.8, k * 0.12, 0, 6.2832); c.fill();
    });
    c.fillStyle = 'rgba(255,240,220,.22)';
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.ellipse(k * h * 0.42 - h * 0.12, -h * 0.45, h * 0.16, h * 0.4, 0, 0, 6.2832); c.fill();
    });
    c.fillStyle = S.pawDark;
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.ellipse(k * h * 0.55, h * 0.95, h * 0.2, h * 0.24, 0, 0, 6.2832); c.fill();
    });
    c.restore();
  }
  /* A running leg from its root under the body (bx, by) to where the hoof
     is (hx, hy), with a slight bend at the knee or hock (the foreleg's
     knee bends back, the hind leg's hock forward), its hoof facing ahead. */
  function runLegSpec(k, bx, by, hx, hy, w0, w1, hoofR, fore) {
    var dx = hx - bx, dy = hy - by, d = Math.max(2, Math.sqrt(dx * dx + dy * dy)), a = Math.atan2(dy, dx);
    var bend = (fore ? -1 : 1) * k * 0.16 * (dy < 0 ? 1 : -1);
    return { k: k, sx: bx, sy: by, a1: a + bend, l1: d * 0.52, a2: a - bend, l2: d * 0.5,
             w0: w0, wk: (w0 + w1) / 2, w1: w1, hoof: hoofR, face: -Math.PI / 2 };
  }
  /* Drawn under the body: the coat's dark tone, lighter down the side
     the sun is on, and its own outline. */
  function runLeg(c, S, L, tone) {
    c.save();
    c.beginPath(); leg(c, L);
    if (S.outline) { c.strokeStyle = S.outline; c.lineWidth = 2.4; c.lineJoin = 'round'; c.stroke(); }
    c.fillStyle = tone || S.body[2]; c.fill();
    c.clip();
    var q = legPts(L);
    c.strokeStyle = S.body[1]; c.lineCap = 'round'; c.lineWidth = L.wk * 0.9;
    c.beginPath();
    c.moveTo(L.sx - L.k * 0.8, L.sy); c.lineTo(q.kx - L.k * 0.7, q.ky); c.lineTo(q.tx - L.k * 0.5, q.ty);
    c.stroke();
    c.restore();
  }
  /* The musk ox's skirt of guard hair, from above: wider than the body,
     hanging past it on both sides, its edge a run of soft locks that sway
     as it runs, and longest over the flanks. */
  function oxSkirt(cc, o) {
    var pts = [], N = 30, sway = o && !o.still ? (o.gait || 0) : 0;
    for (var i = 0; i < N; i++) {
      var a = i / N * 6.2832, sx = Math.sin(a), cy = -Math.cos(a);
      var rx = 17.5, ry = 26;
      var lock = (i % 2 ? 1.6 : -0.6) + Math.sin(sway + i) * 0.5 * Math.abs(sx);
      var flank = Math.abs(sx) > 0.5 ? 1.5 : 0;
      pts.push([sx * (rx + lock + flank), 7 + cy * (ry + lock * 0.6)]);
    }
    smoothClosed(cc, pts);
  }
  /* A patch of lighter hair: strong in the middle, fading out to nothing,
     never a hard edge. */
  function softPatch(c, x, y, rx, ry, col) {
    c.save();
    c.translate(x, y); c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
    g.addColorStop(0, col);
    g.addColorStop(0.6, col.replace(/[\d.]+\)$/, function (a) { return (parseFloat(a) * 0.6).toFixed(3) + ')'; }));
    g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, rx, 0, 6.2832); c.fill();
    c.restore();
  }

  /* The one thing that separates a flat cut-out from something with a
     body: a soft dark rim on the INSIDE of the outline. Stroke the shape
     several times, thick to thin, with the shape itself as the clip —
     only the inner half of each stroke survives, and the edge rolls away
     from the light instead of stopping dead. */
  /* Rim shading for a shape made of several sub-paths. Stroking the path
     would trace the seams BETWEEN the lumps as well, and the body came out
     looking like a stack of discs; filling a darker copy and then a
     slightly smaller bright one can only ever darken the true outer edge. */
  /* One gradient stretched over a whole animal makes a flat shape with a
     sheen on it. Volume comes from shading each MASS separately: light
     catching the near-top of the skull, of the shoulders, of each paw,
     and each one falling away to a shaded rim of its own. Clipped to the
     silhouette so the masses still read as one creature. */
  function sphere(c, x, y, rx, ry, rot, k) {
    var r = Math.max(rx, ry);
    var g = c.createRadialGradient(x - rx * 0.34, y - ry * 0.36, r * 0.12, x, y, r * 1.22);
    g.addColorStop(0,    'rgba(255,255,255,' + (0.62 * k).toFixed(3) + ')');
    g.addColorStop(0.42, 'rgba(255,255,255,' + (0.14 * k).toFixed(3) + ')');
    g.addColorStop(0.72, 'rgba(96,126,160,0)');
    g.addColorStop(1,    'rgba(88,118,152,' + (0.42 * k).toFixed(3) + ')');
    c.save();
    c.translate(x, y); c.rotate(rot || 0); c.translate(-x, -y);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, rx * 1.16, ry * 1.16, rot || 0, 0, 6.2832); c.fill();
    c.restore();
  }

  function rimShade(c, build, dark, k) {
    /* The ring between the shape and a shrunken copy of it, filled in one
       go with the even-odd rule. The first version punched the inner copy
       out with destination-out, which erased the ANIMAL as well as the
       shade — the body went transparent and the page behind it showed
       through, which is why a black orca came out grey. */
    c.save();
    c.beginPath();
    build(c);                                        // outer
    c.save();
    c.scale(k, k);
    build(c);                                        // inner, same path
    c.restore();
    c.fillStyle = dark;
    c.fill('evenodd');
    c.restore();
  }

  function innerShade(c, build, col, w) {
    c.save();
    c.beginPath(); build(c); c.clip();
    c.strokeStyle = col;
    c.lineJoin = 'round';
    /* Gentle. At full strength this greyed the whole animal out and it
       read as hollow rather than rounded. */
    for (var i = 4; i >= 1; i--) {
      c.globalAlpha = 0.055;
      c.lineWidth = w * i * 0.5;
      c.beginPath(); build(c); c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();
  }

  /* A soft dark well where a limb disappears under the body. Without these
     the legs read as shapes laid on top rather than joints. */
  function pocket(c, x, y, r, col) {
    var g = c.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }

  /* Overlapping ellipses give a lumpy outline — every lump shows as a
     bulge and the animal reads as a bag of balls. A real contour is one
     flowing line, so these two are traced as a list of points and drawn
     as a smooth closed curve through them. Only half the points are
     written: the other side is the mirror, which is also how you keep a
     creature from drifting lopsided. */
  function smoothClosed(c, pts) {
    var n = pts.length, i, p, q;
    c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (i = 0; i < n; i++) {
      p = pts[i]; q = pts[(i + 1) % n];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.closePath();
  }
  function mirrored(half) {
    var out = half.slice(), i;
    for (i = half.length - 2; i >= 1; i--) out.push([-half[i][0], half[i][1]]);
    return out;
  }

  function oneSilhouette(c, S, build, fill) {
    c.beginPath(); build(c);
    if (S.outline) {                                  // outer edge only
      c.save();
      /* A pale animal on pale ice has almost no contrast — in the painting
         this was copied from, the ice is a saturated blue and the white
         reads against it. Ours is a light chute, so the white ones carry a
         heavier line to hold their shape at the size they are played at. */
      c.strokeStyle = S.outline;
      c.lineWidth = S.heavyLine ? 5.2 : 3.6;
      c.lineJoin = 'round';
      c.stroke();
      c.restore();
    }
    c.fillStyle = fill;
    c.beginPath(); build(c); c.fill();
  }

  /* four paws, used by everything that is not a bird */
  function paws(c, S, ang, wag, fx, fy, fr, bx, by, br) {
    [-1, 1].forEach(function (k) {
      c.save();
      c.translate(k * fx, fy);
      c.rotate(k * (0.5 + wag) - ang * 0.3 * k);
      c.fillStyle = S.paw || S.flipper[1];
      c.beginPath(); c.ellipse(0, 0, fr, fr * 1.5, k * 0.3, 0, 6.2832); c.fill();
      if (edge(c, S, 1.8)) c.stroke();
      if (S.claw) toes(c, k, fr, S.pawDark || S.flipper[2], S.claw);
      c.restore();
      c.save();
      c.translate(k * bx, by);
      c.rotate(k * 0.35);
      c.fillStyle = S.pawDark || S.flipper[2];
      c.beginPath(); c.ellipse(0, 0, br, br * 1.4, k * 0.2, 0, 6.2832); c.fill();
      if (edge(c, S, 1.8)) c.stroke();
      c.restore();
    });
  }

  /* Sprawled flat, seen from straight above. The thing that was wrong
     before was the face: from up here you are looking at the top of a
     skull, so there are no eyes to draw. What reads instead is the
     outline, four legs thrown out to the sides, and dark pads and a
     dark nose as the only strong marks on all that white. */
  /* Sprawled flat, straight down on top of him. There are no eyes up
     here — you are looking at the crown of a skull — so what has to do
     the work is the outline, four legs thrown out wide, and the dark
     pads and nose, which are the only strong marks on all that white. */
  /* Sprawled flat, straight down on top of him. There are no eyes up here
     — you are looking at the crown of a skull — so the work is done by the
     outline, four legs thrown wide, and the dark pads and nose, which are
     the only strong marks on all that white. */
  function bodyWalrus(c, S, ang, wag, o) {
    /* (a walrus is all but hairless: thick, creased skin, no fur fringe) */
    [-1, 1].forEach(function (k) {                    // broad front flippers
      c.save();
      c.translate(k * 20, 2);
      c.rotate(k * (0.72 + swing(o, k > 0 ? 0 : Math.PI, 0.19)) - ang * 0.3 * k);
      c.fillStyle = S.flipper[1];
      c.beginPath();
      c.moveTo(0, -9);
      c.quadraticCurveTo(k * 24, -2, k * 20, 15);
      c.quadraticCurveTo(k * 9, 10, 0, 10);
      c.closePath(); c.fill();
      c.restore();
    });
    /* the hind flippers: two broad webbed fans held together behind it,
       sweeping from side to side as one (they were two dark balls) */
    var sw2 = o.still ? 0 : swing(o, 0.6, 0.2) - ang * 0.2;
    c.save();
    c.translate(0, 22); c.rotate(sw2);
    [-1, 1].forEach(function (k) {
      c.save();
      c.translate(k * 5, 0); c.rotate(k * 0.22);
      var fg = c.createLinearGradient(0, 0, 0, 22);
      fg.addColorStop(0, S.body[2]); fg.addColorStop(1, S.flipper[1]);
      c.fillStyle = fg;
      c.beginPath();
      c.moveTo(-k * 3, 0);
      c.quadraticCurveTo(-k * 6, 10, -k * 7.5, 20);
      c.quadraticCurveTo(-k * 4, 23, -k * 1.5, 20.5);
      c.quadraticCurveTo(k * 1, 23.5, k * 3.5, 20.8);
      c.quadraticCurveTo(k * 6.5, 23, k * 9.5, 19.5);
      c.quadraticCurveTo(k * 8, 9, k * 5, 0);
      c.closePath(); c.fill();
      if (edge(c, S, 1.6)) c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.9;
      [-4.5, -1.5, 1.8, 5].forEach(function (dx) {
        c.beginPath(); c.moveTo(k * dx * 0.3, 3); c.lineTo(k * dx * 1.05, 19.5); c.stroke();
      });
      c.restore();
    });
    c.restore();
    var bg = c.createRadialGradient(-8, -12, 5, 0, 0, 36);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    c.beginPath();                                    // bulky, tapering to the tail
    c.moveTo(0, -18);
    c.bezierCurveTo(19, -21, 25, -6, 23, 9);
    c.bezierCurveTo(21, 23, 11, 28, 0, 28);
    c.bezierCurveTo(-11, 28, -21, 23, -23, 9);
    c.bezierCurveTo(-25, -6, -19, -21, 0, -18);
    c.closePath(); c.fill();
    if (edge(c, S, 2)) c.stroke();
    crease(c, 0, -13, 15, 6, 0.16);                   // fold behind the head
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -23, 16, 12, 0, 0, 6.2832); c.fill();
    sheen(c, -9, -4, 9, 15, -0.2, 0.16);
    /* the tusks, from the upper jaw under the moustache: they point down
       and a little forward, so from above only their lower halves show,
       foreshortened, coming out from under the front of the whisker pad */
    [-1, 1].forEach(function (k) {
      var tg2 = c.createLinearGradient(k * 2, 0, k * 8, 0);
      tg2.addColorStop(0, '#d9cfb6'); tg2.addColorStop(0.5, '#fbf8ee'); tg2.addColorStop(1, '#cfc4a8');
      c.fillStyle = tg2;
      c.beginPath();
      c.moveTo(k * 2.4, -33);
      c.quadraticCurveTo(k * 2.6, -45, k * 2.3, -53);
      c.quadraticCurveTo(k * 3.6, -50, k * 5.4, -33);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(120,100,70,.55)'; c.lineWidth = 0.7; c.stroke();
    });
    c.fillStyle = S.mark;                             // the great whiskery pad
    c.beginPath(); c.ellipse(0, -31, 12, 9, 0, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.1;
    [-1, 1].forEach(function (k) {
      for (var w = 0; w < 3; w++) {
        c.beginPath();
        c.moveTo(k * 4, -31 + w * 3);
        c.lineTo(k * (13 + w * 2), -34 + w * 4);
        c.stroke();
      }
    });
    eyes(c, -26, 11, 0, 1.8);                         // small, sunk in the fat
    /* thick folds of skin across the neck and shoulders, uneven */
    c.lineCap = 'round';
    [[-14, -8, 12, -10, 0.24], [-16, -2, 14, -3, 0.2], [-12, 4, 6, 5, 0.14], [-6, 9, 13, 8, 0.12]].forEach(function (f) {
      c.strokeStyle = 'rgba(70,40,28,' + f[4] + ')'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(f[0], f[1]); c.quadraticCurveTo((f[0] + f[2]) / 2, f[1] + 4, f[2], f[3]); c.stroke();
      c.strokeStyle = 'rgba(255,220,200,' + (f[4] * 0.6).toFixed(3) + ')'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(f[0], f[1] - 1.4); c.quadraticCurveTo((f[0] + f[2]) / 2, f[1] + 2.6, f[2], f[3] - 1.4); c.stroke();
    });
    /* the nostrils: two slits on top of the muzzle, not a dark blob */
    c.fillStyle = S.nose;
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.ellipse(k * 1.9, -34.5, 1.5, 0.9, k * 0.5, 0, 6.2832); c.fill();
    });
    if (DETAIL) {
      /* close up: the bristly moustache pads, a dot for every whisker, and
         the nose's nostrils */
      c.fillStyle = 'rgba(70,40,24,.5)';
      [-1, 1].forEach(function (k) {
        for (var wr = 0; wr < 3; wr++) for (var wc = 0; wc < 4; wc++) {
          c.beginPath(); c.arc(k * (4.4 + wc * 1.7), -31.6 + wr * 1.7 + wc * 0.2, 0.32, 0, 6.2832); c.fill();
        }
      });
      c.fillStyle = 'rgba(0,0,0,.55)';
      [-1, 1].forEach(function (k) { c.beginPath(); c.ellipse(k * 1.4, -35.4, 0.7, 0.45, k * 0.6, 0, 6.2832); c.fill(); });
      c.fillStyle = 'rgba(255,255,255,.28)';
      c.beginPath(); c.ellipse(-0.8, -36.6, 1.4, 0.5, 0, 0, 6.2832); c.fill();
    }
  }

  function bodySeal(c, S, ang, wag, o) {
    /* a sea otter has no front flippers: its forearms are on its chest */
    if (!S.paws) [-1, 1].forEach(function (k) {       // little front flippers
      c.save();
      c.translate(k * 15, 0);
      c.rotate(k * (0.62 + swing(o, k > 0 ? 0 : Math.PI, 0.2)) - ang * 0.3 * k);
      c.fillStyle = S.flipper[1];
      c.beginPath(); c.ellipse(0, 2, 6.5, 12, k * 0.35, 0, 6.2832); c.fill();
      c.restore();
    });
    /* The hind flippers, as a seal's really are: held together behind it,
       pointing back, two broad webbed fans side by side with the digits
       showing as ridges, the body's own colour a shade darker; they sweep
       from side to side together as it undulates. They were two dark blades
       splayed in a V, apart from each other and from the seal. A sea otter
       (on its back) holds its big webbed hind feet up the same way, with
       the flat tail between them. */
    var sweep = o.still ? 0 : swing(o, 0, 0.22) - ang * 0.25;
    c.save();
    c.translate(0, 22);
    c.rotate(sweep);
    if (S.paws) {                                     // the otter's flat tail
      c.fillStyle = S.flipper[1];
      c.beginPath(); c.ellipse(0, 14, 4.2, 11, 0, 0, 6.2832); c.fill();
      if (edge(c, S, 1.4)) c.stroke();
    }
    [-1, 1].forEach(function (k) {
      c.save();
      c.translate(k * (S.paws ? 6.5 : 3.2), 0);
      c.rotate(k * (S.paws ? 0.32 : 0.1) + (o.still ? 0 : k * swing(o, 1.4, 0.06)));
      var fg = c.createLinearGradient(0, 0, 0, 20);
      fg.addColorStop(0, S.body[2]); fg.addColorStop(1, S.flipper[1]);
      c.fillStyle = fg;
      c.beginPath();
      c.moveTo(-k * 1.5, 0);
      c.quadraticCurveTo(-k * 3.5, 9, -k * 4.8, 18);
      c.quadraticCurveTo(-k * 2.6, 20.5, -k * 0.9, 18.6);
      c.quadraticCurveTo(k * 0.6, 21.2, k * 2.2, 18.8);
      c.quadraticCurveTo(k * 4.2, 21, k * 6.4, 17.8);
      c.quadraticCurveTo(k * 5.2, 8, k * 3.4, 0);
      c.closePath(); c.fill();
      if (edge(c, S, 1.4)) c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.8;            // the digits
      [-3, -0.9, 1.2, 3.6].forEach(function (dx, di) {
        c.beginPath(); c.moveTo(k * dx * 0.3, 3); c.lineTo(k * dx, 17 + (di % 2)); c.stroke();
      });
      c.restore();
    });
    c.restore();
    var bg = c.createRadialGradient(-7, -12, 4, 0, 0, 32);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    c.beginPath();                                    // sleek and tapered
    c.moveTo(0, -24);
    c.bezierCurveTo(13, -26, 18, -10, 17, 6);
    c.bezierCurveTo(16, 20, 9, 27, 0, 27);
    c.bezierCurveTo(-9, 27, -16, 20, -17, 6);
    c.bezierCurveTo(-18, -10, -13, -26, 0, -24);
    c.closePath(); c.fill();
    if (edge(c, S, 2)) c.stroke();
    sheen(c, -5, 2, 6, 18, -0.1, 0.1);                // wet, not furry
    c.fillStyle = 'rgba(0,0,0,.14)';                  // the seal's dappled back
    if (!S.paws) [[-7, -6], [6, -2], [-3, 8], [8, 12], [-8, 15]].forEach(function (q) {
      c.beginPath(); c.ellipse(q[0], q[1], 3.4, 2.6, 0.3, 0, 6.2832); c.fill();
    });
    if (S.paws) {
      /* A sea otter floats on its back with its forepaws on its chest, and
         that is how it rides the hill: short furred forearms coming in from
         the sides, the small dark paws at their ends holding a clam to its
         chest (they were two dark ovals on their own, which read as eyes) */
      var pw = o.still ? 0 : swing(o, 0.5, 0.6);
      c.fillStyle = '#efe6d6';                        // the clam
      c.beginPath(); c.ellipse(0, -11 + pw * 0.3, 4.6, 3.6, 0, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(120,100,80,.6)'; c.lineWidth = 0.6;
      for (var cr = -2; cr <= 2; cr++) {
        c.beginPath(); c.moveTo(cr * 1.4, -8 + pw * 0.3); c.lineTo(cr * 0.5, -13.6 + pw * 0.3); c.stroke();
      }
      [-1, 1].forEach(function (k) {
        var px2 = k * 4.6, py2 = -11.5 + pw * (k > 0 ? 0.6 : -0.6);
        c.lineCap = 'round';
        c.strokeStyle = S.outline || S.body[2]; c.lineWidth = 6.4;
        c.beginPath(); c.moveTo(k * 14, -4); c.quadraticCurveTo(k * 11, -12, px2 + k * 1.5, py2); c.stroke();
        c.strokeStyle = S.body[1]; c.lineWidth = 5;
        c.beginPath(); c.moveTo(k * 14, -4); c.quadraticCurveTo(k * 11, -12, px2 + k * 1.5, py2); c.stroke();
        c.fillStyle = S.paws;
        c.beginPath(); c.ellipse(px2, py2, 2.8, 2.4, k * 0.5, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 0.5;    // the folded digits
        for (var dg = -1; dg <= 1; dg++) {
          c.beginPath(); c.moveTo(px2 - k * 1.6, py2 + dg * 0.9); c.lineTo(px2 - k * 0.2, py2 + dg * 1.1); c.stroke();
        }
      });
    }
    crease(c, 0, -19, 11, 5, 0.14);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -28, 13, 12, 0, 0, 6.2832); c.fill();
    if (edge(c, S, 1.8)) c.stroke();
    if (S.paws) {
      /* a sea otter's head is pale, grizzled cream, the brown of the body
         ending at the neck */
      c.save();
      c.beginPath(); c.ellipse(0, -28, 13, 12, 0, 0, 6.2832); c.clip();
      softPatch(c, 0, -30, 13, 11, 'rgba(232,214,188,.85)');
      c.fillStyle = 'rgba(255,255,255,.25)';
      for (var gz = 0; gz < 14; gz++) {
        var ga = gz * 2.4, gr = 3 + (gz % 4) * 2.2;
        c.beginPath(); c.ellipse(Math.cos(ga) * gr, -29 + Math.sin(ga) * gr * 0.8, 0.5, 1.4, ga, 0, 6.2832); c.fill();
      }
      c.restore();
    }
    sheen(c, -4, -32, 6, 4.5, -0.4, 0.18);
    c.fillStyle = S.mark;
    c.beginPath(); c.ellipse(0, -36, 7, 5.5, 0, 0, 6.2832); c.fill();
    if (DETAIL) {
      /* close up: whisker pads either side, dotted where the whiskers grow,
         two V-shaped nostrils and the line of the mouth */
      [-1, 1].forEach(function (k) {
        c.fillStyle = 'rgba(255,255,255,.22)';
        c.beginPath(); c.ellipse(k * 3.4, -35.5, 3.6, 2.8, 0, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(40,50,60,.45)';
        for (var wd = 0; wd < 6; wd++)
          { c.beginPath(); c.arc(k * (2 + (wd % 3) * 1.5), -36.6 + Math.floor(wd / 3) * 1.6, 0.32, 0, 6.2832); c.fill(); }
      });
      c.fillStyle = S.nose;
      c.beginPath(); c.ellipse(0, -39.2, 3.3, 2.5, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.ellipse(-1, -40.2, 1.2, 0.6, -0.3, 0, 6.2832); c.fill();
      c.strokeStyle = '#0d1014'; c.lineWidth = 0.6;
      [-1, 1].forEach(function (k) {
        c.beginPath(); c.moveTo(k * 0.6, -39.6); c.lineTo(k * 1.8, -38.4); c.lineTo(k * 2.2, -39.8); c.stroke();
      });
      c.strokeStyle = 'rgba(30,38,46,.55)'; c.lineWidth = 0.55;
      c.beginPath(); c.moveTo(0, -37.4); c.lineTo(0, -34.6); c.moveTo(-2.4, -33.6); c.quadraticCurveTo(0, -32.4, 2.4, -33.6); c.stroke();
    } else {
      c.fillStyle = S.nose;
      c.beginPath(); c.ellipse(0, -39, 3.2, 2.6, 0, 0, 6.2832); c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.1;
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.moveTo(k * 3.5, -37); c.lineTo(k * 15, -41); c.stroke();
      c.beginPath(); c.moveTo(k * 3.5, -35); c.lineTo(k * 15, -35); c.stroke();
      c.beginPath(); c.moveTo(k * 3.5, -33); c.lineTo(k * 13, -29); c.stroke();
    });
    sheen(c, -6, -8, 7, 13, -0.2, 0.12);
    /* The eyes are the whole animal — big, black and wet. */
    eyes(c, -31, 6.6, 0, 2.9);
    sheen(c, 0, -22, 9, 4, 0, 0.16);
  }

  /* ---- reindeer ------------------------------------------------
     The antlers do all the work. Nothing else in the set has anything
     like that shape from above, so he is identifiable in a glance even
     at the size he is actually drawn. */
  /* A beam of tapering segments with tines off it. Built out of round
     lumps it came out as a bunch of grapes; antlers are made of straight
     runs that fork. */
  function beam(cc, pts, w0, w1) {
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var t = i / Math.max(1, pts.length - 2);
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      var len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      lump(cc, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
           len * 0.56, w0 + (w1 - w0) * t, ang);
    }
  }
  /* Which headgear the reindeer body is wearing: antlers, or the musk
     ox's horns — a heavy boss across the brow, each horn sweeping out and
     down past the cheek. Set by bodyReindeer before it builds. */
  var hornKind = 'deer';
  function antler(cc, k) {
    if (hornKind === 'ox') {
      /* one smooth horn: the boss broad across the brow, then the horn
         sweeping down past the cheek, narrowing, its tip hooking out and
         up — a tapered band traced as a single outline, not a chain of
         beads, which read as a cloud */
      var spine = [[k * 0.5, -39.5], [k * 7, -41.5], [k * 14, -40], [k * 19, -35.5], [k * 20.5, -29], [k * 18.5, -24], [k * 21.5, -21]];
      var wid = [4.4, 4.6, 4.2, 3.4, 2.6, 1.8, 0.8];
      var L = [], R = [];
      for (var i = 0; i < spine.length; i++) {
        var p0 = spine[Math.max(0, i - 1)], p1 = spine[Math.min(spine.length - 1, i + 1)];
        var dx = p1[0] - p0[0], dy = p1[1] - p0[1], dl = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / dl, ny = dx / dl;
        L.push([spine[i][0] + nx * wid[i], spine[i][1] + ny * wid[i]]);
        R.push([spine[i][0] - nx * wid[i], spine[i][1] - ny * wid[i]]);
      }
      var outl = L.concat(R.reverse());
      var area = 0;
      for (i = 0; i < outl.length; i++) {
        var q1 = outl[i], q2 = outl[(i + 1) % outl.length];
        area += q1[0] * q2[1] - q2[0] * q1[1];
      }
      if (area < 0) outl.reverse();
      smoothClosed(cc, outl);
      return;
    }
    var main = [[k * 6, -37], [k * 12, -46], [k * 21, -48], [k * 28, -43], [k * 32, -35]];
    beam(cc, main, 3.6, 2.2);
    beam(cc, [[k * 11, -45], [k * 9, -54], [k * 11, -61]], 2.6, 1.6);   // brow tine
    beam(cc, [[k * 20, -48], [k * 23, -58], [k * 28, -63]], 2.4, 1.5);  // second
    beam(cc, [[k * 28, -43], [k * 37, -46], [k * 42, -41]], 2.2, 1.4);  // and the top
  }

  function bodyReindeer(c, S, ang, wag, o) {
    hornKind = S.horns ? 'ox' : 'deer';
    var ox = !!S.horns;
    /* Up on its legs and running, the way a deer or a musk ox goes down a
       hill — not lying on its belly with its legs thrown out, which is how
       it was drawn, and read as a rug sliding on the ice. From straight
       above you see its back; the legs are under the body, in its shadow,
       and show only where they reach out ahead of the chest and out behind
       the rump. A gallop: the forelegs reach forward together while the
       hind legs drive back (the stretched moment, the body long), then all
       four gather under it (the body short), the lead leg a beat ahead of
       the other. The hooves always point ahead. In the air it stretches out
       as a deer leaps; standing still (a portrait) it stands square. A musk
       ox is all hair and short legs: a heavier, shorter stride, hooves just
       showing out of the skirt. */
    var P = Math.PI, gait = o.gait || 0, lift = o.lift || 0;
    var reach = ox ? 11 : 21, back = ox ? 11 : 21;
    function stride(off) {
      if (o.still) return 0.15;
      if (lift > 0.05) return Math.min(1, 0.4 + lift * 1.2);     // stretched out in the leap
      /* stance is slower than swing: the hoof is planted and goes back
         with the ground for longer than it takes to come forward */
      var a = gait + off;
      return Math.cos(a + 0.3 * Math.sin(a));
    }
    var LEGS = [];
    [-1, 1].forEach(function (k) {
      var fc = stride(k > 0 ? 0.45 : 0), hc = stride(k > 0 ? 0.6 : 0.15);
      var fx = k * (ox ? 11 : 10), hx = k * (ox ? 10.5 : 9.5);
      LEGS.push(runLegSpec(k, fx, -12, fx + k * 1.6, -14 - reach * (0.5 + 0.5 * fc), ox ? 4.8 : 4.2, ox ? 3.4 : 2.5, ox ? 3 : 2.7, true));
      LEGS.push(runLegSpec(k, hx, 22, hx + k * 1.4, 26 + back * (0.5 + 0.5 * hc), ox ? 5.2 : 4.8, ox ? 3.4 : 2.6, ox ? 3 : 2.8, false));
    });
    /* the back flexes with the stride: long when it is stretched out,
       short when it gathers, and it rises a little at each push */
    var flex = o.still ? 0 : (lift > 0.05 ? 0.05 : 0.045 * stride(0.3));
    var narrow = ox ? 1 : 0.84;                      // standing, it is narrower than lying flat
    function build(cc) {
      antler(cc,  1);
      antler(cc, -1);
      cc.save(); cc.scale(1, 1 + flex);
      lump(cc, 0, -34, 8.5, 8, 0);                   // skull
      lump(cc, 0, -42, 5.6, 7, 0);                   // long muzzle
      wedge(cc, 8, -33, 13, -30, 4);                 // ears, low and sideways
      wedge(cc, -8, -33, -13, -30, 4);
      lump(cc, 0, -24, 9 * narrow, 10, 0);           // neck
      lump(cc, 0, -10, 15 * narrow, 15, 0);          // chest
      lump(cc, 0, 8, 14.5 * narrow, 18, 0);          // barrel
      lump(cc, 0, 26, 13.5 * narrow, 13, 0);         // haunches
      if (!ox) lump(cc, 0, 37, 3, 3.8, 0);           // the short tail
      cc.restore();
      if (ox) oxSkirt(cc, o);
    }
    /* the legs first, under the body and darker in its shadow */
    LEGS.forEach(function (L) { runLeg(c, S, L, ox ? S.mark : null); });
    LEGS.forEach(function (L) { hoof(c, L, S); });

    var bg = c.createLinearGradient(-16, -40, 18, 38);
    bg.addColorStop(0, S.bodyTop || '#b78d66');
    bg.addColorStop(0.5, S.body[1]);
    bg.addColorStop(1, S.body[2]);
    oneSilhouette(c, S, build, bg);

    c.save();
    c.beginPath(); build(c); c.clip();
    sphere(c, 0, 4, 15, 30, 0, 0.8);                 // one back, not a set of muscles
    sphere(c, 0, -34, 9, 9, 0, 0.95);                // skull
    sphere(c, 0, -42, 5.6, 7, 0, 0.8);
    /* where the legs go under: a soft shadow along the belly's edge */
    LEGS.forEach(function (L) { pocket(c, L.sx, L.sy, 7, 'rgba(40,26,16,.22)'); });
    /* The pale rump and the pale throat a reindeer has, as hair that
       lightens, not as two stickers: soft-edged, with the coat's own grain
       running through them. */
    softPatch(c, 0, 32, 10, 8, ox ? 'rgba(232,220,200,.5)' : 'rgba(236,224,204,.7)');
    softPatch(c, 0, -25, 7.5, 6.5, 'rgba(232,220,200,.6)');
    if (!ox) softPatch(c, 0, 37.5, 3, 3.6, 'rgba(248,242,232,.85)');
    c.restore();


    if (ox) {
      /* The coat a musk ox is known for, as it really looks: long guard
         hair falling from the spine down over the flanks in a heavy skirt,
         lying in long soft locks that sway as it runs — light on the top of
         each lock, shade between them — and the pale saddle in the middle
         of the back. It was drawn as a comb of separate dark strands
         sticking out of the sides, which looked like nothing that grows. */
      c.save();
      c.beginPath(); oxSkirt(c, o); c.clip();
      c.lineCap = 'round';
      /* many fine, long, uneven strands, parted along the spine and falling
         back and out over the flanks: a texture, not a row of ribs */
      for (var li = 0; li < 64; li++) {
        var side = li % 2 ? 1 : -1;
        var j = strandJit(li * 7 + 3, 5), j2 = strandJit(li * 13 + 1, 7);
        var ly = -18 + (li >> 1) * 1.45 + j2 * 1.2;
        var x0 = side * (1.5 + j * 2.5);
        var x1 = side * (13 + j2 * 6), y1 = ly + 14 + j * 8;
        var sway = o.still ? 0 : Math.sin((o.gait || 0) + ly * 0.12) * 1.2;
        c.strokeStyle = li % 3 === 0 ? 'rgba(200,170,140,.10)' : 'rgba(14,9,5,.12)';
        c.lineWidth = 0.9 + j * 1.3;
        c.beginPath(); c.moveTo(x0, ly);
        c.bezierCurveTo(side * (4 + j * 3), ly + 2, side * (10 + j2 * 3), ly + 6 + j * 3, x1 + sway, y1);
        c.stroke();
      }
      /* the saddle: paler, creamy-brown hair over the middle of the back */
      softPatch(c, 0, 4, 8, 10, 'rgba(196,168,132,.7)');
      /* the hump over the shoulders catching the light */
      softPatch(c, -2, -11, 9, 7, 'rgba(255,236,210,.16)');
      c.restore();
    }
    c.fillStyle = S.antler;                          // the antlers, lit on top
    c.globalAlpha = 0.34;
    [-1, 1].forEach(function (k) {
      c.beginPath(); antler(c, k); c.fill();
    });
    c.globalAlpha = 1;

    c.fillStyle = S.mark;                            // muzzle
    c.beginPath(); c.ellipse(0, -45, 5, 5.6, 0, 0, 6.2832); c.fill();
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, -49, 3.2, 2.6, 0, 0, 6.2832); c.fill();
    if (DETAIL) {                                    // close up: nostrils, a wet light
      c.fillStyle = 'rgba(0,0,0,.55)';
      [-1, 1].forEach(function (k) { c.beginPath(); c.ellipse(k * 1.4, -48.4, 0.7, 0.45, k * 0.5, 0, 6.2832); c.fill(); });
      c.fillStyle = 'rgba(255,255,255,.3)';
      c.beginPath(); c.ellipse(-0.6, -50, 1.2, 0.5, 0, 0, 6.2832); c.fill();
    }
    eyes(c, -38, 6.4, 0, 2, '#20160f');
  }

  /* ---- orca ------------------------------------------------------
     Glossy black with white patches: the strongest contrast in the set,
     and the one silhouette with no legs at all. */
  function bodyOrca(c, S, ang, wag, o) {
    var fa = 0.5 + swing(o, 0, 0.16) - ang * 0.3;
    /* She has nothing to paddle with, so the tail does the work: the beat
       runs from the peduncle out to the flukes, a little behind it. */
    var tw = swing(o, 0, 0.3);
    var tw2 = swing(o, -0.7, 0.34);
    function build(cc) {
      lump(cc, 0, -34, 9, 11, 0);                    // blunt head
      lump(cc, 0, -18, 14, 16, 0);                   // shoulders
      lump(cc, 0, 2, 15, 22, 0);                     // the great barrel
      lump(cc, 0, 24, 10, 14, 0);                    // tail stock
      lump(cc, tw * 9, 38, 5, 9, tw);                // peduncle
      lump(cc,  10 + tw2 * 11, 47, 9, 5, 0.5 + tw2); // flukes, trailing the beat
      lump(cc, -10 + tw2 * 11, 47, 9, 5, -0.5 + tw2);
      /* pectoral flippers: an orca's big round paddles; a narwhal's
         small, with the tips turned up */
      var fl = S.mottle ? 13 : 19, fw = S.mottle ? 5 : 7;
      limb(cc,  14, -8,  0.62 + fa * 0.1 + swing(o, 0, 0.1), fl, fw);
      limb(cc, -14, -8,  2.52 - fa * 0.1 - swing(o, Math.PI, 0.1), fl, fw);
      if (!S.mottle) lump(cc, 0, 6, 6, 13, 0);       // the dorsal, edge on
    }

    var bg = c.createLinearGradient(-14, -40, 16, 46);
    /* Taken from the skin rather than written in here. It was hardcoded to
       the orca's own black, which meant anything else sharing this body —
       a narwhal, say — came out an orca in a different name. */
    bg.addColorStop(0, S.body[0]);
    bg.addColorStop(0.4, S.body[1]);
    bg.addColorStop(1, S.body[2]);
    oneSilhouette(c, S, build, bg);

    c.save();
    c.beginPath(); build(c); c.clip();
    sphere(c, 0, -4, 15, 34, 0, 0.22);           // a wet gleam, not a grey wash
    sphere(c, 0, -33, 9, 11, 0, 0.26);
    if (S.mottle) {
      /* A narwhal is not an orca in grey: its back is dark and broken up
         with blotches that thin out and pale towards the flanks, and it
         has no patches round the eyes and no saddle. */
      var MOT = [[-4,-26,2.6],[3,-22,2.2],[-7,-16,2.8],[6,-12,3],[0,-8,2.4],[-9,-4,2.2],
                 [8,0,2.6],[-3,2,3.2],[4,8,2.4],[-8,10,2.6],[9,14,2],[0,16,2.8],
                 [-5,22,2.2],[5,24,2.4],[0,30,2],[-2,-15,1.8],[2,-1,1.6],[-11,6,1.6],[11,-6,1.6]];
      MOT.forEach(function (m) {
        var far = Math.min(1, Math.abs(m[0]) / 12);
        c.fillStyle = S.mottle;
        c.globalAlpha = 0.62 - far * 0.32;
        c.beginPath(); c.ellipse(m[0], m[1], m[2], m[2] * 0.75, m[0] * 0.1, 0, 6.2832); c.fill();
      });
      c.globalAlpha = 1;
    } else {
      /* the eye patches: long white ovals on the sides of the head, behind
         and above the eye, swept back along the body (the white chin is
         underneath and does not show from up here) */
      c.fillStyle = S.mark;
      [-1, 1].forEach(function (k) {
        c.save();
        c.translate(k * 7, -29); c.rotate(-k * 0.18);
        c.beginPath(); c.ellipse(0, 0, 2.6, 6.4, 0, 0, 6.2832); c.fill();
        c.restore();
      });
      /* the saddle behind the dorsal: a pale grey band across the back,
         soft at its edges */
      softPatch(c, 0, 18, 12, 5.5, 'rgba(188,200,212,.75)');
    }
    c.fillStyle = 'rgba(255,255,255,.2)';            // wet shine down the back
    c.beginPath(); c.ellipse(-5, -6, 4.5, 26, -0.04, 0, 6.2832); c.fill();
    if (!S.mottle) {
      /* the dorsal stands up, so from here it is a hard-edged blade */
      c.fillStyle = 'rgba(0,0,0,.45)';
      c.beginPath(); c.ellipse(1.5, 6, 4.5, 13, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(120,140,164,.5)';
      c.beginPath(); c.ellipse(-1.5, 6, 2.2, 12, 0, 0, 6.2832); c.fill();
    } else {
      /* a narwhal has no fin, only a low ridge along the back: a line of
         light, not a slot */
      c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-0.6, 4); c.quadraticCurveTo(-1, 14, -0.4, 24); c.stroke();
    }
    c.fillStyle = S.nose;                            // the blowhole on top of the head
    c.beginPath(); c.ellipse(0, -27, 1.8, 0.8, 0, 0, 6.2832); c.fill();
    c.restore();

    /* a whale's eyes are small and low on the sides of the head: from
       above they show only at its edges (they sat on the crown, staring
       up, like a cartoon's) */
    eyes(c, -35, 8.2, 0, 1.05, '#05080c');
  
    /* The penguin body calls this from inside itself, so anything on
       another body got no accessory at all — which is why the narwhal
       turned up without the one thing that makes it a narwhal. */
    drawSkinExtra(c, S);
}

  /* ---- the three that run on four soft feet ---------------------
     Each one up on its legs and moving the way the real animal does, the
     legs under the body and in its shadow, showing where they reach out
     ahead and behind; the feet are paws (a hare's long furred hind feet,
     a cat's broad round ones, a lemming's tiny ones), always facing ahead.
     They used to share one body lying on its belly, with paws stuck on
     beside it and the hare's ears pointing forward over its eyes. */

  /* A paw on the end of a leg, seen from above, facing ahead: a furred
     oval (long for a hare's hind foot), toes as soft bumps along the
     front, a little light on top. */
  function pawTop(c, L, S, len, wid, col, toes) {
    var q = legPts(L);
    c.save();
    c.translate(q.tx, q.ty);
    c.rotate(L.face === undefined ? L.a2 + Math.PI / 2 : L.face + Math.PI / 2);
    c.fillStyle = col;
    c.beginPath(); c.ellipse(0, len * 0.15, wid, len * 0.62, 0, 0, 6.2832); c.fill();
    if (S.outline) { c.strokeStyle = S.outline; c.lineWidth = 1.1; c.stroke(); }
    if (toes) {
      c.strokeStyle = 'rgba(40,30,24,.35)'; c.lineWidth = 0.7;
      for (var t = -1; t <= 1; t++) {
        c.beginPath(); c.moveTo(t * wid * 0.45, -len * 0.42); c.lineTo(t * wid * 0.42, -len * 0.2); c.stroke();
      }
    }
    c.fillStyle = 'rgba(255,255,255,.22)';
    c.beginPath(); c.ellipse(-wid * 0.3, -len * 0.05, wid * 0.35, len * 0.3, 0, 0, 6.2832); c.fill();
    c.restore();
  }
  /* soft fur lying back along a body, clipped to it */
  function furStrokes(c, build, x0, x1, y0, y1, light, dark) {
    c.save();
    c.beginPath(); build(c); c.clip();
    c.lineWidth = 0.9; c.lineCap = 'round';
    for (var fy = y0; fy <= y1; fy += 4.2) {
      for (var fx = x0; fx <= x1; fx += 4.6) {
        var jx = fx + ((fy * 7 + fx * 3) % 5) * 0.5, jy = fy + ((fx * 5) % 3) * 0.6, tilt = jx * 0.06;
        c.strokeStyle = light;
        c.beginPath(); c.moveTo(jx, jy); c.lineTo(jx + tilt * 3, jy + 3.2); c.stroke();
        c.strokeStyle = dark;
        c.beginPath(); c.moveTo(jx + 0.9, jy + 0.5); c.lineTo(jx + 0.9 + tilt * 3, jy + 3.7); c.stroke();
      }
    }
    c.restore();
  }
  /* an eye on the side of the head, seen from above: a dark dome with a
     pale rim and a light in it (hares and lemmings have them high on the
     sides, so from up here they show at the edges of the skull) */
  function sideEyes(c, x, y, r, rim) {
    var E = eyeState();
    [-1, 1].forEach(function (k) {
      var ex = k * x;
      if (rim) {
        c.fillStyle = rim;
        c.beginPath(); c.ellipse(ex, y, r * 1.4 * E.wide, r * 1.25 * E.wide, k * 0.3, 0, 6.2832); c.fill();
      }
      if (E.shut < 0.3) {
        c.strokeStyle = '#1f1812'; c.lineWidth = Math.max(0.8, r * 0.4);
        c.beginPath(); c.moveTo(ex - r, y); c.lineTo(ex + r, y + 0.2); c.stroke();
        return;
      }
      c.fillStyle = '#1f1812';
      c.beginPath(); c.ellipse(ex + E.lx * r * 0.25, y + E.ly * r * 0.25, r * E.wide, r * 0.9 * E.shut * E.wide, k * 0.3, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(ex - r * 0.3, y - r * 0.35, r * 0.3, 0, 6.2832); c.fill();
    });
  }

  /* The mountain hare, bounding. From above: a long head with the eyes high
     on its sides and the long ears laid back from the crown along the
     shoulders, black-tipped; a narrow chest, broad haunches, a white scut.
     The bound is a hare's: the forefeet land one behind the other, then the
     long hind feet swing past them outside the body and land ahead, side
     by side, and it launches — stretched out long in the air, bunched
     short as the hind feet come through. */
  function bodyHare(c, S, ang, wag, o) {
    var P = Math.PI, g = o.gait || 0, lift = o.lift || 0;
    var e = o.still ? -0.2 : lift > 0.05 ? 1 : Math.cos(g);      // 1 stretched out, -1 bunched
    var str = 1 + 0.08 * e, ys = function (y) { return y * str; };
    var LEGS = [], HIND = [];
    [-1, 1].forEach(function (k) {
      /* forelegs: reaching ahead under the chin in the air, back under the
         body when the hind feet come through; one a little behind the other */
      var ef = o.still ? -0.2 : lift > 0.05 ? 1 : Math.cos(g + (k > 0 ? 0.35 : 0));
      LEGS.push(runLegSpec(k, k * 5.5, ys(-12), k * 6, -14 - 17 * ef, 3.4, 1.8, 0, true));
      /* hind legs: the long feet trail behind in the air, and swing round
         outside the body to land ahead of the forefeet */
      HIND.push(runLegSpec(k, k * 8, ys(13), k * (11 - 4 * e), 13 + 21 * e, 5.6, 3, 0, false));
    });
    function build(cc) {
      lump(cc, 0, ys(14), 13, 13.5, 0);              // haunches
      lump(cc, 0, ys(1), 11.5, 13.5, 0);             // barrel
      lump(cc, 0, ys(-11), 9.5, 9.5, 0);             // chest, narrow
      lump(cc, 0, ys(-19), 6.5, 6, 0);               // neck
      lump(cc, 0, ys(-26), 7.6, 9, 0);               // head, long
      lump(cc, 0, ys(-33), 5, 5, 0);                 // muzzle
    }
    /* under the body: the legs and feet */
    LEGS.forEach(function (L) { runLeg(c, S, L); });
    LEGS.forEach(function (L) { pawTop(c, L, S, 5, 2.2, S.flipper[1], false); });
    HIND.forEach(function (L) { runLeg(c, S, L); });
    HIND.forEach(function (L) { pawTop(c, L, S, 13, 3.4, S.flipper[0], true); });

    var bg = c.createLinearGradient(-10, -34, 12, 30);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    oneSilhouette(c, S, build, bg);
    c.save();
    c.beginPath(); build(c); c.clip();
    sphere(c, 0, ys(14), 13, 13.5, 0, 0.7);
    sphere(c, 0, ys(-10), 10, 11, 0, 0.6);
    sphere(c, 0, ys(-27), 7.6, 9, 0, 0.8);
    softPatch(c, 0, ys(-31), 5.5, 5, 'rgba(250,246,240,.75)');   // pale muzzle
    c.restore();
    furStrokes(c, build, -13, 13, -20, 26, 'rgba(255,255,255,.2)', 'rgba(40,30,20,.12)');
    /* the white scut, held up */
    var sc = c.createRadialGradient(-1, ys(27), 1, 0, ys(28), 5.5);
    sc.addColorStop(0, '#ffffff'); sc.addColorStop(1, 'rgba(255,255,255,.6)');
    c.fillStyle = sc;
    c.beginPath(); c.ellipse(0, ys(28), 4.6, 4.2, 0, 0, 6.2832); c.fill();

    /* the ears, from the crown behind the eyes, laid back along the neck
       and shoulders (flatter the faster), parting a little at each bound */
    [-1, 1].forEach(function (k) {
      var spread = 0.16 + 0.07 * (o.still ? 0 : Math.sin(g + 0.8)) - ang * 0.3 * k;
      c.save();
      c.translate(k * 3.2, ys(-24));
      c.rotate(-k * spread);
      c.fillStyle = S.body[1];
      c.beginPath();
      c.moveTo(0, -1.5);
      c.bezierCurveTo(k * 5.5, 2, k * 5.2, 16, k * 2, 25);
      c.bezierCurveTo(k * 0.5, 27.5, -k * 2.2, 25, -k * 2.4, 16);
      c.bezierCurveTo(-k * 2.6, 7, -k * 1.6, 1, 0, -1.5);
      c.closePath(); c.fill();
      if (S.outline) { c.strokeStyle = S.outline; c.lineWidth = 1.1; c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.25)';           // light along the ear's back
      c.beginPath(); c.ellipse(k * 1.2, 11, 1.4, 8, -k * 0.08, 0, 6.2832); c.fill();
      c.fillStyle = S.nose;                           // the black tip, at the back
      c.beginPath();
      c.moveTo(k * 3.4, 20); c.bezierCurveTo(k * 2.8, 24.5, k * 0.8, 27.4, -k * 1.2, 25.5);
      c.bezierCurveTo(-k * 2.2, 23.5, -k * 2.3, 21.5, -k * 2.3, 20.5);
      c.closePath(); c.fill();
      c.restore();
    });
    /* eyes high on the sides of the head, a pale ring round each */
    sideEyes(c, 6.6, ys(-28), 1.9, 'rgba(250,246,240,.9)');
    c.fillStyle = S.nose;                             // the nose, a soft Y at the tip
    c.beginPath(); c.ellipse(0, ys(-37), 1.9, 1.4, 0, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(90,80,70,.5)'; c.lineWidth = 0.6;          // whiskers
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.moveTo(k * 2.5, ys(-35)); c.lineTo(k * 11, ys(-38)); c.stroke();
      c.beginPath(); c.moveTo(k * 2.5, ys(-34)); c.lineTo(k * 11.5, ys(-34.5)); c.stroke();
    });
  }

  /* The lemming: a round ball of fur on short legs, scurrying. A blunt
     face, the ears all but hidden in the fur, eyes like beads; the
     Norway lemming's black cap and back over golden flanks, a stub of a
     tail. Its legs go so fast they are a blur of tiny paws at the edges,
     diagonal pairs together, and the whole body wobbles from side to side. */
  function bodyLemming(c, S, ang, wag, o) {
    var g = (o.gait || 0) * 1.8, lift = o.lift || 0;
    var w = o.still ? 0 : lift > 0.05 ? 0 : Math.sin(g);
    var LEGS = [];
    [-1, 1].forEach(function (k) {
      var a = o.still ? 0.3 : lift > 0.05 ? 1 : Math.sin(g + (k > 0 ? 0 : Math.PI));
      LEGS.push(runLegSpec(k, k * 8, -9, k * 11, -14 - 4 * a, 3.4, 2.2, 0, true));
      /* diagonal pairs: the hind foot moves with the opposite forefoot */
      var ah = o.still ? 0.3 : lift > 0.05 ? 1 : Math.sin(g + (k > 0 ? Math.PI : 0));
      LEGS.push(runLegSpec(k, k * 8, 10, k * 11.5, 15 - 4 * ah * (lift > 0.05 ? -1 : 1), 3.8, 2.4, 0, false));
    });
    c.save();
    c.rotate(w * 0.06);                               // the scurry's wobble
    function build(cc) {
      lump(cc, 0, 9, 12, 12, 0);                     // rump
      lump(cc, 0, -1, 13, 13.5, 0);                  // body, plump
      lump(cc, 0, -12, 11, 9.5, 0);                  // shoulders
      lump(cc, 0, -19, 8.6, 7.6, 0);                 // head, blunt
      lump(cc, 0, -24.5, 5.2, 4, 0);                 // snout
      lump(cc, 0, 21.5, 2.6, 3, 0);                  // the stub of a tail
    }
    LEGS.forEach(function (L) { runLeg(c, S, L); });
    LEGS.forEach(function (L) { pawTop(c, L, S, 3.6, 2, '#d9b29a', true); });
    var bg = c.createLinearGradient(-12, -24, 12, 22);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    oneSilhouette(c, S, build, bg);
    c.save();
    c.beginPath(); build(c); c.clip();
    /* the black cap and saddle, soft-edged, over the golden sides */
    var sg = c.createRadialGradient(0, -14, 2, 0, -8, 16);
    sg.addColorStop(0, S.stripe); sg.addColorStop(0.6, 'rgba(74,42,20,.75)'); sg.addColorStop(1, 'rgba(74,42,20,0)');
    c.fillStyle = sg;
    c.beginPath(); c.ellipse(0, -9, 10, 15, 0, 0, 6.2832); c.fill();
    var st = c.createLinearGradient(-6, 0, 6, 0);
    st.addColorStop(0, 'rgba(0,0,0,0)'); st.addColorStop(0.5, 'rgba(74,42,20,.7)'); st.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = st; c.fillRect(-6, -4, 12, 24);
    sphere(c, 0, 0, 13, 15, 0, 0.6);
    sphere(c, 0, -19, 8.6, 7.6, 0, 0.6);
    softPatch(c, 0, -24, 5, 3.6, 'rgba(244,220,192,.8)');           // pale snout
    c.restore();
    furStrokes(c, build, -13, 13, -16, 20, 'rgba(255,230,190,.22)', 'rgba(40,24,10,.14)');
    /* little round ears, nearly lost in the fur */
    [-1, 1].forEach(function (k) {
      c.fillStyle = S.body[2];
      c.beginPath(); c.ellipse(k * 7.6, -16, 2.6, 2.2, k * 0.4, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(244,200,170,.6)';
      c.beginPath(); c.ellipse(k * 7.4, -16.2, 1.3, 1, k * 0.4, 0, 6.2832); c.fill();
    });
    sideEyes(c, 6.2, -20.5, 1.3, null);
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, -28, 1.6, 1.2, 0, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(255,240,220,.55)'; c.lineWidth = 0.5;      // whiskers
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.moveTo(k * 2.5, -26.5); c.lineTo(k * 10, -29); c.stroke();
      c.beginPath(); c.moveTo(k * 2.5, -25.5); c.lineTo(k * 10.5, -25.8); c.stroke();
    });
    c.restore();
  }

  /* The snow leopard: long and low, a small round head with short round
     ears set wide, big furred paws, and the tail that is the length of the
     body again, thick as an arm, carried out behind and swinging. A cat's
     gallop: the forepaws reach far out ahead, the hind legs drive out
     behind, and the spine — the most supple there is — stretches long and
     curls short between them. Grey-white, with dark rosettes. */
  function bodyLeopard(c, S, ang, wag, o) {
    var P = Math.PI, g = o.gait || 0, lift = o.lift || 0;
    var e = o.still ? 0 : lift > 0.05 ? 1 : Math.cos(g);
    var str = 1 + 0.1 * e, ys = function (y) { return y * str; };
    /* the tail first, under everything: out from the rump, swinging */
    var tsw = (o.still ? 0.3 : swing(o, 0.6, 0.3)) - ang * 0.6;
    var t0 = [0, ys(24)], t1 = [10 * Math.sin(tsw) + 3, ys(24) + 22], t2 = [22 * Math.sin(tsw + 0.5), ys(24) + 46];
    function tailPath(w) {
      c.lineWidth = w;
      c.beginPath(); c.moveTo(t0[0], t0[1]); c.quadraticCurveTo(t1[0], t1[1], t2[0], t2[1]); c.stroke();
    }
    c.save();
    c.lineCap = 'round';
    if (S.outline) { c.strokeStyle = S.outline; tailPath(13); }
    c.strokeStyle = S.body[1]; tailPath(11);
    c.strokeStyle = S.body[0]; c.globalAlpha = 0.5; tailPath(5); c.globalAlpha = 1;
    c.fillStyle = S.spot;                            // dark rings, and a dark tip
    for (var k2 = 1; k2 <= 4; k2++) {
      var tt = k2 / 4.6, tx = 2 * (1 - tt) * tt * t1[0] + tt * tt * t2[0];
      var ty = (1 - tt) * (1 - tt) * t0[1] + 2 * (1 - tt) * tt * t1[1] + tt * tt * t2[1];
      c.beginPath(); c.ellipse(tx, ty, 4.6, 2.2, Math.atan2(t2[0] - t0[0], 46) * -0.6, 0, 6.2832); c.fill();
    }
    c.beginPath(); c.arc(t2[0], t2[1], 4.4, 0, 6.2832); c.fill();
    c.restore();
    var LEGS = [];
    [-1, 1].forEach(function (k) {
      var ef = o.still ? 0 : lift > 0.05 ? 1 : Math.cos(g + (k > 0 ? 0.4 : 0));
      var eh = o.still ? 0 : lift > 0.05 ? 1 : Math.cos(g + (k > 0 ? 0.55 : 0.15));
      LEGS.push(runLegSpec(k, k * 7.5, ys(-14), k * 9.5, -22 - 17 * ef, 5, 3.2, 0, true));
      LEGS.push(runLegSpec(k, k * 7.5, ys(17), k * 9, 26 + 17 * eh, 6, 3.4, 0, false));
    });
    function build(cc) {
      lump(cc, 0, ys(18), 10.5, 10.5, 0);            // hips
      lump(cc, 0, ys(6), 9.5, 12, 0);                // waist
      lump(cc, 0, ys(-6), 11, 12, 0);                // ribs
      lump(cc, 0, ys(-15), 11.5, 8.5, 0);            // shoulders
      lump(cc, 0, ys(-22), 7, 5.5, 0);               // neck
      lump(cc, 0, ys(-29), 8.6, 8, 0);               // head, round
      lump(cc, 0, ys(-35.5), 5, 3.8, 0);             // muzzle, short
    }
    LEGS.forEach(function (L) { runLeg(c, S, L); });
    LEGS.forEach(function (L) { pawTop(c, L, S, 7, 3.8, S.flipper[0], true); });
    var bg = c.createLinearGradient(-10, -36, 12, 28);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    oneSilhouette(c, S, build, bg);
    c.save();
    c.beginPath(); build(c); c.clip();
    sphere(c, 0, ys(-15), 11, 9, 0, 0.6);           // the shoulder blades
    sphere(c, 0, ys(17), 10.5, 10.5, 0, 0.6);
    sphere(c, 0, ys(-29), 8.6, 8, 0, 0.75);
    /* rosettes: broken rings of dark blots round a darker middle, smaller
       and denser toward the head, plain spots on the head itself */
    var ROS = [[-6, -12, 3.2], [6, -10, 3], [-7, 0, 3.4], [7, 2, 3.4], [0, -4, 2.6],
               [-5, 12, 3.2], [5, 14, 3.2], [0, 7, 2.4], [-8, 20, 2.8], [8, 21, 2.6], [0, 22, 2.4]];
    ROS.forEach(function (r, ri) {
      var rx = r[0], ry = ys(r[1]);
      c.fillStyle = 'rgba(70,76,88,.28)';
      c.beginPath(); c.arc(rx, ry, r[2] * 0.8, 0, 6.2832); c.fill();
      c.fillStyle = S.spot;
      var nb = 3 + (ri % 2), a0 = ri * 1.9;
      for (var bi = 0; bi < nb; bi++) {
        var ba = a0 + bi / nb * 6.2832;
        c.beginPath(); c.ellipse(rx + Math.cos(ba) * r[2], ry + Math.sin(ba) * r[2], r[2] * 0.4, r[2] * 0.28, ba, 0, 6.2832); c.fill();
      }
    });
    c.fillStyle = S.spot;
    [[-3.5, -31], [3.5, -31], [0, -27], [-5, -26], [5, -26], [-2, -23], [2, -23]].forEach(function (d) {
      c.beginPath(); c.arc(d[0], ys(d[1]), 0.9, 0, 6.2832); c.fill();
    });
    softPatch(c, 0, ys(-35), 4.6, 3.4, 'rgba(236,238,242,.8)');      // pale muzzle
    c.restore();
    furStrokes(c, build, -12, 12, -26, 26, 'rgba(255,255,255,.18)', 'rgba(30,34,40,.1)');
    /* short round ears set wide, dark at the back with a pale spot */
    [-1, 1].forEach(function (k) {
      c.fillStyle = S.body[2];
      c.beginPath(); c.ellipse(k * 6.8, ys(-31.5), 3.2, 2.4, k * 0.5, 0, 6.2832); c.fill();
      c.fillStyle = S.mark;
      c.beginPath(); c.ellipse(k * 6.9, ys(-31), 1.4, 1, k * 0.5, 0, 6.2832); c.fill();
    });
    eyes(c, ys(-31), 4.2, 1.6, 1.5, '#1d2228');
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, ys(-38.5), 1.8, 1.3, 0, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.7;       // whiskers
    [-1, 1].forEach(function (k) {
      c.beginPath(); c.moveTo(k * 3, ys(-36)); c.lineTo(k * 12, ys(-38.5)); c.stroke();
      c.beginPath(); c.moveTo(k * 3, ys(-35)); c.lineTo(k * 12.5, ys(-34.5)); c.stroke();
    });
  }

  /* The snowy owl, flying low over the ice — an owl does not slide or run,
     and it was drawn sitting with its face turned up to the sky, which from
     up here is not something you could see. From above you see its back:
     the round crown of the head (the face looks ahead, out of sight, only
     the hook of the beak showing past it), the body, a short fanned tail,
     and above all the wings, broad and rounded, the long primaries at
     each tip spread like fingers. White, barred across the back and wings
     with rows of dark crescents. Slow, deep beats: on the upstroke the
     hands fold back and the span shortens, on the downstroke it opens out
     full; it banks a little into a turn. */
  function owlWing(c, S, k, span, sweep) {
    /* in the wing's frame, x out from the body, y back; the hand (past the
       wrist at x 28) is folded back by `sweep` and shortened by `span` */
    var W0 = [[6, -7], [14, -10.5], [22, -11], [28, -10.5]];
    var HAND = [[36, -9], [44, -6.5], [50, -3.5], [53, -0.5], [50.5, 1], [52, 3.5], [49, 5], [49.5, 7.5],
                [46, 8.5], [45.5, 11], [41.5, 11.5], [40, 14], [35, 14.5]];
    var W1 = [[28, 15.5], [20, 16], [12, 14.5], [6.5, 10]];
    function hand(p) {
      var dx = (p[0] - 28) * span, dy = p[1] + 10.5;
      var cs = Math.cos(sweep), sn = Math.sin(sweep);
      return [28 + dx * cs - dy * sn * 0.25, -10.5 + dx * sn + dy * cs];
    }
    var pts = W0.concat(HAND.map(hand), W1);
    c.save();
    c.scale(k, 1);
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      var q = pts[i], pm = pts[i - 1];
      c.quadraticCurveTo(pm[0], pm[1], (pm[0] + q[0]) / 2, (pm[1] + q[1]) / 2);
    }
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    c.closePath();
    var wg = c.createLinearGradient(6, -10, 30, 16);
    wg.addColorStop(0, S.body[0]); wg.addColorStop(0.6, S.body[1]); wg.addColorStop(1, S.flipper[0]);
    c.fillStyle = wg;
    if (S.outline) { c.strokeStyle = S.outline; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke(); }
    c.fill();
    c.save(); c.clip();
    /* the flight feathers: the secondaries along the trailing edge, the
       primaries out to the fingers, each a faint line with a darker tip */
    /* the tips of the secondaries along the trailing edge, each a soft
       shadowed curve, the way feathers overlap */
    c.strokeStyle = 'rgba(80,98,120,.28)'; c.lineWidth = 0.8;
    for (var f = 0; f < 7; f++) {
      var fx = 8 + f * 3.3;
      c.beginPath(); c.arc(fx + 1.6, 13.4 + (f > 4 ? 0.6 : 0), 1.9, 0.3, Math.PI - 0.3); c.stroke();
    }
    /* the primaries, each a faint line out to its finger */
    c.strokeStyle = 'rgba(80,98,120,.22)'; c.lineWidth = 0.6;
    var FING = [[53, -0.5], [52, 3.5], [49.5, 7.5], [45.5, 11], [40, 14]];
    for (f = 0; f < 5; f++) {
      var a0 = hand([30 + f * 1.5, -6 + f * 3.5]), a1 = hand([FING[f][0] - 2, FING[f][1] - 0.5]);
      c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.stroke();
    }
    /* the coverts: rows of dark crescents, the snowy owl's barring */
    c.fillStyle = S.mark;
    var ROWS = [[-5, 10, 26, 4.6], [0, 9, 30, 4.4], [5, 10, 28, 4.8], [10, 12, 26, 5]];
    ROWS.forEach(function (r, ri) {
      for (var x = r[1]; x <= r[2]; x += r[3]) {
        var y = r[0] + Math.sin(x * 0.7 + ri) * 0.6;
        c.globalAlpha = 0.55 - ri * 0.06;
        c.beginPath(); c.ellipse(x, y, 1.8, 0.8, 0.25, 0, Math.PI); c.fill();
      }
    });
    for (f = 0; f < 3; f++) {                         // a few bars across the primaries
      var bc = hand([37 + f * 4.5, 2 + f * 1.5]);
      c.globalAlpha = 0.32;
      c.beginPath(); c.ellipse(bc[0], bc[1], 1.1, 3.6, 0.25 + sweep, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
    /* light along the leading edge */
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(8, -8); c.quadraticCurveTo(18, -10, 28, -9.5);
    var h1 = hand([42, -7]); c.quadraticCurveTo(34, -9, h1[0], h1[1]); c.stroke();
    c.restore();
    c.restore();
  }
  function bodyOwl(c, S, ang, wag, o) {
    var g = o.gait || 0, turn = o.turn || 0;
    c.save();
    c.scale(0.8, 0.8);                               // the wings are what make it big
    /* slow beats, with a glide between bursts of them */
    var f = o.still ? -1 : Math.sin(g * 0.55) * (0.6 + 0.4 * Math.sin(g * 0.11));
    var up = Math.max(0, f);
    [-1, 1].forEach(function (k) {
      var bank = 1 - 0.08 * Math.abs(turn) - 0.05 * turn * k;
      owlWing(c, S, k, (1 - 0.22 * up) * bank, 0.42 * up);
    });
    /* the tail: a short rounded fan, barred */
    c.save();
    c.beginPath();
    c.moveTo(-5, 14); c.quadraticCurveTo(-9.5, 26, -6, 31); c.quadraticCurveTo(0, 34, 6, 31);
    c.quadraticCurveTo(9.5, 26, 5, 14); c.closePath();
    if (S.outline) { c.strokeStyle = S.outline; c.lineWidth = 1.4; c.stroke(); }
    c.fillStyle = S.body[1]; c.fill();
    c.clip();
    c.strokeStyle = S.mark; c.globalAlpha = 0.45; c.lineWidth = 1.3;
    [21, 26, 30].forEach(function (ty) {
      c.beginPath(); c.moveTo(-7, ty); c.quadraticCurveTo(0, ty + 1.8, 7, ty); c.stroke();
    });
    c.globalAlpha = 1;
    c.restore();
    /* the body, slim in flight */
    function build(cc) {
      lump(cc, 0, 3, 9.5, 15, 0);
      lump(cc, 0, -9, 9, 8, 0);
      lump(cc, 0, -17.5, 10, 9.5, 0);                // the head, big and round
    }
    var bg = c.createRadialGradient(-4, -14, 3, 0, 0, 26);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, S.body[0]); bg.addColorStop(1, S.body[1]);
    oneSilhouette(c, S, build, bg);
    c.save();
    c.beginPath(); build(c); c.clip();
    sphere(c, 0, -17.5, 10, 9.5, 0, 0.5);
    /* the back's barring, finer up toward the nape */
    c.fillStyle = S.mark;
    [[-4, -4, 0.5], [3, -2, 0.5], [-2, 3, 0.55], [4, 6, 0.55], [-4, 9, 0.5], [1, 12, 0.5], [0, -8, 0.4], [-5, 13, 0.45], [5, 12, 0.45]].forEach(function (p) {
      c.globalAlpha = p[2];
      c.beginPath(); c.ellipse(p[0], p[1], 1.9, 0.8, 0.15, 0, Math.PI); c.fill();
    });
    /* fine flecks on the crown */
    c.globalAlpha = 0.4;
    [[-4, -21], [0, -23], [4, -21.5], [-6, -16.5], [6.5, -17], [-2, -18], [2.5, -15]].forEach(function (p) {
      c.beginPath(); c.ellipse(p[0], p[1], 0.8, 0.6, 0, 0, 6.2832); c.fill();
    });
    c.globalAlpha = 1;
    c.restore();
    /* past the crown, the hook of the beak, half hidden in feathers */
    c.fillStyle = S.nose;
    c.beginPath(); c.moveTo(-1.5, -26.6); c.quadraticCurveTo(0, -29.4, 1.5, -26.6); c.closePath(); c.fill();
    c.restore();
  }


  var BODIES = { penguin: bodyPenguin, walrus: bodyWalrus, seal: bodySeal,
                 reindeer: bodyReindeer, orca: bodyOrca,
                 hare: bodyHare, lemming: bodyLemming, leopard: bodyLeopard, owl: bodyOwl };

  /* The dispatch behind drawHint. Everything is drawn at the size it has
     on the hill and then scaled to the box, so the proportions between one
     icon and the next are the proportions between the things themselves —
     a fish really is smaller than a boulder. */
  function paintHint(kind, size) {
    var B = (typeof BIOMES !== 'undefined') ? BIOMES[0] : null;
    var c = size / 2, s = size / 62;
    var pts = [0.92, 0.78, 1.04, 0.86, 1.10, 0.80, 0.98, 0.88, 1.02];
    ctx.save();
    ctx.translate(c, c); ctx.scale(s, s); ctx.translate(-c, -c);
    if (kind === 'fish')        drawFish(c, c, { r: 15, ph: 0.6 }, false);
    else if (kind === 'gold')   drawFish(c, c, { r: 19, ph: 0.6 }, true);
    else if (kind === 'bubble') drawBubble(c, c, { r: 21, ph: 1.2 });
    else if (kind === 'gate')   { ctx.save(); ctx.translate(c, c + 12); ctx.scale(0.7, 0.7);       // the arc is wider than the icon
                                  drawGate(0, 0, { w: 18, d: 0, passed: false, scored: false }); ctx.restore(); }
    else if (kind === 'find')   drawFind(c, c, { r: 21, ph: 0.4 });
    else if (kind === 'rush')   drawRushBall(c, c, { r: 22, ph: 1.4 });
    else if (kind === 'clock')  drawClock(c, c, { r: 22, ph: 0.8 });
    else if (kind === 'chill' || kind === 'sight' || kind === 'call')
                                drawFind3(c, c, { t: kind, r: 21, ph: 0.5 });
    else if (kind === 'drift')  drawDrift(c, c, { r: 26, ph: 1.0 }, B);
    else if (kind === 'geyser') hintGeyser(c, c, B);
    else if (kind === 'rock')   drawRock(c, c, { r: 22, rot: 0.4, d: 0, pts: pts }, B);
    else if (kind === 'tree')   drawTree(c, c, { r: 22, rot: 0.2, d: 0, pts: pts }, B);
    else if (kind === 'heart')  drawHeart(c, c, 17);
    else if (kind === 'crevasse') hintCrevasse(c, c, B);
    else if (kind === 'fork')     hintFork(c, c, B);
    else if (kind === 'bridge')   hintBridge(c, c, B);
    ctx.restore();
  }

  /* The snow bridge, small: a strip of the run, the roof across it with
     its arched mouth, dark beneath and icicles off the lip. The same marks
     the hill uses, so the picture in the panel is the thing you meet. */
  function hintBridge(x, y, B) {
    ctx.save(); ctx.translate(x, y);
    /* the run, top to bottom, with banks either side */
    ctx.fillStyle = B ? B.bankShade : '#a8cfe6';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-27, -27, 54, 54);
    ctx.globalAlpha = 1;
    var ice = ctx.createLinearGradient(0, -27, 0, 27);
    ice.addColorStop(0, B ? B.iceTop : '#b6e2f7'); ice.addColorStop(1, B ? B.iceBot : '#8ccbec');
    ctx.fillStyle = ice;
    ctx.fillRect(-15, -27, 30, 54);
    /* the opening's shadow, soft, under the arch */
    var sh = ctx.createLinearGradient(0, -4, 0, 10);
    sh.addColorStop(0, 'rgba(18,22,28,.42)'); sh.addColorStop(1, 'rgba(18,22,28,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-15, -6, 30, 16);
    /* the roof: straight across the far side, arched over the run on the
       near side, and dropped onto the banks like snow, not a beam */
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-27, -21); ctx.lineTo(27, -21); ctx.lineTo(27, 2); ctx.lineTo(16, 2);
    ctx.bezierCurveTo(14, -9, -14, -9, -16, 2); ctx.lineTo(-27, 2);
    ctx.closePath();
    ctx.shadowColor = 'rgba(18,22,28,.35)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(70,110,140,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    /* three thin icicles off the arch */
    ctx.fillStyle = 'rgba(190,226,248,.95)';
    [-7, 0, 7].forEach(function (ix, n) {
      var iy = -5.6 + Math.abs(ix) * 0.18, len = 3 + (n % 2) * 2;
      ctx.beginPath(); ctx.moveTo(ix - 1.3, iy); ctx.lineTo(ix + 1.3, iy); ctx.lineTo(ix, iy + len);
      ctx.closePath(); ctx.fill();
    });
    /* and a penguin heading in underneath */
    if (typeof SKINS !== 'undefined') {
      ctx.save(); ctx.translate(0, 17);
      paintCreature(ctx, SKINS[0], { ang: 0, wag: 0, scale: 0.3, shield: -1, still: true });
      ctx.restore();
    }
    ctx.restore();
  }

  /* The two that span the run rather than sitting at a point. Drawn small
     on purpose: a crevasse is a slot with the ramp in front of it, a fork
     is a ridge with a way past on either side. */
  function hintCrevasse(x, y, B) {
    ctx.save(); ctx.translate(x, y);
    var g = ctx.createLinearGradient(0, -17, 0, 0);
    g.addColorStop(0, '#2a4a66'); g.addColorStop(0.5, '#10243a'); g.addColorStop(1, '#081626');
    ctx.fillStyle = g;
    ctx.beginPath(); rr(ctx, -23, -17, 46, 17, 4); ctx.fill();
    ctx.fillStyle = 'rgba(214,238,255,.75)';          // the near lip, catching light
    ctx.beginPath(); rr(ctx, -23, -2, 46, 4, 2); ctx.fill();
    drawRamp(0, 15, { w: 26, used: false }, B);
    ctx.restore();
  }
  /* The geyser gets its own small drawing rather than a frozen frame of
     the real one. Caught mid-eruption and shrunk to 44px the plume spreads
     into a round white puff, which is exactly what the deep snow icon
     above it already is — two different hazards, one picture. A narrow
     column out of a dark hole cannot be mistaken for a drift. */
  function hintGeyser(x, y, B) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#0d2438';                        // the hole it comes out of
    ctx.beginPath(); ctx.ellipse(0, 16, 15, 7, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(206,234,252,.8)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(0, 16, 15, 7, 0, 0, 6.2832); ctx.stroke();

    var g = ctx.createLinearGradient(0, -26, 0, 16);  // the column
    g.addColorStop(0, 'rgba(255,255,255,.28)');
    g.addColorStop(0.45, 'rgba(236,250,255,.92)');
    g.addColorStop(1, '#bfe4f8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-5, 16);
    ctx.bezierCurveTo(-9, -2, -7, -16, -3, -27);
    ctx.bezierCurveTo(-1, -30, 2, -30, 4, -27);
    ctx.bezierCurveTo(8, -16, 10, -2, 6, 16);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.9)';           // thrown clear of it
    [[-12, -14, 2.6], [11, -9, 2.2], [-9, 2, 2.0], [13, 3, 2.4], [0, -31, 2.2]]
      .forEach(function (p) {
        ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 6.2832); ctx.fill();
      });
    ctx.restore();
  }

  function hintFork(x, y, B) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = B && B.cap ? B.cap : '#ffffff';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, -27); ctx.lineTo(13, 0); ctx.lineTo(0, 27); ctx.lineTo(-13, 0);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = B ? B.rockDark : '#6b5a48';
    ctx.beginPath();
    ctx.moveTo(0, -24); ctx.lineTo(9, 0); ctx.lineTo(0, 24); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = B ? B.rock : '#8d7a63';
    ctx.beginPath();
    ctx.moveTo(0, -24); ctx.lineTo(-9, 0); ctx.lineTo(0, 24); ctx.lineTo(-2, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(52,72,92,.4)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -24); ctx.lineTo(9, 0); ctx.lineTo(0, 24); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  /* One painter, two callers: the creature on the hill and the little
     portrait on each shop card. Everything it needs comes in through `o`,
     so the preview does not have to fake a world to borrow the drawing. */
  /* Per-limb swing. Legs on one side lead the ones on the other, and the
     diagonal pairs of a four-legged animal move together, which is what a
     trot actually looks like from above. */
  function swing(o, phase, amp) {
    return Math.sin((o.gait || 0) + phase) * (amp === undefined ? 0.18 : amp);
  }

  /* ---- the creature, in the same light as the hill ----
     The animals were lit from inside themselves: each body has its own
     sheens, but nothing tied them to the sun that throws every shadow on
     the hill. Now the body is painted into a buffer of its own, and the
     sun is laid over it — warm on the upper left, falling into a cool
     shade on the lower right — on the body's own pixels only, then the
     whole is copied in. Turning, he turns under the light, not with it.
     Where the canvas cannot say how it is transformed (an old browser, the
     test harness) he is painted as he always was. */
  var litBuf = null, litCtx = null;
  function litBody(c, paint) {
    var T = c.getTransform ? c.getTransform() : null;
    if (!T || typeof document === 'undefined') { paint(c); return; }
    var k = Math.sqrt(T.a * T.a + T.b * T.b);
    var half = Math.ceil(88 * k);                    // the body, antlers and all, fits in 88 units
    if (half < 8 || half > 1400) { paint(c); return; }
    if (!litBuf) {
      litBuf = document.createElement('canvas');
      litCtx = litBuf && litBuf.getContext ? litBuf.getContext('2d') : null;
      if (!litCtx) { litBuf = null; paint(c); return; }
    }
    if (litBuf.width < half * 2 || litBuf.height < half * 2) {   // a new canvas is 300 by 150
      litBuf.width = Math.max(litBuf.width, half * 2); litBuf.height = Math.max(litBuf.height, half * 2);
    }
    var L = litCtx;
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over'; L.globalAlpha = 1;
    L.clearRect(0, 0, half * 2, half * 2);
    L.setTransform(T.a, T.b, T.c, T.d, half, half);
    L.lineJoin = 'round'; L.lineCap = 'round';
    paint(L);
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-atop';
    var g = L.createLinearGradient(half * 0.35, half * 0.25, half * 1.65, half * 1.8);
    g.addColorStop(0, 'rgba(255,246,222,.30)');
    g.addColorStop(0.42, 'rgba(255,255,255,0)');
    g.addColorStop(0.62, 'rgba(14,32,64,0)');
    g.addColorStop(1, 'rgba(14,32,64,.34)');
    L.fillStyle = g; L.fillRect(0, 0, half * 2, half * 2);
    L.globalCompositeOperation = 'source-over';
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(litBuf, 0, 0, half * 2, half * 2, T.e - half, T.f - half, half * 2, half * 2);
    c.restore();
  }

  function paintCreature(c, S, o) {
    var ang = o.ang || 0, wag = o.wag || 0, lift = o.lift || 0;
    var gait = o.gait || 0, turn = o.turn || 0;
    c.save();
    /* The body itself: rolling into the lean, riding over the bumps, and
       breathing. Small numbers — at this size anything more looks like a
       wobble rather than an animal. */
    if (!o.still) {
      c.rotate(turn * 0.1 + Math.sin(gait * 0.47) * 0.035);
      c.translate(Math.sin(gait * 0.83) * 0.7, Math.sin(gait) * 0.9);
      c.scale(1 + Math.sin(gait * 0.31) * 0.02, 1 - Math.sin(gait * 0.31) * 0.015);
    }
    /* Height reads as the shadow falling away and shrinking while the animal
       itself grows — the only way to show altitude from straight above. */
    c.fillStyle = 'rgba(70,110,150,' + (0.25 - 0.13 * lift).toFixed(3) + ')';
    c.save();
    c.scale(o.scale, o.scale);
    c.beginPath();
    if (S.shape === 'owl') {
      /* the owl is always flying: its shadow lies well off to the side,
         soft, a bird's shape with the wings out */
      var oh = Math.max(lift, 0.55);
      c.fillStyle = 'rgba(70,110,150,' + (0.2 - 0.08 * oh).toFixed(3) + ')';
      c.ellipse(7 + oh * 14, 10 + oh * 34, 13, 22, 0, 0, 6.2832);
      c.ellipse(7 + oh * 14, 6 + oh * 34, 46 - oh * 10, 9, 0, 0, 6.2832);
    } else
    c.ellipse(7 + lift * 12, 10 + lift * 34, 28 - lift * 9, 32 - lift * 11, 0, 0, 6.2832);
    c.fill();
    c.restore();
    c.scale(o.scale * (1 + 0.5 * lift), o.scale * (1 + 0.5 * lift));
    if (o.squash) {                                   // the give as he digs in, springing back
      var sq = Math.sin(o.squash * Math.PI * 1.5) * o.squash;
      c.scale(1 + 0.13 * sq, 1 - 0.11 * sq);
    }

    litBody(c, function (cc) { (BODIES[S.shape] || bodyPenguin)(cc, S, ang, wag, o); });

    if (o.shield >= 0) {
      var r = 48;
      var sg = c.createRadialGradient(-14, -16, 6, 0, 0, r);
      sg.addColorStop(0, 'rgba(255,255,255,.28)');
      sg.addColorStop(0.7, 'rgba(150,225,255,.14)');
      sg.addColorStop(1, 'rgba(120,205,250,.3)');
      c.fillStyle = sg;
      c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(200,240,255,' + (0.55 + 0.2 * Math.sin(o.shield * 0.13)).toFixed(2) + ')';
      c.lineWidth = 2.6;
      c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.stroke();
    }
    c.restore();
  }

  function drawPenguin() {
    var S = skin || SKINS[0];
    /* heading, forward is up. Measured against a floor on the speed: with
       the hill slowed nearly to a stop the slightest sideways drift turned
       him almost side-on, and each tap swung him across — the shiver a new
       player saw in the tutorial's first seconds. */
    var ang = Math.atan2(W.vx, Math.max(W.speed, 3)) * 0.85;
    var crashed = W.state !== 'run';
    /* The eyes: a blink every few seconds (a little irregular, never in
       the same rhythm twice running), a glance at the nearest fish ahead,
       and wide for a moment after a close call. */
    var bt = W.t % 263, shut = bt < 4 ? 0.1 : bt < 7 ? 0.5 : (W.t % 571 < 4 ? 0.1 : 1);
    var lx = 0, ly = -0.4, best = 1e9;
    for (var fi = 0; fi < W.objects.length; fi++) {
      var fo = W.objects[fi];
      if ((fo.t !== 'fish' && fo.t !== 'gold') || fo.got) continue;
      var fdd = fo.d - W.dist, fdx = fo.x - W.px;
      if (fdd < 10 || fdd > 240) continue;
      var dist2 = fdd * fdd + fdx * fdx;
      if (dist2 < best) { best = dist2; var len = Math.sqrt(dist2);
        /* into the animal's own frame: forward is up, and it is turned by ang */
        var vx = fdx / len, vy = -fdd / len;
        lx = vx * Math.cos(-ang) - vy * Math.sin(-ang); ly = vx * Math.sin(-ang) + vy * Math.cos(-ang); }
    }
    var alarm = Math.max(W.closeT, W.perfT);
    EYE = { shut: crashed ? 0.1 : shut, wide: alarm > 0 ? 1 + 0.45 * Math.min(1, alarm / 30) : 1,
            lx: crashed ? 0 : lx, ly: crashed ? 0 : ly };
    /* Being briefly safe is shown with a ring, not by messing with the
       animal itself. Two earlier attempts were both worse: half opacity
       let the seams between a creature's lumps show through as circles,
       and blinking it out left you unable to see your own line for half
       of the second that matters most. */
    var safe = W.invuln > 0 && !crashed && !W.demo;

    /* Rushing: he is inside a ball of packed powder, throwing a wake. Drawn
       under the creature so you can still read your own line through it —
       the same reason invulnerability is a ring and not a fade. */
    if (rushing() && !crashed) {
      var left = W.rushT / RUSH_FRAMES;                 // 1 at pickup, 0 at the end
      var px = scrX(W.px), rr = 46 + 6 * Math.sin(W.t * 0.3);
      ctx.save();
      /* the wake, streaming out behind */
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineCap = 'round';
      for (var wq = 0; wq < 9; wq++) {
        var ws = wq % 2 ? 1 : -1;
        ctx.globalAlpha = 0.6 * (1 - wq / 11) * Math.min(1, left * 4);
        ctx.lineWidth = 6 - wq * 0.45;
        ctx.beginPath();
        ctx.moveTo(px + ws * (14 + wq * 5), PLAYER_Y + 18 + wq * 9);
        ctx.lineTo(px + ws * (20 + wq * 7), PLAYER_Y + 46 + wq * 13);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      /* the ball itself */
      /* Clear through the middle, packed at the rim. The first pass had it
         the other way round, which hid the animal and left a pale ring —
         you could not see your own line, which is the one thing the ring
         around invulnerability exists to avoid. */
      var rg = ctx.createRadialGradient(px, PLAYER_Y, rr * 0.2, px, PLAYER_Y, rr);
      rg.addColorStop(0, 'rgba(255,255,255,0)');
      rg.addColorStop(0.52, 'rgba(255,255,255,.22)');
      rg.addColorStop(0.8, 'rgba(240,250,255,.78)');
      rg.addColorStop(1, 'rgba(188,222,244,.95)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(px, PLAYER_Y, rr, 0, 6.2832); ctx.fill();
      /* the last two seconds flash, so it never simply stops */
      var warn = left < 0.18 ? (0.4 + 0.6 * Math.abs(Math.sin(W.t * 0.35))) : 1;
      ctx.globalAlpha = warn;
      ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(px, PLAYER_Y, rr, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.save();
    ctx.translate(scrX(W.px), PLAYER_Y);
    ctx.rotate(crashed && W.crashAt ? W.crashAt.spin : ang);
    var lift = 0;
    if (airborne()) {
      var p = 1 - (W.airTo - W.dist) / W.airSpan;    // 0 at the lip, 1 at touchdown
      lift = Math.sin(Math.PI * clamp(p, 0, 1));

      /* Over the hole there is nothing for a shadow to fall on, so height
         has to be said another way: rushing air, streaming past and behind. */
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineCap = 'round';
      for (var a = 0; a < 7; a++) {
        var side = a % 2 ? 1 : -1;
        var off = 26 + (a * 13) % 34;
        var len = 22 + lift * 30 + (a * 7) % 14;
        var wob = Math.sin(W.t * 0.4 + a) * 3;
        ctx.globalAlpha = (0.2 + 0.4 * lift) * (1 - a / 9);
        ctx.lineWidth = 3.4 - a * 0.3;
        ctx.beginPath();
        ctx.moveTo(side * off + wob, 16 + a * 5);
        ctx.lineTo(side * (off + 5) + wob, 16 + a * 5 + len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    /* Spray off his belly, longer the faster he goes. */
    if (!crashed && !airborne()) {
      var spw = pace();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineCap = 'round';
      for (var sq = 0; sq < 6; sq++) {
        var ss = sq % 2 ? 1 : -1;
        var sh = (10 + sq * 7) * (0.6 + 1.5 * spw);
        ctx.globalAlpha = (0.30 - sq * 0.04) * (0.35 + 0.65 * spw);
        ctx.lineWidth = 4 - sq * 0.5;
        ctx.beginPath();
        ctx.moveTo(ss * (7 + sq * 3), 16 + sq * 4);
        ctx.lineTo(ss * (10 + sq * 4), 16 + sq * 4 + sh);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    /* Everything the creature needs to look alive: where it is in its
       stride (faster downhill means quicker paddling), and how hard it is
       leaning. One shared `wag` moved both sides of an animal the same
       way, which is why they read as pictures — nothing alternates. */
    var gait = W.gait || 0;
    var turn = clamp(W.vx / Math.max(1, DRIFT * W.speed), -1, 1);
    paintCreature(ctx, S, {
      ang: ang, wag: Math.sin(gait) * 0.1, gait: gait, turn: turn,
      scale: 1.45, lift: lift, air: airborne(), squash: W.squash || 0,
      shield: (W.shield > 0 && !crashed) ? W.t : -1
    });

    if (safe) {
      /* Short spokes flung outward, turning and dying away. The shield is
         a circle, so this must not be one: the two can be on together —
         they were, the very first time I looked at it — and a ring inside
         a bubble is two circles nobody can tell apart. These sit outside
         the bubble and point away from it. */
      var life = Math.min(1, W.invuln / 30);
      var puls = 0.6 + 0.4 * Math.sin(W.t * 0.45);
      ctx.save();
      ctx.rotate(W.t * 0.05);
      ctx.lineCap = 'round';
      for (var sp = 0; sp < 10; sp++) {
        var a2 = sp / 10 * 6.2832;
        var r0 = 52, r1 = r0 + 6 + (sp % 3) * 3;
        ctx.strokeStyle = 'rgba(200,244,255,' + (0.9 * life * puls).toFixed(2) + ')';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a2) * r0, Math.sin(a2) * r0);
        ctx.lineTo(Math.cos(a2) * r1, Math.sin(a2) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* A tall phone shows far more hill than a laptop does. Left alone that
     would hand the phone player several extra seconds of warning, so past a
     fixed budget of clearly-readable hill the distance hazes over: shapes
     still show through, but not sharply enough to plan on. */
  /* Haze over the far end of the hill, above what you can always read
     plainly: clear at CLEAR_AHEAD, 0.82 at the top edge. */
  function hazeA(y, top) {
    if (y >= top) return 0;
    var u = (top - y) / top;
    return u < 0.55 ? 0.5 * u / 0.55 : 0.5 + 0.32 * (u - 0.55) / 0.45;
  }
  /* Night closes the hill in: the far end of the run fades out, so a tap has
     to be committed to before the next row is fully in view. The fog is f
     at the top edge, f·0.28 at 0.65 of the way down to h, clear at h. */
  function fogA(y, h, f) {
    var v = y / h;
    return v < 0.65 ? f * (1 - 0.72 * v / 0.65) : f * 0.28 * (1 - (v - 0.65) / 0.35);
  }
  /* The two lie over the same top of the screen, and painted one over the
     other they were two passes over half its pixels on every frame (twelve
     stretches of fourteen have fog). A veil over a veil is one veil, alpha
     1 − (1 − a)(1 − b) with the colours weighted to match, so they go down
     together in one pass, stopped wherever either has a stop and every
     sixteenth of the way between, since their product is not a straight
     line. */
  function drawVeils() {
    var B = pal(), top = PLAYER_Y - CLEAR_AHEAD, h = PLAYER_Y - 40;
    var haze = top > 8, fog = !!(B.fog && B.fogRGB);
    if (!haze && !fog) return;
    var hr = (B.hazeRGB || '220,238,250').split(','), fr = fog ? B.fogRGB.split(',') : hr;
    var H = fog ? h : top, g = ctx.createLinearGradient(0, 0, 0, H), N = 16, ys = [0, top * 0.45, top, h * 0.65, H], i;
    for (i = 1; i < N; i++) ys.push(H * i / N);
    ys = ys.filter(function (y) { return y >= 0 && y <= H; }).sort(function (p, q) { return p - q; });
    for (i = 0; i < ys.length; i++) {
      var y = ys[i], a = haze ? hazeA(y, top) : 0, b = fog ? fogA(y, h, B.fog) : 0;
      var A = 1 - (1 - a) * (1 - b), wa = A > 0 ? a * (1 - b) / A : 0, wb = 1 - wa;
      g.addColorStop(y / H, 'rgba(' + Math.round(hr[0] * wa + fr[0] * wb) + ',' + Math.round(hr[1] * wa + fr[1] * wb) + ',' +
                                      Math.round(hr[2] * wa + fr[2] * wb) + ',' + A.toFixed(3) + ')');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, H);
  }

  function drawFlakes() {
    var A = (pal().air) || AIR0, hot = A.hot || 0, f, i, a;
    var lim = Math.round(W.flakes.length * (0.34 + 0.66 * (A.n === undefined ? 0 : A.n)) * (SPARE ? 0.4 : 1));
    if (!hot) {
      /* plain snow is one colour at one strength: one path, one fill */
      ctx.globalAlpha = A.a;
      ctx.fillStyle = 'rgb(' + A.rgb + ')';
      ctx.beginPath();
      for (i = 0; i < lim; i++) {
        f = W.flakes[i];
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, 6.2832);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (hot > 0.02) ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < lim; i++) {
      f = W.flakes[i];
      /* An ember is a coal, not a flake: it pulses as it burns down. */
      a = A.a * (hot ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(W.t * 0.13 + f.ph)) : 1);
      if (hot > 0.02 && !SPARE) {                    // the heat it throws
        ctx.globalAlpha = a * 0.3 * hot;
        ctx.fillStyle = 'rgb(' + A.rgb + ')';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 3.4, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = hot > 0.5 ? '#ffe9b0' : 'rgb(' + A.rgb + ')';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (hot ? 0.35 + 1.5 * (f.ph / 6.2832) : 1), 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /* The bank edge, as drawChute lays it down. Anything that has to sit ON
     the bank has to follow the same wobble or it drifts off the edge. */
  function bankX(d, side) {
    var c = chuteAt(d) - chuteHere();
    var wob = Math.sin(d * 0.011 + side * 2.1) * 9 + Math.sin(d * 0.03) * 4;
    return VIEW_W / 2 + c + side * (CHUTE + wob);
  }
  /* Everything pinned to world distance rather than to the screen, so it
     scrolls past with the hill instead of swimming on top of it. */
  function eachAlong(gap, run, fn) {
    var base = Math.floor(W.dist / gap) * gap;
    for (var i = -1; i < run; i++) {
      var d = base + i * gap, y = scrY(d);
      if (y < -200 || y > VIEW_H + 200) continue;
      fn(d, y, i);
    }
  }

  function drawGround() {
    var B = pal();
    /* Open lava either side of the line. It is the reason that stretch is
       frightening, so it is drawn bright and it moves. */
    if ((B.lava || 0) > 0.01) {
      var amt = B.lava;
      ctx.save();
      [-1, 1].forEach(function (side) {
        for (var pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          for (var y = -40; y <= VIEW_H + 40; y += 14) {
            var d = W.dist + (PLAYER_Y - y);
            var x = bankX(d, side) + side * (34 + 16 * Math.sin(d * 0.008 + side));
            y === -40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.lineCap = 'round';
          ctx.lineWidth = pass ? 13 : 36;
          ctx.strokeStyle = pass ? 'rgba(255,214,132,' + (0.85 * amt).toFixed(3) + ')'
                                 : 'rgba(226,74,16,' + (0.42 * amt).toFixed(3) + ')';
          ctx.stroke();
        }
      });
      /* Brighter clots riding down the channel, so it reads as flowing. */
      ctx.globalCompositeOperation = 'lighter';
      eachAlong(150, 8, function (d, y, i) {
        var side = ((i + Math.floor(W.dist / 150)) % 2) ? 1 : -1;
        var bob = Math.sin(W.t * 0.03 + i) * 8;
        var x = bankX(d, side) + side * (34 + 16 * Math.sin(d * 0.008 + side));
        var g = ctx.createRadialGradient(x, y + bob, 0, x, y + bob, 46);
        g.addColorStop(0, 'rgba(255,236,186,' + (0.7 * amt).toFixed(3) + ')');
        g.addColorStop(0.4, 'rgba(255,128,32,' + (0.34 * amt).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(220,60,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y + bob, 46, 0, 6.2832); ctx.fill();
      });
      ctx.restore();
    }

    /* Rowan along the banks: three or four berries to a cluster, half sunk
       in the snow, with the snow dimpled under each one. */
    if ((B.berries || 0) > 0.01) {
      var ba = B.berries;
      eachAlong(58, 16, function (d, y, i) {
        var side = Math.sin(d * 0.021) > 0 ? 1 : -1;
        var off = 30 + ((i * 37) % 46);
        var bx = bankX(d, side) + side * off;
        var n = 4 + ((i * 13) % 3);
        for (var k = 0; k < n; k++) {
          var a = k / n * 6.2832 + d * 0.01;
          var px = bx + Math.cos(a) * 9, py = y + Math.sin(a) * 8;
          ctx.globalAlpha = 0.22 * ba;
          ctx.fillStyle = '#7c95ad';
          ctx.beginPath(); ctx.arc(px + 1.5, py + 2, 4.2, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = ba;
          ctx.fillStyle = '#c62f28';
          ctx.beginPath(); ctx.arc(px, py, 4.6, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(255,190,180,.75)';     // the highlight on each
          ctx.beginPath(); ctx.arc(px - 1.4, py - 1.5, 1.6, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
    }

    /* Frost catching the moon. Each point has its own clock, so they come
       and go rather than blinking together. */
    if ((B.sparkle || 0) > 0.01) {
      var sa = B.sparkle;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      eachAlong(34, 30, function (d, y, i) {
        for (var s3 = 0; s3 < 3; s3++) {
          var seedy = Math.sin(d * 0.0731 + i * 2.7 + s3 * 1.9);
          var x = scrX(seedy * CHUTE * 1.06);
          var yy = y + ((s3 * 11) % 26) - 13;
          var tw = Math.sin(W.t * 0.09 + d * 0.31 + s3 * 2.4);
          if (tw < 0.2) continue;
          var k = (tw - 0.2) / 0.8, r = 1.4 + 3.0 * k;
          ctx.globalAlpha = k * 0.95 * sa;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x, yy, r, 0, 6.2832); ctx.fill();
          ctx.fillRect(x - r * 3.4, yy - 0.7, r * 6.8, 1.4);   // the cross-flare
          ctx.fillRect(x - 0.7, yy - r * 3.4, 1.4, r * 6.8);
        }
      });
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  /* Wind along the sides, and only once he is really moving. Kept off the
     middle third so it never competes with the line he is reading. */
  function drawSpeedStreaks() {
    if (SPARE) return;                 // atmosphere only (low effects)
    /* a perfect tap throws the streaks out as if he had surged */
    var sp = Math.min(1, pace() + (W.perfT > 0 ? 0.45 * W.perfT / 50 : 0));
    if (sp < 0.10) return;
    var k = clamp((sp - 0.10) / 0.45, 0, 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineCap = 'round';
    var step = 150, base = Math.floor((W.dist - 200) / step) * step;
    for (var i = 0; i < 26; i++) {
      var d = base + i * step;
      var y = scrY(d);
      if (y < -260 || y > VIEW_H + 120) continue;
      var h = ((i * 37) % 100) / 100;
      var side = (i % 2) ? 1 : -1;
      /* outside the middle third, hugging the edge of the frame */
      var x = VIEW_W / 2 + side * (VIEW_W * (0.34 + 0.15 * h));
      var len = (90 + 230 * h) * k;
      ctx.globalAlpha = (0.16 + 0.40 * h) * k;
      ctx.lineWidth = 1.6 + 2.8 * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * 4, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* The frame closes in at speed. Subtle on purpose — it is a pressure you
     feel rather than a frame you notice. */
  function drawChill() {
    if (W.chillT <= 0) return;
    var k = Math.min(1, W.chillT / 40);
    ctx.save();
    /* The first pass was so faint you could not tell it was on. It has to
       be visible enough to explain why the hill suddenly went quiet. */
    var g = ctx.createRadialGradient(VIEW_W / 2, PLAYER_Y, VIEW_W * 0.12,
                                     VIEW_W / 2, PLAYER_Y, VIEW_W * 0.9);
    g.addColorStop(0, 'rgba(186,232,255,0)');
    g.addColorStop(0.55, 'rgba(168,220,250,' + (0.22 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(132,196,238,' + (0.62 * k).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    /* frost creeping in from the edges */
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.72 * k).toFixed(3) + ')';
    ctx.lineCap = 'round';
    for (var i = 0; i < 26; i++) {
      var side = i % 2 ? 1 : -1, h = ((i * 37) % 100) / 100;
      var x = VIEW_W / 2 + side * VIEW_W * (0.46 - 0.06 * h);
      var y = VIEW_H * h;
      ctx.lineWidth = 2.2 + h * 3.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - side * (18 + 52 * h * k), y + 18 - 36 * h);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* The run he has made: a groove in the ice behind him, a shadowed cut
     with a line of light along one lip, fading as it falls behind. Under a
     snow rush it is cut deeper and catches the light gold. */
  function drawTrail() {
    var tr = W.trail;
    if (!tr || tr.length < 2) return;
    var S = skin || SKINS[0], feet = FEET[S.feet || S.shape];
    if (feet) { drawPrints(tr, feet); return; }
    /* Drawn as unbroken strokes, a few points each, so no two pieces of the
       line overlap: drawn segment by segment with round ends, every joint
       was painted twice and the groove came out as a string of beads. */
    var BAND = 6;
    ctx.save();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    for (var pass = 0; pass < 2; pass++) {
      for (var i0 = 0; i0 < tr.length - 1; i0 += BAND) {
        var end = Math.min(tr.length - 1, i0 + BAND);
        var p1 = tr[end];
        var back = clamp((W.dist - tr[i0].d) / (BEHIND + 40), 0, 1), fade = 1 - back;
        var rush = !!tr[end].rush;
        var off = pass ? -PR * 0.32 : 0;
        if (pass === 0) {
          ctx.strokeStyle = rush ? 'rgba(150,110,40,' + (0.22 * fade).toFixed(3) + ')'
                                 : 'rgba(40,96,140,' + (0.24 * fade).toFixed(3) + ')';
          ctx.lineWidth = PR * (rush ? 1.15 : 0.9);
        } else {
          ctx.strokeStyle = rush ? 'rgba(255,224,140,' + (0.5 * fade).toFixed(3) + ')'
                                 : 'rgba(255,255,255,' + (0.55 * fade).toFixed(3) + ')';
          ctx.lineWidth = 1.6;
        }
        ctx.beginPath();
        var open = false;
        for (var i = i0; i <= end; i++) {
          var p = tr[i];
          if (p.x === null) { open = false; continue; }
          var x = scrX(p.x) + off, y = scrY(p.d);
          if (open) ctx.lineTo(x, y); else { ctx.moveTo(x, y); open = true; }
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    /* a penguin's toboggan track is more than the groove: a scuff from
       each foot as it kicks, and the long brush of the flippers when they
       row, either side */
    if (!S.shape || S.shape === 'penguin') drawPrints(tr, PENG_MARKS);
  }

  /* What a running animal leaves on the hill instead of a groove: a print
     where each foot came down. Each foot is listed by its place in the
     stride (on, in radians of the gait, the moment it lands — the same
     clock the body painter moves the legs by), where it lands in the
     drawing's units (x across, y ahead of the body negative), and the
     print it makes. Animals that slide on their bellies have no entry and
     cut the groove. */
  var FEET = {
    /* the gallop in bodyReindeer: a foreleg lands at the front of its
       reach, a hind leg as it comes forward under the body */
    reindeer: [
      { on: 0,           x: -11.6, y: -35, k: 'hoof', r: 2.6 }, { on: -0.45,        x: 11.6, y: -35, k: 'hoof', r: 2.6 },
      { on: Math.PI - 0.15, x: -10.9, y: 26, k: 'hoof', r: 2.7 }, { on: Math.PI - 0.6, x: 10.9, y: 26, k: 'hoof', r: 2.7 }
    ],
    muskox: [
      { on: 0,           x: -12.6, y: -25, k: 'hoof', r: 3.1 }, { on: -0.45,        x: 12.6, y: -25, k: 'hoof', r: 3.1 },
      { on: Math.PI - 0.15, x: -11.9, y: 26, k: 'hoof', r: 3.1 }, { on: Math.PI - 0.6, x: 11.9, y: 26, k: 'hoof', r: 3.1 }
    ],
    /* a hare's track: the two forefeet one behind the other, then the
       long hind feet side by side ahead of them */
    hare: [
      { on: 0.9, x: -6, y: -24.6, k: 'round', r: 1.9 }, { on: 0.9, x: 6, y: -19.4, k: 'round', r: 1.9 },
      { on: Math.PI, x: -15, y: -6, k: 'long', r: 3.4 }, { on: Math.PI, x: 15, y: -6, k: 'long', r: 3.4 }
    ],
    /* a lemming's: tiny prints in pairs, a quick trot (its legs go 1.8
       times the gait's clock) */
    lemming: [
      { on: -Math.PI / 2, mul: 1.8, x: -11, y: -18, k: 'round', r: 1.3 }, { on: Math.PI / 2, mul: 1.8, x: 11, y: -18, k: 'round', r: 1.3 },
      { on: Math.PI / 2, mul: 1.8, x: -11.5, y: 11, k: 'round', r: 1.3 }, { on: -Math.PI / 2, mul: 1.8, x: 11.5, y: 11, k: 'round', r: 1.3 }
    ],
    /* a big cat's: round pads with four toes, the forepaws landing at the
       front of their reach, the hind paws close behind them */
    leopard: [
      { on: 0, x: -9.5, y: -39, k: 'pad', r: 3 }, { on: -0.4, x: 9.5, y: -39, k: 'pad', r: 3 },
      { on: Math.PI - 0.15, x: -9, y: 9, k: 'pad', r: 3.2 }, { on: Math.PI - 0.55, x: 9, y: 9, k: 'pad', r: 3.2 }
    ],
    /* the owl flies: it leaves nothing on the ice */
    owl: []
  };
  /* bodyPenguin's kick (sin(gait), the left foot half a turn behind) and
     row (sin(gait * 0.55), both together) */
  var PENG_MARKS = [
    { on: Math.PI / 2, x: 9, y: 31, k: 'scuff', r: 2 }, { on: Math.PI * 1.5, x: -9, y: 31, k: 'scuff', r: 2 },
    { on: Math.PI / 2, mul: 0.55, x: 23, y: 8, k: 'stroke', r: 2.4 }, { on: Math.PI / 2, mul: 0.55, x: -23, y: 8, k: 'stroke', r: 2.4 }
  ];
  function drawPrints(tr, feet) {
    var TAU = 6.2832, K = 1.45;                      // the body painter's scale on the hill
    ctx.save();
    for (var i = 1; i < tr.length; i++) {
      var p0 = tr[i - 1], p1 = tr[i];
      if (p0.x === null || p1.x === null || p1.g === undefined || p0.g === undefined || p1.g <= p0.g) continue;
      for (var f = 0; f < feet.length; f++) {
        var F = feet[f];
        /* the gait's clock passes this foot's landing between the two points */
        var m = F.mul || 1, g0 = p0.g * m, g1 = p1.g * m;
        var n0 = Math.floor((g0 - F.on) / TAU), n1 = Math.floor((g1 - F.on) / TAU);
        if (n1 === n0) continue;
        var t = ((n1 * TAU + F.on) - g0) / (g1 - g0);
        var x = p0.x + (p1.x - p0.x) * t, d = p0.d + (p1.d - p0.d) * t, a = p0.a + (p1.a - p0.a) * t;
        var px = x + (F.x * Math.cos(a) - F.y * Math.sin(a)) * K;
        var pd = d - (F.x * Math.sin(a) + F.y * Math.cos(a)) * K;
        var fade = 1 - clamp((W.dist - pd) / (BEHIND + 40), 0, 1);
        if (fade <= 0) continue;
        stampPrint(scrX(px), scrY(pd), a, F, fade * K, p1.rush);
      }
    }
    ctx.restore();
  }
  /* One print, pressed into the ice: the hollow in the shade the groove
     has, and the snow it pushed up catching the light on the far side. */
  function stampPrint(x, y, a, F, k, gold) {
    /* larger than life: a hoof print to scale is a few pixels across on a
       phone, and the eye reads them as specks, not as tracks */
    var r = F.r * k * 1.9, al = clamp(k / 1.45, 0, 1);
    var dark = gold ? 'rgba(150,110,40,' : 'rgba(40,96,140,';
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    if (F.k === 'hoof') {
      /* cloven: two toes, a gap between them, pointing ahead */
      [-1, 1].forEach(function (s2) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * al).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(s2 * r * 0.5 + 1, 1, r * 0.46, r * 0.86, s2 * 0.12, 0, 6.2832); ctx.fill();
        ctx.fillStyle = dark + (0.5 * al).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(s2 * r * 0.5, 0, r * 0.42, r * 0.8, s2 * 0.12, 0, 6.2832); ctx.fill();
      });
    } else if (F.k === 'pad') {
      /* a paw: the heel pad and four toes ahead of it (a cat's, a lemming's) */
      ctx.fillStyle = dark + (0.34 * al).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.62, r * 0.5, 0, 0, 6.2832); ctx.fill();
      for (var tq = 0; tq < 4; tq++) {
        var ta = -0.75 + tq * 0.5;
        ctx.beginPath(); ctx.ellipse(Math.sin(ta) * r * 0.85, -r * 0.55 - Math.cos(ta) * r * 0.25, r * 0.24, r * 0.3, ta * 0.5, 0, 6.2832); ctx.fill();
      }
    } else if (F.k === 'scuff' || F.k === 'stroke') {
      /* a penguin's: a foot's short scuff, a flipper's long brush swept
         out to its side */
      var st = F.k === 'stroke', sd2 = F.x < 0 ? -1 : 1;
      ctx.rotate(sd2 * (st ? 0.35 : 0.15));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * al).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(0.7, 0.5, r * (st ? 0.42 : 0.55), r * (st ? 3.2 : 1.4), 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = dark + ((st ? 0.36 : 0.45) * al).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, r * (st ? 0.38 : 0.5), r * (st ? 3 : 1.3), 0, 0, 6.2832); ctx.fill();
    } else {
      /* a long foot (a hare's hind foot) or a small round one */
      var long = F.k === 'long';
      ctx.fillStyle = 'rgba(255,255,255,' + (0.4 * al).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(0.6, 0.6, r * (long ? 0.55 : 0.6), r * (long ? 1.5 : 0.7), 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = dark + (0.34 * al).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, r * (long ? 0.5 : 0.55), r * (long ? 1.4 : 0.65), 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  /* The avalanche: a churning wall of snow coming up from the bottom of
     the screen, its top edge where the snow has got to. Out of sight, a
     cold haze along the bottom edge says it is there and how near. */
  /* In Freeride the avalanche is never seen, only felt: once the hill is
     fast, a cold haze along the bottom edge, thicker the faster he goes,
     and a far-off rumble now and then. It cannot catch anyone here. */
  function freerideSnow() {
    return (W && W.mode === 'free' && !W.course && W.state === 'run')
         ? clamp((pace() - 0.55) / 0.45, 0, 1) : 0;
  }
  function snowHaze(near) {
    var hz = VIEW_H * (0.10 + 0.16 * near);
    var g = ctx.createLinearGradient(0, VIEW_H - hz, 0, VIEW_H);
    g.addColorStop(0, 'rgba(236,246,255,0)');
    g.addColorStop(1, 'rgba(236,246,255,' + (0.35 + 0.45 * near).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, VIEW_H - hz, VIEW_W, hz);
  }
  function drawAvalanche() {
    if (!W) return;
    if (W.mode !== 'avalanche') {
      var fs = freerideSnow();
      if (fs > 0) snowHaze(fs * 0.6);
      return;
    }
    var top = PLAYER_Y + W.avGap, t = W.t;
    var near = clamp(1 - (top - VIEW_H) / 420, 0, 1);
    if (near > 0) snowHaze(near);
    if (top > VIEW_H + 40) return;
    /* the body: solid snow from the edge down, shaded towards the bottom */
    var body = ctx.createLinearGradient(0, top, 0, VIEW_H);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.35, '#e4f0f8');
    body.addColorStop(1, '#b9d2e4');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H + 10);
    for (var x = 0; x <= VIEW_W + 20; x += 20) {
      var wob = Math.sin(x * 0.031 + t * 0.09) * 9 + Math.sin(x * 0.083 - t * 0.13) * 5;
      ctx.lineTo(x, top + wob);
    }
    ctx.lineTo(VIEW_W, VIEW_H + 10);
    ctx.closePath();
    ctx.fill();
    /* a shaded back row first, larger and higher, so the front has depth */
    for (var j = 0; j < 12; j++) {
      var jx = ((j * 131 - t * 0.4) % (VIEW_W + 160) + VIEW_W + 160) % (VIEW_W + 160) - 80;
      var jr = 38 + (j * 23 % 18) + Math.sin(t * 0.05 + j * 2.3) * 6;
      ctx.fillStyle = j % 2 ? '#d6e6f2' : '#c9dcec';
      ctx.beginPath(); ctx.arc(jx, top - 6 + Math.sin(t * 0.08 + j) * 5, jr, 0, Math.PI * 2); ctx.fill();
    }
    /* billows rolling along the front */
    for (var i = 0; i < 16; i++) {
      var bx = ((i * 97 + t * (i % 2 ? 0.7 : -0.5)) % (VIEW_W + 120) + VIEW_W + 120) % (VIEW_W + 120) - 60;
      var br = 26 + (i * 37 % 22) + Math.sin(t * 0.07 + i) * 5;
      var by = top + 4 + Math.sin(t * 0.11 + i * 1.7) * 6;
      ctx.fillStyle = i % 3 ? '#ffffff' : '#eef6fc';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    /* spray thrown up ahead of it */
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (var k = 0; k < 24; k++) {
      var sx = (k * 53 + t * 1.3 * (k % 3 + 1)) % VIEW_W;
      var sy = top - 18 - ((k * 29 + t * 2.1) % 60);
      ctx.beginPath(); ctx.arc(sx, sy, 2 + (k % 3), 0, Math.PI * 2); ctx.fill();
    }
  }

  /* The light over the whole picture, the way a camera sees it: the sun's
     warmth spilling in from the upper left, the corners falling off a
     little, and on a crash a flash of white and a ring of snow thrown out
     from where he hit. Cached: the gradients only change with the screen
     size, and two full-screen gradients built every frame are not free. */
  var lightMoon = null;
  function drawLight() {
    var B = pal(), ib = String(B.iceBot || '#8ccbec');
    /* the light itself is a layer over the canvas (index.html #light);
       on a dark stretch it turns to moonlight, cool and fainter */
    var dark = ib.charCodeAt(0) === 35 && ib.length >= 7 &&
      (parseInt(ib.substr(1, 2), 16) * 0.3 + parseInt(ib.substr(3, 2), 16) * 0.59 + parseInt(ib.substr(5, 2), 16) * 0.11) < 120;
    if (dark !== lightMoon && typeof document !== 'undefined') {
      var el = document.getElementById('light');
      if (el && el.classList) el.classList.toggle('moon', dark);
      lightMoon = dark;
    }
    if (W.impact > 0) {
      var im = W.impact;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * im * im).toFixed(3) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      var cx = scrX(W.px), cy = PLAYER_Y, rad = 30 + (1 - im) * 140;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * im).toFixed(3) + ')';
      ctx.lineWidth = 3 + 9 * im;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.stroke();
    }
  }

  function drawPaceVignette() {
    var sp = pace();
    if (sp < 0.12 || SPARE) return;
    var k = clamp((sp - 0.12) / 0.6, 0, 1);
    var w = VIEW_W * (0.34 - 0.10 * k);
    var a = 'rgba(22,52,82,' + (0.26 * k).toFixed(3) + ')', clear = 'rgba(22,52,82,0)';
    /* two strips, one down each side: the middle of a gradient across the
       whole screen was clear, and filling it was a pass over every pixel
       for nothing */
    var gl = ctx.createLinearGradient(0, 0, w, 0);
    gl.addColorStop(0, a); gl.addColorStop(1, clear);
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, VIEW_H);
    var gr = ctx.createLinearGradient(VIEW_W - w, 0, VIEW_W, 0);
    gr.addColorStop(0, clear); gr.addColorStop(1, a);
    ctx.fillStyle = gr; ctx.fillRect(VIEW_W - w, 0, w, VIEW_H);
  }

  /* Where the next few openings are, drawn on the ice. The one find that
     gives you information rather than protection — and the owl carries a
     faint version of it permanently. */
  function drawSightLine() {
    if (!seeing()) return;
    var full = W.sightT > 0;
    var fade = full ? Math.min(1, W.sightT / 45) : 0.42;
    var rows = [], i;
    for (i = 0; i < W.rows.length && rows.length < 3; i++)
      if (W.rows[i].d > W.dist + 20) rows.push(W.rows[i]);
    if (!rows.length) return;

    /* A path of light, the way the lens shows it: a smooth curve from him
       through the next openings, gold lights flowing along it towards
       them, smaller and fainter as they go, and a pool of light on the ice
       in each opening. It was a straight green ribbon broken at every
       opening, with a ring drawn round each — a diagram, not a light. */
    var pts = [[scrX(W.px), PLAYER_Y - 18]];
    for (i = 0; i < rows.length; i++) pts.push([scrX(chuteAt(rows[i].d) + rows[i].gap), scrY(rows[i].d)]);
    /* sample a Catmull-Rom curve through them */
    var path = [];
    for (i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var tt = 0; tt < 1; tt += 0.05) {
        var t2 = tt * tt, t3 = t2 * tt;
        path.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * tt + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                   0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * tt + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    path.push(pts[pts.length - 1]);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    /* a faint glow under the whole path, so it reads as one line */
    ctx.beginPath();
    path.forEach(function (q, n) { n ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.strokeStyle = 'rgba(255,200,90,' + (0.2 * fade).toFixed(3) + ')';
    ctx.lineWidth = 12; ctx.stroke();
    /* lights every 16px along it, flowing forward */
    var total = 0, seg = [];
    for (i = 1; i < path.length; i++) {
      var dl = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      seg.push(dl); total += dl;
    }
    var gapPx = 16, off = (W.t * 0.9) % gapPx, at = off, si = 0, acc = 0;
    while (at < total && si < seg.length) {
      while (si < seg.length && acc + seg[si] < at) { acc += seg[si]; si++; }
      if (si >= seg.length) break;
      var f = (at - acc) / seg[si];
      var lx = path[si][0] + (path[si + 1][0] - path[si][0]) * f;
      var ly = path[si][1] + (path[si + 1][1] - path[si][1]) * f;
      var u = at / total, a = fade * (1 - u * 0.65), r = 4.2 - u * 2;
      ctx.fillStyle = 'rgba(255,196,60,' + (0.4 * a).toFixed(3) + ')';            // warm halo
      ctx.beginPath(); ctx.arc(lx, ly, r * 2.1, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,186,40,' + (0.95 * a).toFixed(3) + ')';           // the light
      ctx.beginPath(); ctx.arc(lx, ly, r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,252,230,' + (0.9 * a).toFixed(3) + ')';           // its bright heart
      ctx.beginPath(); ctx.arc(lx - r * 0.25, ly - r * 0.25, r * 0.45, 0, 6.2832); ctx.fill();
      at += gapPx;
    }
    /* a pool of light on the ice in each opening, the nearest strongest */
    for (i = 0; i < rows.length; i++) {
      var rx = pts[i + 1][0], ry = pts[i + 1][1], k = 1 - i * 0.28;
      var pool = ctx.createRadialGradient(rx, ry, 1, rx, ry, 34 * k);
      pool.addColorStop(0, 'rgba(255,206,90,' + (0.6 * fade * k).toFixed(3) + ')');
      pool.addColorStop(1, 'rgba(255,206,90,0)');
      ctx.fillStyle = pool;
      ctx.beginPath(); ctx.ellipse(rx, ry, 34 * k, 15 * k, 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  /* An aurora seen from above is not a curtain in the sky — it is the light
     it lays on the snow. Three slow bands, each on its own drift, so the
     pattern never repeats within a run. */
  function drawAurora() {
    var B = pal(), amt = B.aurora ? (B.auroraA === undefined ? 1 : B.auroraA) : 0;
    if (amt <= 0.01 || SPARE) return;
    ctx.save();
    /* Rotating the whole band is the simple way to lean it. Skewing it with
       a transform put two of the three off the side of the screen. */
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    var reach = Math.max(VIEW_W, VIEW_H) * 1.6;
    for (var b = 0; b < 3; b++) {
      var ph = W.t * (0.0014 + b * 0.0008) + b * 2.1;
      var cx = VIEW_W * 0.46 * Math.sin(ph);
      var w = VIEW_W * (0.26 + 0.11 * Math.sin(ph * 1.7 + b));
      var tint = b === 1 ? '118,164,240' : B.aurora;   // one band runs colder
      var g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
      g.addColorStop(0, 'rgba(' + tint + ',0)');
      g.addColorStop(0.42, 'rgba(' + tint + ',' + (0.30 * amt).toFixed(3) + ')');
      g.addColorStop(0.60, 'rgba(' + tint + ',' + (0.42 * amt).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + tint + ',0)');
      ctx.save();
      ctx.rotate(0.26 * Math.sin(ph * 0.6 + b * 1.3));
      ctx.fillStyle = g;
      ctx.fillRect(cx - w, -reach / 2, w * 2, reach);
      ctx.restore();
    }
    ctx.restore();
  }

  /* The lava field lights the run from the edges inward, the way ground
     heat actually shows from above: brightest against the banks. */
  function drawEmberGlow() {
    var B = pal(), amt = B.ember || 0;
    if (amt <= 0.01 || SPARE) return;  // the lava itself (drawGround) stays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var puls = 0.78 + 0.22 * Math.sin(W.t * 0.021) + 0.08 * Math.sin(W.t * 0.071);
    var g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    var mid = 'rgba(255,92,24,0)';
    g.addColorStop(0, 'rgba(255,104,28,' + (0.34 * amt * puls).toFixed(3) + ')');
    g.addColorStop(0.18, mid);
    g.addColorStop(0.82, mid);
    g.addColorStop(1, 'rgba(255,104,28,' + (0.34 * amt * puls).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    /* What is under the ice, showing through it. The vents are pinned to
       world distance, so they slide past with the hill instead of sitting
       on the screen, and each breathes on its own clock. */
    var v = B.vents || 0;
    if (v > 0.01) {
      var base = Math.floor(W.dist / 260) * 260;
      for (var i = -1; i < 6; i++) {
        var vd = base + i * 260;
        var vy = scrY(vd);
        if (vy < -180 || vy > VIEW_H + 180) continue;
        var j = Math.abs(Math.sin(vd * 0.0137));
        var vx = scrX(Math.sin(vd * 0.0041) * CHUTE * 0.72);
        var rad = 70 + j * 110;
        var br = (0.30 + 0.22 * Math.sin(W.t * 0.017 + j * 9)) * v;
        var rg = ctx.createRadialGradient(vx, vy, 0, vx, vy, rad);
        rg.addColorStop(0, 'rgba(255,152,52,' + br.toFixed(3) + ')');
        rg.addColorStop(0.45, 'rgba(226,74,22,' + (br * 0.40).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(180,40,12,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(vx, vy, rad, 0, 6.2832); ctx.fill();
      }
    }
    ctx.restore();
  }


  /* The readouts, laid out in CSS pixels so they are the same physical size
     on every device. Everything below is measured off `u`, which is tied to
     the shorter edge of the screen — that keeps them chunky on a phone and
     stops them swelling to billboards on a desktop. */
  function drawHud() {
    if (W.demo) return;
    ctx.save();
    ctx.setTransform(hudK, 0, 0, hudK, 0, 0);

    var u = Math.max(13, Math.min(22, Math.min(CSS_W, CSS_H) / 26));
    var padL = 12 + INSET_L, padT = 12 + INSET_T;
    var FONT = 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';

    /* ---- everything you are reading, in one place ----
       Score, metres, the catch, spare lives and the best used to be three
       separate things: a dark score card, a BEST pill of another style
       that collided with it on a phone, and the lives on a chip of their
       own. They are one slab of the same ice as the menus now, sized to
       what it holds, so nothing can run into anything else. */
    /* ---- what you are reading, as a game shows it ----
       It was one white slab of menu ice in the corner — tidy, and exactly
       what a form looks like. Now the score stands on the hill by itself,
       big, white, outlined in the deep blue of the buttons and lifted by
       a shadow, readable over snow and over a night run alike; and the
       metres, the catch and the spare lives each sit in a small dark pill
       with its own picture, the way a game's counters do. */
    var gap = u * 0.45;
    var fS = Math.round(u * 1.95), fM = Math.round(u * 0.98), fB = Math.round(u * 0.74), fL = Math.round(u * 0.6);
    /* Time Rush reads the clock where the score would be: it is the thing
       you are racing, and the score there is the distance underneath. */
    var timed = W.mode === 'rush';
    /* Avalanche reads the lead on the snow there instead, in metres. */
    var aval = W.mode === 'avalanche', lead = Math.floor(W.avGap / 8);
    var score = timed ? (W.timeT / 60).toFixed(1)
              : aval ? lead + ' ' + tr('hud.m', 'M') : String(Math.floor(W.score));
    var scoreLab = timed ? tr('hud.time', 'TIME') : aval ? tr('hud.av', 'AVALANCHE') : tr('hud.score', 'SCORE');
    var distTxt = String(Math.floor(W.dist / 8)) + ' ' + tr('hud.m', 'M');
    /* The catch as the purse counts it — the same number the results card
       adds to your fish — and not the count of fish swallowed, which a
       creature's perk makes a different number. */
    var fishTxt = String(W.coins);
    var lifeTxt = (W.lives > 0 && !timed && !aval) ? String(W.lives) : '';
    /* The best is a Freeride number. On a marked run it is another game's
       score, so it is not shown there at all. */
    var bestTxt = (W.best > 0 && !W.course)
                ? tr('hud.best', 'BEST') + '  ' + W.best + ((timed || aval) ? ' ' + tr('hud.m', 'M') : '') : '';

    var mult = comboMult();
    /* Widths are taken as if every digit were the widest one. The font's
       digits are proportional — a 1 is narrower than an 8 — so measured as
       they stood, everything after the metres shuffled a pixel or two every
       frame as the numbers ticked over. Now the layout only moves when a
       number gains a digit. */
    function tab(t2) { return String(t2).replace(/[0-9]/g, '8'); }
    function outlined(txt, x, y, px, fill, ow) {
      ctx.font = '800 ' + px + FONT;
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = ow; ctx.strokeStyle = 'rgba(2,18,52,.35)';
      ctx.strokeText(txt, x, y + px * 0.07);                       // the drop under it
      ctx.strokeStyle = '#062a78'; ctx.strokeText(txt, x, y);
      ctx.fillStyle = fill; ctx.fillText(txt, x, y);
    }
    function pill(x, y, w2, h2) {
      ctx.fillStyle = 'rgba(6,30,74,.5)';
      rr(ctx, x, y, w2, h2, h2 / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, u * 0.07);
      rr(ctx, x + 0.5, y + 0.5, w2 - 1, h2 - 1, h2 / 2); ctx.stroke();
    }
    var x0 = padL + u * 0.15;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* the label over the score, then the score, the big one */
    var yL = padT + fL * 0.9;
    outlined(scoreLab, x0 + u * 0.1, yL, fL, 'rgba(255,255,255,.92)', Math.max(2, u * 0.22));
    var y1 = yL + u * 0.15 + fS * 0.86;
    var secs = W.timeT / 60;
    var sFill = aval ? (lead < 15 ? '#ff6b7d' : lead < 30 ? '#ffb24d' : '#ffffff')
              : !timed ? '#ffffff' : secs < 5 ? '#ff6b7d' : secs < 8 ? '#ffb24d' : '#ffffff';
    if ((timed && secs < 5) || (aval && lead < 15)) ctx.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(W.t * 0.15));
    outlined(score, x0, y1, fS, sFill, Math.max(4, u * 0.36));
    ctx.globalAlpha = 1;
    var after = x0 + measureAt(tab(score), fS) + u * 0.5;
    /* the run of catches, as a multiplier on points */
    if (mult > 1) {
      var mx = after;
      ctx.fillStyle = '#ffcd3a';
      rr(ctx, mx, y1 - u * 1.25, u * 2.1, u * 1.3, u * 0.65); ctx.fill();
      ctx.strokeStyle = '#062a78'; ctx.lineWidth = Math.max(2, u * 0.14);
      rr(ctx, mx, y1 - u * 1.25, u * 2.1, u * 1.3, u * 0.65); ctx.stroke();
      ctx.font = '800 ' + Math.round(u * 0.9) + FONT;
      ctx.fillStyle = '#7a4a00'; ctx.textAlign = 'center';
      ctx.fillText('x' + mult, mx + u * 1.05, y1 - u * 0.28);
      ctx.textAlign = 'left';
      after += u * 2.5;
    }
    /* what the last ring won back from the snow, for a moment */
    if (aval && W.avPush > 0) {
      ctx.globalAlpha = Math.min(1, W.avPush / 20);
      outlined('+' + Math.round(W.avPushN / 8) + ' ' + tr('hud.m', 'M'), after, y1 - u * 0.2, Math.round(u * 1.0), '#8dffb8', Math.max(3, u * 0.22));
      ctx.globalAlpha = 1;
    }
    /* what the last crash cost, for a moment */
    if (timed && W.penT > 0) {
      ctx.globalAlpha = Math.min(1, W.penT / 20);
      outlined('-' + Math.round(CRASH_COST / 60) + tr('hud.s', 's'), after, y1 - u * 0.2, Math.round(u * 1.0), '#ff6b7d', Math.max(3, u * 0.22));
      ctx.globalAlpha = 1;
    }

    /* metres · the catch · spare lives, each in its own pill */
    var ph = Math.round(fM * 1.45), py = y1 + gap + u * 0.25, pp = u * 0.5, ic = u * 1.15;
    var wDist = ic + measureAt(tab(distTxt), fM), wFish = ic * 1.08 + measureAt(tab(fishTxt), fM);
    var wLife = lifeTxt ? ic + measureAt(tab(lifeTxt), fM) : 0;
    var tY = py + ph / 2 + fM * 0.34;
    ctx.font = '800 ' + fM + FONT;
    var px1 = x0;
    pill(px1, py, wDist + pp * 2, ph);
    /* a little flag on a pole: how far down the hill */
    var flx = px1 + pp + ic * 0.32, fly = py + ph * 0.24;
    ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = Math.max(1.5, u * 0.1);
    ctx.beginPath(); ctx.moveTo(flx, fly); ctx.lineTo(flx, py + ph * 0.78); ctx.stroke();
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath(); ctx.moveTo(flx, fly); ctx.lineTo(flx + ic * 0.5, fly + ph * 0.13); ctx.lineTo(flx, fly + ph * 0.26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(distTxt, px1 + pp + ic, tY);
    var fx = px1 + wDist + pp * 2 + u * 0.35;
    pill(fx, py, wFish + pp * 2, ph);
    /* it jumps when you catch one */
    if (hudCoinsSeen >= 0 && W.coins > hudCoinsSeen) hudBump = 1;
    hudCoinsSeen = W.coins;
    if (hudBump > 0) hudBump = Math.max(0, hudBump - 0.06);
    hudFish(fx + pp + ic * 0.48, py + ph / 2, u * 0.47, hudBump > 0 ? 1 - hudBump : 0);
    ctx.font = '800 ' + fM + FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fishTxt, fx + pp + ic * 1.08, tY);
    var w = fx + wFish + pp * 2 - x0;
    if (lifeTxt) {
      var lx = fx + wFish + pp * 2 + u * 0.35;
      pill(lx, py, wLife + pp * 2, ph);
      drawHeart(lx + pp + ic * 0.4, py + ph / 2 + u * 0.02, u * 0.46);
      ctx.font = '800 ' + fM + FONT;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(lifeTxt, lx + pp + ic, tY);
      w = lx + wLife + pp * 2 - x0;
    }
    hudLayout = { w: Math.round(w), fx: Math.round(fx), digits: score.length + '|' + distTxt.length + '|' + fishTxt.length };

    /* and the best, small, in gold underneath */
    if (bestTxt) {
      var y3 = py + ph + gap + fB * 0.95;
      outlined(bestTxt, x0 + u * 0.1, y3, fB, '#ffd96a', Math.max(2, u * 0.22));
    }

    /* The right-hand corner holds the timed things. In the tutorial the
       Skip button lives there, so they sit below it. */
    var rY = padT + ((W.course && W.course.tut) ? 56 : 0);

    /* Everything that runs out, each in its own pill: what it is (its
       picture), how long it has left in seconds, and a bar emptying under
       it; the last two seconds blink, so nothing simply stops. The rush
       ball had the only clock; the magnet, the cold snap and the lens ran
       out with no warning at all. */
    function timerPill(left, max, kind) {
      var txt = (left / 60).toFixed(1) + tr('hud.s', 'S');
      ctx.font = '800 ' + Math.round(u * 0.95) + FONT;
      var tw = measureAt(tab(txt), Math.round(u * 0.95));
      var ph2 = u * 1.8, pw = tw + u * 2.9, px2 = CSS_W - padL - pw;
      var warn = left < 120 ? 0.45 + 0.55 * Math.abs(Math.sin(W.t * 0.3)) : 1;
      ctx.save();
      ctx.globalAlpha = warn;
      ctx.fillStyle = 'rgba(255,255,255,.93)';
      rr(ctx, px2, rY, pw, ph2, ph2 / 2); ctx.fill();
      ctx.strokeStyle = '#062a78'; ctx.lineWidth = Math.max(2, u * 0.12);
      rr(ctx, px2, rY, pw, ph2, ph2 / 2); ctx.stroke();
      /* the bar, emptying along the bottom */
      var bw = (pw - ph2) * Math.max(0, left / max);
      ctx.fillStyle = kind === 'call' ? '#e2453c' : kind === 'sight' ? '#7cc443' : kind === 'chill' ? '#55b8f0' : '#3f93cc';
      rr(ctx, px2 + ph2 / 2, rY + ph2 - u * 0.42, bw, u * 0.22, u * 0.11); ctx.fill();
      /* its picture */
      var ix = px2 + u * 0.95, iy = rY + ph2 * 0.46, ir = u * 0.48;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (kind === 'call') {                         // a horseshoe magnet, red with silver tips
        ctx.lineWidth = ir * 0.62; ctx.strokeStyle = '#e2453c';
        ctx.beginPath(); ctx.arc(ix, iy + ir * 0.1, ir * 0.62, Math.PI * 0.05, Math.PI * 0.95, false); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ix - ir * 0.62, iy + ir * 0.1); ctx.lineTo(ix - ir * 0.62, iy - ir * 0.55);
        ctx.moveTo(ix + ir * 0.62, iy + ir * 0.1); ctx.lineTo(ix + ir * 0.62, iy - ir * 0.55); ctx.stroke();
        ctx.strokeStyle = '#dfe6ee'; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(ix - ir * 0.62, iy - ir * 0.45); ctx.lineTo(ix - ir * 0.62, iy - ir * 0.85);
        ctx.moveTo(ix + ir * 0.62, iy - ir * 0.45); ctx.lineTo(ix + ir * 0.62, iy - ir * 0.85); ctx.stroke();
      } else if (kind === 'chill') {                 // a snowflake
        ctx.strokeStyle = '#2f8fd0'; ctx.lineWidth = Math.max(1.4, ir * 0.2);
        for (var sf = 0; sf < 3; sf++) {
          var sa3 = sf * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(ix - Math.cos(sa3) * ir, iy - Math.sin(sa3) * ir); ctx.lineTo(ix + Math.cos(sa3) * ir, iy + Math.sin(sa3) * ir); ctx.stroke();
        }
      } else if (kind === 'sight') {                 // a lens with the gold line in it
        ctx.fillStyle = '#e9f8d8'; ctx.strokeStyle = '#4f9a3c'; ctx.lineWidth = Math.max(1.4, ir * 0.2);
        ctx.beginPath(); ctx.arc(ix - ir * 0.1, iy - ir * 0.1, ir * 0.68, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ix + ir * 0.38, iy + ir * 0.38); ctx.lineTo(ix + ir * 0.85, iy + ir * 0.85); ctx.stroke();
        ctx.fillStyle = '#ffcd3a';
        for (var sd = 0; sd < 3; sd++) { ctx.beginPath(); ctx.arc(ix - ir * 0.45 + sd * ir * 0.35, iy + ir * 0.12 - sd * ir * 0.22, ir * 0.11, 0, 6.2832); ctx.fill(); }
      } else {                                       // the rush: a ball of packed powder
        var bgr = ctx.createRadialGradient(ix - ir * 0.3, iy - ir * 0.3, 1, ix, iy, ir);
        bgr.addColorStop(0, '#ffffff'); bgr.addColorStop(1, '#a9d8f2');
        ctx.fillStyle = bgr; ctx.strokeStyle = '#3f93cc'; ctx.lineWidth = Math.max(1.2, ir * 0.16);
        ctx.beginPath(); ctx.arc(ix, iy, ir * 0.8, 0, 6.2832); ctx.fill(); ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.font = '800 ' + Math.round(u * 0.95) + FONT;
      ctx.fillStyle = '#0b3d7a';
      ctx.fillText(txt, px2 + u * 1.75, rY + ph2 * 0.66);
      ctx.restore();
      rY += ph2 + u * 0.45;
    }
    if (W.rushT > 0)  timerPill(W.rushT, RUSH_FRAMES, 'rush');
    if (W.callT > 0)  timerPill(W.callT, CALL_FRAMES, 'call');
    if (W.chillT > 0) timerPill(W.chillT, CHILL_FRAMES, 'chill');
    if (W.sightT > 0) timerPill(W.sightT, SIGHT_FRAMES, 'sight');

    if (W.shield > 0) {
      ctx.save();
      ctx.translate(CSS_W - padL - u * 1.0, rY + u * 1.0);
      var g = ctx.createRadialGradient(-u * 0.22, -u * 0.26, 1, 0, 0, u * 0.85);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(140,220,255,.35)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, u * 0.85, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(210,245,255,.95)'; ctx.lineWidth = u * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, u * 0.85, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }

    /* Its own clock. It used to ride on tapFlash — the flash every tap and
       every pickup sets — gated on being near the start of a zone; a marked
       run never leaves its first zone, so on every course the name came
       back on every single tap. */
    if (W.zoneT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, W.zoneT / 20);
      ctx.textAlign = 'center';
      ctx.font = '800 ' + Math.round(u * 1.5) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
      ctx.lineWidth = u * 0.34; ctx.strokeStyle = 'rgba(255,255,255,.92)';
      var zone = tr('biome.' + (W.biome % BIOMES.length), biome().name);
      ctx.strokeText(zone, CSS_W / 2, CSS_H * 0.2);
      ctx.fillStyle = '#12496f';
      ctx.fillText(zone, CSS_W / 2, CSS_H * 0.2);
      ctx.restore();
    }
    ctx.restore();
  }

  var hudLayout = null;

  /* The fish on the readout: still, and drawn for its size. The swimming
     fish off the hill, shrunk into the panel, flicked its tail and bobbed
     beside a number that was trying to be read. */
  /* Drawn as a game's icon now: a plump fish with a pale belly, a forked
     tail and fins, fine scales, a gloss along its back and an eye with a
     light in it, outlined in the buttons' deep blue. `bump` (0..1) is the
     little jump it gives when you catch one. */
  function hudFish(x, y, r, bump) {
    ctx.save();
    ctx.translate(x, y);
    if (bump) { var bs = 1 + 0.35 * Math.sin(bump * Math.PI); ctx.scale(bs, bs); ctx.rotate(-0.25 * Math.sin(bump * Math.PI)); }
    var ow = Math.max(1, r * 0.12);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#062a78'; ctx.lineWidth = ow;
    /* forked tail */
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, 0);
    ctx.quadraticCurveTo(-r * 1.1, -r * 0.2, -r * 1.42, -r * 0.72);
    ctx.quadraticCurveTo(-r * 1.2, -r * 0.05, -r * 1.3, 0);
    ctx.quadraticCurveTo(-r * 1.2, r * 0.05, -r * 1.42, r * 0.72);
    ctx.quadraticCurveTo(-r * 1.1, r * 0.2, -r * 0.72, 0);
    ctx.closePath();
    ctx.fillStyle = '#2a86cc'; ctx.fill(); ctx.stroke();
    /* dorsal fin */
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.55); ctx.quadraticCurveTo(-r * 0.05, -r * 1.05, r * 0.3, -r * 0.6); ctx.closePath();
    ctx.fillStyle = '#2a86cc'; ctx.fill(); ctx.stroke();
    /* body */
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.02, r * 0.7, 0, 0, 6.2832);
    var g = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, '#4fb2f0'); g.addColorStop(0.55, '#7fcdf8'); g.addColorStop(1, '#d9f3ff');
    ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(20,90,160,.3)'; ctx.lineWidth = Math.max(0.7, r * 0.08);   // scales
    for (var sc = 0; sc < 3; sc++) {
      ctx.beginPath(); ctx.arc(-r * 0.45 + sc * r * 0.32, -r * 0.08, r * 0.22, -1.2, 1.2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.55)';                                             // gloss
    ctx.beginPath(); ctx.ellipse(-r * 0.1, -r * 0.38, r * 0.55, r * 0.14, -0.08, 0, 6.2832); ctx.fill();
    ctx.restore();
    /* pectoral fin */
    ctx.beginPath();
    ctx.moveTo(r * 0.05, r * 0.12); ctx.quadraticCurveTo(-r * 0.1, r * 0.5, -r * 0.4, r * 0.38); ctx.closePath();
    ctx.fillStyle = '#3c9ee0'; ctx.fill();
    ctx.lineWidth = ow * 0.7; ctx.stroke();
    /* the eye, with a light in it, and a smile */
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.12, r * 0.24, 0, 6.2832); ctx.fill();
    ctx.lineWidth = ow * 0.6; ctx.stroke();
    ctx.fillStyle = '#062a78';
    ctx.beginPath(); ctx.arc(r * 0.56, -r * 0.1, r * 0.12, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.15, r * 0.045, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#062a78'; ctx.lineWidth = ow * 0.55;
    ctx.beginPath(); ctx.arc(r * 0.72, r * 0.18, r * 0.14, 0.4, 1.9); ctx.stroke();
    ctx.restore();
  }
  var hudCoinsSeen = -1, hudBump = 0;

  /* Measuring at a size other than the one currently set, without leaving
     the font changed behind us. */
  function measureAt(txt, px) {
    var keep = ctx.font;
    ctx.font = '800 ' + px + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    var wd = ctx.measureText(txt).width;
    ctx.font = keep;
    return wd;
  }

  /* A heart with a proper cleft. The old curve had its control points so
     far out that the lobes swallowed the notch and it came out a blob. */
  function heartPath(c, r) {
    c.beginPath();
    c.moveTo(0, r * 1.0);
    c.bezierCurveTo(-r * 0.62, r * 0.42, -r * 1.12, -r * 0.08, -r * 1.0, -r * 0.46);
    c.bezierCurveTo(-r * 0.92, -r * 0.92, -r * 0.34, -r * 1.00, 0, -r * 0.52);
    c.bezierCurveTo(r * 0.34, -r * 1.00, r * 0.92, -r * 0.92, r * 1.0, -r * 0.46);
    c.bezierCurveTo(r * 1.12, -r * 0.08, r * 0.62, r * 0.42, 0, r * 1.0);
    c.closePath();
  }
  function drawHeart(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    heartPath(ctx, r);
    var g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#ff8fa0');
    g.addColorStop(1, '#e03b55');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';         // one highlight
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.22, r * 0.14, -0.5, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /* ====================== VIEWPORT / LOOP ====================== */
  var CSS_W = 960, CSS_H = 540, hudK = 1;
  var dprQuery = null;
  function setup() {
    canvas = document.getElementById('game');
    stage  = document.getElementById('stage');
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', reflow);
    window.addEventListener('orientationchange', reflow);
    /* On phones the visual viewport changes on its own when the browser
       chrome slides away, and after a rotation innerHeight is briefly the
       old one — so measure again a moment later. */
    if (window.visualViewport && window.visualViewport.addEventListener)
      window.visualViewport.addEventListener('resize', reflow);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    watchDpr();
  }
  var reflowT = null;
  function reflow() {
    resize();
    if (reflowT) clearTimeout(reflowT);
    reflowT = setTimeout(function () { reflowT = null; resize(); }, 260);
  }

  function watchDpr() {
    if (!window.matchMedia) return;
    if (dprQuery && dprQuery.removeEventListener) dprQuery.removeEventListener('change', onDpr);
    dprQuery = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    if (dprQuery.addEventListener) dprQuery.addEventListener('change', onDpr);
  }
  function onDpr() { resize(); watchDpr(); }

  /* The corner the readouts sit in can be under a phone's camera hole or
     rounded glass when the page runs edge to edge (the Android app does).
     The browser reports those margins as env(safe-area-inset-*); reading
     them through a probe element is the only way a canvas can know them.
     Everywhere else they are 0 and nothing moves. */
  var INSET_T = 0, INSET_L = 0, insetProbe = null;
  function readInsets() {
    try {
      if (!insetProbe) {
        insetProbe = document.createElement('div');
        insetProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
          'padding-top:env(safe-area-inset-top,0px);padding-left:env(safe-area-inset-left,0px)';
        document.body.appendChild(insetProbe);
      }
      var cs = getComputedStyle(insetProbe);
      INSET_T = parseFloat(cs.paddingTop) || 0;
      INSET_L = parseFloat(cs.paddingLeft) || 0;
    } catch (e) { INSET_T = INSET_L = 0; }
  }

  function resize() {
    if (!canvas) return;
    var vw = Math.max(1, window.innerWidth || 960), vh = Math.max(1, window.innerHeight || 540);

    var scale = Math.min(vw / SAFE_W, vh / SAFE_H);   // world units per css pixel
    /* A platform may ask for more hill above the penguin on a wide, short
       window (crazygames.js: on a 16:9 desktop the safe region alone left
       well under half the lookahead a phone gets). Unset everywhere else. */
    var minH = (window.ICEDASH_PLATFORM || {}).minViewH;
    if (minH > SAFE_H) scale = Math.min(scale, vh / minH);
    VIEW_W = Math.round(vw / scale);                  // both are >= the safe region,
    VIEW_H = Math.round(vh / scale);                  // and together they fill the screen
    stage.style.width = vw + 'px'; stage.style.height = vh + 'px';

    var dpr = window.devicePixelRatio || 1;
    /* A platform may keep the canvas from going below a share of the
       screen's own density (minSharp; the iPhone app: half). On a screen of
       three, Low's one pixel to a CSS pixel is a third, and the hill's edges
       shimmered as they moved (SYSTEMS row 150). */
    var floorK = dpr * (+(window.ICEDASH_PLATFORM || {}).minSharp || 0);
    var eff = Math.max(1, Math.min(dpr, Math.max(RES_CAP[RES], floorK), 3840 / vw, 2160 / vh));
    /* The readouts are drawn in CSS pixels, not world units. In world units
       a 22px label came out at 12.6 real pixels on a 390px phone, because
       one world unit is only `scale` CSS pixels there — which is exactly why
       the score was unreadable on a phone and fine on a laptop. */
    CSS_W = vw; CSS_H = vh; hudK = eff;
    readInsets();
    canvas.width = Math.round(vw * eff); canvas.height = Math.round(vh * eff);
    drawK = canvas.width / VIEW_W;                    // equals canvas.height / VIEW_H
    ctx.setTransform(drawK, 0, 0, drawK, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    PLAYER_Y = Math.round(VIEW_H * 0.72);
    LOOK = Math.max(620, PLAYER_Y + 300);             // spawn before it can be seen
    /* A tall screen shows a lot of hill BELOW the penguin. Culling at a fixed
       distance made everything he had just passed wink out halfway down the
       picture. Keep it until it has genuinely left the view. */
    BEHIND = (VIEW_H - PLAYER_Y) + 190;
    if (W && !suspended) render();
  }

  /* The canvas is never denser than DENSITY pixels to a CSS pixel. A
     phone's screen is 2 to 3.5; past 2 a soft, painted hill gains nothing
     you can see, and 2.5 cost a 412px phone 56% more pixels to fill on every
     frame than 2 does — fill the GPU pays for in heat. */
  var DENSITY = 2;

  /* Quality, in two parts, each 0 (high), 1 (medium) or 2 (low): how sharp
     the picture is (RES: the density cap, 2, 1.5, then 1 pixel to a CSS
     pixel) and how much is painted on it that tells you nothing about the
     hill (FX: at 1 LITE, the patches in the ice and the drifts and glints
     on the banks; at 2 SPARE as well, the weather thinned and the glows put
     out; at 3, Off, chosen only, the weather, the track behind the rider and
     the shake go too). Nothing that tells you about the hill is ever touched: the fog
     that hides the way ahead, the lava, the hazards all stay.
     Each part is the player's choice in Settings, or left to the device
     (auto, the default). Left to it, the picture steps down the LADDER
     when a run keeps missing frames — slower than about 50 a second for two
     seconds, so a hiccup is told apart from a slow device — one tier at a
     time, each given two seconds more to show whether it was enough. The
     tier reached is handed out (onQualityStep) for ui.js to remember on
     that device, so a slow phone starts where it ended instead of
     stuttering down the ladder again every time. It used to wait for 42
     frames a second and take both steps at once; by then a phone that was
     heating up had been struggling for a while. */
  var RES_CAP = [DENSITY, 1.5, 1];
  /* [RES, FX] at each tier: fewer pixels first, the decoration next, then
     the weather and the glows. Density 1 is not on it: on the A9 2020,
     once the clips were gone (row 134), it gained nothing in seven
     stretches out of seven and made the picture soft; it is there to be
     chosen, for a big screen on a weak chip. */
  var LADDER = [[0, 0], [1, 0], [1, 1], [1, 2]];
  var RES = 0, FX = 0, LOWRES = false, LITE = false, SPARE = false, OFF = false;
  var qWant = { res: 'auto', fx: 'auto' }, qTier = 0, qNext = 1, onQStep = null;
  var slowEma = 16, slowN = 0;
  function applyQuality() {
    var t = LADDER[qTier];
    RES = qWant.res === 'auto' ? t[0] : qWant.res;
    FX = qWant.fx === 'auto' ? t[1] : qWant.fx;
    LOWRES = RES >= 1; LITE = FX >= 1; SPARE = FX >= 2; OFF = FX >= 3;
    /* the light laid over the canvas (index.html #light) is one more pass
       over the whole screen, for looks only */
    if (typeof document !== 'undefined') {
      var lt = document.getElementById('light');
      if (lt && lt.classList) lt.classList.toggle('spare', SPARE);
    }
    /* the next tier that changes something left to the device, or -1 */
    qNext = -1;
    for (var i = qTier + 1; i < LADDER.length && qNext < 0; i++)
      if ((qWant.res === 'auto' && LADDER[i][0] !== t[0]) || (qWant.fx === 'auto' && LADDER[i][1] !== t[1])) qNext = i;
    slowN = 0; slowEma = 16;
  }
  function watchPace(dt) {
    if (qNext < 0 || paused || !W || W.state !== 'run') { slowN = 0; return; }
    slowEma = slowEma * 0.95 + dt * 0.05;
    /* counted in time, not frames: a phone this slow takes a long while
       to show a hundred and twenty of them */
    if (slowEma > 20) {
      slowN += dt;
      if (slowN > 2000) {
        qTier = qNext;
        applyQuality();
        resize();
        if (onQStep) { try { onQStep(qTier); } catch (e) {} }
      }
    }
    else slowN = 0;
  }

  function loop(t) {
    if (suspended) { rafId = null; return; }
    rafId = requestAnimationFrame(loop);
    if (!W) return;
    if (!lastT) lastT = t;
    var dt = Math.min(120, t - lastT); lastT = t;
    watchPace(dt);
    if (paused) {
      /* Nothing moves, so nothing needs repainting. The canvas keeps the
         last frame, which is exactly the frozen hill you want behind a
         menu — and a paused run no longer redraws the whole world sixty
         times a second while somebody reads the shop. */
      accT = 0;
      return;
    }
    accT += dt;
    var n = 0;
    /* A hook called from inside step() may end the run there and then —
       the tutorial's finish goes straight to its own card and stops the
       engine — so the world can be gone by the next line.
       A step is taken up to STEP_EARLY ms before it is due, and the next
       frame owes that back. Safari hands out frame times to the whole
       millisecond (17, 17, 16 for a 60 Hz screen), so now and then a frame
       came in a hair short of a step: it moved nothing, the next moved two,
       and on the iPhone the whole hill trembled. No time is lost or gained
       this way, as it would be by rounding the frame's length. */
    while (W && accT >= STEP_MS - STEP_EARLY && n < 5) { step(); accT -= STEP_MS; n++; }
    if (accT > 400) accT = 0;
    /* The picture is the world's alone, and the world moves only in step():
       a frame that ran no step would paint what the canvas already shows.
       A 90 or 120 Hz phone calls this 90 or 120 times a second, so every
       picture was painted twice, or one in three twice — and after a few
       minutes of that a phone grew hot, slowed itself down, and the game
       stuttered with it. A new world is painted at once. */
    if (W && (n || W !== drawnW)) { render(); drawnW = W; }
  }

  if (typeof document !== 'undefined' && document.getElementById('game')) setup();

  return {
    /* `lives` is how many spares the player is carrying into this run.
       It comes in from the save rather than being read here, so the engine
       stays free of storage. */
    start: function (best, cbs, skinId, courseId, lives, opts) {
      if (!ctx) setup();
      if (typeof SKINS !== 'undefined') skin = skinById(skinId);
      pendingCourse = (courseId && typeof courseById === 'function')
                    ? courseById(courseId) : null;
      hooks.hud = cbs.hud; hooks.over = cbs.over; hooks.lesson = cbs.lesson || null;
      hooks.fx = cbs.fx || null;
      pendingMode = (opts && opts.mode) || null;
      newRun();
      if (W.hold) lesson({ key: 'tut.start', wait: true });
      if (Sfx.mood) Sfx.mood(biome().mood || 'base');   // the stretch it starts in
      W.best = best || 0;
      W.lives = Math.max(0, lives | 0);
      /* A run always begins at the hill's own tempo, whatever the last one
         ended in the middle of. */
      Sfx.excite(false);
      paused = false; lastT = 0; accT = 0;
      hud();
      if (rafId == null && !suspended) rafId = requestAnimationFrame(loop);
    },
    stop: function () { W = null; if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } },
    /* the hill behind the menu (see demoSteer); a run that is only paused
       keeps its place */
    attract: function (skinId) {
      if (W && !W.demo) return;
      if (W && W.demo) { if (typeof SKINS !== 'undefined') skin = skinById(skinId); return; }
      if (!ctx) setup();
      if (!ctx) return;
      if (typeof SKINS !== 'undefined') skin = skinById(skinId);
      pendingCourse = null; pendingMode = null;
      hooks.hud = null; hooks.over = function () {}; hooks.lesson = null; hooks.fx = null;
      var keepS = Sfx; Sfx = silentSfx();
      try { newRun(); } finally { Sfx = keepS; }
      W.demo = true; W.hold = false; W.invuln = 1e9; W.grace = 1e9; W.lives = 0;
      paused = false; lastT = 0; accT = 0;
      if (rafId == null && !suspended) rafId = requestAnimationFrame(loop);
    },
    tap: tap,
    undoTap: undoTap,
    revive: revive,
    /* A revive paid for with something other than a spare life (a short ad,
       in the Android app): the life is handed over and spent at once. */
    reviveFree: function () {
      if (!W || W.state !== 'crash') return false;
      W.lives++;
      return revive();
    },
    livesLeft: function () { return W ? W.lives : 0; },
    /* Paint one last frame on the way in, so what sits behind the menu is
       the moment it stopped rather than whatever was up a frame earlier. */
    pause:  function () { paused = true; if (W) render(); },

    /* Whatever the player did in the menu while the run sat paused. Buying
       a life and finding it was not there when you carried on would be
       worse than not being able to buy one at all.

       The shield is deliberately NOT re-applied: `startShield` is a perk
       you get for beginning a run wearing that animal, and equipping it
       halfway down should not hand out a free one. Everything else a perk
       does only ever makes the hill more forgiving — that is the one rule
       of the catalogue — so swapping mid-run cannot make a row unreachable. */
    syncFromSave: function (lives, skinId) {
      if (!W) return;
      W.lives = Math.max(0, lives | 0);
      if (typeof SKINS !== 'undefined' && skinId) skin = skinById(skinId);
    },
    resume: function () { paused = false; lastT = 0; },
    isPaused:  function () { return paused; },
    isRunning: function () { return !!W && W.state === 'run' && !W.demo; },
    isDemo: function () { return !!W && !!W.demo; },
    hasRun:    function () { return !!W; },
    suspend: function () { suspended = true; if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } },
    unsuspend: function () {
      if (!suspended) return;
      suspended = false; lastT = 0; accT = 0;
      if (W && rafId == null) rafId = requestAnimationFrame(loop);
    },
    isSuspended: function () { return suspended; },
    resize: resize,

    debug: function () { return W; },
    /* for tests: the second tier (fewer pixels, no decoration) or none */
    _lite: function (v) { if (v !== undefined) { qWant = { res: 'auto', fx: 'auto' }; qTier = v ? 2 : 0; applyQuality(); if (canvas) resize(); } return LITE; },
    _lowres: function () { return LOWRES; },
    /* Settings and the device's own record (ui.js): what the player chose
       for each part ('auto', or 0 high to 2 low) and the tier the device
       had come down to. Either may be left out. Returns what is in use. */
    quality: function (want, tier) {
      /* effects go one step further than sharpness: 3 is Off */
      function lvl(v, top) { return v === 0 || v === 1 || v === 2 || (top && v === 3) ? v : 'auto'; }
      if (want) qWant = { res: lvl(want.res), fx: lvl(want.fx, true) };
      if (tier !== undefined) qTier = Math.max(0, Math.min(LADDER.length - 1, tier | 0));
      applyQuality();
      if (canvas) resize();
      return { res: RES, fx: FX, tier: qTier };
    },
    qualityNow: function () { return { res: RES, fx: FX, tier: qTier }; },
    onQualityStep: function (fn) { onQStep = fn; },
    /* draws one geyser at a chosen point of its cycle, for the eye checks */
    _drawGeyser: function (c, x, y, r, ph, t, kind) {
      var keepCtx = ctx, keepW = W;
      ctx = c; W = { t: t || 0, dist: ph * GEYSER_PERIOD / 0.18 };
      try { drawGeyser(x, y, { d: 0, x: x, r: r, kind: kind }, null); } finally { ctx = keepCtx; W = keepW; }
    },

    /* A still portrait of one skin, for the shop card. Borrows the very
       painter the hill uses, so a card can never drift out of step with
       what you actually get. */
    drawFindPreview: function (cv, size) {
      if (!cv || !cv.getContext) return;
      var k = Math.min(window.devicePixelRatio || 1, 2.5);
      size = size || 120;
      cv.width = Math.round(size * k); cv.height = Math.round(size * k);
      cv.style.width = size + 'px'; cv.style.height = size + 'px';
      var c = cv.getContext('2d');
      c.setTransform(k, 0, 0, k, 0, 0);
      c.clearRect(0, 0, size, size);
      c.lineJoin = 'round'; c.lineCap = 'round';
      drawFind(size / 2, size / 2, { r: Math.min(size * 0.32, 45), ph: 0.8 }, c);
    },

    /* Cracking one open. Pressing a button and having a line of text appear
       is not an opening; this one shakes, splits, throws its shards and
       leaves the prize turning in the light. Runs on its own animation
       frame and calls back when it is done so the UI can say what fell out.

       `kind` only picks the colour of what was inside — the prize itself is
       decided by the caller, because the engine has no business knowing
       what a fish is worth. */
    playFindOpen: function (cv, size, kind, done, onBreak) {
      /* The opening is a moment, so it is staged: the nodule shakes harder
         and harder while cracks of light run through it, it gives with a
         flash, rays turn behind it and the shell flies apart, and what was
         inside settles in its own colour — blue for fish, gold for gold,
         rose for a spare life, the rarest. `onBreak` fires at the instant it
         gives, so the page can throw its own burst across the whole screen. */
      if (!cv || !cv.getContext) { if (onBreak) onBreak(); if (done) done(); return; }
      var k = Math.min(window.devicePixelRatio || 1, 2.5);
      size = size || 140;
      cv.width = Math.round(size * k); cv.height = Math.round(size * k);
      cv.style.width = size + 'px'; cv.style.height = size + 'px';
      var c = cv.getContext('2d');
      c.lineJoin = 'round'; c.lineCap = 'round';

      var tone = kind === 'life' ? ['#ffd0dc', '#e03b6a', '255,120,170']
               : kind === 'gold' ? ['#fff0b0', '#e0a81f', '255,210,90']
                                 : ['#d6f1ff', '#3f93cc', '150,215,255'];
      var R = Math.min(size * 0.32, 45), cx = size / 2, cy = size / 2, i;
      var S = R * 0.8;
      /* The cube is struck three times. Each knock jolts it and runs a
         crack further across its faces — tock, tock, TOCK — and on the
         third it gives: the cube comes apart into its own pieces, each a
         bit of a face in that face's colour, spinning out and falling, and
         what was inside rises in its light. It used to shake harder and
         harder at random and throw triangles that had never been part of
         anything. */
      var KNOCKS = [0.12, 0.27, 0.42], BREAK = 0.5;
      /* The cracks run out from where it is struck, each throwing a branch,
         the way ice splits, and each knock knocks snow and chips off it. */
      var cracks = [
        [[0, 0], [-S * 0.28, -S * 0.26], [-S * 0.52, -S * 0.42], [-S * 0.9, -S * 0.5]],
        [[0, 0], [S * 0.2, S * 0.35], [S * 0.45, S * 0.5], [S * 0.85, S * 0.45]],
        [[0, 0], [-S * 0.15, S * 0.4], [-S * 0.5, S * 0.55], [-S * 0.8, S * 0.3]],
        [[0, 0], [S * 0.25, -S * 0.3], [S * 0.2, -S * 0.7], [S * 0.05, -S * 1.0]]
      ];
      var branches = [
        [[-S * 0.28, -S * 0.26], [-S * 0.3, -S * 0.55], [-S * 0.45, -S * 0.75]],
        [[S * 0.45, S * 0.5], [S * 0.5, S * 0.75], [S * 0.62, S * 0.92]],
        [[-S * 0.15, S * 0.4], [S * 0.02, S * 0.62], [-S * 0.05, S * 0.95]],
        [[S * 0.25, -S * 0.3], [S * 0.55, -S * 0.42], [S * 0.8, -S * 0.36]]
      ];
      /* the pieces: each face cut into three from its middle */
      var F = cubeFaces(S), pieces = [], bits = [], puffs = [], lastKn = 0;
      for (var f = 0; f < 3; f++) {
        var P = F[f], mx = 0, my = 0;
        for (i = 0; i < 4; i++) { mx += P[i][0] / 4; my += P[i][1] / 4; }
        var cuts = [[P[0], P[1]], [P[1], P[2], P[3]], [P[3], P[0]]];
        for (i = 0; i < 3; i++) {
          var poly = [[mx, my]].concat(cuts[i]);
          if (i === 0) poly.push([(P[1][0] + P[2][0]) / 2, (P[1][1] + P[2][1]) / 2]);
          var pcx = 0, pcy = 0;
          for (var q = 0; q < poly.length; q++) { pcx += poly[q][0] / poly.length; pcy += poly[q][1] / poly.length; }
          var dl = Math.hypot(pcx, pcy) || 1;
          pieces.push({ f: f, pts: poly.map(function (p) { return [p[0] - pcx, p[1] - pcy]; }),
                        x: cx + pcx, y: cy + pcy - S * 0.05, a: 0,
                        vx: pcx / dl * (1.3 + ((f * 3 + i) % 3) * 0.45), vy: pcy / dl * 1.2 - 2.8 - (i % 2),
                        spin: ((f + i) % 2 ? 1 : -1) * (0.06 + ((f * 5 + i) % 3) * 0.04),
                        floor: cy + S * (0.9 + 0.5 * hh(f, i)), life: 1 });
        }
      }
      function spawn(n, kind, x, y, spread, up, seed) {
        for (var j = 0; j < n; j++) {
          var h1 = hh(seed, j), h2 = hh(seed + 1, j), h3 = hh(seed + 2, j);
          bits.push({ k: kind, x: x + (h1 - 0.5) * spread, y: y + (h2 - 0.5) * spread * 0.4,
                      vx: (h1 - 0.5) * (kind === 'snow' ? 3.4 : 4), vy: -up * (0.5 + h2),
                      r: kind === 'lump' ? 2.6 + h3 * 3 : kind === 'chip' ? 2.2 + h3 * 3 : 0.7 + h3 * 1.5,
                      a: h3 * 6, spin: (h2 - 0.5) * 0.5, f: j % 3,
                      floor: cy + S * (0.95 + 0.55 * h3), life: 1 });
        }
      }
      function fall(b, fade) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.17; b.a += b.spin;
        if (b.y > b.floor && b.vy > 0) {                 // it lands, skips, and lies there melting away
          b.y = b.floor; b.vy = Math.abs(b.vy) > 1.2 ? -b.vy * 0.25 : 0; b.vx *= 0.5; b.spin *= 0.4; b.down = true;
        }
        if (b.down) b.life -= fade;
      }
      function shard(pts, f, alpha) {
        var g = c.createLinearGradient(-S * 0.4, -S * 0.4, S * 0.4, S * 0.4);
        g.addColorStop(0, CUBE_TONE[f][0]); g.addColorStop(1, CUBE_TONE[f][1]);
        c.globalAlpha = alpha * 0.92;
        c.fillStyle = g; polyPath(c, pts); c.fill();
        c.globalAlpha = alpha;
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.1; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.8;   // the fracture shining across it
        c.beginPath(); c.moveTo(pts[0][0] * 0.6, pts[0][1] * 0.6); c.lineTo(pts[1][0] * 0.3, pts[1][1] * 0.3); c.stroke();
      }
      function drawBits() {
        for (var j = 0; j < bits.length; j++) {
          var b = bits[j];
          if (b.life <= 0) continue;
          c.save(); c.translate(b.x, b.y); c.rotate(b.a);
          if (b.k === 'chip') {
            shard([[-b.r, -b.r * 0.5], [b.r, -b.r * 0.2], [b.r * 0.1, b.r * 0.8]], b.f, b.life);
          } else if (b.k === 'lump') {
            c.globalAlpha = b.life;
            c.fillStyle = 'rgba(120,160,196,.6)';
            c.beginPath(); c.arc(b.r * 0.2, b.r * 0.3, b.r, 0, 6.2832); c.fill();
            c.fillStyle = '#ffffff';
            c.beginPath(); c.arc(0, 0, b.r, 0, 6.2832); c.arc(b.r * 0.7, -b.r * 0.2, b.r * 0.6, 0, 6.2832); c.fill();
          } else {
            c.globalAlpha = b.life;
            c.fillStyle = '#ffffff';
            c.beginPath(); c.arc(0, 0, b.r, 0, 6.2832); c.fill();
          }
          c.restore();
        }
        c.globalAlpha = 1;
      }
      var T = 0, DUR = 150, broke = false, raf = null;
      function knockAt(t) {                             // how hard the last knock still shakes it
        var j = 0;
        for (var n = 0; n < KNOCKS.length; n++) if (t >= KNOCKS[n]) j = n + 1;
        var since = j ? t - KNOCKS[j - 1] : 1;
        return { n: j, since: since, jolt: j ? Math.max(0, 1 - since * 18) * (0.6 + 0.4 * j) : 0 };
      }
      function crackLine(pts, grow) {
        var n = pts.length - 1, upto = grow * n;
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (var pi = 1; pi <= n; pi++) {
          if (pi - 1 >= upto) break;
          var tt = Math.min(1, upto - (pi - 1));
          c.lineTo(pts[pi - 1][0] + (pts[pi][0] - pts[pi - 1][0]) * tt, pts[pi - 1][1] + (pts[pi][1] - pts[pi - 1][1]) * tt);
        }
      }
      function frame() {
        T++;
        var t = T / DUR;
        c.setTransform(k, 0, 0, k, 0, 0);
        c.clearRect(0, 0, size, size);

        if (t < BREAK) {                              /* struck, and struck again */
          var kn = knockAt(t), q = kn.n / KNOCKS.length;
          if (kn.n > lastKn) {                         /* each knock throws snow and chips off it */
            lastKn = kn.n;
            spawn(10 + kn.n * 4, 'snow', cx, cy - S * 0.75, S * 1.2, 2.6, kn.n * 10);
            spawn(kn.n + 1, 'chip', cx + (kn.n - 2) * S * 0.6, cy - S * 0.2, S * 0.4, 2.2, kn.n * 10 + 50);
            if (kn.n === 2) spawn(2, 'lump', cx - S * 0.35, cy - S * 0.3, S * 0.3, 1.2, 77);
          }
          var jx = Math.sin(T * 2.3) * kn.jolt * 5, jy = -kn.jolt * 6;
          var squash = 1 + kn.jolt * 0.12;
          var pulse = 0.5 + 0.5 * Math.sin(T * (0.15 + q * 0.4));
          var gl = c.createRadialGradient(cx, cy, 1, cx, cy, R * (1.2 + q));
          /* the light before it gives is the find's own turning light, not
             the prize's colour, which would give the answer away */
          var hueK = findHue(0.8 + (W ? W.t : 0) * 0.021);
          gl.addColorStop(0, 'rgba(' + hueK + ',' + (0.2 + 0.5 * q * pulse).toFixed(3) + ')');
          gl.addColorStop(1, 'rgba(' + hueK + ',0)');
          c.fillStyle = gl;
          c.beginPath(); c.arc(cx, cy, R * (1.2 + q), 0, 6.2832); c.fill();
          c.save(); c.translate(cx + jx, cy + jy); c.scale(squash, 2 - squash);
          drawFind(0, 0, { r: R, ph: 0.8 }, c);
          /* the cracks: each knock runs one more across, and they grow */
          c.translate(0, -S * 0.05);
          var grow = Math.min(1, kn.since * 22);
          var shown = Math.min(cracks.length, kn.n + (kn.n === 3 ? 1 : 0));
          for (i = 0; i < shown; i++) {
            var gi = (i >= kn.n - 1) ? grow : 1;
            c.shadowColor = 'rgba(' + hueK + ',1)'; c.shadowBlur = 5 + 10 * kn.jolt;
            c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 5;            // the plane of the split, catching light
            crackLine(cracks[i], gi); c.stroke();
            c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.5;
            crackLine(cracks[i], gi); c.stroke();
            if (gi >= 1 && i < kn.n - 1 + (kn.n === 3 ? 1 : 0)) { c.lineWidth = 1; crackLine(branches[i], 1); c.stroke(); }
            c.shadowBlur = 0;
          }
          c.restore();
          if (kn.jolt > 0.5) {                         /* a puff of frost knocked off it */
            c.fillStyle = 'rgba(255,255,255,' + ((kn.jolt - 0.5) * 1.0).toFixed(3) + ')';
            for (i = 0; i < 6; i++) {
              var fa = i * 1.05 + kn.n, fd = R * (1.1 + (1 - kn.jolt) * 0.8);
              c.beginPath(); c.arc(cx + Math.cos(fa) * fd, cy + Math.sin(fa) * fd * 0.8, 3 + (i % 3) * 1.5, 0, 6.2832); c.fill();
            }
          }
          for (i = 0; i < bits.length; i++) fall(bits[i], 0.03);
          drawBits();
        } else {                                      /* it gives */
          if (!broke) {
            broke = true; if (onBreak) onBreak();
            spawn(14, 'chip', cx, cy, S * 1.4, 3.4, 300);
            spawn(6, 'lump', cx, cy - S * 0.6, S * 1.2, 2.8, 400);
            spawn(34, 'snow', cx, cy - S * 0.3, S * 1.8, 3.6, 500);
            for (i = 0; i < 7; i++) puffs.push({ x: cx + (hh(i, 600) - 0.5) * S * 1.4, y: cy + (hh(i, 601) - 0.3) * S, r: S * 0.3, vr: 0.9 + hh(i, 602) * 0.8 });
          }
          var q2 = (t - BREAK) / (1 - BREAK);
          /* the flash */
          if (q2 < 0.12) {
            c.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - q2 / 0.12)).toFixed(3) + ')';
            c.fillRect(0, 0, size, size);
          }
          /* rays turning behind it, softer now: the light let out */
          c.save(); c.translate(cx, cy); c.rotate(T * 0.02);
          var ra = Math.max(0, 0.42 * (1 - q2 * 0.7));
          for (i = 0; i < 12; i++) {
            c.rotate(6.2832 / 12);
            c.fillStyle = 'rgba(' + tone[2] + ',' + (ra * (i % 2 ? 0.5 : 1)).toFixed(3) + ')';
            c.beginPath(); c.moveTo(0, 0); c.lineTo(-R * 0.2, -size); c.lineTo(R * 0.2, -size); c.closePath(); c.fill();
          }
          c.restore();
          /* the powder it burst into, drifting out and thinning */
          for (i = 0; i < puffs.length; i++) {
            var pf = puffs[i]; pf.r += pf.vr; pf.vr *= 0.96; pf.y -= 0.15;
            var pa = Math.max(0, 0.55 * (1 - q2 * 1.3));
            if (pa <= 0) continue;
            var pfg = c.createRadialGradient(pf.x, pf.y, 0, pf.x, pf.y, pf.r);
            pfg.addColorStop(0, 'rgba(255,255,255,' + pa.toFixed(3) + ')'); pfg.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = pfg; c.beginPath(); c.arc(pf.x, pf.y, pf.r, 0, 6.2832); c.fill();
          }

          /* the block's own pieces, flung, falling, skipping on the ice and
             lying there, and the chips and the snow off its top with them */
          for (i = 0; i < pieces.length; i++) {
            var pc = pieces[i];
            fall(pc, 0.016);
            if (pc.life <= 0) continue;
            c.save(); c.translate(pc.x, pc.y); c.rotate(pc.a);
            shard(pc.pts, pc.f, Math.max(0, Math.min(1, pc.life)));
            c.restore();
          }
          c.globalAlpha = 1;
          for (i = 0; i < bits.length; i++) fall(bits[i], bits[i].k === 'snow' ? 0.035 : 0.018);
          drawBits();

          /* and what was inside, rising in its own light and settling with a
             bounce: the fish itself, gold or silver, or a heart */
          var pop = Math.min(1, q2 * 2.4);
          var ease = 1 + 0.25 * Math.sin(pop * Math.PI) * (1 - pop) - Math.pow(1 - pop, 3);
          var pr = R * (0.2 + 0.72 * Math.max(0, ease));
          c.save();
          c.translate(cx, cy - (1 - pop) * R * 0.3);
          var lg = c.createRadialGradient(0, 0, 0, 0, 0, pr * 1.45);
          lg.addColorStop(0, 'rgba(255,255,255,.85)');
          lg.addColorStop(0.4, 'rgba(' + tone[2] + ',.55)');
          lg.addColorStop(1, 'rgba(' + tone[2] + ',0)');
          c.fillStyle = lg;
          c.beginPath(); c.arc(0, 0, pr * 1.45, 0, 6.2832); c.fill();
          c.save();
          if (kind === 'life') {
            c.rotate(Math.sin(T * 0.07) * 0.12);
            var hr = pr * 1.15;
            var hg = c.createLinearGradient(0, -hr * 0.6, 0, hr * 0.45);
            hg.addColorStop(0, '#ff8aa8'); hg.addColorStop(1, '#c4123f');
            c.fillStyle = hg;
            c.beginPath();
            c.moveTo(0, hr * 0.42);
            c.bezierCurveTo(-hr * 0.75, -hr * 0.05, -hr * 0.32, -hr * 0.62, 0, -hr * 0.22);
            c.bezierCurveTo(hr * 0.32, -hr * 0.62, hr * 0.75, -hr * 0.05, 0, hr * 0.42);
            c.fill();
            c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.stroke();
            c.fillStyle = 'rgba(255,255,255,.7)';
            c.beginPath(); c.ellipse(-hr * 0.26, -hr * 0.26, hr * 0.12, hr * 0.07, -0.6, 0, 6.2832); c.fill();
          } else {
            c.rotate(0.42 + Math.sin(T * 0.07) * 0.1);
            var fl = pr * 0.86;
            c.translate(-fl * 0.06, 0);
            realFish(c, fl, fl * (kind === 'gold' ? 0.32 : 0.3), T * 0.32, kind === 'gold', 0.5 + 0.5 * Math.sin(T * 0.2));
          }
          c.restore();
          for (i = 0; i < 8; i++) {                   /* sparks turning around it */
            var sa2 = T * 0.05 + i * 0.785;
            var sr = pr * (1.35 + 0.12 * Math.sin(T * 0.08 + i));
            c.globalAlpha = 0.35 + 0.35 * Math.sin(T * 0.1 + i * 2);
            c.fillStyle = '#ffffff';
            c.beginPath();
            c.arc(Math.cos(sa2) * sr, Math.sin(sa2) * sr * 0.8, 1.8 + (i % 3), 0, 6.2832);
            c.fill();
          }
          c.globalAlpha = 1;
          c.restore();
        }

        /* Everything fades out in a soft circle well inside the canvas. The
           glow, the rays and the burst all reached past its edges, and the
           canvas cut them off straight — a square of light behind the find. */
        c.setTransform(k, 0, 0, k, 0, 0);
        c.globalCompositeOperation = 'destination-in';
        var mask = c.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * 0.5);
        mask.addColorStop(0, 'rgba(0,0,0,1)');
        mask.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = mask;
        c.fillRect(0, 0, size, size);
        c.globalCompositeOperation = 'source-over';

        if (T < DUR) raf = requestAnimationFrame(frame);
        else if (done) done();
      }
      frame();
      return function () { if (raf != null) cancelAnimationFrame(raf); };
    },
    /* One thing off the hill, painted into a little canvas for the How to
       play panel. It borrows the game's OWN painters rather than drawing
       the same objects a second time in a second style — change the bubble
       on the hill and the bubble in the panel changes with it. The module's
       canvas context and world are swapped out and put back, so nothing
       else in here knows it happened. */
    drawHint: function (cv, kind, size) {
      if (!cv || !cv.getContext || typeof BIOMES === 'undefined') return;
      EYE = null;
      size = size || 54;
      var k = Math.min(window.devicePixelRatio || 1, 2.5);
      cv.width = Math.round(size * k); cv.height = Math.round(size * k);
      cv.style.width = size + 'px'; cv.style.height = size + 'px';
      var keepCtx = ctx, keepW = W;
      ctx = cv.getContext('2d');
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      /* A still frame. The painters read W.t to breathe and there is no run
         behind a menu, so they are handed a world that is not moving. */
      if (!W) W = { t: 0, dist: 0, px: 0, speed: 0, objects: [], rows: [],
                    biome: 0, biomeT: 0 };
      try { paintHint(kind, size); } catch (e) { /* a missing icon is not a crash */ }
      ctx = keepCtx; W = keepW;
    },
    drawSkinPreview: function (cv, skinId, size) {
      if (!cv || !cv.getContext || typeof SKINS === 'undefined') return;
      EYE = null;                                    // a portrait looks at you, open-eyed
      var k = Math.min(window.devicePixelRatio || 1, 2.5);
      size = size || 92;
      cv.width = Math.round(size * k); cv.height = Math.round(size * k);
      cv.style.width = size + 'px'; cv.style.height = size + 'px';
      var c = cv.getContext('2d');
      c.setTransform(k, 0, 0, k, 0, 0);
      c.clearRect(0, 0, size, size);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.save();
      c.translate(size / 2, size / 2 + size * 0.03);
      paintCreature(c, skinById(skinId),
                    { ang: 0, wag: 0, scale: size / 112, shield: -1, still: true });
      c.restore();
    },
    /* stepping the world by hand, for tests and screenshots */
    _step: function (n) { for (var i = 0; i < n; i++) if (W) step(); },
    _render: function () { if (W) render(); },
    /* For the comic: a creature or any thing off the hill, painted at (x, y)
       and `size` across into any context — the game's own painters, so the
       pages look like the hill. opts: skin, ang, eye (as EYE), gait, t. */
    comicDraw: function (c, kind, x, y, size, opts) {
      opts = opts || {};
      var keepCtx = ctx, keepW = W, keepEye = EYE;
      if (!W || opts.t !== undefined)
        W = { t: opts.t || 0, dist: 0, px: 0, speed: 0, objects: [], rows: [], biome: 0, biomeT: 0 };
      try {
        if (kind === 'creature') {
          EYE = opts.eye || null;
          DETAIL = size >= 200;
          c.save(); c.translate(x, y); c.rotate(opts.ang || 0);
          paintCreature(c, skinById(opts.skin || 'snowcap'),
                        { ang: 0, wag: 0, scale: size / 112, shield: -1, still: !opts.gait, gait: opts.gait || 0 });
          c.restore();
        } else {
          ctx = c;
          ctx.save(); ctx.translate(x - size / 2, y - size / 2);
          paintHint(kind, size);
          ctx.restore();
        }
      } catch (e) { /* a missing picture is not a crash */ }
      ctx = keepCtx; W = keepW; EYE = keepEye; DETAIL = false;
    },
    /* paint a creature into any context, for tests and portraits */
    _paint: function (c, skinId, opts) { paintCreature(c, skinById(skinId), opts); },
    _screen: function (x, d) { return { x: scrX(x), y: scrY(d) }; },
    _chuteAt: chuteAt,
    /* The spine's half-width, so a test measures the two ways past a fork
       off the same curve the game collides against. */
    _nunHalf: nunHalf,
    /* where the readout last put things, for a test to watch it hold still */
    _hud: function () { return hudLayout; },
    _turnRate: function () { return W ? turnRate() : TURN; },
    _seeing: function () { return !!(W && seeing()); },
    _eye: function (e) { if (e !== undefined) EYE = e; return EYE; },
    _snow: function () { return W ? freerideSnow() : 0; },
    /* Exposed so a test can walk the whole crossfade: a field the blender
       forgets turns into "rgb(undefined,...)", which canvas ignores without
       a word. */
    _buildPal: function () { return buildPal(); },
    _consts: function () { return { CHUTE: CHUTE, PR: PR, LOOK: LOOK,
                                    PLAYER_Y: PLAYER_Y, VIEW_W: VIEW_W, VIEW_H: VIEW_H,
                                    SPEED_MAX: SPEED_MAX, HARD_OVER: HARD_OVER,
                                    ROW_GAP0: ROW_GAP0, ROW_GAP1: ROW_GAP1,
                                    DRIFT: DRIFT, TURN: TURN,
                                    reach: reachBetweenRows() }; }
  };
})();
