/* ===========================================================
   i18n.js — every string in every language
   -----------------------------------------------------------
   Six languages. Each must have every key, with the same {placeholders}
   and the same markup as the English, so no screen shows a raw key or a
   sentence with its number missing. A counted phrase written as forms
   must have every form its language uses, each with those placeholders,
   and the forms must be picked the way each language counts.
   =========================================================== */
var fs = require('fs'), path = require('path');
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
/* Node has a navigator of its own that plain assignment cannot replace */
function setNav(v) { Object.defineProperty(global, 'navigator', { value: v, configurable: true, writable: true }); }
setNav({ language: 'en' }); global.window = {};
global.document = { documentElement: {}, querySelectorAll: function () { return []; } };
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8'));
function marks1(s) { return (s.match(/\{[a-z]\}/g) || []).sort().join(',') + '|' + (s.match(/<[^>]+>/g) || []).join(''); }
/* a string's marks; for forms, the marks they all share, or a mismatch */
function marks(v) {
  if (typeof v === 'string') return marks1(v);
  var m = Object.keys(v).map(function (f) { return marks1(v[f]); });
  return m.every(function (x) { return x === m[0]; }) ? m[0] : 'forms disagree';
}
var FORMS = { en: ['one', 'other'], es: ['one', 'other'], pt: ['one', 'other'], de: ['one', 'other'],
              ro: ['one', 'few', 'other'], ru: ['one', 'few', 'many'] };
var keys = Object.keys(STRINGS);
ok(LANGS.length === 6, 'six languages offered (' + LANGS.map(function (l) { return l.id; }).join(', ') + ')');
LANGS.forEach(function (L) {
  var missing = keys.filter(function (k) { return !STRINGS[k][L.id]; });
  var off = keys.filter(function (k) { return STRINGS[k][L.id] && marks(STRINGS[k][L.id]) !== marks(STRINGS[k].en); });
  ok(!missing.length && !off.length, L.label + ': all ' + keys.length + ' strings, placeholders and tags intact' +
     (missing.length ? ' (missing: ' + missing.slice(0, 5).join(', ') + ')' : '') +
     (off.length ? ' (changed: ' + off.slice(0, 5).join(', ') + ')' : ''));
  var forms = keys.filter(function (k) { return typeof STRINGS[k][L.id] === 'object'; });
  var short = forms.filter(function (k) {
    var v = STRINGS[k][L.id];
    return Object.keys(v).sort().join() !== FORMS[L.id].slice().sort().join() ||
           FORMS[L.id].some(function (f) { return !v[f]; });
  });
  ok(!short.length, L.label + ': every counted phrase has the forms ' + FORMS[L.id].join('/') + ' (' + forms.length + ' phrases' +
     (short.length ? '; wrong: ' + short.slice(0, 5).join(', ') : '') + ')');
});

/* the forms are chosen the way each language counts */
function says(lang, key, n) { setLang(lang); var s = t(key, { n: n, s: 'X' }); setLang('en'); return s; }
var CASES = [
  ['ro', 'over.points', 1, '1 punct'], ['ro', 'over.points', 19, '19 puncte'], ['ro', 'over.points', 20, '20 de puncte'],
  ['ro', 'over.points', 101, '101 puncte'], ['ro', 'over.points', 120, '120 de puncte'], ['ro', 'over.points', 0, '0 puncte'],
  ['ro', 'album.g.combo', '5\u202f000', 'O serie de 5\u202f000 de capturi împreună'],
  ['ru', 'goal.best', 4041, 'До рекорда: 4041 очко'], ['ru', 'goal.best', 4052, 'До рекорда: 4052 очка'],
  ['ru', 'goal.best', 4057, 'До рекорда: 4057 очков'], ['ru', 'goal.best', 12, 'До рекорда: 12 очков'],
  ['ru', 'goal.best', 111, 'До рекорда: 111 очков'], ['ru', 'album.won', 40, 'X: новая история  +40 рыб'],
  ['en', 'over.points', 1, '1 point'], ['en', 'unit.streak', 1, 'streak: 1 day'],
  ['es', 'find.gold', 1, 'Dentro: 1 pez dorado'], ['pt', 'find.gold', 3, 'Dentro: 3 peixes dourados'],
  ['de', 'find.gold', 1, 'Darin: 1 goldener Fisch']
];
var wrong = CASES.filter(function (c) { return says(c[0], c[1], c[2]) !== c[3]; });
ok(!wrong.length, 'counted phrases agree with their number in every language (' + CASES.length + ' cases' +
   (wrong.length ? '; ' + wrong.map(function (c) { return c[0] + ' ' + c[2] + ' -> ' + says(c[0], c[1], c[2]); }).join(', ') : '') + ')');
['es-MX', 'pt-BR', 'de-AT', 'ro-RO'].forEach(function (tag) {
  setNav({ language: tag, languages: [tag] });
  ok(detectLang() === tag.split('-')[0], 'a device set to ' + tag + ' starts in ' + tag.split('-')[0]);
});
console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'language checks passed'));
process.exit(fail ? 1 : 0);
