/* ===========================================================
   courses.js — the six marked runs
   -----------------------------------------------------------
   Freeride builds the hill as you ride it. These do not: every gate,
   every boulder and every crevasse below is written down, and the run
   is the same on your fortieth attempt as on your first. That is the
   whole point of them — you cannot learn a course that reshuffles.

   A course is a line of tokens, one per row of obstacles:

       pos   1 . . 9   where the opening sits across the run,
                       1 hard left, 5 centre, 9 hard right
       C     this row is a crevasse; the ramp lands in its opening
       *     a shoal of fish through the opening
       +     a golden fish, off to one side
       o     a snow bubble
       $     a nodule of ice with something frozen inside it
       T     a snow bridge arches over the run here
       R     a ball of packed powder: take it and nothing can stop you
       w     a patch of deep soft snow: it costs pace, never a life
       ^     a meltwater geyser, standing clear of the racing line
       -     a cold draught: the hill runs slow for a few seconds
       >     a clear sight of the next three openings
       &     every fish on the hill bends towards you
       |     a tongue of polished blue ice
       !     opening a little tighter than the course's norm
       ~     opening a little wider

   So `4*` is an opening left of centre with fish running through it,
   and `6C|` is a crevasse right of centre with a gate over the ramp.
   Spaces mean nothing and are there to group the reading.

   Anything written here still has to be POSSIBLE. A hand-made course
   can ask for a turn nobody could make just as easily as a generated
   one, so test/courses.js replays every row of every course
   against the same reachability proof the spawner uses.
   =========================================================== */

/* Each marked run sits in a stretch of hill of its own, so you know which
   one you are on from the first frame: pine forest, whiteout, lava field,
   glacier, aurora, night. `biome` indexes BIOMES in js/biomes.js. */
var COURSES = [
  {
    id: 'firstlight', biome: 0, step: 278, gapW: [250, 228],
    script: '5 5* 4 4 4* 5 5| 6 6* 7T 7 6 5| 5*- 4 3 3 4* 5 5| ' +
            '6 6* 5 5'
  },
  {
    id: 'narrows', biome: 2, step: 262, gapW: [228, 198],
    script: '5 5 6 7* 8 8w 7! 6 5| 4 3 2* 2 3! 4 5 6 7 8! 8 7*w 6 ' +
            '5| 4 4! 3 3 4* 5 5'
  },
  {
    id: 'gapteeth', biome: 7, step: 256, gapW: [222, 194],
    script: '5 5 5* 4 4^ 5C 5 5* 6 7 7| 7^ 6 5 4 4C 4 4* 3 3w 4 5| ' +
            '6 6 7* 7^ 7C 7 6 5 5* 5 5'
  },
  {
    id: 'glassrun', biome: 3, step: 250, gapW: [204, 176],
    script: '5 5 4 4* 3 3w 3 4 5 6> 7 7* 8 8 8| 7 6 5 4 3 2 2* 2 ' +
            '3 4w 5 6 7 8 8| 8 7 6* 5 5 5'
  },
  {
    id: 'nightfall', biome: 9, step: 244, gapW: [206, 172],
    script: '5 5 6 6* 7 7! 6 5 4| 3 3! 3T 4 5 6* 7w 8 8! 7 6 5 4 ' +
            '3! 2 2 3*& 4 5| 6 7 7! 8$ 8^ 7 6* 5 4w 4! 3 3 4 5C 5 5'
  },
  {
    id: 'cornice', biome: 8, step: 234, gapW: [198, 156],
    script: '5 5* 6 7 8! 8w 7 6 5C 5 4 3!- 2 2* 3 4 5| 6 7! 8 8 7 ' +
            '6C 6 5 4! 3 2 2 3*> 4 5 6! 7 8^ 8| 7 6 5C 5 4 3! 3 ' +
            '2 3 4*R 5 6 7!w 8T 8 7 6 5| 4 4C 4$ 4* 5 5'
  },
  /* Three more, one in each of the newest stretches. */
  {
    id: 'canopy', biome: 10, step: 240, gapW: [204, 166],
    script: '5 5* 4 3 3* 4w 5 6 7* 7| 6 5C 5 4* 3 3! 4 5 6+ 7 7* 6^ 5 4 ' +
            '4C 4 5* 6 7! 7 6 5w 4 4* 5 5'
  },
  {
    id: 'starfall', biome: 11, step: 236, gapW: [200, 160],
    script: '5 5 6* 7 7> 6 5 4* 3 3! 4 5T 5 5 6 7* 8 8| 7 6C 6 5 4* 3 2! ' +
            '2 3*& 4 5 6 7^ 7 6 5* 5C 5 4 4 5'
  },
  {
    id: 'geode', biome: 12, step: 232, gapW: [198, 154],
    script: '5 5* 5 4 3 3w 3* 4 5! 6 7 7C 7 6* 5 4 3! 2 2* 3 4| 5 6 7! 8 ' +
            '8$ 7 6* 5 4C 4 3 3! 4 5* 6 7 7 6 5 5'
  }
];

