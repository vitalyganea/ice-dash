/* ===========================================================
   achievements.js — what the hill remembers you doing
   -----------------------------------------------------------
   Every goal reads a single number out of the save, so progress can be
   drawn at any time and not only in the moment it ticks over. Anything
   that happens inside one run is banked as a personal best
   (bestDist, bestRunFish), which is why those totals live in the save
   rather than being recomputed.

   Each one pays fish. They are a reason to go back for a thing you
   nearly did, and they feed the same purse the market takes from.
   =========================================================== */

var ACHIEVEMENTS = [
  { id: 'first',    reward:  25, goal: 1,    stat: function (s) { return s.runs; } },
  { id: 'dist500',  reward:  50, goal: 500,  stat: function (s) { return s.bestDist; } },
  { id: 'dist2000', reward: 150, goal: 2000, stat: function (s) { return s.bestDist; } },
  { id: 'dist5000', reward: 400, goal: 5000, stat: function (s) { return s.bestDist; } },
  { id: 'runfish30',reward:  80, goal: 30,   stat: function (s) { return s.bestRunFish; } },
  { id: 'fish500',  reward: 100, goal: 500,  stat: function (s) { return s.totFish; } },
  { id: 'fish3000', reward: 350, goal: 3000, stat: function (s) { return s.totFish; } },
  { id: 'gold1',    reward:  60, goal: 1,    stat: function (s) { return s.totGold; } },
  { id: 'gold25',   reward: 300, goal: 25,   stat: function (s) { return s.totGold; } },
  { id: 'gates100', reward: 120, goal: 100,  stat: function (s) { return s.totGates; } },
  { id: 'jump1',    reward:  40, goal: 1,    stat: function (s) { return s.totJumps; } },
  { id: 'jump50',   reward: 250, goal: 50,   stat: function (s) { return s.totJumps; } },
  { id: 'saves10',  reward: 150, goal: 10,   stat: function (s) { return s.totSaves; } },
  { id: 'wear3',    reward: 100, goal: 3,    stat: function (s) { return s.owned.length; } },
  { id: 'wearAll',  reward: 500, goal: 0,    stat: function (s) { return s.owned.length; } },

  /* Four systems went in without a single goal attached to them, so
     nothing ever asked you to go near a frozen find or a snow rush. */
  { id: 'find1',    reward: 150, goal: 1,    stat: function (s) { return s.totFinds; } },
  { id: 'find10',   reward: 500, goal: 10,   stat: function (s) { return s.totFinds; } },
  { id: 'rush5',    reward: 250, goal: 5,    stat: function (s) { return s.totRushes; } },
  { id: 'smash50',  reward: 300, goal: 50,   stat: function (s) { return s.totSmashed; } },
  { id: 'revive1',  reward: 100, goal: 1,    stat: function (s) { return s.totRevives; } },
  { id: 'forks10',  reward: 280, goal: 10,   stat: function (s) { return s.totForks; } },
  /* and the marked runs had none either, which is odd for the half of the
     game that has a finish line */
  { id: 'lines1',   reward: 120, goal: 1,    stat: function (s) { return linesDone(s); } },
  { id: 'linesAll', reward: 700, goal: 0,    stat: function (s) { return linesDone(s); } },
  { id: 'stars18',  reward: 1200, goal: 0,   stat: function (s) { return starsTotal(s); } }
];

/* How many marked runs have been finished at all, and how many stars in
   total. Both read straight off the save like every other goal. */
function linesDone(s) {
  var n = 0;
  for (var i = 0; i < COURSES.length; i++)
    if ((s.courses || {})[COURSES[i].id] > 0) n++;
  return n;
}
function starsTotal(s) {
  var n = 0;
  for (var i = 0; i < COURSES.length; i++) n += (s.courses || {})[COURSES[i].id] || 0;
  return n;
}

/* Some targets are however many there happen to be, so adding a creature
   or a seventh marked run moves the goalpost instead of leaving a trophy
   that is quietly wrong. */
function achGoal(a) {
  if (a.id === 'wearAll') {
    var n = 0;
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].currency === 'fish') n++;
    return n;
  }
  if (a.id === 'linesAll') return COURSES.length;
  if (a.id === 'stars18')  return COURSES.length * 3;
  return a.goal;
}

function achProgress(a, save) {
  var cur = a.stat(save) || 0, goal = achGoal(a);
  return { cur: Math.min(cur, goal), goal: goal, done: cur >= goal };
}

/* Everything newly earned, in catalogue order, with the fish it pays. */
function achCheck(save) {
  var won = [];
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    if (save.ach.indexOf(a.id) >= 0) continue;
    if (!achProgress(a, save).done) continue;
    save.ach.push(a.id);
    save.fish += a.reward;
    won.push(a);
  }
  return won;
}
