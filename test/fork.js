/* ===========================================================
   fork.js — both ways past the spine have to be ways past it
   -----------------------------------------------------------
   A nunatak splits the run in two. The whole point is that the lane the
   spawner did NOT point you down is open as well — otherwise the fork is
   not a bet, it is a trap with a gold fish painted on it. Three things
   have to hold:

     A. geometry — two lanes, each wide enough to ride, neither of them
        sealed by a boulder, along the whole length of the rock;
     B. the tight lane — a player who goes after the gold gets through
        alive and can still make the opening the two lanes close on;
     C. the open lane — the ordinary aiming bot, which knows nothing about
        forks, is never killed by one.
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var K = (H.setSeed(1), G.start(0, {}), G._consts()); G.stop();
var CHUTE = K.CHUTE, PR = K.PR, DRIFT = K.DRIFT;
var SEEDS = [300, 397, 494, 591, 688, 785, 882, 979], CAP = 13000;

function nextRow(W) {
  for (var i = 0; i < W.rows.length; i++) if (W.rows[i].d > W.dist + 30) return W.rows[i];
  return null;
}
function aimAt(W, target, atD) {
  var fr = Math.max(1, Math.round((atD - W.dist) / W.speed));
  function m(dir) {
    var x = W.px, v = W.vx, tr = G._turnRate();
    for (var k = 0; k < fr; k++) { v += (dir * DRIFT * W.speed - v) * tr; x += v; }
    return Math.abs(x - target);
  }
  if (m(-W.dir) < m(W.dir) - 6) G.tap();
}
function steer(W) { var r = nextRow(W); if (r) aimAt(W, G._chuteAt(r.d) + r.gap, r.d); }

/* The two lanes, in absolute world x, at a point down the rock. */
function lanes(o, dd) {
  var base = G._chuteAt(dd), c = base + o.rel, h = G._nunHalf(o, dd);
  return [{ lo: base - CHUTE, hi: c - h }, { lo: c + h, hi: base + CHUTE }];
}
/* Which of them is the tight one — the one the gold is down. */
function tightSide(o) {
  var l = lanes(o, o.d + o.span * 0.5);
  return (l[0].hi - l[0].lo) < (l[1].hi - l[1].lo) ? 0 : 1;
}
/* The line the gold is actually on: right alongside the rock on the tight
   side, not out in the middle of that lane. */
function goldLine(o, dd) {
  var side = tightSide(o) === 0 ? -1 : 1;
  return G._chuteAt(dd) + o.rel + side * (G._nunHalf(o, o.d + o.span * 0.5) + PR * 1.05);
}
function spineAhead(W, from, to) {
  for (var i = 0; i < W.objects.length; i++) {
    var o = W.objects[i];
    if (o.t === 'nunatak' && W.dist > o.d - from && W.dist < o.d + o.span + to) return o;
  }
  return null;
}

/* One ride. `greedy` sends him down the tight lane whenever a rock turns
   up; otherwise he plays the hill as it is pointed out to him. */
function ride(seed, greedy, collect) {
  H.setSeed(seed);
  G.start(0, {}, 'snowcap', null, 0);
  var met = 0, cleared = 0, rejoined = 0, diedAtFork = 0, inside = null;
  for (var f = 0; f < CAP; f++) {
    var W = G.debug();
    if (!W || W.state !== 'run') { if (inside) diedAtFork++; break; }
    /* Seen early: he has to pick a lane before the rock is alongside him,
       which is exactly what the run-in is there for. */
    /* 300 units of run-in is what the hill gives you between the row and
       the rock, and the row has to be ridden first — so the lane is picked
       at the same moment a player would pick it, not before. */
    var spine = spineAhead(W, 300, 0);
    if (spine) {
      if (inside !== spine) {
        inside = spine; met++;
        if (collect) {
          collect.push({ rel: spine.rel, d: spine.d, span: spine.span,
                         w: spine.w, ph: spine.ph,
                         el: spine.el.slice(), er: spine.er.slice(),
                         solids: W.objects.filter(function (q) {
                           return (q.t === 'rock' || q.t === 'tree') &&
                                  q.d > spine.d - 40 && q.d < spine.d + spine.span + 40;
                         }).map(function (q) { return { x: q.x, d: q.d, r: q.r }; }) });
        }
      }
      if (greedy) {
        var at = Math.max(spine.d + spine.span * 0.5, W.dist + 110);
        aimAt(W, goldLine(spine, at), at);
      } else steer(W);
    } else {
      if (inside) {
        cleared++;
        var nr = nextRow(W);
        if (!nr) rejoined++;
        else {
          /* Everywhere he could be by then, not one place: holding the tap
             he has and holding the other one bracket the whole reachable
             stretch. Asking whether ONE of those two lands dead on the
             opening fails him for being able to overshoot it. */
          var want = G._chuteAt(nr.d) + nr.gap;
          var fr = Math.max(1, Math.round((nr.d - W.dist) / W.speed));
          function land(dir) {
            var x = W.px, v = W.vx, tr = G._turnRate();
            for (var k = 0; k < fr; k++) { v += (dir * DRIFT * W.speed - v) * tr; x += v; }
            return x;
          }
          var a1 = land(-1), b1 = land(1);
          if (Math.min(a1, b1) <= want + nr.gapW / 2 &&
              Math.max(a1, b1) >= want - nr.gapW / 2) rejoined++;
        }
        inside = null;
      }
      steer(W);
    }
    H.frames(1);
  }
  var e = G.debug(); var dist = e ? e.dist : 0; G.stop();
  return { met: met, cleared: cleared, rejoined: rejoined,
           died: diedAtFork, dist: dist };
}

