/* ===========================================================
   native.js — the Android app's side of things (Capacitor only)
   -----------------------------------------------------------
   Only build-android.sh puts this in the page; the Playables bundle and
   the browser never load it. It keeps the game itself untouched:
     - the hardware back button is turned into the Esc key, which the game
       already understands (leave a panel, resume from pause, pause a run).
       On the title, with nothing to go back to, it leaves the app.
     - navigator.vibrate is answered by the native Haptics plugin, so the
       game's own buzz patterns work without the app asking for anything.
     - the status and navigation bars are hidden: the hill is the screen.
   Every call is guarded: off-device, or with a plugin missing, nothing
   here does anything and the game runs as it does on the web.
   =========================================================== */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins || {};

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
    /* Going to the background is a pause, like the platform's onPause. */
    P.App.addListener('pause', function () {
      if (visible('hud')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
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

  /* ---- full screen ---- */
  if (P.StatusBar && P.StatusBar.hide) {
    try { P.StatusBar.setOverlaysWebView && P.StatusBar.setOverlaysWebView({ overlay: true }); } catch (e) {}
    try { P.StatusBar.hide(); } catch (e) {}
  }
})();
