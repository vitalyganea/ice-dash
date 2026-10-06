/* ===========================================================
   economy.js — is the shop reachable, and does it stay interesting?
   -----------------------------------------------------------
   Measures what each kind of player earns per run WITH a given skin on,
   then walks the catalogue in price order to see how many runs each
   purchase actually costs them. A shop nobody can afford is a wall; a
   shop cleared in three runs is not a shop.
   =========================================================== */
var H = require('./harness.js');
/* the trophies and today's tasks: they pay into the same purse as runs do */
eval(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'achievements.js'), 'utf8')); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K0 = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K0.DRIFT, TURN = K0.TURN;

/* Prices are decided by the people who have to save up, and their runs are
   short enough to simulate. A practised player clears anything eventually. */
var PROFILES = {
  'first-timer': { aim: 110, hold: 34, react: 16, fumble: 0.22, dead: 22 },
  'casual':      { aim:  70, hold: 26, react: 11, fumble: 0.12, dead: 14 }
};

function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
/* The bot has to predict with the turn rate the game is ACTUALLY using,
   perk and biome included. Predicting with the bare constant made a
   sharper-turning skin look worse than no skin at all: the bot oversteered
   every gap and blamed the fox. */
function miss(W, dir, fr, t) {
  var x = W.px, v = W.vx, tr = G._turnRate();
  for (var k = 0; k < fr; k++) { v += (dir * DRIFT * W.speed - v) * tr; x += v; }
  return Math.abs(x - t);
}

function run(seed, P, skinId) {
  H.setSeed(seed); G.start(0, {}, skinId);
  var cool = 0, aim = 0, reRoll = 0;
  for (var f = 0; f < 30000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    if (cool > 0) cool--;
    else {
      var row = nextRow(W);
      if (row) {
        if (--reRoll <= 0) { aim = (Math.random() - 0.5) * P.aim; reRoll = P.hold; }
        var t = G._chuteAt(row.d) + row.gap;
        var fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
        if (miss(W, -W.dir, fr, t) < miss(W, W.dir, fr, t) - P.dead) {
          if (Math.random() < P.fumble) cool = P.react + 4;
          else { G.tap(); cool = P.react; }
        }
      }
    }
    H.frames(1);
  }
  var W2 = G.debug();
  var o = W2 ? { coins: W2.coins, gold: W2.gold, dist: Math.floor(W2.dist / 8) }
             : { coins: 0, gold: 0, dist: 0 };
  G.stop();
  return o;
}

function earnRate(name, skinId, n) {
  var c = 0, g = 0, d = 0;
  for (var i = 0; i < n; i++) {
    var r = run(7000 + i * 53, PROFILES[name], skinId);
    c += r.coins; g += r.gold; d += r.dist;
  }
  return { coins: c / n, gold: g / n, dist: Math.round(d / n) };
}

var N = 12;
console.log('Coins per run (average of ' + N + ')\n');
console.log('  ' + 'profile'.padEnd(13) + SKINS.map(function (s) {
  return s.id.padStart(9);
}).join('') + '     dist(base)');

var table = {};
Object.keys(PROFILES).forEach(function (name) {
  table[name] = {};
  var row = '  ' + name.padEnd(13);
  SKINS.forEach(function (sk) {
    /* The first-timer dies early and wildly, so eight runs cannot tell a
       real difference from the noise: the shield came out looking as if it
       SHORTENED a run, which it cannot do. Their runs are short, so more
       of them is cheap. */
    var r = earnRate(name, sk.id, name === 'first-timer' ? 24 : N);
    table[name][sk.id] = r;
    row += String(Math.round(r.coins)).padStart(9);
  });
  row += '     ' + table[name].snowcap.dist + 'm';
  console.log(row);
});

/* Walk the catalogue in price order the way a player would: earn with what
   you are wearing, buy the next thing, wear it, carry on. */
console.log('\nRuns needed to buy each fish-priced skin, in order, wearing the newest\n');
/* Fish and gold are not the same money. Walking the catalogue by raw price
   put the 8-gold polar bear first, ahead of a 100-fish penguin. */
var order = SKINS.filter(function (s) { return s.price > 0 && s.currency === 'fish'; })
                 .sort(function (a, b) { return a.price - b.price; });
var worstFirst = 0, totalRuns = {};
Object.keys(PROFILES).forEach(function (name) {
  var wearing = 'snowcap', purse = 0, runs = 0, parts = [];
  order.forEach(function (sk) {
    var per = table[name][wearing].coins;
    var need = sk.price - purse;
    var r = Math.max(1, Math.ceil(need / Math.max(1, per)));
    runs += r; purse = purse + r * per - sk.price;
    parts.push(sk.name + ' after ' + r + ' run' + (r > 1 ? 's' : ''));
    wearing = sk.id;
  });
  totalRuns[name] = runs;
  if (name === 'first-timer') worstFirst = parseInt(parts[0].match(/after (\d+)/)[1], 10);
  console.log('  ' + name.padEnd(13) + parts.join(',  ') + '   (' + runs + ' runs for all)');
});

