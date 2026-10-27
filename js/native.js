/* ===========================================================
   native.js — the Android app's side of things (Capacitor only)
   -----------------------------------------------------------
   Only build-android.sh puts this in the page; the Playables bundle and
   the browser never load it. It keeps the game itself untouched:
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
       PlayGames plugin (android/.../PlayGamesPlugin.java).
     - Google Play's own review card, at a high point only (a new best,
       three stars) and not before ten runs, at most once a month.
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
  var setPanel = document.querySelector('#screen-settings .panel');
  var setRows = setPanel ? setPanel.querySelectorAll('.btn-row') : [];
  var setBack = setRows[setRows.length - 1];   // Back; the language row is one too
  function setLink(key, en) {
    var a = document.createElement('a');
    a.className = 'set-link';
    a.setAttribute('data-i18n', key);
    a.textContent = typeof t === 'function' ? t(key) : en;
    setPanel.insertBefore(a, setBack);
    return a;
  }
  if (setBack) setLink('set.privacy', 'Privacy policy').href = 'https://vitalyganea.github.io/ice-dash/privacy.html';

  /* ---- rewarded ads (AdMob) ---- */
  /* AD_UNIT is the rewarded unit from the AdMob console ("Revive and
     double"); the app's own AdMob id is in res/values/play-ids.xml. Empty,
     Google's own test unit plays instead, and so it does in a debug build
     (Capacitor.DEBUG: "Ice Dash debug", installed beside the Play one to
     measure the game on a phone), so that no real ad is shown there. As
     it is, AdMob does not know that app's id: its consent check fails
     ("Error making request.") and it is offered no ads at all.
     Emulators get test ads from the real unit by themselves; a phone used
     for testing the Play build is added in AdMob → Settings → Test devices,
     so that no real ad is ever tapped on it.
     (The test unit is named outright: on a phone AdMob counts as a test
     device, the plugin uses whatever unit it is given.) */
  var AD_UNIT = 'ca-app-pub-6104904420104536/6883567494';
  var TEST_UNIT = 'ca-app-pub-3940256099942544/5224354917';
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
      if (info && info.privacyOptionsRequirementStatus === 'REQUIRED' && setBack) {
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

  /* ---- the Freeride board (Google Play Games) ---- */
  /* The board's ids are in res/values/play-ids.xml; while they are empty
     the plugin says there is no board and the buttons stay hidden. Play
     Games signs the player in by itself as the app starts. A best is sent
     once the board has taken it; one that could not go (not signed in, no
     network) goes with the next save or after the board is opened. */
  var PG = P.PlayGames, board = false, best = 0, sent = 0;
  function send() {
    if (!board || best <= sent) return;
    var n = best;
    PG.submit({ score: n }).then(function (r) { if (r && r.sent) sent = Math.max(sent, n); }, function () {});
  }
  if (PG && PG.status) {
    PG.status().then(function (st) {
      board = !!(st && st.available);
      try { window.dispatchEvent(new Event('icedash-board')); } catch (e) {}
      send();
    }, function () {});
  }
  PLAT.boardReady = function () { return board; };
  PLAT.boardScore = function (n) { if (n > best) best = n; send(); };
  PLAT.boardShow = function () {
    if (!board || away) return;
    quiet(true);
    function back() { quiet(false); send(); }
    PG.show().then(back, back);
  };

  /* ---- asking for a review (Google Play's own card) ---- */
  /* ui.js says when a run ended on a high point. After ten runs the player
     knows the game; after a month the question may come once more. Google
     keeps a limit of its own and may show nothing, and says neither way.
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
