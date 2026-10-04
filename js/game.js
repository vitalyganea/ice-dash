/* ===========================================================
   game.js — Ice Dash: one-tap belly slide, seen from above
   -----------------------------------------------------------
   A top-down chute that winds down the mountain. Everything lives in
   world pixels, so what the collision code measures is exactly what the
   player sees — no perspective to disagree with.
   =========================================================== */
var Game = (function () {
  'use strict';

  var STEP_MS = 1000 / 60;
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
  /* Time Rush: the clock you start with, what a clock bubble gives back,
     and what a crash takes away instead of the run. */
  var RUSH_START = 20 * 60, CLOCK_GAIN = 3 * 60, CRASH_COST = 5 * 60;
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

  function rgbOf(h) {
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
      objects: [], rows: [], flakes: [], puffs: [], streaks: [],
      lastGap: 0, nextRowD: 320, lastStep: ROW_GAP0,
      airTo: -1, airSpan: AIR_DIST, clearUntil: 520, crevs: 0, jumps: 0,
      roofTo: -1e9, forkTo: -1e9, forceGap: null, forceGapW: 0, forks: 0,
      course: null, finishD: -1, fishTotal: 0, tunnelTo: -1e9,
      biome: 0, biomeT: 0, shake: 0,
      state: 'run', endT: 0, best: 0, crashAt: null, tapFlash: 0, zoneT: 0,
      mode: 'free', timeT: 0, clocks: 0, penT: 0,
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
    w.lessons = []; w.tutWait = null; w.tutRead = 0;
    w.hold = !!(w.course && w.course.tut);
    /* Time Rush is the open hill against a clock. */
    if (pendingMode === 'rush' && !w.course) { w.mode = 'rush'; w.timeT = RUSH_START; }
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
        for (var sk = 0; sk < 6; sk++) {
          var ss = sk < 3 ? -1 : 1, si = sk % 3;
          var sd = W.finishD + (si - 1) * 62;
          W.objects.push({
            t: 'deco', kind: 'rock',
            x: place(ss * (CHUTE + 18 + si * 20), sd), d: sd,
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
      var dd = d + frnd(-95, 95);
      W.objects.push({
        t: 'deco', kind: frand() < 0.62 ? 'tree' : 'rock',
        x: chuteAt(dd) + side * (CHUTE + 80 + frand() * room),
        d: dd, r: frnd(19, 37), rot: frnd(0, 6.28), pts: rockPts()
      });
    }
  }

  /* world position -> screen. One to one: no perspective anywhere. */
  function scrX(worldX) { return VIEW_W / 2 + (worldX - chuteAt(W.dist)); }
  function scrY(d) { return PLAYER_Y - (d - W.dist); }

  /* --------------------------- input -------------------------- */
  function tap() {
    if (!W || W.state !== 'run') return;
    /* The tutorial's first tap only lets the hill go; it does not turn him,
       or the very first lesson would be answered before it was asked. */
    if (W.hold) { W.hold = false; lesson({ key: null }); return; }
    W.dir = -W.dir;
    W.tapFlash = 8;
    Sfx.turn();
    for (var i = 0; i < 4; i++)
      W.puffs.push({ x: W.px - W.dir * 8, d: W.dist - 6, life: 18, max: 18, s: frnd(5, 11) });
  }

  /* Two fingers pause, and the first of them has already turned him. Put
     that back so pausing never costs you the line you were on. */
  function undoTap() {
    if (!W || W.state !== 'run') return;
    W.dir = -W.dir;
    W.tapFlash = 0;
  }

  /* ---------------------------- step -------------------------- */
  function step() {
    W.t++;
    if (W.shake > 0) { W.shake *= 0.86; if (W.shake < 0.05) W.shake = 0; }
    if (W.tapFlash > 0) W.tapFlash--;

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
      if (W.state === 'crash' && W.course && W.course.tut && W.endT === 30) {
        W.lives++; revive(); W.revives--;
        lesson({ key: 'tut.oops' });
        return;
      }
      if (W.endT === 46 && hooks.over)
        hooks.over({ score: Math.floor(W.score), dist: Math.floor(W.dist / 8),
                     fish: W.fish, gold: W.gold, gates: W.gates, saved: W.saved,
                     coins: W.coins, jumps: W.jumps,
                     finished: W.state === 'finish',
                     mode: W.mode, clocks: W.clocks, closes: W.closes, comboBest: W.comboBest,
                     course: W.course ? W.course.id : null,
                     fishTotal: W.fishTotal,
                     finds: W.finds, revives: W.revives,
                     rushes: W.rushes, smashed: W.smashed, forks: W.forks,
                     /* Only a crash can be walked back, and only while a
                        life is in hand. Crossing the line is final. */
                     canRevive: W.state === 'crash' && W.lives > 0 });
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

    var c = chuteAt(W.dist);
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
          o.scored = true;                   // green means you took it,
          W.gates++;                         // not merely that it is behind you
          comboUp();
          W.score += Math.round(50 * gb) * comboMult();
          W.coins += Math.round(2 * gb);       // gates pay the shop as well
          Sfx.gate(); W.tapFlash = 10; fx('ring');
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
          var nnx = chuteAt(W.dist) + o.rel, nrel = W.px - nnx;
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
            W.closes++; W.score += Math.round(15 * (perk().closeBonus || 1)) * comboMult(); W.closeT = 55; W.closeX = o.x;
            fx('close');
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
    if (W.penT > 0) W.penT--;
    if (W.closeT > 0) W.closeT--;
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
        W.tutRead = 90;
      } else {
        lesson({ key: L.key, hint: L.hint });
        W.tutRead = 150;
      }
    }
    if (W.tutWait && W.dir === W.tutWait.want) {
      W.tutWait = null;
      lesson({ key: 'tut.nice', ok: true });
    }
    if (W.tutRead > 0) W.tutRead--;
  }
  /* Slower is always safe — every row is proved at full pace — so the
     tutorial may slow the hill as much as it likes: almost to a stop while
     it waits for a tap, a little while a line is being read. */
  function tutPace() {
    if (!W.course || !W.course.tut) return 1;
    if (W.tutWait) return 0.1;
    return W.tutRead > 0 ? 0.6 : 1;
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
    W.state = 'crash'; W.endT = 0; W.shake = 24;
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
    ctx.setTransform(drawK, 0, 0, drawK, 0, 0);
    ctx.globalAlpha = 1;
    var shx = (frand() - 0.5) * W.shake, shy = (frand() - 0.5) * W.shake;
    ctx.save();
    ctx.translate(shx, shy);
    drawChute();
    drawGround();
    drawEmberGlow();
    drawSightLine();
    drawObjects();
    drawSpeedStreaks();
    drawAurora();
    drawHaze();
    drawFog();
    drawPenguin();
    drawGateFronts();     /* after him: he goes THROUGH the hoop */
    drawCloseCall();
    drawChill();
    drawPaceVignette();
    drawBridges();        /* after him: he is UNDER the bridge */
    drawFlakes();
    ctx.restore();
    drawHud();
  }

  /* the ice run and the snow banks that wind along either side */
  function drawChute() {
    var B = pal(), y, d, c, i;

    ctx.fillStyle = B.snowA;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var ice = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    ice.addColorStop(0, B.iceTop); ice.addColorStop(1, B.iceBot);

    ctx.beginPath();                                  // left edge, top to bottom
    for (y = -40; y <= VIEW_H + 40; y += 10) {
      d = W.dist + (PLAYER_Y - y);
      c = chuteAt(d) - chuteAt(W.dist);
      ctx.lineTo(VIEW_W / 2 + c - CHUTE, y);
    }
    for (y = VIEW_H + 40; y >= -40; y -= 10) {        // back up the right edge
      d = W.dist + (PLAYER_Y - y);
      c = chuteAt(d) - chuteAt(W.dist);
      ctx.lineTo(VIEW_W / 2 + c + CHUTE, y);
    }
    ctx.closePath();
    ctx.fillStyle = ice; ctx.fill();

    ctx.save(); ctx.clip();
    /* The one thing a run is ABOUT is that it gets faster, and at 1127m it
       used to look exactly as quick as at 76m. The streaks carry it: they
       stretch, thin and brighten as he picks up, so the floor is visibly
       tearing past by the end. */
    var sp = pace();
    ctx.strokeStyle = B.streak || 'rgba(255,255,255,.5)';   // streaks of polished ice
    for (i = 0; i < W.streaks.length; i++) {
      var s = W.streaks[i];
      var sy = scrY(s.d);
      if (sy > VIEW_H + 320) { s.d += LOOK + 200; s.x = frnd(-CHUTE, CHUTE); continue; }
      if (sy < -320) continue;
      ctx.globalAlpha = s.a * (1.9 + 3.4 * sp);
      ctx.lineWidth = 4 - 2.2 * sp;
      var sx = scrX(chuteAt(s.d) + s.x);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 6, sy + s.len * (1 + 4.2 * sp));
      ctx.stroke();
    }
    drawIceDetail(B);
    ctx.globalAlpha = 1;
    ctx.restore();

    /* the lip of snow where the banks meet the ice */
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      for (y = -40; y <= VIEW_H + 40; y += 10) {
        d = W.dist + (PLAYER_Y - y);
        c = chuteAt(d) - chuteAt(W.dist);
        var wob = Math.sin(d * 0.011 + side * 2.1) * 9 + Math.sin(d * 0.03) * 4;
        ctx.lineTo(VIEW_W / 2 + c + side * (CHUTE + wob), y);
      }
      ctx.lineTo(side < 0 ? -60 : VIEW_W + 60, VIEW_H + 40);
      ctx.lineTo(side < 0 ? -60 : VIEW_W + 60, -40);
      ctx.closePath();
      ctx.fillStyle = B.snowA; ctx.fill();
      /* a blue shadow where the bank drops onto the ice, then a bright lip:
         without it the snow and the ice read as one flat field */
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
        var fc = chuteAt(fd) - chuteAt(W.dist);
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
      else if (o.t === 'gate')   drawGate(x, y, o, hoopAhead(o) ? null : 'back');
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
  var shadeBuf = null, SHADE = 132;
  function creatureShade(x, y, ang) {
    if (typeof document === 'undefined' || !document.createElement) return;
    if (!shadeBuf) {
      shadeBuf = document.createElement('canvas');
      shadeBuf.width = SHADE; shadeBuf.height = SHADE;
    }
    var c = shadeBuf.getContext('2d');
    if (!c) return;
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

    ctx.save();
    ctx.globalAlpha = 0.6;
    if ('filter' in ctx) ctx.filter = 'blur(3px)';
    ctx.drawImage(shadeBuf, x - SHADE / 2, y - SHADE / 2);
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
  var ARCH = 104;                          // how far the mouth bows back over the run
  function archAt(x, my, dir, ph) {
    /* The edge of the roof at screen x. Over the banks it sits on the mouth
       line; over the run it bows back by ARCH, flat-topped and steep-sided
       so it reads as an opening rather than as a wave. dir is +1 for the
       near mouth (bows up the screen), -1 for the far one. */
    var d = W.dist + (PLAYER_Y - my);
    var cx = VIEW_W / 2 + chuteAt(d) - chuteAt(W.dist);
    var t = (x - cx) / (CHUTE * 0.94);
    var t2 = t * t, s = Math.abs(t) < 1 ? 1 - t2 * t2 * t2 : 0;
    return my - dir * ARCH * s + Math.sin(x * 0.045 + ph) * 3;
  }
  function archPath(my, dir, ph, x0, x1) {
    var pts = [], n = 40;
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

  function drawBridges() {
    var B = pal(), ink = null;
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (o.t !== 'tunnel') continue;
      var yIn = scrY(o.d), yOut = scrY(o.d + o.span);
      if (yOut > VIEW_H + 120 || yIn < -120) continue;
      if (ink === null) ink = roofInk(B);
      var k, sh;

      var near = archPath(yIn, 1, o.ph, -20, VIEW_W + 20);
      var far = archPath(yOut, -1, o.ph + 2, -20, VIEW_W + 20);

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
      ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
      ctx.fillStyle = B.snowA;
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

      /* The run showing through: its two edges, faint, the whole way
         across. This is what says the way on is under here. */
      var top = Math.max(yOut - ARCH, -60), bot = Math.min(yIn + 10, VIEW_H + 60);
      traceRun(top, bot);
      ctx.fillStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.2).toFixed(3) + ')';
      ctx.fill();
      ctx.strokeStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.55).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.stroke();

      /* wind grain across it, pinned to distance */
      ctx.strokeStyle = B.bankShade; ctx.lineCap = 'round';
      var st = 64, base = Math.floor((W.dist + (PLAYER_Y - bot)) / st) * st;
      for (var g2 = 0; g2 < 40; g2++) {
        var gy = scrY(base + g2 * st);
        if (gy < top - 40 || gy > bot + 40) continue;
        ctx.globalAlpha = 0.09 + ((g2 * 7) % 4) * 0.028;
        ctx.lineWidth = 4 + ((g2 * 11) % 4);
        var gx = ((g2 * 149) % Math.round(VIEW_W));
        ctx.beginPath();
        ctx.moveTo(gx, gy - 24); ctx.lineTo(gx + 7, gy + 24);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* and him underneath, as light scattering up through the snow */
      var py = PLAYER_Y, pxx = scrX(W.px);
      if (py < archAt(pxx, yIn, 1, o.ph) + 8 && py > archAt(pxx, yOut, -1, o.ph + 2) - 8) {
        var gl = ctx.createRadialGradient(pxx, py, 4, pxx, py, 92);
        gl.addColorStop(0, 'rgba(176,214,242,.52)');
        gl.addColorStop(0.5, 'rgba(192,222,246,.28)');
        gl.addColorStop(1, 'rgba(206,232,250,0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(pxx, py, 92, 0, 6.2832); ctx.fill();
        creatureShade(pxx, py, Math.atan2(W.vx, W.speed) * 0.85);
      }
      ctx.restore();

      /* ---- the lips, and icicles off the near one ---- */
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = B.lip || 'rgba(255,255,255,.95)';
      tracePts(near); ctx.stroke();
      tracePts(far); ctx.stroke();
      /* Only over the run: an overhang drips; snow lying on a bank does not. */
      var cxIn = scrX(chuteAt(o.d)), n = 0;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(' + ROOF_RGB + ',' + (ink * 0.9).toFixed(3) + ')';
      for (var ix = cxIn - CHUTE * 0.86; ix < cxIn + CHUTE * 0.86; ix += 31) {
        n++;
        var len = 15 + ((n * 7) % 5) * 5, w = 6 + (n % 3) * 1.5;
        var iy = archAt(ix, yIn, 1, o.ph) + 2;
        if (iy < -40 || iy > VIEW_H + 40) continue;
        ctx.beginPath();
        ctx.moveTo(ix - w, iy); ctx.lineTo(ix + w, iy); ctx.lineTo(ix + 1, iy + len);
        ctx.closePath();
        var ig = ctx.createLinearGradient(0, iy, 0, iy + len);
        ig.addColorStop(0, 'rgba(255,255,255,.98)');
        ig.addColorStop(1, 'rgba(150,205,236,.85)');
        ctx.fillStyle = ig; ctx.fill();
        ctx.stroke();
      }
    }
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
  function drawGeyser(x, y, o, B) {
    var ph = geyserPhase(o), up = geyserUp(o), r = o.r, k;
    ctx.save();
    ctx.translate(x, y);

    /* the hole, always there */
    var hg = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.66);
    hg.addColorStop(0, 'rgba(12,38,62,.92)');
    hg.addColorStop(0.7, 'rgba(26,74,112,.72)');
    hg.addColorStop(1, 'rgba(60,130,176,.2)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.66, r * 0.5, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.66, r * 0.5, 0, 0, 6.2832); ctx.stroke();

    if (up) {
      /* up: a column of spray, brightest at its foot */
      var t = ph / (GEYSER_UP / GEYSER_PERIOD);
      var h = Math.sin(Math.PI * t);
      for (k = 0; k < 14; k++) {
        var sa = k * 2.399 + W.t * 0.08;
        var sr = r * (0.2 + 0.95 * h) * (0.3 + ((k * 7) % 10) / 10);
        ctx.globalAlpha = (0.30 + 0.5 * h) * (1 - ((k * 3) % 7) / 10);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr * 0.8,
                4 + h * 9 + (k % 3) * 2, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      /* down: it swells as its turn comes back round, so the warning is
         there before the spray is */
      var w8 = (ph - GEYSER_UP / GEYSER_PERIOD) / (1 - GEYSER_UP / GEYSER_PERIOD);
      ctx.globalAlpha = 0.18 + 0.5 * w8 * w8;
      ctx.fillStyle = 'rgba(190,232,255,.9)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (0.22 + 0.4 * w8), r * (0.17 + 0.3 * w8), 0, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
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

    if (o.t === 'chill') {                       // a frost star
      ctx.rotate(a * 0.5);
      for (k = 0; k < 6; k++) {
        ctx.save(); ctx.rotate(k * 1.0472);
        ctx.beginPath();
        ctx.moveTo(-r * 0.17, 0); ctx.lineTo(0, -r);
        ctx.lineTo(r * 0.17, 0); ctx.lineTo(0, r * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
      }
    } else if (o.t === 'sight') {                // a lens you look through
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92, r * 0.72, 0, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(a * 2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.46, r * 0.34, 0, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {                                     // a ring of little fish
      for (k = 0; k < 5; k++) {
        var fa = a + k * 1.2566;
        ctx.save();
        ctx.translate(Math.cos(fa) * r * 0.62, Math.sin(fa) * r * 0.5);
        ctx.rotate(fa + 1.5708);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.3, r * 0.17, 0, 0, 6.2832); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, r * 0.26); ctx.lineTo(-r * 0.16, r * 0.44);
        ctx.lineTo(r * 0.16, r * 0.44); ctx.closePath(); ctx.fill();
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

  
  /* A nodule of glacier ice with something caught inside it, still turning
     slowly in the light. Deliberately not a box: there is nothing on this
     hill that anybody made, so the prize comes out of the ice itself. */
  /* Takes its context so the results screen can paint one into its own
     canvas without the module's `ctx` being swapped out underneath the
     frame that is mid-render. */
  function drawFind(x, y, o, c) {
    c = c || ctx;
    var r = o.r, a = (W ? W.t : 0) * 0.021 + o.ph, k;
    c.save();
    c.translate(x, y);

    c.fillStyle = 'rgba(40,100,150,.22)';
    c.beginPath(); c.ellipse(4, 7, r * 1.02, r * 0.9, 0, 0, 6.2832); c.fill();

    /* the lump: a few flats, so it reads as cleaved ice and not a ball */
    c.rotate(Math.sin(a * 0.4) * 0.16);
    c.beginPath();
    for (k = 0; k < 9; k++) {
      var ang = k / 9 * 6.2832;
      var rad = r * (0.86 + 0.20 * Math.sin(k * 2.3 + o.ph));
      k ? c.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.94)
        : c.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.94);
    }
    c.closePath();
    var g = c.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, 'rgba(226,248,255,.95)');
    g.addColorStop(0.5, 'rgba(150,215,245,.92)');
    g.addColorStop(1, 'rgba(78,164,212,.95)');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.4; c.stroke();

    /* the thing frozen inside, glinting as it turns */
    var pulse = 0.55 + 0.45 * Math.sin(a * 2.1);
    var cg = c.createRadialGradient(-r * 0.1, -r * 0.12, 1, 0, 0, r * 0.62);
    cg.addColorStop(0, 'rgba(255,246,196,' + (0.55 + 0.4 * pulse).toFixed(3) + ')');
    cg.addColorStop(0.6, 'rgba(255,208,86,' + (0.35 * pulse).toFixed(3) + ')');
    cg.addColorStop(1, 'rgba(255,190,60,0)');
    c.fillStyle = cg;
    c.beginPath(); c.arc(0, 0, r * 0.62, 0, 6.2832); c.fill();

    c.fillStyle = 'rgba(255,252,230,' + (0.5 + 0.5 * pulse).toFixed(3) + ')';
    c.beginPath();
    for (k = 0; k < 4; k++) {
      var sa = a * 1.4 + k * 1.5708, sr = r * (k % 2 ? 0.18 : 0.42);
      k ? c.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr)
        : c.moveTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
    }
    c.closePath(); c.fill();

    /* one clean highlight on the ice above it */
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath();
    c.ellipse(-r * 0.34, -r * 0.44, r * 0.3, r * 0.15, -0.5, 0, 6.2832);
    c.fill();
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

  function drawRock(x, y, o, B) {
    var r = o.r, k, a, rad;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(o.rot);

    ctx.fillStyle = B.shadow || 'rgba(86,132,176,.26)';
    ctx.beginPath(); ctx.ellipse(5, 8, r * 1.02, r * 0.9, 0, 0, 6.2832); ctx.fill();

    function outline(scale) {
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
      if (f === 3) {                                 // a second lump beside it
        ctx.moveTo(r * 0.52 * scale, -r * 0.1 * scale);
        ctx.arc(r * 0.22 * scale, r * 0.16 * scale, r * 0.44 * scale, 0, 6.2832);
      }
    }

    /* 0 a rounded boulder, 1 a cleaved shard with flat faces, 2 a low
       slab, 3 a pair leaning together. The outline helper takes the
       per-form squash so the footprint stays the same size. */
    var rform = formOf(o, 4);
    outline(1); ctx.fillStyle = B.rockDark; ctx.fill();

    ctx.save();
    outline(1); ctx.clip();
    /* The stone is turned at random, but sunlight is not: undo the rotation
       so the cap always lies on the upper face instead of drifting round. */
    ctx.rotate(-o.rot);
    ctx.fillStyle = B.rock;                       // lit face
    ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.22, r * 0.92, r * 0.82, -0.35, 0, 6.2832); ctx.fill();

    /* The cap follows the curve of the boulder, so it thins out towards the
       sides instead of cutting straight across like a lid. */
    var t, capY = function (u) {
      return r * (-0.04 - 0.46 * u * u + Math.sin(u * 4.1 + o.pts[0] * 9) * 0.08);
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
    ctx.restore();

    outline(1);
    ctx.strokeStyle = 'rgba(52,72,92,.35)'; ctx.lineWidth = 2;
    ctx.stroke();
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
    ctx.fillStyle = 'rgba(30,80,70,.26)';
    ctx.beginPath(); ctx.ellipse(6, 9, r * 1.0, r * 0.92, 0, 0, 6.2832); ctx.fill();
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

  /* Crystal caves and cosmic ice: a cluster of crystals grown up out of
     the ice, faceted, catching the light on one face. */
  function drawCrystalSpire(x, y, o, B) {
    var r = o.r, n = 5 + formOf(o, 3), k;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(40,20,70,.28)';
    ctx.beginPath(); ctx.ellipse(6, 9, r * 0.98, r * 0.9, 0, 0, 6.2832); ctx.fill();
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

  function drawTree(x, y, o, B) {
    if (B.flora === 'leaf')    return drawLeafPlant(x, y, o, B);
    if (B.flora === 'crystal') return drawCrystalSpire(x, y, o, B);
    var r = o.r, k, a, rad, ri;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(66,104,144,.28)';
    ctx.beginPath(); ctx.ellipse(6, 9, r * 1.02, r * 0.94, 0, 0, 6.2832); ctx.fill();

    ctx.rotate(o.rot);
    function ring(scale, spin, pinch) {
      rad = r * scale;
      ctx.beginPath();
      for (k = 0; k < 22; k++) {
        a = k / 22 * 6.2832 + spin;
        var q = (k % 2) ? rad * pinch : rad;
        var px = Math.cos(a) * q, py = Math.sin(a) * q;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
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
    for (ri = 0; ri < tiers.length; ri++) {
      ring(tiers[ri][0], tiers[ri][1], tiers[ri][2]);
      ctx.fillStyle = tiers[ri][3];
      ctx.fill();
      if (ri > 0) {                                  // each tier steps into the light
        ctx.globalAlpha = 0.10 * ri;
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.rotate(-o.rot);                              // light comes from one place

    /* In midwinter the load is what you notice before the tree: the snow
       reaches the lower tiers and the green is only what shows through. */
    var load = B.snowyTrees || 0;
    ctx.save();                                      // snow settled on the branches
    ring(1.02, 0, 0.76); ctx.clip();
    ctx.globalAlpha = 0.42 + 0.40 * load;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.40, r * (0.62 + 0.30 * load),
                r * (0.42 + 0.28 * load), -0.6, 0, 6.2832);
    ctx.fill();
    ctx.globalAlpha = 0.3 + 0.36 * load;
    ctx.beginPath();
    ctx.ellipse(r * 0.30, -r * 0.46, r * (0.34 + 0.30 * load),
                r * (0.2 + 0.26 * load), 0.5, 0, 6.2832);
    ctx.fill();
    if (load > 0.02) {                               // and a cap right on the crown
      ctx.globalAlpha = 0.5 * load;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.06, r * 0.40, r * 0.34, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  }

  /* A split clean through the ice. Drawn as a hole rather than a stripe:
     the walls catch the light, the depth does not. */
  function drawCrevasse(y, o, B) {
    var top = scrY(o.d + o.span), bot = y;
    var cTop = chuteAt(o.d + o.span) - chuteAt(W.dist);
    var cBot = chuteAt(o.d) - chuteAt(W.dist);
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
  function drawRamp(x, y, o, B) {
    var hw = o.w / 2, h = 48;
    var TOP = -h * 0.62, BOT = h * 0.5;
    function edgeX(t, top) {                         // across the ramp, 0..1
      return top ? (-hw * 0.72 + t * hw * 1.44) : (-hw + t * hw * 2);
    }
    function outline(cc) {
      cc.moveTo(-hw, BOT);
      cc.lineTo(-hw * 0.72, TOP);
      cc.quadraticCurveTo(0, TOP - h * 0.22, hw * 0.72, TOP);
      cc.lineTo(hw, BOT);
      cc.closePath();
    }

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(40,78,116,.34)';
    ctx.beginPath(); ctx.ellipse(5, 13, hw * 1.0, 21, 0, 0, 6.2832); ctx.fill();

    /* Five cleaved planes. Each is darkest at its foot, where the block is
       thickest, and each is a shade off its neighbour so the facets read. */
    /* Irregular, and slanted: evenly spaced upright joins plus level
       fractures made a window with glazing bars in it. */
    var CUT = [0, 0.19, 0.34, 0.58, 0.79, 1];
    var LEAN = [0, 0.06, -0.05, 0.04, -0.07, 0];
    /* Kept deliberately deeper than any chute. The first pass ran the
       planes up to near-white at the lip, and measured against the rocky
       pass the ramp came out four points of luminance from the ice beside
       it — invisible, and this is the one thing you cannot afford to miss
       now that it carries no arrows. */
    var TONE = [['#1f6690', '#7cc0e0'], ['#2c7ba4', '#8fcfe9'],
                ['#1a5f87', '#72b8db'], ['#3287ac', '#99d6ee'],
                ['#256e94', '#84c7e4']];
    /* A fixed palette cannot serve both a bright chute and a dark one:
       deepened enough to show against the rocky pass, the block then
       disappeared into the night run. So it is lifted towards white in
       proportion to how dark the ice underneath it is — the ramp stays
       ice, and stays visible, on every stretch of the hill. */
    /* How dark the run really looks here: the chute is a gradient from
       iceTop down to iceBot, and at night there is fog over the top of it
       as well. Judging by iceTop alone put the night run at 127 when what
       you actually see is nearer 75, and the lift came out far too small. */
    var iceL = (lumOf(B.iceTop) + lumOf(B.iceBot)) * 0.5 - (B.fog || 0) * 60;
    var lift = clamp((205 - iceL) / 120, 0, 1) * 0.78;

    ctx.save();
    ctx.beginPath(); outline(ctx); ctx.clip();
    for (var f = 0; f < 5; f++) {
      var t0 = CUT[f], t1 = CUT[f + 1];
      var g = ctx.createLinearGradient(0, BOT, 0, TOP);
      g.addColorStop(0, mixHex(TONE[f][0], '#eaf7ff', lift));
      g.addColorStop(1, mixHex(TONE[f][1], '#ffffff', lift));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(edgeX(t0, false), BOT + 2);
      ctx.lineTo(edgeX(t0 + LEAN[f], true), TOP - 4);
      ctx.lineTo(edgeX(t1 + LEAN[f + 1], true), TOP - 4);
      ctx.lineTo(edgeX(t1, false), BOT + 2);
      ctx.closePath(); ctx.fill();
    }

    ctx.globalAlpha = 0.09;                          // a whisper of the local light
    ctx.fillStyle = B.iceTop;
    ctx.fillRect(-hw, TOP - 6, hw * 2, h * 1.4);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,255,255,.34)';       // the joins between planes
    ctx.lineWidth = 1.4;
    for (f = 1; f < 5; f++) {
      ctx.beginPath();
      ctx.moveTo(edgeX(CUT[f], false), BOT);
      ctx.lineTo(edgeX(CUT[f] + LEAN[f], true), TOP);
      ctx.stroke();
    }

    /* Short splits, each inside one plane, none of them crossing the lot. */
    ctx.strokeStyle = 'rgba(236,250,255,.55)';
    ctx.lineWidth = 1.2;
    [[-0.62, 0.3, 0.26, 10], [0.1, 0.52, -0.2, -8], [0.55, 0.28, 0.18, 7],
     [-0.2, 0.74, 0.22, 6]].forEach(function (fr) {
      var yy = TOP + (BOT - TOP) * fr[1];
      ctx.beginPath();
      ctx.moveTo(hw * fr[0], yy);
      ctx.lineTo(hw * (fr[0] + fr[2] * 0.6), yy + fr[3] * 0.5);
      ctx.lineTo(hw * (fr[0] + fr[2]), yy + fr[3]);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(244,253,255,.5)';          // air trapped in the block
    [[-0.5, 0.3, 2.4], [-0.15, 0.62, 1.7], [0.28, 0.42, 2.1],
     [0.55, 0.72, 1.5], [0.02, 0.2, 1.4], [-0.62, 0.66, 1.8]].forEach(function (bb) {
      ctx.beginPath();
      ctx.ellipse(hw * bb[0] * 0.8, TOP + (BOT - TOP) * bb[1], bb[2], bb[2] * 1.2, 0, 0, 6.2832);
      ctx.fill();
    });
    ctx.restore();

    /* The lip you leave from, rimed white, and a hard cold edge round it. */
    ctx.strokeStyle = 'rgba(255,255,255,.96)'; ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.72, TOP);
    ctx.quadraticCurveTo(0, TOP - h * 0.22, hw * 0.72, TOP);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,62,94,.8)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); outline(ctx); ctx.stroke();
    ctx.restore();
  }

  /* A tongue of blue ice: wind-scoured glacier surface, polished smooth and
     darker than the snow around it. It replaced a pair of posts with
     pennants — those were the one thing on the hill somebody had to have
     put there, and nothing else in this game is man-made.

     Kept as type 'gate' in the code because that is what it is to the
     rules: a thing you steer through for a bonus. */
  /* A hoop of ice crystals standing upright across the run, for him to
     slide THROUGH. It lay flat on the ice before, and read as a patch to
     cross rather than a ring to go through. From straight above an upright
     hoop is foreshortened to a flat oval, so it is drawn in two halves: the
     far half before the creature and the near half after him, the way the
     snow bridge's roof is — when he crosses it, the ring closes round him.
     A shadow on the ice and a tuft of snow at each foot say it is standing.
     The same width and the same place on the run as ever, so where it pays
     has not moved. Gold when taken, grey when passed by.
     `part` is 'back', 'front', or nothing for the whole thing (icons). */
  function drawGate(x, y, o, part) {
    var hw = o.w / 2, hh = 20;
    var back = part !== 'front', front = part !== 'back';   // null or undefined: the whole hoop
    ctx.save();
    ctx.translate(x, y);

    var lit = o.scored, gone = o.passed && !o.scored;
    var hi = lit ? '#fff4c8' : gone ? '#dde4ea' : '#f4fcff';
    var lo = lit ? '#efae22' : gone ? '#a9b6c1' : '#6cbfea';
    var rim = lit ? 'rgba(140,86,0,.85)' : gone ? 'rgba(110,126,140,.6)' : 'rgba(26,92,146,.8)';
    if (gone) ctx.globalAlpha = 0.6;

    if (back) {
      /* its shadow, thrown on the ice beside it */
      ctx.fillStyle = 'rgba(30,70,110,.18)';
      ctx.beginPath(); ctx.ellipse(10, hh * 0.9, hw * 0.98, hh * 0.32, 0, 0, 6.2832); ctx.fill();
      /* the light held inside it: the part you aim for */
      var glow = ctx.createRadialGradient(0, 0, 2, 0, 0, hw);
      glow.addColorStop(0, lit ? 'rgba(255,224,120,.5)' : gone ? 'rgba(200,210,220,.1)'
                                                           : 'rgba(170,232,255,.38)');
      glow.addColorStop(1, 'rgba(170,232,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 6.2832); ctx.fill();
      /* where it stands in the ice: a tuft of snow at each foot */
      [-1, 1].forEach(function (k) {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath(); ctx.ellipse(k * hw, 3, 9, 5, 0, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(70,120,160,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
      });
    }

    /* the hoop: the far half (upper arc) behind him, the near half in front */
    function band(a0, a1) {
      ctx.lineWidth = 8; ctx.strokeStyle = rim;
      ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, a0, a1); ctx.stroke();
      ctx.lineWidth = 4.6; ctx.strokeStyle = hi;
      ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, a0, a1); ctx.stroke();
    }
    if (back) band(Math.PI, 2 * Math.PI);
    if (front) band(0, Math.PI);

    /* the crystals set into it: short and blunt, gems rather than thorns */
    var per = Math.PI * (3 * (hw + hh) - Math.sqrt((3 * hw + hh) * (hw + 3 * hh)));
    var n = Math.max(8, Math.round(per / 22));
    var sz = clamp(hw * 0.12, 5, 9);
    var twinkle = Math.floor(W.t * 0.09 + (o.d % 31)) % n;
    ctx.lineJoin = 'round';
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.2832 + 0.001;
      var near = Math.sin(a) > 0;
      if ((near && !front) || (!near && !back)) continue;
      var cx = Math.cos(a) * hw, cy = Math.sin(a) * hh;
      var nrm = Math.atan2(Math.sin(a) * hw, Math.cos(a) * hh);   // outward
      var s2 = sz * (i % 2 ? 0.82 : 1.05) * (near ? 1.08 : 0.9);  // nearer looks bigger
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(nrm + Math.PI / 2);
      var tp = -s2 * 1.05, sd = s2 * 0.62, bt = s2 * 0.62;
      ctx.beginPath();
      ctx.moveTo(0, tp); ctx.lineTo(-sd, tp * 0.35); ctx.lineTo(-sd, bt * 0.45); ctx.lineTo(0, bt);
      ctx.closePath(); ctx.fillStyle = hi; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, tp); ctx.lineTo(sd, tp * 0.35); ctx.lineTo(sd, bt * 0.45); ctx.lineTo(0, bt);
      ctx.closePath(); ctx.fillStyle = lo; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, tp); ctx.lineTo(sd, tp * 0.35); ctx.lineTo(sd, bt * 0.45); ctx.lineTo(0, bt);
      ctx.lineTo(-sd, bt * 0.45); ctx.lineTo(-sd, tp * 0.35); ctx.closePath();
      ctx.strokeStyle = rim; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();

      if (i === twinkle && !gone) {                  // light running round the ring
        ctx.save();
        ctx.translate(cx + Math.cos(nrm) * s2, cy + Math.sin(nrm) * s2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        var k = sz * 0.9;
        ctx.moveTo(0, -k); ctx.lineTo(k * 0.22, -k * 0.22); ctx.lineTo(k, 0);
        ctx.lineTo(k * 0.22, k * 0.22); ctx.lineTo(0, k); ctx.lineTo(-k * 0.22, k * 0.22);
        ctx.lineTo(-k, 0); ctx.lineTo(-k * 0.22, -k * 0.22); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    if (lit && front) {                              // sparks thrown off as it is taken
      ctx.fillStyle = 'rgba(255,236,160,.9)';
      for (i = 0; i < 8; i++) {
        var a2 = i / 8 * 6.2832 + 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a2) * hw * 1.22, Math.sin(a2) * hh * 1.6, 2.4, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  /* The near halves of the hoops, drawn after the creature so he passes
     through them rather than over them. */
  /* Still ahead of him: he is nearer the camera than it, so the whole hoop
     is drawn under him. Only once he reaches it does its near half come
     over the top. */
  function hoopAhead(o) { return o.d - W.dist > 26; }
  function drawGateFronts() {
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (o.t !== 'gate' || hoopAhead(o)) continue;
      var y = scrY(o.d);
      if (y < -60 || y > VIEW_H + 60) continue;
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
    var tail = Math.sin(ph) * 0.42;
    var bend = Math.sin(ph - 0.8) * 0.3;             // the body trails the tail
    var L = gold ? 25 : 18, Hh = gold ? 13 : 10;

    ctx.save();
    ctx.translate(x, y + Math.sin(W.t * 0.07 + o.ph) * 3);
    ctx.rotate(Math.PI / 2 + bend * 0.3);

    var halo = gold ? 0.3 + 0.16 * Math.sin(W.t * 0.13 + o.ph) : 0.22;
    ctx.fillStyle = gold ? 'rgba(255,205,60,' + halo.toFixed(2) + ')'
                         : 'rgba(150,215,255,.22)';
    ctx.beginPath(); ctx.arc(0, 0, L * 1.35, 0, 6.2832); ctx.fill();

    ctx.save(); ctx.rotate(tail);                    // tail fin
    var tg = ctx.createLinearGradient(L * 0.4, 0, L * 1.2, 0);
    tg.addColorStop(0, gold ? '#f0b52a' : '#6bb6e0');
    tg.addColorStop(1, gold ? '#c8850a' : '#3d84b8');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(L * 0.42, 0);
    ctx.quadraticCurveTo(L * 0.9, -Hh * 0.5, L * (gold ? 1.3 : 1.12), -Hh * 1.1);
    ctx.quadraticCurveTo(L * 0.95, 0, L * (gold ? 1.3 : 1.12), Hh * 1.1);
    ctx.quadraticCurveTo(L * 0.9, Hh * 0.5, L * 0.42, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    [-1, 1].forEach(function (k) {                   // pectoral fins, trailing
      ctx.save();
      ctx.translate(-L * 0.12, k * Hh * 0.62);
      ctx.rotate(k * (0.5 + Math.sin(ph - 1.2) * 0.26));
      ctx.fillStyle = gold ? 'rgba(240,186,48,.85)' : 'rgba(110,180,220,.85)';
      ctx.beginPath();
      ctx.ellipse(L * 0.16, 0, L * 0.26, Hh * 0.28, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    });

    ctx.save();                                      // dorsal fin
    ctx.rotate(Math.sin(ph - 0.4) * 0.12);
    ctx.fillStyle = gold ? '#e8a318' : '#5aa9d8';
    ctx.beginPath();
    ctx.moveTo(-L * 0.28, -Hh * 0.75);
    ctx.quadraticCurveTo(L * 0.08, -Hh * (gold ? 1.9 : 1.6), L * 0.36, -Hh * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    var g = ctx.createLinearGradient(0, -Hh, 0, Hh);  // the body
    if (gold) { g.addColorStop(0, '#fff0b4'); g.addColorStop(0.45, '#ffc531');
                g.addColorStop(1, '#c9820a'); }
    else      { g.addColorStop(0, '#eaf7ff'); g.addColorStop(0.45, '#8fcdf0');
                g.addColorStop(1, '#3f82b4'); }
    ctx.fillStyle = g;
    ctx.beginPath();                                 // flexing, not an ellipse
    ctx.moveTo(-L, 0);
    ctx.quadraticCurveTo(-L * 0.2, -Hh * (1 + bend), L * 0.45, -Hh * 0.42);
    ctx.quadraticCurveTo(L * 0.5, 0, L * 0.45, Hh * 0.42);
    ctx.quadraticCurveTo(-L * 0.2, Hh * (1 - bend), -L, 0);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = gold ? 'rgba(255,245,200,.75)' : 'rgba(236,250,255,.6)';
    ctx.lineWidth = 1.6;                             // the light along its flank
    ctx.beginPath();
    ctx.moveTo(-L * 0.72, -Hh * 0.12 - bend * 2);
    ctx.quadraticCurveTo(-L * 0.1, -Hh * 0.44 - bend * 4, L * 0.4, -Hh * 0.1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,74,104,.28)'; ctx.lineWidth = 1.3;
    ctx.beginPath();                                 // gill
    ctx.moveTo(-L * 0.42, -Hh * 0.62);
    ctx.quadraticCurveTo(-L * 0.3, 0, -L * 0.42, Hh * 0.62);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-L * 0.6, -Hh * 0.22, Hh * 0.3, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#23304a';
    ctx.beginPath(); ctx.arc(-L * 0.62, -Hh * 0.22, Hh * 0.15, 0, 6.2832); ctx.fill();

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
      });
    } else if (S.accessory === 'cap') {
      c.fillStyle = S.accent;
      c.beginPath(); c.ellipse(0, -26, 10.5, 9.5, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.ellipse(-3, -29, 4.5, 3.5, -0.4, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(0,0,0,.22)';              // brim, towards the tail
      c.beginPath(); c.ellipse(0, -19, 11.5, 4, 0, 0, 6.2832); c.fill();
    } else if (S.accessory === 'tusk') {
      /* The one thing that makes a narwhal a narwhal. Straight out in
         front, with the spiral it is known for. */
      c.save();
      c.fillStyle = S.accent;
      c.beginPath();
      c.moveTo(-2.6, -30); c.lineTo(2.6, -30);
      c.lineTo(0.9, -60); c.lineTo(-0.9, -60);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(120,110,92,.55)'; c.lineWidth = 0.9;
      for (var tw = 0; tw < 5; tw++) {                 // the spiral
        var ty = -34 - tw * 5.4;
        c.beginPath();
        c.moveTo(-2.3 + tw * 0.3, ty);
        c.lineTo(2.3 - tw * 0.3, ty - 3);
        c.stroke();
      }
      c.restore();
    } else if (S.accessory === 'puffin') {
      /* A puffin from above is a black back and a face: pale cheeks either
         side of the head, an eye set in each, and the beak — broad, short
         and banded grey, yellow and red. A tall narrow cone read as a party
         hat. */
      [-1, 1].forEach(function (k) {
        c.fillStyle = '#eef2f6';
        c.beginPath(); c.ellipse(k * 8, -27, 6.4, 7.4, k * 0.25, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(60,70,84,.35)'; c.lineWidth = 0.8; c.stroke();
      });
      function beak(cc) {
        cc.beginPath();
        cc.moveTo(-7, -31); cc.quadraticCurveTo(0, -33.5, 7, -31);
        cc.quadraticCurveTo(5.5, -38, 0.8, -42.5); cc.quadraticCurveTo(0, -43, -0.8, -42.5);
        cc.quadraticCurveTo(-5.5, -38, -7, -31);
        cc.closePath();
      }
      c.save();
      beak(c); c.fillStyle = S.accent; c.fill();
      c.clip();
      c.fillStyle = '#6f8196';                        // grey-blue at the base
      c.fillRect(-9, -34.5, 18, 3.6);
      c.fillStyle = '#ffd23a';                        // the yellow ridge
      c.fillRect(-9, -37.2, 18, 1.6);
      c.fillStyle = 'rgba(255,255,255,.35)';          // light along one side
      c.beginPath(); c.ellipse(-2.4, -37, 1.2, 4, 0.25, 0, 6.2832); c.fill();
      c.restore();
      beak(c); c.strokeStyle = 'rgba(90,30,10,.6)'; c.lineWidth = 1; c.stroke();
    } else if (S.accessory === 'collar') {
      /* The emperor's marks: gold at the throat, showing past the head, and
         a blaze either side of the neck. */
      var tg = c.createLinearGradient(0, -24, 0, -12);
      tg.addColorStop(0, 'rgba(255,214,90,.0)'); tg.addColorStop(0.5, 'rgba(255,200,70,.75)');
      tg.addColorStop(1, 'rgba(255,214,90,0)');
      c.fillStyle = tg;
      c.beginPath(); c.ellipse(0, -17, 14, 5, 0, 0, 6.2832); c.fill();
      [-1, 1].forEach(function (k) {
        var cg = c.createLinearGradient(k * 6, -28, k * 16, -14);
        cg.addColorStop(0, '#fff1b0'); cg.addColorStop(1, S.accent);
        c.fillStyle = cg;
        c.beginPath();
        c.moveTo(k * 7, -30);
        c.quadraticCurveTo(k * 17, -26, k * 16, -13);
        c.quadraticCurveTo(k * 11, -16, k * 6, -20);
        c.closePath(); c.fill();
      });
    } else if (S.accessory === 'glow') {
      var gg = c.createRadialGradient(0, -4, 10, 0, -4, 34);
      gg.addColorStop(0, 'rgba(159,232,255,0)');
      gg.addColorStop(1, 'rgba(159,232,255,.5)');
      c.fillStyle = gg;
      c.beginPath(); c.ellipse(0, -4, 30, 33, 0, 0, 6.2832); c.fill();
    }
  }

  /* One painter, two callers: the live penguin on the hill and the little
     portrait on each shop card. Everything it needs comes in through `o`,
     so the preview does not have to fake a world to borrow the drawing. */
  /* ---- the creatures -------------------------------------------
     All of them are seen from straight above, flat out on their fronts
     with the head forward. What has to read at this size is the
     silhouette and two or three markings; anything finer is mud. */

  function bodyPenguin(c, S, ang, wag, o) {
    [-1, 1].forEach(function (k) {                    // flippers, beating alternately
      c.save();
      c.translate(k * 17, -4);
      c.rotate(k * (0.6 + swing(o, k > 0 ? 0 : Math.PI, 0.17)) - ang * 0.32 * k);
      var fg = c.createLinearGradient(0, -6, k * 30, 16);
      fg.addColorStop(0, S.flipper[0]); fg.addColorStop(0.6, S.flipper[1]);
      fg.addColorStop(1, S.flipper[2]);
      c.fillStyle = fg;
      c.beginPath();
      c.moveTo(0, -9);
      c.quadraticCurveTo(k * 25, -4, k * 22, 13);
      c.quadraticCurveTo(k * 11, 9, 0, 10);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(170,198,230,.4)'; c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, -8);
      c.quadraticCurveTo(k * 24, -4, k * 21, 12);
      c.stroke();
      c.restore();
    });

    [-1, 1].forEach(function (k) {                    // webbed feet trailing behind
      c.save();
      c.translate(k * 11, 26 + swing(o, k > 0 ? 1.1 : 1.1 + Math.PI, 1.1));
      c.rotate(k * (0.5 + swing(o, k > 0 ? 1.1 : 1.1 + Math.PI, 0.13)));
      c.fillStyle = S.trim;
      c.beginPath();
      c.moveTo(0, -6);
      c.lineTo(k * 12, 9); c.lineTo(k * 5, 11); c.lineTo(k * 6, 14);
      c.lineTo(-k * 1, 12); c.lineTo(-k * 2, 15); c.lineTo(-k * 7, 8);
      c.closePath(); c.fill();
      c.strokeStyle = S.trimEdge; c.lineWidth = 1.2;
      c.stroke();
      c.restore();
    });

    c.fillStyle = 'rgba(244,250,255,.7)';             // white front, just peeking
    [-1, 1].forEach(function (k) {
      c.beginPath();
      c.ellipse(k * 13, 19, 5.5, 8.5, k * 0.45, 0, 6.2832);
      c.fill();
    });

    var bg = c.createRadialGradient(-8, -12, 4, 0, 0, 34);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(0, -22);
    c.bezierCurveTo(16, -24, 23, -10, 22, 5);
    c.bezierCurveTo(21, 19, 12, 25, 0, 25);
    c.bezierCurveTo(-12, 25, -21, 19, -22, 5);
    c.bezierCurveTo(-23, -10, -16, -24, 0, -22);
    c.closePath(); c.fill();
    /* A penguin is feathered, and feathers lie flat. Giving it the same
       fringe as the bear just made it look like it was moulting, so all it
       gets is a grain of barbs lying along the back. */
    c.save();
    c.globalAlpha = 0.2;
    furCoat(c, 0, 17, 19, 22, S.body[0], 7);
    c.globalAlpha = 1;
    c.restore();

    crease(c, 0, -17, 12, 5, 0.16);                   // where the head sits on the back
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -25, 12.5, 11.5, 0, 0, 6.2832); c.fill();
    sheen(c, -4, -29, 6, 4.5, -0.4, 0.16);            // light on the crown

    sheen(c, -7, -9, 8.5, 15, -0.25, 0.14);           // along the back
    sheen(c, 9, 2, 3.5, 11, 0.2, 0.07);               // a thin edge on the far side
    eyes(c, -26, 7.4, 1.5, 2.7);                      // set wide, as a bird's are

    drawSkinExtra(c, S);

    c.fillStyle = S.trim;                             // beak past the head
    c.beginPath();
    c.moveTo(-5, -30); c.lineTo(0, -39); c.lineTo(5, -30);
    c.closePath(); c.fill();
    if (S.beakStripe) {                               // the emperor's orange streak
      c.fillStyle = S.beakStripe;
      c.beginPath(); c.moveTo(-1.6, -30.5); c.lineTo(0, -36); c.lineTo(1.6, -30.5); c.closePath(); c.fill();
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
  function eyes(c, cy, spread, up, r, dark) {
    [-1, 1].forEach(function (k) {
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.beginPath(); c.ellipse(k * spread, cy - up + 0.8, r * 1.35, r * 1.2, 0, 0, 6.2832); c.fill();
      c.fillStyle = dark || '#121418';
      c.beginPath(); c.ellipse(k * spread, cy - up, r, r * 0.95, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)';         // catchlight, same side on both
      c.beginPath(); c.arc(k * spread - r * 0.34, cy - up - r * 0.34, r * 0.34, 0, 6.2832); c.fill();
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
    furRing(c, 4, 23, 26, 62, 2.4, '#6b4130', '#a97a5f', 31);  // short, coarse hide
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
    [-1, 1].forEach(function (k) {                    // tail flukes, sweeping together
      var sw2 = swing(o, 0.6, 0.26);
      c.fillStyle = S.flipper[2];
      c.beginPath();
      c.ellipse(k * 10 + sw2 * 6, 30, 8, 11, k * 0.5 + sw2, 0, 6.2832);
      c.fill();
    });
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
    c.strokeStyle = 'rgba(70,40,28,.3)'; c.lineWidth = 1.6;
    [-1, 1].forEach(function (k) {                    // folds across the shoulders
      for (var wf = 0; wf < 2; wf++) {
        c.beginPath();
        c.arc(0, -4 + wf * 7, 15 + wf * 3, 0.5 + k * 0.1, 2.6 - k * 0.1);
        c.stroke();
      }
    });
    [-1, 1].forEach(function (k) {                    // tusks
      c.fillStyle = '#f6f2e4';
      c.beginPath();
      c.moveTo(k * 4.5, -34);
      c.quadraticCurveTo(k * 8, -44, k * 6, -50);
      c.lineTo(k * 2.5, -48);
      c.quadraticCurveTo(k * 4, -42, k * 1.5, -34);
      c.closePath(); c.fill();
    });
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, -35, 3.6, 2.8, 0, 0, 6.2832); c.fill();
  }

  function bodySeal(c, S, ang, wag, o) {
    [-1, 1].forEach(function (k) {                    // little front flippers
      c.save();
      c.translate(k * 15, 0);
      c.rotate(k * (0.62 + swing(o, k > 0 ? 0 : Math.PI, 0.2)) - ang * 0.3 * k);
      c.fillStyle = S.flipper[1];
      c.beginPath(); c.ellipse(0, 2, 6.5, 12, k * 0.35, 0, 6.2832); c.fill();
      c.restore();
    });
    [-1, 1].forEach(function (k) {                    // rear flippers, fanned
      c.save();
      c.translate(k * 9, 28);
      c.rotate(k * (0.7 + swing(o, 0, 0.22)));        // rear flippers fan together
      c.fillStyle = S.flipper[2];
      c.beginPath();
      c.moveTo(0, -8);
      c.quadraticCurveTo(k * 14, 2, k * 10, 14);
      c.quadraticCurveTo(k * 3, 8, 0, 6);
      c.closePath(); c.fill();
      c.restore();
    });
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
    c.fillStyle = 'rgba(0,0,0,.14)';                  // dappled back
    [[-7, -6], [6, -2], [-3, 8], [8, 12], [-8, 15]].forEach(function (q) {
      c.beginPath(); c.ellipse(q[0], q[1], 3.4, 2.6, 0.3, 0, 6.2832); c.fill();
    });
    if (S.paws) {                                     // the otter's paws, held on its chest
      [-1, 1].forEach(function (k) {
        c.fillStyle = S.paws;
        c.beginPath(); c.ellipse(k * 5, -13, 3.6, 4.2, k * 0.5, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.8;
        c.beginPath(); c.arc(k * 5, -14, 2.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      });
    }
    crease(c, 0, -19, 11, 5, 0.14);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -28, 13, 12, 0, 0, 6.2832); c.fill();
    if (edge(c, S, 1.8)) c.stroke();
    sheen(c, -4, -32, 6, 4.5, -0.4, 0.18);
    c.fillStyle = S.mark;
    c.beginPath(); c.ellipse(0, -36, 7, 5.5, 0, 0, 6.2832); c.fill();
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, -39, 3.2, 2.6, 0, 0, 6.2832); c.fill();
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
      beam(cc, [[k * 1, -38], [k * 7, -40], [k * 14, -38]], 4.6, 4.2);            // the boss
      beam(cc, [[k * 13, -38], [k * 19, -36], [k * 20, -29], [k * 16, -24]], 4.0, 1.8);  // the sweep
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
    var sw = -ang * 0.18;
    /* Diagonal pairs move together, which is what a trot looks like from
       above: front-right with hind-left, and the other two opposite. */
    var P = Math.PI, g1 = swing(o, 0, 0.22), g2 = swing(o, P, 0.22);
    var LEGS = [
      [ 11, -14,  0.42 + sw + g1, 15 + g1 * 6], [-11, -14,  2.72 - sw - g2, 14.4 + g2 * 6],
      [ 10,  20,  0.95 + sw + g2, 15 + g2 * 6], [-10,  20,  2.19 - sw - g1, 15.4 + g1 * 6]
    ];
    function build(cc) {
      antler(cc,  1);
      antler(cc, -1);
      lump(cc, 0, -34, 8.5, 8, 0);                   // skull
      lump(cc, 0, -42, 5.6, 7, 0);                   // long muzzle
      wedge(cc, 8, -33, 13, -30, 4);                 // ears, low and sideways
      wedge(cc, -8, -33, -13, -30, 4);
      lump(cc, 0, -24, 9, 10, 0);                    // neck
      lump(cc, 0, -10, 15, 15, 0);                   // chest
      lump(cc, 0, 8, 14.5, 18, 0);                   // barrel
      lump(cc, 0, 26, 13.5, 13, 0);                  // haunches
      for (var i = 0; i < LEGS.length; i++)
        limb(cc, LEGS[i][0], LEGS[i][1], LEGS[i][2], LEGS[i][3], 6.4);
      for (i = 0; i < LEGS.length; i++) {
        var t = limbTip(LEGS[i][0], LEGS[i][1], LEGS[i][2], LEGS[i][3]);
        lump(cc, t[0], t[1], 4.6, 4.2, LEGS[i][2]);  // hooves
      }
    }

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
    LEGS.forEach(function (L) {
      var t = limbTip(L[0], L[1], L[2], L[3]);
      sphere(c, t[0], t[1], 4.6, 4.2, L[2], 0.55);
      pocket(c, L[0] * 0.8, L[1], 9, 'rgba(50,34,22,.2)');
    });
    c.fillStyle = 'rgba(232,220,200,.75)';           // pale rump and throat
    c.beginPath(); c.ellipse(0, 33, 10, 8, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(0, -26, 7, 5, 0, 0, 6.2832); c.fill();
    c.restore();


    if (S.horns) {
      /* The coat a musk ox is known for: long guard hair hanging off its
         flanks like a skirt, which from above is a fringe all the way down
         either side. */
      c.save();
      c.strokeStyle = 'rgba(28,18,12,.55)'; c.lineCap = 'round';
      for (var fy = -16; fy <= 30; fy += 4.5) {
        var fw = fy < 0 ? 13 + (fy + 18) * 0.12 : fy < 18 ? 15.5 : 15.5 - (fy - 18) * 0.12;
        [-1, 1].forEach(function (k) {
          var j = strandJit(fy + 40, k > 0 ? 5 : 9);
          c.lineWidth = 1 + j * 0.7;
          c.beginPath();
          c.moveTo(k * (fw - 1), fy);
          c.quadraticCurveTo(k * (fw + 2), fy + 1.5, k * (fw + 2.5 + j * 2.5), fy + 4.5);
          c.stroke();
        });
      }
      c.strokeStyle = 'rgba(255,240,220,.18)'; c.lineWidth = 1;     // light on the long hair
      for (var gy = -14; gy <= 28; gy += 6) {
        c.beginPath(); c.moveTo(-6, gy); c.quadraticCurveTo(-3, gy + 4, -5, gy + 8); c.stroke();
        c.beginPath(); c.moveTo(6, gy + 3); c.quadraticCurveTo(3, gy + 7, 5, gy + 11); c.stroke();
      }
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
    LEGS.forEach(function (L) {
      var t = limbTip(L[0], L[1], L[2], L[3]);
      c.save(); c.translate(t[0], t[1]); c.rotate(L[2]);
      c.fillStyle = S.pawDark;
      c.beginPath(); c.ellipse(1, 0, 3.6, 3.2, 0, 0, 6.2832); c.fill();
      c.restore();
    });
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
      limb(cc,  14, -8,  0.62 + fa * 0.1 + swing(o, 0, 0.1), 19, 7);
      limb(cc, -14, -8,  2.52 - fa * 0.1 - swing(o, Math.PI, 0.1), 19, 7);
      lump(cc, 0, 6, 6, 13, 0);                      // the dorsal, edge on
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
    c.fillStyle = S.mark;                            // the eye patches, unmistakable
    [-1, 1].forEach(function (k) {
      c.save();
      c.translate(k * 6.8, -34); c.rotate(k * 0.42);
      c.beginPath(); c.ellipse(0, 0, 5.6, 3.2, 0, 0, 6.2832); c.fill();
      c.restore();
    });
    c.fillStyle = 'rgba(244,248,251,.92)';           // and the chin, just showing
    c.beginPath(); c.ellipse(0, -41, 5, 3.4, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(206,222,234,.85)';           // the saddle behind the dorsal
    c.beginPath(); c.ellipse(0, 19, 11, 7.5, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)';            // wet shine down the back
    c.beginPath(); c.ellipse(-5, -6, 4.5, 26, -0.04, 0, 6.2832); c.fill();
    /* the dorsal stands up, so from here it is a hard-edged blade */
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.beginPath(); c.ellipse(1.5, 6, 4.5, 13, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(120,140,164,.5)';
    c.beginPath(); c.ellipse(-1.5, 6, 2.2, 12, 0, 0, 6.2832); c.fill();
    c.restore();

    eyes(c, -34, 6.8, 0, 1.5, '#05080c');
  
    /* The penguin body calls this from inside itself, so anything on
       another body got no accessory at all — which is why the narwhal
       turned up without the one thing that makes it a narwhal. */
    drawSkinExtra(c, S);
}

  /* From directly overhead a hare is a compact body with two long ears
     laid back along it, and an owl is a round body with the wings swept
     into a V. Neither reads as any of the others at this size, which is
     the whole reason they get painters of their own rather than a recolour
     of the seal. */
  function bodyHare(c, S, ang, wag, o) {
    var k, lean;
    /* The same compact body carries the snow leopard and the lemming
       (S.cat): short round ears in place of the long ones, and a tail —
       long and thick for the leopard, a stub for the lemming. */
    if (S.cat && !S.stub) {                           // the leopard's tail, swinging
      var tsw = swing(o, 0.6, 0.35) - ang * 0.5;
      c.save();
      c.lineCap = 'round';
      c.strokeStyle = S.body[2]; c.lineWidth = 10;
      c.beginPath(); c.moveTo(0, 24);
      c.quadraticCurveTo(14 * Math.sin(tsw) + 4, 44, 22 * Math.sin(tsw + 0.6), 58);
      c.stroke();
      c.strokeStyle = S.body[1]; c.lineWidth = 7;
      c.beginPath(); c.moveTo(0, 24);
      c.quadraticCurveTo(14 * Math.sin(tsw) + 4, 44, 22 * Math.sin(tsw + 0.6), 58);
      c.stroke();
      if (S.spot) {                                   // rings down the tail
        c.fillStyle = S.spot;
        for (k = 1; k <= 3; k++) {
          var tt = k / 3.4, tx = (1 - tt) * (1 - tt) * 0 + 2 * (1 - tt) * tt * (14 * Math.sin(tsw) + 4) + tt * tt * 22 * Math.sin(tsw + 0.6);
          var ty = (1 - tt) * (1 - tt) * 24 + 2 * (1 - tt) * tt * 44 + tt * tt * 58;
          c.beginPath(); c.ellipse(tx, ty, 4, 2.6, 0, 0, 6.2832); c.fill();
        }
      }
      c.restore();
    } else if (S.cat && S.stub) {                     // the lemming's stub
      c.fillStyle = S.body[2];
      c.beginPath(); c.ellipse(0, 30, 4.5, 5, 0, 0, 6.2832); c.fill();
    }
    [-1, 1].forEach(function (kk) {                   // hind legs, bunched
      c.save();
      c.translate(kk * 13, 20);
      c.rotate(kk * (0.5 + swing(o, kk > 0 ? 0 : Math.PI, 0.26)));
      c.fillStyle = S.flipper[2];
      c.beginPath(); c.ellipse(0, 0, 7.5, 14, 0, 0, 6.2832); c.fill();
      c.restore();
    });
    [-1, 1].forEach(function (kk) {                   // forepaws, tucked under
      c.save();
      c.translate(kk * 10, -6);
      c.rotate(kk * (0.34 + swing(o, Math.PI, 0.12)));
      c.fillStyle = S.flipper[1];
      c.beginPath(); c.ellipse(0, 4, 4.6, 10, 0, 0, 6.2832); c.fill();
      c.restore();
    });
    var bg = c.createRadialGradient(-6, -12, 4, 0, 0, 30);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    c.beginPath();                                    // short and round-rumped
    c.moveTo(0, -22);
    c.bezierCurveTo(12, -23, 17, -6, 16, 9);
    c.bezierCurveTo(15, 23, 8, 29, 0, 29);
    c.bezierCurveTo(-8, 29, -15, 23, -16, 9);
    c.bezierCurveTo(-17, -6, -12, -23, 0, -22);
    c.closePath(); c.fill();

    if (S.stripe) {                                   // the lemming's dark back
      /* soft at the edges, as fur is, not a slot cut down the back */
      var sg = c.createLinearGradient(-7, 0, 7, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.5, S.stripe); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg;
      c.beginPath(); c.ellipse(0, 2, 7, 22, 0, 0, 6.2832); c.fill();
    }
    if (S.spot) {                                     // the leopard's rosettes
      var ROS = [[-8, -12, 3.6], [7, -9, 3.2], [-10, 4, 3.4], [9, 6, 3.8], [-2, -2, 3],
                 [-6, 16, 3.4], [6, 19, 3.2], [1, 10, 2.6], [-12, -4, 2.4], [12, -2, 2.4]];
      /* A rosette is a broken ring of three or four dark blots round a
         slightly darker middle, each one turned its own way — drawn as one
         unbroken arc every time, they all opened the same way and read as a
         row of letter Cs. */
      ROS.forEach(function (r, ri) {
        c.fillStyle = 'rgba(70,76,88,.35)';
        c.beginPath(); c.arc(r[0], r[1], r[2] * 0.8, 0, 6.2832); c.fill();
        c.fillStyle = S.spot;
        var nb = 3 + (ri % 2), a0 = ri * 1.9;
        for (var bi = 0; bi < nb; bi++) {
          var ba = a0 + bi / nb * 6.2832;
          c.beginPath();
          c.ellipse(r[0] + Math.cos(ba) * r[2], r[1] + Math.sin(ba) * r[2],
                    r[2] * 0.42, r[2] * 0.3, ba, 0, 6.2832);
          c.fill();
        }
      });
    }

    /* The cats and the lemming hold their forepaws out in front, either
       side of the head. Tucked under the body as the hare's are, they did
       not show at all, and the animal looked as if it had no front legs. */
    if (S.cat) [-1, 1].forEach(function (kk) {
      var big = S.spot ? 1.15 : 1;
      c.save();
      c.translate(kk * 9.5, -17 - swing(o, kk > 0 ? 0 : Math.PI, 1.6));
      c.rotate(kk * 0.18);
      var pg2 = c.createRadialGradient(-1, -2, 1, 0, 0, 7 * big);
      pg2.addColorStop(0, S.body[0]); pg2.addColorStop(1, S.body[1]);
      c.fillStyle = pg2;
      c.beginPath(); c.ellipse(0, 0, 4.4 * big, 6.2 * big, 0, 0, 6.2832); c.fill();
      c.strokeStyle = S.body[2]; c.lineWidth = 1; c.stroke();
      c.strokeStyle = 'rgba(30,24,20,.45)'; c.lineWidth = 0.9;          // toes
      [-1.6, 0, 1.6].forEach(function (tx) {
        c.beginPath(); c.moveTo(tx * big, -6 * big); c.lineTo(tx * big, -3.6 * big); c.stroke();
      });
      if (S.spot) {                                   // a blot or two on the leopard's paw
        c.fillStyle = S.spot;
        c.beginPath(); c.ellipse(1.2, 1.5, 1.4, 1, 0.4, 0, 6.2832); c.fill();
      }
      c.restore();
    });

    var hg = c.createRadialGradient(-4, -30, 2, 0, -26, 15);   // head
    hg.addColorStop(0, S.body[0]); hg.addColorStop(1, S.body[1]);
    c.fillStyle = hg;
    c.beginPath(); c.ellipse(0, -26, 12, 11, 0, 0, 6.2832); c.fill();

    if (S.cat) [-1, 1].forEach(function (kk) {       // short round ears
      c.fillStyle = S.body[2];
      c.beginPath(); c.arc(kk * 8.5, -34, 4.6, 0, 6.2832); c.fill();
      c.fillStyle = S.mark;
      c.beginPath(); c.arc(kk * 8.5, -34, 2.3, 0, 6.2832); c.fill();
    });
    if (!S.cat) [-1, 1].forEach(function (kk) {      // the ears, laid back
      lean = kk * (0.26 + swing(o, kk > 0 ? 1.1 : 2.2, 0.07)) - ang * 0.4 * kk;
      c.save();
      c.translate(kk * 5, -29);
      c.rotate(lean);
      /* Broad and leaf-shaped, not a stick with a bead on the end — and
         squashed down the long way, because at full length the tips ran
         off the top of the shop portrait and off the top of the creature
         on the hill. */
      c.scale(0.94, 0.58);
      c.fillStyle = S.body[1];
      c.beginPath();
      c.moveTo(0, 2);
      c.bezierCurveTo(-7.5, -6, -8, -22, -2, -30);
      c.bezierCurveTo(2, -33, 6, -27, 7, -16);
      c.bezierCurveTo(7.6, -7, 4, -1, 0, 2);
      c.closePath(); c.fill();
      c.fillStyle = S.mark;                           // the inner ear
      c.beginPath();
      c.moveTo(0, -1);
      c.bezierCurveTo(-4.4, -8, -4.6, -20, -1, -26);
      c.bezierCurveTo(1.6, -27.6, 3.6, -23, 4, -15);
      c.bezierCurveTo(4.4, -8, 2.2, -3, 0, -1);
      c.closePath(); c.fill();
      c.fillStyle = S.nose;                           // black tip
      c.beginPath();
      c.ellipse(1.4, -27.5, 4.4, 3.4, -0.35, 0, 6.2832); c.fill();
      c.restore();
    });
    c.fillStyle = S.mark;                             // cheeks
    c.beginPath(); c.ellipse(0, -24, 8.5, 7, 0, 0, 6.2832); c.fill();
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, -31, 2.6, 2.1, 0, 0, 6.2832); c.fill();
    if (S.cat) {
      eyes(c, -29, 6.2, 0, 1.9, '#1d2228');
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.8;       // whiskers
      [-1, 1].forEach(function (kk) {
        c.beginPath(); c.moveTo(kk * 3, -26); c.lineTo(kk * 13, -29); c.stroke();
        c.beginPath(); c.moveTo(kk * 3, -24.5); c.lineTo(kk * 13, -24); c.stroke();
      });
    }
  }

  function bodyOwl(c, S, ang, wag, o) {
    [-1, 1].forEach(function (kk) {                   // wings, swept into a V
      c.save();
      c.translate(kk * 13, -2);
      c.rotate(kk * (0.5 + swing(o, kk > 0 ? 0 : Math.PI, 0.16)) - ang * 0.5 * kk);
      var wgr = c.createLinearGradient(0, -16, 0, 22);
      wgr.addColorStop(0, S.flipper[0]); wgr.addColorStop(1, S.flipper[2]);
      c.fillStyle = wgr;
      c.beginPath();
      c.moveTo(0, -16);
      c.quadraticCurveTo(kk * 15, -2, kk * 11, 24);
      c.quadraticCurveTo(kk * 2, 14, 0, -4);
      c.closePath(); c.fill();
      c.restore();
    });
    var bg = c.createRadialGradient(-6, -10, 4, 0, 0, 30);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, 1, 18, 25, 0, 0, 6.2832); c.fill();

    /* Barring down the back. It is the only thing that stops a white bird
       on white ice from being an oval, so there is a lot of it and it is
       drawn in slate rather than in a lighter shade of the bird. */
    c.fillStyle = S.mark;
    for (var b = 0; b < 6; b++) {
      c.globalAlpha = 0.62 - b * 0.045;
      c.beginPath();
      c.ellipse(0, -9 + b * 7.4, 14 - b * 1.4, 2.2, 0, 0, 6.2832); c.fill();
    }
    /* and a scatter of speckles across the shoulders */
    c.globalAlpha = 0.42;
    [[-9, -5], [9, -4], [-6, 6], [7, 8], [-11, 3], [11, 2]].forEach(function (p) {
      c.beginPath(); c.ellipse(p[0], p[1], 1.9, 1.5, 0, 0, 6.2832); c.fill();
    });
    c.globalAlpha = 1;

    c.fillStyle = S.body[0];                          // the facial disc
    c.beginPath(); c.ellipse(0, -21, 14, 12, 0, 0, 6.2832); c.fill();
    c.strokeStyle = S.outline; c.lineWidth = 1.6; c.stroke();
    [-1, 1].forEach(function (kk) {                   // the eyes that face you
      c.fillStyle = S.accent || '#f2b733';
      c.beginPath(); c.ellipse(kk * 5.4, -22, 4.2, 4.0, 0, 0, 6.2832); c.fill();
      c.fillStyle = S.nose;
      c.beginPath(); c.ellipse(kk * 5.4, -22, 2.0, 2.2, 0, 0, 6.2832); c.fill();
    });
    c.fillStyle = S.nose;
    c.beginPath();
    c.moveTo(0, -18); c.lineTo(-2.2, -21.5); c.lineTo(2.2, -21.5);
    c.closePath(); c.fill();
  }

  var BODIES = { penguin: bodyPenguin, walrus: bodyWalrus, seal: bodySeal,
                 reindeer: bodyReindeer, orca: bodyOrca,
                 hare: bodyHare, owl: bodyOwl };

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
    else if (kind === 'gate')   drawGate(c, c, { w: 54, d: 0, passed: false, scored: false });
    else if (kind === 'find')   drawFind(c, c, { r: 21, ph: 0.4 });
    else if (kind === 'rush')   drawRushBall(c, c, { r: 22, ph: 1.4 });
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
    c.ellipse(5 + lift * 10, 7 + lift * 34, 30 - lift * 9, 34 - lift * 11, 0, 0, 6.2832);
    c.fill();
    c.restore();
    c.scale(o.scale * (1 + 0.5 * lift), o.scale * (1 + 0.5 * lift));

    (BODIES[S.shape] || bodyPenguin)(c, S, ang, wag, o);

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
    var ang = Math.atan2(W.vx, W.speed) * 0.85;       // heading, forward is up
    var crashed = W.state !== 'run';
    /* Being briefly safe is shown with a ring, not by messing with the
       animal itself. Two earlier attempts were both worse: half opacity
       let the seams between a creature's lumps show through as circles,
       and blinking it out left you unable to see your own line for half
       of the second that matters most. */
    var safe = W.invuln > 0 && !crashed;

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
    var gait = W.t * (0.15 + W.speed * 0.038);
    var turn = clamp(W.vx / Math.max(1, DRIFT * W.speed), -1, 1);
    paintCreature(ctx, S, {
      ang: ang, wag: Math.sin(gait) * 0.1, gait: gait, turn: turn,
      scale: 1.45, lift: lift, air: airborne(),
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
  function drawHaze() {
    var top = PLAYER_Y - CLEAR_AHEAD;
    if (top <= 8) return;
    var B = pal();
    var rgb = B.hazeRGB || '220,238,250';
    var g = ctx.createLinearGradient(0, top, 0, 0);
    g.addColorStop(0, 'rgba(' + rgb + ',0)');
    g.addColorStop(0.55, 'rgba(' + rgb + ',0.5)');
    g.addColorStop(1, 'rgba(' + rgb + ',0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, top);
  }

  /* Night closes the hill in: the far end of the run fades out, so a tap has
     to be committed to before the next row is fully in view. */
  function drawFog() {
    var B = pal();
    if (!B.fog || !B.fogRGB) return;
    var h = PLAYER_Y - 40;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(' + B.fogRGB + ',' + B.fog.toFixed(3) + ')');
    g.addColorStop(0.65, 'rgba(' + B.fogRGB + ',' + (B.fog * 0.28).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + B.fogRGB + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, h);
  }

  function drawFlakes() {
    var A = (pal().air) || AIR0, hot = A.hot || 0, f, i, a;
    var lim = Math.round(W.flakes.length * (0.34 + 0.66 * (A.n === undefined ? 0 : A.n)));
    if (hot > 0.02) ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < lim; i++) {
      f = W.flakes[i];
      /* An ember is a coal, not a flake: it pulses as it burns down. */
      a = A.a * (hot ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(W.t * 0.13 + f.ph)) : 1);
      if (hot > 0.02) {                              // the heat it throws
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
    var c = chuteAt(d) - chuteAt(W.dist);
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
    var sp = pace();
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

  function drawPaceVignette() {
    var sp = pace();
    if (sp < 0.12) return;
    var k = clamp((sp - 0.12) / 0.6, 0, 1);
    var w = VIEW_W * (0.34 - 0.10 * k);
    var g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    var a = (0.26 * k).toFixed(3);
    g.addColorStop(0, 'rgba(22,52,82,' + a + ')');
    g.addColorStop(w / VIEW_W, 'rgba(22,52,82,0)');
    g.addColorStop(1 - w / VIEW_W, 'rgba(22,52,82,0)');
    g.addColorStop(1, 'rgba(22,52,82,' + a + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    /* a ribbon threaded through the openings, brightest at the first */
    ctx.beginPath();
    ctx.moveTo(scrX(W.px), PLAYER_Y - 10);
    for (i = 0; i < rows.length; i++)
      ctx.lineTo(scrX(chuteAt(rows[i].d) + rows[i].gap), scrY(rows[i].d));
    ctx.strokeStyle = 'rgba(126,232,170,' + (0.5 * fade).toFixed(3) + ')';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(236,255,244,' + (0.8 * fade).toFixed(3) + ')';
    ctx.lineWidth = 3;
    ctx.stroke();
    /* and a mark in each opening, smaller as they get further off */
    for (i = 0; i < rows.length; i++) {
      var rx = scrX(chuteAt(rows[i].d) + rows[i].gap), ry = scrY(rows[i].d);
      var k = 1 - i * 0.26;
      ctx.globalAlpha = fade * k;
      ctx.strokeStyle = 'rgba(126,232,170,.95)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 26 * k, 11 * k, 0, 0, 6.2832);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* An aurora seen from above is not a curtain in the sky — it is the light
     it lays on the snow. Three slow bands, each on its own drift, so the
     pattern never repeats within a run. */
  function drawAurora() {
    var B = pal(), amt = B.aurora ? (B.auroraA === undefined ? 1 : B.auroraA) : 0;
    if (amt <= 0.01) return;
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
    if (amt <= 0.01) return;
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
    ctx.save();
    ctx.setTransform(hudK, 0, 0, hudK, 0, 0);

    var u = Math.max(13, Math.min(22, Math.min(CSS_W, CSS_H) / 26));
    var padL = 12, padT = 12;
    var FONT = 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';

    /* ---- everything you are reading, in one place ----
       Score, metres, the catch, spare lives and the best used to be three
       separate things: a dark score card, a BEST pill of another style
       that collided with it on a phone, and the lives on a chip of their
       own. They are one slab of the same ice as the menus now, sized to
       what it holds, so nothing can run into anything else. */
    var pad = u * 0.75, gap = u * 0.5;
    var fS = Math.round(u * 1.75), fM = Math.round(u * 1.05), fB = Math.round(u * 0.78);
    /* Time Rush reads the clock where the score would be: it is the thing
       you are racing, and the score there is the distance underneath. */
    var timed = W.mode === 'rush';
    var score = timed ? (W.timeT / 60).toFixed(1) : String(Math.floor(W.score));
    var scoreLab = timed ? tr('hud.time', 'TIME') : tr('hud.score', 'SCORE');
    var distTxt = String(Math.floor(W.dist / 8)) + ' ' + tr('hud.m', 'M');
    /* The catch as the purse counts it — the same number the results card
       adds to your fish — and not the count of fish swallowed, which a
       creature's perk makes a different number. */
    var fishTxt = String(W.coins);
    var lifeTxt = (W.lives > 0 && !timed) ? String(W.lives) : '';
    /* The best is a Freeride number. On a marked run it is another game's
       score, so it is not shown there at all. */
    var bestTxt = (W.best > 0 && !W.course)
                ? tr('hud.best', 'BEST') + '  ' + W.best + (timed ? ' ' + tr('hud.m', 'M') : '') : '';

    var mult = comboMult();
    var wScore = measureAt(score, fS) + u * 0.4 + measureAt(scoreLab, Math.round(u * 0.62)) +
                 (timed ? u * 2.6 : 0) + (mult > 1 ? u * 2.4 : 0);
    var icon = u * 1.5, sep = u * 0.9;
    var wDist = measureAt(distTxt, fM), wFish = icon + measureAt(fishTxt, fM);
    var wLife = lifeTxt ? icon + measureAt(lifeTxt, fM) : 0;
    var wRow2 = wDist + sep + wFish + (lifeTxt ? sep + wLife : 0);
    var wBest = bestTxt ? measureAt(bestTxt, fB) : 0;
    var w = Math.max(u * 7.5, wScore, wRow2, wBest) + pad * 2;
    var h = pad + fS * 0.95 + gap + fM * 0.95 + (bestTxt ? gap * 0.8 + fB * 0.95 : 0) + pad;

    /* The slab itself — blurred shadow, gradient, rim — only changes when
       its size does, so it is drawn once into a canvas of its own and then
       stamped. A blurred shadow redrawn sixty times a second is the single
       most expensive thing a low-end phone's canvas does. Widths are
       snapped so a score ticking over does not redraw it every frame. */
    var wq = Math.ceil(w / 8) * 8;
    var slab = hudSlab(wq, h, u);
    if (slab) ctx.drawImage(slab, padL - u, padT - u, slab.width / hudK, slab.height / hudK);
    else paintSlab(ctx, padL, padT, wq, h, u);
    w = wq;

    var x0 = padL + pad;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* score, the big one */
    var y1 = padT + pad + fS * 0.82;
    ctx.font = '800 ' + fS + FONT;
    var secs = W.timeT / 60;
    ctx.fillStyle = !timed ? '#0b3d7a' : secs < 5 ? '#d22b3f' : secs < 8 ? '#d9730d' : '#0b3d7a';
    if (timed && secs < 5) ctx.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(W.t * 0.15));
    ctx.fillText(score, x0, y1);
    ctx.globalAlpha = 1;
    ctx.font = '800 ' + Math.round(u * 0.62) + FONT;
    ctx.fillStyle = 'rgba(11,61,122,.55)';
    var labX = x0 + measureAt(score, fS) + u * 0.4;
    ctx.fillText(scoreLab, labX, y1);
    /* the run of catches, as a multiplier on points */
    if (mult > 1) {
      var mx = labX + measureAt(scoreLab, Math.round(u * 0.62)) + u * 0.45;
      ctx.fillStyle = '#ffcd3a';
      rr(ctx, mx, y1 - u * 1.05, u * 2.0, u * 1.2, u * 0.5); ctx.fill();
      ctx.strokeStyle = '#ad6800'; ctx.lineWidth = Math.max(1.5, u * 0.1);
      rr(ctx, mx, y1 - u * 1.05, u * 2.0, u * 1.2, u * 0.5); ctx.stroke();
      ctx.font = '800 ' + Math.round(u * 0.85) + FONT;
      ctx.fillStyle = '#7a4a00'; ctx.textAlign = 'center';
      ctx.fillText('x' + mult, mx + u * 1.0, y1 - u * 0.15);
      ctx.textAlign = 'left';
    }
    /* what the last crash cost, for a moment */
    if (timed && W.penT > 0) {
      ctx.globalAlpha = Math.min(1, W.penT / 20);
      ctx.font = '800 ' + Math.round(u * 1.0) + FONT;
      ctx.fillStyle = '#d22b3f';
      ctx.fillText('-' + Math.round(CRASH_COST / 60) + tr('hud.s', 's'),
                   labX + measureAt(scoreLab, Math.round(u * 0.62)) + u * 0.5, y1);
      ctx.globalAlpha = 1;
    }

    /* metres · the catch · spare lives */
    var y2 = y1 + gap + fM * 0.95;
    ctx.font = '800 ' + fM + FONT;
    ctx.fillStyle = '#1d4f7c';
    ctx.fillText(distTxt, x0, y2);
    var fx = x0 + wDist + sep;
    hudFish(fx + icon * 0.42, y2 - fM * 0.34, u * 0.5);
    ctx.fillStyle = '#1d4f7c';
    ctx.fillText(fishTxt, fx + icon, y2);
    if (lifeTxt) {
      var lx = fx + wFish + sep;
      drawHeart(lx + icon * 0.42, y2 - fM * 0.32, u * 0.46);
      ctx.font = '800 ' + fM + FONT;
      ctx.fillStyle = '#b8304a';
      ctx.fillText(lifeTxt, lx + icon, y2);
    }

    /* and the best, small, underneath */
    if (bestTxt) {
      var y3 = y2 + gap * 0.8 + fB * 0.95;
      ctx.font = '800 ' + fB + FONT;
      ctx.fillStyle = '#a86a00';
      ctx.fillText(bestTxt, x0, y3);
    }

    /* The right-hand corner holds the timed things. In the tutorial the
       Skip button lives there, so they sit below it. */
    var rY = padT + ((W.course && W.course.tut) ? 56 : 0);

    /* How much rush is left, as metres rather than a bar: the player is
       already reading metres, and a bar says nothing about the hill. */
    if (W.rushT > 0) {
      var leftM = (W.rushT / 60).toFixed(1);
      ctx.textAlign = 'center';
      ctx.font = '800 ' + Math.round(u * 1.0) + FONT;
      var rt = leftM + tr('hud.s', 'S');
      var rw = ctx.measureText(rt).width + u * 2.2;
      var rx = CSS_W - padL - rw / 2;
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      rr(ctx, rx - rw / 2, rY, rw, u * 1.8, u * 0.9); ctx.fill();
      ctx.strokeStyle = '#062a78'; ctx.lineWidth = Math.max(2, u * 0.12);
      rr(ctx, rx - rw / 2, rY, rw, u * 1.8, u * 0.9); ctx.stroke();
      ctx.fillStyle = '#1d5f8e';
      ctx.fillText(rt, rx, rY + u * 1.3);
      ctx.textAlign = 'left';
      rY += u * 2.3;
    }

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

  function paintSlab(c, x, y, w, h, u) {
    c.save();
    c.shadowColor = 'rgba(3,28,70,.28)'; c.shadowBlur = u * 0.6; c.shadowOffsetY = u * 0.2;
    c.fillStyle = '#062a78';                                   // the edge, for thickness
    rr(c, x, y + u * 0.22, w, h, u * 0.8); c.fill();
    c.restore();
    var pg = c.createLinearGradient(0, y, 0, y + h);
    pg.addColorStop(0, 'rgba(255,255,255,.95)'); pg.addColorStop(1, 'rgba(218,240,252,.93)');
    c.fillStyle = pg;
    rr(c, x, y, w, h, u * 0.8); c.fill();
    c.strokeStyle = '#062a78'; c.lineWidth = Math.max(2, u * 0.14);
    rr(c, x, y, w, h, u * 0.8); c.stroke();
  }
  var slabCv = null, slabKey = '';
  function hudSlab(w, h, u) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var key = w + '|' + h + '|' + u + '|' + hudK;
    if (slabCv && slabKey === key) return slabCv;
    if (!slabCv) slabCv = document.createElement('canvas');
    if (!slabCv.getContext) return null;
    slabCv.width = Math.ceil((w + u * 2) * hudK);
    slabCv.height = Math.ceil((h + u * 2.6) * hudK);
    var c = slabCv.getContext('2d');
    if (!c) return null;
    c.setTransform(hudK, 0, 0, hudK, 0, 0);
    c.clearRect(0, 0, w + u * 2, h + u * 2.6);
    paintSlab(c, u, u, w, h, u);
    slabKey = key;
    return slabCv;
  }

  /* The fish on the readout: still, and drawn for its size. The swimming
     fish off the hill, shrunk into the panel, flicked its tail and bobbed
     beside a number that was trying to be read. */
  function hudFish(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();                                  // tail
    ctx.moveTo(-r * 0.7, 0); ctx.lineTo(-r * 1.45, -r * 0.7); ctx.lineTo(-r * 1.45, r * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#2f8fd0'; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16); ctx.strokeStyle = '#062a78'; ctx.stroke();
    var g = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, '#8fd6ff'); g.addColorStop(1, '#2f8fd0');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.0, r * 0.66, 0, 0, 6.2832); ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.12, r * 0.2, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#062a78';
    ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.12, r * 0.1, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

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

  function resize() {
    if (!canvas) return;
    var vw = Math.max(1, window.innerWidth || 960), vh = Math.max(1, window.innerHeight || 540);

    var scale = Math.min(vw / SAFE_W, vh / SAFE_H);   // world units per css pixel
    VIEW_W = Math.round(vw / scale);                  // both are >= the safe region,
    VIEW_H = Math.round(vh / scale);                  // and together they fill the screen
    stage.style.width = vw + 'px'; stage.style.height = vh + 'px';

    var dpr = window.devicePixelRatio || 1;
    var eff = Math.max(1, Math.min(dpr, 2.5, 3840 / vw, 2160 / vh));
    /* The readouts are drawn in CSS pixels, not world units. In world units
       a 22px label came out at 12.6 real pixels on a 390px phone, because
       one world unit is only `scale` CSS pixels there — which is exactly why
       the score was unreadable on a phone and fine on a laptop. */
    CSS_W = vw; CSS_H = vh; hudK = eff;
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

  function loop(t) {
    if (suspended) { rafId = null; return; }
    rafId = requestAnimationFrame(loop);
    if (!W) return;
    if (!lastT) lastT = t;
    var dt = Math.min(120, t - lastT); lastT = t;
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
       engine — so the world can be gone by the next line. */
    while (W && accT >= STEP_MS && n < 5) { step(); accT -= STEP_MS; n++; }
    if (accT > 400) accT = 0;
    if (W) render();
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
    tap: tap,
    undoTap: undoTap,
    revive: revive,
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
    isRunning: function () { return !!W && W.state === 'run'; },
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
      drawFind(size / 2, size / 2, { r: size * 0.32, ph: 0.8 }, c);
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
      var R = size * 0.32, cx = size / 2, cy = size / 2, i;
      /* cracks: fixed paths out from the middle, drawn longer as it strains */
      var cracks = [];
      for (i = 0; i < 7; i++) {
        var a0 = i / 7 * 6.2832 + 0.3, pts = [[0, 0]], x = 0, y = 0;
        for (var sgi = 1; sgi <= 4; sgi++) {
          var aa = a0 + Math.sin(i * 3.1 + sgi * 1.7) * 0.45, step = R * 0.27;
          x += Math.cos(aa) * step; y += Math.sin(aa) * step;
          pts.push([x, y]);
        }
        cracks.push(pts);
      }
      var sh = [];
      for (i = 0; i < 14; i++) {
        var sa = i / 14 * 6.2832 + 0.4;
        sh.push({ a: sa, sp: 0.7 + ((i * 7) % 5) * 0.22,
                  rot: (i % 2 ? 1 : -1) * (0.08 + (i % 3) * 0.05),
                  w: R * (0.24 + ((i * 5) % 4) * 0.08) });
      }
      var T = 0, DUR = 150, BREAK = 0.6, broke = false, raf = null;
      function frame() {
        T++;
        var t = T / DUR;
        c.setTransform(k, 0, 0, k, 0, 0);
        c.clearRect(0, 0, size, size);

        if (t < BREAK) {                              /* it strains */
          var q = t / BREAK, amp = q * q * 10;
          var jx = (Math.random() - 0.5) * amp, jy = (Math.random() - 0.5) * amp;
          /* light building inside, pulsing faster as it goes */
          var pulse = 0.5 + 0.5 * Math.sin(T * (0.15 + q * 0.5));
          var gl = c.createRadialGradient(cx, cy, 1, cx, cy, R * (1.2 + q));
          gl.addColorStop(0, 'rgba(' + tone[2] + ',' + (0.25 + 0.45 * q * pulse).toFixed(3) + ')');
          gl.addColorStop(1, 'rgba(' + tone[2] + ',0)');
          c.fillStyle = gl;
          c.beginPath(); c.arc(cx, cy, R * (1.2 + q), 0, 6.2832); c.fill();
          c.save(); c.translate(cx + jx, cy + jy);
          drawFind(0, 0, { r: R, ph: 0.8 }, c);
          /* the cracks of light, running further each frame */
          c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.8;
          c.shadowColor = 'rgba(' + tone[2] + ',1)'; c.shadowBlur = 8;
          for (i = 0; i < cracks.length; i++) {
            var reach = Math.max(0, Math.min(4, q * 6 - i * 0.35));
            if (reach <= 0) continue;
            var pts2 = cracks[i];
            c.beginPath(); c.moveTo(pts2[0][0], pts2[0][1]);
            for (var pi = 1; pi <= Math.ceil(reach); pi++) {
              var f = Math.min(1, reach - (pi - 1));
              c.lineTo(pts2[pi - 1][0] + (pts2[pi][0] - pts2[pi - 1][0]) * f,
                       pts2[pi - 1][1] + (pts2[pi][1] - pts2[pi - 1][1]) * f);
            }
            c.stroke();
          }
          c.restore();
        } else {                                      /* it gives */
          if (!broke) { broke = true; if (onBreak) onBreak(); }
          var q2 = (t - BREAK) / (1 - BREAK);
          /* the flash */
          if (q2 < 0.18) {
            c.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - q2 / 0.18)).toFixed(3) + ')';
            c.fillRect(0, 0, size, size);
          }
          /* rays turning behind it */
          c.save(); c.translate(cx, cy); c.rotate(T * 0.02);
          var ra = Math.max(0, 0.55 * (1 - q2 * 0.6));
          for (i = 0; i < 12; i++) {
            c.rotate(6.2832 / 12);
            c.fillStyle = 'rgba(' + tone[2] + ',' + (ra * (i % 2 ? 0.55 : 1)).toFixed(3) + ')';
            c.beginPath(); c.moveTo(0, 0); c.lineTo(-R * 0.22, -size); c.lineTo(R * 0.22, -size); c.closePath(); c.fill();
          }
          c.restore();
          var burst = Math.min(1, q2 * 3.2);
          var bg = c.createRadialGradient(cx, cy, 1, cx, cy, R * (0.8 + burst * 2.4));
          bg.addColorStop(0, 'rgba(255,255,255,' + (0.85 * (1 - q2)).toFixed(3) + ')');
          bg.addColorStop(0.45, 'rgba(' + tone[2] + ',' + (0.5 * (1 - q2)).toFixed(3) + ')');
          bg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = bg;
          c.beginPath(); c.arc(cx, cy, R * (0.8 + burst * 2.4), 0, 6.2832); c.fill();

          for (i = 0; i < sh.length; i++) {           /* the shell, leaving */
            var p = sh[i];
            var fly = q2 * q2 * 1.5 + q2 * 0.6;
            var px = cx + Math.cos(p.a) * R * (0.7 + fly * 2.8);
            var py = cy + Math.sin(p.a) * R * (0.7 + fly * 2.8) + fly * fly * 26;
            c.save();
            c.translate(px, py);
            c.rotate(p.rot * T * 0.5);
            c.globalAlpha = Math.max(0, 1 - q2 * 1.25);
            c.fillStyle = '#dff2ff';
            c.beginPath();
            c.moveTo(-p.w, p.w * 0.5); c.lineTo(0, -p.w);
            c.lineTo(p.w, p.w * 0.4); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(120,180,220,.8)'; c.lineWidth = 1.2; c.stroke();
            c.restore();
          }
          c.globalAlpha = 1;

          /* and what was inside, settling in with a bounce */
          var pop = Math.min(1, q2 * 2.4);
          var ease = 1 + 0.25 * Math.sin(pop * Math.PI) * (1 - pop) - Math.pow(1 - pop, 3);
          var pr = R * (0.2 + 0.72 * Math.max(0, ease));
          c.save();
          c.translate(cx, cy);
          c.rotate(Math.sin(T * 0.07) * 0.18);
          var pg = c.createRadialGradient(-pr * 0.3, -pr * 0.35, 1, 0, 0, pr);
          pg.addColorStop(0, tone[0]);
          pg.addColorStop(1, tone[1]);
          c.fillStyle = pg;
          c.beginPath();
          c.ellipse(0, 0, pr, pr * 0.86, 0, 0, 6.2832);
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.4; c.stroke();
          c.fillStyle = 'rgba(255,255,255,.6)';
          c.beginPath();
          c.ellipse(-pr * 0.32, -pr * 0.36, pr * 0.26, pr * 0.16, -0.5, 0, 6.2832);
          c.fill();
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
    /* paint a creature into any context, for tests and portraits */
    _paint: function (c, skinId, opts) { paintCreature(c, skinById(skinId), opts); },
    _screen: function (x, d) { return { x: scrX(x), y: scrY(d) }; },
    _chuteAt: chuteAt,
    /* The spine's half-width, so a test measures the two ways past a fork
       off the same curve the game collides against. */
    _nunHalf: nunHalf,
    _turnRate: function () { return W ? turnRate() : TURN; },
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