/* The first-run tutorial. A marked line like the six above, so it is the
   same every time and test/courses.js proves every row of it, but kept out
   of COURSES: it has no stars, never shows in Known Lines and never counts
   towards the line that opens Freeride.

   Openings are wide and sit at 3 and 7, a short slide either side of
   centre, so the lesson is the tap and not the turn. `lessons` is keyed by
   row index:
     key   the line to show (i18n), as the row comes into view
     want  the direction the player must be sliding to go through it,
           -1 left / 1 right. Until he is, the hill slows almost to a stop
           and the line stays up, so the first taps are taught, not hoped for.
     hint  the icon beside the line, drawn by the hill's own painter */
var TUTORIAL = {
  id: 'tutorial', biome: 0, step: 320, gapW: [300, 276], tutorial: true,
  script: '3 7 3 7 4* 5* 6+ 5 5o 5 5| 5 5T 5 5 5C 5 5',
  lessons: {
    0:  { key: 'tut.left',     want: -1 },
    1:  { key: 'tut.right',    want: 1 },
    2:  { key: 'tut.weave' },
    4:  { key: 'tut.fish',     hint: 'fish' },
    6:  { key: 'tut.gold',     hint: 'gold' },
    8:  { key: 'tut.bubble',   hint: 'bubble' },
    10: { key: 'tut.gate',     hint: 'gate' },
    12: { key: 'tut.bridge',   hint: 'bridge' },
    15: { key: 'tut.crevasse', hint: 'crevasse' },
    17: { key: 'tut.finish' }
  }
};

/* ---- the Daily Line ----
   A marked line written fresh each day out of the date, so everyone who
   plays on a given day rides the same one, and tomorrow there is another.
   It is written in the same tokens as the six above and goes through the
   same proof in test/courses.js — for a whole year of dates — so a day
   can never hand out a turn nobody could make. Kept out of COURSES like
   the tutorial: it has stars, but its own, and a streak. */
