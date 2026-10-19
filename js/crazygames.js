/* ===========================================================
   crazygames.js — the CrazyGames side of things (CrazyGames build only)
   -----------------------------------------------------------
   Only build-crazygames.sh puts this in the page, after the CrazyGames
   SDK v3; the Playables bundle, the Android app, Yandex and the browser
   never load it. Like yandex.js it keeps the game untouched by answering
   the calls ui.js already makes to the YouTube Playables SDK
   (window.ytgame), each one passed on to CrazyGames:
     - loadData / saveData   -> SDK.data (follows a logged-in player from
                                device to device), localStorage as a mirror
     - the language           -> user.systemInfo.locale, at every start
     - onPause / onResume     -> the tab being hidden, and an ad
     - the audio switch       -> those, and the site's own muteAudio
   and on its own:
     - gameplayStart / gameplayStop, read off the game's own state;
     - a midgame ad at the one natural break a run has: leaving its
       results, by Ride again or Menu. CrazyGames decides how often one
       actually shows (at most one in three minutes) and none at all in
       Basic Launch. While it is asked for and while it plays nothing on
       the page can be pressed, the game is paused and silent;
     - happytime() on a new best, the one big moment;
     - a new player lands straight in the tutorial: Snowcap's comic, which
       comes first everywhere else, waits in the Market. CrazyGames wants
       play within one click;
     - no context menu and no long-press callout anywhere;
     - on iOS the audio is woken on every touch, which is what CrazyGames
       asks for after Safari has interrupted it.
   On any other site the SDK reports 'disabled' and this does nothing.

   Four changes to play itself, CrazyGames only, after its review said the
   quality fell short (see SYSTEMS.md row 121). Set below as
   window.ICEDASH_PLATFORM before game.js and ui.js load; unset there,
   every other build plays as before:
     - minViewH: on a wide desktop window the hill shows at least this
       much height, so a player sees as far ahead as on a phone;
     - freeOpen: Freeride, the endless main mode, is open from the start
       instead of after the first marked line;
     - deskWords: with a mouse and no touch screen the tutorial says
       click or Space, not tap;
     - noEscPause: Esc (which also leaves fullscreen) does not pause a
       run; P and the pause button do.
   =========================================================== */
window.ICEDASH_PLATFORM = { minViewH: 860, freeOpen: true, deskWords: true, noEscPause: true };

