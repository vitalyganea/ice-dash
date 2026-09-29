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
  { id: 'first',    icon: '🎬', reward:  25, goal: 1,    stat: function (s) { return s.runs; } },
  { id: 'dist500',  icon: '📏', reward:  50, goal: 500,  stat: function (s) { return s.bestDist; } },
  { id: 'dist2000', icon: '🏔️', reward: 150, goal: 2000, stat: function (s) { return s.bestDist; } },
  { id: 'dist5000', icon: '🚀', reward: 400, goal: 5000, stat: function (s) { return s.bestDist; } },
  { id: 'runfish30',icon: '🎣', reward:  80, goal: 30,   stat: function (s) { return s.bestRunFish; } },
  { id: 'fish500',  icon: '🐟', reward: 100, goal: 500,  stat: function (s) { return s.totFish; } },
  { id: 'fish3000', icon: '🐠', reward: 350, goal: 3000, stat: function (s) { return s.totFish; } },
  { id: 'gold1',    icon: '✨', reward:  60, goal: 1,    stat: function (s) { return s.totGold; } },
  { id: 'gold25',   icon: '🌟', reward: 300, goal: 25,   stat: function (s) { return s.totGold; } },
  { id: 'gates100', icon: '💠', reward: 120, goal: 100,  stat: function (s) { return s.totGates; } },
  { id: 'jump1',    icon: '🕳️', reward:  40, goal: 1,    stat: function (s) { return s.totJumps; } },
  { id: 'jump50',   icon: '🪂', reward: 250, goal: 50,   stat: function (s) { return s.totJumps; } },
  { id: 'saves10',  icon: '🫧', reward: 150, goal: 10,   stat: function (s) { return s.totSaves; } },
  { id: 'wear3',    icon: '🐧', reward: 100, goal: 3,    stat: function (s) { return s.owned.length; } },
  { id: 'wearAll',  icon: '👑', reward: 500, goal: 0,    stat: function (s) { return s.owned.length; } }
];

/* wearAll's target is however many there are, so adding a creature moves
   the goalpost instead of leaving a trophy that is wrong. */
function achGoal(a) {
  if (a.id !== 'wearAll') return a.goal;
  var n = 0;
  for (var i = 0; i < SKINS.length; i++) if (SKINS[i].currency === 'fish') n++;
  return n;
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
