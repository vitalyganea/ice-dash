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
   Earning one and being paid for it are two steps: the fish wait in the
   trophy until the player claims them, so the payout is a moment of its
   own instead of a line that scrolls past on the results.

   `go` says where each one is earned, and a tap on one not yet earned
   (Trophies, and today's tasks there) goes straight to it: 'free' a
   Freeride run, 'rush' Time Rush, 'avalanche', 'daily' the Daily Line,
   'lines' the first line not yet finished, 'stars' the first without
   three stars, 'shop' the Market. Asked for by the owner, 17 Nov 2026.
   =========================================================== */

var ACHIEVEMENTS = [
  { id: 'first',    reward:  10, goal: 1,    stat: function (s) { return s.runs; }, go: 'free' },
  { id: 'dist500',  reward:  25, goal: 500,  stat: function (s) { return s.bestDist; }, go: 'free' },
  { id: 'dist2000', reward:  75, goal: 3000, stat: function (s) { return s.bestDist; }, go: 'free' },
  { id: 'dist5000', reward: 200, goal: 8000, stat: function (s) { return s.bestDist; }, go: 'free' },
  { id: 'runfish30',reward:  40, goal: 30,   stat: function (s) { return s.bestRunFish; }, go: 'free' },
  { id: 'fish500',  reward:  50, goal: 1000,  stat: function (s) { return s.totFish; }, go: 'free' },
  { id: 'fish3000', reward: 175, goal: 10000, stat: function (s) { return s.totFish; }, go: 'free' },
  { id: 'gold1',    reward:  30, goal: 1,    stat: function (s) { return s.totGold; }, go: 'free' },
  { id: 'gold25',   reward: 150, goal: 60,   stat: function (s) { return s.totGold; }, go: 'free' },
  { id: 'gates100', reward:  60, goal: 250,  stat: function (s) { return s.totGates; }, go: 'free' },
  { id: 'jump1',    reward:  20, goal: 1,    stat: function (s) { return s.totJumps; }, go: 'free' },
  { id: 'jump50',   reward: 125, goal: 150,   stat: function (s) { return s.totJumps; }, go: 'free' },
  { id: 'saves10',  reward:  75, goal: 25,   stat: function (s) { return s.totSaves; }, go: 'free' },
  { id: 'wear3',    reward:  50, goal: 3,    stat: function (s) { return s.owned.length; }, go: 'shop' },
  { id: 'wearAll',  reward: 250, goal: 0,    stat: function (s) { return s.owned.length; }, go: 'shop' },

  /* Four systems went in without a single goal attached to them, so
     nothing ever asked you to go near a frozen find or a snow rush. */
  { id: 'find1',    reward:  75, goal: 1,    stat: function (s) { return s.totFinds; }, go: 'free' },
  { id: 'find10',   reward: 250, goal: 25,   stat: function (s) { return s.totFinds; }, go: 'free' },
  { id: 'rush5',    reward: 125, goal: 15,    stat: function (s) { return s.totRushes; }, go: 'free' },
  { id: 'smash50',  reward: 150, goal: 150,   stat: function (s) { return s.totSmashed; }, go: 'free' },
  { id: 'revive1',  reward:  50, goal: 1,    stat: function (s) { return s.totRevives; }, go: 'free' },
  { id: 'forks10',  reward: 140, goal: 30,   stat: function (s) { return s.totForks; }, go: 'free' },
  /* and the marked runs had none either, which is odd for the half of the
     game that has a finish line */
  { id: 'lines1',   reward:  60, goal: 1,    stat: function (s) { return linesDone(s); }, go: 'lines' },
  { id: 'linesAll', reward: 350, goal: 0,    stat: function (s) { return linesDone(s); }, go: 'lines' },
  { id: 'stars18',  reward:  600, goal: 0,   stat: function (s) { return starsTotal(s); }, go: 'stars' },
  /* Time Rush and the Daily Line, so the two newest ways to play each
     have something to reach for: distance against the clock, time
     earned back, and coming back day after day. */
  { id: 'rush500',  reward:  60, goal: 500,  stat: function (s) { return s.bestRush; }, go: 'rush' },
  { id: 'rush2000', reward: 200, goal: 3000, stat: function (s) { return s.bestRush; }, go: 'rush' },
  { id: 'clocks50', reward: 110, goal: 150,   stat: function (s) { return s.totClocks; }, go: 'rush' },
  { id: 'daily1',   reward:  50, goal: 1,    stat: function (s) { return s.dailyDays; }, go: 'daily' },
  { id: 'streak3',  reward: 125, goal: 3,    stat: function (s) { return s.dailyBest; }, go: 'daily' },
  { id: 'streak7',  reward: 350, goal: 7,    stat: function (s) { return s.dailyBest; }, go: 'daily' },
  /* Avalanche: holding the snow off for a distance, and the rings that
     did it. 1500 m is well past where a clean rider with no rings is
     caught (about 700), so it asks for rings taken, not just no mistakes. */
  { id: 'av500',    reward:  75, goal: 500,  stat: function (s) { return s.bestAv; }, go: 'avalanche' },
  { id: 'av1500',   reward: 225, goal: 2500, stat: function (s) { return s.bestAv; }, go: 'avalanche' },
  { id: 'avrings50',reward: 150, goal: 120,   stat: function (s) { return s.totAvRings; }, go: 'avalanche' },
  /* Six asked for by the owner (23 Nov 2026), at the END so the medals on
     everyone's card keep their numbers (skins.js medalsCode: room for 39,
     these make 39). Clean stretches within one run, a greedy run, a run of
     catches at x3 (twenty in a row), and the spans of ice of 1.3.5. */
  { id: 'dry500',   reward:  60, goal: 500,  stat: function (s) { return s.bestDry; }, go: 'free' },
  { id: 'clean1000',reward: 120, goal: 1000, stat: function (s) { return s.bestClean; }, go: 'free' },
  { id: 'gold5run', reward: 200, goal: 5,    stat: function (s) { return s.bestRunGold; }, go: 'free' },
  { id: 'combo3',   reward:  80, goal: 20,   stat: function (s) { return s.bestCombo; }, go: 'free' },
  { id: 'nosnow1500',reward: 125, goal: 1500, stat: function (s) { return s.bestNoSnow; }, go: 'free' },
  { id: 'spans10',  reward:  75, goal: 10,   stat: function (s) { return s.totSpans; }, go: 'free' }
];

/* ---- today's tasks ----
   Three small things to do today, picked from the date like the Daily
   Line, so everyone has the same three. Each is judged on one run's
   results; each pays when it is done, and all three pay a bonus. */
var TASK_POOL = [
  { id: 'fish30',  n: 30,   test: function (r) { return r.fish; }, go: 'free' },
  { id: 'fish60',  n: 60,   test: function (r) { return r.fish; }, go: 'free' },
  { id: 'rings5',  n: 5,    test: function (r) { return r.gates || 0; }, go: 'free' },
  { id: 'dist1000',n: 1000, test: function (r) { return r.mode !== 'rush' ? r.dist : 0; }, go: 'free' },
  { id: 'dist2500',n: 2500, test: function (r) { return r.mode !== 'rush' ? r.dist : 0; }, go: 'free' },
  { id: 'gold2',   n: 2,    test: function (r) { return r.gold || 0; }, go: 'free' },
  { id: 'jump3',   n: 3,    test: function (r) { return r.jumps || 0; }, go: 'free' },
  { id: 'rush400', n: 400,  test: function (r) { return r.mode === 'rush' ? r.dist : 0; }, go: 'rush' },
  { id: 'av400',   n: 400,  test: function (r) { return r.mode === 'avalanche' ? r.dist : 0; }, go: 'avalanche' },
  { id: 'clocks6', n: 6,    test: function (r) { return r.clocks || 0; }, go: 'rush' },
  { id: 'daily',   n: 1,    test: function (r) { return r.course === 'daily' && r.finished ? 1 : 0; }, go: 'daily' },
  { id: 'line',    n: 1,    test: function (r) { return r.course && r.course !== 'daily' && r.course !== 'tutorial' && r.finished ? 1 : 0; }, go: 'lines' },
  { id: 'smash5',  n: 5,    test: function (r) { return r.smashed || 0; }, go: 'free' }
];
var TASK_PAY = 50, TASK_BONUS = 100;
function tasksFor(key) {
  var R = dailyRng('tasks:' + key), pool = TASK_POOL.slice(), out = [];
  /* never two of the same kind (two fish counts, two distances) on one day */
  while (out.length < 3 && pool.length) {
    var t = pool.splice(Math.floor(R() * pool.length), 1)[0];
    var kind = t.id.replace(/\d+$/, '');
    if (out.some(function (o) { return o.id.replace(/\d+$/, '') === kind; })) continue;
    out.push(t);
  }
  return out;
}
/* Mark off whatever this run did. Returns the tasks newly done, and pays
   for them (and the bonus) into the purse. */
function tasksCheck(save, res, key) {
  if (!save.tasks || save.tasks.key !== key) save.tasks = { key: key, done: [] };
  var won = [];
  tasksFor(key).forEach(function (t) {
    if (save.tasks.done.indexOf(t.id) >= 0) return;
    if ((t.test(res) || 0) >= t.n) { save.tasks.done.push(t.id); save.fish += TASK_PAY; won.push(t); }
  });
  if (won.length && save.tasks.done.length === 3) save.fish += TASK_BONUS;
  return won;
}

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

/* Everything newly earned, in catalogue order. Nothing is paid here. */
function achCheck(save) {
  var won = [];
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    if (save.ach.indexOf(a.id) >= 0) continue;
    if (!achProgress(a, save).done) continue;
    save.ach.push(a.id);
    won.push(a);
  }
  return won;
}

/* Earned and not yet paid for. */
function achUnclaimed(save) {
  var out = [];
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    if (save.ach.indexOf(a.id) >= 0 && (save.claimed || []).indexOf(a.id) < 0) out.push(a);
  }
  return out;
}

/* Pay one trophy's fish into the purse, once. Returns what it paid. */
function achClaim(save, id) {
  if (!save.claimed) save.claimed = [];
  if (save.ach.indexOf(id) < 0 || save.claimed.indexOf(id) >= 0) return 0;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    if (ACHIEVEMENTS[i].id !== id) continue;
    save.claimed.push(id);
    save.fish += ACHIEVEMENTS[i].reward;
    return ACHIEVEMENTS[i].reward;
  }
  return 0;
}
