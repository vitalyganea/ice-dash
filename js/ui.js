/* ===========================================================
   ui.js — menus, best score, Playables lifecycle
   =========================================================== */
(function () {
  'use strict';

  var LOAD_TIMEOUT = 3000;
  var SAVE_KEY = 'pinerush-save-v1';
  var IN_YT = !!(window.ytgame && window.ytgame.IN_PLAYABLES_ENV);

  /* -------------------------- saving ------------------------- */
  function defaults() {
    return { best: 0, runs: 0, sfx: true, music: true,
             fish: 0, gold: 0, owned: ['snowcap'], equipped: 'snowcap' };
  }
  var save = defaults();
  var canSave = false, saving = false, saveAgain = false;

  function adopt(raw) {
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return;
      save.best  = Math.max(0, parseInt(o.best, 10) || 0);
      save.runs  = Math.max(0, parseInt(o.runs, 10) || 0);
      save.sfx   = o.sfx !== false;
      save.music = o.music !== false;
      save.fish  = Math.max(0, parseInt(o.fish, 10) || 0);
      save.gold  = Math.max(0, parseInt(o.gold, 10) || 0);
      /* Only ids this build actually knows about survive the load, so a save
         written by a later version cannot equip a skin that is not here. */
      save.owned = ['snowcap'];
      if (Object.prototype.toString.call(o.owned) === '[object Array]')
        for (var i = 0; i < o.owned.length; i++)
          if (SKIN_BY_ID[o.owned[i]] && save.owned.indexOf(o.owned[i]) < 0)
            save.owned.push(o.owned[i]);
      save.equipped = (SKIN_BY_ID[o.equipped] && save.owned.indexOf(o.equipped) >= 0)
                    ? o.equipped : 'snowcap';
    } catch (e) { /* a corrupt save just falls back to the defaults */ }
  }
  function loadSave() {
    if (IN_YT) {
      return Promise.race([
        window.ytgame.game.loadData().then(adopt, function () {}),
        new Promise(function (r) { setTimeout(r, LOAD_TIMEOUT); })
      ]);
    }
    try { adopt(localStorage.getItem(SAVE_KEY)); } catch (e) {}
    return Promise.resolve();
  }
  function store() {
    if (!canSave) return;
    if (saving) { saveAgain = true; return; }
    var data = JSON.stringify(save);
    if (!IN_YT) { try { localStorage.setItem(SAVE_KEY, data); } catch (e) {} return; }
    saving = true;
    window.ytgame.game.saveData(data).then(done, function () {
      window.ytgame.game.saveData(data).then(done, done);
    });
    function done() { saving = false; pushScore(); if (saveAgain) { saveAgain = false; store(); } }
  }
  var lastSent = -1;
  function pushScore() {
    if (!IN_YT || !window.ytgame.engagement) return;
    if (save.best === lastSent) return;
    lastSent = save.best;
    window.ytgame.engagement.sendScore({ value: save.best })
      .then(null, function () { lastSent = -1; });
  }

  /* ------------------------- elements ------------------------ */
  var $ = function (id) { return document.getElementById(id); };
  var screens = { title: $('screen-title'), help: $('screen-help'),
                  pause: $('screen-pause'), over: $('screen-over'),
                  shop: $('screen-shop') };
  var hud = $('hud');
  var currentScreen = 'title';

  function show(name) {
    currentScreen = name;
    for (var k in screens) screens[k].classList.toggle('hidden', k !== name);
    /* The pause button belongs to play and nothing else. This used to be
       written the other way round, so show('game') hid it — which happened
       whenever a run started before loadData() came back, taking away the
       only way to pause for the rest of that run. */
    hud.classList.toggle('hidden', name !== 'game');
    if (name === 'shop') buildShop();
    if (name === 'title') {
      var t = $('title-best');
      t.textContent = '🏔️ Best ' + save.best + ' points';
      t.classList.toggle('hidden', save.best <= 0);
    }
  }
  function showGame() { show('game'); }

  /* --------------------------- game -------------------------- */
  function ride() {
    showGame();
    Sfx.unlock();
    Game.start(save.best, { hud: function () {}, over: onOver }, save.equipped);
  }

  function onOver(res) {
    save.runs++;
    var beat = res.score > save.best;
    if (beat) save.best = res.score;
    save.fish += res.coins || 0;
    save.gold += res.gold || 0;
    store();
    var earned = $('over-earned');
    var bits = [];
    if (res.coins) bits.push('+' + res.coins + ' 🐟');
    if (res.gold)  bits.push('+' + res.gold + ' ✨');
    earned.textContent = bits.join('   ');
    earned.classList.toggle('hidden', !bits.length);
    $('new-best').classList.toggle('hidden', !beat);
    $('over-score').textContent = res.score + ' points';
    var bits = [res.dist + ' m', res.fish + ' fish'];
    if (res.gold)  bits.push(res.gold + ' golden');
    if (res.gates) bits.push(res.gates + ' gates');
    if (res.saved) bits.push(res.saved + ' bubble save' + (res.saved > 1 ? 's' : ''));
    $('over-detail').textContent = bits.join('  ·  ');
    Game.pause();
    show('over');
  }

  /* -------------------------- actions ------------------------ */
  function act(name) {
    switch (name) {
      case 'play':       Sfx.click(); ride(); break;
      case 'help':       Sfx.click(); show('help'); break;
      case 'shop':       Sfx.click(); shopBack = currentScreen; show('shop'); break;
      case 'back-title':
        Sfx.click();
        /* Leaving the market puts you back where you opened it from, so
           browsing between runs does not throw away the end card. */
        if (currentScreen === 'shop' && shopBack === 'over') { shopBack = null; show('over'); break; }
        shopBack = null; Game.stop(); show('title'); break;
      case 'resume':     Sfx.click(); showGame(); Game.resume(); break;
    }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-action]') : null;
    if (t) act(t.getAttribute('data-action'));
  });
  $('btn-menu').addEventListener('click', function (e) {
    e.stopPropagation();
    if (!Game.isRunning() || Game.isPaused()) return;
    Sfx.click(); Game.pause(); show('pause');
  });

  /* ----------------------- audio toggles --------------------- */
  function syncToggles() {
    [['t-sfx', 't-sfx2', save.sfx], ['t-music', 't-music2', save.music]].forEach(function (g) {
      [$(g[0]), $(g[1])].forEach(function (el) {
        if (!el) return;
        el.classList.toggle('on', g[2]);
        el.setAttribute('aria-pressed', g[2] ? 'true' : 'false');
      });
    });
  }
  function toggleSfx()  { save.sfx = !save.sfx; store(); Sfx.sound(save.sfx); syncToggles(); if (save.sfx) Sfx.click(); }
  function toggleMusic(){ save.music = !save.music; store(); Sfx.unlock(); Sfx.music(save.music); syncToggles(); }
  ['t-sfx','t-sfx2'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('click', toggleSfx); });
  ['t-music','t-music2'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('click', toggleMusic); });

  /* ---------------------------- shop ------------------------- */
  var shopBack = null;

  function wallet() {
    $('wallet-fish').textContent = '🐟 ' + save.fish;
    $('wallet-gold').textContent = '✨ ' + save.gold;
  }

  function owns(id) { return save.owned.indexOf(id) >= 0; }
  function balance(cur) { return cur === 'gold' ? save.gold : save.fish; }

  function buildShop() {
    wallet();
    var grid = $('shop-grid');
    grid.textContent = '';
    for (var i = 0; i < SKINS.length; i++) grid.appendChild(card(SKINS[i]));
  }

  function card(sk) {
    var el = document.createElement('div');
    el.className = 'skin-card' + (save.equipped === sk.id ? ' worn' : '')
                               + (owns(sk.id) ? ' owned' : '');
    var cv = document.createElement('canvas');
    cv.className = 'skin-pic';
    el.appendChild(cv);
    Game.drawSkinPreview(cv, sk.id, 88);

    /* Portrait and words are separate boxes so a narrow screen can stand
       them side by side instead of making every card a screenful. */
    var info = document.createElement('div');
    info.className = 'skin-info';
    el.appendChild(info);

    var h = document.createElement('div');
    h.className = 'skin-name'; h.textContent = sk.name;
    info.appendChild(h);

    var perk = document.createElement('div');
    perk.className = 'skin-perk'; perk.textContent = sk.perkText;
    info.appendChild(perk);

    var b = document.createElement('button');
    b.className = 'btn btn-sm';
    b.setAttribute('data-skin', sk.id);
    if (save.equipped === sk.id) {
      b.textContent = '✓ Wearing'; b.disabled = true; b.className += ' btn-ghost';
    } else if (owns(sk.id)) {
      b.textContent = 'Wear'; b.className += ' btn-green';
    } else {
      var icon = sk.currency === 'gold' ? ' ✨' : ' 🐟';
      b.textContent = sk.price + icon;
      var canAfford = balance(sk.currency) >= sk.price;
      b.className += canAfford ? ' btn-blue' : ' btn-ghost';
      b.disabled = !canAfford;
      if (!canAfford) b.title = 'Catch ' + (sk.price - balance(sk.currency)) + ' more';
    }
    info.appendChild(b);
    return el;
  }

  $('shop-grid').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-skin]') : null;
    if (!b || b.disabled) return;
    var sk = SKIN_BY_ID[b.getAttribute('data-skin')];
    if (!sk) return;
    if (!owns(sk.id)) {
      if (balance(sk.currency) < sk.price) return;
      if (sk.currency === 'gold') save.gold -= sk.price; else save.fish -= sk.price;
      save.owned.push(sk.id);
      Sfx.gold();
    } else {
      Sfx.click();
    }
    save.equipped = sk.id;          // buying it puts it on straight away
    store();
    buildShop();
  });

  /* --------------------------- tapping ----------------------- */
  /* The control has to answer anywhere on the screen. Binding it to the
     canvas meant that on a tall phone the parts of the display outside the
     drawing surface — including where a thumb naturally rests — swallowed
     every tap. Two fingers landing together count as one tap, or the
     direction would flip twice and nothing would appear to happen. */
  var lastTap = -1e9;
  window.addEventListener('pointerdown', function (e) {
    if (currentScreen !== 'game' || Game.isPaused()) return;
    if (e.target && e.target.closest && e.target.closest('button, [data-action]')) return;
    var now = e.timeStamp || Date.now();
    if (now - lastTap < 45) return;
    lastTap = now;
    Game.tap();
  });
  document.addEventListener('contextmenu', function (e) {
    if (currentScreen === 'game') e.preventDefault();
  });

  /* ------------------------- keyboard ------------------------ */
  /* Esc is never swallowed: Design req. 2 forbids preventDefault() on it. */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (currentScreen === 'help') { Sfx.click(); act('back-title'); }
      else if (currentScreen === 'pause') act('resume');
      else if (Game.isRunning() && !Game.isPaused()) { Game.pause(); show('pause'); }
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      if (currentScreen === 'game' && !Game.isPaused()) Game.tap();
      return;
    }
    if (!Game.hasRun()) return;
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (Game.isPaused()) { if (currentScreen === 'pause') act('resume'); }
      else if (Game.isRunning()) { Game.pause(); show('pause'); }
    }
  });

  /* ------------------ Playables lifecycle -------------------- */
  function bootSdk() {
    if (!IN_YT) return;
    var sys = window.ytgame.system;
    sys.onPause(function () {
      if (Game.isRunning() && !Game.isPaused()) { Game.pause(); show('pause'); store(); }
      Game.suspend();
    });
    sys.onResume(function () { Game.unsuspend(); });
    try { Sfx.platformAudio(sys.isAudioEnabled()); } catch (e) {}
    sys.onAudioEnabledChange(function (on) { Sfx.platformAudio(on); });
  }
  function announce(fn) { if (IN_YT) { try { window.ytgame.game[fn](); } catch (e) {} } }

  function firstGesture() {
    Sfx.unlock(); Sfx.sound(save.sfx); Sfx.music(save.music);
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  }
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  /* --------------------------- boot -------------------------- */
  bootSdk();
  Sfx.sound(save.sfx);
  syncToggles();
  show('title');

  requestAnimationFrame(function () {
    announce('firstFrameReady');
    loadSave().then(function () {
      canSave = true;
      syncToggles();
      Sfx.sound(save.sfx);
      show(currentScreen === 'title' ? 'title' : currentScreen);
      pushScore();
      announce('gameReady');
    });
  });
})();
