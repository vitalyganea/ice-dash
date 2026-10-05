/* ===========================================================
   i18n.js — every string in every language
   -----------------------------------------------------------
   Six languages. Each must have every key, with the same {placeholders}
   and the same markup as the English, so no screen shows a raw key or a
   sentence with its number missing.
   =========================================================== */
var fs = require('fs'), path = require('path');
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
/* Node has a navigator of its own that plain assignment cannot replace */
function setNav(v) { Object.defineProperty(global, 'navigator', { value: v, configurable: true, writable: true }); }
setNav({ language: 'en' }); global.window = {};
global.document = { documentElement: {}, querySelectorAll: function () { return []; } };
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8'));
function marks(s) { return (s.match(/\{[a-z]\}/g) || []).sort().join(',') + '|' + (s.match(/<[^>]+>/g) || []).join(''); }
var keys = Object.keys(STRINGS);
ok(LANGS.length === 6, 'six languages offered (' + LANGS.map(function (l) { return l.id; }).join(', ') + ')');
LANGS.forEach(function (L) {
  var missing = keys.filter(function (k) { return !STRINGS[k][L.id]; });
  var off = keys.filter(function (k) { return STRINGS[k][L.id] && marks(STRINGS[k][L.id]) !== marks(STRINGS[k].en); });
  ok(!missing.length && !off.length, L.label + ': all ' + keys.length + ' strings, placeholders and tags intact' +
     (missing.length ? ' (missing: ' + missing.slice(0, 5).join(', ') + ')' : '') +
     (off.length ? ' (changed: ' + off.slice(0, 5).join(', ') + ')' : ''));
});
['es-MX', 'pt-BR', 'de-AT', 'ro-RO'].forEach(function (tag) {
  setNav({ language: tag, languages: [tag] });
  ok(detectLang() === tag.split('-')[0], 'a device set to ' + tag + ' starts in ' + tag.split('-')[0]);
});
console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'language checks passed'));
process.exit(fail ? 1 : 0);
