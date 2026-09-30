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
  /* How far a snow rush carries. 250 metres at 8 world units to the metre:
     long enough to feel like a run of its own, short enough that it is not
     the way the game is played. */
  var RUSH_DIST = 250 * 8;
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
  var hooks = { hud: null, over: null };
  var drawK = 1;

  /* The canvas draws its own words. i18n.js may not be there — the engine
     is loaded on its own by the tests — so fall back to the English. */
  function tr(key, fallback) {
    return (typeof t === 'function') ? t(key, null, fallback) : fallback;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
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
      rushTo: -1e9, smashed: 0,
      px: 0, vx: 0, dir: 1, tilt: 0,
      objects: [], rows: [], flakes: [], puffs: [], streaks: [],
      lastGap: 0, nextRowD: 320, lastStep: ROW_GAP0,
      airTo: -1, airSpan: AIR_DIST, clearUntil: 520, crevs: 0, jumps: 0,
      roofTo: -1e9,
      course: null, finishD: -1, fishTotal: 0, tunnelTo: -1e9,
      biome: 0, biomeT: 0, shake: 0,
      state: 'run', endT: 0, best: 0, crashAt: null, tapFlash: 0,
      lives: 0, revives: 0, finds: 0
    };
    W = w;
    if (pendingCourse) {
      w.course = { id: pendingCourse.id, step: pendingCourse.step, i: 0,
                   rows: parseCourse(pendingCourse, CHUTE) };
      w.biome = pendingCourse.biome;
      w.clearUntil = 0;
    }
    w.px = chuteAt(0);
    if (perk().startShield) w.shield = 1;
    var i;
    var nStreak = Math.round(46 * Math.max(1, LOOK / 620));
    for (i = 0; i < nStreak; i++)
      w.streaks.push({ x: rnd(-CHUTE, CHUTE), d: rnd(0, LOOK), len: rnd(40, 130), a: rnd(0.05, 0.22) });
    /* The pool is sized for the thickest weather on the hill; a clear
       stretch simply draws less of it (air.n). */
    var nFlake = Math.round(120 * Math.max(1, (VIEW_W * VIEW_H) / (960 * 540)));
    for (i = 0; i < Math.min(nFlake, 300); i++)
      w.flakes.push({ x: rnd(-VIEW_W, VIEW_W), y: rnd(0, VIEW_H), v: rnd(0.4, 1.5),
                      r: rnd(1, 2.6), ph: rnd(0, 6.2832), sw: rnd(0.6, 1.5) });
    while (w.nextRowD < LOOK) spawnRow();
    return w;
  }

  function hardness() { return clamp(W.dist / HARD_OVER, 0, 1); }

  /* How far sideways the penguin can actually get while covering `step` of
     hill — simulated honestly from the worst case: already drifting the wrong
     way at full tilt, and tapping only now. Ice biomes turn lazily, so the
     current grip is part of the answer. The spawner is then allowed to ask
     for a fraction of that, rising with difficulty: at the top end the turn
     has to be near perfect, but it is never impossible. */
  function speedAt(d) { return Math.min(SPEED_MAX, SPEED0 + d * SPEED_RAMP); }

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
  function reachBetweenRows() { return W ? reachOver(W.lastStep, hardness(), W.nextRowD) : 0; }

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

  function rockPts() {
    var p = [];
    for (var k = 0; k < 9; k++) p.push(0.70 + Math.random() * 0.44);
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
                  reach: reachOver(prevStep, hardness(), d), step: prevStep });
    while (W.rows.length && W.rows[0].d < W.dist - BEHIND - 80) W.rows.shift();

    function place(rel, dd) { return chuteAt(dd) + rel; }

    if (cr.crevasse) {
      W.crevs++;
      W.objects.push({ t: 'ramp', x: place(cr.gap, d - RAMP_LEAD), d: d - RAMP_LEAD,
                       w: cr.gapW, used: false });
      W.objects.push({ t: 'crevasse', x: place(0, d), d: d, span: CREV_SPAN, passed: false });
      return;
    }
    if (cr.gate) {
      var cgw = cr.gapW * GATE_W;
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
      W.objects.push({ t: 'gold', x: place(clamp(cr.gap + 120, -CHUTE + 24, CHUTE - 24), d + 20),
                       d: d + 20, r: 19, got: false, ph: 1.4 });
    if (cr.bubble)
      W.objects.push({ t: 'bubble', x: place(cr.gap, d + 90), d: d + 90, r: 24,
                       got: false, ph: 2.2 });
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
    var hard = hardness();
    var gapW = lerp(215, 84, hard);
    var prevStep = W.lastStep;
    var reach = reachOver(prevStep, hard, d);

    var step = lerp(ROW_GAP0, ROW_GAP1, hard);
    if (Math.random() < lerp(0, 0.3, hard)) step *= 0.62;    // rows doubling up
    W.lastStep = step;
    W.nextRowD += step;
    var lo = Math.max(-CHUTE + gapW / 2, W.lastGap - reach);
    var hi = Math.min(CHUTE - gapW / 2, W.lastGap + reach);
    if (lo > hi) lo = hi = clamp(W.lastGap, -CHUTE + gapW / 2, CHUTE - gapW / 2);
    var gap = rnd(lo, hi);
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
                       w: gapW, used: false });
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
    if (Math.random() < 0.15 && W.dist > 900) {
      var gw = gapW * GATE_W;
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
    var shoal = perk().shoal || 1;
    var longer = 1 + (shoal - 1) * 0.45;
    if (Math.random() < Math.min(0.85, 0.3 * shoal)) {
      var n = 2 + ((Math.random() * 3 * longer) | 0);
      /* The shoal weaves across the lane instead of sitting on the racing
         line. On the line it was free score that asked nothing of you — and
         it made the reach perk worthless, because you already passed within
         a few units of every fish. The sweep is kept inside the opening so
         chasing one never walks you into a boulder. */
      var sweep = Math.min(58, gapW / 2 + 8);
      var phase = rnd(0, 6.28);
      for (var i = 0; i < n; i++) {
        var fd = d + i * 46 - 44;
        W.objects.push({ t: 'fish',
                         x: place(gap + Math.sin(phase + i * 0.85) * sweep, fd), d: fd,
                         r: 15, got: false, ph: rnd(0, 6.28) });
      }
    }
    if (Math.random() < Math.min(0.5, 0.13 * (perk().goldRate || 1)) && W.dist > 1200) {
      var gd = d + 20;
      W.objects.push({ t: 'gold',
                       x: place(clamp(gap + (Math.random() < 0.5 ? -1 : 1) * rnd(90, 150),
                                      -CHUTE + 24, CHUTE - 24), gd),
                       d: gd, r: 19, got: false, ph: rnd(0, 6.28) });
    }
    if (Math.random() < 0.055 && W.dist > 1800 && !W.shield) {
      var bd = d + 90;
      W.objects.push({ t: 'bubble', x: place(gap + rnd(-16, 16), bd), d: bd, r: 24,
                       got: false, ph: rnd(0, 6.28) });
    }
    /* A drift of loose powder packed into a ball. Take it and he gathers
       it as he goes, and for a while nothing on the hill can stop him. */
    if (Math.random() < 0.013 && W.dist > 2000 && W.dist > W.rushTo + 2600) {
      var rd = d + 70;
      W.objects.push({ t: 'rush',
                       x: place(clamp(gap + (Math.random() < 0.5 ? -1 : 1) * rnd(50, 120),
                                      -CHUTE + 30, CHUTE - 30), rd),
                       d: rd, r: 25, got: false, ph: rnd(0, 6.28) });
    }

    /* A snow bridge over the run: drifted snow that has arched across the
       chute and frozen there. You pass underneath it. It is not a hazard —
       it darkens the stretch it covers, so the line is harder to read
       without ever being hidden. */
    if (Math.random() < 0.035 && W.dist > 2400 && d > W.tunnelTo + 900) {
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
    if (Math.random() < 0.012 && W.dist > 1200) {
      var nd = d + 60;
      W.objects.push({ t: 'find',
                       x: place(clamp(gap + (Math.random() < 0.5 ? -1 : 1) * rnd(70, 140),
                                      -CHUTE + 30, CHUTE - 30), nd),
                       d: nd, r: 23, got: false, ph: rnd(0, 6.28) });
    }
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
      var side = Math.random() < 0.5 ? -1 : 1;
      var dd = d + rnd(-95, 95);
      W.objects.push({
        t: 'deco', kind: Math.random() < 0.62 ? 'tree' : 'rock',
        x: chuteAt(dd) + side * (CHUTE + 80 + Math.random() * room),
        d: dd, r: rnd(19, 37), rot: rnd(0, 6.28), pts: rockPts()
      });
    }
  }

  /* world position -> screen. One to one: no perspective anywhere. */
  function scrX(worldX) { return VIEW_W / 2 + (worldX - chuteAt(W.dist)); }
  function scrY(d) { return PLAYER_Y - (d - W.dist); }

  /* --------------------------- input -------------------------- */
  function tap() {
    if (!W || W.state !== 'run') return;
    W.dir = -W.dir;
    W.tapFlash = 8;
    Sfx.turn();
    for (var i = 0; i < 4; i++)
      W.puffs.push({ x: W.px - W.dir * 8, d: W.dist - 6, life: 18, max: 18, s: rnd(5, 11) });
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
      if (W.crashAt) W.crashAt.spin += 0.22;
      updPuffs(); updFlakes();
      if (W.endT === 46 && hooks.over)
        hooks.over({ score: Math.floor(W.score), dist: Math.floor(W.dist / 8),
                     fish: W.fish, gold: W.gold, gates: W.gates, saved: W.saved,
                     coins: W.coins, jumps: W.jumps,
                     finished: W.state === 'finish',
                     course: W.course ? W.course.id : null,
                     fishTotal: W.fishTotal,
                     finds: W.finds, revives: W.revives,
                     /* Only a crash can be walked back, and only while a
                        life is in hand. Crossing the line is final. */
                     canRevive: W.state === 'crash' && W.lives > 0 });
      return;
    }

    var B = biome();
    W.speed = Math.min(SPEED_MAX, SPEED0 + W.dist * SPEED_RAMP);
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
      if (o.d < W.dist - BEHIND) { W.objects.splice(i, 1); continue; }
      var dy = o.d - W.dist, dx = o.x - W.px;

      /* Reach only ever widens what he can PICK UP. The rock test below is
         untouched, so no perk can move the line between a clean pass and a
         crash — only how far he can lean for a fish. */
      var grab = (o.r + PR) * (perk().reach || 1);
      if ((o.t === 'fish' || o.t === 'gold' || o.t === 'bubble' || o.t === 'find' ||
           o.t === 'rush') && !o.got &&
          Math.abs(dy) < grab && Math.abs(dx) < grab) {
        o.got = true;
        var tone = '#bfe4ff';
        if (o.t === 'fish')      {
          W.fish++; W.score += 25;
          W.coins += (W.fish <= FIRST_CATCH) ? 2 : 1;      // early catch pays double
          Sfx.berry();
        }
        else if (o.t === 'gold') { W.gold++; W.score += 150; Sfx.gold(); tone = '#ffd83d'; W.tapFlash = 12; }
        else if (o.t === 'find') { W.finds++; W.score += 60; Sfx.gold(); tone = '#fff0b0'; W.tapFlash = 16; }
        else if (o.t === 'rush') {
          W.rushTo = W.dist + RUSH_DIST;
          Sfx.bubble(); tone = '#ffffff'; W.tapFlash = 18; W.shake = Math.max(W.shake, 10);
        }
        else                     { W.shield = 1; Sfx.bubble(); tone = '#9fe8ff'; W.tapFlash = 12; }
        for (var b = 0; b < (o.t === 'fish' ? 7 : 15); b++)
          W.puffs.push({ x: o.x, d: o.d, life: 22, max: 22, s: rnd(4, 11), tint: tone });
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
            W.puffs.push({ x: W.px + rnd(-14, 14), d: W.dist - rnd(0, 16),
                           life: 24, max: 24, s: rnd(5, 12) });
        }
      }
      if (o.t === 'crevasse' && !o.passed && o.d <= W.dist) {
        o.passed = true;
        /* Nothing on the hill may stop a rush, and a hole that killed him
           while the screen says he is unstoppable would be the nastiest
           kind of surprise. The momentum carries him over. */
        if (rushing() && !airborne()) {
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
              W.puffs.push({ x: W.px + rnd(-18, 18), d: W.dist + rnd(-10, 10),
                             life: 28, max: 28, s: rnd(5, 13), tint: '#9fe8ff' });
          } else { crash(o); continue; }
        }
      }
      if (o.t === 'gate' && !o.passed && o.d < W.dist) {
        o.passed = true;
        if (Math.abs(dx) < o.w / 2) {
          var gb = perk().gateBonus || 1;
          o.scored = true;                   // green means you took it,
          W.gates++;                         // not merely that it is behind you
          W.score += Math.round(50 * gb);
          W.coins += Math.round(2 * gb);       // gates pay the shop as well
          Sfx.gate(); W.tapFlash = 10;
        }
      }
      /* plain circle overlap, in the very pixels being drawn */
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
          W.puffs.push({ x: o.x + rnd(-o.r, o.r), d: o.d + rnd(-o.r, o.r),
                         life: 26, max: 26, s: rnd(5, 13) });
        W.objects.splice(i, 1);
        continue;
      }
      if (solid(o) && W.invuln <= 0 && !rushing() && !airborne() &&
          dx * dx + dy * dy < (o.r * 0.82 + PR * 0.78) * (o.r * 0.82 + PR * 0.78)) {
        if (W.shield > 0) {
          W.shield = 0; W.saved++; W.invuln = 80; W.shake = 16; W.tapFlash = 12;
          Sfx.pop();
          for (var q = 0; q < 20; q++)
            W.puffs.push({ x: W.px + rnd(-16, 16), d: W.dist + rnd(-12, 12),
                           life: 26, max: 26, s: rnd(5, 13), tint: '#9fe8ff' });
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
      Sfx.land();
      W.shake = Math.max(W.shake, 9);
      for (var lp = 0; lp < 16; lp++)
        W.puffs.push({ x: W.px + rnd(-20, 20), d: W.dist - rnd(0, 18),
                       life: 26, max: 26, s: rnd(5, 14) });
    }
    if (airborne()) W.wasAir = true;

    if (W.course && W.finishD > 0 && W.dist >= W.finishD && W.state === 'run') {
      W.state = 'finish'; W.endT = 0;
      Sfx.zone();
      for (var fp = 0; fp < 22; fp++)
        W.puffs.push({ x: W.px + rnd(-26, 26), d: W.dist + rnd(-16, 16),
                       life: 34, max: 34, s: rnd(5, 14), tint: '#ffe08a' });
    }

    if (W.invuln > 0) W.invuln--;
    if (!W.course) W.biomeT += W.speed;
    /* Carry the overshoot over instead of dropping it: zeroing here makes
       every zone a fraction longer than the last, and the drift eventually
       puts gripAt() in the wrong biome when it places a row near a border.
       A marked run never changes zone at all. */
    if (!W.course && W.biomeT >= zoneLen()) {
      W.biomeT -= zoneLen(); W.biome++; Sfx.zone(); W.tapFlash = 14;
    }

    updPuffs(); updFlakes();
    hud();
  }

  function solid(o) { return o.t === 'rock' || o.t === 'tree'; }
  function airborne() { return W.airTo > W.dist; }
  function rushing() { return W.rushTo > W.dist; }

  /* How fast the steering actually answers right now, perk included. Anything
     predicting where the creature will be has to use this and not the raw
     constant, or it will steer for a machine that is not the one running. */
  function turnRate() { return TURN * biome().grip * (perk().grip || 1); }

  function bank() { W.shake = Math.max(W.shake, 6); Sfx.bank(); }

  function crash(o) {
    W.state = 'crash'; W.endT = 0; W.shake = 24;
    W.crashAt = { x: o.x, d: o.d, r: o.r, spin: 0 };
    Sfx.crash();
    for (var i = 0; i < 20; i++)
      W.puffs.push({ x: W.px + rnd(-18, 18), d: W.dist + rnd(-14, 14),
                     life: 34, max: 34, s: rnd(6, 15) });
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
    W.invuln = 150;
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
      W.puffs.push({ x: W.px + rnd(-26, 26), d: W.dist + rnd(-20, 20),
                     life: 30, max: 30, s: rnd(6, 14), tint: '#bfe9ff' });
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
      if (f.y > VIEW_H + 6) { f.y = -6; f.x = Math.random() * VIEW_W; }
      else if (f.y < -8) { f.y = VIEW_H + 6; f.x = Math.random() * VIEW_W; }
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
    var shx = (Math.random() - 0.5) * W.shake, shy = (Math.random() - 0.5) * W.shake;
    ctx.save();
    ctx.translate(shx, shy);
    drawChute();
    drawGround();
    drawEmberGlow();
    drawObjects();
    drawAurora();
    drawHaze();
    drawFog();
    drawPenguin();
    drawRoofs();          /* over the creature: he is UNDER the bridge */
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
    ctx.strokeStyle = B.streak || 'rgba(255,255,255,.5)';   // streaks of polished ice
    for (i = 0; i < W.streaks.length; i++) {
      var s = W.streaks[i];
      var sy = scrY(s.d);
      if (sy > VIEW_H + 160) { s.d += LOOK + 200; s.x = rnd(-CHUTE, CHUTE); continue; }
      if (sy < -200) continue;
      ctx.globalAlpha = s.a * 1.9;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(scrX(chuteAt(s.d) + s.x), sy);
      ctx.lineTo(scrX(chuteAt(s.d) + s.x) + 6, sy + s.len);
      ctx.stroke();
    }
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
      else if (o.t === 'gate')   drawGate(x, y, o);
      else if (o.t === 'fish')   { if (!o.got) drawFish(x, y, o, false); }
      else if (o.t === 'gold')   { if (!o.got) drawFish(x, y, o, true); }
      else if (o.t === 'bubble') { if (!o.got) drawBubble(x, y, o); }
      else if (o.t === 'find')   { if (!o.got) drawFind(x, y, o); }
      else if (o.t === 'rush')   { if (!o.got) drawRush(x, y, o); }
    }
    for (i = 0; i < W.puffs.length; i++) {
      var p = W.puffs[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.75;
      ctx.fillStyle = p.tint || B.snowA;     // pure white glares on the night run
      ctx.beginPath(); ctx.arc(scrX(p.x), scrY(p.d), p.s, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* A ball of packed powder, still spinning where the wind rolled it. */
  function drawRush(x, y, o) {
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
  function drawRoofs() {
    var B = pal();
    for (var i = 0; i < W.objects.length; i++) {
      var o = W.objects[i];
      if (o.t !== 'tunnel') continue;
      var y = scrY(o.d);
      if (y < -700 || y > VIEW_H + 300) continue;
      drawTunnel(o, B);
    }
  }

  /* A snow bridge, seen from above. It used to be a translucent wash so the
     boulders under it stayed visible — which read as a shadow rather than a
     roof. Now it is solid snow and nothing stands under it, and the animal
     shows through as the blur of light he makes from below. */
  function drawTunnel(o, B) {
    var yNear = scrY(o.d), yFar = scrY(o.d + o.span);
    var w = CHUTE + 110, cx = scrX(o.x);
    var lip = 78;                                   // how deep the mouths arch
    ctx.save();

    /* the span itself: packed snow, lit along the near mouth */
    ctx.beginPath();
    ctx.moveTo(cx - w, yFar);
    ctx.lineTo(cx + w, yFar);
    ctx.lineTo(cx + w, yNear);
    ctx.lineTo(cx - w, yNear);
    ctx.closePath();
    /* From directly above, the top of a snow bridge is just more snow —
       the same field the banks are made of. Shading it grey made it read as
       a sky, which is the one thing it cannot be in a top-down game. */
    ctx.fillStyle = B.snowA;
    ctx.fill();

    /* Only the part of the span that is actually on screen matters. A long
       bridge reaches far above the top of the frame, and anchoring anything
       to the full span put the whole visible band inside the first few per
       cent of a gradient — which is why the roof came out uniformly grey
       instead of white with shading at its mouths. */
    var vTop = Math.max(yFar, -30), vBot = Math.min(yNear, VIEW_H + 30);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w, vTop, w * 2, Math.max(0, vBot - vTop));
    ctx.clip();

    /* Wind-carved drift, pinned to world distance so it scrolls with the
       bridge rather than crawling on the glass. */
    ctx.strokeStyle = B.bankShade; ctx.lineCap = 'round';
    var step0 = 64;
    var dBase = Math.floor((W.dist + (PLAYER_Y - vBot)) / step0) * step0;
    for (var sg = 0; sg < 40; sg++) {
      var sd = dBase + sg * step0;
      var sy = scrY(sd);
      if (sy < vTop - 40 || sy > vBot + 40) continue;
      var sx = cx - w + ((sg * 149) % Math.round(w * 2));
      ctx.globalAlpha = 0.09 + ((sg * 7) % 4) * 0.028;
      ctx.lineWidth = 4 + ((sg * 11) % 4);
      ctx.beginPath();
      ctx.moveTo(sx, sy - 24); ctx.lineTo(sx + 7, sy + 24);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* Shadow hugging each mouth, at a fixed depth in pixels. */
    var deep = 100;
    var gN = ctx.createLinearGradient(0, yNear, 0, yNear - deep);
    gN.addColorStop(0, 'rgba(46,82,120,.38)');
    gN.addColorStop(1, 'rgba(46,82,120,0)');
    ctx.fillStyle = gN;
    ctx.fillRect(cx - w, yNear - deep, w * 2, deep);
    var gF = ctx.createLinearGradient(0, yFar, 0, yFar + deep);
    gF.addColorStop(0, 'rgba(46,82,120,.38)');
    gF.addColorStop(1, 'rgba(46,82,120,0)');
    ctx.fillStyle = gF;
    ctx.fillRect(cx - w, yFar, w * 2, deep);
    ctx.restore();

    /* Him underneath: light scattering up through the snow, and the shape
       of him in it. Without this you lose your own line for two seconds,
       which is the one thing the run cannot ask of you. */
    var py = PLAYER_Y, pxx = scrX(W.px);
    if (py < yNear + 6 && py > yFar - 6) {
      /* A thin place in the drift right over him: the ice of the run shows
         through, so you can still read where your line is going. A fainter
         first attempt left you steering blind for two seconds, which the
         run has no business asking. */
      var hole = ctx.createRadialGradient(pxx, py, 4, pxx, py, 96);
      hole.addColorStop(0, 'rgba(150,206,240,.92)');
      hole.addColorStop(0.35, 'rgba(168,216,244,.72)');
      hole.addColorStop(0.72, 'rgba(198,230,248,.34)');
      hole.addColorStop(1, 'rgba(214,238,252,0)');
      ctx.fillStyle = hole;
      ctx.beginPath(); ctx.arc(pxx, py, 96, 0, 6.2832); ctx.fill();
      /* and him in it, as a shape rather than a smudge */
      ctx.fillStyle = 'rgba(42,74,108,.55)';
      ctx.beginPath(); ctx.ellipse(pxx, py + 2, 21, 25, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(pxx - 6, py - 8, 8, 6, -0.4, 0, 6.2832); ctx.fill();
    }

    /* the two mouths: a thick drift arching over the run */
    [o.d + o.span, o.d].forEach(function (md, side) {
      var my = scrY(md), k, lx, ly;
      ctx.beginPath();
      for (k = 0; k <= 26; k++) {
        var t = k / 26;
        lx = cx - w + w * 2 * t;
        ly = my + (side ? 1 : -1) *
             (Math.sin(t * Math.PI) * lip + Math.sin(t * 9.3 + o.ph) * 6);
        k ? ctx.lineTo(lx, ly) : ctx.moveTo(lx, ly);
      }
      ctx.lineWidth = 30; ctx.lineCap = 'round';
      ctx.strokeStyle = B.bankShade; ctx.stroke();
      ctx.lineWidth = 19;
      ctx.strokeStyle = B.snowA; ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = B.lip || 'rgba(255,255,255,.92)'; ctx.stroke();
    });

    /* icicles hanging from the near mouth, so you can tell which way it
       overhangs at a glance */
    ctx.fillStyle = 'rgba(232,248,255,.9)';
    for (var q = 0; q < 16; q++) {
      var t2 = (q + 0.5) / 16;
      var ix = cx - w + w * 2 * t2;
      var iy = yNear - Math.sin(t2 * Math.PI) * lip + 10;
      var ih = 9 + ((q * 17) % 15);
      ctx.beginPath();
      ctx.moveTo(ix - 4, iy); ctx.lineTo(ix + 4, iy); ctx.lineTo(ix, iy + ih);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* A ball of packed powder, still spinning where the wind rolled it. */
  function drawRush(x, y, o) {
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
    /* Straddle the line rather than sit past it: the apron starts while the
       player is still running and the lip falls exactly on the line, so the
       end is something you watch arrive instead of something that has
       already happened by the time you notice it. */
    var before = 260, after = 300, w = CHUTE + 80;
    var cx = scrX(o.x), top = y - after, bot = y + before;
    ctx.save();

    var g = ctx.createLinearGradient(0, bot, 0, top);
    g.addColorStop(0, 'rgba(126,206,246,0)');
    g.addColorStop(0.30, 'rgba(126,206,246,.30)');
    g.addColorStop(0.46, 'rgba(126,206,246,.55)');
    g.addColorStop(0.62, 'rgba(196,238,254,.80)');   // brightest at the line
    g.addColorStop(1, 'rgba(236,250,255,.55)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - w, top, w * 2, bot - top);

    /* Spray hanging over the apron, thickest just beyond the line. */
    for (var k = 0; k < 30; k++) {
      var px = cx + Math.sin(k * 2.399 * 1.7) * w * 0.94;
      var py = top + ((k * 53) % (after + before - 30));
      var near = 1 - Math.min(1, Math.abs(py - y) / 220);
      ctx.globalAlpha = (0.06 + 0.16 * near) * (0.6 + 0.4 * Math.sin(W.t * 0.04 + k));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(px, py, 26 + (k % 5) * 8, 10 + (k % 3) * 5, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* The lip itself, on the line: a ridge of clean ice across the run. */
    var i, lx, ly;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      for (i = 0; i <= 22; i++) {
        var t = i / 22;
        lx = cx - w + w * 2 * t;
        ly = y + Math.sin(t * 8.1) * 9 + Math.sin(t * 19) * 3;
        i ? ctx.lineTo(lx, ly) : ctx.moveTo(lx, ly);
      }
      ctx.lineWidth = [22, 11, 4][pass];
      ctx.strokeStyle = ['rgba(120,196,240,.45)',
                         'rgba(255,255,255,.95)',
                         'rgba(150,214,246,.9)'][pass];
      ctx.stroke();
    }
    ctx.restore();
  }

  /* A boulder from above: grey stone with a cap of snow sitting on its upper
     face, the join between them wavy rather than a clean arc. */
  function drawRock(x, y, o, B) {
    var r = o.r, k, a, rad;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(o.rot);

    ctx.fillStyle = B.shadow || 'rgba(86,132,176,.26)';
    ctx.beginPath(); ctx.ellipse(5, 8, r * 1.02, r * 0.9, 0, 0, 6.2832); ctx.fill();

    function outline(scale) {
      var n = o.pts.length, pt = [];
      for (k = 0; k < n; k++) {
        a = k / n * 6.2832;
        rad = r * scale * o.pts[k];
        pt.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.94]);
      }
      ctx.beginPath();                              // round the corners off
      ctx.moveTo((pt[n - 1][0] + pt[0][0]) / 2, (pt[n - 1][1] + pt[0][1]) / 2);
      for (k = 0; k < n; k++) {
        var nx = pt[(k + 1) % n];
        ctx.quadraticCurveTo(pt[k][0], pt[k][1], (pt[k][0] + nx[0]) / 2, (pt[k][1] + nx[1]) / 2);
      }
      ctx.closePath();
    }

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
  function drawTree(x, y, o, B) {
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
    var tiers = [[1.00, 0.00, 0.76, B.treeDark],
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
  function drawGate(x, y, o) {
    var hw = o.w / 2, hh = 26;
    ctx.save();
    ctx.translate(x, y);

    var lit = o.scored, gone = o.passed && !o.scored;

    /* polished ice, sunk very slightly into the run */
    var g = ctx.createLinearGradient(0, -hh, 0, hh);
    if (lit) { g.addColorStop(0, 'rgba(150,246,214,.85)'); g.addColorStop(1, 'rgba(60,198,160,.6)'); }
    else if (gone) { g.addColorStop(0, 'rgba(186,200,212,.4)'); g.addColorStop(1, 'rgba(150,168,184,.3)'); }
    else { g.addColorStop(0, 'rgba(86,196,238,.72)'); g.addColorStop(1, 'rgba(36,138,196,.62)'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 6.2832); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 6.2832); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.4)';        // scour lines, down the fall line
    ctx.lineWidth = 1.6;
    for (var i = -3; i <= 3; i++) {
      var sx = i * hw * 0.26;
      ctx.beginPath();
      ctx.moveTo(sx - 3, -hh);
      ctx.quadraticCurveTo(sx, 0, sx + 3, hh);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.3)';          // the glassy sheen
    ctx.beginPath(); ctx.ellipse(-hw * 0.3, -hh * 0.4, hw * 0.44, hh * 0.3, -0.2, 0, 6.2832); ctx.fill();
    /* A band of light travelling across it, the way polished ice catches
       the sun as you come over it. */
    var sh = ((W.t * 0.018 + (o.d % 97) / 97) % 1) * 2.6 - 0.8;
    var sg = ctx.createLinearGradient((sh - 0.3) * hw, 0, (sh + 0.3) * hw, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,.4)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
    ctx.restore();

    ctx.strokeStyle = lit ? 'rgba(120,240,196,.95)'
                    : (gone ? 'rgba(170,186,200,.5)' : 'rgba(190,238,255,.9)');
    ctx.lineWidth = lit ? 3.4 : 2.4;
    ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 6.2832); ctx.stroke();

    if (lit) {                                       // a scatter of frost thrown up
      ctx.fillStyle = 'rgba(210,255,238,.85)';
      for (i = 0; i < 6; i++) {
        var a2 = i / 6 * 6.2832 + 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a2) * hw * 1.1, Math.sin(a2) * hh * 1.25, 2.2, 0, 6.2832);
        ctx.fill();
      }
    }
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
  function drawGate(x, y, o) {
    var hw = o.w / 2, hh = 26;
    ctx.save();
    ctx.translate(x, y);

    var lit = o.scored, gone = o.passed && !o.scored;

    /* polished ice, sunk very slightly into the run */
    var g = ctx.createLinearGradient(0, -hh, 0, hh);
    if (lit) { g.addColorStop(0, 'rgba(150,246,214,.85)'); g.addColorStop(1, 'rgba(60,198,160,.6)'); }
    else if (gone) { g.addColorStop(0, 'rgba(186,200,212,.4)'); g.addColorStop(1, 'rgba(150,168,184,.3)'); }
    else { g.addColorStop(0, 'rgba(86,196,238,.72)'); g.addColorStop(1, 'rgba(36,138,196,.62)'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 6.2832); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 6.2832); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.4)';        // scour lines, down the fall line
    ctx.lineWidth = 1.6;
    for (var i = -3; i <= 3; i++) {
      var sx = i * hw * 0.26;
      ctx.beginPath();
      ctx.moveTo(sx - 3, -hh);
      ctx.quadraticCurveTo(sx, 0, sx + 3, hh);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.3)';          // the glassy sheen
    ctx.beginPath(); ctx.ellipse(-hw * 0.3, -hh * 0.4, hw * 0.44, hh * 0.3, -0.2, 0, 6.2832); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = lit ? 'rgba(120,240,196,.95)'
                    : (gone ? 'rgba(170,186,200,.5)' : 'rgba(190,238,255,.9)');
    ctx.lineWidth = lit ? 3.4 : 2.4;
    ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 6.2832); ctx.stroke();

    if (lit) {                                       // a scatter of frost thrown up
      ctx.fillStyle = 'rgba(210,255,238,.85)';
      for (i = 0; i < 6; i++) {
        var a2 = i / 6 * 6.2832 + 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a2) * hw * 1.1, Math.sin(a2) * hh * 1.25, 2.2, 0, 6.2832);
        ctx.fill();
      }
    }
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

  function drawBubble(x, y, o) {
    var r = o.r + Math.sin(W.t * 0.08 + o.ph) * 2;
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.85)');
    g.addColorStop(0.55, 'rgba(160,230,255,.35)');
    g.addColorStop(1, 'rgba(110,200,245,.2)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(210,245,255,.9)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.26, r * 0.14, -0.5, 0, 6.2832); ctx.fill();
  }

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
  }

  /* ---- what separates an animal from a shape ------------------
     Three things, in order of how much they buy you: eyes, a coat that
     breaks the outline, and toes. A perfectly smooth vector edge is the
     single biggest tell that you are looking at a drawing, so the furred
     animals get their silhouette broken up and the sleek ones get a wet
     sheen instead. Everything here is deterministic — a creature must not
     shimmer from frame to frame. */

  function frnd(i, k) {                              // stable per-strand jitter
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
        w = len * (0.5 + frnd(i, seed + pass) * 0.7);
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
      var a = frnd(i, seed) * 6.2832;
      var d = 0.3 + frnd(i, seed + 3) * 0.62;
      var x = Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      /* Flowing back from the head rather than out from the middle: taking
         the centre as the origin made every stroke point at it and the
         whole coat read as a starburst. */
      var hx = 0, hy = cy - ry * 1.15;
      var ox = x - hx, oy = y - hy;
      var m = Math.sqrt(ox * ox + oy * oy) || 1;
      ox /= m; oy /= m;
      var L = 2.6 + frnd(i, seed + 7) * 3.4;
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
  function antler(cc, k) {
    var main = [[k * 6, -37], [k * 12, -46], [k * 21, -48], [k * 28, -43], [k * 32, -35]];
    beam(cc, main, 3.6, 2.2);
    beam(cc, [[k * 11, -45], [k * 9, -54], [k * 11, -61]], 2.6, 1.6);   // brow tine
    beam(cc, [[k * 20, -48], [k * 23, -58], [k * 28, -63]], 2.4, 1.5);  // second
    beam(cc, [[k * 28, -43], [k * 37, -46], [k * 42, -41]], 2.2, 1.4);  // and the top
  }

  function bodyReindeer(c, S, ang, wag, o) {
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
    bg.addColorStop(0, '#b78d66');
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
    bg.addColorStop(0, '#242c38');                   // barely lifted: she is black
    bg.addColorStop(0.4, '#10151c');
    bg.addColorStop(1, '#05080c');
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
  }

  var BODIES = { penguin: bodyPenguin, walrus: bodyWalrus, seal: bodySeal,
                 reindeer: bodyReindeer, orca: bodyOrca };

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
      var left = (W.rushTo - W.dist) / RUSH_DIST;        // 1 at pickup, 0 at the end
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
    var w = Math.max(152, u * 9.8), rowH = u * 2.1;
    var h = rowH * 2 + u * 1.5;

    /* one panel, three readouts, all left-aligned to the same edge */
    ctx.fillStyle = 'rgba(16,52,84,.34)';
    rr(ctx, padL, padT, w, h, u * 0.9); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = Math.max(1, u * 0.09);
    rr(ctx, padL, padT, w, h, u * 0.9); ctx.stroke();

    var x0 = padL + u * 0.85;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* score, the big one */
    ctx.font = '800 ' + Math.round(u * 1.7) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.fillStyle = '#ffd83d';
    ctx.fillText(String(Math.floor(W.score)), x0, padT + u * 2.0);
    ctx.font = '700 ' + Math.round(u * 0.62) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillText(tr('hud.score', 'SCORE'),
                 x0 + measureAt(String(Math.floor(W.score)), Math.round(u * 1.7)) + u * 0.45,
                 padT + u * 2.0);

    /* metres and the catch, side by side on the second line */
    var y2 = padT + rowH + u * 1.5;
    ctx.font = '800 ' + Math.round(u * 1.05) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.fillStyle = '#eaf7ff';
    ctx.fillText(String(Math.floor(W.dist / 8)) + ' ' + tr('hud.m', 'M'), x0, y2);

    /* The catch was only ever shown on the results screen, so during a run
       there was no way to know how the purse was doing. */
    var fx = x0 + w * 0.55;
    drawFish(fx + u * 0.5, y2 - u * 0.36, { r: u * 0.62, ph: W.t * 0.05 }, false);
    ctx.font = '800 ' + Math.round(u * 1.05) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.fillStyle = '#eaf7ff';
    ctx.fillText(String(W.fish + W.gold), fx + u * 1.5, y2);

    /* best, centred above everything and out of the way */
    if (W.best > 0) {
      ctx.textAlign = 'center';
      ctx.font = '800 ' + Math.round(u * 0.78) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
      var bt = tr('hud.best', 'BEST') + '  ' + W.best;
      var bw = ctx.measureText(bt).width + u * 1.6;
      ctx.fillStyle = 'rgba(16,52,84,.30)';
      rr(ctx, CSS_W / 2 - bw / 2, padT, bw, u * 1.6, u * 0.8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.fillText(bt, CSS_W / 2, padT + u * 1.15);
      ctx.textAlign = 'left';
    }

    /* lives in hand, under the panel */
    if (W.lives > 0) {
      ctx.textAlign = 'left';
      for (var li = 0; li < Math.min(3, W.lives); li++)
        drawHeart(padL + u * 0.9 + li * u * 1.5, padT + h + u * 1.1, u * 0.52);
      if (W.lives > 3) {
        ctx.font = '800 ' + Math.round(u * 0.8) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fillText('+' + (W.lives - 3), padL + u * 0.9 + 3 * u * 1.5, padT + h + u * 1.35);
      }
    }

    /* How much rush is left, as metres rather than a bar: the player is
       already reading metres, and a bar says nothing about the hill. */
    if (W.rushTo > W.dist) {
      var leftM = Math.ceil((W.rushTo - W.dist) / 8);
      ctx.textAlign = 'center';
      ctx.font = '800 ' + Math.round(u * 1.0) + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
      var rt = leftM + ' ' + tr('hud.m', 'M');
      var rw = ctx.measureText(rt).width + u * 2.2;
      var ry = padT + (W.best > 0 ? u * 2.2 : 0);
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      rr(ctx, CSS_W / 2 - rw / 2, ry, rw, u * 1.8, u * 0.9); ctx.fill();
      ctx.fillStyle = '#1d5f8e';
      ctx.fillText(rt, CSS_W / 2, ry + u * 1.3);
      ctx.textAlign = 'left';
    }

    if (W.shield > 0) {
      ctx.save();
      ctx.translate(CSS_W - u * 2.4, padT + u * 1.2);
      var g = ctx.createRadialGradient(-u * 0.22, -u * 0.26, 1, 0, 0, u * 0.85);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(140,220,255,.35)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, u * 0.85, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(210,245,255,.95)'; ctx.lineWidth = u * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, u * 0.85, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }

    if (W.tapFlash > 0 && W.biomeT < 120) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, W.tapFlash / 10);
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

  /* Measuring at a size other than the one currently set, without leaving
     the font changed behind us. */
  function measureAt(txt, px) {
    var keep = ctx.font;
    ctx.font = '800 ' + px + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    var wd = ctx.measureText(txt).width;
    ctx.font = keep;
    return wd;
  }

  function drawHeart(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.95);
    ctx.bezierCurveTo(-r * 1.5, -r * 0.2, -r * 0.6, -r * 1.25, 0, -r * 0.42);
    ctx.bezierCurveTo(r * 0.6, -r * 1.25, r * 1.5, -r * 0.2, 0, r * 0.95);
    ctx.closePath();
    ctx.fillStyle = '#ff5e74'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.stroke();
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
    if (!paused) {
      accT += dt;
      var n = 0;
      while (accT >= STEP_MS && n < 5) { step(); accT -= STEP_MS; n++; }
      if (accT > 400) accT = 0;
    } else accT = 0;
    render();
  }

  if (typeof document !== 'undefined' && document.getElementById('game')) setup();

  return {
    /* `lives` is how many spares the player is carrying into this run.
       It comes in from the save rather than being read here, so the engine
       stays free of storage. */
    start: function (best, cbs, skinId, courseId, lives) {
      if (!ctx) setup();
      if (typeof SKINS !== 'undefined') skin = skinById(skinId);
      pendingCourse = (courseId && typeof courseById === 'function')
                    ? courseById(courseId) : null;
      hooks.hud = cbs.hud; hooks.over = cbs.over;
      newRun();
      W.best = best || 0;
      W.lives = Math.max(0, lives | 0);
      paused = false; lastT = 0; accT = 0;
      hud();
      if (rafId == null && !suspended) rafId = requestAnimationFrame(loop);
    },
    stop: function () { W = null; if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } },
    tap: tap,
    undoTap: undoTap,
    revive: revive,
    livesLeft: function () { return W ? W.lives : 0; },
    pause:  function () { paused = true; },
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