console.log('');
ok(worstFirst <= 6,
   'a first-timer earns their first skin in ' + worstFirst + ' runs');
ok(totalRuns['first-timer'] >= 12,
   'the catalogue is not cleared instantly by a beginner (' + totalRuns['first-timer'] + ' runs)');
ok(totalRuns['casual'] >= 10,
   'a competent player still works for the set (' + totalRuns['casual'] + ' runs)');
ok(table['casual'].mitten.coins > table['casual'].snowcap.coins,
   'the reach perk actually earns more (' + Math.round(table['casual'].mitten.coins) +
   ' vs ' + Math.round(table['casual'].snowcap.coins) + ' coins)');
ok(table['casual'].compass.coins > table['casual'].snowcap.coins,
   'the shoal perk actually earns more (' + Math.round(table['casual'].compass.coins) +
   ' vs ' + Math.round(table['casual'].snowcap.coins) + ')');
ok(table['casual'].walrus.coins > table['casual'].snowcap.coins,
   'the gate perk actually earns more (' + Math.round(table['casual'].walrus.coins) +
   ' vs ' + Math.round(table['casual'].snowcap.coins) + ')');
ok(table['casual'].seal.gold >= table['casual'].snowcap.gold,
   'the gold perk finds more golden fish (' + table['casual'].seal.gold.toFixed(2) +
   ' vs ' + table['casual'].snowcap.gold.toFixed(2) + ')');
ok(table['first-timer'].bubbles.dist > table['first-timer'].snowcap.dist,
   'the shield perk actually keeps a weak player alive longer (' +
   table['first-timer'].bubbles.dist + 'm vs ' + table['first-timer'].snowcap.dist + 'm)');

/* ---- everything a player is paid, not only what runs pay ----
   Trophies, today's tasks and frozen finds all feed the same purse. Left
   out of the reckoning, they quietly bought half the Market in ten minutes
   once there were enough of them. A casual player's first half-hour or so
   is counted here with all of it in: the run pay measured above, the easy
   trophies anyone collects early, one day's tasks, and a find or two. */
(function () {
  var easy = ['first', 'dist500', 'runfish30', 'fish500', 'gold1', 'jump1', 'wear3', 'find1',
              'lines1', 'revive1', 'rush5', 'daily1', 'rush500', 'av500', 'smash50'];
  var trophies = ACHIEVEMENTS.filter(function (a) { return easy.indexOf(a.id) >= 0; })
                             .reduce(function (t, a) { return t + a.reward; }, 0);
  var tasks = TASK_PAY * 3 + TASK_BONUS, finds = 2 * 73;      // a find pays about 73 fish on average
  var fishSkins = SKINS.filter(function (sk) { return sk.currency === 'fish' && sk.price > 0; })
                       .sort(function (x, y) { return x.price - y.price; });
  var half = fishSkins.slice(0, Math.ceil(fishSkins.length / 2))
                      .reduce(function (t, sk) { return t + sk.price; }, 0);
  var perRun = table['casual'].mitten.coins;                  // what he rides once the first is bought
  var runs = Math.ceil(Math.max(0, half - trophies - tasks - finds) / perRun);
  /* a casual run's length in seconds, from its distance and the hill's ramp */
  var D = table['casual'].snowcap.dist * 8;
  var secs = Math.log((3 + 0.000155 * D) / 3) / 0.000155 / 60;
  var minutes = Math.round(runs * secs / 60);
  console.log('\nFirst half of the Market (' + half + ' fish) for a casual player, everything counted:');
  console.log('  ' + trophies + ' from early trophies, ' + tasks + ' from a day\'s tasks, ' + finds +
              ' from finds, the rest at ' + Math.round(perRun) + ' a run: ' + runs + ' runs of ~' + Math.round(secs) + ' s');
  ok(minutes >= 25 && minutes <= 60, 'it takes about ' + minutes + ' minutes of play, not ten');
})();

/* The two "a dearer skin must be a better skin" checks used to sit here and
   have moved to ladder.js. They could not be answered on the 12 and 24
   samples this suite can afford: a run's distance has a standard deviation
   near 600m on a mean near 1000, so 24 samples resolve it to about ±24%,
   while the fault they exist to catch showed as 0.88 against a healthy
   1.03. They passed and failed at random on code that had not changed,
   which is worse than not checking at all — a test that cries wolf gets
   ignored, and then it is there for the real one.

   ladder.js runs them on 60 samples each and reports the gap in sigma. */

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'economy checks passed'));
process.exit(fail ? 1 : 0);
