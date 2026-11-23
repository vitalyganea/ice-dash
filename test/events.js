/* ===========================================================
   events.js — an event's days, its gifts and its steps
   -----------------------------------------------------------
   The New Year event (js/events.js; the owner, 19 Nov 2026): Freeride
   lays gifts while it runs and nowhere else; they cost the hill nothing
   (the same hill with them or without); since 1.3.5 (the owner, 23 Nov
   2026: the 1,000 came in an hour) about 5 are gathered on a run of
   1,500 m, and the goal is 2,027; the event ends at midnight after its
   last day, local time.
   =========================================================== */
var fs = require('fs');
var H = require('./harness.js'); var G = global.Game;
eval(fs.readFileSync(__dirname + '/../js/events.js', 'utf8'));
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

console.log('the days');
var NY = eventById('ny2027');
ok(!!NY && NY.goal === 2027 && NY.stages.length === 4 && NY.stages[3].n === 2027 && NY.stages[3].frame === 'wreath',
   'the New Year event: 2,027 gifts in four steps, the wreath on the last');
ok(NY.stages.every(function (st, i) { return i === 0 || st.n > NY.stages[i - 1].n; }), 'its steps climb');
var lastDay = new Date(2027, 0, 7, 23, 59).getTime(), after = new Date(2027, 0, 8, 0, 1).getTime();
ok(eventOn(NY, lastDay) && !eventOn(NY, after), 'on all of 7 January, over a minute after midnight');
var L = eventLeft(NY, new Date(2027, 0, 5, 12, 30).getTime());
ok(L.d === 2 && L.h === 11, 'left on 5 January at 12:30: 2 d 11 h (' + L.d + ' d ' + L.h + ' h)');
ok(liveEvent(after) === null && liveEvent(lastDay) === NY, 'nothing live after it');
var sv = { ev: {} };
eventState(sv, NY).g = 1520; eventState(sv, NY).got = [0];
ok(JSON.stringify(eventOwed(sv, NY)) === '[1,2]', 'reached and not claimed: the 1,000 and the 1,500 (' + JSON.stringify(eventOwed(sv, NY)) + ')');
/* a save from before 1.3.5 that had claimed the wreath at 1,000 keeps it claimed */
var old = { ev: { ny2027: { g: 1000, got: [0, 1, 2, 3] } } };
ok(eventOwed(old, NY).length === 0, 'a step claimed under the old numbers stays claimed (the wreath with it)');
ok(eventShown(sv, after) === NY && eventShown({ ev: {} }, after) === null, 'after the end it stays only while a prize waits');

console.log('the gifts on the hill');
var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
function steer(W) {
  var row = null; for (var i = 0; i < W.rows.length; i++) if (W.rows[i].d > W.dist + 30) { row = W.rows[i]; break; }
  if (!row) return;
  var target = G._chuteAt(row.d) + row.gap, fr = Math.max(1, Math.round((row.d - W.dist) / W.speed));
  function miss(dir) { var x = W.px, vx = W.vx; for (var k = 0; k < fr; k++) { vx += (dir * K.DRIFT * W.speed - vx) * K.TURN; x += vx; } return Math.abs(x - target); }
  if (miss(-W.dir) < miss(W.dir) - 6) G.tap();
}
/* a run to `m` metres: what was laid, and (with `take`) what a rider who
   leans for the nearest gift in the next opening picked up */
function run(seed, opts, m, course, take) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', course || null, 0, opts);
  var laid = new Set(), solids = [];
  for (var f = 0; f < 200000; f++) {
    var W = G.debug(); if (!W || W.state !== 'run') { if (W && W.state === 'crash') { W.lives = 9; try { G.revive(); } catch (e) {} continue; } break; }
    W.invuln = 30;
    if (take) {
      var g = null; W.objects.forEach(function (o) { if (o.t === 'gift' && !o.got && o.d > W.dist && o.d < W.dist + 260 && (!g || o.d < g.d)) g = o; });
      if (g) { var fr = Math.max(1, Math.round((g.d - W.dist) / W.speed)), x = W.px, vx = W.vx;
               for (var k = 0; k < fr; k++) { vx += (W.dir * K.DRIFT * W.speed - vx) * K.TURN; x += vx; }
               if ((g.x - x) * W.dir < -10) G.tap(); }
      else steer(W);
    } else steer(W);
    H.frames(1);
    W = G.debug(); if (!W) break;
    W.objects.forEach(function (o) { if (o.t === 'gift') laid.add(o); if ((o.t === 'rock' || o.t === 'tree') && !o._seen) { o._seen = 1; solids.push(Math.round(o.x) + ',' + Math.round(o.d)); } });
    if (W.state === 'finish' || W.dist >= m * 8) break;
  }
  var res = { laid: laid.size, got: G.debug() ? G.debug().gifts : 0, solids: solids.join(';'), m: Math.round((G.debug() || {}).dist / 8) };
  G.stop();
  return res;
}
var on = run(31, { gifts: true }, 3000), off = run(31, {}, 3000);
ok(on.laid > 0 && off.laid === 0, 'gifts in Freeride only with the event on (' + on.laid + ' laid in ' + on.m + ' m; none without)');
ok(on.solids === off.solids, 'the same hill with the gifts or without (boulders and trees in the very same places)');
['rush', 'avalanche'].forEach(function (md) { ok(run(31, { gifts: true, mode: md }, 1500).laid === 0, 'none in ' + md); });
ok(run(31, { gifts: true }, 1500, 'firstlight').laid === 0 && run(31, { gifts: true }, 1500, 'daily').laid === 0, 'none on a Known Line or the Daily Line');
/* the pace: about 5 on a run of 1,500 m for a rider who goes for them
   (1.3.5; was about 25) */
var tot = 0, laidTot = 0;
[41, 42, 43, 44].forEach(function (sd) { var r = run(sd, { gifts: true }, 1500, null, true); tot += r.got; laidTot += r.laid; });
var per = tot / 4;
ok(per >= 3.5 && per <= 8, 'a rider who goes for them gathers ' + per.toFixed(1) + ' on 1,500 m (of ' + (laidTot / 4).toFixed(1) + ' laid): the 2,027 in about ' + Math.round(2027 / per) + ' runs');

console.log(fail ? fail + ' FAILURE(S)' : 'event checks passed');
process.exit(fail ? 1 : 0);
