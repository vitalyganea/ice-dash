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
       |     a tongue of polished blue ice
       !     opening a little tighter than the course's norm
       ~     opening a little wider

   So `4*` is an opening left of centre with fish running through it,
   and `6C|` is a crevasse right of centre with a gate over the ramp.
   Spaces mean nothing and are there to group the reading.

   Anything written here still has to be POSSIBLE. A hand-made course
   can ask for a turn nobody could make just as easily as a generated
   one, so scratchpad/pine/courses.js replays every row of every course
   against the same reachability proof the spawner uses.
   =========================================================== */

/* Each marked run sits in a stretch of hill of its own, so you know which
   one you are on from the first frame: pine forest, whiteout, lava field,
   glacier, aurora, night. `biome` indexes BIOMES in js/biomes.js. */
var COURSES = [
  {
    id: 'firstlight', biome: 0, step: 278, gapW: [250, 228],
    script: '5 5* 4 4 4* 5 5| 6 6* 7T 7 6 5| 5* 4 3 3 4* 5 5| ' +
            '6 6* 5 5'
  },
  {
    id: 'narrows', biome: 2, step: 262, gapW: [228, 198],
    script: '5 5 6 7* 8 8 7! 6 5| 4 3 2* 2 3! 4 5 6 7 8! 8 7* 6 ' +
            '5| 4 4! 3 3 4* 5 5'
  },
  {
    id: 'gapteeth', biome: 7, step: 256, gapW: [222, 194],
    script: '5 5 5* 4 4 5C 5 5* 6 7 7| 7 6 5 4 4C 4 4* 3 3 4 5| ' +
            '6 6 7* 7 7C 7 6 5 5* 5 5'
  },
  {
    id: 'glassrun', biome: 3, step: 250, gapW: [204, 176],
    script: '5 5 4 4* 3 3 3 4 5 6 7 7* 8 8 8| 7 6 5 4 3 2 2* 2 ' +
            '3 4 5 6 7 8 8| 8 7 6* 5 5 5'
  },
  {
    id: 'nightfall', biome: 9, step: 244, gapW: [206, 172],
    script: '5 5 6 6* 7 7! 6 5 4| 3 3! 3T 4 5 6* 7 8 8! 7 6 5 4 ' +
            '3! 2 2 3* 4 5| 6 7 7! 8$ 8 7 6* 5 4 4! 3 3 4 5C 5 5'
  },
  {
    id: 'cornice', biome: 8, step: 234, gapW: [198, 156],
    script: '5 5* 6 7 8! 8 7 6 5C 5 4 3! 2 2* 3 4 5| 6 7! 8 8 7 ' +
            '6C 6 5 4! 3 2 2 3* 4 5 6! 7 8 8| 7 6 5C 5 4 3! 3 ' +
            '2 3 4*R 5 6 7! 8T 8 7 6 5| 4 4C 4$ 4* 5 5'
  }
];

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
      gate: tk.indexOf('|') >= 0
    });
  }
  return rows;
}

function courseById(id) {
  for (var i = 0; i < COURSES.length; i++) if (COURSES[i].id === id) return COURSES[i];
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