/* ---------------------------------------------------------------- A */
console.log('A. the rock leaves two ways past it\n');

var found = [], openMet = 0, openDied = 0, openDist = 0;
SEEDS.forEach(function (sd) {
  var R = ride(sd, false, found);
  openMet += R.met; openDied += R.died; openDist += R.dist / 8;
});
ok(found.length >= 8, 'the hill puts out forks (' + found.length +
                      ' over ' + SEEDS.length + ' runs)');

var narrow = 0, sealed = 0, tightest = 1e9, widest = 0;
found.forEach(function (o) {
  for (var u = 0.1; u <= 0.9; u += 0.05) {
    var dd = o.d + o.span * u;
    if (G._nunHalf(o, dd) * 2 > widest) widest = G._nunHalf(o, dd) * 2;
    lanes(o, dd).forEach(function (w) {
      var wide = w.hi - w.lo;
      if (wide < tightest) tightest = wide;
      if (wide < PR * 2 + 12) narrow++;
      var blocked = o.solids.some(function (q) {
        if (Math.abs(q.d - dd) > q.r + PR) return false;
        var free = Math.max(0, Math.min(w.hi, q.x - q.r - PR * 0.6) - w.lo) +
                   Math.max(0, w.hi - Math.max(w.lo, q.x + q.r + PR * 0.6));
        var overlaps = q.x + q.r > w.lo && q.x - q.r < w.hi;
        return overlaps && free < PR * 2;
      });
      if (blocked) sealed++;
    });
  }
});
ok(narrow === 0, 'every lane is wide enough to ride (' + narrow +
                 ' too narrow, tightest ' + tightest.toFixed(0) + 'px vs penguin ' +
                 (PR * 2) + 'px)');
ok(sealed === 0, 'nothing is standing in either of them (' + sealed + ' sealed)');
ok(widest > 80, 'and the rock is a real obstacle (widest ' + widest.toFixed(0) + 'px)');

/* ---------------------------------------------------------------- C */
console.log('\nB. a fork never kills a player who just rides past it\n');
ok(openMet >= 8, 'the plain aiming bot meets forks (' + openMet + ')');
ok(openDied === 0, 'and none of them is what ends its run (' + openDied + ')');
ok(openDist / SEEDS.length > 2000,
   'its runs are still runs (' + Math.round(openDist / SEEDS.length) + 'm average)');

/* ---------------------------------------------------------------- B */
console.log('\nC. the tight lane, the one with the gold down it\n');

/* First the line itself, ridden exactly — held on the gold line frame by
   frame with no steering error at all. That is the fairness question, and
   it has to come out clean: if the line the gold sits on is ever inside
   the rock, the fork is a trap however well you play it. */
var railMet = 0, railDied = 0;
SEEDS.forEach(function (sd) {
  H.setSeed(sd);
  G.start(0, {}, 'snowcap', null, 0);
  var on = null;
  for (var f = 0; f < CAP; f++) {
    var W = G.debug();
    if (!W || W.state !== 'run') { if (on) railDied++; break; }
    var sp = spineAhead(W, 0, 0);
    if (sp) {
      if (on !== sp) { on = sp; railMet++; }
      W.px = goldLine(sp, W.dist); W.vx = 0;
    } else { on = null; steer(W); }
    H.frames(1);
  }
  G.stop();
});
ok(railMet >= 8, 'the gold line gets ridden (' + railMet + ' forks)');
ok(railDied === 0,
   'held exactly, it is never the rock that ends the run (' + railDied + ' deaths)');

/* Then the same line ridden the way anyone actually rides it — aimed at,
   tap by tap, with the overshoot that comes with that. It is allowed to
   cost you runs: it is the risky side and the gold is what it pays. What
   it may not do is cost you most of them. */
var gMet = 0, gCleared = 0, gRejoined = 0, gDied = 0;
SEEDS.forEach(function (sd) {
  var R = ride(sd, true, null);
  gMet += R.met; gCleared += R.cleared; gRejoined += R.rejoined; gDied += R.died;
});
ok(gMet >= 8, 'the greedy line gets taken (' + gMet + ' forks entered)');
ok(gCleared >= Math.ceil(gMet * 0.8),
   'and a tap-by-tap attempt usually comes out the far end (' +
   gCleared + '/' + gMet + ')');
ok(gRejoined >= Math.ceil(gCleared * 0.95),
   'the closing opening is in reach from it (' + gRejoined + '/' + gCleared + ')');

console.log('');
if (fail) { console.log(fail + ' FAILURE(S)'); process.exit(1); }
console.log('fork checks passed');
