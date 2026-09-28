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
  var CREV_SPAN = 150;                  // how wide the hole in the ice is
  var RAMP_LEAD = 52;                   // how far the ramp sits before it
  var AIR_DIST  = 340;                  // hill covered while airborne
  var HARD_OVER = 30000;                // world units to reach full difficulty
  var PR = 24;                 // the penguin's radius

  var canvas, ctx, stage, W = null;
  var skin = (typeof SKINS !== 'undefined') ? SKINS[0] : null;
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
  var TINTS = ['snowA', 'iceTop', 'iceBot', 'bankEdge', 'bankShade',
               'far', 'edge', 'tree', 'treeDark', 'trunk', 'rock', 'rockDark'];

  function buildPal() {
    var cur = biome();
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
    return out;
  }
  function pal() { return PAL || biome(); }

  /* --------------------- world construction ------------------- */
  function newRun() {
    var w = {
      t: 0, dist: 0, speed: SPEED0, score: 0, fish: 0, gold: 0, gates: 0, coins: 0,
      shield: 0, invuln: 0, saved: 0,
      px: 0, vx: 0, dir: 1, tilt: 0,
      objects: [], rows: [], flakes: [], puffs: [], streaks: [],
      lastGap: 0, nextRowD: 320, lastStep: ROW_GAP0,
      airTo: -1, airSpan: AIR_DIST, clearUntil: 520, crevs: 0, jumps: 0,
      biome: 0, biomeT: 0, shake: 0,
      state: 'run', endT: 0, best: 0, crashAt: null, tapFlash: 0
    };
    W = w;
    w.px = chuteAt(0);
    if (perk().startShield) w.shield = 1;
    var i;
    var nStreak = Math.round(46 * Math.max(1, LOOK / 620));
    for (i = 0; i < nStreak; i++)
      w.streaks.push({ x: rnd(-CHUTE, CHUTE), d: rnd(0, LOOK), len: rnd(40, 130), a: rnd(0.05, 0.22) });
    var nFlake = Math.round(40 * Math.max(1, (VIEW_W * VIEW_H) / (960 * 540)));
    for (i = 0; i < Math.min(nFlake, 160); i++)
      w.flakes.push({ x: rnd(-VIEW_W, VIEW_W), y: rnd(0, VIEW_H), v: rnd(0.4, 1.5), r: rnd(1, 2.6) });
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

  function rockPts() {
    var p = [];
    for (var k = 0; k < 9; k++) p.push(0.70 + Math.random() * 0.44);
    return p;
  }

  function spawnRow() {
    var d = W.nextRowD;
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

    if (Math.random() < 0.15 && W.dist > 900)
      W.objects.push({ t: 'gate', x: place(gap, d), d: d, w: gapW, passed: false });

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
                     coins: W.coins, jumps: W.jumps });
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
      if ((o.t === 'fish' || o.t === 'gold' || o.t === 'bubble') && !o.got &&
          Math.abs(dy) < grab && Math.abs(dx) < grab) {
        o.got = true;
        var tone = '#bfe4ff';
        if (o.t === 'fish')      {
          W.fish++; W.score += 25;
          W.coins += (W.fish <= FIRST_CATCH) ? 2 : 1;      // early catch pays double
          Sfx.berry();
        }
        else if (o.t === 'gold') { W.gold++; W.score += 150; Sfx.gold(); tone = '#ffd83d'; W.tapFlash = 12; }
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
        if (!airborne()) { crash(o); continue; }     // straight down the hole
      }
      if (o.t === 'gate' && !o.passed && o.d < W.dist) {
        o.passed = true;
        if (Math.abs(dx) < o.w / 2) {
          var gb = perk().gateBonus || 1;
          W.gates++;
          W.score += Math.round(50 * gb);
          W.coins += Math.round(2 * gb);       // gates pay the shop as well
          Sfx.gate(); W.tapFlash = 10;
        }
      }
      /* plain circle overlap, in the very pixels being drawn */
      if (solid(o) && W.invuln <= 0 && !airborne() &&
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

    if (W.invuln > 0) W.invuln--;
    W.biomeT += W.speed;
    /* Carry the overshoot over instead of dropping it: zeroing here makes
       every zone a fraction longer than the last, and the drift eventually
       puts gripAt() in the wrong biome when it places a row near a border. */
    if (W.biomeT >= zoneLen()) {
      W.biomeT -= zoneLen(); W.biome++; Sfx.zone(); W.tapFlash = 14;
    }

    updPuffs(); updFlakes();
    hud();
  }

  function solid(o) { return o.t === 'rock' || o.t === 'tree'; }
  function airborne() { return W.airTo > W.dist; }

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

  function updPuffs() {
    for (var i = W.puffs.length - 1; i >= 0; i--) {
      var p = W.puffs[i];
      p.s *= 1.035; p.life--;
      if (p.life <= 0) W.puffs.splice(i, 1);
    }
  }
  function updFlakes() {
    for (var i = 0; i < W.flakes.length; i++) {
      var f = W.flakes[i];
      f.y += f.v + W.speed * 0.3;
      if (f.y > VIEW_H + 6) { f.y = -6; f.x = Math.random() * VIEW_W; }
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
    drawObjects();
    drawHaze();
    drawFog();
    drawPenguin();
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
    ctx.strokeStyle = 'rgba(255,255,255,.5)';         // streaks of polished ice
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
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.stroke();

      /* Long drifts of wind-packed snow lying along the bank. Blocky facets
         floated free of the edge and read as stray rectangles. */
      ctx.fillStyle = B.bankShade;
      ctx.globalAlpha = 0.2;
      var base = Math.floor(W.dist / 120) * 120;
      for (var fi = -1; fi < 8; fi++) {
        var fd = base + fi * 120;
        var fy = scrY(fd);
        if (fy < -140 || fy > VIEW_H + 140) continue;
        var fc = chuteAt(fd) - chuteAt(W.dist);
        var wob2 = Math.sin(fd * 0.011 + side * 2.1) * 9 + Math.sin(fd * 0.03) * 4;
        var ex = VIEW_W / 2 + fc + side * (CHUTE + wob2);
        var off = 7 + ((fi * 29) % 13);
        ctx.beginPath();
        ctx.ellipse(ex + side * off, fy, 7 + ((fi * 17) % 6), 30 + ((fi * 31) % 26),
                    side * 0.05, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawObjects() {
    var list = W.objects.filter(function (o) {
      var y = scrY(o.d);
      return y > -140 && y < VIEW_H + 140;
    }).sort(function (a, b) { return a.d - b.d; });        // nearest drawn last

    var B = pal();
    for (var i = 0; i < list.length; i++) {
      var o = list[i], x = scrX(o.x), y = scrY(o.d);
      if (o.t === 'crevasse')    drawCrevasse(y, o, B);
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
    }
    for (i = 0; i < W.puffs.length; i++) {
      var p = W.puffs[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.75;
      ctx.fillStyle = p.tint || B.snowA;     // pure white glares on the night run
      ctx.beginPath(); ctx.arc(scrX(p.x), scrY(p.d), p.s, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* A boulder from above: grey stone with a cap of snow sitting on its upper
     face, the join between them wavy rather than a clean arc. */
  function drawRock(x, y, o, B) {
    var r = o.r, k, a, rad;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(o.rot);

    ctx.fillStyle = 'rgba(86,132,176,.26)';
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
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-r * 1.25, capY(-1.25));
    for (t = -1.25; t <= 1.25; t += 0.16) ctx.lineTo(r * t, capY(t));
    ctx.lineTo(r * 1.25, -r * 1.4);
    ctx.lineTo(-r * 1.25, -r * 1.4);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = 'rgba(163,196,224,.5)';       // soft shade under its lower lip
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

    ctx.save();                                      // snow settled on the branches
    ring(1.02, 0, 0.76); ctx.clip();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.40, r * 0.62, r * 0.42, -0.6, 0, 6.2832);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(r * 0.30, -r * 0.46, r * 0.34, r * 0.2, 0.5, 0, 6.2832);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  }

  /* Two posts with pennants turned in towards each other, and a faint line
     between them, so the pair reads as one opening to aim at. */
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

    ctx.save(); ctx.clip();                          // ice walls glowing near the top
    ctx.fillStyle = 'rgba(120,200,240,.3)';
    ctx.beginPath(); ctx.rect(0, top, VIEW_W, 16); ctx.fill();
    ctx.fillStyle = 'rgba(90,170,215,.2)';
    ctx.beginPath(); ctx.rect(0, bot - 13, VIEW_W, 13); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;  // the broken rim
    ctx.beginPath(); ctx.moveTo(lTop, top); edge(top, lTop, rTop, 7, 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lBot, bot); edge(bot, lBot, rBot, 7, 2.3); ctx.stroke();
  }

  /* The way across: packed snow heaped into a ramp, sitting exactly in the
     row's opening so it is aimed at the same way as every other gap. */
  /* The way across, carved from the ice itself rather than heaped out of
     snow. Ice colours are fixed instead of taken from the biome: in the
     rocky pass the snow palette is sandy, and a sand-coloured ramp read as
     a dune. A faint biome wash keeps it from looking pasted on. */
  function drawRamp(x, y, o, B) {
    var hw = o.w / 2, h = 48;
    ctx.save();
    ctx.translate(x, y);

    /* It sits proud of the ice, and it is the one thing you must not miss,
       so it gets a real shadow and a darker foot rather than melting into
       the run behind it. */
    ctx.fillStyle = 'rgba(40,78,116,.34)';
    ctx.beginPath(); ctx.ellipse(5, 13, hw * 1.0, 21, 0, 0, 6.2832); ctx.fill();

    function slab(inset) {
      ctx.beginPath();
      ctx.moveTo(-hw + inset, h * 0.5 - inset);
      ctx.lineTo(-hw * 0.72 + inset, -h * 0.62 + inset);
      ctx.quadraticCurveTo(0, -h * 0.84 + inset, hw * 0.72 - inset, -h * 0.62 + inset);
      ctx.lineTo(hw - inset, h * 0.5 - inset);
      ctx.closePath();
    }

    var g = ctx.createLinearGradient(0, h * 0.5, 0, -h * 0.8);
    g.addColorStop(0, '#2f7fae');                    // deep, wet ice at the foot
    g.addColorStop(0.42, '#7cc6e6');
    g.addColorStop(0.85, '#d8f1fc');
    g.addColorStop(1, '#ffffff');                    // frosted lip
    ctx.fillStyle = g;
    slab(0); ctx.fill();

    ctx.save(); slab(0); ctx.clip();
    ctx.globalAlpha = 0.16;                          // a whisper of the local light
    ctx.fillStyle = B.iceTop;
    ctx.fillRect(-hw, -h, hw * 2, h * 2);
    ctx.globalAlpha = 1;

    /* Cleaved faces, the way a block of ice breaks: straight, bright edges
       rather than the soft ribs packed snow would have. */
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2;
    [-0.62, -0.2, 0.24, 0.66].forEach(function (f, i) {
      ctx.beginPath();
      ctx.moveTo(hw * f, h * 0.5);
      ctx.lineTo(hw * f * 0.66 + (i % 2 ? 3 : -3), -h * 0.6);
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(70,130,175,.35)';
    ctx.lineWidth = 1.4;
    [-0.42, 0.06, 0.46].forEach(function (f) {
      ctx.beginPath();
      ctx.moveTo(hw * f, h * 0.5);
      ctx.lineTo(hw * f * 0.66, -h * 0.6);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(255,255,255,.4)';          // glassy sheen off the face
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5, h * 0.44);
    ctx.lineTo(-hw * 0.2, -h * 0.55);
    ctx.lineTo(-hw * 0.02, -h * 0.55);
    ctx.lineTo(-hw * 0.26, h * 0.44);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4;
    ctx.beginPath();                                 // the frosted lip you leave from
    ctx.moveTo(-hw * 0.72, -h * 0.62);
    ctx.quadraticCurveTo(0, -h * 0.84, hw * 0.72, -h * 0.62);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(38,92,132,.7)'; ctx.lineWidth = 2.4;
    slab(0); ctx.stroke();

    for (var ch = 0; ch < 2; ch++) {                 // chevrons: aim here
      var cy = -h * 0.14 + ch * 17;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.34, cy + 8);
      ctx.lineTo(0, cy - 5);
      ctx.lineTo(hw * 0.34, cy + 8);
      ctx.lineTo(hw * 0.34, cy + 14);
      ctx.lineTo(0, cy + 1);
      ctx.lineTo(-hw * 0.34, cy + 14);
      ctx.closePath();
      ctx.fillStyle = 'rgba(120,60,0,.35)';
      ctx.fill();
      ctx.translate(0, -2);
      ctx.fillStyle = '#ffc032';
      ctx.fill();
      ctx.translate(0, 2);
    }
    ctx.restore();
  }

  function drawGate(x, y, o) {
    var tone = o.passed ? '#46c98a' : '#ffb63d';
    ctx.save();
    ctx.strokeStyle = o.passed ? 'rgba(70,201,138,.5)' : 'rgba(255,182,61,.45)';
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 11]);
    ctx.beginPath();
    ctx.moveTo(x - o.w / 2, y); ctx.lineTo(x + o.w / 2, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    [-1, 1].forEach(function (side) {
      var gx = x + side * o.w / 2;
      ctx.fillStyle = 'rgba(90,130,170,.22)';
      ctx.beginPath(); ctx.ellipse(gx + 3, y + 5, 10, 8, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = tone;                              // pennant, pointing inward
      ctx.beginPath();
      ctx.moveTo(gx, y - 5);
      ctx.lineTo(gx - side * 26, y + 3);
      ctx.lineTo(gx, y + 11);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';                         // the post itself
      ctx.beginPath(); ctx.arc(gx, y, 7, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = tone; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(gx, y, 7, 0, 6.2832); ctx.stroke();
    });
  }

  function drawFish(x, y, o, gold) {
    var wag = Math.sin(W.t * 0.22 + o.ph) * 0.3;
    var L = gold ? 24 : 18, Hh = gold ? 13 : 10;
    ctx.save();
    ctx.translate(x, y + Math.sin(W.t * 0.07 + o.ph) * 3);
    ctx.rotate(Math.PI / 2 + wag * 0.25);
    ctx.fillStyle = gold ? 'rgba(255,205,60,.3)' : 'rgba(150,215,255,.24)';
    ctx.beginPath(); ctx.arc(0, 0, L * 1.35, 0, 6.2832); ctx.fill();
    ctx.save(); ctx.rotate(wag);
    ctx.fillStyle = gold ? '#e8a318' : '#5aa9d8';
    ctx.beginPath();
    ctx.moveTo(L * 0.4, 0); ctx.lineTo(L * 1.1, -Hh * 0.9);
    ctx.lineTo(L * 0.95, 0); ctx.lineTo(L * 1.1, Hh * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    var g = ctx.createLinearGradient(0, -Hh, 0, Hh);
    if (gold) { g.addColorStop(0, '#ffe58a'); g.addColorStop(0.5, '#ffc531'); g.addColorStop(1, '#d68f0c'); }
    else      { g.addColorStop(0, '#e6f5ff'); g.addColorStop(0.5, '#8fcdf0'); g.addColorStop(1, '#4e93c4'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, L, Hh, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.moveTo(-L * 0.1, -Hh * 0.9); ctx.lineTo(L * 0.3, -Hh * 1.6); ctx.lineTo(L * 0.45, -Hh * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-L * 0.55, -Hh * 0.2, Hh * 0.32, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#23304a';
    ctx.beginPath(); ctx.arc(-L * 0.57, -Hh * 0.2, Hh * 0.16, 0, 6.2832); ctx.fill();
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

  function bodyPenguin(c, S, ang, wag) {
    [-1, 1].forEach(function (k) {                    // flippers spread wide
      c.save();
      c.translate(k * 17, -4);
      c.rotate(k * (0.6 + wag) - ang * 0.32 * k);
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
      c.translate(k * 11, 26);
      c.rotate(k * 0.5);
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
    crease(c, 0, -17, 12, 5, 0.16);                   // where the head sits on the back
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -25, 12.5, 11.5, 0, 0, 6.2832); c.fill();
    sheen(c, -4, -29, 6, 4.5, -0.4, 0.16);            // light on the crown

    sheen(c, -7, -9, 8.5, 15, -0.25, 0.14);           // along the back
    sheen(c, 9, 2, 3.5, 11, 0.2, 0.07);               // a thin edge on the far side

    drawSkinExtra(c, S);

    c.fillStyle = S.trim;                             // beak past the head
    c.beginPath();
    c.moveTo(-5, -30); c.lineTo(0, -39); c.lineTo(5, -30);
    c.closePath(); c.fill();
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

  /* four paws, used by everything that is not a bird */
  function paws(c, S, ang, wag, fx, fy, fr, bx, by, br) {
    [-1, 1].forEach(function (k) {
      c.save();
      c.translate(k * fx, fy);
      c.rotate(k * (0.5 + wag) - ang * 0.3 * k);
      c.fillStyle = S.paw || S.flipper[1];
      c.beginPath(); c.ellipse(0, 0, fr, fr * 1.5, k * 0.3, 0, 6.2832); c.fill();
      if (edge(c, S, 1.8)) c.stroke();
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

  function bodyBear(c, S, ang, wag) {
    paws(c, S, ang, wag, 22, -2, 9, 16, 26, 8.5);
    var bg = c.createRadialGradient(-9, -14, 5, 0, 0, 38);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    c.beginPath();                                    // heavy, near-round back
    c.moveTo(0, -20);
    c.bezierCurveTo(20, -23, 27, -8, 26, 7);
    c.bezierCurveTo(25, 22, 14, 29, 0, 29);
    c.bezierCurveTo(-14, 29, -25, 22, -26, 7);
    c.bezierCurveTo(-27, -8, -20, -23, 0, -20);
    c.closePath(); c.fill();
    if (edge(c, S, 2.4)) c.stroke();
    [-1, 1].forEach(function (k) {                    // small round ears
      c.fillStyle = S.body[2];
      c.beginPath(); c.arc(k * 12, -33, 7.5, 0, 6.2832); c.fill();
      if (edge(c, S, 2)) c.stroke();
      c.fillStyle = S.nose;
      c.globalAlpha = 0.35;
      c.beginPath(); c.arc(k * 12, -33, 3.6, 0, 6.2832); c.fill();
      c.globalAlpha = 1;
    });
    crease(c, 0, -16, 14, 6, 0.13);                   // heavy neck
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -25, 15, 13, 0, 0, 6.2832); c.fill();
    if (edge(c, S, 2.2)) c.stroke();
    sheen(c, -5, -29, 7, 5, -0.4, 0.3);
    c.fillStyle = S.mark;                             // muzzle
    c.beginPath(); c.ellipse(0, -34, 8.5, 7, 0, 0, 6.2832); c.fill();
    if (edge(c, S, 1.8)) c.stroke();
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, -38, 4.2, 3.2, 0, 0, 6.2832); c.fill();
    sheen(c, -10, -6, 11, 17, -0.2, 0.32);            // the shoulder catching light
    crease(c, 13, 10, 8, 14, 0.07);                   // and the far flank falling away
  }

  function bodyWalrus(c, S, ang, wag) {
    [-1, 1].forEach(function (k) {                    // broad front flippers
      c.save();
      c.translate(k * 20, 2);
      c.rotate(k * (0.72 + wag) - ang * 0.3 * k);
      c.fillStyle = S.flipper[1];
      c.beginPath();
      c.moveTo(0, -9);
      c.quadraticCurveTo(k * 24, -2, k * 20, 15);
      c.quadraticCurveTo(k * 9, 10, 0, 10);
      c.closePath(); c.fill();
      c.restore();
    });
    [-1, 1].forEach(function (k) {                    // tail flukes
      c.fillStyle = S.flipper[2];
      c.beginPath(); c.ellipse(k * 10, 30, 8, 11, k * 0.5, 0, 6.2832); c.fill();
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

  function bodySeal(c, S, ang, wag) {
    [-1, 1].forEach(function (k) {                    // little front flippers
      c.save();
      c.translate(k * 15, 0);
      c.rotate(k * (0.62 + wag) - ang * 0.3 * k);
      c.fillStyle = S.flipper[1];
      c.beginPath(); c.ellipse(0, 2, 6.5, 12, k * 0.35, 0, 6.2832); c.fill();
      c.restore();
    });
    [-1, 1].forEach(function (k) {                    // rear flippers, fanned
      c.save();
      c.translate(k * 9, 28);
      c.rotate(k * 0.7);
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
  }

  function bodyFox(c, S, ang, wag) {
    c.save();                                         // the tail is the whole point
    c.translate(0, 14);                               // overlapping the rump, not floating below it
    c.rotate(Math.sin(wag * 8) * 0.18 - ang * 0.5);
    var tg = c.createLinearGradient(0, -8, 0, 32);
    tg.addColorStop(0, S.body[2]); tg.addColorStop(0.6, S.body[1]); tg.addColorStop(1, S.mark);
    c.fillStyle = tg;
    c.beginPath(); c.ellipse(0, 16, 12.5, 22, 0, 0, 6.2832); c.fill();
    if (edge(c, S, 2.2)) c.stroke();
    /* The tip is brushed on inside the tail rather than stuck on the end;
       as its own circle it read as a snowball she was towing. */
    var tip = c.createRadialGradient(0, 30, 2, 0, 30, 12);
    tip.addColorStop(0, 'rgba(255,255,255,.95)');
    tip.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = tip;
    c.beginPath(); c.ellipse(0, 29, 11, 13, 0, 0, 6.2832); c.fill();
    c.restore();

    paws(c, S, ang, wag, 17, -4, 6.5, 12, 22, 6);
    var bg = c.createRadialGradient(-7, -12, 4, 0, 0, 30);
    bg.addColorStop(0, S.body[0]); bg.addColorStop(0.55, S.body[1]); bg.addColorStop(1, S.body[2]);
    c.fillStyle = bg;
    c.beginPath();                                    // narrow, quick-looking
    c.moveTo(0, -22);
    c.bezierCurveTo(13, -25, 18, -9, 17, 5);
    c.bezierCurveTo(16, 18, 9, 24, 0, 24);
    c.bezierCurveTo(-9, 24, -16, 18, -17, 5);
    c.bezierCurveTo(-18, -9, -13, -25, 0, -22);
    c.closePath(); c.fill();
    if (edge(c, S, 2.2)) c.stroke();
    [-1, 1].forEach(function (k) {                    // sharp ears
      c.fillStyle = S.body[2];
      c.beginPath();
      c.moveTo(k * 4, -30); c.lineTo(k * 16, -46); c.lineTo(k * 16, -28);
      c.closePath(); c.fill();
      if (edge(c, S, 2)) c.stroke();
      c.fillStyle = S.nose;                           // dark inner ear reads at any size
      c.globalAlpha = 0.4;
      c.beginPath();
      c.moveTo(k * 7, -31); c.lineTo(k * 13.5, -41); c.lineTo(k * 13.5, -30);
      c.closePath(); c.fill();
      c.globalAlpha = 1;
    });
    crease(c, 0, -18, 10, 4.5, 0.12);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -26, 11, 10.5, 0, 0, 6.2832); c.fill();
    if (edge(c, S, 2)) c.stroke();
    sheen(c, -4, -29, 5.5, 4, -0.4, 0.4);
    sheen(c, -8, -6, 7, 12, -0.2, 0.35);
    c.fillStyle = S.mark;                             // pointed snout
    c.beginPath();
    c.moveTo(-5.5, -31); c.lineTo(0, -43); c.lineTo(5.5, -31);
    c.closePath(); c.fill();
    if (edge(c, S, 1.6)) c.stroke();
    c.fillStyle = S.nose;
    c.beginPath(); c.ellipse(0, -41, 3, 2.4, 0, 0, 6.2832); c.fill();
  }

  var BODIES = { penguin: bodyPenguin, bear: bodyBear, walrus: bodyWalrus,
                 seal: bodySeal, fox: bodyFox };

  /* One painter, two callers: the creature on the hill and the little
     portrait on each shop card. Everything it needs comes in through `o`,
     so the preview does not have to fake a world to borrow the drawing. */
  function paintCreature(c, S, o) {
    var ang = o.ang || 0, wag = o.wag || 0, lift = o.lift || 0;
    c.save();
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

    (BODIES[S.shape] || bodyPenguin)(c, S, ang, wag);

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
    var blink = W.invuln > 0 && Math.floor(W.invuln / 5) % 2 === 0;

    ctx.save();
    ctx.translate(scrX(W.px), PLAYER_Y);
    ctx.rotate(crashed && W.crashAt ? W.crashAt.spin : ang);
    if (blink) ctx.globalAlpha = 0.45;
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
    paintCreature(ctx, S, {
      ang: ang, wag: Math.sin(W.t * 0.3) * 0.1, scale: 1.45, lift: lift,
      shield: (W.shield > 0 && !crashed) ? W.t : -1
    });
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
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (var i = 0; i < W.flakes.length; i++) {
      var f = W.flakes[i];
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function pill(cx, y, label, value, tint) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 22px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    var w = Math.max(84, ctx.measureText(String(value)).width + 36);
    ctx.fillStyle = 'rgba(18,52,86,.4)';
    rr(ctx, cx - w / 2, y - 22, w, 46, 21); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
    rr(ctx, cx - w / 2, y - 22, w, 46, 21); ctx.stroke();
    ctx.fillStyle = tint;
    ctx.fillText(String(value), cx, y + 3);
    ctx.font = '700 10px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(label, cx, y + 16);
    ctx.restore();
  }

  function drawHud() {
    /* Both readouts stack down the left so the top right stays clear for the
       pause button. The whole screen is the control here, so that button must
       not sit where a thumb taps. */
    pill(66, 34, tr('hud.score', 'SCORE'), Math.floor(W.score), '#ffd83d');
    pill(72, 84, tr('hud.metres', 'METRES'), Math.floor(W.dist / 8), '#eaf7ff');
    if (W.shield > 0) {
      ctx.save();
      ctx.translate(VIEW_W / 2, 62);
      var g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 17);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(140,220,255,.35)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(210,245,255,.95)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }
    if (W.best > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '700 13px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(30,70,105,.7)';
      ctx.fillText(tr('hud.best', 'BEST') + '  ' + W.best, VIEW_W / 2, 26);
      ctx.restore();
    }
    if (W.tapFlash > 0 && W.biomeT < 120) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, W.tapFlash / 10);
      ctx.textAlign = 'center';
      ctx.font = '800 30px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,.92)';
      var zone = tr('biome.' + (W.biome % BIOMES.length), biome().name);
      ctx.strokeText(zone, VIEW_W / 2, 120);
      ctx.fillStyle = '#12496f';
      ctx.fillText(zone, VIEW_W / 2, 120);
      ctx.restore();
    }
  }

  /* ====================== VIEWPORT / LOOP ====================== */
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
    start: function (best, cbs, skinId) {
      if (!ctx) setup();
      if (typeof SKINS !== 'undefined') skin = skinById(skinId);
      hooks.hud = cbs.hud; hooks.over = cbs.over;
      newRun();
      W.best = best || 0;
      paused = false; lastT = 0; accT = 0;
      hud();
      if (rafId == null && !suspended) rafId = requestAnimationFrame(loop);
    },
    stop: function () { W = null; if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } },
    tap: tap,
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
      paintCreature(c, skinById(skinId), { ang: 0, wag: 0, scale: size / 112, shield: -1 });
      c.restore();
    },
    /* stepping the world by hand, for tests and screenshots */
    _step: function (n) { for (var i = 0; i < n; i++) if (W) step(); },
    _render: function () { if (W) render(); },
    _screen: function (x, d) { return { x: scrX(x), y: scrY(d) }; },
    _chuteAt: chuteAt,
    _turnRate: function () { return W ? turnRate() : TURN; },
    _consts: function () { return { CHUTE: CHUTE, PR: PR, LOOK: LOOK,
                                    PLAYER_Y: PLAYER_Y, VIEW_W: VIEW_W, VIEW_H: VIEW_H,
                                    SPEED_MAX: SPEED_MAX, HARD_OVER: HARD_OVER,
                                    ROW_GAP0: ROW_GAP0, ROW_GAP1: ROW_GAP1,
                                    DRIFT: DRIFT, TURN: TURN,
                                    reach: reachBetweenRows() }; }
  };
})();
