/* ===========================================================
   album.js — three stories for every creature
   -----------------------------------------------------------
   Each creature has three chapters, opened by riding with it: the first
   run together, a distance together, and a feat that belongs to that
   creature's own perk (the seal's golden fish, the walrus's rings). The
   point is a reason to take every creature out, not only the best one.

   What a chapter needs is read from running totals kept per creature in
   the save (`save.album[id]`), added to after every run, the same way the
   trophies read theirs. A chapter opened pays fish once.
   =========================================================== */

var ALBUM_PAY = [40, 80, 150];

/* the third chapter: the feat that is this creature's own */
var ALBUM_FEAT = {
  snowcap:  { stat: 'dist',    n: 5000 },
  mitten:   { stat: 'fish',    n: 300 },
  puffin:   { stat: 'combo',   n: 40 },
  seal:     { stat: 'gold',    n: 15 },
  lemming:  { stat: 'daily',   n: 3 },
  muskox:   { stat: 'dist',    n: 8000 },
  bubbles:  { stat: 'saved',   n: 5 },
  otter:    { stat: 'clocks',  n: 30 },
  hare:     { stat: 'bestRun', n: 3000 },
  leopard:  { stat: 'closes',  n: 25 },
  compass:  { stat: 'fish',    n: 500 },
  owl:      { stat: 'bestRun', n: 2000 },
  walrus:   { stat: 'gates',   n: 40 },
  narwhal:  { stat: 'jumps',   n: 15 },
  reindeer: { stat: 'lines',   n: 3 },
  emperor:  { stat: 'combo',   n: 60 },
  orca:     { stat: 'jumps',   n: 10 },
  aurora:   { stat: 'dist',    n: 5000 }
};

function albumGoals(id) {
  return [{ stat: 'runs', n: 1 }, { stat: 'dist', n: 2000 },
          ALBUM_FEAT[id] || { stat: 'dist', n: 5000 }];
}

function albumOf(save, id) {
  if (!save.album) save.album = {};
  var a = save.album[id];
  if (!a) a = save.album[id] = { runs: 0, dist: 0, fish: 0, gold: 0, gates: 0, jumps: 0, saved: 0,
                                 clocks: 0, closes: 0, daily: 0, lines: 0, bestRun: 0, combo: 0, got: 0 };
  return a;
}

/* A finished run, added to the totals of the creature that rode it. The
   tutorial does not count: nobody chose the creature for it. */
function albumAdd(save, id, res) {
  if (!res || res.course === 'tutorial') return;
  var a = albumOf(save, id);
  a.runs++;
  a.dist += res.dist || 0;
  a.fish += res.fish || 0;
  a.gold += res.gold || 0;
  a.gates += res.gates || 0;
  a.jumps += res.jumps || 0;
  a.saved += res.saved || 0;
  a.clocks += res.clocks || 0;
  a.closes += res.closes || 0;
  if (res.finished && res.course === 'daily') a.daily++;
  else if (res.finished && res.course) a.lines++;
  a.bestRun = Math.max(a.bestRun, res.dist || 0);
  a.combo = Math.max(a.combo, res.comboBest || 0);
}

function albumProgress(save, id, i) {
  var g = albumGoals(id)[i], a = albumOf(save, id);
  var cur = a[g.stat] || 0;
  return { stat: g.stat, n: g.n, cur: Math.min(cur, g.n), done: cur >= g.n, open: (a.got || 0) > i };
}

/* Chapters newly opened for this creature, in order, each paid once into
   the purse. `got` is how many are open: they open in order, so a third
   chapter waits for the second even if its feat is already done. */
function albumCheck(save, id) {
  var a = albumOf(save, id), won = [];
  while ((a.got || 0) < 3 && albumProgress(save, id, a.got || 0).done) {
    var i = a.got || 0;
    a.got = i + 1;
    save.fish += ALBUM_PAY[i];
    won.push({ id: id, chapter: i, pay: ALBUM_PAY[i] });
  }
  return won;
}