function dailyKey(d) {
  d = d || new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
function dailyPrevKey(key) {
  var p = key.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
  d.setDate(d.getDate() - 1);
  return dailyKey(d);
}
/* Its own little generator, seeded from the date: the game's Math.random
   is nobody's business here, and a hill that depended on it would differ
   from one phone to the next. */
function dailyRng(key) {
  var h = 2166136261;
  for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () {
    h = (h + 0x6D2B79F5) | 0;
    var t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dailyCourse(key) {
  key = key || dailyKey();
  var R = dailyRng(key);
  var biome = Math.floor(R() * BIOMES.length);
  /* On slippery ice the turn is wider, so the line asks for less of one. */
  var maxStep = (BIOMES[biome].grip || 1) < 1 ? 1 : 2;
  var n = 34, pos = 5, toks = [], crevAt = -9, bridged = false, found = false;
  for (var i = 0; i < n; i++) {
    if (i >= 2) {
      var dlt = Math.round((R() * 2 - 1) * maxStep);
      pos = Math.max(2, Math.min(8, pos + dlt));
    }
    var t = String(pos);
    var late = i >= 4 && i < n - 2;
    if (late && i - crevAt >= 7 && R() < 0.22) { t += 'C'; crevAt = i; }
    else {
      if (R() < 0.42) t += '*';
      if (late && R() < 0.10) t += '|';
      if (late && R() < 0.06) t += '+';
      if (late && R() < 0.06) t += 'w';
      if (i >= 6 && late && R() < 0.05) t += '^';
      if (late && R() < 0.07) t += '!';
      if (!bridged && i > n * 0.4 && R() < 0.12) { t += 'T'; bridged = true; }
      if (!found && late && R() < 0.04) { t += '$'; found = true; }
      if (late && R() < 0.035) t += ['-', '>', '&'][Math.floor(R() * 3)];
    }
    toks.push(t);
  }
  return { id: 'daily', key: key, daily: true, biome: biome,
           step: 262, gapW: [236, 196], script: toks.join(' ') };
}

/* Rows come out with everything already decided: nothing here is left
   for the spawner to make up. */
function parseCourse(cd, CHUTE) {
  var rows = [], toks = cd.script.split(/\s+/).filter(function (t) { return t; });
  for (var i = 0; i < toks.length; i++) {
    var tk = toks[i];
    var pos = parseInt(tk.charAt(0), 10);
    if (!(pos >= 1 && pos <= 9)) continue;            // a stray token is skipped
    var t = cd.gapW.length > 1 ? i / Math.max(1, toks.length - 1) : 0;
    var w = cd.gapW[0] + (cd.gapW[1] - cd.gapW[0]) * t;
    if (tk.indexOf('!') >= 0) w *= 0.84;
    if (tk.indexOf('~') >= 0) w *= 1.14;
    var span = CHUTE - w / 2;
    rows.push({
      gap: (pos - 5) / 4 * span,
      gapW: w,
      crevasse: tk.indexOf('C') >= 0,
      fish: tk.indexOf('*') >= 0,
      gold: tk.indexOf('+') >= 0,
      bubble: tk.indexOf('o') >= 0,
      find: tk.indexOf('$') >= 0,
      tunnel: tk.indexOf('T') >= 0,
      rush: tk.indexOf('R') >= 0,
      /* The hazards and bonuses the open hill grows on its own, so a
         marked line can be written with them too. w deep snow, ^ a
         geyser, - the slow-down, > the far sight, & the fish call. */
      drift: tk.indexOf('w') >= 0,
      geyser: tk.indexOf('^') >= 0,
      chill: tk.indexOf('-') >= 0,
      sight: tk.indexOf('>') >= 0,
      call: tk.indexOf('&') >= 0,
      gate: tk.indexOf('|') >= 0
    });
  }
  return rows;
}

function courseById(id) {
  for (var i = 0; i < COURSES.length; i++) if (COURSES[i].id === id) return COURSES[i];
  if (id === TUTORIAL.id) return TUTORIAL;
  if (id === 'daily') return dailyCourse();
  return null;
}

/* Three stars for clearing it, plus what you picked up on the way.
   The thresholds are a share of the fish the course ACTUALLY holds, counted
   as it is laid down, not a number written next to it. Written by hand they
   drifted above the number of fish on the hill, and three stars quietly
   became unreachable on four of the six. */
function courseStars(cd, res) {
  if (!res.finished) return 0;
  var total = res.fishTotal || 0;
  var s = 1;
  if (total && res.fish >= Math.round(total * 0.40)) s = 2;
  if (total && res.fish >= Math.round(total * 0.75)) s = 3;
  return s;
}
