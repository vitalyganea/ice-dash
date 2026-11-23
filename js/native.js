/* ===========================================================
   native.js — the phone apps' side of things (Capacitor only)
   -----------------------------------------------------------
   Only build-android.sh puts this in the page (www/, which the Android
   and the iPhone app both take); the Playables bundle and the browser
   never load it. It keeps the game itself untouched:
     - the hardware back button is turned into the Esc key, which the game
       already understands (leave a panel, resume from pause, pause a run).
       On the title, with nothing to go back to, it leaves the app.
     - out of sight (the phone locked, another app on top) a run pauses
       and the sound stops until the app is back.
     - navigator.vibrate is answered by the native Haptics plugin, so the
       game's own buzz patterns work without the app asking for anything.
     - the status bar is hidden: the hill is the screen.
     - Settings gets a link to the privacy policy, which Google Play
       wants reachable from inside the app.
     - rewarded ads (AdMob), and only those: a player who crashes with no
       spare life may watch one to carry on, once a run, and the results
       can double a run's fish for one. Never an ad nobody asked for.
       Google's consent form comes first where the law wants one (the EU,
       the UK), and Settings gets a way back to it.
     - the Freeride board on Google Play Games, through the app's own
       PlayGames plugin (android/.../PlayGamesPlugin.java): the best is
       sent there, and the rows (places 1 to 100) come back for ui.js to
       lay out in the game's own panel.
     - the save kept in the player's Play Games account (saved games), so
       installing the game again, or a new phone, brings everything back.
     - the store's own review card, at a high point only (a new best,
       three stars) and not before ten runs, at most once a month.
   On the iPhone the same, with three differences: the board and the save
   go through the app's GameCenter plugin (ios/App/App/GameCenterPlugin.swift:
   Game Center and iCloud), which answers the same calls as PlayGames; the
   board's lines name Game Center (ICEDASH_PLATFORM.words = 'ios', read by
   t() in i18n.js); and the app never asks Apple's question about
   tracking (the owner's choice, 3 Nov 2026: it would frighten players),
   so the ads there are never personalised by the advertising id. There is
   no back button, so its listener is never called.
   ui.js is handed the ads and the board through window.ICEDASH_PLATFORM;
   without this file those are missing and nothing of them is shown.
   Every call is guarded: off-device, or with a plugin missing, nothing
   here does anything and the game runs as it does on the web.
   =========================================================== */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins || {};
  /* ui.js reads this once, as it loads; this file comes first, so the
     object is put there now and filled in as the plugins answer. */
  var PLAT = window.ICEDASH_PLATFORM = window.ICEDASH_PLATFORM || {};
  var IOS = !!(Cap.getPlatform && Cap.getPlatform() === 'ios');
  if (IOS) PLAT.words = 'ios';
  /* A fresh install on Android starts at the lowest graphics, whatever the
     phone: effects and sharpness both Low (2). Settings can raise them. Not
     on the iPhone, which starts at Auto as the web does: every iPhone that
     runs it is fast, and Low sharpness there is one canvas pixel to three
     of the screen, at which the hill's edges shimmered as they moved (the
     owner's iPhone 13, the first TestFlight build). */
  if (!IOS) PLAT.gfxDefault = { fx: 2, res: 2 };
  /* Nor does the iPhone's picture go below half its screen's density, even
     at Low sharpness: at a third it still shimmered once the frames came
     evenly (the owner, build 3). Low there is Medium's density; Low effects
     still save what they save. Android keeps its Low, which helps the slow
     phones it was made for and was never seen to shimmer. */
  if (IOS) PLAT.minSharp = 0.5;
  /* An ad or Google's board has the screen: the app is behind it, and
     must neither pause a run nor go on playing its tune underneath. */
  var away = false;
  function quiet(on) {
    away = on;
    if (window.Sfx && Sfx.platformAudio) { try { Sfx.platformAudio(!on); } catch (e) {} }
  }
  function hold(on) {
    if (window.Sfx && Sfx.hold) { try { Sfx.hold(on); } catch (e) {} }
  }

  function visible(id) {
    var e = document.getElementById(id);
    return !!e && !e.classList.contains('hidden');
  }

  /* ---- errors (1.3.5) ----
     Asked for by the owner, 22 Nov 2026: nobody learnt when the game threw
     on a player's phone. A script error does not close the app; the web
     view goes on, and a panel or a run may simply stop answering. This file
     comes ahead of every other script, so from here on each uncaught error
     and each promise nobody caught is written down: what it said, where,
     the version, the phone, the screen and the mode it happened on. The
     same error once a session, ten at most (a broken frame would repeat
     sixty times a second). The last twenty are kept on the phone
     (localStorage 'icedash-errlog', PLAT.errLog()) and printed to the log
     (logcat in the debug build, Safari's console on the iPhone), and each
     goes to Crashlytics (PLAT.errSink, below). */
  var ERR_KEY = 'icedash-errlog', errSeen = {}, errN = 0, appVer = '';
  if (P.App && P.App.getInfo) {
    P.App.getInfo().then(function (i) { if (i && i.version) appVer = i.version + (i.build ? ' (' + i.build + ')' : ''); }, function () {});
  }
  function errWhere() {
    var s = document.querySelector('.screen:not(.hidden)');
    var at = s && s.id ? s.id : (visible('hud') ? 'run' : '');
    try {
      /* the mode only in a run of the player's own, not the demo that
         slides behind the title */
      var w = window.Game && Game.isRunning && Game.isRunning() && Game.debug && Game.debug();
      if (w && w.mode) at += (at ? ' / ' : '') + w.mode + (w.state ? ' ' + w.state : '');
    } catch (e) {}
    return at;
  }
  function errNote(kind, msg, src, stack) {
    msg = String(msg || '').slice(0, 300);
    var key = kind + '|' + msg + '|' + (src || '');
    if (errSeen[key] || errN >= 10) return;
    errSeen[key] = 1; errN++;
    var e = {
      t: new Date().toISOString(), v: appVer, os: IOS ? 'ios' : 'android',
      dev: String(navigator.userAgent || '').slice(0, 200),
      /* the window, or the screen while the page is out of sight (0x0) */
      scr: (innerWidth || screen.width) + 'x' + (innerHeight || screen.height) + '@' + (window.devicePixelRatio || 1),
      lang: typeof LANG === 'string' ? LANG : '', at: errWhere(),
      kind: kind, msg: msg, src: src || '', stack: String(stack || '').slice(0, 1500)
    };
    try { console.error('[icedash-err] ' + JSON.stringify(e)); } catch (x) {}
    try {
      var a = JSON.parse(localStorage.getItem(ERR_KEY) || '[]');
      if (!Array.isArray(a)) a = [];
      a.push(e);
      localStorage.setItem(ERR_KEY, JSON.stringify(a.slice(-20)));
    } catch (x) {}
    if (PLAT.errSink) { try { PLAT.errSink(e); } catch (x) {} }
  }
  window.addEventListener('error', function (ev) {
    /* a script's own error; a picture or a file that failed to load is
       not one (those come only to a capturing listener anyway) */
    if (!ev || ev.target !== window || !ev.message) return;
    errNote('error', ev.message, (ev.filename || '').replace(/^.*\/\/[^/]*/, '') + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0),
            ev.error && ev.error.stack);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    errNote('promise', r && r.message ? r.message : String(r), '', r && r.stack);
  });
  PLAT.errLog = function () {
    try { var a = JSON.parse(localStorage.getItem(ERR_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  };
  /* Crashlytics (the Firebase project "ice-dasher", @capacitor-firebase/
     crashlytics). The app's own crashes go there by themselves; a script
     error goes as a report that did not close the app, with its stack
     (the web view's "at f (url:line:col)" or Safari's "f@url:line:col")
     and with the screen, the mode, the language and the window as keys.
     Crashlytics adds the version, the phone and the system itself. */
  function errFrames(stack, src) {
    var out = [];
    String(stack || '').split('\n').forEach(function (l) {
      var m = /^\s*at (?:(.*?) \()?(.*?):(\d+):\d+\)?\s*$/.exec(l) || /^\s*([^@\s]*)@(.*?):(\d+):\d+\s*$/.exec(l);
      if (m && out.length < 30) out.push({ functionName: m[1] || '(anonymous)', fileName: m[2].replace(/^.*\/\/[^/]*/, '') || '(page)', lineNumber: +m[3] });
    });
    var s = /^(.*):(\d+):\d+$/.exec(src || '');
    if (!out.length && s) out.push({ functionName: '(top)', fileName: s[1] || '(page)', lineNumber: +s[2] });
    return out;
  }
  var Crash = P.FirebaseCrashlytics;
  if (Crash && Crash.recordException) {
    PLAT.errSink = function (e) {
      function key(k, v) {
        try { Crash.setCustomKey({ key: k, value: String(v || '-'), type: 'string' }).then(null, function () {}); } catch (x) {}
      }
      key('at', e.at); key('lang', e.lang); key('scr', e.scr); key('kind', e.kind);
      var o = { message: e.msg }, fr = errFrames(e.stack, e.src);
      if (fr.length) o.stacktrace = fr;
      try { Crash.recordException(o).then(null, function () {}); } catch (x) {}
    };
  }

  /* ---- back button ---- */
  if (P.App && P.App.addListener) {
    P.App.addListener('backButton', function () {
      /* On the title with no run paused behind it there is nowhere to go
         back to: Android expects the app to close. */
      var runWaiting = visible('resume-row');
      if (visible('screen-title') && !runWaiting) {
        if (P.App.exitApp) P.App.exitApp();
        return;
      }
      /* The results and the tutorial's last card have no Esc of their own;
         back from them is back to the menu, like their Menu button. */
      var menu = (visible('screen-over') && document.querySelector('#screen-over [data-action="back-title"]')) ||
                 (visible('screen-tutdone') && document.querySelector('#screen-tutdone [data-action="back-title"]'));
      if (menu) { menu.click(); return; }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    /* Going to the background is a pause, like the platform's onPause,
       and the sound stops with it: the phone locked, or another app on
       top. An ad or the board fires it too; the run waits for them. */
    P.App.addListener('pause', function () {
      hold(true);
      if (away) return;
      if (visible('hud')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    P.App.addListener('resume', function () { hold(false); });
  }

  /* ---- haptics ---- */
  if (P.Haptics && P.Haptics.vibrate) {
    navigator.vibrate = function (pattern) {
      /* The plugin takes one length; a pattern becomes its buzzing parts
         added up, which is how long it would have been felt for. */
      var ms = 0;
      if (typeof pattern === 'number') ms = pattern;
      else if (pattern && pattern.length) for (var i = 0; i < pattern.length; i += 2) ms += pattern[i] || 0;
      if (ms > 0) { try { P.Haptics.vibrate({ duration: Math.min(400, ms) }); } catch (e) {} }
      return true;
    };
  }

  /* ---- privacy policy ---- */
  /* A plain link: the app's web view hands any address that is not its own
     to the phone's browser. */
  /* At the end of the panel, under the language. They went in before its
     last row of buttons, which was Back; with Back gone that was the
     language, and the links came between it and its heading. */
  var setPanel = document.querySelector('#screen-settings .panel');
  function setLink(key, en) {
    var a = document.createElement('a');
    a.className = 'set-link';
    a.setAttribute('data-i18n', key);
    a.textContent = typeof t === 'function' ? t(key) : en;
    setPanel.appendChild(a);
    return a;
  }
  if (setPanel) setLink('set.privacy', 'Privacy policy').href = 'https://vitalyganea.github.io/ice-dash/privacy.html';

  /* ---- rewarded ads (AdMob) ---- */
  /* AD_UNIT is the rewarded unit from the AdMob console ("Revive and
     double"); the app's own AdMob id is in res/values/play-ids.xml (the
     iPhone app's: AD_UNIT_IOS and ios/ids.xcconfig). Empty,
     Google's own test unit plays instead, and so it does in a debug build
     (Capacitor.DEBUG: "Ice Dasher debug", installed beside the Play one to
     measure the game on a phone), so that no real ad is shown there. As
     it is, AdMob does not know that app's id: its consent check fails
     ("Error making request.") and it is offered no ads at all.
     Emulators get test ads from the real unit by themselves; a phone used
     for testing the Play build is added in AdMob → Settings → Test devices,
     so that no real ad is ever tapped on it.
     (The test unit is named outright: on a phone AdMob counts as a test
     device, the plugin uses whatever unit it is given.) */
  var AD_UNIT_ANDROID = 'ca-app-pub-6104904420104536/6883567494';
  var AD_UNIT_IOS = 'ca-app-pub-6104904420104536/8308143427';
  var AD_UNIT = IOS ? AD_UNIT_IOS : AD_UNIT_ANDROID;
  var TEST_UNIT = IOS ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917';
  var Ad = P.AdMob;
  var adOk = false, adLoaded = false, adLoading = false, adWait = 0, adOn = false;
  function loadAd() {
    if (!Ad || !adOk || adLoaded || adLoading) return;
    adLoading = true;
    Ad.prepareRewardVideoAd({ adId: AD_UNIT || TEST_UNIT, isTesting: !AD_UNIT || !!Cap.DEBUG }).then(function () {
      adLoading = false; adLoaded = true; adWait = 0;
    }, function () {
      /* No ad to be had (no network, or none to fill it): ask again
         later, half a minute at first and up to five. */
      adLoading = false;
      adWait = Math.min(300000, adWait ? adWait * 2 : 30000);
      setTimeout(loadAd, adWait);
    });
  }
  if (Ad && Ad.requestConsentInfo) {
    /* The consent form first, where it is needed, and ads only once it
       allows them. Off the network the question waits for the next start;
       until then no ad is offered. */
    Ad.requestConsentInfo().then(function (info) {
      if (info && info.status === 'REQUIRED' && info.isConsentFormAvailable) return Ad.showConsentForm();
      return info;
    }).then(function (info) {
      if (info && info.privacyOptionsRequirementStatus === 'REQUIRED' && setPanel) {
        setLink('set.adprivacy', 'Ad privacy choices').addEventListener('click', function (e) {
          e.preventDefault();
          Ad.showPrivacyOptionsForm().then(null, function () {});
        });
      }
      if (!info || !info.canRequestAds) return;
      return Ad.initialize({}).then(function () { adOk = true; loadAd(); });
    }).then(null, function () {});
  }
  PLAT.adReady = function () { return adLoaded && !adOn; };
  /* done(true) only for an ad watched through to its reward. */
  PLAT.showAd = function (done) {
    if (!adLoaded || adOn) { done(false); return; }
    adOn = true; adLoaded = false;
    var earned = false, over = false, hs = [];
    function end() {
      if (over) return;
      over = true; adOn = false;
      /* On the phone a listener's handle comes back as it is; in a
         browser, as a promise of one. Either way it is let go. */
      hs.forEach(function (h) {
        Promise.resolve(h).then(function (x) { if (x && x.remove) x.remove(); }, function () {});
      });
      quiet(false);
      done(earned);
      loadAd();                        // the next one, ready for next time
    }
    hs.push(Ad.addListener('onRewardedVideoAdReward', function () { earned = true; }));
    /* The reward can be reported a moment after the ad is closed. */
    hs.push(Ad.addListener('onRewardedVideoAdDismissed', function () { setTimeout(end, 300); }));
    hs.push(Ad.addListener('onRewardedVideoAdFailedToShow', end));
    quiet(true);
    Ad.showRewardVideoAd().then(function () { earned = true; }, end);
  };

  /* ---- the Freeride board (Google Play Games; Game Center on the iPhone) ---- */
  /* The board's ids are in res/values/play-ids.xml (ios/ids.xcconfig);
     while they are empty the plugin says there is no board and the buttons
     stay hidden. Play Games and Game Center sign the player in by
     themselves as the app starts. A best is sent once the board has taken
     it; one that could not go (not signed in, no network) goes with the
     next save, after the board is opened, or, on the iPhone, as soon as
     Game Center has signed the player in. */
  /* What goes up is each Freeride run's score, not the best of all time:
     the board keeps a player's best of the day, of the week and of all time
     by itself, and handed the best of all time with every save it put that
     on the day's and the week's boards as well (reported 18 Nov 2026). The
     highest score not yet taken waits here and goes at the next chance;
     PLAT.boardSent tells ui.js what the board has taken. */
  var PG = P.PlayGames || P.GameCenter, board = false, pend = 0, sending = null;
  function send() {
    if (!board || !pend || sending) return sending;
    var n = pend;
    pend = 0;
    /* the player's card goes up with the score (ui.js PLAT.boardCard): as a
       tag on Play Games, as the context on Game Center */
    var code = PLAT.boardCard ? PLAT.boardCard() : 0, sub = { score: n };
    if (code > 0) { if (IOS) sub.ctx = String(code); else sub.tag = code.toString(36); }
    sending = PG.submit(sub).then(function (r) {
      sending = null;
      if (r && r.sent) {
        if (PLAT.boardSent) PLAT.boardSent(n);
        if (pend) send();                          // a run that ended while this one went
      } else if (n > pend) pend = n;               // not taken (not signed in, no network): it waits for the next chance
    }, function () { sending = null; if (n > pend) pend = n; });
    return sending;
  }
  if (PG && PG.addListener && IOS) PG.addListener('signedIn', function () { send(); });
  if (PG && PG.status) {
    PG.status().then(function (st) {
      board = !!(st && st.available);
      try { window.dispatchEvent(new Event('icedash-board')); } catch (e) {}
      send();
    }, function () {});
  }
  PLAT.boardReady = function () { return board; };
  PLAT.boardScore = function (n) { if (n > pend) pend = n; send(); };
  PLAT.boardShow = function () {
    if (!board || away) return;
    quiet(true);
    function back() { quiet(false); send(); }
    PG.show().then(back, back);
  };
  /* The rows for the game's own board panel (ui.js), span "day", "week" or
     "all". A best still on its way goes first, so the player's own row is
     never behind their title screen. */
  if (PG && PG.top) {
    PLAT.boardTop = function (span) {
      if (!board) return Promise.reject(new Error('no board'));
      return Promise.resolve(send()).then(function () { return PG.top({ span: span }); });
    };
  }
  /* The cards board (1.3.1): each player's card as it is now, at once. A
     board keeps a card only with a best, so a card changed after the best
     was never seen on the Freeride board (the owner, 19 Nov 2026); here the
     "score" is the time the card goes up, seconds since 2026, which only
     grows: every card is a new best. A card that cannot go now (not signed
     in, no network) waits and goes at the next chance. */
  var cardPend = 0, cardSending = null, cardLast = 0;
  function sendCard() {
    if (!board || !cardPend || cardSending) return cardSending;
    var code = cardPend; cardPend = 0;
    var sc = Math.max(cardLast + 1, Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 1000)), sub = { score: sc, which: 'cards' };
    if (IOS) sub.ctx = String(code); else sub.tag = code.toString(36);
    cardSending = PG.submit(sub).then(function (r) {
      cardSending = null;
      if (r && r.sent) { cardLast = sc; if (PLAT.cardSent) PLAT.cardSent(code); if (cardPend) sendCard(); }
      else if (!cardPend) cardPend = code;
      return !!(r && r.sent);
    }, function () { cardSending = null; if (!cardPend) cardPend = code; return false; });
    return cardSending;
  }
  if (PG && PG.submit) {
    PLAT.cardSend = function (code) { if (code > 0) cardPend = code; return Promise.resolve(sendCard()); };
    if (PG.addListener && IOS) PG.addListener('signedIn', function () { sendCard(); });
    window.addEventListener('icedash-board', function () { sendCard(); });
  }
  /* the newest cards: { rows: [{ name, tag | ctx }] }, the hundred newest */
  if (PG && PG.top) {
    PLAT.cardTop = function () {
      if (!board) return Promise.reject(new Error('no board'));
      return PG.top({ span: 'all', which: 'cards' });
    };
  }
  /* The player's own place of all time, for the best on the title, once a
     best still on its way has gone: { rank, score } or null. */
  if (PG && PG.mine) {
    PLAT.boardMine = function () {
      if (!board) return Promise.resolve(null);
      return Promise.resolve(send()).then(function () { return PG.mine(); })
        .then(function (r) { return r && r.rank > 0 ? r : null; }, function () { return null; });
    };
  }

  /* ---- one board for both phones (1.3.5) ----
     Asked for by the owner, 22 Nov 2026: Play Games and Game Center cannot
     show each other's players, so the Freeride board, the cards and the
     player's own place come from the game's own server (server/, on
     Cloudflare). The native boards go on being sent to as before, and are
     what the panel shows whenever the server cannot be had.
     Who the player is is proven once with the platform's own proof
     (PG.serverAuth: a Play Games code, or Game Center's signature); the
     server's token is kept (localStorage 'icedash-srv') and used until it
     is refused. Until a first proof has gone through (Android without the
     server's client id, not signed in), nothing here is used.
     A run goes up with its metres and seconds, which the server checks; one
     that cannot go now (no network) waits in 'icedash-srv-run', the highest
     first. The save's best from before the shared board goes up once. The
     rows' own key (k) marks the player's row; the top is fetched past the
     server's half-minute cache once the player has sent something. */
  var SRV = 'https://board.icedasher.workers.dev', SRV_KEY = 'icedash-srv', SRV_RUN = 'icedash-srv-run';
  var srv = {}, srvRun = null, srvBest = 0, srvSending = null, srvLogging = null;
  try { srv = JSON.parse(localStorage.getItem(SRV_KEY) || '{}') || {}; } catch (e) { srv = {}; }
  try { srvRun = JSON.parse(localStorage.getItem(SRV_RUN) || 'null'); } catch (e) { srvRun = null; }
  var srvOn = !!(PG && PG.serverAuth && window.fetch);
  function srvKeep() { try { localStorage.setItem(SRV_KEY, JSON.stringify(srv)); } catch (e) {} }
  function srvKeepRun() {
    try { if (srvRun) localStorage.setItem(SRV_RUN, JSON.stringify(srvRun)); else localStorage.removeItem(SRV_RUN); } catch (e) {}
  }
  function srvUse() { return srvOn && !!srv.k; }
  function srvReq(method, path, body, auth) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    var h = { 'content-type': 'application/json' };
    if (auth) h.authorization = 'Bearer ' + srv.token;
    function fail(status, msg) { var e = new Error(msg || String(status)); e.status = status; return e; }
    return fetch(SRV + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        return r.json().then(function (j) { if (!r.ok) throw fail(r.status, j && j.error); return j; },
                             function () { throw fail(r.status); });
      }, function (e) { clearTimeout(timer); throw e; });
  }
  /* The first proof comes a few seconds after the start (the platform
     signs the player in, then Google or Apple is asked). A board opened
     before it has gone through waits for it, six seconds at most, rather
     than showing the platform's own board (the owner, 23 Nov 2026: Today
     and back to All time had to be tapped for the scores to show). Once a
     try has failed (no client id, not signed in), nothing waits. */
  var srvTried = 'none', srvWaiters = [];             // 'none', 'busy', 'failed' or 'ok'
  function srvSettle(how) { srvTried = how; var w = srvWaiters; srvWaiters = []; w.forEach(function (f) { f(); }); }
  function srvWait(ms) {
    if (srvUse() || srvTried === 'failed') return Promise.resolve();
    return new Promise(function (res) {
      var done = false;
      function go() { if (!done) { done = true; res(); } }
      srvWaiters.push(go);
      setTimeout(go, ms);
    });
  }
  function srvLogin(fresh) {
    if (!srvOn) return Promise.reject(new Error('off'));
    if (!fresh && srv.token && Date.now() - (srv.at || 0) < 20 * 86400000) return Promise.resolve(srv);
    if (srvLogging) return srvLogging;
    srvTried = 'busy';
    srvLogging = PG.serverAuth().then(function (proof) { return srvReq('POST', '/v1/auth', proof); }).then(function (r) {
      srvLogging = null;
      srv.token = r.token; srv.k = r.k; srv.name = r.name || ''; srv.at = Date.now();
      srvKeep();
      srvSettle('ok');
      return srv;
    }, function (e) { srvLogging = null; srvSettle('failed'); throw e; });
    return srvLogging;
  }
  /* with the token, and once more with a fresh one if it is refused */
  function srvAuthed(method, path, body) {
    return srvLogin().then(function () { return srvReq(method, path, body, true); }).catch(function (e) {
      if (e && e.status === 401 && srv.token) return srvLogin(true).then(function () { return srvReq(method, path, body, true); });
      throw e;
    });
  }
  function srvCard() { var c = PLAT.boardCard ? PLAT.boardCard() : 0; return c > 0 ? c.toString(36) : ''; }
  function srvSend() {
    if (!srvOn) return Promise.resolve();
    if (srvSending) return srvSending;
    var job = Promise.resolve(), sent = false;
    if (srvBest > 0 && !srv.imported) {
      var b = srvBest;
      job = job.then(function () { return srvAuthed('POST', '/v1/score', { score: b, kind: 'best', card: srvCard() }); })
        .then(function () { srv.imported = true; sent = true; srvKeep(); });
    }
    if (srvRun) {
      var run = srvRun;
      job = job.then(function () { return srvAuthed('POST', '/v1/score', { score: run.score, dist: run.dist, secs: run.secs, card: srvCard() }); })
        .then(function () { sent = true; if (srvRun === run) { srvRun = null; srvKeepRun(); } }, function (e) {
          /* refused for good (not a run the game could make): let go;
             no network, or too soon after the last: it waits */
          if (e && (e.status === 400 || e.status === 422)) { if (srvRun === run) { srvRun = null; srvKeepRun(); } }
          else throw e;
        });
    }
    srvSending = job.then(function () {
      srvSending = null;
      if (sent) { srv.posted = Date.now(); srvKeep(); }
    }, function () { srvSending = null; });
    return srvSending;
  }
  function srvRows(rows) {
    return (rows || []).map(function (x) {
      var r = { rank: x.rank, name: x.name, score: x.score, plat: x.plat, me: !!(srv.k && x.k === srv.k) };
      if (x.card) r.tag = x.card;
      return r;
    });
  }
  function srvFresh() { return srv.posted ? '&t=' + srv.posted : ''; }
  if (srvOn) {
    var nativeScore = PLAT.boardScore, nativeTop = PLAT.boardTop, nativeMine = PLAT.boardMine,
        nativeCardTop = PLAT.cardTop, nativeCardSend = PLAT.cardSend;
    PLAT.boardScore = function (n, res) {
      if (nativeScore) nativeScore(n);
      if (res && res.secs > 0 && (!srvRun || n > srvRun.score)) { srvRun = { score: n, dist: res.dist | 0, secs: res.secs }; srvKeepRun(); }
      srvSend();
    };
    PLAT.boardBestIs = function (n) { if (n > srvBest) srvBest = n; if (!srv.imported) srvSend(); };
    /* The rows are fetched at the start, once the player is proven, and
       kept: the board opens on them at once, and asks again after half a
       minute, or once the player has sent something since. */
    var srvTops = {};
    function srvTop(span) {
      var c = srvTops[span];
      if (c && Date.now() - c.at < 30000 && c.at >= (srv.posted || 0)) return Promise.resolve(c.out);
      var mine = srvSend().then(function () { return srvAuthed('GET', '/v1/me'); }).catch(function () { return null; });
      return Promise.all([srvReq('GET', '/v1/top?span=' + encodeURIComponent(span) + srvFresh()), mine]).then(function (a) {
        var out = { rows: srvRows(a[0].rows) }, me = a[1] && a[1][span];
        if (me) out.me = { rank: me.rank, score: me.score, name: srv.name || '', plat: IOS ? 'ios' : 'android' };
        srvTops[span] = { at: Date.now(), out: out };
        return out;
      });
    }
    PLAT.boardTop = function (span) {
      return srvWait(6000).then(function () {
        if (!srvUse()) return nativeTop ? nativeTop(span) : Promise.reject(new Error('no board'));
        return srvTop(span).catch(function () { return nativeTop ? nativeTop(span) : Promise.reject(new Error('no board')); });
      });
    };
    PLAT.boardMine = function () {
      return srvWait(6000).then(function () {
        if (!srvUse()) return nativeMine ? nativeMine() : null;
        return srvSend().then(function () { return srvAuthed('GET', '/v1/me'); })
          .then(function (r) { return r && r.all && r.all.rank > 0 ? r.all : null; })
          .catch(function () { return nativeMine ? nativeMine() : null; });
      });
    };
    PLAT.cardTop = function () {
      return srvWait(6000).then(function () {
        if (!srvUse()) return nativeCardTop ? nativeCardTop() : Promise.reject(new Error('no board'));
        return srvReq('GET', '/v1/cards?v=1' + srvFresh()).then(function (r) { return { rows: srvRows(r.rows) }; },
          function () { return nativeCardTop ? nativeCardTop() : Promise.reject(new Error('no board')); });
      });
    };
    PLAT.cardSend = function (code) {
      var p = nativeCardSend ? nativeCardSend(code) : Promise.resolve(false);
      /* one that cannot go now goes with the next score, which carries the card */
      if (code > 0 && srvUse()) srvAuthed('POST', '/v1/card', { card: code.toString(36) }).then(function () { srv.posted = Date.now(); srvKeep(); }, function () {});
      return p;
    };
    /* the proof once the platform has signed the player in: at the start,
       and on the iPhone whenever Game Center says so */
    /* ...and the rows fetched then, for the board to open on; a board or
       a place already shown from the platform's own board is asked again
       (ui.js, 'icedash-board-fresh') */
    var srvStart = function () {
      var was = srvUse();
      srvLogin().then(function () {
        return srvSend().then(function () { return srvTop('all').catch(function () {}); }).then(function () {
          if (!was) { try { window.dispatchEvent(new Event('icedash-board-fresh')); } catch (e) {} }
        });
      }, function () {});
    };
    window.addEventListener('icedash-board', srvStart);
    if (PG.addListener && IOS) PG.addListener('signedIn', srvStart);
  }

  /* ---- the save in the cloud (Play Games saved games; iCloud on the iPhone) ----
     ui.js reads it once at the start (PLAT.cloudLoad) and, once the cloud
     has answered, hands over every save (PLAT.cloudSave). Saves are put
     together for a few seconds and sent one at a time, the last one wins;
     going out of sight sends what is waiting at once. */
  if (PG && PG.cloudLoad && PG.cloudSave) {
    var cloudNext = null, cloudBusy = false, cloudTimer = 0;
    var flushCloud = function () {
      clearTimeout(cloudTimer);
      if (cloudBusy || !cloudNext) return;
      var c = cloudNext;
      cloudNext = null;
      cloudBusy = true;
      PG.cloudSave(c).then(done, done);
      function done() { cloudBusy = false; if (cloudNext) cloudTimer = setTimeout(flushCloud, 1000); }
    };
    PLAT.cloudLoad = function () {
      return PG.cloudLoad().then(function (r) { return r || {}; }, function () { return {}; });
    };
    PLAT.cloudSave = function (data, progress) {
      cloudNext = { data: data, progress: progress };
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(flushCloud, 4000);
    };
    if (P.App && P.App.addListener) P.App.addListener('pause', flushCloud);
  }

  /* ---- asking for a review (the store's own card) ---- */
  /* ui.js says when a run ended on a high point. After ten runs the player
     knows the game; after a month the question may come once more. Google
     (and Apple, three times a year) keeps a limit of its own and may show
     nothing, and says neither way.
     The card comes a moment after the results, so the new best is seen
     first; if the results are gone by then, the moment has passed. */
  var Rev = P.InAppReview, REV_KEY = 'icedash-review', revDue = false;
  PLAT.goodMoment = function (runs) {
    if (!Rev || !Rev.requestReview || revDue || away || runs < 10) return;
    var last = 0;
    try { last = +localStorage.getItem(REV_KEY) || 0; } catch (e) {}
    if (Date.now() - last < 30 * 86400000) return;
    revDue = true;
    setTimeout(function () {
      revDue = false;
      if (away || !visible('screen-over')) return;
      try { localStorage.setItem(REV_KEY, String(Date.now())); } catch (e) {}
      quiet(true);
      function back() { quiet(false); }
      Rev.requestReview().then(back, back);
    }, 2500);
  };

  /* ---- a newer version in the store (1.3.3) ----
     Asked for by the owner, 20 Nov 2026: many players stay several versions
     behind. version.json, next to the privacy policy on the game's own
     page, says the newest version on each store, what is new in it in the
     six languages, and the oldest version still allowed ("min"; older than
     that, the banner cannot be put away). It is changed only once a
     version is live in the store, so the banner never sends anyone to a
     store that does not have it yet. On Android, Play is asked as well:
     a phone its rollout has not reached hears nothing, and the button
     puts up Play's own update screen, which downloads, installs and
     restarts the game. The iPhone cannot update itself: the button opens
     the App Store's page. Nothing about the player goes anywhere: the page
     is fetched as any page is, and only the version is compared, here. */
  var UPD_URL = 'https://vitalyganea.github.io/ice-dash/version.json';
  var STORE = IOS ? 'https://apps.apple.com/app/id6830137061'
                  : 'https://play.google.com/store/apps/details?id=com.veetalea.icedash';
  var Upd = P.AppUpdate, playHas = false;
  function verCmp(a, b) {               // -1, 0, 1 for "1.3.2"-style versions
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var p = parseInt(x[i], 10) || 0, q = parseInt(y[i], 10) || 0;
      if (p !== q) return p < q ? -1 : 1;
    }
    return 0;
  }
  PLAT.verCmp = verCmp;
  /* { version, notes: { en: [...], ru: [...], ... }, force } or null */
  PLAT.updateCheck = function () {
    if (!P.App || !P.App.getInfo || !window.fetch) return Promise.resolve(null);
    var mine = null;
    return P.App.getInfo().then(function (info) {
      mine = info && info.version;
      if (!mine) return null;
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
      return fetch(UPD_URL + '?t=' + Math.floor(Date.now() / 3600000), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(timer); return r.ok ? r.json() : null; });
    }).then(function (j) {
      var side = j && j[IOS ? 'ios' : 'android'];
      if (!side || !side.version || verCmp(side.version, mine) <= 0) return null;
      var out = { version: side.version, notes: j.notes || {}, force: !!(side.min && verCmp(mine, side.min) < 0), mine: mine };
      if (IOS || !Upd || !Upd.check) return out;
      /* Play's word: the rollout may not have reached this phone yet */
      return Upd.check().then(function (p) {
        playHas = !!(p && (p.available || p.inProgress));
        return p && p.answered && !p.available && !p.inProgress ? null : out;
      }, function () { return out; });
    }).catch(function () { return null; });
  };
  /* the button: Play's own update screen, or the store's page */
  PLAT.updateGo = function () {
    function page() {
      var a = document.createElement('a');
      a.href = STORE; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
    }
    if (!IOS && playHas && Upd && Upd.start) {
      Upd.start().then(function (r) { if (!r || !r.started) page(); }, page);
    } else page();
  };

  /* ---- full screen ---- */
  /* Capacitor's own SystemBars runs the page edge to edge, the way Android
     15 does it (insetsHandling in capacitor.config.json); the page keeps
     clear of the camera hole through env(safe-area-inset-*). Only the status
     bar is hidden — the navigation bar or gesture line stays where the
     player expects it. */
  if (P.SystemBars && P.SystemBars.hide) {
    try { P.SystemBars.hide({ bar: 'StatusBar' }); } catch (e) {}
  }
})();
