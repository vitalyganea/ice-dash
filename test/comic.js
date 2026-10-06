/* ===========================================================
   comic.js — every comic is whole, in every language
   -----------------------------------------------------------
   Each comic is three pages of three panels; every caption is a string in
   all six languages; every panel paints through its whole entrance
   without throwing (the painters run on the harness's pretend canvas).
   =========================================================== */
var H = require('./harness.js'); var G = global.Game;
var fs = require('fs'), path = require('path');
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'comic.js'), 'utf8'));
global.t = t;
var fake = document.getElementById('comic-test').getContext('2d');

Object.keys(COMICS).forEach(function (id) {
  var pages = COMICS[id];
  var shape = pages.length === 3 && pages.every(function (p) { return p.length === 3; });
  var caps = [], threw = null;
  pages.forEach(function (p) { p.forEach(function (panel) {
    caps.push(panel.cap);
    for (var tt = 0; tt < 90; tt += 7) {
      try { panel.draw(fake, tt); } catch (e) { threw = threw || (panel.cap + ': ' + e.message); }
    }
  }); });
  var words = caps.every(function (k) {
    return STRINGS[k] && LANGS.every(function (L) { return !!STRINGS[k][L.id]; });
  });
  ok(!!SKIN_BY_ID[id] && shape && words && !threw,
     id + ': three pages of three panels, every caption in all ' + LANGS.length + ' languages, every panel paints' +
     (threw ? ' (threw: ' + threw + ')' : ''));
});
ok(!!COMICS.snowcap, 'Snowcap, whom every new player meets, has one');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'comic checks passed'));
process.exit(fail ? 1 : 0);
