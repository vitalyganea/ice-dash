/* ===========================================================
   looks.js — each creature's own skin, and the card on the board (1.3.0)
   -----------------------------------------------------------
   A player's card travels with their best as one number (a Play Games
   tag, a Game Center context): it must come back exactly, survive a code
   from a later build without breaking, and stay inside what each store
   takes. Every skin, frame and title has its words in every language, and
   every title is won by a trophy that exists. Every creature has exactly
   one skin of its own. Skins are paint: never a perk.
   =========================================================== */
var fs = require('fs'), path = require('path');
var DIR = path.join(__dirname, '..', 'js') + path.sep;
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }
global.window = {}; global.document = { documentElement: {}, querySelectorAll: function () { return []; } };
eval(fs.readFileSync(DIR + 'skins.js', 'utf8'));
eval(fs.readFileSync(DIR + 'achievements.js', 'utf8'));
eval(fs.readFileSync(DIR + 'i18n.js', 'utf8'));

console.log('A. the card comes back as it went');
var all = 0, bad = 0;
SKINS.forEach(function (sk, si) {
  ['', ALT_OF[sk.id] ? ALT_OF[sk.id].id : ''].forEach(function (alt) {
    var p = { skin: sk.id, alt: alt, frame: FRAMES[si % FRAMES.length].id,
              title: TITLES[si % TITLES.length].id, trophies: (si * 7) % (ACHIEVEMENTS.length + 1) };
    var back = profileFrom(profileTag(p)), num = profileFrom(profileCode(p));
    all++;
    if (JSON.stringify(back) !== JSON.stringify(p) || JSON.stringify(num) !== JSON.stringify(p)) bad++;
  });
});
ok(bad === 0, 'every creature, in its own coat and in its skin: ' + all + ' cards, ' + bad + ' changed on the way');
var big = profileCode({ skin: SKINS[SKINS.length - 1].id, alt: ALT_OF[SKINS[SKINS.length - 1].id].id, frame: 'gold', title: 'legend', trophies: 63 });
ok(big < Math.pow(2, 53) && /^[0-9a-z]{1,12}$/.test(big.toString(36)),
   'the largest fits a double exactly and a Play Games tag (' + big.toString(36) + ')');
ok(profileFrom('') === null && profileFrom(0) === null && profileFrom('not a tag!') === null,
   'no tag, no card');
var later = (2 * Math.pow(64, 6)).toString(36);
ok(profileFrom(later) === null, 'a card from a later version of the code is not misread');
var far = profileFrom((((((1 * 64 + 63) * 64 + 0) * 64 + 0) * 64 + 0) * 64 + 0) * 64 + 3);
ok(far && far.skin === SKINS[0].id, 'a creature this build does not have shows as the first one');
ok(profileFrom(profileCode({ skin: 'snowcap', alt: 'santa' })).alt === '', 'a skin that is not the creature\'s own does not travel');

console.log('\nB. every one has its words, every creature its skin, every title a trophy');
var langs = LANGS.map(function (L) { return L.id; }), missing = [];
function need(key) { langs.forEach(function (l) { var v = STRINGS[key] && STRINGS[key][l]; if (!v) missing.push(l + ':' + key); }); }
ALT_SKINS.forEach(function (A) { need('alt.' + A.id); });
FRAMES.forEach(function (F) { need('prof.f.' + F.id); });
TITLES.forEach(function (T) { need('prof.t.' + T.id); });
ok(langs.length >= 6 && missing.length === 0, 'looks, frames and titles named in ' + langs.length + ' languages' +
   (missing.length ? ' — missing ' + missing.slice(0, 6).join(', ') : ''));
var ids = ACHIEVEMENTS.map(function (a) { return a.id; });
var lost = TITLES.filter(function (T) { return T.ach && T.ach !== '*' && ids.indexOf(T.ach) < 0; });
ok(lost.length === 0, 'every title is won by a trophy that exists');
ok(SKINS.every(function (sk) { return ALT_SKINS.filter(function (A) { return A.of === sk.id; }).length === 1; }) &&
   ALT_SKINS.every(function (A) { return !!SKIN_BY_ID[A.of]; }),
   'every creature has exactly one skin of its own (' + ALT_SKINS.length + ')');
ok(ALT_SKINS.every(function (L) { return L.price > 0 && (L.currency === 'fish' || L.currency === 'gold'); }) &&
   FRAMES[0].price === 0 && FRAMES.slice(1).every(function (F) { return F.price > 0; }),
   'every skin and frame but the first frame has a price in fish or gold');

console.log('\nC. paint, on its creature');
var H = require('./harness.js'), G = global.Game;
ok(G.altIds().slice().sort().join() === ALT_SKINS.map(function (A) { return A.id; }).sort().join(),
   'the painter has exactly the skins on sale');
var calls = 0, threw = [];
function stubCtx() {
  return new Proxy({}, { get: function (t, k) {
    if (k === 'canvas') return { width: 100, height: 100 };
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: function () {} }; };
    if (k === 'getImageData') return function () { return { data: new Uint8ClampedArray(4) }; };
    if (k in t) return t[k];
    return function () { calls++; };
  }, set: function (t, k, v) { t[k] = v; return true; } });
}
ALT_SKINS.forEach(function (A) {
  try { G.drawSkinPreview({ getContext: stubCtx, style: {} }, A.of, 60, A.id); }
  catch (e) { threw.push(A.id + ': ' + e.message); }
});
ok(threw.length === 0 && calls > 0, 'every skin paints on its creature (' + calls + ' calls)' + (threw.length ? ' — ' + threw[0] : ''));
H.setSeed(3); G.start(0, {}, 'reindeer', null, 0);
var perkBefore = JSON.stringify(G._consts());
G.setLook('santa');
ok(JSON.stringify(G._consts()) === perkBefore && typeof G._consts().LOOK === 'number',
   'wearing a skin changes nothing on the hill');
G.setLook(''); G.stop();

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'looks checks passed'));
process.exit(fail ? 1 : 0);
