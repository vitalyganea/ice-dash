/* ===========================================================
   yandex.js — the Yandex Games side of things (Yandex build only)
   -----------------------------------------------------------
   Only build-yandex.sh puts this in the page, after Yandex's own
   /sdk.js; the Playables bundle, the Android app and the browser never
   load it. It keeps the game itself untouched by answering the same
   handful of calls ui.js already makes to the YouTube Playables SDK
   (window.ytgame), each one passed on to its Yandex equivalent:
     - loadData / saveData   -> player.getData / setData (cloud save),
                                with localStorage kept as a mirror
     - the language           -> environment.i18n.lang, at every start
     - gameReady              -> LoadingAPI.ready()
     - onPause / onResume     -> the tab being hidden, a full-screen ad,
                                 and Yandex's game_api_pause / _resume
     - the audio switch       -> all of those, and the game losing focus
   and on its own:
     - marks play for Yandex with GameplayAPI.start/stop;
     - shows a full-screen ad (Yandex requires the game to earn) at the
       one logical pause a run has: leaving the results, by Ride again or
       Menu. Never during play, and not more than once in AD_GAP;
     - stops the context menu and the long-press callout everywhere, not
       only on the hill.
   Yandex requires the sound to stop when the game is hidden or loses
   focus, which is why this file listens to visibility and focus:
   Playables forbids that, and nothing in the game itself does it.
   Off Yandex (no YaGames on the page) it does nothing at all.
   =========================================================== */
