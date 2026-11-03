/* ===========================================================
   ios-check.js — the walk the iPhone simulator takes on GitHub
   -----------------------------------------------------------
   Prints a script for .github/workflows/ios.yml, which hands it to the
   debug build at launch (ICEDASH_CHECK; IceDashViewController.swift runs
   it in the page). The page is the real app's, on Apple's web view, with
   the real plugins: AdMob's test ads, Game Center with nobody signed in,
   Apple's question about tracking.

   The first start puts a save with something in it on the device and
   loads again. Then: the title, Settings, a Freeride run (the steady rider
   from tools/media-lib.js, then left to crash), the revive, the results and
   the board. Before each picture it writes "ICEDASH-SHOT <name>" to the
   console, which Capacitor passes to the app's output; the workflow takes
   the picture when it reads the line. "ICEDASH-DONE" ends the walk, and
   anything that goes wrong is written as "ICEDASH-ERROR".
     node test/ios-check.js > check.js
   =========================================================== */
var M = require('../tools/media-lib.js');

var SAVE = Object.assign({}, M.SAVE, { lang: 'en', lives: 0, sfx: false, music: false });

function walk(SAVE, RIDE) {
  var KEY = 'icedash-save-v1';
  function say(s) { console.log('ICEDASH-' + s); }
  window.addEventListener('error', function (e) { say('ERROR ' + e.message + ' at ' + e.filename + ':' + e.lineno); });
  try {
    if (!localStorage.getItem('icedash-check')) {
      localStorage.setItem('icedash-check', '1');
      localStorage.setItem(KEY, JSON.stringify(SAVE));
      say('SEEDED');
      location.reload();
      return;
    }
  } catch (e) { say('ERROR no storage: ' + e.message); }
  function shown(id) { var e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }
  function click(sel) {
    var e = document.querySelector(sel);
    if (e) e.click(); else say('ERROR nothing to click: ' + sel);
  }
  /* each step: [ms to wait first, what to do]; a step that returns false
     is tried again a moment later, up to a limit */
  var steps = [
    [6000, function () { say('SHOT 01-title'); }],
    [2000, function () { click('#screen-title [data-action="settings"]'); }],
    [1500, function () { say('SHOT 02-settings'); }],
    [1500, function () { click('#btn-back'); }],
    [1500, function () { click('#btn-free'); }],
    [1500, function () { eval(RIDE)(null); }],
    [3500, function () { say('SHOT 03-run'); }],
    [4000, function () { say('SHOT 04-run'); }],
    [1000, function () { clearInterval(window.__ride); }],
    [500, function () { return shown('screen-revive') || shown('screen-over'); }],
    [1500, function () { say('SHOT 05-revive'); }],
    [1500, function () { if (shown('screen-revive')) click('#screen-revive [data-action="no-life"]'); }],
    [2500, function () { say('SHOT 06-results'); }],
    [1500, function () { if (shown('over-board')) click('#over-board'); else say('ERROR no board button on the results'); }],
    [3000, function () { say('SHOT 07-board'); }],
    [13000, function () { say('SHOT 08-board-later'); }],
    [1500, function () { say('DONE'); }]
  ];
  var i = 0, tries = 0;
  function next() {
    if (i >= steps.length) return;
    var s = steps[i];
    setTimeout(function () {
      var r;
      try { r = s[1](); } catch (e) { say('ERROR step ' + i + ': ' + e.message); }
      if (r === false && ++tries < 60) { steps[i] = [500, s[1]]; next(); return; }
      if (r === false) say('ERROR step ' + i + ' never came');
      tries = 0; i++; next();
    }, s[0]);
  }
  next();
}

process.stdout.write('(' + walk.toString() + ')(' + JSON.stringify(SAVE) + ',' + JSON.stringify(M.RIDE) + ');\n');
