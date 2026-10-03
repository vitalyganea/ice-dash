/* ===========================================================
   daily.js — is every day's line a fair one?
   -----------------------------------------------------------
   The Daily Line is written by a generator from the date, so nobody has
   looked at any particular day of it. A whole year of dates goes through
   the same proof the marked runs do, and a sample of days is ridden to
   the finish. A day must also be the same line every time it is asked
   for, on any device, and the next day a different one.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var DRIFT = K.DRIFT, TURN = K.TURN;

function achievable(step, speed, grip) {
  var fr = Math.max(1, Math.floor(step / speed));
  var t = TURN * grip, x = 0, vx = -DRIFT * speed;
  for (var k = 0; k < fr; k++) { vx += (DRIFT * speed - vx) * t; x += vx; }
  return x;
}
function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++)
    if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
function steer(W) {
  var r = nextRow(W); if (!r) return;
  var t = G._chuteAt(r.d) + r.gap;
  var fr = Math.max(1, Math.round((r.d - W.dist) / W.speed));
  var tr = G._turnRate();
  function m(d) { var x = W.px, v = W.vx;
    for (var k = 0; k < fr; k++) { v += (d * DRIFT * W.speed - v) * tr; x += v; }
    return Math.abs(x - t); }
  if (m(-W.dir) < m(W.dir) - 6) G.tap();
}

/* ---- A. a year of days, every row possible ----------------- */
console.log('A. a whole year of Daily Lines is inside the physics');
var bad = 0, worst = 1e9, worstKey = '', biomes = {}, keys = [];
var d0 = new Date(2026, 0, 1);
for (var day = 0; day < 366; day++) {
  var dt = new Date(d0); dt.setDate(d0.getDate() + day);
  var key = dailyKey(dt); keys.push(key);
  var cd = dailyCourse(key);
  biomes[cd.biome] = 1;
  var rows = parseCourse(cd, K.CHUTE), grip = BIOMES[cd.biome % BIOMES.length].grip;
  for (var i = 1; i < rows.length; i++) {
    var speed = Math.min(K.SPEED_MAX, 3.0 + (320 + i * cd.step) * 0.000155);
    var need = Math.abs(rows[i].gap - rows[i - 1].gap), can = achievable(cd.step, speed, grip);
    if (need > can) bad++;
    if (can - need < worst) { worst = can - need; worstKey = key + ' row ' + i; }
  }
}
ok(bad === 0, '366 days, ' + bad + ' impossible rows (tightest margin ' + worst.toFixed(1) + 'px, ' + worstKey + ')');
ok(Object.keys(biomes).length >= 6, 'and the days move round the mountain (' + Object.keys(biomes).length + ' different stretches)');

/* ---- B. the same day is the same line ----------------------- */
console.log('\nB. one day, one line');
ok(dailyCourse('2026-10-03').script === dailyCourse('2026-10-03').script, 'asking twice gives the same line');
H.setSeed(5); var a1 = dailyCourse('2026-10-03').script;
H.setSeed(99); var a2 = dailyCourse('2026-10-03').script;
ok(a1 === a2, 'whatever the game\'s own dice are doing');
var distinct = {}; keys.forEach(function (k) { distinct[dailyCourse(k).script] = 1; });
ok(Object.keys(distinct).length === keys.length, 'and every day of the year is a different line');
ok(dailyPrevKey('2026-03-01') === '2026-02-28' && dailyPrevKey('2027-01-01') === '2026-12-31',
   'yesterday is worked out properly across months and years');

/* ---- C. ridden to the finish --------------------------------- */
console.log('\nC. a competent rider finishes a sample of days');
var fin = 0, tried = 0, fishOk = 0;
for (var s = 0; s < 8; s++) {
  var k2 = keys[(s * 47) % keys.length];
  var real = dailyCourse;
  global.dailyCourse = dailyCourse;
  /* ride that day: courseById('daily') means today, so the engine is
     handed the day's course directly through a temporary id */
  var cdx = dailyCourse(k2); cdx.id = 'daily-test';
  COURSES.push(cdx);
  H.setSeed(300 + s);
  G.start(0, {}, 'snowcap', 'daily-test');
  for (var f = 0; f < 40000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') break;
    steer(W); H.frames(1);
  }
  var W2 = G.debug();
  tried++;
  if (W2 && W2.state === 'finish') fin++;
  if (W2 && W2.fishTotal >= 12) fishOk++;
  G.stop();
  COURSES.pop();
}
ok(fin === tried, 'finished ' + fin + ' of ' + tried + ' days');
ok(fishOk === tried, 'and every one holds enough fish for its stars (' + fishOk + '/' + tried + ')');

/* ---- D. today's tasks ------------------------------------------ */
console.log('\nD. today\'s tasks');
var fs = require('fs');
eval(fs.readFileSync(require('path').join(__dirname, '..', 'js', 'achievements.js'), 'utf8'));
var kindsOk = true, sameOk = true;
keys.forEach(function (k) {
  var t1 = tasksFor(k), t2 = tasksFor(k);
  if (t1.map(function (x) { return x.id; }).join() !== t2.map(function (x) { return x.id; }).join()) sameOk = false;
  var kinds = t1.map(function (x) { return x.id.replace(/\d+$/, ''); });
  if (t1.length !== 3 || kinds.some(function (x, i) { return kinds.indexOf(x) !== i; })) kindsOk = false;
});
ok(sameOk, 'a day always has the same three tasks');
ok(kindsOk, 'always three, never two of the same kind, all year');
var day = keys[100], tk = tasksFor(day);
var sv = { fish: 0, tasks: null };
/* a result that does everything any task could ask for */
var big = { fish: 99, gates: 9, dist: 3000, gold: 5, jumps: 5, clocks: 9, smashed: 9,
            mode: 'free', course: null, finished: false };
var won = tasksCheck(sv, big, day);
var expect = tk.filter(function (t) { return (t.test(big) || 0) >= t.n; }).length;
ok(won.length === expect && sv.fish === expect * TASK_PAY + (expect === 3 ? TASK_BONUS : 0),
   'a run pays for what it did (' + won.length + ' done, ' + sv.fish + ' fish)');
ok(tasksCheck(sv, big, day).length === 0, 'and the same task never pays twice');
ok(tasksCheck(sv, big, keys[101]).length >= 0 && sv.tasks.key === keys[101], 'tomorrow starts afresh');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'daily line checks passed'));
process.exit(fail ? 1 : 0);