(function () {
  var CG = window.CrazyGames && window.CrazyGames.SDK;
  if (!CG || !CG.init) return;

  var KEY = 'icedash-save-v1';
  var LOAD_WAIT = 2500;            // under ui.js's own 3 s, so ours answers first

  var sdk = null;
  var sdkP = CG.init().then(function () {
    if (CG.environment === 'disabled') return null;
    sdk = CG; return CG;
  }, function () { return null; });

  function sdkLang() {
    try { return String(sdk.user.systemInfo.locale || '').toLowerCase().split('-')[0] || null; }
    catch (e) { return null; }
  }
  function local() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function parse(s) {
    if (typeof s !== 'string') return null;
    try { var o = JSON.parse(s); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
  }
  /* How far along a save is: of two copies, the one with more runs wins. */
  function runsOf(o) { return o ? (parseInt(o.runs, 10) || 0) : -1; }

  /* ---------------------------- saving ---------------------------- */
  function loadData() {
    var cloud = sdkP.then(function (s) {
      if (!s || !s.data) return null;
      try { return s.data.getItem(KEY); } catch (e) { return null; }
    });
    var late = new Promise(function (r) { setTimeout(function () { r(null); }, LOAD_WAIT); });
    return Promise.race([cloud, late]).then(function (c) {
      var a = parse(c), b = parse(local());
      var o = runsOf(a) >= runsOf(b) ? a : b;
      /* someone who has never played starts on the hill, not on a comic */
      if (!o) o = { comicSeen: { snowcap: true } };
      var L = sdkLang();
      if (L) o.lang = L;               // unknown languages fall back to English
      return JSON.stringify(o);
    });
  }
  function saveData(data) {
    try { localStorage.setItem(KEY, data); } catch (e) {}
    return sdkP.then(function (s) {
      if (!s || !s.data) return;
      try { s.data.setItem(KEY, data); } catch (e) {}
    });
  }

  /* ---------------------- pause, resume, sound --------------------- */
  /* hidden: the tab is not shown. adOn: an ad is asked for or playing.
     Either one pauses the game. muted: the site's own sound switch, which
     only takes the sound away. */
  var pauseCbs = [], resumeCbs = [], audioCbs = [];
  var hidden = !!document.hidden, adOn = false, muted = false;
  var stopped = hidden, silent = hidden;
  function each(list, arg) { for (var i = 0; i < list.length; i++) { try { list[i](arg); } catch (e) {} } }
  function sync() {
    var s = hidden || adOn, m = s || muted;
    if (s !== stopped) { stopped = s; each(s ? pauseCbs : resumeCbs); }
    if (m !== silent) { silent = m; each(audioCbs, !m); }
  }
  document.addEventListener('visibilitychange', function () { hidden = !!document.hidden; sync(); });
  sdkP.then(function (s) {
    if (!s || !s.game) return;
    function readMute() { try { muted = !!(s.game.settings && s.game.settings.muteAudio); } catch (e) {} sync(); }
    readMute();
    try { s.game.addSettingsChangeListener(readMute); } catch (e) {}
  });

  /* iOS can leave the audio interrupted after a call or another app; it
     only comes back from inside a touch. */
  function wake() { try { if (typeof Sfx !== 'undefined' && Sfx.unlock) Sfx.unlock(); } catch (e) {} }
  window.addEventListener('touchend', wake, true);
  window.addEventListener('click', wake, true);

  /* ------------------------ marking play --------------------------- */
  var playing = false;
  setInterval(function () {
    if (!sdk || !sdk.game || typeof Game === 'undefined') return;
    var now = Game.isRunning() && !Game.isPaused() && !Game.isSuspended();
    if (now === playing) return;
    playing = now;
    try { now ? sdk.game.gameplayStart() : sdk.game.gameplayStop(); } catch (e) {}
  }, 250);

  /* ----------------------------- ads ------------------------------- */
  /* Nothing can be pressed while the ad is asked for: a clear sheet over
     the whole page, gone the moment the ad is done or refused. */
  var shield = null;
  function block(on) {
    if (on && !shield) {
      shield = document.createElement('div');
      shield.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:transparent';
      document.body.appendChild(shield);
    } else if (!on && shield) { shield.parentNode.removeChild(shield); shield = null; }
  }
  /* One line in the console for every ad asked for and how it went, so a
     refusal (Basic Launch, cooldown, an adblocker) can be told from a
     request that never left. */
  function say(m) { try { console.info('[Ice Dash] midgame ad: ' + m); } catch (e) {} }
  function midgame(then) {
    var done = false;
    function end() { if (done) return; done = true; adOn = false; block(false); sync(); then(); }
    adOn = true; block(true); sync();
    say('requested');
    try {
      sdk.ad.requestAd('midgame', {
        adStarted: function () { say('started'); },
        adFinished: function () { say('finished'); end(); },
        adError: function (err) {
          var code = err && (err.code || err.message) || err;
          try { code = typeof code === 'string' ? code : JSON.stringify(code); } catch (e) {}
          say('refused (' + code + ')'); end();
        }
      });
    } catch (e) { say('could not be asked (' + e + ')'); end(); }
    setTimeout(end, 60000);            // never strand a player behind a stuck ad
  }
  var passing = false;
  window.addEventListener('click', function (e) {
    if (passing || !sdk || !sdk.ad || !e.target.closest) return;
    var b = e.target.closest('#screen-over [data-action="play"], #screen-over [data-action="back-title"]');
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    midgame(function () { passing = true; try { b.click(); } finally { passing = false; } });
  }, true);

  /* ------------------------- a new best ---------------------------- */
  function watchBest() {
    var nb = document.getElementById('new-best');
    if (!nb || !window.MutationObserver) return;
    var was = !nb.classList.contains('hidden');
    new MutationObserver(function () {
      var now = !nb.classList.contains('hidden');
      if (now && !was && sdk && sdk.game) { try { sdk.game.happytime(); } catch (e) {} }
      was = now;
    }).observe(nb, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchBest);
  else watchBest();

  /* ------------------ no menu, no callout, no selection --------------- */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  var st = document.createElement('style');
  st.textContent = 'html,body,canvas,button{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}';
  (document.head || document.documentElement).appendChild(st);

  /* ---------------- the calls ui.js makes, answered ---------------- */
  window.ytgame = {
    IN_PLAYABLES_ENV: true,
    game: {
      loadData: loadData,
      saveData: saveData,
      firstFrameReady: function () {},
      gameReady: function () {}
    },
    system: {
      onPause: function (f) { pauseCbs.push(f); },
      onResume: function (f) { resumeCbs.push(f); },
      isAudioEnabled: function () { return !silent; },
      onAudioEnabledChange: function (f) { audioCbs.push(f); }
    },
    engagement: { sendScore: function () { return Promise.resolve(); } }
  };
})();
