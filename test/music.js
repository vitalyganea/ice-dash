/* ===========================================================
   music.js — every stretch of hill has a tune of its own
   -----------------------------------------------------------
   Each biome names a mood, each mood is a whole tune (four chords, four
   bass triads, 32 steps of melody), no two stretches share one, and
   switching to any of them really schedules its notes. The audio graph
   is a recorder here: nothing is heard, every note is written down.
   =========================================================== */
var fs = require('fs'), path = require('path');
var DIR = path.join(__dirname, '..', 'js') + path.sep;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

/* a pretend AudioContext that writes down every oscillator started */
var notes = [], now = 0;
function param() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {},
                            linearRampToValueAtTime() {}, cancelScheduledValues() {} }; }
function node() { return { connect() {}, gain: param(), frequency: param() }; }
function AC() {
  this.state = 'running';
  Object.defineProperty(this, 'currentTime', { get: function () { return now; } });
  this.destination = {};
  this.createGain = node;
  this.createOscillator = function () {
    var o = node(), f = 0;
    o.frequency.setValueAtTime = function (v) { f = v; };
    o.start = function (t) { notes.push({ f: f, type: o.type, t: t }); };
    o.stop = function () {};
    return o;
  };
  this.createBufferSource = function () { var b = node(); b.start = b.stop = function () {}; return b; };
  this.createBuffer = function () { return { getChannelData: function () { return new Float32Array(8); } }; };
  this.createBiquadFilter = node;
  this.resume = function () {};
}
var timers = [];
global.window = { AudioContext: AC };
global.setInterval = function (f) { timers.push(f); return timers.length; };
global.clearInterval = function () { timers = []; };
eval(fs.readFileSync(DIR + 'audio.js', 'utf8').replace('return api;', 'api._moods = MOODS; return api;'));
eval(fs.readFileSync(DIR + 'biomes.js', 'utf8'));
var MOODS = Sfx._moods;

console.log('A. every stretch names a tune, and it exists');
var used = {};
BIOMES.forEach(function (b, i) {
  var m = b.mood || 'base';
  ok(!!MOODS[m], b.name + ' plays "' + m + '"');
  used[m] = (used[m] || []).concat(b.name);
});
var shared = Object.keys(used).filter(function (m) { return used[m].length > 1; });
ok(!shared.length, 'no two stretches share a tune' + (shared.length ? ' (' + shared.map(function (m) { return m + ': ' + used[m].join(', '); }).join('; ') + ')' : ''));

console.log('\nB. every tune is whole');
Object.keys(MOODS).forEach(function (k) {
  var m = MOODS[k];
  var whole = m.mel.length === 32 && m.chords.length === 4 && m.bass.length === 4 &&
              m.chords.concat(m.bass).every(function (c) { return c.length === 3 && c.every(function (f) { return f > 30 && f < 2000; }); }) &&
              m.mel.every(function (f) { return f === 0 || (f > 200 && f < 2000); }) &&
              m.mel.filter(Boolean).length >= 6;
  ok(whole, k + ': four chords, four bass triads, 32 steps with ' + m.mel.filter(Boolean).length + ' notes, all in range');
});
/* no two tunes the same line */
var sigs = {};
Object.keys(MOODS).forEach(function (k) { sigs[MOODS[k].mel.join(',')] = (sigs[MOODS[k].mel.join(',')] || []).concat(k); });
ok(Object.keys(sigs).length === Object.keys(MOODS).length, 'and no two melodies are the same');

console.log('\nC. switching to a tune really plays it');
Sfx.unlock && Sfx.unlock();
Sfx.music(true);
Object.keys(MOODS).forEach(function (k) {
  Sfx.mood(k);
  notes = [];
  for (var i = 0; i < 140; i++) { now += 0.06; timers.forEach(function (f) { f(); }); }   // ~8 s: a whole loop of the slowest
  var m = MOODS[k], heard = {};
  notes.forEach(function (n) { heard[Math.round(n.f * 100)] = 1; });
  var melHit = m.mel.filter(Boolean).filter(function (f) { return heard[Math.round(f * 100)]; }).length;
  var chordHit = m.chords[0].every(function (f) { return heard[Math.round(f * 100)]; });
  var leadType = notes.some(function (n) { return n.type === m.lead && m.mel.indexOf(n.f) >= 0; });
  ok(notes.length > 20 && chordHit && melHit >= 3 && leadType,
     k + ': ' + notes.length + ' notes in ~8 s, its first chord, ' + melHit + ' of its melody notes, on a ' + m.lead);
});
/* and the hot gait, for a tune that did not write one */
Sfx.mood('night'); Sfx.excite(true); notes = [];
for (var j = 0; j < 80; j++) { now += 0.06; timers.forEach(function (f) { f(); }); }
ok(notes.filter(function (n) { return MOODS.night.mel.indexOf(n.f) >= 0; }).length > 6,
   'a snow rush runs a tune without its own rushing line twice as busy');
Sfx.excite(false);

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'music checks passed'));
process.exit(fail ? 1 : 0);
