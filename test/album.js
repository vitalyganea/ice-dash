/* ===========================================================
   album.js — three stories for every creature
   -----------------------------------------------------------
   Chapters open in order as the totals ridden with a creature grow, each
   pays once, the tutorial does not count, and every creature in the
   catalogue — a new one included — has a feat and all three stories in
   every language, so no window ever shows a missing key.
   =========================================================== */
var fs = require('fs'), path = require('path');
var DIR = path.join(__dirname, '..', 'js') + path.sep;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
global.navigator = { language: 'en' }; global.window = {}; global.document = { documentElement: {} };
eval(fs.readFileSync(DIR + 'skins.js', 'utf8'));
eval(fs.readFileSync(DIR + 'album.js', 'utf8'));
var I18N = fs.readFileSync(DIR + 'i18n.js', 'utf8');

console.log('A. chapters open in order, and pay once');
var save = { fish: 0 };
var won = albumCheck(save, 'seal');
ok(won.length === 0, 'nothing open before a run together');
albumAdd(save, 'seal', { dist: 700, fish: 30, gold: 4 });
won = albumCheck(save, 'seal');
ok(won.length === 1 && won[0].chapter === 0 && save.fish === ALBUM_PAY[0], 'the first run opens chapter one (+' + save.fish + ')');
ok(albumCheck(save, 'seal').length === 0 && save.fish === ALBUM_PAY[0], 'and is paid only once');
albumAdd(save, 'seal', { dist: 900, gold: 12 });     // 16 golden fish now, but 1600 m
won = albumCheck(save, 'seal');
ok(won.length === 0, 'the feat (15 golden fish) is done, but chapter three waits for chapter two (1600 of 2000 m)');
albumAdd(save, 'seal', { dist: 500 });
won = albumCheck(save, 'seal');
ok(won.length === 2 && won[0].chapter === 1 && won[1].chapter === 2, 'past 2000 m, chapters two and three open together');
ok(save.fish === ALBUM_PAY[0] + ALBUM_PAY[1] + ALBUM_PAY[2], 'all three paid: ' + save.fish + ' fish');
ok(albumOf(save, 'mitten').runs === 0, 'and none of it counted for another creature');

console.log('\nB. what counts');
var s2 = { fish: 0 };
albumAdd(s2, 'owl', { dist: 5000, course: 'tutorial' });
ok(albumOf(s2, 'owl').runs === 0, 'the tutorial does not count');
albumAdd(s2, 'lemming', { dist: 300, course: 'daily', finished: true });
albumAdd(s2, 'lemming', { dist: 300, course: 'daily', finished: false });
albumAdd(s2, 'reindeer', { dist: 900, course: 'narrows', finished: true });
ok(albumOf(s2, 'lemming').daily === 1 && albumOf(s2, 'reindeer').lines === 1, 'a finished Daily Line and a finished marked line are counted apart');
albumAdd(s2, 'hare', { dist: 1200 }); albumAdd(s2, 'hare', { dist: 2100 });
ok(albumOf(s2, 'hare').bestRun === 2100 && albumOf(s2, 'hare').dist === 3300, 'best single run and total distance kept apart');
albumAdd(s2, 'puffin', { comboBest: 22 }); albumAdd(s2, 'puffin', { comboBest: 41 });
ok(albumOf(s2, 'puffin').combo === 41, 'the best run of catches is kept');

console.log('\nC. every creature has a feat and its stories, in every language');
SKINS.forEach(function (sk) {
  var feat = ALBUM_FEAT[sk.id];
  var stats = albumGoals(sk.id).map(function (g) { return g.stat; });
  var goalKeys = stats.every(function (st) { return I18N.indexOf("'album.g." + st + "'") >= 0; });
  var count = 0;
  for (var i = 1; i <= 3; i++) {
    var k = "'story." + sk.id + '.' + i + "'";
    count += (I18N.split(k).length - 1);           // once in the main table, once in RO
  }
  ok(!!feat && goalKeys && count === 6, sk.id + ': a feat of its own (' + (feat ? feat.stat + ' ' + feat.n : 'none') +
     '), and its three stories in English, Russian and Romanian');
});

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'album checks passed'));
process.exit(fail ? 1 : 0);
