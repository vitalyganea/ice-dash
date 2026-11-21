/* ===========================================================
   events.js — a stretch of days with a goal of its own
   -----------------------------------------------------------
   An event runs until the end of its last day on the player's own clock
   (as the Daily Line does). While it runs, Freeride lays its pickups
   (game.js, `gifts`); what a run collects is added to the event's count
   in the save (`save.ev[id].g`), and each step reached has a prize to
   claim (`save.ev[id].got`, the steps claimed). Claiming stays open after
   the end for any step reached in time.

   The New Year event (asked for by the owner, 19 Nov 2026): from the
   update until 7 January 2027, 1,000 gifts in Freeride in four steps, the
   last with an exclusive avatar frame, the wreath. Gifts count only here:
   no points, no fish, so the boards and the market are as they were.
   =========================================================== */
var EVENTS = [
  { id: 'ny2027', name: 'ny', ends: [2027, 0, 7], goal: 1000,
    stages: [
      { n: 250,  fish: 500 },
      { n: 500,  fish: 1000 },
      { n: 750,  gold: 20 },
      { n: 1000, fish: 3000, gold: 50, frame: 'wreath' }
    ] }
];

/* the moment it is over: midnight after its last day, local time */
function eventEnd(ev) { return new Date(ev.ends[0], ev.ends[1], ev.ends[2] + 1).getTime(); }
function eventOn(ev, now) { return (now === undefined ? Date.now() : now) < eventEnd(ev); }
/* what is left, as whole days and hours (rounded down: never promises an
   hour that is not there) */
function eventLeft(ev, now) {
  var ms = Math.max(0, eventEnd(ev) - (now === undefined ? Date.now() : now));
  return { d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), ms: ms };
}
/* the event Freeride is laying pickups for now, if any */
function liveEvent(now) {
  for (var i = 0; i < EVENTS.length; i++) if (eventOn(EVENTS[i], now)) return EVENTS[i];
  return null;
}
function eventById(id) {
  for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return EVENTS[i];
  return null;
}
/* a player's standing in it, made if missing */
function eventState(save, ev) {
  if (!save.ev || typeof save.ev !== 'object') save.ev = {};
  var s = save.ev[ev.id];
  if (!s) s = save.ev[ev.id] = { g: 0, got: [] };
  return s;
}
/* steps reached and not yet claimed */
function eventOwed(save, ev) {
  var s = eventState(save, ev), out = [];
  ev.stages.forEach(function (st, i) { if (s.g >= st.n && s.got.indexOf(i) < 0) out.push(i); });
  return out;
}
/* shown in More modes and events: while it runs, and after it only while
   a prize reached in time waits to be claimed */
function eventShown(save, now) {
  for (var i = 0; i < EVENTS.length; i++) {
    var ev = EVENTS[i];
    if (eventOn(ev, now) || eventOwed(save, ev).length) return ev;
  }
  return null;
}

/* ---- The dragon's egg (1.3.4, asked for by the owner) ----
   Alongside the New Year: a Sakura Garden is the second stretch of every
   Freeride, and koi swim in it. Each day the first KOI_DAY koi caught feed
   the egg once; ten days fed and it hatches the dragon. A day missed is
   only a day later, never a step back. Feeding stays open until the end
   of its last day; hatching, for an egg fed in time, stays open after. */
var DRAGON = { id: 'dragon', ends: [2027, 0, 31], days: 10, perDay: 15 };
function dragonOn(now) { return eventOn(DRAGON, now); }
function dayKey(now) {
  var d = new Date(now === undefined ? Date.now() : now);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function dragonState(save) {
  if (!save.egg || typeof save.egg !== 'object') save.egg = { day: '', today: 0, fed: 0, hatched: false };
  return save.egg;
}
/* koi caught on a run: how many fed today, and whether today was finished
   by them (and so a day of the ten) */
function dragonFeed(save, n, now) {
  var E = dragonState(save), k = dayKey(now);
  if (E.hatched || E.fed >= DRAGON.days || !(n > 0)) return { add: 0, dayDone: false };
  if (E.day !== k) { E.day = k; E.today = 0; }
  var was = E.today, add = Math.min(n, DRAGON.perDay - was);
  if (add <= 0) return { add: 0, dayDone: false };
  E.today = was + add;
  var done = was < DRAGON.perDay && E.today >= DRAGON.perDay;
  if (done) E.fed++;
  return { add: add, dayDone: done };
}
/* today's koi so far (0 on a new day) */
function dragonToday(save, now) { var E = dragonState(save); return E.day === dayKey(now) ? E.today : 0; }
function dragonReady(save) { var E = dragonState(save); return !E.hatched && E.fed >= DRAGON.days; }
/* shown while it runs, and after it only while an egg fed in time waits to hatch */
function dragonShown(save, now) { return dragonOn(now) || dragonReady(save); }