(function () {
  if (!window.YaGames || !window.YaGames.init) return;

  var KEY = 'icedash-save-v1';
  var LOAD_WAIT = 2500;            // under ui.js's own 3 s, so ours answers first
  var AD_GAP = 90000;              // at least this long between two full-screen ads
  /* The languages Yandex's own guidance reads as Russian-speaking. */
  var AS_RU = { ru: 1, be: 1, kk: 1, uk: 1, uz: 1 };

  var ysdk = null;
  var sdkP = window.YaGames.init().then(function (s) { ysdk = s; return s; }, function () { return null; });
  var playerP = sdkP.then(function (s) {
    if (!s || !s.getPlayer) return null;
    return s.getPlayer({ scopes: false }).then(function (p) { return p; }, function () { return null; });
  });

  function sdkLang() {
    try {
      var l = String(ysdk.environment.i18n.lang || '').toLowerCase();
      return AS_RU[l] ? 'ru' : (l || null);
    } catch (e) { return null; }
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
    var cloud = playerP.then(function (p) {
      if (!p || !p.getData) return null;
      return p.getData(['save']).then(function (d) { return d && d.save; }, function () { return null; });
    });
    var late = new Promise(function (r) { setTimeout(function () { r(null); }, LOAD_WAIT); });
    return Promise.race([cloud, late]).then(function (c) {
      var a = parse(c), b = parse(local());
      var o = (runsOf(a) >= runsOf(b) ? a : b) || {};
      /* Yandex decides the language a game starts in. */
      var L = sdkLang();
      if (L) o.lang = L;
      return JSON.stringify(o);
    });
  }
  function saveData(data) {
    try { localStorage.setItem(KEY, data); } catch (e) {}
    return playerP.then(function (p) {
      if (!p || !p.setData) return;
      return p.setData({ save: data }, false).then(null, function () {});
    });
  }

  /* ---------------------- pause, resume, sound --------------------- */
  /* hidden: the tab is not shown. held: Yandex (or its ad) has the screen.
     Either one pauses the game. blurred: the player is in another window;
     that only takes the sound away, a paused hill for a glance at another
     tab would be a nuisance. */
  var pauseCbs = [], resumeCbs = [], audioCbs = [];
  var hidden = !!document.hidden, held = false, adOn = false, blurred = false;
  var stopped = hidden, mute = hidden;
  function each(list, arg) { for (var i = 0; i < list.length; i++) { try { list[i](arg); } catch (e) {} } }
  function sync() {
    var s = hidden || held || adOn, m = s || blurred;
    if (s !== stopped) { stopped = s; each(s ? pauseCbs : resumeCbs); }
    if (m !== mute) { mute = m; each(audioCbs, !m); }
  }
  document.addEventListener('visibilitychange', function () { hidden = !!document.hidden; sync(); });
  window.addEventListener('blur', function () { blurred = true; sync(); });
  window.addEventListener('focus', function () { blurred = false; sync(); });
  /* A touch or a key is proof of focus, whatever the browser said. */
  function here() { if (blurred) { blurred = false; sync(); } }
  window.addEventListener('pointerdown', here, true);
  window.addEventListener('keydown', here, true);
  sdkP.then(function (s) {
    if (!s || !s.on) return;
    s.on('game_api_pause', function () { held = true; sync(); });
    s.on('game_api_resume', function () { held = false; sync(); });
  });

  /* ----------------------- full-screen ads ------------------------ */
  /* Counted from the start, so a new player's first rides are ad-free. */
  var lastAd = Date.now(), passing = false;
  function showAd(then) {
    var adv = ysdk && ysdk.adv;
    if (!adv || !adv.showFullscreenAdv || Date.now() - lastAd < AD_GAP) { then(); return; }
    lastAd = Date.now();
    var done = false;
    function end() { if (done) return; done = true; adOn = false; sync(); then(); }
    adOn = true; sync();
    try {
      adv.showFullscreenAdv({ callbacks: {
        onOpen: function () { lastAd = Date.now(); },
        onClose: function () { lastAd = Date.now(); end(); },
        onError: end,
        onOffline: end
      } });
    } catch (e) { end(); }
  }
  /* Leaving the results is the break between two runs: the ad goes there,
     and the button pressed does its job once the ad is closed. */
  window.addEventListener('click', function (e) {
    if (passing || !e.target.closest) return;
    var b = e.target.closest('#screen-over [data-action="play"], #screen-over [data-action="back-title"]');
    if (!b || !ysdk || Date.now() - lastAd < AD_GAP) return;
    e.stopImmediatePropagation(); e.preventDefault();
    showAd(function () { passing = true; try { b.click(); } finally { passing = false; } });
  }, true);

  /* ------------------ no menu, no callout, no selection --------------- */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  var st = document.createElement('style');
  st.textContent = 'html,body,canvas,button{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}';
  (document.head || document.documentElement).appendChild(st);

  /* ------------------------ marking play --------------------------- */
  /* Yandex wants to know when the player is actually playing. ui.js has no
     single place that says so, so the game's own state is read instead. */
  var playing = false;
  setInterval(function () {
    if (!ysdk || typeof Game === 'undefined') return;
    var api = ysdk.features && ysdk.features.GameplayAPI;
    if (!api) return;
    var now = Game.isRunning() && !Game.isPaused() && !Game.isSuspended();
    if (now === playing) return;
    playing = now;
    try { now ? api.start() : api.stop(); } catch (e) {}
  }, 250);

  /* ---------------- the calls ui.js makes, answered ---------------- */
  window.ytgame = {
    IN_PLAYABLES_ENV: true,
    game: {
      loadData: loadData,
      saveData: saveData,
      firstFrameReady: function () {},
      gameReady: function () {
        sdkP.then(function (s) {
          try { if (s && s.features && s.features.LoadingAPI) s.features.LoadingAPI.ready(); } catch (e) {}
        });
      }
    },
    system: {
      onPause: function (f) { pauseCbs.push(f); },
      onResume: function (f) { resumeCbs.push(f); },
      isAudioEnabled: function () { return !mute; },
      onAudioEnabledChange: function (f) { audioCbs.push(f); }
    },
    /* No leaderboard is set up in the Yandex console; the score stays here. */
    engagement: { sendScore: function () { return Promise.resolve(); } }
  };
})();
